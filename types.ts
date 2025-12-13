
export interface ParsedPage {
  pageNumber: number;
  text: string;
  image?: string; // Base64 data URL
}

export interface Message {
  role: 'user' | 'model';
  content: string;
  images?: string[]; // User uploaded images (base64)
  isStreaming?: boolean;
  timestamp?: number;
  isSaved?: boolean;
}

export interface LectureState {
  file: File | null;
  parsedPages: ParsedPage[];
  currentBatch: [number, number]; // [startPage, endPage]
  totalPages: number;
  isParsing: boolean;
  parsingError: string | null;
}

export enum LectureMode {
  EXPLAIN = 'EXPLAIN',
  SUMMARY = 'SUMMARY',
  MOCK_EXAM = 'MOCK_EXAM'
}

export type APIProvider = 'gemini' | 'openai' | 'claude' | 'deepseek' | 'ollama' | 'custom';

// 教学风格类型
export type TeachingStyle = 'balanced' | 'concise' | 'detailed' | 'examples' | 'socratic';

export interface AppSettings {
  provider: APIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  batchSize: number;
  temperature: number;
  // AI 功能增强
  teachingStyle: TeachingStyle;
  customPrompt: string;
  enableContext: boolean; // 是否启用多轮对话上下文
  contextTurns: number; // 保留多少轮对话上下文
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-2.5-flash',
  batchSize: 3,
  temperature: 0.7,
  // AI 功能增强默认值
  teachingStyle: 'balanced',
  customPrompt: '',
  enableContext: true,
  contextTurns: 5
};

// 文件记录
export interface FileRecord {
  id: string;
  name: string;
  size: number;
  uploadedAt: number;
  pageCount: number;
}

// 笔记
export interface Note {
  id: string;
  title: string;
  content: string;
  fileId?: string;
  createdAt: number;
  updatedAt: number;
}

// 会话记录（包含 PDF 解析数据用于恢复）
export interface Session {
  id: string;
  fileId: string;
  fileName: string;
  messages: Message[];
  parsedPages: ParsedPage[]; // 保存解析的页面数据
  currentBatch: [number, number];
  createdAt: number;
  updatedAt: number;
}

// ===== 智能闪卡 (Flashcards) =====
export interface Flashcard {
  id: string;
  front: string; // 问题/正面
  back: string; // 答案/背面
  tags: string[];
  fileId?: string;
  fileName?: string;
  // 间隔重复算法数据 (SM-2)
  easeFactor: number; // 难度因子 (默认 2.5)
  interval: number; // 下次复习间隔（天）
  repetitions: number; // 连续正确次数
  nextReview: number; // 下次复习时间戳
  lastReview?: number; // 上次复习时间戳
  // 元数据
  createdAt: number;
  updatedAt: number;
}

export interface FlashcardDeck {
  id: string;
  name: string;
  description?: string;
  cardIds: string[];
  createdAt: number;
  updatedAt: number;
}

// 复习评分 (SM-2 算法)
export type ReviewRating = 0 | 1 | 2 | 3 | 4 | 5;
// 0 = 完全不记得, 1 = 错误但熟悉, 2 = 错误但容易回忆
// 3 = 正确但困难, 4 = 正确, 5 = 完美

// ===== 思维导图 (Mind Map) =====
export interface MindMapNode {
  id: string;
  text: string;
  children: MindMapNode[];
  collapsed?: boolean;
  color?: string;
  icon?: string;
}

export interface MindMap {
  id: string;
  title: string;
  root: MindMapNode;
  fileId?: string;
  fileName?: string;
  pageRange?: [number, number];
  createdAt: number;
  updatedAt: number;
}

// ===== 知识库 (Knowledge Base) =====
export interface KnowledgeConcept {
  id: string;
  title: string; // 概念名称
  definition: string; // 定义/解释
  details?: string; // 详细内容
  examples?: string[]; // 示例
  relatedIds?: string[]; // 关联概念ID
  tags: string[];
  fileId?: string;
  fileName?: string;
  pageNumber?: number;
  importance: 'low' | 'medium' | 'high' | 'critical';
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeTag {
  id: string;
  name: string;
  color: string;
  conceptCount: number;
}

// ===== 公式讲解 (Formula Explainer) =====
export interface Formula {
  id: string;
  latex: string; // LaTeX 格式的公式
  name?: string; // 公式名称
  explanation?: string; // AI 生成的讲解
  variables?: FormulaVariable[]; // 变量解释
  examples?: string[]; // 应用示例
  relatedFormulas?: string[]; // 相关公式ID
  tags: string[];
  fileId?: string;
  fileName?: string;
  pageNumber?: number;
  category?: 'math' | 'physics' | 'chemistry' | 'statistics' | 'economics' | 'other';
  difficulty?: 'basic' | 'intermediate' | 'advanced';
  createdAt: number;
  updatedAt: number;
}

export interface FormulaVariable {
  symbol: string; // 变量符号
  name: string; // 变量名称
  description: string; // 变量描述
  unit?: string; // 单位
}

// Augment window for PDF.js
declare global {
  interface Window {
    pdfjsLib: any;
  }
}
