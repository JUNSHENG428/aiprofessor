import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { 
  Database, Search, Plus, Sparkles, X, Tag, Trash2, Edit3,
  ChevronDown, ChevronRight, AlertCircle, Star, Zap, BookOpen, Link2
} from 'lucide-react';
import { KnowledgeConcept, AppSettings } from '../types';
import { 
  getKnowledgeConcepts, saveKnowledgeConcept, saveKnowledgeConcepts,
  deleteKnowledgeConcept, searchKnowledge, getKnowledgeTags 
} from '../services/storageService';
import { generateStream } from '../services/aiService';
import { PROMPTS } from '../constants';
import { Button } from './Button';
import { useToast } from './Toast';
import { useDebounce } from '../hooks/useOptimized';

interface KnowledgeBasePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  settings: AppSettings;
  currentContent?: string;
  currentFileId?: string;
  currentFileName?: string;
  currentPageNumber?: number;
  // PDF 页面图片（用于视觉识别）
  pageImages?: string[];
  currentPageRange?: [number, number];
}

type ViewMode = 'list' | 'detail' | 'create' | 'edit';

// 重要程度配置
const IMPORTANCE_CONFIG = {
  critical: { label: '核心', color: 'bg-red-100 text-red-700 border-red-200', icon: '🔴' },
  high: { label: '重要', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: '🟠' },
  medium: { label: '一般', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: '🔵' },
  low: { label: '了解', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: '⚪' }
};

