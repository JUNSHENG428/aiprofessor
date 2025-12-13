import React, { useState, useRef, useCallback, useMemo } from 'react';
import remarkGfm from 'remark-gfm';
import { parsePDF } from '../services/pdfService';
import { generateStream, stopGeneration } from '../services/aiService';
import { AppSettings, ParsedPage } from '../types';
import { 
  Upload, FileText, FileCode, Sparkles, Download, Copy, Check, 
  ChevronDown, ChevronUp, Trash2, RefreshCw, Square, ArrowLeft,
  BookOpen, Lightbulb, GraduationCap, ZoomIn, ZoomOut, Highlighter,
  FileDown, Eye, Network, List, Type, Image, Loader2
} from 'lucide-react';
import { Button } from './Button';
import { MarkdownView } from './MarkdownView';

// Mindmap data structure
interface MindmapNode {
  id: string;
  text: string;
  children: MindmapNode[];
  level: number;
}

interface NotesOrganizerPageProps {
  settings: AppSettings;
  onBack: () => void;
}

const BrandMarkMini = ({ className }: { className?: string }) => (
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
      <linearGradient id="brand_g_notes" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366F1" />
        <stop offset="0.55" stopColor="#A855F7" />
        <stop offset="1" stopColor="#38BDF8" />
      </linearGradient>
    </defs>
    <path
      d="M32 12c11.046 0 20 8.954 20 20s-8.954 20-20 20-20-8.954-20-20 8.954-20 20-20Z"
      fill="url(#brand_g_notes)"
      fillOpacity="0.95"
    />
    <path
      d="M32 21.5l9.5 21h-4.2l-2.1-4.9H28.8l-2.1 4.9h-4.2l9.5-21Zm1.7 12.7-2.8-6.7-2.8 6.7h5.6Z"
      fill="white"
      fillOpacity="0.96"
    />
  </svg>
);

const NOTES_ORGANIZER_PROMPT = `
# 📚 Exam Revision Note Organizer / 考试复习笔记整理助手

You are a high-achieving student who helps organize **concise, easy-to-memorize, exam-focused** revision notes based on my materials.
你是一位经验丰富的学霸，帮助我整理**简洁、易记、以考试为导向**的复习笔记。

All content must be based ONLY on the lecture slides, handouts, and my class notes that I provide.
绝对不能胡编乱造，只能依据我提供的课件和课堂笔记。

---

## ⚠️ Output Rules（输出规则）

1. **Concise first（简洁至上）**
   - Each bullet or point must be **1–2 sentences in English**.
   - 每个要点英文控制在 1–2 句，拒绝啰嗦。

2. **English first, Chinese support（英文为主，中文为辅）**
   - Use **English as the main language**.
   - For each key sentence, add a **short Chinese translation** in parentheses or on the next line.
   - 以英文为主，每个关键句后附简短中文翻译（括号或下一行）。

3. **Clear card-style structure（卡片式结构）**
   - Use the template below for **every topic** so the layout is clean and easy to scan.
   - 所有主题都按固定模板输出，卡片式、一目了然。

4. **Highlight key terms（重点突出）**
   - Bold **keywords and core concepts** in English.
   - 关键术语用粗体 **加粗**，便于快速扫读。

5. **Length limits（长度限制）**
   - Each bullet ≤ **25 English words** and ≤ **30 Chinese characters** in the translation.
   - 每条要点英文不超过约 25 词，对应中文不超过 30 字。

6. **Page / slide reference（页码标注，如有）**
   - If page or slide numbers are available, include them after the topic title, e.g. *(Slide 5–7)*.
   - 如有页码/页数信息，在主题标题后标注 (Slide X–Y)。

---

## 📋 Output Template（输出格式模板）

For **each topic**, follow this exact structure:

---

## 📌 Topic X: [Topic Name] *(Slide / Page X–Y)*
（主题X：[中文名称]）

### 🎯 Key Exam Idea / 考点速记
> [One English sentence summarizing the core exam idea.]
> 【简短中文总结这一考点的核心意思】

### 📝 Key Concepts / 关键概念

| Term | Definition | Key Point |
|:---|:---|:---|
| **Term (EN)** | [Short English definition.] | [1 key memory hook in English + short CN in brackets] |

### 💡 Must-Memorize Points / 必背要点
- ✅ [Short English sentence with Chinese hint in brackets.]
- ✅ [Another key point, 1–2 sentences max.]
- ✅ [Another key point, focusing on what is likely to be tested.]

### 🔥 Common Pitfalls / 易错提醒
> ⚠️ [Describe common misunderstanding in English, then add a brief Chinese note.]

### 📖 Note Highlights / 笔记补充
> 💬 [Include teacher's extra explanations or unique insights from my notes in English, plus short CN.]

---

## 🚫 Do-Not Rules（禁止事项）

- ❌ Do NOT write long paragraphs; always use bullets, tables, and short blocks.（不要写大段长文）
- ❌ Do NOT repeat the same idea in different places.（不要重复啰嗦同一内容）
- ❌ Do NOT add decorative or motivational text unrelated to the exam.（不要加入与考试无关的鸡汤或修辞）
- ❌ Each bullet must stay within the length limits above.（每条要点必须控制在规定长度内）

---

## ✅ Example Output（示例）

---

## 📌 Topic 1: Consumer Behavior *(Slides 3–6)*
（主题1：消费者行为）

### 🎯 Key Exam Idea / 考点速记
> Understand the **five-stage consumer decision process** and its key internal and external influences.
> 核心是理解五阶段决策过程及内外部影响因素。

### 📝 Key Concepts / 关键概念

| Term | Definition | Key Point |
|:---|:---|:---|
| **Need Recognition** | Consumer notices a gap between actual and ideal state. | Starting point of decision process（决策起点） |
| **Information Search** | Use of internal memory and external sources to gather options. | Shapes the consideration set（影响备选集合） |

### 💡 Must-Memorize Points / 必背要点
- ✅ The 5 stages: **need recognition → information search → evaluation → purchase → post-purchase**.（五阶段顺序要背）
- ✅ Internal factors: **motivation, perception, learning, attitude**.（内部因素四个关键词）
- ✅ External factors: **culture, social class, reference groups, family**.（外部影响四大类）

### 🔥 Common Pitfalls / 易错提醒
> ⚠️ Not every purchase goes through all 5 stages; **impulse buying** may skip search and evaluation.
> ⚠️ 不是所有购买都会完整经历五阶段，冲动购买可能跳过搜索和评估。

### 📖 Note Highlights / 笔记补充
> 💬 The professor emphasized that **post-purchase satisfaction** strongly affects future loyalty and word-of-mouth.（老师强调购后满意度影响复购与口碑）

---

Use this structure for **all topics** from my materials and keep everything **short, exam-focused, and bilingual with English first**.
请对我所有的章节都按此模板整理，保持"英文为主 + 中文辅助"、紧扣考试、便于背诵。
`;

