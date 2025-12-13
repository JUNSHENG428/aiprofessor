import { ParsedPage } from '../types';

/**
 * 高精度 PDF 解析服务
 * - 使用高分辨率渲染以获得最佳 AI 视觉识别效果
 * - 智能图像优化确保公式、图表、细节清晰可读
 */

// 渲染配置
const PDF_RENDER_CONFIG = {
  // 基础缩放比例 - 3.0 提供高清图像用于 AI 分析
  baseScale: 3.0,
  // 针对高分辨率显示器的额外缩放
  maxScale: 4.0,
  // 图像质量 (0.0-1.0)
  imageQuality: 0.95,
  // 输出格式
  imageFormat: 'image/png' as const, // PNG 保留更多细节，特别适合公式和文字
  // 最大尺寸限制（防止内存溢出）
  maxDimension: 4096
};

/**
 * 智能计算渲染比例
 * 根据页面尺寸动态调整，确保高质量输出同时避免内存问题
 */
const calculateOptimalScale = (page: any): number => {
  const defaultViewport = page.getViewport({ scale: 1.0 });
  const { width, height } = defaultViewport;
  
  // 计算在不超过最大尺寸限制的情况下，能使用的最大缩放比例
  const maxScaleByWidth = PDF_RENDER_CONFIG.maxDimension / width;
  const maxScaleByHeight = PDF_RENDER_CONFIG.maxDimension / height;
  const maxAllowedScale = Math.min(maxScaleByWidth, maxScaleByHeight, PDF_RENDER_CONFIG.maxScale);
  
  // 使用配置的基础缩放，但不超过计算出的最大允许值
  return Math.min(PDF_RENDER_CONFIG.baseScale, maxAllowedScale);
};

/**
 * 渲染高质量 PDF 页面图像
 */
const renderPageToImage = async (page: any): Promise<string | null> => {
  const scale = calculateOptimalScale(page);
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', {
    alpha: false, // 禁用 alpha 通道可提升性能
    willReadFrequently: false
  });
  
  if (!context) return null;

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // 设置高质量渲染选项
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  
  // 填充白色背景（确保透明区域变白）
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, canvas.width, canvas.height);

  // 渲染 PDF 页面
  await page.render({
    canvasContext: context,
    viewport: viewport,
    intent: 'display', // 优化显示质量
    renderInteractiveForms: true
  }).promise;

  // 转换为高质量图像
  const image = canvas.toDataURL(
    PDF_RENDER_CONFIG.imageFormat, 
    PDF_RENDER_CONFIG.imageQuality
  );

  // 清理内存
  canvas.width = 0;
  canvas.height = 0;

  console.log(`📄 Page rendered: ${Math.round(viewport.width)}x${Math.round(viewport.height)} @ scale ${scale.toFixed(1)}`);
  
  return image;
};

/**
 * 提取页面中的结构化文本
 * 保留位置信息以便更好地理解布局
 */
const extractStructuredText = async (page: any): Promise<string> => {
  const textContent = await page.getTextContent();
  
  // 按垂直位置分组文本项，以保持段落结构
  const items = textContent.items as any[];
  const lines: Map<number, string[]> = new Map();
  
  items.forEach((item: any) => {
    if (!item.str || item.str.trim() === '') return;
    
    // 使用变换矩阵中的 y 坐标（取反后四舍五入作为行标识）
    const y = Math.round(-item.transform[5]);
    
    if (!lines.has(y)) {
      lines.set(y, []);
    }
    lines.get(y)!.push(item.str);
  });

  // 按行排序并合并
  const sortedLines = Array.from(lines.entries())
    .sort(([a], [b]) => a - b)
    .map(([_, texts]) => texts.join(' '));

  return sortedLines.join('\n');
};

export const parsePDF = async (file: File): Promise<ParsedPage[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      if (!window.pdfjsLib) {
        reject(new Error("PDF.js library not loaded"));
        return;
      }

      console.log('🔍 Starting high-precision PDF parsing...');

      const pdf = await window.pdfjsLib.getDocument({ 
        data: arrayBuffer,
        // 启用更好的字体渲染
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'
      }).promise;
      
      const numPages = pdf.numPages;
      const parsedPages: ParsedPage[] = [];

      console.log(`📚 Processing ${numPages} pages with enhanced quality...`);

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        
        // 1. 提取结构化文本
        const pageText = await extractStructuredText(page);

        // 2. 渲染高质量图像
        const image = await renderPageToImage(page);

        parsedPages.push({
          pageNumber: i,
          text: pageText,
          image: image || undefined
        });

        console.log(`✅ Page ${i}/${numPages} processed`);
      }

      console.log('🎉 PDF parsing complete with enhanced precision!');
      resolve(parsedPages);
    } catch (error) {
      console.error("Error parsing PDF:", error);
      reject(error);
    }
  });
};