import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Search, X, ChevronUp, ChevronDown, Highlighter, MessageSquare, Eraser, Hand, Crop } from 'lucide-react';

interface PdfViewerProps {
  file: File;
  pageNumber: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  /**
   * 框选区域回调：返回裁剪后的图片（只包含框内内容）
   * 这用于“只解析框选区域”，提升精度并减少 token。
   */
  onRegionExtract?: (payload: {
    pageNumber: number;
    rect: { x: number; y: number; width: number; height: number };
    imageDataUrl: string;
    pageText?: string;
  }) => void;
}

// Annotation types
interface Annotation {
  id: string;
  pageNumber: number;
  type: 'highlight' | 'underline' | 'note';
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  note?: string;
}

// 缩放级别：50% ~ 300%（相对于适应宽度）
const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const ZOOM_STEP = 25;
const DEFAULT_ZOOM = 100;

// Highlight colors
const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: 'rgba(255, 235, 59, 0.4)' },
  { name: 'Green', value: 'rgba(76, 175, 80, 0.4)' },
  { name: 'Blue', value: 'rgba(33, 150, 243, 0.4)' },
  { name: 'Pink', value: 'rgba(233, 30, 99, 0.4)' },
  { name: 'Orange', value: 'rgba(255, 152, 0, 0.4)' },
];

