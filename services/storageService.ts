/**
 * Storage Service - 优化的本地存储管理
 * 支持文件记录、会话记录、自动保存和存储空间管理
 */

import { FileRecord, Session, Message, ParsedPage } from '../types';

// Storage keys
const KEYS = {
  FILES: 'ai_professor_files',
  SESSIONS: 'ai_professor_sessions',
  SETTINGS: 'ai_professor_settings',
  AUTO_SAVE: 'ai_professor_autosave',
  STORAGE_META: 'ai_professor_storage_meta'
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

