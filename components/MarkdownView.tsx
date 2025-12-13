import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export type MarkdownViewProps = {
  content: string;
  className?: string;
  /**
   * 用于“行内”场景（如卡片列表、短文本），避免 ReactMarkdown 默认包裹 <p> 导致布局断行。
   */
  inline?: boolean;
  /**
   * 允许调用方自定义渲染组件（如 NotesOrganizerPage 的卡片样式）。
   */
  components?: React.ComponentProps<typeof ReactMarkdown>['components'];
};

/**
 * 预处理 Markdown 内容，修复常见 LaTeX/Markdown 输出问题：
 * - 将 $...$ / $$...$$ 内的 \\\\ 归一为 \\（避免渲染失败）
 * - 确保块级公式 $$ 前后有换行（提升解析稳定性）
 */
export const preprocessMarkdown = (content: string): string => {
  let processed = content ?? '';

  // 1) 行内公式：$...$
  processed = processed.replace(/\$([^$]+)\$/g, (match, formula) => {
    const fixed = String(formula).replace(/\\\\\\\\/g, '\\\\');
    return `$${fixed}$`;
  });

  // 2) 块级公式：$$...$$
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    const fixed = String(formula).replace(/\\\\\\\\/g, '\\\\');
    return `$$${fixed}$$`;
  });

  // 3) 让块级公式前后更“像 Markdown”
  processed = processed.replace(/([^\n])\$\$/g, '$1\n$$');
  processed = processed.replace(/\$\$([^\n])/g, '$$\n$1');

  return processed;
};

const katexOptions = {
  strict: false,
  throwOnError: false,
  output: 'htmlAndMathml' as const,
  trust: true,
  macros: {
    '\\R': '\\mathbb{R}',
    '\\N': '\\mathbb{N}',
    '\\Z': '\\mathbb{Z}',
    '\\Q': '\\mathbb{Q}',
    '\\C': '\\mathbb{C}',
    '\\vec': '\\mathbf',
    '\\d': '\\mathrm{d}',
  },
};

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className, inline, components }) => {
  const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
  const rehypePlugins = useMemo(() => [[rehypeKatex, katexOptions]], []);

  const finalComponents = useMemo(() => {
    if (!inline) return components;

    // inline 模式：把 p 渲染为 span，避免额外块级换行
    return {
      p: ({ children }) => <span>{children}</span>,
      ...components,
    } as NonNullable<MarkdownViewProps['components']>;
  }, [inline, components]);

  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins as any}
      components={finalComponents}
    >
      {preprocessMarkdown(content)}
    </ReactMarkdown>
  );
};


