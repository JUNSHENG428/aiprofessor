import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Calculator, Plus, Sparkles, X, Search, Trash2, Edit3, Copy,
  ChevronDown, ChevronRight, BookOpen, Zap, Filter, Download,
  ArrowRight, HelpCircle, Sigma, Pi, Percent, TrendingUp
} from 'lucide-react';
import { Formula, FormulaVariable, AppSettings } from '../types';
import { 
  getFormulas, saveFormula, saveFormulas, deleteFormula, 
  searchFormulas, getFormulaStats 
} from '../services/storageService';
import { generateStream } from '../services/aiService';
import { PROMPTS } from '../constants';
import { Button } from './Button';
import { useToast } from './Toast';
import { useDebounce, useClipboard } from '../hooks/useOptimized';

interface FormulaExplainerPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  settings: AppSettings;
  currentContent?: string;
  currentFileId?: string;
  currentFileName?: string;
  // PDF 页面图片（用于视觉识别公式）
  pageImages?: string[];
  currentPageRange?: [number, number];
}

type ViewMode = 'list' | 'explain' | 'create' | 'detail';

// 分类配置
const CATEGORY_CONFIG = {
  math: { label: '数学', icon: <Sigma size={14} />, color: 'bg-blue-100 text-blue-700' },
  physics: { label: '物理', icon: <Zap size={14} />, color: 'bg-purple-100 text-purple-700' },
  chemistry: { label: '化学', icon: <Pi size={14} />, color: 'bg-green-100 text-green-700' },
  statistics: { label: '统计', icon: <Percent size={14} />, color: 'bg-orange-100 text-orange-700' },
  economics: { label: '经济', icon: <TrendingUp size={14} />, color: 'bg-rose-100 text-rose-700' },
  other: { label: '其他', icon: <Calculator size={14} />, color: 'bg-gray-100 text-gray-700' }
};

const DIFFICULTY_CONFIG = {
  basic: { label: '基础', color: 'bg-green-100 text-green-700' },
  intermediate: { label: '中等', color: 'bg-yellow-100 text-yellow-700' },
  advanced: { label: '高级', color: 'bg-red-100 text-red-700' }
};

// LaTeX 渲染组件（使用 KaTeX CDN）
const LatexRenderer: React.FC<{ latex: string; display?: boolean }> = ({ latex, display = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && (window as any).katex) {
      try {
        (window as any).katex.render(latex, containerRef.current, {
          displayMode: display,
          throwOnError: false,
          errorColor: '#cc0000'
        });
      } catch (e) {
        containerRef.current.textContent = latex;
      }
    }
  }, [latex, display]);

  return <div ref={containerRef} className="overflow-x-auto" />;
};