export const KnowledgeBasePanel: React.FC<KnowledgeBasePanelProps> = ({
  isOpen,
  onToggle,
  settings,
  currentContent,
  currentFileId,
  currentFileName,
  currentPageNumber,
  pageImages,
  currentPageRange
}) => {
  const [concepts, setConcepts] = useState<KnowledgeConcept[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedConcept, setSelectedConcept] = useState<KnowledgeConcept | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterImportance, setFilterImportance] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // 表单状态
  const [formTitle, setFormTitle] = useState('');
  const [formDefinition, setFormDefinition] = useState('');
  const [formDetails, setFormDetails] = useState('');
  const [formExamples, setFormExamples] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formImportance, setFormImportance] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  
  const toast = useToast();
  const debouncedSearch = useDebounce(searchQuery, 300);

  // 加载知识概念
  useEffect(() => {
    if (isOpen) {
      setConcepts(getKnowledgeConcepts());
    }
  }, [isOpen]);

  // 获取所有标签
  const allTags = useMemo(() => getKnowledgeTags(), [concepts]);

  // 过滤和搜索
  const filteredConcepts = useMemo(() => {
    let result = concepts;
    
    // 搜索过滤
    if (searchQuery.trim()) {
      result = searchKnowledge(searchQuery);
    }
    
    // 标签过滤
    if (filterTag) {
      result = result.filter(c => c.tags.includes(filterTag));
    }
    
    // 重要程度过滤
    if (filterImportance) {
      result = result.filter(c => c.importance === filterImportance);
    }
    
    return result;
  }, [concepts, searchQuery, filterTag, filterImportance]);

  // 按重要程度分组
  const groupedConcepts = useMemo(() => {
    const groups: Record<string, KnowledgeConcept[]> = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };
    
    filteredConcepts.forEach(c => {
      groups[c.importance].push(c);
    });
    
    return groups;
  }, [filteredConcepts]);

  // 切换展开
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // AI 提取知识概念
  // 从 PDF 页面图片提取知识点
  const handleExtractFromPDF = useCallback(async () => {
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
      const prompt = PROMPTS.EXTRACT_KNOWLEDGE_FROM_IMAGE();
      let fullResponse = '';
      
      await generateStream(settings, prompt, pageImages, (chunk) => {
        fullResponse += chunk;
      });

      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        if (parsed.concepts && Array.isArray(parsed.concepts)) {
          const newConcepts: KnowledgeConcept[] = parsed.concepts.map((c: any, index: number) => ({
            id: `${Date.now()}-${index}`,
            title: c.title,
            definition: c.content || c.definition || '',
            details: c.latex ? `公式: $${c.latex}$` : '',
            examples: [],
            tags: c.tags || [],
            fileId: currentFileId,
            fileName: currentFileName,
            pageNumber: currentPageRange?.[0],
            importance: c.importance || 'medium',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }));

          saveKnowledgeConcepts(newConcepts);
          setConcepts(getKnowledgeConcepts());
          toast.success(`✨ 从 PDF 成功提取 ${newConcepts.length} 个知识点！`);
        }
      }
    } catch (error) {
      console.error('提取知识失败:', error);
      toast.error('提取失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [pageImages, settings, currentFileId, currentFileName, currentPageRange, toast]);

  // 从文本内容提取知识点（备用）
  const handleExtractKnowledge = useCallback(async () => {
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
      const prompt = PROMPTS.EXTRACT_KNOWLEDGE(currentContent);
      let fullResponse = '';
      
      await generateStream(settings, prompt, [], (chunk) => {
        fullResponse += chunk;
      });

      // 解析 JSON 响应
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        if (parsed.concepts && Array.isArray(parsed.concepts)) {
          const newConcepts: KnowledgeConcept[] = parsed.concepts.map((c: any, index: number) => ({
            id: `${Date.now()}-${index}`,
            title: c.title,
            definition: c.definition,
            details: c.details || '',
            examples: c.examples || [],
            tags: c.tags || [],
            fileId: currentFileId,
            fileName: currentFileName,
            pageNumber: currentPageNumber,
            importance: c.importance || 'medium',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }));

          saveKnowledgeConcepts(newConcepts);
          setConcepts(getKnowledgeConcepts());
          alert(`✨ 成功提取 ${newConcepts.length} 个知识概念！`);
        }
      }
    } catch (error) {
      console.error('提取知识失败:', error);
      alert('提取知识失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [currentContent, settings, currentFileId, currentFileName, currentPageNumber]);

  // 创建概念
  const handleCreateConcept = useCallback(() => {
    if (!formTitle.trim() || !formDefinition.trim()) {
      alert('请填写标题和定义');
      return;
    }

    const newConcept: KnowledgeConcept = {
      id: Date.now().toString(),
      title: formTitle.trim(),
      definition: formDefinition.trim(),
      details: formDetails.trim() || undefined,
      examples: formExamples.split('\n').map(e => e.trim()).filter(Boolean),
      tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
      fileId: currentFileId,
      fileName: currentFileName,
      pageNumber: currentPageNumber,
      importance: formImportance,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    saveKnowledgeConcept(newConcept);
    setConcepts(getKnowledgeConcepts());
    resetForm();
    setViewMode('list');
  }, [formTitle, formDefinition, formDetails, formExamples, formTags, formImportance, currentFileId, currentFileName, currentPageNumber]);

  // 更新概念
  const handleUpdateConcept = useCallback(() => {
    if (!selectedConcept || !formTitle.trim() || !formDefinition.trim()) return;

    const updatedConcept: KnowledgeConcept = {
      ...selectedConcept,
      title: formTitle.trim(),
      definition: formDefinition.trim(),
      details: formDetails.trim() || undefined,
      examples: formExamples.split('\n').map(e => e.trim()).filter(Boolean),
      tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
      importance: formImportance,
      updatedAt: Date.now()
    };

    saveKnowledgeConcept(updatedConcept);
    setConcepts(getKnowledgeConcepts());
    setSelectedConcept(null);
    resetForm();
    setViewMode('list');
  }, [selectedConcept, formTitle, formDefinition, formDetails, formExamples, formTags, formImportance]);

  // 删除概念
  const handleDeleteConcept = useCallback((conceptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个知识点吗？')) {
      deleteKnowledgeConcept(conceptId);
      setConcepts(getKnowledgeConcepts());
    }
  }, []);

  // 重置表单
  const resetForm = useCallback(() => {
    setFormTitle('');
    setFormDefinition('');
    setFormDetails('');
    setFormExamples('');
    setFormTags('');
    setFormImportance('medium');
  }, []);

  // 打开编辑模式
  const openEditMode = useCallback((concept: KnowledgeConcept) => {
    setSelectedConcept(concept);
    setFormTitle(concept.title);
    setFormDefinition(concept.definition);
    setFormDetails(concept.details || '');
    setFormExamples(concept.examples?.join('\n') || '');
    setFormTags(concept.tags.join(', '));
    setFormImportance(concept.importance);
    setViewMode('edit');
  }, []);

  // 打开创建模式
  const openCreateMode = useCallback(() => {
    setSelectedConcept(null);
    resetForm();
    setViewMode('create');
  }, [resetForm]);

  // 查看详情
  const viewDetail = useCallback((concept: KnowledgeConcept) => {
    setSelectedConcept(concept);
    setViewMode('detail');
  }, []);

  if (!isOpen) return null;

  return (
    <div className="w-[420px] bg-white border-l border-gray-200 flex flex-col h-full shadow-xl flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-amber-500 to-orange-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Database size={20} />
            <h2 className="font-bold">知识库</h2>
          </div>
          <button onClick={onToggle} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-white/70 mt-1">
          {concepts.length} 个知识概念
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {viewMode === 'list' && (
          <>
            {/* Search & Actions */}
            <div className="p-3 border-b border-gray-100 space-y-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索知识点..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={handleExtractFromPDF}
                  disabled={isGenerating || !pageImages || pageImages.length === 0}
                  className="bg-amber-600 hover:bg-amber-700"
                  title={!pageImages || pageImages.length === 0 ? '请先上传 PDF' : `从第 ${currentPageRange?.[0] || 1}-${currentPageRange?.[1] || 1} 页提取`}
                >
                  {isGenerating ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Sparkles size={14} className="mr-1" />
                      从PDF提取
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={openCreateMode}>
                  <Plus size={14} className="mr-1" />
                  新建
                </Button>
              </div>
              
              {/* PDF 页面提示 */}
              {pageImages && pageImages.length > 0 && (
                <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                  📄 当前分析：第 {currentPageRange?.[0] || 1} - {currentPageRange?.[1] || 1} 页
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="px-3 py-2 border-b border-gray-100 space-y-2">
              {/* Importance Filter */}
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setFilterImportance(null)}
                  className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                    filterImportance === null 
                      ? 'bg-amber-100 text-amber-700' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  全部
                </button>
                {Object.entries(IMPORTANCE_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setFilterImportance(key)}
                    className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                      filterImportance === key 
                        ? config.color
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {config.icon} {config.label}
                  </button>
                ))}
              </div>

              {/* Tags Filter */}
              {allTags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {allTags.slice(0, 6).map(({ name, count }) => (
                    <button
                      key={name}
                      onClick={() => setFilterTag(filterTag === name ? null : name)}
                      className={`px-2 py-0.5 text-xs rounded-full transition-colors flex items-center gap-1 ${
                        filterTag === name 
                          ? 'bg-amber-100 text-amber-700' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Tag size={10} />
                      {name}
                      <span className="opacity-60">({count})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Concept List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {filteredConcepts.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <Database size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="font-medium">知识库为空</p>
                  <p className="text-sm mt-1">点击"AI提取"或"新建"添加知识点</p>
                </div>
              ) : (
                Object.entries(groupedConcepts).map(([importance, items]) => {
                  if (items.length === 0) return null;
                  const config = IMPORTANCE_CONFIG[importance as keyof typeof IMPORTANCE_CONFIG];
                  
                  return (
                    <div key={importance}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm">{config.icon}</span>
                        <span className="text-xs font-medium text-gray-500">{config.label}（{items.length}）</span>
                      </div>
                      <div className="space-y-2">
                        {items.map(concept => (
                          <div 
                            key={concept.id}
                            className={`rounded-lg border p-3 hover:shadow-md cursor-pointer transition-all ${config.color}`}
                          >
                            <div className="flex justify-between items-start">
                              <div 
                                className="flex-1 min-w-0"
                                onClick={() => toggleExpand(concept.id)}
                              >
                                <div className="flex items-center gap-2">
                                  {expandedIds.has(concept.id) 
                                    ? <ChevronDown size={14} /> 
                                    : <ChevronRight size={14} />
                                  }
                                  <p className="font-medium text-sm">{concept.title}</p>
                                </div>
                                <p className="text-xs mt-1 opacity-80 line-clamp-2 ml-5">
                                  {concept.definition}
                                </p>
                              </div>
                              <div className="flex gap-1 ml-2">
                                <button 
                                  onClick={() => openEditMode(concept)}
                                  className="p-1 hover:bg-white/50 rounded"
                                >
                                  <Edit3 size={12} />
                                </button>
                                <button 
                                  onClick={(e) => handleDeleteConcept(concept.id, e)}
                                  className="p-1 hover:bg-white/50 rounded"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedIds.has(concept.id) && (
                              <div className="mt-3 ml-5 space-y-2 text-xs">
                                {concept.details && (
                                  <div>
                                    <p className="font-medium opacity-70">详细说明：</p>
                                    <p className="opacity-90 whitespace-pre-wrap">{concept.details}</p>
                                  </div>
                                )}
                                {concept.examples && concept.examples.length > 0 && (
                                  <div>
                                    <p className="font-medium opacity-70">示例：</p>
                                    <ul className="list-disc list-inside opacity-90">
                                      {concept.examples.map((ex, i) => (
                                        <li key={i}>{ex}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                <div className="flex gap-1 flex-wrap pt-1">
                                  {concept.tags.map(tag => (
                                    <span key={tag} className="px-1.5 py-0.5 bg-white/50 rounded text-[10px]">
                                      {tag}
                                    </span>
                                  ))}
                                  {concept.fileName && (
                                    <span className="px-1.5 py-0.5 bg-white/50 rounded text-[10px] flex items-center gap-0.5">
                                      <BookOpen size={10} />
                                      {concept.fileName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {(viewMode === 'create' || viewMode === 'edit') && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-800">
                {viewMode === 'create' ? '新建知识点' : '编辑知识点'}
              </h3>
              <button 
                onClick={() => setViewMode('list')}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                标题 *
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="概念名称"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                定义 *
              </label>
              <textarea
                value={formDefinition}
                onChange={(e) => setFormDefinition(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                rows={2}
                placeholder="简洁的定义"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                详细说明
              </label>
              <textarea
                value={formDetails}
                onChange={(e) => setFormDetails(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="更详细的解释"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                示例（每行一个）
              </label>
              <textarea
                value={formExamples}
                onChange={(e) => setFormExamples(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                rows={2}
                placeholder="示例1&#10;示例2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                重要程度
              </label>
              <div className="flex gap-2">
                {Object.entries(IMPORTANCE_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setFormImportance(key as any)}
                    className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                      formImportance === key
                        ? config.color + ' border-2'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {config.icon} {config.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                标签（用逗号分隔）
              </label>
              <input
                type="text"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="例如: 数学, 微积分"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="primary"
                onClick={viewMode === 'create' ? handleCreateConcept : handleUpdateConcept}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                {viewMode === 'create' ? '创建' : '保存'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setViewMode('list')}
              >
                取消
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

