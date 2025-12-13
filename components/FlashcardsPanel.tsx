import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { MarkdownView } from './MarkdownView';
import { 
  Layers, Plus, Brain, RotateCcw, Check, X, ChevronLeft, ChevronRight,
  Sparkles, Trash2, Edit3, Clock, Target, Zap, BookOpen, Filter
} from 'lucide-react';
import { Flashcard, ReviewRating, AppSettings } from '../types';
import { 
  getFlashcards, saveFlashcard, saveFlashcards, deleteFlashcard, 
  getDueFlashcards, updateFlashcardReview, getFlashcardStats 
} from '../services/storageService';
import { generateStream } from '../services/aiService';
import { PROMPTS } from '../constants';
import { Button } from './Button';
import { useToast } from './Toast';
import { useDebounce, useHotkey, useClipboard } from '../hooks/useOptimized';

// 闪卡中的“短文本 + 公式”渲染：使用 inline 模式避免额外换行影响布局
const FormulaText: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <MarkdownView content={text} className={className} inline />
);

interface FlashcardsPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  settings: AppSettings;
  currentContent?: string; // 当前讲解内容，用于生成闪卡
  currentFileId?: string;
  currentFileName?: string;
}

type ViewMode = 'list' | 'review' | 'create' | 'edit';

