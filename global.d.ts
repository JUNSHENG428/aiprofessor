// 第三方模块类型声明

declare module 'remark-math' {
  import { Plugin } from 'unified';
  const remarkMath: Plugin;
  export default remarkMath;
}

declare module 'rehype-katex' {
  import { Plugin } from 'unified';
  interface RehypeKatexOptions {
    strict?: boolean | 'warn' | 'ignore' | 'error';
    throwOnError?: boolean;
    output?: 'html' | 'mathml' | 'htmlAndMathml';
    trust?: boolean;
    macros?: Record<string, string>;
    minRuleThickness?: number;
    colorIsTextColor?: boolean;
    maxSize?: number;
    maxExpand?: number;
    fleqn?: boolean;
    leqno?: boolean;
    displayMode?: boolean;
    errorColor?: string;
  }
  const rehypeKatex: Plugin<[RehypeKatexOptions?]>;
  export default rehypeKatex;
}

declare module 'katex' {
  interface KatexOptions {
    displayMode?: boolean;
    throwOnError?: boolean;
    errorColor?: string;
    macros?: Record<string, string>;
    colorIsTextColor?: boolean;
    maxSize?: number;
    maxExpand?: number;
    strict?: boolean | 'warn' | 'ignore' | 'error';
    trust?: boolean;
    output?: 'html' | 'mathml' | 'htmlAndMathml';
  }
  
  export function render(
    expression: string,
    element: HTMLElement,
    options?: KatexOptions
  ): void;
  
  export function renderToString(
    expression: string,
    options?: KatexOptions
  ): string;
}

// Window 扩展
interface Window {
  pdfjsLib: any;
  katex?: {
    render(expression: string, element: HTMLElement, options?: any): void;
    renderToString(expression: string, options?: any): string;
  };
}