export const FormulaExplainerPanel: React.FC<FormulaExplainerPanelProps> = ({
  isOpen,
  onToggle,
  settings,
  currentContent,
  currentFileId,
  currentFileName,
  pageImages,
  currentPageRange
}) => {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [explanation, setExplanation] = useState('');
  
  // 表单状态
  const [inputLatex, setInputLatex] = useState('');
  const [inputName, setInputName] = useState('');
  const [inputCategory, setInputCategory] = useState<string>('math');
  const [inputDifficulty, setInputDifficulty] = useState<string>('intermediate');
  const [inputTags, setInputTags] = useState('');

  const toast = useToast();
  const { copy } = useClipboard();
  const debouncedSearch = useDebounce(searchQuery, 300);

  // 加载公式
  useEffect(() => {
    if (isOpen) {
      setFormulas(getFormulas());
      // 动态加载 KaTeX
      if (!(window as any).katex) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
        document.head.appendChild(link);
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
        document.head.appendChild(script);
      }
    }
  }, [isOpen]);

  // 统计数据
  const stats = useMemo(() => getFormulaStats(), [formulas]);

  // 过滤后的公式
  const filteredFormulas = useMemo(() => {
    let result = formulas;
    
    if (debouncedSearch) {
      result = searchFormulas(debouncedSearch);
    }
    
    if (filterCategory) {
      result = result.filter(f => f.category === filterCategory);
    }
    
    return result;
  }, [formulas, debouncedSearch, filterCategory]);

  // 直接从 PDF 图片讲解公式（视觉识别+讲解）
  const handleExplainFromPDF = useCallback(async (formulaHint?: string) => {
    if (!pageImages || pageImages.length === 0) {
      toast.warning('请先上传 PDF 文件');
      return;
    }
    if (!settings.apiKey && settings.provider !== 'ollama') {
      toast.warning('请先配置 API Key');
      return;
    }

    setIsGenerating(true);
    setExplanation('');
    setViewMode('explain');
    
    try {
      const prompt = PROMPTS.EXPLAIN_FORMULA_FROM_IMAGE(formulaHint);
      let fullResponse = '';
      
      await generateStream(settings, prompt, pageImages, (chunk) => {
        fullResponse += chunk;
        setExplanation(fullResponse);
      });

      toast.success('公式讲解完成！');
    } catch (error) {
      console.error('讲解公式失败:', error);
      toast.error('讲解失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [pageImages, settings, toast]);

  // AI 讲解公式（LaTeX 输入）
  const handleExplainFormula = useCallback(async (latex: string, context?: string) => {
    if (!latex.trim()) {
      toast.warning('请输入公式');
      return;
    }
    if (!settings.apiKey && settings.provider !== 'ollama') {
      toast.warning('请先配置 API Key');
      return;
    }

    setIsGenerating(true);
    setExplanation('');
    setViewMode('explain');
    
    try {
      const prompt = PROMPTS.EXPLAIN_FORMULA(latex, context);
      let fullResponse = '';
      
      await generateStream(settings, prompt, [], (chunk) => {
        fullResponse += chunk;
        setExplanation(fullResponse);
      });

      toast.success('公式讲解完成！');
    } catch (error) {
      console.error('讲解公式失败:', error);
      toast.error('讲解失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [settings, toast]);

  // 从 PDF 页面图片提取公式（视觉识别）
  const handleExtractFormulasFromPDF = useCallback(async () => {
    if (!pageImages || pageImages.length === 0) {
      toast.warning('请先上传 PDF 文件');
      return;
    }
    if (!settings.apiKey && settings.provider !== 'ollama') {
      toast.warning('请先配置 API Key');
      return;
    }

    setIsGenerating(true);
    
    try {
      // 使用视觉识别从图片中提取公式
      const prompt = PROMPTS.EXTRACT_FORMULAS_FROM_IMAGE();
      let fullResponse = '';
      
      // 传入页面图片进行视觉分析
      await generateStream(settings, prompt, pageImages, (chunk) => {
        fullResponse += chunk;
      });

      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.formulas && Array.isArray(parsed.formulas)) {
          const newFormulas: Formula[] = parsed.formulas.map((f: any, index: number) => ({
            id: `${Date.now()}-${index}`,
            latex: f.latex,
            name: f.name,
            category: f.category || 'other',
            difficulty: f.difficulty || 'intermediate',
            variables: f.variables || [],
            tags: [],
            fileId: currentFileId,
            fileName: currentFileName,
            pageNumber: currentPageRange?.[0],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }));

          saveFormulas(newFormulas);
          setFormulas(getFormulas());
          toast.success(`✨ 从 PDF 成功提取 ${newFormulas.length} 个公式！`);
        } else {
          toast.info('未在当前页面检测到公式');
        }
      }
    } catch (error) {
      console.error('提取公式失败:', error);
      toast.error('提取失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [pageImages, settings, currentFileId, currentFileName, currentPageRange, toast]);

  // 从文本内容提取公式（备用方法）
  const handleExtractFormulasFromText = useCallback(async () => {
    if (!currentContent) {
      toast.warning('请先进行课件讲解');
      return;
    }
    if (!settings.apiKey && settings.provider !== 'ollama') {
      toast.warning('请先配置 API Key');
      return;
    }

    setIsGenerating(true);
    
    try {
      const prompt = PROMPTS.EXTRACT_FORMULAS(currentContent);
      let fullResponse = '';
      
      await generateStream(settings, prompt, [], (chunk) => {
        fullResponse += chunk;
      });

      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.formulas && Array.isArray(parsed.formulas)) {
          const newFormulas: Formula[] = parsed.formulas.map((f: any, index: number) => ({
            id: `${Date.now()}-${index}`,
            latex: f.latex,
            name: f.name,
            category: f.category || 'other',
            difficulty: f.difficulty || 'intermediate',
            variables: f.variables || [],
            tags: [],
            fileId: currentFileId,
            fileName: currentFileName,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }));

          saveFormulas(newFormulas);
          setFormulas(getFormulas());
          toast.success(`✨ 成功提取 ${newFormulas.length} 个公式！`);
        }
      }
    } catch (error) {
      console.error('提取公式失败:', error);
      toast.error('提取失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [currentContent, settings, currentFileId, currentFileName, toast]);

  // 保存公式
  const handleSaveFormula = useCallback(() => {
    if (!inputLatex.trim()) {
      toast.warning('请输入公式');
      return;
    }

    const newFormula: Formula = {
      id: selectedFormula?.id || Date.now().toString(),
      latex: inputLatex.trim(),
      name: inputName.trim() || undefined,
      category: inputCategory as any,
      difficulty: inputDifficulty as any,
      tags: inputTags.split(',').map(t => t.trim()).filter(Boolean),
      explanation: selectedFormula?.explanation,
      fileId: currentFileId,
      fileName: currentFileName,
      createdAt: selectedFormula?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    saveFormula(newFormula);
    setFormulas(getFormulas());
    resetForm();
    setViewMode('list');
    toast.success('公式已保存');
  }, [inputLatex, inputName, inputCategory, inputDifficulty, inputTags, selectedFormula, currentFileId, currentFileName, toast]);

  // 删除公式
  const handleDeleteFormula = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('确定删除这个公式吗？')) {
      deleteFormula(id);
      setFormulas(getFormulas());
      toast.success('公式已删除');
    }
  }, [toast]);

  // 复制公式
  const handleCopyLatex = useCallback(async (latex: string) => {
    const success = await copy(latex);
    if (success) {
      toast.success('已复制 LaTeX 代码');
    }
  }, [copy, toast]);

  // 重置表单
  const resetForm = useCallback(() => {
    setInputLatex('');
    setInputName('');
    setInputCategory('math');
    setInputDifficulty('intermediate');
    setInputTags('');
    setSelectedFormula(null);
  }, []);

  // 打开创建模式
  const openCreateMode = useCallback(() => {
    resetForm();
    setViewMode('create');
  }, [resetForm]);

  // 打开详情模式
  const openDetail = useCallback((formula: Formula) => {
    setSelectedFormula(formula);
    setViewMode('detail');
  }, []);

  // 编辑公式
  const openEditMode = useCallback((formula: Formula) => {
    setSelectedFormula(formula);
    setInputLatex(formula.latex);
    setInputName(formula.name || '');
    setInputCategory(formula.category || 'math');
    setInputDifficulty(formula.difficulty || 'intermediate');
    setInputTags(formula.tags.join(', '));
    setViewMode('create');
  }, []);

  // 快速讲解
  const quickExplain = useCallback((formula: Formula) => {
    setSelectedFormula(formula);
    setInputLatex(formula.latex);
    handleExplainFormula(formula.latex);
  }, [handleExplainFormula]);

  if (!isOpen) return null;

  return (
    <div className="w-[480px] bg-white border-l border-gray-200 flex flex-col h-full shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-blue-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Calculator size={20} />
            <h2 className="font-bold">公式讲解</h2>
          </div>
          <button onClick={onToggle} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-white/70 mt-1">
          {stats.total} 个公式 · AI 深度解析
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {viewMode === 'list' && (
          <>
            {/* Actions */}
            <div className="p-3 border-b border-gray-100 space-y-2">
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={handleExtractFormulasFromPDF}
                  disabled={isGenerating || !pageImages || pageImages.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700"
                  title={!pageImages || pageImages.length === 0 ? '请先上传 PDF' : `从第 ${currentPageRange?.[0] || 1}-${currentPageRange?.[1] || 1} 页提取`}
                >
                  {isGenerating ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Sparkles size={14} className="mr-1" />
                      从PDF提取公式
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={openCreateMode}
                >
                  <Plus size={14} className="mr-1" />
                  手动输入
                </Button>
              </div>
              
              {/* 直接讲解按钮 */}
              {pageImages && pageImages.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleExplainFromPDF()}
                  disabled={isGenerating}
                  className="w-full justify-center"
                >
                  <BookOpen size={14} className="mr-1" />
                  直接讲解当前页面公式
                </Button>
              )}
              
              {/* 当前页面提示 */}
              {pageImages && pageImages.length > 0 && (
                <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg flex items-center gap-2">
                  <span>📄 当前分析：第 {currentPageRange?.[0] || 1} - {currentPageRange?.[1] || 1} 页</span>
                  <span className="text-indigo-500">({pageImages.length} 张图片)</span>
                </div>
              )}
              
              {!pageImages || pageImages.length === 0 ? (
                <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  ⚠️ 请先上传 PDF 文件以启用公式提取功能
                </div>
              ) : null}

              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索公式..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="px-3 py-2 border-b border-gray-100 flex gap-1 flex-wrap">
              <button
                onClick={() => setFilterCategory(null)}
                className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                  filterCategory === null 
                    ? 'bg-indigo-100 text-indigo-700' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setFilterCategory(key)}
                  className={`px-2 py-0.5 text-xs rounded-full transition-colors flex items-center gap-1 ${
                    filterCategory === key 
                      ? config.color
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {config.icon}
                  {config.label}
                  {stats.byCategory[key] ? ` (${stats.byCategory[key]})` : ''}
                </button>
              ))}
            </div>

            {/* Formula List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredFormulas.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <Calculator size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="font-medium">还没有公式</p>
                  <p className="text-sm mt-1">点击"输入公式"添加</p>
                </div>
              ) : (
                filteredFormulas.map(formula => (
                  <div 
                    key={formula.id}
                    className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors group cursor-pointer"
                    onClick={() => openDetail(formula)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        {formula.name && (
                          <p className="font-medium text-gray-800 text-sm mb-1">{formula.name}</p>
                        )}
                        <div className="bg-white rounded p-2 border border-gray-200 overflow-x-auto">
                          <LatexRenderer latex={formula.latex} />
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); quickExplain(formula); }}
                          className="p-1 hover:bg-indigo-100 rounded text-indigo-600"
                          title="AI讲解"
                        >
                          <Sparkles size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCopyLatex(formula.latex); }}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="复制LaTeX"
                        >
                          <Copy size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); openEditMode(formula); }}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="编辑"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteFormula(formula.id, e)}
                          className="p-1 hover:bg-red-100 rounded text-red-500"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {formula.category && (
                        <span className={`px-1.5 py-0.5 text-[10px] rounded flex items-center gap-0.5 ${CATEGORY_CONFIG[formula.category as keyof typeof CATEGORY_CONFIG]?.color || 'bg-gray-100'}`}>
                          {CATEGORY_CONFIG[formula.category as keyof typeof CATEGORY_CONFIG]?.label || formula.category}
                        </span>
                      )}
                      {formula.difficulty && (
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${DIFFICULTY_CONFIG[formula.difficulty as keyof typeof DIFFICULTY_CONFIG]?.color || 'bg-gray-100'}`}>
                          {DIFFICULTY_CONFIG[formula.difficulty as keyof typeof DIFFICULTY_CONFIG]?.label || formula.difficulty}
                        </span>
                      )}
                      {formula.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-gray-200 text-gray-600 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {viewMode === 'create' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-800">
                {selectedFormula ? '编辑公式' : '添加公式'}
              </h3>
              <button onClick={() => { resetForm(); setViewMode('list'); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LaTeX 公式 *
              </label>
              <textarea
                value={inputLatex}
                onChange={(e) => setInputLatex(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm"
                rows={3}
                placeholder="例如: E = mc^2 或 \int_0^1 x^2 dx"
              />
              {inputLatex && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                  <p className="text-xs text-gray-500 mb-2">预览：</p>
                  <LatexRenderer latex={inputLatex} />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                公式名称（可选）
              </label>
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="例如: 爱因斯坦质能方程"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                <select
                  value={inputCategory}
                  onChange={(e) => setInputCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">难度</label>
                <select
                  value={inputDifficulty}
                  onChange={(e) => setInputDifficulty(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                标签（用逗号分隔）
              </label>
              <input
                type="text"
                value={inputTags}
                onChange={(e) => setInputTags(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="例如: 相对论, 能量"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="primary"
                onClick={handleSaveFormula}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                保存公式
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExplainFormula(inputLatex)}
                disabled={!inputLatex.trim() || isGenerating}
              >
                <Sparkles size={14} className="mr-1" />
                AI讲解
              </Button>
            </div>
          </div>
        )}

        {viewMode === 'explain' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-800">公式讲解</h3>
              <button onClick={() => setViewMode('list')} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* 公式展示 */}
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100">
              <LatexRenderer latex={inputLatex || selectedFormula?.latex || ''} />
            </div>

            {/* 讲解内容 */}
            <div className="prose prose-sm max-w-none">
              {isGenerating ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="animate-spin h-4 w-4 border-2 border-indigo-400 border-t-transparent rounded-full" />
                  <span>正在生成讲解...</span>
                </div>
              ) : null}
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {explanation || '正在分析公式...'}
                </ReactMarkdown>
              </div>
            </div>

            {/* 保存按钮 */}
            {!isGenerating && explanation && (
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="primary"
                  onClick={() => {
                    if (selectedFormula) {
                      saveFormula({ ...selectedFormula, explanation, updatedAt: Date.now() });
                      setFormulas(getFormulas());
                      toast.success('讲解已保存到公式库');
                    }
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                >
                  保存到公式库
                </Button>
                <Button
                  variant="outline"
                  onClick={() => copy(explanation)}
                >
                  <Copy size={14} className="mr-1" />
                  复制
                </Button>
              </div>
            )}
          </div>
        )}

        {viewMode === 'detail' && selectedFormula && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-800">{selectedFormula.name || '公式详情'}</h3>
              <button onClick={() => setViewMode('list')} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* 公式展示 */}
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100">
              <LatexRenderer latex={selectedFormula.latex} />
            </div>

            {/* 元信息 */}
            <div className="flex gap-2 flex-wrap">
              {selectedFormula.category && (
                <span className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${CATEGORY_CONFIG[selectedFormula.category as keyof typeof CATEGORY_CONFIG]?.color}`}>
                  {CATEGORY_CONFIG[selectedFormula.category as keyof typeof CATEGORY_CONFIG]?.icon}
                  {CATEGORY_CONFIG[selectedFormula.category as keyof typeof CATEGORY_CONFIG]?.label}
                </span>
              )}
              {selectedFormula.difficulty && (
                <span className={`px-2 py-1 text-xs rounded ${DIFFICULTY_CONFIG[selectedFormula.difficulty as keyof typeof DIFFICULTY_CONFIG]?.color}`}>
                  {DIFFICULTY_CONFIG[selectedFormula.difficulty as keyof typeof DIFFICULTY_CONFIG]?.label}
                </span>
              )}
            </div>

            {/* 已保存的讲解 */}
            {selectedFormula.explanation ? (
              <div className="prose prose-sm max-w-none markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedFormula.explanation}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <HelpCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">还没有讲解内容</p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => quickExplain(selectedFormula)}
                  className="mt-3 bg-indigo-600 hover:bg-indigo-700"
                >
                  <Sparkles size={14} className="mr-1" />
                  生成AI讲解
                </Button>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => quickExplain(selectedFormula)}
              >
                <Sparkles size={14} className="mr-1" />
                重新讲解
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopyLatex(selectedFormula.latex)}
              >
                <Copy size={14} className="mr-1" />
                复制LaTeX
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditMode(selectedFormula)}
              >
                <Edit3 size={14} className="mr-1" />
                编辑
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

