import { useState, useCallback } from 'react';
import { AppSettings } from '../types';
import { ocrRegionStructured } from '../services/ocrService';
import { saveFormulas, saveKnowledgeConcept } from '../services/storageService';

interface UseOcrFlowProps {
  settings: AppSettings;
  currentFileId: string | null;
  currentFileName?: string;
  onInputUpdate: (updater: (prev: string) => string) => void;
}

export const useOcrFlow = ({
  settings,
  currentFileId,
  currentFileName,
  onInputUpdate,
}: UseOcrFlowProps) => {
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [ocrProgressText, setOcrProgressText] = useState('');

  const performOcr = useCallback(async (
    region: { pageNumber: number; imageDataUrl: string }
  ) => {
    if (!settings.apiKey && settings.provider !== 'ollama') {
      return { success: false, error: 'missing_api_key' };
    }

    try {
      setIsOcrRunning(true);
      setOcrProgressText('');

      const { parsed, raw } = await ocrRegionStructured(
        settings,
        region.imageDataUrl,
        'auto',
        (progress) => setOcrProgressText(progress)
      );

      const now = Date.now();
      const jsonText = parsed ? JSON.stringify(parsed, null, 2) : raw;
      const block =
        `【OCR 结构化结果｜第 ${region.pageNumber} 页框选区域】\n\n` +
        `\`\`\`json\n${jsonText}\n\`\`\`\n`;

      // 1) 插入聊天输入框
      onInputUpdate(prev => (prev.trim() ? `${prev}\n\n${block}` : block));

      // 2) 自动存入公式库
      if (parsed?.formulas?.length) {
        const newFormulas = parsed.formulas
          .filter(f => f?.latex && String(f.latex).trim())
          .slice(0, 20)
          .map((f, idx) => ({
            id: `${now}-ocr-formula-${idx}`,
            latex: String(f.latex).trim(),
            name: f.name ? String(f.name).trim() : undefined,
            tags: ['ocr', 'region'],
            fileId: currentFileId || undefined,
            fileName: currentFileName,
            pageNumber: region.pageNumber,
            category: 'other' as const,
            difficulty: 'intermediate' as const,
            createdAt: now,
            updatedAt: now,
          }));

        if (newFormulas.length) saveFormulas(newFormulas as any);
      }

      // 3) 自动存入知识库
      if (parsed) {
        const firstLine =
          (parsed.text || '')
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean)[0] || '框选区域内容（OCR 提取）';

        const examples: string[] = [];
        parsed.tables?.forEach(t => t?.markdown && examples.push(`表格：\n${t.markdown}`));
        parsed.charts?.forEach(c => c?.description && examples.push(`图表：${c.description}`));

        saveKnowledgeConcept({
          id: `${now}-ocr-concept-${region.pageNumber}`,
          title: `区域OCR：第${region.pageNumber}页`,
          definition: firstLine,
          details: parsed.text || undefined,
          examples: examples.length ? examples.slice(0, 8) : undefined,
          tags: ['ocr', 'region'],
          fileId: currentFileId || undefined,
          fileName: currentFileName,
          pageNumber: region.pageNumber,
          importance: 'medium',
          createdAt: now,
          updatedAt: now,
        });
      }
      
      return { success: true };
    } catch (e) {
      console.error('OCR Flow failed:', e);
      return { success: false, error: 'ocr_failed' };
    } finally {
      setIsOcrRunning(false);
    }
  }, [settings, currentFileId, currentFileName, onInputUpdate]);

  return {
    isOcrRunning,
    ocrProgressText,
    performOcr,
    resetOcrState: () => setOcrProgressText('')
  };
};

