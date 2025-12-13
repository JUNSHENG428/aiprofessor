
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from './components/Button';
import { LecturePanel } from './components/LecturePanel';
import { SettingsModal } from './components/SettingsModal';
import { PdfViewer } from './components/PdfViewer';
import { InlineNotesPanel } from './components/InlineNotesPanel';
import { InlineFilesPanel } from './components/InlineFilesPanel';
import { InlineExamPanel } from './components/InlineExamPanel';
import { ExamToDocPanel } from './components/ExamToDocPanel';
import { NotesOrganizerPage } from './components/NotesOrganizerPage';
import { FlashcardsPanel } from './components/FlashcardsPanel';
import { MindMapPanel } from './components/MindMapPanel';
import { KnowledgeBasePanel } from './components/KnowledgeBasePanel';
import { FormulaExplainerPanel } from './components/FormulaExplainerPanel';
import { ToastContainer } from './components/Toast';
import { parsePDF } from './services/pdfService';
import { generateStream, stopGeneration } from './services/aiService';
import { useOcrFlow } from './hooks/useOcrFlow';
import { 
  saveSession, 
  saveFileRecord, 
  getAutoSave, 
  autoSave, 
  clearAutoSave,
  getStorageStats,
  getAugmentedContext,
  getKnowledgeStats
} from './services/storageService';
import { ParsedPage, LectureState, Message, LectureMode, AppSettings, DEFAULT_SETTINGS, FileRecord, Session, Note, TeachingStyle } from './types';
import { PROMPTS, TEACHING_STYLES } from './constants';
import { BookOpen, Settings, Upload, FileText, ChevronLeft, ChevronRight, Download, Send, GraduationCap, ClipboardCheck, X, GripVertical, FolderOpen, StickyNote, Save, PanelRightOpen, PanelRightClose, Square, ImagePlus, Clipboard, Trash2, Cloud, CloudOff, RefreshCw, Sparkles, MessageCircle, NotebookPen, ScanText, Layers, GitBranch, Database, Calculator, MoreHorizontal } from 'lucide-react';

// Page types
type PageType = 'lecture' | 'notes-organizer';

