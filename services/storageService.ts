/**
 * Storage Service - 优化的本地存储管理
 * 支持文件记录、会话记录、自动保存和存储空间管理
 */

import { FileRecord, Session, Message, ParsedPage, Flashcard, FlashcardDeck, MindMap, KnowledgeConcept, ReviewRating, Formula } from '../types';

// Storage keys
const KEYS = {
  FILES: 'ai_professor_files',
  SESSIONS: 'ai_professor_sessions',
  SETTINGS: 'ai_professor_settings',
  AUTO_SAVE: 'ai_professor_autosave',
  STORAGE_META: 'ai_professor_storage_meta',
  // 新增功能存储
  FLASHCARDS: 'ai_professor_flashcards',
  FLASHCARD_DECKS: 'ai_professor_flashcard_decks',
  MINDMAPS: 'ai_professor_mindmaps',
  KNOWLEDGE: 'ai_professor_knowledge',
  FORMULAS: 'ai_professor_formulas'
};

// Limits - 加大存储限制
const LIMITS = {
  MAX_FILES: 200,              // 增加到 200 个文件
  MAX_SESSIONS: 100,           // 增加到 100 个会话
  MAX_MESSAGES_PER_SESSION: 200, // 增加到 200 条消息
  MAX_IMAGE_SIZE_KB: 150,      // 增加图片大小到 150KB
  MAX_STORAGE_MB: 9,           // 增加到 9MB (IndexedDB 通常支持更大)
  AUTO_SAVE_INTERVAL: 30000    // 30 seconds
};

// Storage metadata
interface StorageMeta {
  lastCleanup: number;
  totalSize: number;
  version: string;
}

/**
 * Get current storage usage in bytes
 */
export const getStorageUsage = (): number => {
  let total = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length * 2; // UTF-16 encoding
    }
  }
  return total;
};

/**
 * Get storage usage percentage
 */
export const getStoragePercentage = (): number => {
  const used = getStorageUsage();
  const max = LIMITS.MAX_STORAGE_MB * 1024 * 1024;
  return Math.round((used / max) * 100);
};

/**
 * Compress base64 image by reducing quality
 */
const compressImage = async (base64: string, maxSizeKB: number = LIMITS.MAX_IMAGE_SIZE_KB): Promise<string> => {
  return new Promise((resolve) => {
    // If already small enough, return as is
    const currentSizeKB = (base64.length * 0.75) / 1024;
    if (currentSizeKB <= maxSizeKB) {
      resolve(base64);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      
      // Calculate new dimensions (reduce to max 400px width for thumbnails)
      const maxWidth = 400;
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64.substring(0, maxSizeKB * 1024));
        return;
      }
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Try different quality levels
      let quality = 0.6;
      let result = canvas.toDataURL('image/jpeg', quality);
      
      while ((result.length * 0.75) / 1024 > maxSizeKB && quality > 0.1) {
        quality -= 0.1;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      
      resolve(result);
    };
    
    img.onerror = () => {
      // If image loading fails, just truncate
      resolve(base64.substring(0, maxSizeKB * 1024));
    };
    
    img.src = base64;
  });
};

/**
 * Prepare session for storage (compress images, limit messages)
 */
const prepareSessionForStorage = async (session: Session): Promise<Session> => {
  // Limit messages
  const limitedMessages = session.messages.slice(-LIMITS.MAX_MESSAGES_PER_SESSION);
  
  // Process messages - compress any attached images
  const processedMessages: Message[] = await Promise.all(
    limitedMessages.map(async (msg) => {
      if (msg.images && msg.images.length > 0) {
        const compressedImages = await Promise.all(
          msg.images.slice(0, 5).map(img => compressImage(img, 50)) // Max 5 images, 50KB each
        );
        return { ...msg, images: compressedImages };
      }
      return msg;
    })
  );
  
  // Compress page preview images
  const processedPages: ParsedPage[] = await Promise.all(
    session.parsedPages.map(async (page) => {
      if (page.image) {
        const compressed = await compressImage(page.image, LIMITS.MAX_IMAGE_SIZE_KB);
        return { ...page, image: compressed };
      }
      return page;
    })
  );
  
  return {
    ...session,
    messages: processedMessages,
    parsedPages: processedPages
  };
};

/**
 * Save file record
 */