export const FlashcardsPanel: React.FC<FlashcardsPanelProps> = ({
  isOpen,
  onToggle,
  settings,
  currentContent,
  currentFileId,
  currentFileName
}) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedCard, setSelectedCard] = useState<Flashcard | null>(null);
  const [reviewQueue, setReviewQueue] = useState<Flashcard[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  
  // 创建/编辑表单状态
  const [formFront, setFormFront] = useState('');
  const [formBack, setFormBack] = useState('');
  const [formTags, setFormTags] = useState('');

  // 加载闪卡
  useEffect(() => {
    if (isOpen) {
      setCards(getFlashcards());
    }
  }, [isOpen]);

  const toast = useToast();
  const { copy } = useClipboard();

  // 键盘快捷键
  useHotkey('escape', () => {
    if (viewMode !== 'list') setViewMode('list');
  }, [viewMode]);

  useHotkey('space', () => {
    if (viewMode === 'review') setIsFlipped(!isFlipped);
  }, [viewMode, isFlipped]);

  // 使用 useMemo 优化计算
  const memoizedStats = useMemo(() => getFlashcardStats(), [cards]);
  const memoizedAllTags = useMemo(() => [...new Set(cards.flatMap(c => c.tags))], [cards]);
  const memoizedFilteredCards = useMemo(() => 
    filterTag ? cards.filter(c => c.tags.includes(filterTag)) : cards
  , [cards, filterTag]);

  // 开始复习
  const startReview = useCallback(() => {
    const dueCards = getDueFlashcards();
    if (dueCards.length === 0) {
      toast.info('没有待复习的闪卡！');
      return;
    }
    setReviewQueue(dueCards);
    setCurrentReviewIndex(0);
    setIsFlipped(false);
    setViewMode('review');
  }, [toast]);

  // 处理复习评分
  const handleReviewRating = useCallback((rating: ReviewRating) => {
    const currentCard = reviewQueue[currentReviewIndex];
    if (!currentCard) return;

    updateFlashcardReview(currentCard.id, rating);
    
    if (currentReviewIndex < reviewQueue.length - 1) {
      setCurrentReviewIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      // 复习完成
      setViewMode('list');
      setCards(getFlashcards());
      toast.success('🎉 复习完成！');
    }
  }, [reviewQueue, currentReviewIndex, toast]);

  // 创建新闪卡
  const handleCreateCard = useCallback(() => {
    if (!formFront.trim() || !formBack.trim()) {
      toast.warning('请填写正面和背面内容');
      return;
    }

    const newCard: Flashcard = {
      id: Date.now().toString(),
      front: formFront.trim(),
      back: formBack.trim(),
      tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
      fileId: currentFileId,
      fileName: currentFileName,
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReview: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    saveFlashcard(newCard);
    setCards(getFlashcards());
    setFormFront('');
    setFormBack('');
    setFormTags('');
    setViewMode('list');
  }, [formFront, formBack, formTags, currentFileId, currentFileName, toast]);

  // 更新闪卡
  const handleUpdateCard = useCallback(() => {
    if (!selectedCard || !formFront.trim() || !formBack.trim()) return;

    const updatedCard: Flashcard = {
      ...selectedCard,
      front: formFront.trim(),
      back: formBack.trim(),
      tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
      updatedAt: Date.now()
    };

    saveFlashcard(updatedCard);
    setCards(getFlashcards());
    setSelectedCard(null);
    setViewMode('list');
  }, [selectedCard, formFront, formBack, formTags]);

  // 删除闪卡
  const handleDeleteCard = useCallback((cardId: string) => {
    if (window.confirm('确定要删除这张闪卡吗？')) {
      deleteFlashcard(cardId);
      setCards(getFlashcards());
      toast.success('闪卡已删除');
    }
  }, [toast]);

  // AI 生成闪卡
  const handleGenerateCards = useCallback(async () => {
    if (!currentContent) {
      toast.warning('请先进行课件讲解，然后再生成闪卡');
      return;
    }
    if (!settings.apiKey && settings.provider !== 'ollama') {
      toast.warning('请先配置 API Key');
      return;
    }

    setIsGenerating(true);
    
    try {
      const prompt = PROMPTS.GENERATE_FLASHCARDS(currentContent, 10);
      let fullResponse = '';
      
      await generateStream(settings, prompt, [], (chunk) => {
        fullResponse += chunk;
      });

      // 解析 JSON 响应
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
          const newCards: Flashcard[] = parsed.flashcards.map((fc: any, index: number) => ({
            id: `${Date.now()}-${index}`,
            front: fc.front,
            back: fc.back,
            tags: fc.tags || [],
            fileId: currentFileId,
            fileName: currentFileName,
            easeFactor: 2.5,
            interval: 0,
            repetitions: 0,
            nextReview: Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now()
          }));

          saveFlashcards(newCards);
          setCards(getFlashcards());
          toast.success(`✨ 成功生成 ${newCards.length} 张闪卡！`);
        }
      }
    } catch (error) {
      console.error('生成闪卡失败:', error);
      toast.error('生成闪卡失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [currentContent, settings, currentFileId, currentFileName, toast]);

  // 打开编辑模式
  const openEditMode = useCallback((card: Flashcard) => {
    setSelectedCard(card);
    setFormFront(card.front);
    setFormBack(card.back);
    setFormTags(card.tags.join(', '));
    setViewMode('edit');
  }, []);

  // 打开创建模式
  const openCreateMode = useCallback(() => {
    setSelectedCard(null);
    setFormFront('');
    setFormBack('');
    setFormTags('');
    setViewMode('create');
  }, []);

  if (!isOpen) return null;

  const currentReviewCard = reviewQueue[currentReviewIndex];

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-xl flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-violet-500 to-purple-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Layers size={20} />
            <h2 className="font-bold">智能闪卡</h2>
          </div>
          <button onClick={onToggle} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        {/* Stats */}
        <div className="flex gap-4 mt-3 text-xs text-white/90">
          <div className="flex items-center gap-1">
            <BookOpen size={14} />
            <span>{memoizedStats.total} 张</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={14} />
            <span>{memoizedStats.dueToday} 待复习</span>
          </div>
          <div className="flex items-center gap-1">
            <Target size={14} />
            <span>{memoizedStats.mastered} 已掌握</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {viewMode === 'list' && (
          <>
            {/* Actions */}
            <div className="p-3 border-b border-gray-100 flex gap-2 flex-wrap">
              <Button 
                variant="primary" 
                size="sm" 
                onClick={startReview}
                disabled={memoizedStats.dueToday === 0}
                className="bg-violet-600 hover:bg-violet-700"
              >
                <Brain size={14} className="mr-1" />
                开始复习 ({memoizedStats.dueToday})
              </Button>
              <Button variant="outline" size="sm" onClick={openCreateMode}>
                <Plus size={14} className="mr-1" />
                新建
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleGenerateCards}
                disabled={isGenerating || !currentContent}
                title={!currentContent ? '请先进行课件讲解' : ''}
              >
                {isGenerating ? (
                  <div className="animate-spin h-4 w-4 border-2 border-violet-400 border-t-transparent rounded-full" />
                ) : (
                  <>
                    <Sparkles size={14} className="mr-1" />
                    AI生成
                  </>
                )}
              </Button>
            </div>

            {/* Tags Filter */}
            {memoizedAllTags.length > 0 && (
              <div className="px-3 py-2 border-b border-gray-100 flex gap-1 flex-wrap">
                <button
                  onClick={() => setFilterTag(null)}
                  className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                    filterTag === null 
                      ? 'bg-violet-100 text-violet-700' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  全部
                </button>
                {memoizedAllTags.slice(0, 8).map(tag => (
                  <button
                    key={tag}
                    onClick={() => setFilterTag(tag)}
                    className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                      filterTag === tag 
                        ? 'bg-violet-100 text-violet-700' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* Card List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {memoizedFilteredCards.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <Layers size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="font-medium">还没有闪卡</p>
                  <p className="text-sm mt-1">点击"新建"或"AI生成"创建闪卡</p>
                </div>
              ) : (
                memoizedFilteredCards.map(card => (
                  <div 
                    key={card.id}
                    className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 text-sm line-clamp-2">
                          <FormulaText text={card.front} />
                        </div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                          <FormulaText text={card.back} />
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                        <button 
                          onClick={() => openEditMode(card)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <Edit3 size={14} className="text-gray-500" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCard(card.id)}
                          className="p-1 hover:bg-red-100 rounded"
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {card.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-violet-100 text-violet-600 rounded">
                          {tag}
                        </span>
                      ))}
                      {card.repetitions >= 5 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-600 rounded flex items-center gap-0.5">
                          <Check size={10} /> 已掌握
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {viewMode === 'review' && currentReviewCard && (
          <div className="flex-1 flex flex-col p-4">
            {/* Progress */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">
                {currentReviewIndex + 1} / {reviewQueue.length}
              </span>
              <button 
                onClick={() => setViewMode('list')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                退出复习
              </button>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-gray-200 rounded-full mb-6">
              <div 
                className="h-full bg-violet-500 rounded-full transition-all"
                style={{ width: `${((currentReviewIndex + 1) / reviewQueue.length) * 100}%` }}
              />
            </div>

            {/* Card */}
            <div 
              onClick={() => setIsFlipped(!isFlipped)}
              className="flex-1 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 flex items-center justify-center cursor-pointer shadow-lg hover:shadow-xl transition-all border border-violet-100"
              style={{ perspective: '1000px' }}
            >
              <div className={`text-center transition-all duration-300 ${isFlipped ? 'scale-y-[-1]' : ''}`}>
                {!isFlipped ? (
                  <div>
                    <p className="text-xs text-violet-500 mb-2 font-medium">问题</p>
                    <div className="text-lg font-medium text-gray-800 leading-relaxed">
                      <FormulaText text={currentReviewCard.front} />
                    </div>
                    <p className="text-xs text-gray-400 mt-4">点击查看答案</p>
                  </div>
                ) : (
                  <div style={{ transform: 'scaleY(-1)' }}>
                    <p className="text-xs text-green-500 mb-2 font-medium">答案</p>
                    <div className="text-lg font-medium text-gray-800 leading-relaxed whitespace-pre-wrap">
                      <FormulaText text={currentReviewCard.back} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Rating Buttons */}
            {isFlipped && (
              <div className="mt-6 space-y-3">
                <p className="text-center text-sm text-gray-500">你记得多少？</p>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => handleReviewRating(1)}
                    className="p-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    😵 忘了
                  </button>
                  <button
                    onClick={() => handleReviewRating(3)}
                    className="p-3 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    😅 困难
                  </button>
                  <button
                    onClick={() => handleReviewRating(4)}
                    className="p-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    😊 记得
                  </button>
                  <button
                    onClick={() => handleReviewRating(5)}
                    className="p-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    🎯 轻松
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {(viewMode === 'create' || viewMode === 'edit') && (
          <div className="flex-1 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-800">
                {viewMode === 'create' ? '新建闪卡' : '编辑闪卡'}
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
                正面（问题）
              </label>
              <textarea
                value={formFront}
                onChange={(e) => setFormFront(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="输入问题..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                背面（答案）
              </label>
              <textarea
                value={formBack}
                onChange={(e) => setFormBack(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                rows={4}
                placeholder="输入答案..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                标签（用逗号分隔）
              </label>
              <input
                type="text"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="例如: 数学, 线性代数"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="primary"
                onClick={viewMode === 'create' ? handleCreateCard : handleUpdateCard}
                className="flex-1 bg-violet-600 hover:bg-violet-700"
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

