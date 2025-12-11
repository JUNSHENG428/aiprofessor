
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

// Augment window for PDF.js
declare global {
  interface Window {
    pdfjsLib: any;
  }
}
