import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  FileImage, 
  X, 
  Loader2, 
  FileText, 
  Download, 
  Copy, 
  Check, 
  ChevronRight, 
  GripVertical,
  Trash2,
  Plus,
  Eye,
  Edit3,
  RefreshCw,
  FileDown,
  ScanText,
  ArrowUpDown
} from 'lucide-react';
import { generateStream } from '../services/aiService';
import { downloadAsWord, downloadAsMarkdown, copyToClipboard } from '../services/documentService';
import { PROMPTS } from '../constants';
import { AppSettings } from '../types';

interface ExamToDocPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  settings: AppSettings;
}

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  extractedContent?: string;
  isProcessing?: boolean;
  error?: string;
}

export const ExamToDocPanel: React.FC<ExamToDocPanelProps> = ({
  isOpen,
  onToggle,
  settings
}) => {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [mergedContent, setMergedContent] = useState('');
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('ai_professor_examdoc_width');
    return saved ? parseInt(saved) : 480;
  });
  const [isResizing, setIsResizing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Save panel width
  useEffect(() => {
    localStorage.setItem('ai_professor_examdoc_width', panelWidth.toString());
  }, [panelWidth]);

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.min(Math.max(350, newWidth), 800));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: UploadedImage[] = Array.from(files)
      .filter(file => file.type.startsWith('image/'))
      .map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        preview: URL.createObjectURL(file)
      }));

    setImages(prev => [...prev, ...newImages]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove image
  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img?.preview) {
        URL.revokeObjectURL(img.preview);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  // Clear all images
  const clearAllImages = () => {
    images.forEach(img => {
      if (img.preview) {
        URL.revokeObjectURL(img.preview);
      }
    });
    setImages([]);
    setMergedContent('');
  };

  // Convert image to base64
  const imageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Process single image
  const processImage = async (image: UploadedImage, pageNumber: number, totalPages: number): Promise<string> => {
    const base64 = await imageToBase64(image.file);
    
    // 基础 prompt
    let prompt = PROMPTS.EXTRACT_EXAM_TO_DOCUMENT(pageNumber, totalPages);
    
    // 如果用户设置了自定义 prompt，追加到识别请求中
    if (settings.customPrompt && settings.customPrompt.trim()) {
      prompt = `${prompt}\n\n## 用户自定义要求\n${settings.customPrompt.trim()}`;
    }
    
    let content = '';
    await generateStream(settings, prompt, [base64], (chunk) => {
      content += chunk;
    }, { skipSystemPrompt: true });
    
    return content;
  };

  // Process all images
  const processAllImages = async () => {
    if (images.length === 0 || !settings.apiKey) return;
    
    setIsProcessingAll(true);
    setMergedContent('');
    
    const totalPages = images.length;
    const processedContents: string[] = [];
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
      // Update processing status
      setImages(prev => prev.map(img => 
        img.id === image.id 
          ? { ...img, isProcessing: true, error: undefined }
          : img
      ));
      
      try {
        const content = await processImage(image, i + 1, totalPages);
        processedContents.push(content);
        
        // Update with extracted content
        setImages(prev => prev.map(img => 
          img.id === image.id 
            ? { ...img, isProcessing: false, extractedContent: content }
            : img
        ));
        
        // Update merged content progressively
        setMergedContent(processedContents.join('\n\n---\n\n'));
        
      } catch (err) {
        console.error('Failed to process image:', err);
        setImages(prev => prev.map(img => 
          img.id === image.id 
            ? { ...img, isProcessing: false, error: '识别失败，请重试' }
            : img
        ));
      }
    }
    
    setIsProcessingAll(false);
    setShowPreview(true);
  };

  // Reprocess single image
  const reprocessImage = async (id: string) => {
    const imageIndex = images.findIndex(img => img.id === id);
    if (imageIndex === -1) return;
    
    const image = images[imageIndex];
    
    setImages(prev => prev.map(img => 
      img.id === id 
        ? { ...img, isProcessing: true, error: undefined }
        : img
    ));
    
    try {
      const content = await processImage(image, imageIndex + 1, images.length);
      
      setImages(prev => prev.map(img => 
        img.id === id 
          ? { ...img, isProcessing: false, extractedContent: content }
          : img
      ));
      
      // Update merged content
      const allContents = images.map(img => 
        img.id === id ? content : (img.extractedContent || '')
      ).filter(c => c);
      setMergedContent(allContents.join('\n\n---\n\n'));
      
    } catch (err) {
      setImages(prev => prev.map(img => 
        img.id === id 
          ? { ...img, isProcessing: false, error: '识别失败，请重试' }
          : img
      ));
    }
  };

  // Export handlers
  const handleExportWord = () => {
    if (!mergedContent) return;
    const filename = `考卷_${new Date().toISOString().slice(0, 10)}.doc`;
    downloadAsWord(mergedContent, filename);
  };

  const handleExportMarkdown = () => {
    if (!mergedContent) return;
    const filename = `考卷_${new Date().toISOString().slice(0, 10)}.md`;
    downloadAsMarkdown(mergedContent, filename);
  };

  const handleCopy = async () => {
    if (!mergedContent) return;
    const success = await copyToClipboard(mergedContent);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Move image in order
  const moveImage = (id: string, direction: 'up' | 'down') => {
    setImages(prev => {
      const index = prev.findIndex(img => img.id === id);
      if (index === -1) return prev;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      
      const newImages = [...prev];
      [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
      return newImages;
    });
  };

  const processedCount = images.filter(img => img.extractedContent).length;

  return (
    <>
      {/* Collapsed Toggle Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="absolute right-0 top-1/3 -translate-y-1/2 z-20 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white p-2 rounded-l-lg shadow-lg transition-all hover:-translate-x-0.5"
          title="试卷转文档"
        >
          <ScanText size={20} />
        </button>
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        style={{ width: isOpen ? `${panelWidth}px` : '0px' }}
        className={`bg-slate-900 flex flex-col transition-all duration-300 ease-in-out flex-shrink-0 overflow-hidden border-l border-slate-800 ${isResizing ? 'transition-none' : ''}`}
      >
        {/* Resize Handle */}
        {isOpen && (
          <div
            onMouseDown={handleMouseDown}
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-500/50 transition-colors z-10 flex items-center"
          >
            <div className="w-full h-16 flex items-center justify-center">
              <GripVertical size={12} className="text-slate-600" />
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-teal-900/50 to-slate-900">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600">
              <ScanText size={14} className="text-white" />
            </div>
            <div>
              <span className="font-semibold text-sm text-white">试卷转文档</span>
              <span className="text-[10px] text-teal-400 block">上传图片 → 生成文档</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {images.length > 0 && (
              <button
                onClick={clearAllImages}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                title="清空所有"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={onToggle}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="关闭"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          
          {/* Upload Area */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-teal-500 rounded-xl p-6 text-center cursor-pointer transition-colors group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-800 rounded-full group-hover:bg-teal-900/50 transition-colors">
                <FileImage size={24} className="text-slate-400 group-hover:text-teal-400" />
              </div>
              <p className="text-sm text-slate-300 font-medium">点击或拖拽上传考卷图片</p>
              <p className="text-xs text-slate-500">支持 PNG、JPG、JPEG 格式，可多选</p>
            </div>
          </div>

          {/* Uploaded Images List */}
          {images.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <FileImage size={12} />
                  已上传 {images.length} 张图片
                  {processedCount > 0 && (
                    <span className="text-teal-400">（已识别 {processedCount} 张）</span>
                  )}
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1"
                >
                  <Plus size={12} />
                  添加
                </button>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                {images.map((image, index) => (
                  <div 
                    key={image.id}
                    className={`bg-slate-800/50 rounded-lg p-2 flex items-center gap-3 group ${
                      image.isProcessing ? 'ring-1 ring-teal-500/50' : ''
                    } ${image.error ? 'ring-1 ring-red-500/50' : ''}`}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-slate-700">
                      <img 
                        src={image.preview} 
                        alt={`Page ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {image.isProcessing && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 size={16} className="text-teal-400 animate-spin" />
                        </div>
                      )}
                      {image.extractedContent && !image.isProcessing && (
                        <div className="absolute inset-0 bg-teal-500/20 flex items-center justify-center">
                          <Check size={16} className="text-teal-400" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">第 {index + 1} 页</p>
                      <p className="text-[10px] text-slate-500 truncate">{image.file.name}</p>
                      {image.error && (
                        <p className="text-[10px] text-red-400">{image.error}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Move buttons */}
                      <button
                        onClick={() => moveImage(image.id, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-30"
                        title="上移"
                      >
                        <ArrowUpDown size={12} className="rotate-180" />
                      </button>
                      
                      {/* Reprocess */}
                      {image.extractedContent && !image.isProcessing && (
                        <button
                          onClick={() => reprocessImage(image.id)}
                          className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-teal-400"
                          title="重新识别"
                        >
                          <RefreshCw size={12} />
                        </button>
                      )}
                      
                      {/* Remove */}
                      <button
                        onClick={() => removeImage(image.id)}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"
                        title="删除"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Process Button */}
          {images.length > 0 && (
            <button
              onClick={processAllImages}
              disabled={isProcessingAll || !settings.apiKey}
              className="w-full py-3 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 disabled:shadow-none"
            >
              {isProcessingAll ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>正在识别... ({processedCount}/{images.length})</span>
                </>
              ) : (
                <>
                  <ScanText size={18} />
                  <span>开始识别 ({images.length} 页)</span>
                </>
              )}
            </button>
          )}

          {/* Preview/Edit Toggle */}
          {mergedContent && (
            <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
              <button
                onClick={() => setShowPreview(false)}
                className={`flex-1 py-1.5 text-xs rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                  !showPreview 
                    ? 'bg-teal-600 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Edit3 size={12} />
                源码
              </button>
              <button
                onClick={() => setShowPreview(true)}
                className={`flex-1 py-1.5 text-xs rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                  showPreview 
                    ? 'bg-teal-600 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Eye size={12} />
                预览
              </button>
            </div>
          )}

          {/* Content Display */}
          {mergedContent && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <FileText size={12} />
                  识别结果
                </span>
                <span className="text-[10px] text-slate-500">
                  {mergedContent.length} 字符
                </span>
              </div>
              
              <div className="p-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                {showPreview ? (
                  <div className="markdown-body-dark text-xs prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {mergedContent}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <textarea
                    value={mergedContent}
                    onChange={(e) => setMergedContent(e.target.value)}
                    className="w-full min-h-[300px] bg-transparent text-xs text-slate-300 font-mono resize-none outline-none"
                    placeholder="识别结果将显示在这里..."
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Export Footer */}
        {mergedContent && (
          <div className="flex-shrink-0 px-4 py-3 bg-slate-800/50 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportWord}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <FileDown size={14} />
                导出 Word
              </button>
              <button
                onClick={handleExportMarkdown}
                className="py-2.5 px-3 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-1.5"
                title="导出 Markdown"
              >
                <Download size={14} />
                MD
              </button>
              <button
                onClick={handleCopy}
                className="py-2.5 px-3 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-1.5"
                title="复制到剪贴板"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 text-center mt-2">
              导出后可在 Word 中进一步编辑格式
            </p>
          </div>
        )}
      </div>
    </>
  );
};

