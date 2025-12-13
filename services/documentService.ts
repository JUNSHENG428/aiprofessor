/**
 * Document Export Service
 * 将Markdown内容导出为Word文档或PDF
 */

// 将Markdown转换为纯HTML（用于Word导出）
const markdownToHtml = (markdown: string): string => {
  let html = markdown;
  
  // 处理数学公式 - 转换为可视化格式
  // 行内公式 $...$
  html = html.replace(/\$([^$]+)\$/g, '<span style="font-family: Cambria Math, Times New Roman; font-style: italic; background: #f5f5f5; padding: 2px 4px; border-radius: 3px;">$1</span>');
  
  // 块级公式 $$...$$
  html = html.replace(/\$\$([^$]+)\$\$/g, '<div style="text-align: center; font-family: Cambria Math, Times New Roman; font-size: 14pt; margin: 16px 0; padding: 12px; background: #f9f9f9; border-radius: 4px;">$1</div>');
  
  // 处理标题
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size: 14pt; font-weight: bold; margin: 16px 0 8px 0; color: #333;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size: 16pt; font-weight: bold; margin: 20px 0 10px 0; color: #222;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size: 20pt; font-weight: bold; margin: 24px 0 12px 0; color: #111; text-align: center;">$1</h1>');
  
  // 处理粗体
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // 处理斜体
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // 处理代码块
  html = html.replace(/```([^`]+)```/gs, '<pre style="background: #f4f4f4; padding: 12px; border-radius: 4px; font-family: Consolas, monospace; overflow-x: auto; margin: 12px 0;">$1</pre>');
  
  // 处理行内代码
  html = html.replace(/`([^`]+)`/g, '<code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-family: Consolas, monospace;">$1</code>');
  
  // 处理无序列表
  html = html.replace(/^- (.+)$/gm, '<li style="margin-left: 20px; margin-bottom: 4px;">$1</li>');
  html = html.replace(/^  - (.+)$/gm, '<li style="margin-left: 40px; margin-bottom: 4px; list-style-type: circle;">$1</li>');
  
  // 处理有序列表
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li style="margin-left: 20px; margin-bottom: 4px;" value="$1">$2</li>');
  
  // 处理表格
  html = html.replace(/\|(.+)\|/g, (match, content) => {
    const cells = content.split('|').map((cell: string) => cell.trim());
    if (cells.every((cell: string) => /^[-:]+$/.test(cell))) {
      return ''; // 跳过分隔行
    }
    const cellsHtml = cells.map((cell: string) => `<td style="border: 1px solid #ccc; padding: 8px 12px;">${cell}</td>`).join('');
    return `<tr>${cellsHtml}</tr>`;
  });
  
  // 包装表格
  html = html.replace(/(<tr>.*<\/tr>[\s\n]*)+/gs, (match) => {
    return `<table style="border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 11pt;">${match}</table>`;
  });
  
  // 处理水平线
  html = html.replace(/^---+$/gm, '<hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">');
  
  // 处理换行
  html = html.replace(/\n\n/g, '</p><p style="margin: 8px 0; line-height: 1.6;">');
  html = html.replace(/\n/g, '<br>');
  
  // 包装段落
  html = `<p style="margin: 8px 0; line-height: 1.6;">${html}</p>`;
  
  // 处理图形标注
  html = html.replace(/\[图: ([^\]]+)\]/g, '<div style="border: 2px dashed #aaa; padding: 20px; margin: 16px 0; text-align: center; color: #666; background: #fafafa; border-radius: 8px;"><strong>[图示]</strong><br>$1</div>');
  
  // 处理填空下划线
  html = html.replace(/_{4,}/g, '<span style="border-bottom: 1px solid #333; display: inline-block; min-width: 80px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>');
  
  return html;
};

// 生成Word文档的HTML格式
export const generateWordDocument = (content: string, title: string = '试卷'): Blob => {
  const htmlContent = markdownToHtml(content);
  
  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4;
      margin: 2.5cm;
    }
    body {
      font-family: "SimSun", "宋体", "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.8;
      color: #333;
      max-width: 21cm;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 {
      font-family: "SimHei", "黑体", "Arial", sans-serif;
      page-break-after: avoid;
    }
    table {
      page-break-inside: avoid;
    }
    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .formula {
      font-family: "Cambria Math", "Times New Roman", serif;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
  `.trim();
  
  // 创建Word可识别的HTML Blob
  const blob = new Blob([fullHtml], { 
    type: 'application/msword;charset=utf-8' 
  });
  
  return blob;
};

// 导出为Word文件
export const downloadAsWord = (content: string, filename: string = 'exam_document.doc'): void => {
  const blob = generateWordDocument(content, filename.replace('.doc', ''));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 导出为Markdown文件
export const downloadAsMarkdown = (content: string, filename: string = 'exam_document.md'): void => {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 复制到剪贴板
export const copyToClipboard = async (content: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = content;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  }
};