export const PdfViewer: React.FC<PdfViewerProps> = ({ file, pageNumber, totalPages, onPageChange, onRegionExtract }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomPercent, setZoomPercent] = useState<number>(DEFAULT_ZOOM);
  
  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{page: number, matches: number}[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [pageText, setPageText] = useState<string>('');
  
  // Annotation state
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationMode, setAnnotationMode] = useState<'none' | 'highlight' | 'underline' | 'note' | 'region'>('none');
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{x: number, y: number} | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [hoveredAnnotation, setHoveredAnnotation] = useState<Annotation | null>(null);
  const [mousePos, setMousePos] = useState<{x: number, y: number}>({x: 0, y: 0});
  
  // Pan/Drag state for free movement
  const [isPanMode, setIsPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{x: number, y: number}>({x: 0, y: 0});
  const [scrollStart, setScrollStart] = useState<{x: number, y: number}>({x: 0, y: 0});

  // Load annotations from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`pdf_annotations_${file.name}`);
    if (saved) {
      setAnnotations(JSON.parse(saved));
    }
  }, [file.name]);

  // Save annotations to localStorage
  const saveAnnotations = useCallback((newAnnotations: Annotation[]) => {
    setAnnotations(newAnnotations);
    localStorage.setItem(`pdf_annotations_${file.name}`, JSON.stringify(newAnnotations));
  }, [file.name]);

  // Load the PDF Document
  useEffect(() => {
    let isMounted = true;
    const loadPdf = async () => {
      if (!file || !window.pdfjsLib) return;
      
      try {
        setError(null);
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        
        if (isMounted) {
          setPdfDoc(doc);
        }
      } catch (err) {
        console.error("Error loading PDF:", err);
        if (isMounted) setError("Could not load PDF preview.");
      }
    };

    loadPdf();
    return () => { isMounted = false; };
  }, [file]);

  // Extract text from current page for search
  useEffect(() => {
    const extractText = async () => {
      if (!pdfDoc) return;
      
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: any) => item.str).join(' ');
        setPageText(text);
      } catch (err) {
        console.error("Error extracting text:", err);
      }
    };
    
    extractText();
  }, [pdfDoc, pageNumber]);

  // Render the specific Page
  useEffect(() => {
    let renderTask: any = null;
    let isCancelled = false;

    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

      try {
        const page = await pdfDoc.getPage(pageNumber);
        const unscaledViewport = page.getViewport({ scale: 1 });
        
        const containerWidth = containerRef.current.clientWidth - 32;
        const fitWidthScale = containerWidth / unscaledViewport.width;
        const finalScale = fitWidthScale * (zoomPercent / 100);
        
        const viewport = page.getViewport({ scale: finalScale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context || isCancelled) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Also resize annotation canvas
        if (annotationCanvasRef.current) {
          annotationCanvasRef.current.height = viewport.height;
          annotationCanvasRef.current.width = viewport.width;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);

        renderTask = page.render({
          canvasContext: context,
          viewport: viewport
        });

        await renderTask.promise;
        
        // Render annotations after page renders
        renderAnnotations();
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !isCancelled) {
          console.error("Render error:", err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNumber, zoomPercent]);

  // Render annotations on the annotation canvas
  const renderAnnotations = useCallback(() => {
    if (!annotationCanvasRef.current) return;
    
    const ctx = annotationCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, annotationCanvasRef.current.width, annotationCanvasRef.current.height);
    
    const pageAnnotations = annotations.filter(a => a.pageNumber === pageNumber);
    
    pageAnnotations.forEach(annotation => {
      if (annotation.type === 'highlight') {
        ctx.fillStyle = annotation.color;
        ctx.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
      } else if (annotation.type === 'underline') {
        ctx.strokeStyle = annotation.color.replace('0.4', '1');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(annotation.x, annotation.y + annotation.height);
        ctx.lineTo(annotation.x + annotation.width, annotation.y + annotation.height);
        ctx.stroke();
      } else if (annotation.type === 'note') {
        // Draw note indicator
        ctx.fillStyle = annotation.color.replace('0.4', '0.8');
        ctx.beginPath();
        ctx.arc(annotation.x + 10, annotation.y + 10, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', annotation.x + 10, annotation.y + 10);
      }
    });
    
    // Draw current selection
    if (isSelecting && selectionStart && selectionEnd) {
      const x = Math.min(selectionStart.x, selectionEnd.x);
      const y = Math.min(selectionStart.y, selectionEnd.y);
      const width = Math.abs(selectionEnd.x - selectionStart.x);
      const height = Math.abs(selectionEnd.y - selectionStart.y);

      if (annotationMode === 'region') {
        // 框选解析：用边框+半透明填充，更像“截图框选”
        ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x + 1, y + 1, Math.max(0, width - 2), Math.max(0, height - 2));
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = selectedColor;
        ctx.fillRect(x, y, width, height);
      }
    }
  }, [annotations, pageNumber, isSelecting, selectionStart, selectionEnd, selectedColor, annotationMode]);

  // Re-render annotations when they change
  useEffect(() => {
    renderAnnotations();
  }, [renderAnnotations]);

  // Keyboard shortcut for pan mode (Space key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsPanMode(true);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsPanMode(false);
        setIsPanning(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Search in entire PDF
  const handleSearch = async () => {
    if (!pdfDoc || !searchQuery.trim()) return;
    
    setIsSearching(true);
    const results: {page: number, matches: number}[] = [];
    
    try {
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: any) => item.str).join(' ').toLowerCase();
        const query = searchQuery.toLowerCase();
        
        let matches = 0;
        let pos = 0;
        while ((pos = text.indexOf(query, pos)) !== -1) {
          matches++;
          pos += query.length;
        }
        
        if (matches > 0) {
          results.push({ page: i, matches });
        }
      }
      
      setSearchResults(results);
      setCurrentMatch(0);
    } catch (err) {
      console.error("Search error:", err);
    }
    
    setIsSearching(false);
  };

  // Mouse event handlers for annotation
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking on an existing note to edit it
    if (annotationMode === 'none') {
      const pageAnnotations = annotations.filter(a => a.pageNumber === pageNumber);
      const clickedNote = pageAnnotations.find(a => {
        if (a.type === 'note') {
          const distance = Math.sqrt(Math.pow(x - (a.x + 10), 2) + Math.pow(y - (a.y + 10), 2));
          return distance <= 15;
        }
        return false;
      });
      if (clickedNote) {
        setEditingNote(clickedNote.id);
        setNoteText(clickedNote.note || '');
        return;
      }
      return;
    }
    
    if (annotationMode === 'note') {
      // Add note at click position
      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        pageNumber,
        type: 'note',
        color: selectedColor,
        x,
        y,
        width: 20,
        height: 20,
        note: ''
      };
      saveAnnotations([...annotations, newAnnotation]);
      setEditingNote(newAnnotation.id);
      setNoteText('');
    } else {
      setIsSelecting(true);
      setSelectionStart({ x, y });
      setSelectionEnd({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Update mouse position for tooltip
    setMousePos({ x: e.clientX, y: e.clientY });
    
    // Check if hovering over a note annotation
    const pageAnnotations = annotations.filter(a => a.pageNumber === pageNumber);
    const hoveredNote = pageAnnotations.find(a => {
      if (a.type === 'note') {
        const distance = Math.sqrt(Math.pow(x - (a.x + 10), 2) + Math.pow(y - (a.y + 10), 2));
        return distance <= 15;
      }
      return false;
    });
    setHoveredAnnotation(hoveredNote || null);
    
    // Handle selection drag
    if (isSelecting && annotationMode !== 'none' && annotationMode !== 'note') {
      setSelectionEnd({ x, y });
    }
  };

  const handleMouseUp = () => {
    if (!isSelecting || !selectionStart || !selectionEnd) {
      setIsSelecting(false);
      return;
    }
    
    const x = Math.min(selectionStart.x, selectionEnd.x);
    const y = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);
    
    if (width > 5 && height > 5) {
      // 框选解析：裁剪并回调，不写入标注
      if (annotationMode === 'region') {
        try {
          const baseCanvas = canvasRef.current;
          if (baseCanvas) {
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = Math.round(width);
            cropCanvas.height = Math.round(height);
            const cropCtx = cropCanvas.getContext('2d');
            if (cropCtx) {
              // 白底（避免透明背景影响识别）
              cropCtx.fillStyle = '#ffffff';
              cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
              cropCtx.drawImage(
                baseCanvas,
                x,
                y,
                width,
                height,
                0,
                0,
                cropCanvas.width,
                cropCanvas.height
              );
              const imageDataUrl = cropCanvas.toDataURL('image/png', 0.98);
              onRegionExtract?.({
                pageNumber,
                rect: { x, y, width, height },
                imageDataUrl,
                pageText,
              });
            }
          }
        } catch (err) {
          console.error('Region crop failed', err);
        }
      } else {
      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        pageNumber,
        type: annotationMode as 'highlight' | 'underline',
        color: selectedColor,
        x,
        y,
        width,
        height
      };
      saveAnnotations([...annotations, newAnnotation]);
      }
    }
    
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  // Clear all annotations for current page
  const clearPageAnnotations = () => {
    const filtered = annotations.filter(a => a.pageNumber !== pageNumber);
    saveAnnotations(filtered);
  };

  // Save note
  const saveNote = (id: string) => {
    const updated = annotations.map(a => 
      a.id === id ? { ...a, note: noteText } : a
    );
    saveAnnotations(updated);
    setEditingNote(null);
    setNoteText('');
  };

  // Pan/Drag handlers for container
  const handleContainerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only start panning if in pan mode or middle mouse button
    if ((isPanMode || e.button === 1) && containerRef.current) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setScrollStart({ 
        x: containerRef.current.scrollLeft, 
        y: containerRef.current.scrollTop 
      });
    }
  }, [isPanMode]);

  const handleContainerMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning && containerRef.current) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      containerRef.current.scrollLeft = scrollStart.x - deltaX;
      containerRef.current.scrollTop = scrollStart.y - deltaY;
    }
  }, [isPanning, panStart, scrollStart]);

  const handleContainerMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Wheel zoom handler
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoomPercent(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
    }
  }, []);

  // Double click to reset zoom
  const handleDoubleClick = useCallback(() => {
    setZoomPercent(DEFAULT_ZOOM);
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }, []);

  // Toggle pan mode
  const togglePanMode = useCallback(() => {
    setIsPanMode(prev => !prev);
    if (annotationMode !== 'none') {
      setAnnotationMode('none');
    }
  }, [annotationMode]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoomPercent(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomPercent(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const handleFitWidth = useCallback(() => {
    setZoomPercent(DEFAULT_ZOOM);
  }, []);

  const handleReset = useCallback(() => {
    setZoomPercent(DEFAULT_ZOOM);
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }, []);

  // Check if current page has search matches
  const currentPageMatches = searchQuery && pageText.toLowerCase().includes(searchQuery.toLowerCase());

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-300 bg-gray-800">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-800 relative">
      {/* Toolbar */}
      <div className="flex-shrink-0 bg-gray-900/90 backdrop-blur-sm border-b border-gray-700 px-3 py-2 flex items-center justify-between gap-2">
        {/* Left: Annotation Tools */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAnnotationMode(annotationMode === 'highlight' ? 'none' : 'highlight')}
            className={`p-1.5 rounded-md transition-colors ${
              annotationMode === 'highlight'
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="高亮标注"
          >
            <Highlighter size={16} />
          </button>
          
          <button
            onClick={() => setAnnotationMode(annotationMode === 'underline' ? 'none' : 'underline')}
            className={`p-1.5 rounded-md transition-colors ${
              annotationMode === 'underline'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="下划线"
          >
            <span className="text-xs font-bold underline">U</span>
          </button>
          
          <button
            onClick={() => setAnnotationMode(annotationMode === 'note' ? 'none' : 'note')}
            className={`p-1.5 rounded-md transition-colors ${
              annotationMode === 'note'
                ? 'bg-green-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="添加注释"
          >
            <MessageSquare size={16} />
          </button>

          {/* Region Extract (AI) */}
          <button
            onClick={() => {
              // 切换到框选解析时，避免与拖动模式冲突
              setAnnotationMode(prev => (prev === 'region' ? 'none' : 'region'));
              setIsPanMode(false);
            }}
            className={`p-1.5 rounded-md transition-colors ${
              annotationMode === 'region'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="框选解析（只分析框内内容）"
          >
            <Crop size={16} />
          </button>
          
          {/* Color Picker */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300"
              title="选择颜色"
            >
              <div className="w-4 h-4 rounded" style={{ backgroundColor: selectedColor.replace('0.4', '1') }} />
            </button>
            
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 flex gap-1 z-50">
                {HIGHLIGHT_COLORS.map(color => (
                  <button
                    key={color.name}
                    onClick={() => { setSelectedColor(color.value); setShowColorPicker(false); }}
                    className={`w-6 h-6 rounded border-2 ${
                      selectedColor === color.value ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value.replace('0.4', '1') }}
                    title={color.name}
                  />
                ))}
              </div>
            )}
          </div>
          
          <button
            onClick={clearPageAnnotations}
            className="p-1.5 rounded-md bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white transition-colors"
            title="清除本页标注"
          >
            <Eraser size={16} />
          </button>
          
          <div className="w-px h-5 bg-gray-600 mx-1"></div>
          
          {/* Pan/Move Mode Button */}
          <button
            onClick={togglePanMode}
            className={`p-1.5 rounded-md transition-colors ${
              isPanMode
                ? 'bg-cyan-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="拖动模式 (按住拖动移动视图)"
          >
            <Hand size={16} />
          </button>
        </div>
        
        {/* Center: Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={zoomPercent <= MIN_ZOOM}
            className="p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white disabled:opacity-40 transition-colors"
            title="缩小"
          >
            <ZoomOut size={16} />
          </button>
          
          <div className="min-w-[60px] text-center bg-gray-700/50 rounded px-2 py-1">
            <span className="text-xs font-mono text-gray-200">{zoomPercent}%</span>
          </div>
          
          <button
            onClick={handleZoomIn}
            disabled={zoomPercent >= MAX_ZOOM}
            className="p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white disabled:opacity-40 transition-colors"
            title="放大"
          >
            <ZoomIn size={16} />
          </button>
          
          <button
            onClick={handleFitWidth}
            className={`p-1.5 rounded-md transition-colors ${
              zoomPercent === DEFAULT_ZOOM
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="适应宽度"
          >
            <Maximize2 size={16} />
          </button>
        </div>
        
        {/* Right: Search & Reset */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            className="p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
            title="重置视图 (缩放100%并滚动到顶部)"
          >
            <RotateCcw size={16} />
          </button>
          
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1.5 rounded-md transition-colors ${
              showSearch
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="搜索"
          >
            <Search size={16} />
          </button>
        </div>
      </div>
      
      {/* Quick Tips Bar */}
      <div className="flex-shrink-0 bg-gray-900/50 px-3 py-1 text-[10px] text-gray-500 flex items-center justify-center gap-4 border-b border-gray-800">
        <span>💡 Ctrl+滚轮缩放</span>
        <span>🖱️ 按住空格+拖动平移</span>
        <span>🔍 双击重置</span>
      </div>
      
      {/* Search Bar */}
      {showSearch && (
        <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-3 py-2 flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="在文档中搜索..."
              className="w-full pl-3 pr-8 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors"
          >
            {isSearching ? '搜索中...' : '搜索'}
          </button>
          
          {searchResults.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <span>
                {searchResults.reduce((sum, r) => sum + r.matches, 0)} 个结果 / {searchResults.length} 页
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const newMatch = Math.max(0, currentMatch - 1);
                    setCurrentMatch(newMatch);
                    if (onPageChange && searchResults[newMatch]) {
                      onPageChange(searchResults[newMatch].page);
                    }
                  }}
                  disabled={currentMatch === 0}
                  className="p-1 hover:bg-gray-700 rounded disabled:opacity-40"
                  title="上一个结果"
                >
                  <ChevronUp size={14} />
                </button>
                <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                  {currentMatch + 1} / {searchResults.length}
                </span>
                <button
                  onClick={() => {
                    const newMatch = Math.min(searchResults.length - 1, currentMatch + 1);
                    setCurrentMatch(newMatch);
                    if (onPageChange && searchResults[newMatch]) {
                      onPageChange(searchResults[newMatch].page);
                    }
                  }}
                  disabled={currentMatch >= searchResults.length - 1}
                  className="p-1 hover:bg-gray-700 rounded disabled:opacity-40"
                  title="下一个结果"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          )}
          
          {currentPageMatches && (
            <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">
              本页有匹配
            </span>
          )}
        </div>
      )}
      
      {/* Annotation Mode Indicator */}
      {annotationMode !== 'none' && (
        <div className="flex-shrink-0 bg-indigo-600/20 border-b border-indigo-500/30 px-3 py-1.5 flex items-center justify-center gap-2">
          <span className="text-xs text-indigo-300">
            {annotationMode === 'highlight' && '🖍️ 高亮模式：拖动选择区域'}
            {annotationMode === 'underline' && '📏 下划线模式：拖动选择区域'}
            {annotationMode === 'note' && '📝 注释模式：点击添加注释'}
            {annotationMode === 'region' && '🎯 框选解析：拖动框选区域（只分析框内内容）'}
          </span>
          <button
            onClick={() => setAnnotationMode('none')}
            className="text-xs text-indigo-400 hover:text-white underline"
          >
            取消
          </button>
        </div>
      )}

      {/* Pan Mode Indicator */}
      {isPanMode && (
        <div className="flex-shrink-0 bg-cyan-600/20 border-b border-cyan-500/30 px-3 py-1.5 flex items-center justify-center gap-2">
          <span className="text-xs text-cyan-300">
            ✋ 拖动模式：按住鼠标拖动移动视图 | 滚轮+Ctrl缩放 | 双击重置
          </span>
          <button
            onClick={togglePanMode}
            className="text-xs text-cyan-400 hover:text-white underline"
          >
            退出
          </button>
        </div>
      )}

      {/* PDF Canvas with Annotation Layer */}
      <div 
        ref={containerRef} 
        className={`flex-1 overflow-auto flex justify-center items-start py-4 px-4 ${
          isPanMode ? 'cursor-grab active:cursor-grabbing' : ''
        } ${isPanning ? 'cursor-grabbing select-none' : ''}`}
        onMouseDown={handleContainerMouseDown}
        onMouseMove={handleContainerMouseMove}
        onMouseUp={handleContainerMouseUp}
        onMouseLeave={handleContainerMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        <div className="relative">
          <canvas 
            ref={canvasRef} 
            className="shadow-xl bg-white"
            style={{ maxWidth: 'none' }}
          />
          <canvas
            ref={annotationCanvasRef}
            className="absolute top-0 left-0"
            style={{ 
              maxWidth: 'none', 
              cursor: isPanMode ? 'inherit' : (annotationMode !== 'none' ? 'crosshair' : 'default'),
              pointerEvents: isPanMode ? 'none' : 'auto'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </div>
      
      {/* Note Tooltip */}
      {hoveredAnnotation && hoveredAnnotation.note && (
        <div 
          className="fixed z-50 bg-gray-900 text-white text-sm p-3 rounded-lg shadow-xl max-w-xs"
          style={{ 
            left: mousePos.x + 15, 
            top: mousePos.y + 15,
            pointerEvents: 'none'
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={12} className="text-yellow-400" />
            <span className="text-yellow-400 text-xs font-medium">注释</span>
          </div>
          <p className="text-gray-100 whitespace-pre-wrap">{hoveredAnnotation.note}</p>
        </div>
      )}
      
      {/* Annotation Statistics */}
      {annotations.filter(a => a.pageNumber === pageNumber).length > 0 && (
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <div className="bg-gray-900/90 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
            <span>📝 {annotations.filter(a => a.pageNumber === pageNumber).length} 个标注</span>
            {annotations.filter(a => a.pageNumber === pageNumber && a.type === 'note').length > 0 && (
              <span className="text-yellow-400">
                ({annotations.filter(a => a.pageNumber === pageNumber && a.type === 'note').length} 条注释)
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Note Editor Modal */}
      {editingNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setEditingNote(null); setNoteText(''); }}>
          <div className="bg-gray-800 rounded-xl shadow-2xl p-5 w-96 border border-gray-700" onClick={e => e.stopPropagation()}>
            <h3 className="font-medium text-white mb-3 flex items-center gap-2">
              <MessageSquare size={18} className="text-yellow-400" />
              {annotations.find(a => a.id === editingNote)?.note ? '编辑注释' : '添加注释'}
            </h3>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="输入您的注释..."
              className="w-full h-32 p-3 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              autoFocus
            />
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => {
                  const updated = annotations.filter(a => a.id !== editingNote);
                  saveAnnotations(updated);
                  setEditingNote(null);
                  setNoteText('');
                }}
                className="px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                删除注释
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingNote(null); setNoteText(''); }}
                  className="px-4 py-1.5 text-sm text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => saveNote(editingNote)}
                  className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};