export const NotesOrganizerPage: React.FC<NotesOrganizerPageProps> = ({ settings, onBack }) => {
  // File states
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfContent, setPdfContent] = useState<string>('');
  const [pdfPages, setPdfPages] = useState<ParsedPage[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  
  const [notesFile, setNotesFile] = useState<File | null>(null);
  const [notesContent, setNotesContent] = useState<string>('');
  
  // Generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [organizedNotes, setOrganizedNotes] = useState<string>('');
  const [showCopied, setShowCopied] = useState(false);
  const [wasTruncated, setWasTruncated] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  // View enhancement states
  const [fontSize, setFontSize] = useState<number>(16); // px
  const [viewMode, setViewMode] = useState<'text' | 'outline' | 'mindmap'>('text');
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlightColor, setHighlightColor] = useState('yellow');
  const [highlights, setHighlights] = useState<{text: string, color: string}[]>([]);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  
  // AI Mindmap states
  const [mindmapData, setMindmapData] = useState<MindmapNode | null>(null);
  const [isGeneratingMindmap, setIsGeneratingMindmap] = useState(false);
  const mindmapRef = useRef<HTMLDivElement>(null);
  
  // Outline section refs for scroll
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  
  // Highlight colors
  const HIGHLIGHT_COLORS = [
    { name: '黄色', value: 'yellow', bg: 'bg-yellow-200', text: 'text-yellow-800' },
    { name: '绿色', value: 'green', bg: 'bg-green-200', text: 'text-green-800' },
    { name: '蓝色', value: 'blue', bg: 'bg-blue-200', text: 'text-blue-800' },
    { name: '粉色', value: 'pink', bg: 'bg-pink-200', text: 'text-pink-800' },
    { name: '橙色', value: 'orange', bg: 'bg-orange-200', text: 'text-orange-800' },
  ];
  
  // Refs
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Handle PDF upload
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;
    
    setPdfFile(file);
    setIsParsing(true);
    
    try {
      const pages = await parsePDF(file);
      setPdfPages(pages);
      const content = pages.map(p => `[Page ${p.pageNumber}]\n${p.text}`).join('\n\n');
      setPdfContent(content);
    } catch (err) {
      console.error('Error parsing PDF:', err);
      alert('Failed to parse PDF file');
    }
    
    setIsParsing(false);
  };

  // Handle Markdown notes upload
  const handleNotesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setNotesFile(file);
    
    try {
      const text = await file.text();
      setNotesContent(text);
    } catch (err) {
      console.error('Error reading notes file:', err);
      alert('Failed to read notes file');
    }
  };

  // Clear files
  const clearPdf = () => {
    setPdfFile(null);
    setPdfContent('');
    setPdfPages([]);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const clearNotes = () => {
    setNotesFile(null);
    setNotesContent('');
    if (notesInputRef.current) notesInputRef.current.value = '';
  };

  // Check if output appears truncated (incomplete)
  const checkIfTruncated = (text: string): boolean => {
    if (!text || text.length < 100) return false;
    
    const lastChars = text.slice(-100);
    
    // Check for incomplete patterns
    const incompletePatterns = [
      /\|\s*$/, // Incomplete table row
      /\*\*[^*]+$/, // Incomplete bold text
      /###?\s*$/, // Incomplete heading
      /:\s*$/, // Ends with colon (likely incomplete)
      /Definition\s*$/, // Incomplete definition
      /中文\s*$/, // Incomplete Chinese text
      /The process\s*$/, // Incomplete sentence
      /[A-Za-z]{2,}\s*$/, // Ends with incomplete word
    ];
    
    for (const pattern of incompletePatterns) {
      if (pattern.test(lastChars)) return true;
    }
    
    // Check if ends mid-sentence (no ending punctuation)
    const lastSentence = text.split(/[.!?。！？]\s*/).pop() || '';
    if (lastSentence.length > 50) return true;
    
    return false;
  };

  // Generate organized notes
  const handleGenerate = async () => {
    if (!pdfContent || !notesContent) {
      alert('请先上传 PDF 讲义和 Markdown 笔记');
      return;
    }
    
    if (!settings.apiKey && settings.provider !== 'ollama') {
      alert('请先在设置中配置 API Key');
      return;
    }

    setIsGenerating(true);
    setOrganizedNotes('');
    setWasTruncated(false);
    setLastError(null);

    const prompt = `
${NOTES_ORGANIZER_PROMPT}

---

# 输入材料 (Input Materials)

## 📚 讲义内容 (Lecture Content):
"""
${pdfContent.substring(0, 30000)}
${pdfContent.length > 30000 ? '\n\n[... 内容过长，已截断 ...]' : ''}
"""

## 📝 个人笔记 (Personal Notes):
"""
${notesContent.substring(0, 20000)}
${notesContent.length > 20000 ? '\n\n[... 内容过长，已截断 ...]' : ''}
"""

---

请开始整理笔记。Let's begin processing these materials.

**重要提示**: 如果你的输出接近长度限制，请在一个完整的主题结束后暂停，并在末尾标注 "[待续...]"，这样用户可以点击继续生成。
`;

    let fullResponse = '';
    
    try {
      await generateStream(settings, prompt, [], (chunk) => {
        fullResponse += chunk;
        setOrganizedNotes(fullResponse);
        
        // Auto scroll to bottom
        if (resultRef.current) {
          resultRef.current.scrollTop = resultRef.current.scrollHeight;
        }
      });
      
      // Check if output was truncated
      if (checkIfTruncated(fullResponse)) {
        setWasTruncated(true);
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      const errorMsg = err?.message || String(err);
      setLastError(errorMsg);
      
      // Check if it's a network/length limit error
      if (errorMsg.toLowerCase().includes('network') || 
          errorMsg.toLowerCase().includes('limit') ||
          errorMsg.toLowerCase().includes('timeout') ||
          checkIfTruncated(fullResponse)) {
        setWasTruncated(true);
        // Don't add error message to notes, just mark as truncated
      } else {
        setOrganizedNotes(prev => prev + '\n\n**[生成过程中发生错误: ' + errorMsg + ']**');
      }
    }

    setIsGenerating(false);
  };

  // Continue generation - seamlessly pick up from where it stopped
  const handleContinue = async () => {
    if (!settings.apiKey && settings.provider !== 'ollama') return;
    
    setIsGenerating(true);
    setWasTruncated(false);
    setLastError(null);
    
    // Get the last portion of content to provide context
    const lastContent = organizedNotes.slice(-2000);
    
    // Find a good continuation point
    const lines = organizedNotes.split('\n');
    const lastFewLines = lines.slice(-10).join('\n');
    
    const continuePrompt = `
你之前正在整理笔记，但输出在中途被截断了。请**无缝接续**之前的内容继续生成。

**关键要求**:
1. **不要重复**已生成的内容
2. **直接从断点处继续**，不要添加过渡语句或重新开始
3. 如果之前在表格、列表或定义中被截断，请**完成那个结构**
4. 保持相同的格式和风格

**之前输出的最后部分**:
"""
${lastFewLines}
"""

**更多上下文**:
"""
${lastContent}
"""

请从断点处**直接继续**（不要添加 "好的，继续" 等开头）:
`;

    // Don't add separator, just continue directly
    let fullResponse = organizedNotes;
    
    try {
      await generateStream(settings, continuePrompt, [], (chunk) => {
        fullResponse += chunk;
        setOrganizedNotes(fullResponse);
        
        if (resultRef.current) {
          resultRef.current.scrollTop = resultRef.current.scrollHeight;
        }
      });
      
      // Check if still truncated
      if (checkIfTruncated(fullResponse)) {
        setWasTruncated(true);
      }
    } catch (err: any) {
      console.error('Continue error:', err);
      const errorMsg = err?.message || String(err);
      
      if (errorMsg.toLowerCase().includes('network') || 
          errorMsg.toLowerCase().includes('limit') ||
          checkIfTruncated(fullResponse)) {
        setWasTruncated(true);
      }
    }

    setIsGenerating(false);
  };
  
  // Generate next topic (when current topic is complete)
  const handleNextTopic = async () => {
    if (!settings.apiKey && settings.provider !== 'ollama') return;
    
    setIsGenerating(true);
    setWasTruncated(false);
    
    const nextPrompt = `
基于之前的整理内容，请继续生成**下一个主题**。

已完成的内容：
"""
${organizedNotes.slice(-3000)}
"""

请继续整理下一个核心主题，遵循相同的格式。如果所有主题都已完成，请输出 "✅ 所有主题整理完毕！"
`;

    let fullResponse = organizedNotes + '\n\n---\n\n';
    
    try {
      await generateStream(settings, nextPrompt, [], (chunk) => {
        fullResponse += chunk;
        setOrganizedNotes(fullResponse);
      });
    } catch (err) {
      console.error('Next topic error:', err);
      if (checkIfTruncated(fullResponse)) {
        setWasTruncated(true);
      }
    }

    setIsGenerating(false);
  };

  // Stop generation
  const handleStop = () => {
    stopGeneration();
    setIsGenerating(false);
    setOrganizedNotes(prev => prev + '\n\n*[⏹ 生成已停止]*');
  };

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(organizedNotes);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Export as Markdown
  const handleExport = () => {
    const blob = new Blob([organizedNotes], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `organized_notes_${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as PDF
  const handleExportPdf = async () => {
    if (!resultRef.current) return;
    
    // Create print-friendly version
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('请允许弹出窗口以导出 PDF');
      return;
    }
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>整理笔记 - ${new Date().toLocaleDateString()}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap');
          
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          body {
            font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: ${fontSize}px;
            line-height: 1.8;
            color: #1a1a1a;
            padding: 40px 60px;
            max-width: 900px;
            margin: 0 auto;
          }
          
          h1, h2, h3, h4, h5, h6 {
            color: #2d3748;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-weight: 600;
          }
          
          h1 { font-size: 2em; border-bottom: 2px solid #667eea; padding-bottom: 0.3em; }
          h2 { font-size: 1.6em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.2em; }
          h3 { font-size: 1.3em; color: #4a5568; }
          h4 { font-size: 1.1em; color: #667eea; }
          
          p { margin: 0.8em 0; }
          
          ul, ol { margin: 0.5em 0; padding-left: 2em; }
          li { margin: 0.3em 0; }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
            font-size: 0.9em;
          }
          
          th, td {
            border: 1px solid #e2e8f0;
            padding: 8px 12px;
            text-align: left;
          }
          
          th {
            background: #f7fafc;
            font-weight: 600;
            color: #4a5568;
          }
          
          code {
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.9em;
            color: #e53e3e;
          }
          
          blockquote {
            border-left: 4px solid #667eea;
            padding-left: 1em;
            margin: 1em 0;
            color: #4a5568;
            font-style: italic;
          }
          
          strong { color: #2d3748; }
          
          hr {
            border: none;
            border-top: 2px dashed #e2e8f0;
            margin: 2em 0;
          }
          
          .highlight-yellow { background: #fef08a; padding: 2px 4px; }
          .highlight-green { background: #bbf7d0; padding: 2px 4px; }
          .highlight-blue { background: #bfdbfe; padding: 2px 4px; }
          .highlight-pink { background: #fbcfe8; padding: 2px 4px; }
          .highlight-orange { background: #fed7aa; padding: 2px 4px; }
          
          @media print {
            body { padding: 20px 40px; }
            h1, h2, h3 { page-break-after: avoid; }
            table, pre, blockquote { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div id="content">
          ${resultRef.current.innerHTML}
        </div>
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Handle text selection for highlighting
  const handleTextSelect = useCallback(() => {
    if (!highlightMode) return;
    
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    
    const selectedText = selection.toString().trim();
    if (selectedText.length > 0) {
      setHighlights(prev => [...prev, { text: selectedText, color: highlightColor }]);
      selection.removeAllRanges();
    }
  }, [highlightMode, highlightColor]);

  // Apply highlights to content
  const getHighlightedContent = useCallback((content: string): string => {
    let result = content;
    highlights.forEach(h => {
      const escapedText = h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedText})`, 'gi');
      result = result.replace(regex, `<mark class="highlight-${h.color}">$1</mark>`);
    });
    return result;
  }, [highlights]);

  // Clear highlights
  const clearHighlights = () => {
    setHighlights([]);
  };

  // Parse notes into mindmap structure - organized by chapter logic
  const parseNotesToMindmap = useCallback((content: string): MindmapNode => {
    const lines = content.split('\n');
    
    // Extract title from first topic or use default
    let mainTitle = '📚 Study Notes';
    const titleMatch = content.match(/^#\s+(.+)/m);
    if (titleMatch) {
      mainTitle = titleMatch[1].replace(/[📚🎓]/g, '').trim().substring(0, 30);
    }
    
    const root: MindmapNode = {
      id: 'root',
      text: mainTitle,
      children: [],
      level: 0
    };
    
    let currentTopic: MindmapNode | null = null;
    let currentSection: MindmapNode | null = null;
    let topicCount = 0;
    
    // Section icons mapping for visual clarity
    const sectionIcons: Record<string, string> = {
      'Key Exam': '🎯',
      '考点': '🎯',
      'Key Concepts': '📝',
      '关键概念': '📝',
      'Must-Memorize': '💡',
      '必背': '💡',
      'Common Pitfalls': '🔥',
      '易错': '🔥',
      'Note Highlights': '📖',
      '笔记': '📖',
    };
    
    const getIcon = (text: string): string => {
      for (const [key, icon] of Object.entries(sectionIcons)) {
        if (text.includes(key)) return icon;
      }
      return '•';
    };
    
    lines.forEach((line) => {
      // Match Topic headers (## 📌 Topic X: ...)
      const topicMatch = line.match(/^##\s*📌?\s*Topic\s*\d+[:\s]*(.+)/i) || 
                         line.match(/^##\s*📌\s*(.+)/i) ||
                         (line.startsWith('## ') && !line.includes('###') ? line.match(/^##\s*(.+)/) : null);
      
      // Match section headers (### 🎯 ...)
      const sectionMatch = line.match(/^###\s*(.+)/);
      
      // Match list items with checkmarks or bullets
      const listMatch = line.match(/^[-*]\s*(?:✅|✓|•|>)?\s*\*?\*?(.+?)\*?\*?\s*$/);
      
      // Match table rows for key concepts
      const tableMatch = line.match(/^\|\s*\*?\*?(.+?)\*?\*?\s*\|/);
      
      if (topicMatch && !line.includes('###')) {
        topicCount++;
        // Clean up topic text
        let topicText = topicMatch[1]
          .replace(/\*\(.*?\)\*?/g, '') // Remove slide references
          .replace(/（.*?）/g, '') // Remove Chinese parentheses content
          .replace(/\*\*/g, '')
          .trim();
        
        currentTopic = {
          id: `topic-${topicCount}`,
          text: topicText.substring(0, 35) + (topicText.length > 35 ? '...' : ''),
          children: [],
          level: 1
        };
        root.children.push(currentTopic);
        currentSection = null;
      } else if (sectionMatch && currentTopic) {
        let sectionText = sectionMatch[1]
          .replace(/\*\*/g, '')
          .replace(/\s*\/\s*/g, ' ')
          .trim();
        
        // Get appropriate icon
        const icon = getIcon(sectionText);
        
        // Simplify section names
        sectionText = sectionText
          .replace(/🎯|📝|💡|🔥|📖|💬|⚠️/g, '')
          .replace(/Key Exam Idea/i, 'Exam Idea')
          .replace(/Must-Memorize Points/i, 'Key Points')
          .replace(/Common Pitfalls/i, 'Pitfalls')
          .replace(/Note Highlights/i, 'Notes')
          .trim();
        
        currentSection = {
          id: `${currentTopic.id}-section-${currentTopic.children.length}`,
          text: `${icon} ${sectionText.substring(0, 25)}`,
          children: [],
          level: 2
        };
        currentTopic.children.push(currentSection);
      } else if ((listMatch || tableMatch) && currentSection && currentSection.children.length < 5) {
        let itemText = (listMatch?.[1] || tableMatch?.[1] || '')
          .replace(/\*\*/g, '')
          .replace(/\[.*?\]/g, '')
          .replace(/（.*?）/g, '')
          .replace(/\(.*?\)/g, '')
          .trim();
        
        if (itemText.length > 3 && !itemText.startsWith('---') && !itemText.startsWith('|')) {
          currentSection.children.push({
            id: `${currentSection.id}-item-${currentSection.children.length}`,
            text: itemText.substring(0, 40) + (itemText.length > 40 ? '...' : ''),
            children: [],
            level: 3
          });
        }
      }
    });
    
    // Limit to 6 topics for cleaner display
    if (root.children.length > 6) {
      root.children = root.children.slice(0, 6);
    }
    
    return root;
  }, []);

  // Generate mindmap from notes
  const generateAIMindmap = useCallback(() => {
    if (!organizedNotes) return;
    
    setIsGeneratingMindmap(true);
    
    // Small delay for visual feedback
    setTimeout(() => {
      const data = parseNotesToMindmap(organizedNotes);
      setMindmapData(data);
      setIsGeneratingMindmap(false);
    }, 500);
  }, [organizedNotes, parseNotesToMindmap]);

  // Export mindmap as image using canvas
  const exportMindmapAsImage = async () => {
    if (!mindmapRef.current || !mindmapData) return;
    
    try {
      const element = mindmapRef.current;
      const rect = element.getBoundingClientRect();
      const width = Math.max(rect.width, 1200);
      const height = Math.max(rect.height, 800);
      
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Scale for retina
      ctx.scale(2, 2);
      
      // Draw gradient background
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#1e1b4b');
      gradient.addColorStop(1, '#0f0a1e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // Draw title
      ctx.fillStyle = '#e9d5ff';
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📚 ' + (mindmapData.text || 'Study Notes'), width / 2, 50);
      
      // Draw nodes
      const nodeWidth = 180;
      const nodeHeight = 40;
      const startY = 100;
      const topicsCount = mindmapData.children.length;
      const spacing = Math.min(200, (width - 100) / topicsCount);
      const startX = (width - (topicsCount - 1) * spacing) / 2;
      
      mindmapData.children.forEach((topic, i) => {
        const x = startX + i * spacing;
        const y = startY;
        
        // Draw topic node
        const grd = ctx.createLinearGradient(x - nodeWidth/2, y, x + nodeWidth/2, y + nodeHeight);
        grd.addColorStop(0, '#8b5cf6');
        grd.addColorStop(1, '#ec4899');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.roundRect(x - nodeWidth/2, y, nodeWidth, nodeHeight, 8);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        const topicText = topic.text.length > 18 ? topic.text.substring(0, 18) + '...' : topic.text;
        ctx.fillText(topicText, x, y + 25);
        
        // Draw sub-items
        topic.children.slice(0, 3).forEach((section, j) => {
          const sy = y + nodeHeight + 30 + j * 50;
          
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.beginPath();
          ctx.roundRect(x - 80, sy, 160, 35, 6);
          ctx.fill();
          
          ctx.fillStyle = '#a78bfa';
          ctx.font = '11px Inter, sans-serif';
          const sectionText = section.text.length > 16 ? section.text.substring(0, 16) + '...' : section.text;
          ctx.fillText(sectionText, x, sy + 22);
        });
      });
      
      // Download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `mindmap_${new Date().toISOString().split('T')[0]}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (error) {
      console.error('Failed to export mindmap:', error);
    }
  };

  // Scroll to section in text view
  const scrollToSection = useCallback((sectionText: string) => {
    setViewMode('text');
    
    // Wait for view to switch then scroll
    setTimeout(() => {
      const resultDiv = resultRef.current;
      if (!resultDiv) return;
      
      // Find heading element containing the text
      const headings = resultDiv.querySelectorAll('h2, h3, h4');
      for (const heading of headings) {
        if (heading.textContent?.includes(sectionText.replace(/^[📌🎯📝💡🔥📖]\s*/, ''))) {
          heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Add highlight effect
          heading.classList.add('ring-2', 'ring-purple-500', 'ring-offset-2', 'ring-offset-slate-900');
          setTimeout(() => {
            heading.classList.remove('ring-2', 'ring-purple-500', 'ring-offset-2', 'ring-offset-slate-900');
          }, 2000);
          break;
        }
      }
    }, 100);
  }, []);

  // Generate outline view with clickable items
  const generateOutline = useCallback((content: string): React.ReactNode => {
    const lines = content.split('\n');
    const outline: {level: number; text: string}[] = [];
    
    lines.forEach(line => {
      const h1Match = line.match(/^# (.+)/);
      const h2Match = line.match(/^## (.+)/);
      const h3Match = line.match(/^### (.+)/);
      const h4Match = line.match(/^#### (.+)/);
      
      if (h1Match) outline.push({ level: 1, text: h1Match[1] });
      else if (h2Match) outline.push({ level: 2, text: h2Match[1] });
      else if (h3Match) outline.push({ level: 3, text: h3Match[1] });
      else if (h4Match) outline.push({ level: 4, text: h4Match[1] });
    });
    
    return (
      <div className="space-y-1">
        <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
          <Eye size={12} />
          点击条目跳转到对应章节
        </p>
        {outline.map((item, index) => (
          <div 
            key={index}
            onClick={() => scrollToSection(item.text)}
            className={`group flex items-center gap-2 py-2 px-3 rounded-lg transition-all cursor-pointer
              hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/10 hover:translate-x-1
              active:scale-[0.98] ${
              item.level === 1 ? 'text-purple-300 font-bold text-lg' :
              item.level === 2 ? 'text-pink-300 font-semibold ml-4' :
              item.level === 3 ? 'text-blue-300 ml-8' :
              'text-gray-400 ml-12 text-sm'
            }`}
          >
            <span className={`w-2 h-2 rounded-full bg-current flex-shrink-0 transition-transform group-hover:scale-125 ${
              item.level === 2 ? 'w-2.5 h-2.5' : ''
            }`} />
            <span className="group-hover:text-white transition-colors">{item.text}</span>
            <ChevronDown size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity rotate-[-90deg] text-purple-400" />
          </div>
        ))}
      </div>
    );
  }, [scrollToSection]);

  // Generate simple mindmap view
  const generateMindmap = useCallback((content: string): React.ReactNode => {
    const lines = content.split('\n');
    const topics: {title: string; items: string[]}[] = [];
    let currentTopic: {title: string; items: string[]} | null = null;
    
    lines.forEach(line => {
      const topicMatch = line.match(/^### Topic \d+: (.+)/);
      const h4Match = line.match(/^#### \d+\. (.+)/);
      
      if (topicMatch) {
        if (currentTopic) topics.push(currentTopic);
        currentTopic = { title: topicMatch[1], items: [] };
      } else if (h4Match && currentTopic) {
        currentTopic.items.push(h4Match[1]);
      }
    });
    if (currentTopic) topics.push(currentTopic);
    
    if (topics.length === 0) {
      return <p className="text-gray-400 text-center py-8">未检测到主题结构</p>;
    }
    
    return (
      <div className="flex flex-col items-center py-8">
        {/* Central node */}
        <div className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl text-white font-bold text-lg shadow-lg shadow-purple-500/30 mb-8">
          📚 整理笔记
        </div>
        
        {/* Topic branches */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
          {topics.map((topic, idx) => (
            <div key={idx} className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-purple-500/50 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold">
                  {idx + 1}
                </span>
                <h4 className="font-semibold text-purple-200 text-sm line-clamp-2">{topic.title}</h4>
              </div>
              <div className="space-y-1.5">
                {topic.items.slice(0, 5).map((item, itemIdx) => (
                  <div key={itemIdx} className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                    <span className="line-clamp-1">{item}</span>
                  </div>
                ))}
                {topic.items.length > 5 && (
                  <p className="text-xs text-gray-500 ml-3">+{topic.items.length - 5} more...</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-black/30 backdrop-blur-md border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="返回主页"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/5 border border-white/10 rounded-2xl shadow-lg shadow-indigo-500/20 backdrop-blur-md">
                <BrandMarkMini className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Notes Organizer</h1>
                <p className="text-xs text-purple-300">Pro • Deep Dark</p>
              </div>
            </div>
          </div>
          
          {organizedNotes && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
              >
                {showCopied ? <Check size={16} /> : <Copy size={16} />}
                {showCopied ? '已复制' : '复制'}
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-emerald-500/25"
              >
                <Download size={16} />
                导出 Markdown
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - File Upload */}
        <div className="w-80 flex-shrink-0 bg-black/20 backdrop-blur-sm border-r border-white/10 flex flex-col">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-1">
              📁 上传文件
            </h2>
            <p className="text-xs text-gray-400">Upload your lecture and notes</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* PDF Upload */}
            <div className={`rounded-xl border-2 border-dashed transition-all ${
              pdfFile 
                ? 'border-emerald-500/50 bg-emerald-500/10' 
                : 'border-white/20 hover:border-purple-500/50 hover:bg-purple-500/5'
            }`}>
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                className="hidden"
              />
              
              {pdfFile ? (
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <FileText size={20} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-300 truncate max-w-[150px]">
                          {pdfFile.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {pdfPages.length} pages | {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={clearPdf}
                      className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {isParsing && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-purple-300">
                      <div className="animate-spin h-3 w-3 border-2 border-purple-400 border-t-transparent rounded-full" />
                      解析中...
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  className="w-full p-6 text-center"
                  disabled={isParsing}
                >
                  <FileText size={32} className="mx-auto mb-3 text-purple-400" />
                  <p className="text-sm font-medium text-purple-300">上传 PDF 讲义</p>
                  <p className="text-xs text-gray-500 mt-1">Click to upload lecture PDF</p>
                </button>
              )}
            </div>

            {/* Notes Upload */}
            <div className={`rounded-xl border-2 border-dashed transition-all ${
              notesFile 
                ? 'border-amber-500/50 bg-amber-500/10' 
                : 'border-white/20 hover:border-purple-500/50 hover:bg-purple-500/5'
            }`}>
              <input
                ref={notesInputRef}
                type="file"
                accept=".md,.txt,.markdown"
                onChange={handleNotesUpload}
                className="hidden"
              />
              
              {notesFile ? (
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/20 rounded-lg">
                        <FileCode size={20} className="text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-amber-300 truncate max-w-[150px]">
                          {notesFile.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {notesContent.split('\n').length} lines | {(notesFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={clearNotes}
                      className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => notesInputRef.current?.click()}
                  className="w-full p-6 text-center"
                >
                  <FileCode size={32} className="mx-auto mb-3 text-amber-400" />
                  <p className="text-sm font-medium text-amber-300">上传 Markdown 笔记</p>
                  <p className="text-xs text-gray-500 mt-1">Click to upload your notes (.md)</p>
                </button>
              )}
            </div>

            {/* Generate Button */}
            <div className="pt-4">
              {isGenerating ? (
                <button
                  onClick={handleStop}
                  className="w-full py-3 px-4 bg-red-500 hover:bg-red-600 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Square size={16} fill="currentColor" />
                  停止生成
                </button>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={!pdfContent || !notesContent}
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/25 disabled:shadow-none"
                >
                  <Sparkles size={18} />
                  开始整理笔记
                </button>
              )}
            </div>

            {/* Tips */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h3 className="text-xs font-semibold text-purple-300 mb-2 flex items-center gap-2">
                <Lightbulb size={14} />
                使用提示
              </h3>
              <ul className="text-xs text-gray-400 space-y-1.5">
                <li>• 上传课程 PDF 讲义文件</li>
                <li>• 上传对应的 Markdown 笔记</li>
                <li>• AI 将融合两份材料生成考试导向的笔记</li>
                <li>• 支持分批生成和导出功能</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Panel - Result */}
        <div className="flex-1 flex flex-col">
          {organizedNotes ? (
            <>
              {/* Result Header */}
              <div className="flex-shrink-0 bg-black/20 border-b border-white/10 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GraduationCap size={20} className="text-purple-400" />
                  <span className="font-medium">整理结果</span>
                  {isGenerating && (
                    <span className="flex items-center gap-2 text-xs text-purple-300 bg-purple-500/20 px-2 py-1 rounded-full">
                      <div className="animate-spin h-3 w-3 border-2 border-purple-400 border-t-transparent rounded-full" />
                      生成中...
                    </span>
                  )}
                  {wasTruncated && !isGenerating && (
                    <span className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/20 px-2 py-1 rounded-full">
                      ⚠️ 输出被截断
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {!isGenerating && organizedNotes && (
                    <>
                      {wasTruncated ? (
                        <button
                          onClick={handleContinue}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-lg text-sm text-white font-medium transition-colors shadow-lg shadow-amber-500/25 animate-pulse"
                        >
                          <RefreshCw size={14} />
                          接续生成
                        </button>
                      ) : (
                        <button
                          onClick={handleNextTopic}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-sm text-purple-300 transition-colors"
                        >
                          <ChevronDown size={14} />
                          生成下一主题
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {/* Truncation Warning Banner */}
              {wasTruncated && !isGenerating && (
                <div className="flex-shrink-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-b border-amber-500/30 px-6 py-2 flex items-center justify-between">
                  <p className="text-xs text-amber-200">
                    ⚠️ AI 输出在中途被截断。点击 <strong>"接续生成"</strong> 让 AI 从断点处继续完成内容。
                  </p>
                  <button
                    onClick={handleContinue}
                    className="text-xs text-amber-100 underline hover:text-white"
                  >
                    立即接续 →
                  </button>
                </div>
              )}

              {/* View Controls Toolbar */}
              <div className="flex-shrink-0 bg-black/30 border-b border-white/10 px-4 py-2 flex items-center justify-between gap-4">
                {/* Left: View Mode */}
                <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('text')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                      viewMode === 'text' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="文本视图"
                  >
                    <FileText size={14} />
                    <span className="hidden sm:inline">文本</span>
                  </button>
                  <button
                    onClick={() => setViewMode('outline')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                      viewMode === 'outline' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="大纲视图"
                  >
                    <List size={14} />
                    <span className="hidden sm:inline">大纲</span>
                  </button>
                  <button
                    onClick={() => setViewMode('mindmap')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                      viewMode === 'mindmap' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="脑图视图"
                  >
                    <Network size={14} />
                    <span className="hidden sm:inline">脑图</span>
                  </button>
                </div>

                {/* Center: Font Size & Highlight */}
                <div className="flex items-center gap-3">
                  {/* Font Size */}
                  <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1">
                    <Type size={14} className="text-gray-400" />
                    <button
                      onClick={() => setFontSize(prev => Math.max(12, prev - 2))}
                      disabled={fontSize <= 12}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                      title="缩小字号"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <span className="text-xs text-gray-300 w-8 text-center">{fontSize}</span>
                    <button
                      onClick={() => setFontSize(prev => Math.min(28, prev + 2))}
                      disabled={fontSize >= 28}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                      title="放大字号"
                    >
                      <ZoomIn size={14} />
                    </button>
                  </div>

                  {/* Highlighter */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (highlightMode) {
                          setHighlightMode(false);
                        } else {
                          setShowHighlightPicker(!showHighlightPicker);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                        highlightMode 
                          ? 'bg-yellow-500 text-yellow-900' 
                          : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                      title="荧光笔"
                    >
                      <Highlighter size={14} />
                      <span className="hidden sm:inline">{highlightMode ? '关闭' : '高亮'}</span>
                    </button>
                    
                    {showHighlightPicker && !highlightMode && (
                      <div className="absolute top-full left-0 mt-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-2 z-50">
                        <p className="text-xs text-gray-400 mb-2 px-1">选择高亮颜色</p>
                        <div className="flex gap-1">
                          {HIGHLIGHT_COLORS.map(color => (
                            <button
                              key={color.value}
                              onClick={() => {
                                setHighlightColor(color.value);
                                setHighlightMode(true);
                                setShowHighlightPicker(false);
                              }}
                              className={`w-7 h-7 rounded-md ${color.bg} hover:ring-2 ring-white/50 transition-all`}
                              title={color.name}
                            />
                          ))}
                        </div>
                        {highlights.length > 0 && (
                          <button
                            onClick={() => { clearHighlights(); setShowHighlightPicker(false); }}
                            className="w-full mt-2 text-xs text-red-400 hover:text-red-300 py-1"
                          >
                            清除所有高亮
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {highlights.length > 0 && (
                    <span className="text-xs text-purple-300 bg-purple-500/20 px-2 py-1 rounded-full">
                      {highlights.length} 处高亮
                    </span>
                  )}
                </div>

                {/* Right: Export Options */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 transition-colors"
                    title="导出 Markdown"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">.md</span>
                  </button>
                  <button
                    onClick={handleExportPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 rounded-lg text-xs text-white font-medium transition-colors"
                    title="导出 PDF"
                  >
                    <FileDown size={14} />
                    <span className="hidden sm:inline">PDF</span>
                  </button>
                </div>
              </div>
              
              {/* Highlight Mode Indicator */}
              {highlightMode && (
                <div className={`flex-shrink-0 ${HIGHLIGHT_COLORS.find(c => c.value === highlightColor)?.bg || 'bg-yellow-200'} px-4 py-1.5 flex items-center justify-center gap-2`}>
                  <Highlighter size={14} className="text-gray-800" />
                  <span className="text-xs text-gray-800 font-medium">
                    选中文本即可高亮 | 点击高亮按钮退出
                  </span>
                </div>
              )}

              {/* Result Content */}
              <div 
                ref={resultRef}
                className="flex-1 overflow-y-auto p-6"
                onMouseUp={handleTextSelect}
                style={{ fontSize: `${fontSize}px` }}
              >
                {viewMode === 'text' ? (
                  <div 
                    className="max-w-4xl mx-auto notes-content"
                    style={{ fontSize: 'inherit' }}
                  >
                    {highlights.length > 0 ? (
                      <div 
                        dangerouslySetInnerHTML={{ 
                          __html: getHighlightedContent(
                            organizedNotes
                              .replace(/&/g, '&amp;')
                              .replace(/</g, '&lt;')
                              .replace(/>/g, '&gt;')
                              .replace(/\n/g, '<br/>')
                          )
                        }} 
                      />
                    ) : (
                      <MarkdownView
                        content={organizedNotes}
                        components={{
                          // 主题标题 - 大卡片样式
                          h2: ({children}) => (
                            <div className="mt-8 mb-6 p-5 bg-gradient-to-r from-purple-600/30 to-pink-600/20 rounded-xl border border-purple-500/30 shadow-lg">
                              <h2 className="text-xl font-bold text-white m-0 flex items-center gap-3">
                                {children}
                              </h2>
                            </div>
                          ),
                          // 小节标题 - 标签样式
                          h3: ({children}) => (
                            <h3 className="mt-6 mb-3 text-lg font-semibold text-purple-300 flex items-center gap-2 border-b border-purple-500/20 pb-2">
                              {children}
                            </h3>
                          ),
                          // 表格 - 清晰的卡片样式
                          table: ({children}) => (
                            <div className="my-4 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                              <table className="w-full text-sm">{children}</table>
                            </div>
                          ),
                          thead: ({children}) => (
                            <thead className="bg-purple-600/30 text-purple-200">{children}</thead>
                          ),
                          th: ({children}) => (
                            <th className="px-4 py-3 text-left font-semibold border-b border-white/10">{children}</th>
                          ),
                          td: ({children}) => (
                            <td className="px-4 py-3 text-gray-300 border-b border-white/5">{children}</td>
                          ),
                          tr: ({children}) => (
                            <tr className="hover:bg-white/5 transition-colors">{children}</tr>
                          ),
                          // 引用块 - 重点提示样式
                          blockquote: ({children}) => (
                            <blockquote className="my-4 p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-l-4 border-amber-400 rounded-r-lg text-amber-100">
                              {children}
                            </blockquote>
                          ),
                          // 列表项 - 清晰的项目符号
                          ul: ({children}) => (
                            <ul className="my-3 space-y-2 list-none pl-0">{children}</ul>
                          ),
                          li: ({children}) => (
                            <li className="flex items-start gap-2 text-gray-300 leading-relaxed">
                              <span className="text-purple-400 mt-1 flex-shrink-0">•</span>
                              <span>{children}</span>
                            </li>
                          ),
                          // 段落
                          p: ({children}) => (
                            <p className="my-2 text-gray-300 leading-relaxed">{children}</p>
                          ),
                          // 加粗
                          strong: ({children}) => (
                            <strong className="text-white font-semibold">{children}</strong>
                          ),
                          // 代码
                          code: ({children}) => (
                            <code className="px-1.5 py-0.5 bg-white/10 text-pink-300 rounded text-sm">{children}</code>
                          ),
                          // 分割线 - 主题分隔
                          hr: () => (
                            <hr className="my-8 border-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
                          ),
                        }}
                      />
                    )}
                  </div>
                ) : viewMode === 'outline' ? (
                  <div className="max-w-3xl mx-auto">
                    <h3 className="text-lg font-semibold text-purple-300 mb-4 flex items-center gap-2">
                      <List size={20} />
                      大纲视图
                    </h3>
                    {generateOutline(organizedNotes)}
                  </div>
                ) : (
                  <div className="w-full max-w-6xl mx-auto">
                    {/* Mindmap Header */}
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
                        <Network size={20} />
                        思维导图
                      </h3>
                      <div className="flex items-center gap-2">
                        {!mindmapData && !isGeneratingMindmap && (
                          <button
                            onClick={generateAIMindmap}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                          >
                            <Sparkles size={16} />
                            生成脑图
                          </button>
                        )}
                        {isGeneratingMindmap && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg text-sm text-gray-300">
                            <Loader2 size={16} className="animate-spin" />
                            正在生成...
                          </div>
                        )}
                        {mindmapData && !isGeneratingMindmap && (
                          <>
                            <button
                              onClick={generateAIMindmap}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/20 transition-colors"
                            >
                              <RefreshCw size={14} />
                              重新生成
                            </button>
                            <button
                              onClick={exportMindmapAsImage}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
                            >
                              <Image size={14} />
                              导出图片
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Mindmap Content */}
                    {mindmapData ? (
                      <div 
                        ref={mindmapRef}
                        className="bg-gradient-to-br from-slate-900/80 to-purple-900/40 rounded-2xl p-6 border border-white/10 overflow-auto min-h-[500px]"
                      >
                        {/* Root Node - Center */}
                        <div className="flex flex-col items-center mb-8">
                          <div className="px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 rounded-2xl text-white font-bold text-xl shadow-xl shadow-purple-500/40 border border-white/20">
                            📚 {mindmapData.text}
                          </div>
                        </div>
                        
                        {/* Topics as Horizontal Tree */}
                        <div className="flex flex-col gap-6">
                          {mindmapData.children.map((topic, idx) => {
                            // Alternate colors for visual distinction
                            const colors = [
                              { bg: 'from-purple-600 to-purple-700', border: 'border-purple-400', line: 'bg-purple-400' },
                              { bg: 'from-pink-600 to-pink-700', border: 'border-pink-400', line: 'bg-pink-400' },
                              { bg: 'from-blue-600 to-blue-700', border: 'border-blue-400', line: 'bg-blue-400' },
                              { bg: 'from-emerald-600 to-emerald-700', border: 'border-emerald-400', line: 'bg-emerald-400' },
                              { bg: 'from-amber-600 to-amber-700', border: 'border-amber-400', line: 'bg-amber-400' },
                              { bg: 'from-rose-600 to-rose-700', border: 'border-rose-400', line: 'bg-rose-400' },
                            ];
                            const color = colors[idx % colors.length];
                            
                            return (
                              <div key={topic.id} className="flex items-start gap-4">
                                {/* Topic Number & Connector */}
                                <div className="flex-shrink-0 flex flex-col items-center">
                                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color.bg} flex items-center justify-center text-lg font-bold shadow-lg`}>
                                    {idx + 1}
                                  </div>
                                  {topic.children.length > 0 && (
                                    <div className={`w-0.5 flex-1 min-h-[20px] ${color.line}/50`} />
                                  )}
                                </div>
                                
                                {/* Topic Content Card */}
                                <div className={`flex-1 bg-white/5 rounded-xl border ${color.border}/30 overflow-hidden hover:bg-white/10 transition-all duration-300`}>
                                  {/* Topic Header */}
                                  <div className={`px-4 py-3 bg-gradient-to-r ${color.bg}/20 border-b border-white/10`}>
                                    <h4 className="font-semibold text-white text-sm">
                                      {topic.text}
                                    </h4>
                                  </div>
                                  
                                  {/* Sections Grid */}
                                  {topic.children.length > 0 && (
                                    <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                                      {topic.children.slice(0, 5).map((section) => (
                                        <div 
                                          key={section.id} 
                                          className="bg-white/5 rounded-lg p-2.5 hover:bg-white/10 transition-colors"
                                        >
                                          <div className="text-xs font-medium text-gray-200 mb-1.5 line-clamp-1">
                                            {section.text}
                                          </div>
                                          {/* Section Items */}
                                          {section.children.length > 0 && (
                                            <div className="space-y-1">
                                              {section.children.slice(0, 3).map((item) => (
                                                <div 
                                                  key={item.id} 
                                                  className="flex items-start gap-1.5 text-xs text-gray-400"
                                                >
                                                  <span className={`w-1 h-1 rounded-full ${color.line} mt-1.5 flex-shrink-0`} />
                                                  <span className="line-clamp-2 leading-tight">{item.text}</span>
                                                </div>
                                              ))}
                                              {section.children.length > 3 && (
                                                <span className="text-xs text-gray-500 ml-2.5">+{section.children.length - 3}</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Legend */}
                        <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1.5"><span className="text-base">🎯</span> Exam Ideas</span>
                          <span className="flex items-center gap-1.5"><span className="text-base">📝</span> Key Concepts</span>
                          <span className="flex items-center gap-1.5"><span className="text-base">💡</span> Must-Memorize</span>
                          <span className="flex items-center gap-1.5"><span className="text-base">🔥</span> Pitfalls</span>
                          <span className="flex items-center gap-1.5"><span className="text-base">📖</span> Notes</span>
                        </div>
                      </div>
                    ) : isGeneratingMindmap ? (
                      <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-16 h-16 mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <Loader2 size={32} className="text-purple-400 animate-spin" />
                        </div>
                        <p className="text-gray-400">正在分析笔记结构...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-20 h-20 mb-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center">
                          <Network size={40} className="text-purple-400" />
                        </div>
                        <h4 className="text-lg font-semibold text-gray-300 mb-2">
                          智能思维导图
                        </h4>
                        <p className="text-sm text-gray-500 mb-6 max-w-md">
                          点击"生成脑图"按钮，自动从笔记中提取主题结构生成可视化思维导图
                        </p>
                        <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-500">
                          <span className="px-2 py-1 bg-white/5 rounded">✨ 自动提取主题</span>
                          <span className="px-2 py-1 bg-white/5 rounded">🌳 层级结构清晰</span>
                          <span className="px-2 py-1 bg-white/5 rounded">📥 支持导出图片</span>
                        </div>
                        
                        {/* Quick Card Preview */}
                        <div className="mt-8 w-full">
                          <h4 className="text-sm font-medium text-gray-400 mb-4 flex items-center justify-center gap-2">
                            <Eye size={14} />
                            快速预览（卡片视图）
                          </h4>
                          {generateMindmap(organizedNotes)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-3xl flex items-center justify-center">
                  <BookOpen size={48} className="text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                  Ready to Organize Your Notes?
                </h2>
                <p className="text-gray-400 mb-6">
                  Upload your PDF lecture slides and Markdown notes. AI will generate exam-focused revision materials.
                  <br />
                  <span className="text-gray-500 text-sm">上传 PDF 讲义和笔记，AI 帮你生成考试复习材料</span>
                </p>
                <div className="flex flex-wrap justify-center gap-3 text-xs text-gray-500">
                  <span className="px-3 py-1.5 bg-white/5 rounded-full">🎯 Key Exam Ideas</span>
                  <span className="px-3 py-1.5 bg-white/5 rounded-full">📝 Key Concepts</span>
                  <span className="px-3 py-1.5 bg-white/5 rounded-full">💡 Must-Memorize</span>
                  <span className="px-3 py-1.5 bg-white/5 rounded-full">🔥 Common Pitfalls</span>
                  <span className="px-3 py-1.5 bg-white/5 rounded-full">📖 Note Highlights</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