const App: React.FC = () => {
  // --- State ---
  // Page navigation
  const [currentPage, setCurrentPage] = useState<PageType>('lecture');
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('ai_professor_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // Lecture Data
  const [lectureState, setLectureState] = useState<LectureState>({
    file: null,
    parsedPages: [],
    currentBatch: [1, 1], // Start with just page 1, will update on load
    totalPages: 0,
    isParsing: false,
    parsingError: null,
  });

  // UI State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [showPdf, setShowPdf] = useState(true);
  
  // Mock Exam Panel State
  const [showMockExam, setShowMockExam] = useState(false);
  const [examQuestions, setExamQuestions] = useState('');
  const [isGeneratingExam, setIsGeneratingExam] = useState(false);
  const [gradingResult, setGradingResult] = useState('');
  const [isGrading, setIsGrading] = useState(false);
  
  // New Panel States
  const [showNotes, setShowNotes] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showExamToDoc, setShowExamToDoc] = useState(false);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  
  // 新功能面板状态
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showMindMap, setShowMindMap] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  
  // Image upload state for chat
  const [chatImages, setChatImages] = useState<string[]>([]);
  const [lastPdfRegion, setLastPdfRegion] = useState<{
    pageNumber: number;
    imageDataUrl: string;
  } | null>(null);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showHeaderMoreMenu, setShowHeaderMoreMenu] = useState(false);
  const [lastPromptData, setLastPromptData] = useState<{
    type: 'lecture' | 'chat';
    prompt: string;
    images: string[];
    start?: number;
    end?: number;
  } | null>(null);

  // 获取当前讲解内容（用于生成闪卡/思维导图/知识库）
  const getCurrentLectureContent = (): string => {
    const modelMessages = messages.filter(m => m.role === 'model');
    if (modelMessages.length === 0) return '';
    // 获取最近的讲解内容
    return modelMessages.slice(-3).map(m => m.content).join('\n\n');
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const headerMoreMenuRef = useRef<HTMLDivElement>(null);
  const headerMoreButtonRef = useRef<HTMLButtonElement>(null);

  // Implementation of independent PDF navigation
  const [viewPage, setViewPage] = useState<number>(1);
  
  // 拖拽上传状态
  const [isDragging, setIsDragging] = useState(false);

  // Resizable panel state
  const [pdfPanelWidth, setPdfPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('ai_professor_pdf_width');
    return saved ? parseInt(saved) : 42; // Default 42%
  });
  const [isResizing, setIsResizing] = useState(false);

  // Save panel width to localStorage
  useEffect(() => {
    localStorage.setItem('ai_professor_pdf_width', pdfPanelWidth.toString());
  }, [pdfPanelWidth]);

  // Handle resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;
    
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Limit between 20% and 70%
    setPdfPanelWidth(Math.min(70, Math.max(20, newWidth)));
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add/remove mouse event listeners for resizing
  useEffect(() => {
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
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('ai_professor_settings', JSON.stringify(settings));
    // Check if API key is missing on initial load
    if (!settings.apiKey) {
      setShowSettings(true);
    }
  }, [settings]);

  // Close header popover on outside click / ESC
  useEffect(() => {
    if (!showHeaderMoreMenu) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowHeaderMoreMenu(false);
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (headerMoreMenuRef.current?.contains(target)) return;
      if (headerMoreButtonRef.current?.contains(target)) return;
      setShowHeaderMoreMenu(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [showHeaderMoreMenu]);

  // Theme control: apply based on settings
  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    if (settings.theme === 'system') {
      // Follow system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);
      
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      // Manual theme setting
      applyTheme(settings.theme === 'dark');
    }
  }, [settings.theme]);
  
  useEffect(() => {
    if (lectureState.currentBatch[0] > 0) {
        setViewPage(lectureState.currentBatch[0]);
    }
  }, [lectureState.currentBatch]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在输入，不触发快捷键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Ctrl/Cmd + 方向键：切换批次
      if ((e.ctrlKey || e.metaKey) && !isGenerating) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrevBatch();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNextBatch();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleStartLecture();
        }
      }
      
      // 方向键：翻页
      if (!e.ctrlKey && !e.metaKey && lectureState.totalPages > 0) {
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          setViewPage(p => Math.max(1, p - 1));
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          setViewPage(p => Math.min(lectureState.totalPages, p + 1));
        }
      }
      
      // Escape：关闭面板
      if (e.key === 'Escape') {
        setShowMockExam(false);
        setShowNotes(false);
        setShowExamToDoc(false);
        setShowStylePicker(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGenerating, lectureState.totalPages]);

  // 拖拽上传处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        processFile(file);
      }
    }
  }, []);

  // --- Handlers ---

  const handleSettingsSave = (newSettings: AppSettings) => {
    setSettings(newSettings);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setLectureState(prev => ({ ...prev, parsingError: 'Please upload a valid PDF file.' }));
      return;
    }

    // Save current session before switching files
    if (currentFileId && messages.length > 0) {
      saveCurrentSessionAsync();
    }

    setLectureState(prev => ({ 
      ...prev, 
      file, 
      isParsing: true, 
      parsingError: null,
      parsedPages: [], 
      totalPages: 0
    }));

    setMessages([]); 

    try {
      const parsedPages = await parsePDF(file);
      const initialBatchSize = settings.batchSize;
      
      // Generate file ID and save file record
      const fileId = Date.now().toString();
      setCurrentFileId(fileId);
      
      const fileRecord: FileRecord = {
        id: fileId,
        name: file.name,
        size: file.size,
        uploadedAt: Date.now(),
        pageCount: parsedPages.length
      };
      
      // Save file record using storage service
      saveFileRecord(fileRecord);
      
      setLectureState(prev => ({
        ...prev,
        parsedPages,
        totalPages: parsedPages.length,
        currentBatch: [1, Math.min(initialBatchSize, parsedPages.length)],
        isParsing: false
      }));

      // 不再自动讲解，用户需要点击 "Start Lecture" 按钮

    } catch (err) {
      setLectureState(prev => ({
        ...prev,
        isParsing: false,
        parsingError: 'Failed to parse PDF. Please try a simpler file.'
      }));
    }
  };

  // Save current session using storage service
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const saveCurrentSessionAsync = async () => {
    if (!currentFileId || messages.length === 0) return;
    
    setIsSaving(true);
    
    const session: Session = {
      id: Date.now().toString(),
      fileId: currentFileId,
      fileName: lectureState.file?.name || 'Restored Session',
      messages: messages,
      parsedPages: lectureState.parsedPages,
      currentBatch: lectureState.currentBatch,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const success = await saveSession(session);
    
    setIsSaving(false);
    if (success) {
      setLastSaved(new Date());
      // Clear auto-save after successful manual save
      clearAutoSave();
    }
  };

  // Auto-save effect - save every 30 seconds when there are changes
  useEffect(() => {
    if (!currentFileId || messages.length === 0) return;
    
    const timer = setInterval(() => {
      autoSave({
        fileId: currentFileId,
        fileName: lectureState.file?.name || 'Unknown',
        messages,
        parsedPages: lectureState.parsedPages,
        currentBatch: lectureState.currentBatch
      });
    }, 30000); // 30 seconds
    
    return () => clearInterval(timer);
  }, [currentFileId, messages, lectureState]);

  // Check for auto-saved data on mount
  useEffect(() => {
    const autoSaved = getAutoSave();
    if (autoSaved && !lectureState.file) {
      const restore = window.confirm(
        `Found unsaved session from ${new Date(autoSaved.savedAt).toLocaleString()}. Restore it?`
      );
      if (restore) {
        setCurrentFileId(autoSaved.fileId);
        setMessages(autoSaved.messages || []);
        setLectureState(prev => ({
          ...prev,
          parsedPages: autoSaved.parsedPages || [],
          totalPages: autoSaved.parsedPages?.length || 0,
          currentBatch: autoSaved.currentBatch || [1, 3]
        }));
        clearAutoSave();
      } else {
        clearAutoSave();
      }
    }
  }, []);

  // Handle file selection from FilesPanel - 恢复完整会话状态
  const handleSelectFile = (fileRecord: FileRecord, session?: Session) => {
    // 保存当前会话（如果有）
    if (currentFileId && messages.length > 0) {
      saveCurrentSessionAsync();
    }
    
    if (session && session.parsedPages && session.parsedPages.length > 0) {
      // 有保存的解析数据，完整恢复会话
      setCurrentFileId(session.fileId);
      setMessages(session.messages || []);
      
      // 恢复 lectureState（但没有原始 File 对象）
      setLectureState(prev => ({
        ...prev,
        file: null, // 无法恢复原始 File 对象
        parsedPages: session.parsedPages,
        totalPages: session.parsedPages.length,
        currentBatch: session.currentBatch || [1, Math.min(settings.batchSize, session.parsedPages.length)],
        isParsing: false,
        parsingError: null
      }));
      
      // 设置 PDF 查看页面
      setViewPage(session.currentBatch?.[0] || 1);
      
      // 会话已恢复，包含页面预览图片，无需重新上传 PDF
    } else if (session) {
      // 只有对话记录，没有解析数据
      setCurrentFileId(session.fileId);
      setMessages(session.messages || []);
      
      // 清空解析数据，保留对话
      setLectureState(prev => ({
        ...prev,
        file: null,
        parsedPages: [],
        totalPages: 0,
        currentBatch: [1, 1],
        isParsing: false,
        parsingError: null
      }));
    } else {
      // 只有文件记录，没有会话 - 设置文件ID准备重新上传
      setCurrentFileId(fileRecord.id);
      setMessages([]);
      setLectureState(prev => ({
        ...prev,
        file: null,
        parsedPages: [],
        totalPages: 0,
        currentBatch: [1, 1],
        isParsing: false,
        parsingError: null
      }));
      // 自动打开文件选择对话框
      fileInputRef.current?.click();
    }
  };

  const getBatchContent = (start: number, end: number, pages: ParsedPage[]) => {
    return pages
      .filter(p => p.pageNumber >= start && p.pageNumber <= end)
      .map(p => `[Page ${p.pageNumber}]: ${p.text}`)
      .join('\n\n');
  };

  const getBatchImages = (start: number, end: number, pages: ParsedPage[]) => {
    return pages
      .filter(p => p.pageNumber >= start && p.pageNumber <= end && p.image)
      .map(p => p.image as string);
  };

  // Build conversation context for multi-turn dialogue
  const buildConversationContext = (currentQuery?: string, pageContent?: string) => {
    let fullContext = '';
    
    // 1. 从知识库检索相关知识（RAG 增强）
    const knowledgeContext = getAugmentedContext(
      currentQuery || '', 
      pageContent || getBatchContent(
        lectureState.currentBatch[0], 
        lectureState.currentBatch[1], 
        lectureState.parsedPages
      ).substring(0, 500)
    );
    
    if (knowledgeContext) {
      fullContext += knowledgeContext;
    }
    
    // 2. 对话上下文
    if (settings.enableContext && messages.length > 0) {
      const recentMessages = messages.slice(-(settings.contextTurns * 2));
      if (recentMessages.length > 0) {
        const conversationContext = recentMessages.map(m => {
          const role = m.role === 'user' ? 'Student' : 'Professor';
          const content = m.content.length > 500 ? m.content.substring(0, 500) + '...' : m.content;
          return `${role}: ${content}`;
        }).join('\n\n');
        
        fullContext += `\n\n**Previous Conversation Context (for reference):**\n"""\n${conversationContext}\n"""\n\nNow continue the lecture naturally, building on what was discussed before.\n`;
      }
    }
    
    return fullContext;
  };
  
  // 获取知识库统计（用于显示学习进度）
  const knowledgeStats = getKnowledgeStats();

  const triggerBatchExplanation = async (start: number, end: number, pages = lectureState.parsedPages) => {
    if (!settings.apiKey && settings.provider !== 'ollama') {
      setShowSettings(true);
      return;
    }

    const content = getBatchContent(start, end, pages);
    const images = getBatchImages(start, end, pages);
    
    // Build prompt with teaching style modifier
    const styleModifier = TEACHING_STYLES[settings.teachingStyle]?.modifier || '';
    // 使用知识库增强的上下文
    const contextAddition = buildConversationContext('lecture explanation', content);
    
    let prompt = PROMPTS.EXPLAIN_BATCH(content, start, end);
    prompt = `**Teaching Style**: ${styleModifier}\n${contextAddition}\n\n${prompt}`;
    
    // 用户自定义 prompt 放在最后，优先级最高
    if (settings.customPrompt && settings.customPrompt.trim()) {
      prompt = `${prompt}\n\n---\n\n## ⚠️ 重要：用户自定义要求（必须优先遵循）\n\n${settings.customPrompt.trim()}\n\n请务必按照上述用户要求调整你的输出格式和内容。`;
    }
    
    // Save for regeneration
    setLastPromptData({ type: 'lecture', prompt, images, start, end });
    
    setIsGenerating(true);
    setMessages(prev => [...prev, { role: 'model', content: '', timestamp: Date.now() }]);

    let fullResponse = '';
    await generateStream(settings, prompt, images, (chunk) => {
      fullResponse += chunk;
      setMessages(prev => {
        const newArr = [...prev];
        newArr[newArr.length - 1] = { ...newArr[newArr.length - 1], content: fullResponse };
        return newArr;
      });
    });

    setIsGenerating(false);
  };

  const handleNextBatch = () => {
    const [_, currentEnd] = lectureState.currentBatch;
    if (currentEnd >= lectureState.totalPages) return;

    const nextStart = currentEnd + 1;
    const nextEnd = Math.min(nextStart + settings.batchSize - 1, lectureState.totalPages);
    
    setLectureState(prev => ({ ...prev, currentBatch: [nextStart, nextEnd] }));
    // 同步更新 PDF 查看器页面
    setViewPage(nextStart);
    // 不再自动讲解，用户需要点击 "Start Lecture" 按钮
  };

  const handlePrevBatch = () => {
    const [currentStart] = lectureState.currentBatch;
    if (currentStart <= 1) return;

    const prevEnd = currentStart - 1;
    const prevStart = Math.max(1, prevEnd - settings.batchSize + 1);
    
    setLectureState(prev => ({ ...prev, currentBatch: [prevStart, prevEnd] }));
    // 同步更新 PDF 查看器页面
    setViewPage(prevStart);
    // 不再自动讲解，用户需要点击 "Start Lecture" 按钮
  };

  // 手动开始讲解当前批次
  const handleStartLecture = () => {
    if (isGenerating) return;
    const [start, end] = lectureState.currentBatch;
    triggerBatchExplanation(start, end);
  };

  // 停止生成
  const handleStopGeneration = () => {
    stopGeneration();
    setIsGenerating(false);
    setIsGeneratingExam(false);
    // 在当前消息后添加停止标记
    setMessages(prev => {
      if (prev.length > 0) {
        const newArr = [...prev];
        const lastMsg = newArr[newArr.length - 1];
        if (lastMsg.role === 'model' && lastMsg.content) {
          newArr[newArr.length - 1] = { 
            ...lastMsg, 
            content: lastMsg.content + '\n\n*[⏹ 回答已停止]*' 
          };
        }
        return newArr;
      }
      return prev;
    });
  };

  // Handle image upload from file
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setChatImages(prev => [...prev, base64]);
        };
        reader.readAsDataURL(file);
      }
    });
    
    // Reset input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // Handle paste for screenshots
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setChatImages(prev => [...prev, base64]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // Remove uploaded image
  const removeImage = (index: number) => {
    setChatImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if ((!userInput.trim() && chatImages.length === 0) || isGenerating) return;
    if (!settings.apiKey && settings.provider !== 'ollama') { setShowSettings(true); return; }

    const currentText = userInput;
    const currentImages = [...chatImages];
    setUserInput('');
    setChatImages([]);
    
    // Build user message with image indicator
    const userMessage = currentImages.length > 0 
      ? `${currentText}\n\n📷 [${currentImages.length} image(s) attached]`
      : currentText;
    setMessages(prev => [...prev, { role: 'user', content: userMessage, images: currentImages, timestamp: Date.now() }]);
    
    setIsGenerating(true);

    const [start, end] = lectureState.currentBatch;
    const batchContent = getBatchContent(start, end, lectureState.parsedPages);
    // Combine slide images with user uploaded images
    const slideImages = getBatchImages(start, end, lectureState.parsedPages);
    const allImages = [...currentImages, ...slideImages];

    // Build multi-turn conversation context with knowledge augmentation
    const conversationContext = buildConversationContext(currentText, batchContent);
    const styleModifier = TEACHING_STYLES[settings.teachingStyle]?.modifier || '';
    
    // 用户自定义 prompt 放在最后，优先级最高
    const customPromptSection = settings.customPrompt && settings.customPrompt.trim() 
      ? `\n\n---\n⚠️ **用户自定义要求（必须优先遵循）**:\n${settings.customPrompt.trim()}\n请务必按照上述用户要求调整你的回答。`
      : '';

    const contextPrompt = currentImages.length > 0 
      ? `
      **Teaching Style**: ${styleModifier}
      ${conversationContext}
      
      Context: User is asking about Slides ${start}-${end} and has uploaded ${currentImages.length} image(s).
      Current Slides Content: """${batchContent}"""
      
      The user has attached image(s) for you to analyze. Please examine them carefully and incorporate your observations into your response.
      
      User Question: ${currentText || "Please analyze the attached image(s)."}
      ${customPromptSection}
    `
      : `
      **Teaching Style**: ${styleModifier}
      ${conversationContext}
      
      Context: User is asking about Slides ${start}-${end}.
      Current Slides Content: """${batchContent}"""
      
      User Question: ${currentText}
      ${customPromptSection}
    `;

    // Save for regeneration
    setLastPromptData({ type: 'chat', prompt: contextPrompt, images: allImages });

    setMessages(prev => [...prev, { role: 'model', content: '', timestamp: Date.now() }]);

    let fullResponse = '';
    await generateStream(settings, contextPrompt, allImages, (chunk) => {
      fullResponse += chunk;
      setMessages(prev => {
        const newArr = [...prev];
        newArr[newArr.length - 1] = { ...newArr[newArr.length - 1], content: fullResponse };
        return newArr;
      });
    });

    setIsGenerating(false);
  };

  // 框选区域：把“裁剪后的局部图”塞进聊天图片队列，让 AI 只解析框内内容
  const handlePdfRegionExtract = useCallback((payload: {
    pageNumber: number;
    rect: { x: number; y: number; width: number; height: number };
    imageDataUrl: string;
    pageText?: string;
  }) => {
    setLastPdfRegion({ pageNumber: payload.pageNumber, imageDataUrl: payload.imageDataUrl });
    setChatImages(prev => [...prev, payload.imageDataUrl]);

    // 只做“提示+预填”，不自动发送，避免打断用户
    setUserInput(prev => {
      const hint =
        `请只分析我框选的区域（来自第 ${payload.pageNumber} 页）：\n` +
        `1) 如果是公式：给出准确 LaTeX（用 $...$ 或 $$...$$），并解释变量含义。\n` +
        `2) 如果是表格：输出规范的 Markdown 表格并总结关键结论。\n` +
        `3) 如果是图表：说明坐标轴/图例/趋势/结论。\n` +
        `4) 最后给我“考试/复习重点”要点。\n`;
      return prev.trim() ? `${prev}\n\n${hint}` : hint;
    });
  }, []);

  // --- Hooks ---
  const { isOcrRunning, ocrProgressText, performOcr, resetOcrState } = useOcrFlow({
    settings,
    currentFileId,
    currentFileName: lectureState.file?.name,
    onInputUpdate: setUserInput
  });

  // 一键 OCR：框选后点击，把结构化结果插入聊天，并自动写入公式库/知识库
  const handleOneClickOcr = useCallback(async () => {
    if (!lastPdfRegion) return;
    if (isOcrRunning || isGenerating) return;
    
    const result = await performOcr(lastPdfRegion);
    if (!result.success && result.error === 'missing_api_key') {
      setShowSettings(true);
    }
  }, [lastPdfRegion, isOcrRunning, isGenerating, performOcr]);
  
  // Regenerate the last response
  const handleRegenerate = async () => {
    if (!lastPromptData || isGenerating) return;
    if (!settings.apiKey && settings.provider !== 'ollama') { setShowSettings(true); return; }
    
    // Remove the last AI response
    setMessages(prev => {
      const newArr = [...prev];
      if (newArr.length > 0 && newArr[newArr.length - 1].role === 'model') {
        newArr.pop();
      }
      return newArr;
    });
    
    setIsGenerating(true);
    setMessages(prev => [...prev, { role: 'model', content: '', timestamp: Date.now() }]);
    
    // Regenerate with slightly modified prompt for variety
    const regeneratePrompt = `${lastPromptData.prompt}\n\n[Note: Please provide a fresh perspective or alternative explanation.]`;
    
    let fullResponse = '';
    await generateStream(settings, regeneratePrompt, lastPromptData.images, (chunk) => {
      fullResponse += chunk;
      setMessages(prev => {
        const newArr = [...prev];
        newArr[newArr.length - 1] = { ...newArr[newArr.length - 1], content: fullResponse };
        return newArr;
      });
    });
    
    setIsGenerating(false);
  };
  
  // Change teaching style
  const handleStyleChange = (style: TeachingStyle) => {
    setSettings(prev => ({ ...prev, teachingStyle: style }));
    setShowStylePicker(false);
  };

  const handleToolAction = async (action: LectureMode) => {
     if (isGenerating) return;
     if (!settings.apiKey) { setShowSettings(true); return; }

     // Handle Mock Exam Start - 只打开面板，不自动生成问题
     if (action === LectureMode.MOCK_EXAM) {
        setShowMockExam(true);
        // 不再自动生成问题，用户需要点击"Generate"按钮
        return;
     }

     // Handle Summary
     if (action === LectureMode.SUMMARY) {
       const fullText = lectureState.parsedPages.map(p => p.text).join('\n\n');
       const prompt = PROMPTS.SUMMARIZE_DOCUMENT(fullText);
       
       setMessages(prev => [...prev, { role: 'user', content: `Please summarize the document.` }]);
       setIsGenerating(true);
       setMessages(prev => [...prev, { role: 'model', content: '' }]);

       let fullResponse = '';
       await generateStream(settings, prompt, [], (chunk) => {
         fullResponse += chunk;
         setMessages(prev => {
           const newArr = [...prev];
           newArr[newArr.length - 1] = { ...newArr[newArr.length - 1], content: fullResponse };
           return newArr;
         });
       });
       setIsGenerating(false);
     }
  };

  // Generate exam questions
  const generateExamQuestions = async () => {
    if (!settings.apiKey) { setShowSettings(true); return; }
    
    setExamQuestions('');
    setGradingResult('');
    setIsGeneratingExam(true);

    const [start, end] = lectureState.currentBatch;
    const content = getBatchContent(start, end, lectureState.parsedPages);
    const images = getBatchImages(start, end, lectureState.parsedPages);
    
    const lectureContext = messages
      .filter(m => m.role === 'model')
      .map(m => m.content)
      .join('\n\n')
      .substring(0, 2000);
    
    const prompt = PROMPTS.GENERATE_EXAM_QUESTIONS(content, lectureContext);
    
    let questions = '';
    await generateStream(settings, prompt, images, (chunk) => {
      questions += chunk;
      setExamQuestions(questions);
    });
    
    setIsGeneratingExam(false);
  };

  // Submit exam for grading
  const submitExamGrading = async (studentAnswers: string) => {
    if (!studentAnswers.trim()) return;
    
    setIsGrading(true);
    setGradingResult('');
    
    const [start, end] = lectureState.currentBatch;
    const content = getBatchContent(start, end, lectureState.parsedPages);
    const images = getBatchImages(start, end, lectureState.parsedPages);
    const prompt = PROMPTS.GRADE_EXAM(content, examQuestions, studentAnswers);

    let result = '';
    await generateStream(settings, prompt, images, (chunk) => {
      result += chunk;
      setGradingResult(result);
    });

    setIsGrading(false);
  };

  const handleTranslate = async (index: number, content: string) => {
      if (isGenerating) return;
      if (!settings.apiKey) { setShowSettings(true); return; }

      // Check if already has translation
      if (messages[index]?.content.includes("🇨🇳 中文翻译")) return;

      // 保存原始内容（不包含翻译）- 移除任何已存在的翻译占位符
      const originalContent = messages[index].content
        .replace(/\n\n---\n\*\*⏳ 翻译中\.\.\.\*\*/g, '')
        .replace(/\n\n---\n\*\*❌ 翻译失败\*\*/g, '');

      // Add placeholder
      setMessages(prev => {
        const newArr = [...prev];
        newArr[index] = { ...newArr[index], content: originalContent + "\n\n---\n**⏳ 翻译中...**" };
        return newArr;
      });

      setIsGenerating(true);
      const prompt = PROMPTS.TRANSLATE(content);
      
      const translationHeader = "\n\n---\n\n## 🇨🇳 中文翻译\n\n";
      let fullTranslation = "";

      try {
        // 翻译时跳过系统提示词，避免 "Always respond in English" 冲突
        await generateStream(settings, prompt, [], (chunk) => {
            fullTranslation += chunk;
            
            // 清理翻译结果：移除可能的前言
            let cleanedTranslation = fullTranslation
              .replace(/^(以下是|翻译如下|翻译结果|Translation|Here is|Here's)[：:\s]*/i, '')
              .replace(/^\[CRITICAL OVERRIDE.*?\n/g, '')
              .replace(/^---\s*\n/, '')
              .replace(/^=== START TRANSLATION NOW ===\s*\n/g, '')
              .trim();
            
            // 每次都用原始内容 + 翻译头 + 完整翻译内容
            setMessages(prev => {
                const newArr = [...prev];
                newArr[index] = { 
                  ...newArr[index], 
                  content: originalContent + translationHeader + cleanedTranslation 
                };
                return newArr;
            });
        }, { skipSystemPrompt: true });
      } catch (err) {
        console.error("Translation error:", err);
        // 如果出错，恢复原始内容并显示错误
        setMessages(prev => {
          const newArr = [...prev];
          newArr[index] = { ...newArr[index], content: originalContent + "\n\n---\n**❌ 翻译失败，请重试**" };
          return newArr;
        });
      }
      
      setIsGenerating(false);
  };

  const handleExport = () => {
    const content = messages.map(m => `**${m.role.toUpperCase()}**: ${m.content}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lecture_notes.md';
    a.click();
  };

  // 收藏消息
  const handleSaveMessage = (index: number) => {
    setMessages(prev => {
      const newArr = [...prev];
      if (newArr[index]) {
        newArr[index] = { 
          ...newArr[index], 
          isSaved: !newArr[index].isSaved 
        };
      }
      return newArr;
    });
  };

  // --- Render ---
  
  // Render Notes Organizer Page
  if (currentPage === 'notes-organizer') {
    return (
      <ToastContainer>
        <NotesOrganizerPage 
          settings={settings}
          onBack={() => setCurrentPage('lecture')}
        />
      </ToastContainer>
    );
  }

  const ProPillButton = (props: {
    icon: React.ReactNode;
    label: string;
    title?: string;
    active?: boolean;
    onClick?: () => void;
    badgeText?: string;
    forceLabel?: boolean;
    className?: string;
  }) => {
    const { icon, label, title, active, onClick, badgeText, forceLabel, className } = props;
    return (
      <button
        type="button"
        title={title ?? label}
        onClick={onClick}
        className={[
          // shape + layout
          'relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
          // typography
          'text-xs font-medium tracking-tight',
          // surface
          'bg-white/40 dark:bg-white/5 backdrop-blur-md',
          'border border-gray-200/70 dark:border-white/10',
          // transitions
          'transition-all duration-200',
          // hover (统一发光强度)
          'hover:bg-white/60 dark:hover:bg-white/8',
          'hover:border-gray-300/70 dark:hover:border-white/15',
          'hover:shadow-[0_8px_24px_rgba(99,102,241,0.14)] dark:hover:shadow-[0_10px_30px_rgba(99,102,241,0.18)]',
          // active (统一发光强度，略强于 hover)
          active
            ? 'text-gray-900 dark:text-white shadow-[0_10px_30px_rgba(99,102,241,0.22)] dark:shadow-[0_12px_40px_rgba(99,102,241,0.24)] bg-white/70 dark:bg-white/10 border-gray-300/70 dark:border-white/20'
            : 'text-gray-700 dark:text-slate-200/85',
          className ?? '',
        ].join(' ')}
      >
        <span className={active ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-600 dark:text-slate-300'}>
          {icon}
        </span>
        <span className={forceLabel ? 'inline' : 'hidden sm:inline'}>{label}</span>
        {badgeText && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] leading-none bg-indigo-600/10 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-200 border border-indigo-500/10 dark:border-indigo-400/20">
            {badgeText}
          </span>
        )}
      </button>
    );
  };

  const BrandMark = ({ className }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M32 4C16.536 4 4 16.536 4 32s12.536 28 28 28 28-12.536 28-28S47.464 4 32 4Z"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="2"
      />
      <defs>
        <linearGradient id="brand_g" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="0.55" stopColor="#A855F7" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <path
        d="M32 12c11.046 0 20 8.954 20 20s-8.954 20-20 20-20-8.954-20-20 8.954-20 20-20Z"
        fill="url(#brand_g)"
        fillOpacity="0.95"
      />
      <path
        d="M32 21.5l9.5 21h-4.2l-2.1-4.9H28.8l-2.1 4.9h-4.2l9.5-21Zm1.7 12.7-2.8-6.7-2.8 6.7h5.6Z"
        fill="white"
        fillOpacity="0.96"
      />
      <path
        d="M20 24c3-5 8-8 14-8"
        stroke="white"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
  
  // Main Lecture Page
  return (
    <ToastContainer>
    <div className="flex flex-col h-screen bg-transparent text-gray-900 dark:text-slate-100 font-sans overflow-hidden apple-bg">
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        currentSettings={settings}
        onSave={handleSettingsSave}
      />

      {/* Header */}
      <header className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border-b border-gray-200/60 dark:border-white/10 px-6 py-3 flex items-center justify-between shadow-sm dark:shadow-black/30 z-20">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-2xl text-white shadow-sm shadow-indigo-500/20 bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 backdrop-blur-md">
            <BrandMark className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 leading-none">AI Professor</h1>
            <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">Pro • Deep Dark</span>
          </div>
        </div>

        <div className="relative flex items-center justify-end">
          {/* Desktop / Wide: keep inline (no wrap, header height stable) */}
          <div className="hidden lg:flex items-center gap-2 flex-nowrap">
            <ProPillButton
              icon={<NotebookPen size={16} />}
              label="笔记"
              title="整理笔记助手"
              onClick={() => setCurrentPage('notes-organizer')}
            />

            <ProPillButton
              icon={<ScanText size={16} />}
              label="OCR"
              title="试卷转文档"
              onClick={() => setShowExamToDoc(!showExamToDoc)}
              active={showExamToDoc}
            />

            <ProPillButton
              icon={<Layers size={16} />}
              label="闪卡"
              title="智能闪卡"
              onClick={() => { setShowFlashcards(!showFlashcards); setShowMindMap(false); setShowKnowledge(false); setShowFormula(false); }}
              active={showFlashcards}
            />

            <ProPillButton
              icon={<GitBranch size={16} />}
              label="导图"
              title="思维导图"
              onClick={() => { setShowMindMap(!showMindMap); setShowFlashcards(false); setShowKnowledge(false); setShowFormula(false); }}
              active={showMindMap}
            />

            <ProPillButton
              icon={<Database size={16} />}
              label="知识"
              title={`知识库 (${knowledgeStats.totalConcepts} 概念, ${knowledgeStats.totalFormulas} 公式) - AI 会调用已学知识优化回答`}
              badgeText={(knowledgeStats.totalConcepts + knowledgeStats.totalFormulas) > 0 ? `${knowledgeStats.totalConcepts + knowledgeStats.totalFormulas}` : undefined}
              onClick={() => { setShowKnowledge(!showKnowledge); setShowFlashcards(false); setShowMindMap(false); setShowFormula(false); }}
              active={showKnowledge}
            />

            <ProPillButton
              icon={<Calculator size={16} />}
              label="公式"
              title="公式讲解"
              onClick={() => { setShowFormula(!showFormula); setShowFlashcards(false); setShowMindMap(false); setShowKnowledge(false); }}
              active={showFormula}
            />

            <div className="h-6 w-px bg-gray-200/70 dark:bg-white/10 mx-1 hidden xl:block" />

            <ProPillButton
              icon={<FolderOpen size={16} />}
              label="文件"
              title={showFiles ? "Hide Files" : "Show Files"}
              onClick={() => setShowFiles(!showFiles)}
              active={showFiles}
            />

            <ProPillButton
              icon={showNotes ? <PanelRightClose size={16} /> : <StickyNote size={16} />}
              label="笔记条"
              title={showNotes ? "Hide Notes" : "Show Notes"}
              onClick={() => setShowNotes(!showNotes)}
              active={showNotes}
            />

            {messages.length > 0 && (
              <ProPillButton
                icon={isSaving ? <RefreshCw size={16} className="animate-spin" /> : (lastSaved ? <Cloud size={16} /> : <Save size={16} />)}
                label="保存"
                title={lastSaved ? `Last saved: ${lastSaved.toLocaleTimeString()}` : "Save Session"}
                onClick={saveCurrentSessionAsync}
                active={!!lastSaved}
              />
            )}

            <ProPillButton
              icon={<Settings size={16} />}
              label="设置"
              title="Settings"
              onClick={() => setShowSettings(true)}
            />

            <ProPillButton
              icon={<Upload size={16} />}
              label={lectureState.file ? '换PDF' : (lectureState.parsedPages.length > 0 ? '重传' : '上传')}
              title="Upload PDF"
              onClick={() => fileInputRef.current?.click()}
            />
            <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleFileChange} />

            {(lectureState.file || lectureState.parsedPages.length > 0) && (
              <>
                <ProPillButton
                  icon={<Download size={16} />}
                  label="导出"
                  title="Export Notes"
                  onClick={handleExport}
                />
                <div className="hidden xl:block">
                  <ProPillButton
                    icon={<FileText size={16} />}
                    label={showPdf ? "PDF开" : "PDF关"}
                    title="Toggle PDF View"
                    onClick={() => setShowPdf(!showPdf)}
                    active={showPdf}
                  />
                </div>
              </>
            )}
          </div>

          {/* Mobile / Narrow: collapse into … popover */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              ref={headerMoreButtonRef}
              type="button"
              onClick={() => setShowHeaderMoreMenu(v => !v)}
              className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium tracking-tight bg-white/40 dark:bg-white/5 backdrop-blur-md border border-gray-200/70 dark:border-white/10 transition-all duration-200 hover:bg-white/60 dark:hover:bg-white/8 hover:border-gray-300/70 dark:hover:border-white/15 hover:shadow-[0_10px_30px_rgba(99,102,241,0.18)] text-gray-700 dark:text-slate-200/90"
              title="更多"
            >
              <MoreHorizontal size={16} className="text-gray-600 dark:text-slate-300" />
              <span>更多</span>
            </button>

            {showHeaderMoreMenu && (
              <div
                ref={headerMoreMenuRef}
                className="absolute right-0 top-full mt-2 w-[min(92vw,520px)] bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-gray-200/70 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-3 grid grid-cols-2 gap-2">
                  <ProPillButton
                    icon={<NotebookPen size={16} />}
                    label="笔记整理"
                    forceLabel
                    onClick={() => { setShowHeaderMoreMenu(false); setCurrentPage('notes-organizer'); }}
                  />
                  <ProPillButton
                    icon={<ScanText size={16} />}
                    label="试卷转文档"
                    forceLabel
                    active={showExamToDoc}
                    onClick={() => { setShowHeaderMoreMenu(false); setShowExamToDoc(!showExamToDoc); }}
                  />
                  <ProPillButton
                    icon={<Layers size={16} />}
                    label="智能闪卡"
                    forceLabel
                    active={showFlashcards}
                    onClick={() => { setShowHeaderMoreMenu(false); setShowFlashcards(!showFlashcards); setShowMindMap(false); setShowKnowledge(false); setShowFormula(false); }}
                  />
                  <ProPillButton
                    icon={<GitBranch size={16} />}
                    label="思维导图"
                    forceLabel
                    active={showMindMap}
                    onClick={() => { setShowHeaderMoreMenu(false); setShowMindMap(!showMindMap); setShowFlashcards(false); setShowKnowledge(false); setShowFormula(false); }}
                  />
                  <ProPillButton
                    icon={<Database size={16} />}
                    label="知识库"
                    forceLabel
                    badgeText={(knowledgeStats.totalConcepts + knowledgeStats.totalFormulas) > 0 ? `${knowledgeStats.totalConcepts + knowledgeStats.totalFormulas}` : undefined}
                    active={showKnowledge}
                    onClick={() => { setShowHeaderMoreMenu(false); setShowKnowledge(!showKnowledge); setShowFlashcards(false); setShowMindMap(false); setShowFormula(false); }}
                  />
                  <ProPillButton
                    icon={<Calculator size={16} />}
                    label="公式讲解"
                    forceLabel
                    active={showFormula}
                    onClick={() => { setShowHeaderMoreMenu(false); setShowFormula(!showFormula); setShowFlashcards(false); setShowMindMap(false); setShowKnowledge(false); }}
                  />

                  <div className="col-span-2 h-px bg-gray-200/70 dark:bg-white/10 my-1" />

                  <ProPillButton
                    icon={<FolderOpen size={16} />}
                    label="文件列表"
                    forceLabel
                    active={showFiles}
                    onClick={() => { setShowHeaderMoreMenu(false); setShowFiles(!showFiles); }}
                  />
                  <ProPillButton
                    icon={showNotes ? <PanelRightClose size={16} /> : <StickyNote size={16} />}
                    label="笔记侧栏"
                    forceLabel
                    active={showNotes}
                    onClick={() => { setShowHeaderMoreMenu(false); setShowNotes(!showNotes); }}
                  />

                  {messages.length > 0 && (
                    <ProPillButton
                      icon={isSaving ? <RefreshCw size={16} className="animate-spin" /> : (lastSaved ? <Cloud size={16} /> : <Save size={16} />)}
                      label="保存会话"
                      forceLabel
                      active={!!lastSaved}
                      onClick={() => { setShowHeaderMoreMenu(false); saveCurrentSessionAsync(); }}
                    />
                  )}

                  <ProPillButton
                    icon={<Settings size={16} />}
                    label="设置"
                    forceLabel
                    onClick={() => { setShowHeaderMoreMenu(false); setShowSettings(true); }}
                  />

                  <ProPillButton
                    icon={<Upload size={16} />}
                    label={lectureState.file ? '更换PDF' : (lectureState.parsedPages.length > 0 ? '重新上传PDF' : '上传PDF')}
                    forceLabel
                    onClick={() => { setShowHeaderMoreMenu(false); fileInputRef.current?.click(); }}
                  />

                  {(lectureState.file || lectureState.parsedPages.length > 0) && (
                    <ProPillButton
                      icon={<Download size={16} />}
                      label="导出笔记"
                      forceLabel
                      onClick={() => { setShowHeaderMoreMenu(false); handleExport(); }}
                    />
                  )}

                  {(lectureState.file || lectureState.parsedPages.length > 0) && (
                    <ProPillButton
                      icon={<FileText size={16} />}
                      label={showPdf ? "关闭PDF" : "打开PDF"}
                      forceLabel
                      active={showPdf}
                      onClick={() => { setShowHeaderMoreMenu(false); setShowPdf(!showPdf); }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Lecture Controls - 顶部控制栏 */}
      {(lectureState.file || lectureState.parsedPages.length > 0) && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-2.5 flex items-center justify-between shadow-lg z-10 flex-shrink-0">
           <div className="flex items-center space-x-3 flex-shrink-0">
             <div className="flex items-center bg-slate-700/50 rounded-lg p-1">
               <button 
                  onClick={handlePrevBatch}
                  disabled={lectureState.currentBatch[0] <= 1 || isGenerating}
                  className="p-1.5 hover:bg-slate-600 rounded-md disabled:opacity-30 transition-colors text-slate-300 hover:text-white"
                  title="Previous Batch"
                >
                  <ChevronLeft size={18} />
               </button>
               <div className="flex flex-col items-center px-3 min-w-[100px]">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Slides</span>
                  <span className="text-sm font-semibold text-white">
                    {lectureState.currentBatch[0]} - {lectureState.currentBatch[1]}
                  </span>
               </div>
               <button 
                  onClick={handleNextBatch}
                  disabled={lectureState.currentBatch[1] >= lectureState.totalPages || isGenerating}
                  className="p-1.5 hover:bg-slate-600 rounded-md disabled:opacity-30 transition-colors text-slate-300 hover:text-white"
                  title="Next Batch"
                >
                  <ChevronRight size={18} />
               </button>
             </div>
             
             <span className="text-slate-500 text-xs hidden sm:inline">of {lectureState.totalPages} pages</span>
             
             {/* 知识库增强指示器 */}
             {(knowledgeStats.totalConcepts + knowledgeStats.totalFormulas) > 0 && (
               <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 rounded-lg" title="AI 正在使用您的知识库优化回答">
                 <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                 <span className="text-[10px] text-amber-300 font-medium">
                   知识增强 ({knowledgeStats.totalConcepts + knowledgeStats.totalFormulas})
                 </span>
               </div>
             )}
           </div>
           
           <div className="flex items-center space-x-2 flex-shrink-0">
              {/* Teaching Style Picker */}
              <div className="relative">
                <button
                  onClick={() => setShowStylePicker(!showStylePicker)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    showStylePicker 
                      ? 'bg-indigo-500 text-white' 
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600 hover:text-white'
                  }`}
                  title="切换教学风格"
                >
                  <Sparkles size={14} />
                  <span className="hidden md:inline">{TEACHING_STYLES[settings.teachingStyle]?.icon} {TEACHING_STYLES[settings.teachingStyle]?.name}</span>
                </button>
                
                {showStylePicker && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-900/85 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 z-50 overflow-hidden">
                    <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                      <p className="text-sm font-medium">🎭 选择教学风格</p>
                      <p className="text-xs opacity-80">调整 AI 的讲解方式</p>
                    </div>
                    <div className="p-2">
                      {(Object.keys(TEACHING_STYLES) as TeachingStyle[]).map(style => (
                        <button
                          key={style}
                          onClick={() => handleStyleChange(style)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors mb-1 ${
                            settings.teachingStyle === style
                              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-400/30'
                              : 'hover:bg-gray-100 text-gray-700 dark:text-slate-200 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{TEACHING_STYLES[style].icon}</span>
                            <div>
                              <span className="font-medium">{TEACHING_STYLES[style].name}</span>
                              <p className="text-xs text-gray-500 dark:text-slate-400">{TEACHING_STYLES[style].description}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="p-2 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/10 flex items-center justify-between">
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 flex items-center gap-1">
                        <MessageCircle size={10} />
                        {settings.enableContext ? `多轮上下文: ${settings.contextTurns}轮` : '上下文已关闭'}
                      </p>
                      <button 
                        onClick={() => setShowStylePicker(false)}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        关闭
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Start Lecture Button */}
              <Button 
                variant="primary" 
                size="sm" 
                onClick={handleStartLecture} 
                disabled={isGenerating}
                className="bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/25"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Explaining...
                  </>
                ) : (
                  <>
                    <GraduationCap size={16} className="mr-1.5"/> Start Lecture
                  </>
                )}
              </Button>
              
              {/* Regenerate Button */}
              {lastPromptData && messages.length > 0 && !isGenerating && (
                <button
                  onClick={handleRegenerate}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  title="重新生成回答"
                >
                  <RefreshCw size={16} />
                </button>
              )}
              
              <div className="h-5 w-px bg-slate-600 mx-1 hidden lg:block"></div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleToolAction(LectureMode.SUMMARY)} 
                disabled={isGenerating} 
                className="hidden lg:flex text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <BookOpen size={14} className="mr-1.5"/> Summary
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  if (showMockExam) {
                    setShowMockExam(false);
                  } else {
                    handleToolAction(LectureMode.MOCK_EXAM);
                  }
                }} 
                disabled={isGenerating}
                className={showMockExam 
                  ? "bg-purple-500/20 text-purple-300 border-purple-400/30" 
                  : "text-slate-300 hover:text-white hover:bg-slate-700"
                }
              >
                <ClipboardCheck size={14} className="mr-1.5"/> Exam
              </Button>
           </div>
        </div>
      )}

      {/* Main Content */}
      <main 
        ref={containerRef} 
        className="flex-1 flex overflow-hidden relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 拖拽上传指示层 */}
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-indigo-600/90 flex items-center justify-center pointer-events-none">
            <div className="text-center text-white">
              <div className="w-24 h-24 mx-auto mb-4 border-4 border-dashed border-white/50 rounded-2xl flex items-center justify-center">
                <Upload size={48} className="animate-bounce" />
              </div>
              <p className="text-2xl font-bold">释放以上传 PDF</p>
              <p className="text-white/70 mt-2">支持拖拽上传课件文件</p>
            </div>
          </div>
        )}
        
        {/* Inline Files Panel - Left Side */}
        <InlineFilesPanel
          isOpen={showFiles}
          onToggle={() => setShowFiles(!showFiles)}
          onSelectFile={handleSelectFile}
          onUploadFile={processFile}
          currentFileId={currentFileId || undefined}
        />
        
        {/* PDF Viewer Area */}
        <div 
          style={{ width: showPdf && (lectureState.file || lectureState.parsedPages.length > 0) ? `${pdfPanelWidth}%` : '0%' }}
          className={`
            bg-gray-800 relative border-r border-gray-700 flex flex-col flex-shrink-0
            ${showPdf && (lectureState.file || lectureState.parsedPages.length > 0) ? '' : 'overflow-hidden'}
            ${isResizing ? '' : 'transition-all duration-300 ease-in-out'}
          `}
        >
          {/* 有原始文件时显示 PDF 查看器 */}
          {lectureState.file && (
            <div className="h-full flex flex-col relative">
              <div className="bg-gray-900 text-gray-300 text-xs py-2 px-4 flex justify-between items-center shadow-md z-10 flex-shrink-0">
                <span className="truncate max-w-[200px]">{lectureState.file.name}</span>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => setViewPage(p => Math.max(1, p - 1))}
                        disabled={viewPage <= 1}
                        className="hover:text-white disabled:opacity-30"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span>Page {viewPage} of {lectureState.totalPages}</span>
                    <button 
                        onClick={() => setViewPage(p => Math.min(lectureState.totalPages, p + 1))}
                        disabled={viewPage >= lectureState.totalPages}
                        className="hover:text-white disabled:opacity-30"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
              </div>
              
              <div className="flex-1 relative overflow-hidden">
                <PdfViewer 
                  file={lectureState.file} 
                  pageNumber={viewPage}
                  totalPages={lectureState.parsedPages.length}
                  onPageChange={(page) => setViewPage(page)}
                  onRegionExtract={handlePdfRegionExtract}
                />
              </div>
            </div>
          )}
          
          {/* 没有原始文件但有解析数据时显示恢复的会话预览 */}
          {!lectureState.file && lectureState.parsedPages.length > 0 && (
            <div className="h-full flex flex-col relative">
              <div className="bg-gray-900 text-gray-300 text-xs py-2 px-4 flex justify-between items-center shadow-md z-10 flex-shrink-0">
                <span className="truncate max-w-[200px] flex items-center gap-2">
                  📄 Restored Session
                  <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[10px]">Preview</span>
                </span>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => setViewPage(p => Math.max(1, p - 1))}
                        disabled={viewPage <= 1}
                        className="hover:text-white disabled:opacity-30"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span>Page {viewPage} of {lectureState.totalPages}</span>
                    <button 
                        onClick={() => setViewPage(p => Math.min(lectureState.totalPages, p + 1))}
                        disabled={viewPage >= lectureState.totalPages}
                        className="hover:text-white disabled:opacity-30"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
              </div>
              
              <div className="flex-1 relative overflow-auto flex flex-col items-center justify-start py-4 px-4">
                {/* 显示保存的页面预览图片 */}
                 {lectureState.parsedPages[viewPage - 1]?.image ? (
                  <img 
                    src={lectureState.parsedPages[viewPage - 1].image} 
                    alt={`Page ${viewPage}`}
                     className="max-w-full shadow-xl bg-white dark:bg-slate-900 dark:border dark:border-white/10 rounded-xl"
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <FileText size={48} className="mb-4 opacity-50" />
                    <p className="text-center mb-2">Preview not available</p>
                    <p className="text-xs text-center text-gray-500 max-w-[200px]">
                      Re-upload the PDF to view full preview
                    </p>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
                    >
                      Upload PDF
                    </button>
                  </div>
                )}
                
                {/* 页面文本内容（当没有图片时显示）*/}
                {!lectureState.parsedPages[viewPage - 1]?.image && lectureState.parsedPages[viewPage - 1]?.text && (
                  <div className="mt-4 bg-gray-700 rounded-lg p-4 max-w-full">
                    <p className="text-xs text-gray-400 mb-2">📝 Page {viewPage} Text Content:</p>
                    <p className="text-gray-300 text-sm whitespace-pre-wrap line-clamp-6">
                      {lectureState.parsedPages[viewPage - 1].text.substring(0, 500)}...
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {lectureState.isParsing && (
            <div className="absolute inset-0 bg-gray-900/90 flex items-center justify-center z-50">
              <div className="text-center text-white">
                 <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-400 mx-auto mb-3"></div>
                 <p className="font-medium animate-pulse">Reading slides & images...</p>
              </div>
            </div>
          )}
        </div>

        {/* Resizable Divider */}
        {showPdf && lectureState.file && (
          <div
            onMouseDown={handleMouseDown}
            className={`
              w-2 flex-shrink-0 bg-gray-200 hover:bg-indigo-400 cursor-col-resize 
              flex items-center justify-center group transition-colors
              ${isResizing ? 'bg-indigo-500' : ''}
            `}
            title="拖动调整宽度"
          >
            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={16} className="text-white" />
            </div>
          </div>
        )}

        {/* Lecture Panel */}
        <div className="flex-1 flex flex-col h-full relative bg-slate-50 dark:bg-slate-950/40 min-w-0">
          {/* Chat/Content */}
          <LecturePanel 
            messages={messages} 
            isStreaming={isGenerating} 
            onTranslate={handleTranslate}
            onSaveMessage={handleSaveMessage}
          />

          {/* Input */}
          <div className="p-5 bg-white/90 dark:bg-slate-900/60 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 flex-shrink-0">
             <div className="max-w-4xl mx-auto">
                {/* Image Preview Area */}
                 {chatImages.length > 0 && (
                   <div className="flex flex-wrap gap-2 mb-3 p-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10">
                    {chatImages.map((img, index) => (
                      <div key={index} className="relative group">
                        <img 
                          src={img} 
                          alt={`Upload ${index + 1}`}
                           className="h-16 w-16 object-cover rounded-xl border border-gray-300 dark:border-white/15 shadow-sm"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          title="Remove image"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center text-xs text-gray-500 ml-2">
                      📷 {chatImages.length} image(s) ready
                    </div>
                  </div>
                )}
                
                {/* One-click OCR bar (only shown after PDF region selection) */}
                {lastPdfRegion && (
                  <div className="mb-3 p-2 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between gap-3">
                    <div className="text-xs text-indigo-700">
                      🎯 已框选第 <b>{lastPdfRegion.pageNumber}</b> 页区域：可一键 OCR（结构化）并自动入库
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleOneClickOcr}
                        disabled={isGenerating || isOcrRunning}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        {isOcrRunning ? 'OCR中...' : '一键OCR入库'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setLastPdfRegion(null); resetOcrState(); }}
                        disabled={isOcrRunning}
                      >
                        清除
                      </Button>
                    </div>
                  </div>
                )}
                
                {isOcrRunning && ocrProgressText && (
                  <div className="mb-3 p-2 bg-gray-900 text-gray-100 text-xs rounded-lg max-h-28 overflow-y-auto">
                    <div className="opacity-70 mb-1">OCR 进度（模型流式输出）：</div>
                    <pre className="whitespace-pre-wrap">{ocrProgressText.slice(-1500)}</pre>
                  </div>
                )}

                {/* Input Row */}
                 <div className="relative flex items-center gap-2">
                  {/* Image Upload Button */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                   <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={!lectureState.file || isGenerating}
                     className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-slate-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    title="Upload image"
                  >
                    <ImagePlus size={20} />
                  </button>

                  {/* Text Input */}
                  <div className="relative flex-1">
                     <input
                      type="text"
                       className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-indigo-500/60 dark:focus:ring-indigo-400/30 focus:border-transparent outline-none transition-all shadow-sm text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500"
                      placeholder={
                        lectureState.file 
                          ? chatImages.length > 0 
                            ? "Add a message or just send the image(s)..." 
                            : "Ask a question... (Ctrl+V to paste screenshot)"
                          : "Upload a PDF to get started..."
                      }
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !isGenerating && handleSendMessage()}
                      onPaste={handlePaste}
                      disabled={!lectureState.file}
                    />
                    
                    {/* Send/Stop Button */}
                    {isGenerating ? (
                      <button 
                        onClick={handleStopGeneration}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm animate-pulse"
                        title="Stop generating"
                      >
                        <Square size={16} fill="currentColor" />
                      </button>
                    ) : (
                      <button 
                        onClick={handleSendMessage}
                        disabled={!userInput.trim() && chatImages.length === 0}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-300 transition-colors shadow-sm"
                      >
                        <Send size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Helper Text */}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-gray-400">
                    💡 Paste screenshots with Ctrl+V or upload images
                  </p>
                  {settings.provider === 'gemini' && (
                    <p className="text-[10px] text-gray-400">
                      Powered by Google Gemini 2.5
                    </p>
                  )}
                </div>
             </div>
          </div>
        </div>

        {/* Inline Notes Panel - Right Side */}
        <InlineNotesPanel
          isOpen={showNotes && !showMockExam}
          onToggle={() => setShowNotes(!showNotes)}
          currentFileId={currentFileId || undefined}
          currentFileName={lectureState.file?.name}
        />

        {/* Inline Exam Panel - Right Side */}
        <InlineExamPanel
          isOpen={showMockExam}
          onToggle={() => setShowMockExam(!showMockExam)}
          examQuestions={examQuestions}
          isGenerating={isGeneratingExam}
          onSubmitAnswers={submitExamGrading}
          onRegenerateQuestions={generateExamQuestions}
          gradingResult={gradingResult}
          isGrading={isGrading}
        />
        
        {/* Exam to Document Panel - Right Side */}
        <ExamToDocPanel
          isOpen={showExamToDoc}
          onToggle={() => setShowExamToDoc(!showExamToDoc)}
          settings={settings}
        />
        
        {/* 智能闪卡面板 */}
        <FlashcardsPanel
          isOpen={showFlashcards}
          onToggle={() => setShowFlashcards(!showFlashcards)}
          settings={settings}
          currentContent={getCurrentLectureContent()}
          currentFileId={currentFileId || undefined}
          currentFileName={lectureState.file?.name}
        />
        
        {/* 思维导图面板 */}
        <MindMapPanel
          isOpen={showMindMap}
          onToggle={() => setShowMindMap(!showMindMap)}
          settings={settings}
          currentContent={getCurrentLectureContent()}
          currentFileId={currentFileId || undefined}
          currentFileName={lectureState.file?.name}
          currentPageRange={lectureState.currentBatch}
        />
        
        {/* 知识库面板 */}
        <KnowledgeBasePanel
          isOpen={showKnowledge}
          onToggle={() => setShowKnowledge(!showKnowledge)}
          settings={settings}
          currentContent={getCurrentLectureContent()}
          currentFileId={currentFileId || undefined}
          currentFileName={lectureState.file?.name}
          currentPageNumber={lectureState.currentBatch[0]}
          pageImages={getBatchImages(lectureState.currentBatch[0], lectureState.currentBatch[1], lectureState.parsedPages)}
          currentPageRange={lectureState.currentBatch}
        />
        
        {/* 公式讲解面板 */}
        <FormulaExplainerPanel
          isOpen={showFormula}
          onToggle={() => setShowFormula(!showFormula)}
          settings={settings}
          currentContent={getCurrentLectureContent()}
          currentFileId={currentFileId || undefined}
          currentFileName={lectureState.file?.name}
          pageImages={getBatchImages(lectureState.currentBatch[0], lectureState.currentBatch[1], lectureState.parsedPages)}
          currentPageRange={lectureState.currentBatch}
          allPages={lectureState.parsedPages}
        />
      </main>
    </div>
    </ToastContainer>
  );
};

export default App;
