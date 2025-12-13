import { AppSettings } from '../types';
import { generateStream } from './aiService';
import { PROMPTS } from '../constants';

export type RegionOcrIntent = 'auto' | 'formula' | 'table' | 'chart' | 'text';

export type RegionOcrResult = {
  text: string;
  formulas: Array<{ latex: string; name?: string; confidence?: 'high' | 'medium' | 'low' }>;
  tables: Array<{ markdown: string; title?: string; confidence?: 'high' | 'medium' | 'low' }>;
  charts: Array<{ description: string; keyTakeaways?: string[]; confidence?: 'high' | 'medium' | 'low' }>;
  warnings?: string[];
};

const extractFirstJsonObject = (raw: string): string | null => {
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
};

/**
 * 高精 OCR（通过 Vision 模型结构化提取），用于：
 * - 框选区域内的文字/公式/表格/图表
 * - 作为二段推理的“结构化中间层”，提升准确率并减少 token
 */
export async function ocrRegionStructured(
  settings: AppSettings,
  imageDataUrl: string,
  intent: RegionOcrIntent = 'auto',
  onProgress?: (text: string) => void
): Promise<{ raw: string; parsed: RegionOcrResult | null }> {
  let raw = '';
  const prompt = PROMPTS.OCR_REGION_STRUCTURED(intent);

  await generateStream(settings, prompt, [imageDataUrl], (chunk) => {
    raw += chunk;
    onProgress?.(raw);
  });

  const jsonStr = extractFirstJsonObject(raw);
  if (!jsonStr) return { raw, parsed: null };

  try {
    const parsed = JSON.parse(jsonStr) as RegionOcrResult;
    return { raw, parsed };
  } catch {
    return { raw, parsed: null };
  }
}