export const saveFileRecord = (file: FileRecord): void => {
  try {
    const files = getFileRecords();
    
    // Check if file already exists
    const existingIndex = files.findIndex(f => f.id === file.id);
    if (existingIndex >= 0) {
      files[existingIndex] = file;
    } else {
      files.unshift(file);
    }
    
    // Limit number of files
    const limitedFiles = files.slice(0, LIMITS.MAX_FILES);
    localStorage.setItem(KEYS.FILES, JSON.stringify(limitedFiles));
  } catch (e) {
    console.error('Failed to save file record:', e);
    cleanupOldData();
  }
};

/**
 * Get all file records
 */
export const getFileRecords = (): FileRecord[] => {
  try {
    const saved = localStorage.getItem(KEYS.FILES);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

/**
 * Delete file record and associated sessions
 */
export const deleteFileRecord = (fileId: string): void => {
  try {
    // Remove file
    const files = getFileRecords().filter(f => f.id !== fileId);
    localStorage.setItem(KEYS.FILES, JSON.stringify(files));
    
    // Remove associated sessions
    const sessions = getSessions().filter(s => s.fileId !== fileId);
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to delete file record:', e);
  }
};

/**
 * Save session with optimization
 */
export const saveSession = async (session: Session): Promise<boolean> => {
  try {
    // Prepare session for storage
    const optimizedSession = await prepareSessionForStorage(session);
    
    const sessions = getSessions();
    
    // Update existing or add new
    const existingIndex = sessions.findIndex(s => s.fileId === session.fileId);
    if (existingIndex >= 0) {
      sessions[existingIndex] = { 
        ...optimizedSession, 
        createdAt: sessions[existingIndex].createdAt,
        updatedAt: Date.now()
      };
    } else {
      sessions.unshift(optimizedSession);
    }
    
    // Limit sessions
    const limitedSessions = sessions.slice(0, LIMITS.MAX_SESSIONS);
    
    try {
      localStorage.setItem(KEYS.SESSIONS, JSON.stringify(limitedSessions));
      return true;
    } catch (e) {
      // Storage full - try with fewer sessions
      console.warn('Storage full, reducing sessions...');
      await cleanupOldData();
      
      // Try again with reduced data
      const reducedSessions = limitedSessions.slice(0, 10);
      localStorage.setItem(KEYS.SESSIONS, JSON.stringify(reducedSessions));
      return true;
    }
  } catch (e) {
    console.error('Failed to save session:', e);
    return false;
  }
};

/**
 * Get all sessions
 */
export const getSessions = (): Session[] => {
  try {
    const saved = localStorage.getItem(KEYS.SESSIONS);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

/**
 * Get session by file ID
 */
export const getSessionByFileId = (fileId: string): Session | undefined => {
  return getSessions().find(s => s.fileId === fileId);
};

/**
 * Delete session
 */
export const deleteSession = (sessionId: string): void => {
  try {
    const sessions = getSessions().filter(s => s.id !== sessionId);
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to delete session:', e);
  }
};

/**
 * Auto-save current state
 */
export const autoSave = async (data: {
  fileId: string;
  fileName: string;
  messages: Message[];
  parsedPages: ParsedPage[];
  currentBatch: [number, number];
}): Promise<void> => {
  if (!data.fileId || data.messages.length === 0) return;
  
  try {
    const autoSaveData = {
      ...data,
      savedAt: Date.now()
    };
    
    // Compress for auto-save
    const compressedPages = data.parsedPages.map(p => ({
      pageNumber: p.pageNumber,
      text: p.text.substring(0, 2000), // Limit text
      image: undefined // Don't save images in auto-save
    }));
    
    const limitedMessages = data.messages.slice(-50).map(m => ({
      ...m,
      images: undefined // Don't save images in auto-save
    }));
    
    localStorage.setItem(KEYS.AUTO_SAVE, JSON.stringify({
      ...autoSaveData,
      parsedPages: compressedPages,
      messages: limitedMessages
    }));
  } catch (e) {
    // Auto-save is best effort, don't throw
    console.warn('Auto-save failed:', e);
  }
};

/**
 * Get auto-saved data
 */
export const getAutoSave = (): any | null => {
  try {
    const saved = localStorage.getItem(KEYS.AUTO_SAVE);
    if (!saved) return null;
    
    const data = JSON.parse(saved);
    // Check if auto-save is recent (within 24 hours)
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(KEYS.AUTO_SAVE);
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

/**
 * Clear auto-save
 */
export const clearAutoSave = (): void => {
  localStorage.removeItem(KEYS.AUTO_SAVE);
};

/**
 * Cleanup old data to free space
 */
export const cleanupOldData = async (): Promise<void> => {
  try {
    // Remove old sessions (keep only recent 10)
    const sessions = getSessions();
    if (sessions.length > 10) {
      const recentSessions = sessions
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 10);
      localStorage.setItem(KEYS.SESSIONS, JSON.stringify(recentSessions));
    }
    
    // Remove old files (keep only recent 30)
    const files = getFileRecords();
    if (files.length > 30) {
      const recentFiles = files
        .sort((a, b) => b.uploadedAt - a.uploadedAt)
        .slice(0, 30);
      localStorage.setItem(KEYS.FILES, JSON.stringify(recentFiles));
    }
    
    // Update cleanup timestamp
    const meta: StorageMeta = {
      lastCleanup: Date.now(),
      totalSize: getStorageUsage(),
      version: '1.0'
    };
    localStorage.setItem(KEYS.STORAGE_META, JSON.stringify(meta));
    
    console.log('Storage cleanup complete. Usage:', getStoragePercentage() + '%');
  } catch (e) {
    console.error('Cleanup failed:', e);
  }
};

/**
 * Export all data as JSON
 */
export const exportAllData = (): string => {
  return JSON.stringify({
    files: getFileRecords(),
    sessions: getSessions(),
    exportedAt: Date.now()
  }, null, 2);
};

/**
 * Import data from JSON
 */
export const importData = (jsonString: string): boolean => {
  try {
    const data = JSON.parse(jsonString);
    
    if (data.files) {
      localStorage.setItem(KEYS.FILES, JSON.stringify(data.files));
    }
    if (data.sessions) {
      localStorage.setItem(KEYS.SESSIONS, JSON.stringify(data.sessions));
    }
    
    return true;
  } catch (e) {
    console.error('Import failed:', e);
    return false;
  }
};

/**
 * Get storage statistics
 */
export const getStorageStats = (): {
  usedMB: number;
  percentUsed: number;
  fileCount: number;
  sessionCount: number;
} => {
  return {
    usedMB: Math.round(getStorageUsage() / 1024 / 1024 * 100) / 100,
    percentUsed: getStoragePercentage(),
    fileCount: getFileRecords().length,
    sessionCount: getSessions().length
  };
};

// ===== 闪卡存储 =====

/**
 * 获取所有闪卡
 */
export const getFlashcards = (): Flashcard[] => {
  try {
    const saved = localStorage.getItem(KEYS.FLASHCARDS);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

/**
 * 保存闪卡
 */
export const saveFlashcard = (card: Flashcard): void => {
  try {
    const cards = getFlashcards();
    const existingIndex = cards.findIndex(c => c.id === card.id);
    if (existingIndex >= 0) {
      cards[existingIndex] = card;
    } else {
      cards.unshift(card);
    }
    localStorage.setItem(KEYS.FLASHCARDS, JSON.stringify(cards));
  } catch (e) {
    console.error('Failed to save flashcard:', e);
  }
};

/**
 * 批量保存闪卡
 */
export const saveFlashcards = (newCards: Flashcard[]): void => {
  try {
    const cards = getFlashcards();
    newCards.forEach(newCard => {
      const existingIndex = cards.findIndex(c => c.id === newCard.id);
      if (existingIndex >= 0) {
        cards[existingIndex] = newCard;
      } else {
        cards.unshift(newCard);
      }
    });
    localStorage.setItem(KEYS.FLASHCARDS, JSON.stringify(cards));
  } catch (e) {
    console.error('Failed to save flashcards:', e);
  }
};

/**
 * 删除闪卡
 */
export const deleteFlashcard = (cardId: string): void => {
  try {
    const cards = getFlashcards().filter(c => c.id !== cardId);
    localStorage.setItem(KEYS.FLASHCARDS, JSON.stringify(cards));
  } catch (e) {
    console.error('Failed to delete flashcard:', e);
  }
};

/**
 * 获取今日待复习的闪卡
 */
export const getDueFlashcards = (): Flashcard[] => {
  const now = Date.now();
  return getFlashcards().filter(card => card.nextReview <= now);
};

/**
 * SM-2 间隔重复算法 - 更新闪卡复习状态
 */
export const updateFlashcardReview = (cardId: string, rating: ReviewRating): Flashcard | null => {
  const cards = getFlashcards();
  const cardIndex = cards.findIndex(c => c.id === cardId);
  if (cardIndex < 0) return null;

  const card = cards[cardIndex];
  const now = Date.now();

  // SM-2 算法实现
  let newEaseFactor = card.easeFactor;
  let newInterval = card.interval;
  let newRepetitions = card.repetitions;

  if (rating >= 3) {
    // 正确回答
    if (newRepetitions === 0) {
      newInterval = 1;
    } else if (newRepetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(card.interval * card.easeFactor);
    }
    newRepetitions++;
  } else {
    // 错误回答 - 重置
    newRepetitions = 0;
    newInterval = 1;
  }

  // 更新难度因子
  newEaseFactor = Math.max(1.3, card.easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)));

  const updatedCard: Flashcard = {
    ...card,
    easeFactor: newEaseFactor,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReview: now + newInterval * 24 * 60 * 60 * 1000,
    lastReview: now,
    updatedAt: now
  };

  cards[cardIndex] = updatedCard;
  localStorage.setItem(KEYS.FLASHCARDS, JSON.stringify(cards));
  
  return updatedCard;
};

/**
 * 获取闪卡统计
 */
export const getFlashcardStats = (): {
  total: number;
  dueToday: number;
  mastered: number;
  learning: number;
} => {
  const cards = getFlashcards();
  const now = Date.now();
  
  return {
    total: cards.length,
    dueToday: cards.filter(c => c.nextReview <= now).length,
    mastered: cards.filter(c => c.repetitions >= 5).length,
    learning: cards.filter(c => c.repetitions > 0 && c.repetitions < 5).length
  };
};

// ===== 思维导图存储 =====

/**
 * 获取所有思维导图
 */
export const getMindMaps = (): MindMap[] => {
  try {
    const saved = localStorage.getItem(KEYS.MINDMAPS);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

/**
 * 保存思维导图
 */
export const saveMindMap = (mindmap: MindMap): void => {
  try {
    const maps = getMindMaps();
    const existingIndex = maps.findIndex(m => m.id === mindmap.id);
    if (existingIndex >= 0) {
      maps[existingIndex] = mindmap;
    } else {
      maps.unshift(mindmap);
    }
    localStorage.setItem(KEYS.MINDMAPS, JSON.stringify(maps));
  } catch (e) {
    console.error('Failed to save mindmap:', e);
  }
};

/**
 * 删除思维导图
 */
export const deleteMindMap = (mapId: string): void => {
  try {
    const maps = getMindMaps().filter(m => m.id !== mapId);
    localStorage.setItem(KEYS.MINDMAPS, JSON.stringify(maps));
  } catch (e) {
    console.error('Failed to delete mindmap:', e);
  }
};

// ===== 知识库存储 =====

/**
 * 获取所有知识概念
 */
export const getKnowledgeConcepts = (): KnowledgeConcept[] => {
  try {
    const saved = localStorage.getItem(KEYS.KNOWLEDGE);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

/**
 * 保存知识概念
 */
export const saveKnowledgeConcept = (concept: KnowledgeConcept): void => {
  try {
    const concepts = getKnowledgeConcepts();
    const existingIndex = concepts.findIndex(c => c.id === concept.id);
    if (existingIndex >= 0) {
      concepts[existingIndex] = concept;
    } else {
      concepts.unshift(concept);
    }
    localStorage.setItem(KEYS.KNOWLEDGE, JSON.stringify(concepts));
  } catch (e) {
    console.error('Failed to save concept:', e);
  }
};

/**
 * 批量保存知识概念
 */
export const saveKnowledgeConcepts = (newConcepts: KnowledgeConcept[]): void => {
  try {
    const concepts = getKnowledgeConcepts();
    newConcepts.forEach(newConcept => {
      const existingIndex = concepts.findIndex(c => c.id === newConcept.id);
      if (existingIndex >= 0) {
        concepts[existingIndex] = newConcept;
      } else {
        concepts.unshift(newConcept);
      }
    });
    localStorage.setItem(KEYS.KNOWLEDGE, JSON.stringify(concepts));
  } catch (e) {
    console.error('Failed to save concepts:', e);
  }
};

/**
 * 删除知识概念
 */
export const deleteKnowledgeConcept = (conceptId: string): void => {
  try {
    const concepts = getKnowledgeConcepts().filter(c => c.id !== conceptId);
    localStorage.setItem(KEYS.KNOWLEDGE, JSON.stringify(concepts));
  } catch (e) {
    console.error('Failed to delete concept:', e);
  }
};

/**
 * 搜索知识概念
 */
export const searchKnowledge = (query: string): KnowledgeConcept[] => {
  const concepts = getKnowledgeConcepts();
  const lowerQuery = query.toLowerCase();
  
  return concepts.filter(c => 
    c.title.toLowerCase().includes(lowerQuery) ||
    c.definition.toLowerCase().includes(lowerQuery) ||
    c.tags.some(t => t.toLowerCase().includes(lowerQuery))
  );
};

/**
 * 获取所有知识标签
 */
export const getKnowledgeTags = (): { name: string; count: number }[] => {
  const concepts = getKnowledgeConcepts();
  const tagCounts: Record<string, number> = {};
  
  concepts.forEach(c => {
    c.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  
  return Object.entries(tagCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

// ===== 公式存储 =====

/**
 * 获取所有公式
 */
export const getFormulas = (): Formula[] => {
  try {
    const saved = localStorage.getItem(KEYS.FORMULAS);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

/**
 * 保存公式
 */
export const saveFormula = (formula: Formula): void => {
  try {
    const formulas = getFormulas();
    const existingIndex = formulas.findIndex(f => f.id === formula.id);
    if (existingIndex >= 0) {
      formulas[existingIndex] = formula;
    } else {
      formulas.unshift(formula);
    }
    localStorage.setItem(KEYS.FORMULAS, JSON.stringify(formulas));
  } catch (e) {
    console.error('Failed to save formula:', e);
  }
};

/**
 * 批量保存公式
 */
export const saveFormulas = (newFormulas: Formula[]): void => {
  try {
    const formulas = getFormulas();
    newFormulas.forEach(newFormula => {
      const existingIndex = formulas.findIndex(f => f.id === newFormula.id);
      if (existingIndex >= 0) {
        formulas[existingIndex] = newFormula;
      } else {
        formulas.unshift(newFormula);
      }
    });
    localStorage.setItem(KEYS.FORMULAS, JSON.stringify(formulas));
  } catch (e) {
    console.error('Failed to save formulas:', e);
  }
};

/**
 * 删除公式
 */
export const deleteFormula = (formulaId: string): void => {
  try {
    const formulas = getFormulas().filter(f => f.id !== formulaId);
    localStorage.setItem(KEYS.FORMULAS, JSON.stringify(formulas));
  } catch (e) {
    console.error('Failed to delete formula:', e);
  }
};

/**
 * 搜索公式
 */
export const searchFormulas = (query: string): Formula[] => {
  const formulas = getFormulas();
  const lowerQuery = query.toLowerCase();
  
  return formulas.filter(f => 
    f.latex.toLowerCase().includes(lowerQuery) ||
    f.name?.toLowerCase().includes(lowerQuery) ||
    f.tags.some(t => t.toLowerCase().includes(lowerQuery))
  );
};

/**
 * 按分类获取公式
 */
export const getFormulasByCategory = (category: string): Formula[] => {
  return getFormulas().filter(f => f.category === category);
};

/**
 * 获取公式统计
 */
export const getFormulaStats = (): {
  total: number;
  byCategory: Record<string, number>;
  byDifficulty: Record<string, number>;
} => {
  const formulas = getFormulas();
  
  const byCategory: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  
  formulas.forEach(f => {
    const cat = f.category || 'other';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    
    const diff = f.difficulty || 'intermediate';
    byDifficulty[diff] = (byDifficulty[diff] || 0) + 1;
  });
  
  return {
    total: formulas.length,
    byCategory,
    byDifficulty
  };
};

// ===== 知识库 RAG (检索增强生成) =====

/**
 * 从知识库检索相关知识（用于 AI 上下文增强）
 * @param query 用户查询或当前主题
 * @param maxResults 最大返回数量
 * @returns 相关知识概念
 */
export const retrieveRelevantKnowledge = (query: string, maxResults: number = 5): KnowledgeConcept[] => {
  const concepts = getKnowledgeConcepts();
  if (!query.trim() || concepts.length === 0) return [];
  
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);
  
  // 计算每个概念的相关性分数
  const scored = concepts.map(concept => {
    let score = 0;
    const titleLower = concept.title.toLowerCase();
    const defLower = concept.definition.toLowerCase();
    const detailsLower = (concept.details || '').toLowerCase();
    const tagsLower = concept.tags.map(t => t.toLowerCase());
    
    // 标题完全匹配 (高权重)
    if (titleLower.includes(queryLower)) score += 10;
    
    // 标题部分匹配
    queryWords.forEach(word => {
      if (titleLower.includes(word)) score += 5;
    });
    
    // 定义匹配
    queryWords.forEach(word => {
      if (defLower.includes(word)) score += 3;
    });
    
    // 详情匹配
    queryWords.forEach(word => {
      if (detailsLower.includes(word)) score += 1;
    });
    
    // 标签匹配 (高权重)
    queryWords.forEach(word => {
      if (tagsLower.some(tag => tag.includes(word))) score += 4;
    });
    
    // 重要程度加权
    if (concept.importance === 'critical') score *= 1.5;
    else if (concept.importance === 'high') score *= 1.2;
    
    return { concept, score };
  });
  
  // 按分数排序，过滤低分，返回前 N 个
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.concept);
};

/**
 * 从公式库检索相关公式
 * @param query 用户查询
 * @param maxResults 最大返回数量
 */
export const retrieveRelevantFormulas = (query: string, maxResults: number = 3): Formula[] => {
  const formulas = getFormulas();
  if (!query.trim() || formulas.length === 0) return [];
  
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);
  
  const scored = formulas.map(formula => {
    let score = 0;
    const nameLower = (formula.name || '').toLowerCase();
    const latexLower = formula.latex.toLowerCase();
    const tagsLower = formula.tags.map(t => t.toLowerCase());
    
    // 名称匹配
    if (nameLower.includes(queryLower)) score += 10;
    queryWords.forEach(word => {
      if (nameLower.includes(word)) score += 5;
    });
    
    // LaTeX 匹配
    queryWords.forEach(word => {
      if (latexLower.includes(word)) score += 2;
    });
    
    // 标签匹配
    queryWords.forEach(word => {
      if (tagsLower.some(tag => tag.includes(word))) score += 4;
    });
    
    return { formula, score };
  });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.formula);
};

/**
 * 格式化知识为 AI 上下文
 */
export const formatKnowledgeContext = (concepts: KnowledgeConcept[], formulas: Formula[]): string => {
  if (concepts.length === 0 && formulas.length === 0) return '';
  
  let context = '\n\n---\n## 📚 用户知识库（已学习的相关知识）\n\n';
  
  if (concepts.length > 0) {
    context += '### 相关概念\n';
    concepts.forEach((c, i) => {
      context += `${i + 1}. **${c.title}**: ${c.definition}`;
      if (c.details) context += ` (${c.details.substring(0, 100)}...)`;
      context += '\n';
    });
  }
  
  if (formulas.length > 0) {
    context += '\n### 相关公式\n';
    formulas.forEach((f, i) => {
      context += `${i + 1}. ${f.name ? `**${f.name}**: ` : ''}$${f.latex}$\n`;
    });
  }
  
  context += '\n*请在回答中适当引用和联系上述已学知识，帮助学生建立知识关联。*\n---\n\n';
  
  return context;
};

/**
 * 获取增强的 AI 上下文（结合知识库）
 * @param query 当前查询/主题
 * @param pageContent 当前页面内容
 */
export const getAugmentedContext = (query: string, pageContent?: string): string => {
  // 组合查询和页面内容来检索
  const searchQuery = `${query} ${pageContent?.substring(0, 500) || ''}`;
  
  const relevantConcepts = retrieveRelevantKnowledge(searchQuery, 5);
  const relevantFormulas = retrieveRelevantFormulas(searchQuery, 3);
  
  return formatKnowledgeContext(relevantConcepts, relevantFormulas);
};

/**
 * 获取知识库统计（用于显示学习进度）
 */
export const getKnowledgeStats = (): {
  totalConcepts: number;
  totalFormulas: number;
  criticalCount: number;
  recentlyAdded: number;
  topTags: { name: string; count: number }[];
} => {
  const concepts = getKnowledgeConcepts();
  const formulas = getFormulas();
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  
  const tagCounts: Record<string, number> = {};
  [...concepts, ...formulas].forEach(item => {
    item.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  
  return {
    totalConcepts: concepts.length,
    totalFormulas: formulas.length,
    criticalCount: concepts.filter(c => c.importance === 'critical').length,
    recentlyAdded: concepts.filter(c => c.createdAt > oneWeekAgo).length + 
                   formulas.filter(f => f.createdAt > oneWeekAgo).length,
    topTags: Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  };
};

