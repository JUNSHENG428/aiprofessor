import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/**
 * 防抖 Hook
 * @param value 需要防抖的值
 * @param delay 延迟毫秒数
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 防抖回调 Hook
 * @param callback 回调函数
 * @param delay 延迟毫秒数
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): T {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

/**
 * 节流 Hook
 * @param callback 回调函数
 * @param delay 延迟毫秒数
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): T {
  const lastRunRef = useRef(0);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastRunRef.current >= delay) {
        lastRunRef.current = now;
        callbackRef.current(...args);
      }
    }) as T,
    [delay]
  );
}

/**
 * 本地存储 Hook（带同步）
 * @param key 存储键名
 * @param initialValue 初始值
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error('useLocalStorage error:', error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}

/**
 * 上一个值 Hook
 * @param value 当前值
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

/**
 * 挂载状态 Hook
 */
export function useIsMounted(): () => boolean {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useCallback(() => isMountedRef.current, []);
}

/**
 * 异步操作 Hook
 */
export function useAsync<T, E = string>(
  asyncFunction: () => Promise<T>,
  immediate = false
): {
  execute: () => Promise<void>;
  loading: boolean;
  data: T | null;
  error: E | null;
} {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<E | null>(null);
  const isMounted = useIsMounted();

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFunction();
      if (isMounted()) {
        setData(result);
      }
    } catch (e) {
      if (isMounted()) {
        setError(e as E);
      }
    } finally {
      if (isMounted()) {
        setLoading(false);
      }
    }
  }, [asyncFunction, isMounted]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { execute, loading, data, error };
}

/**
 * 键盘快捷键 Hook
 * @param keyCombo 键组合，如 'ctrl+s', 'shift+enter'
 * @param callback 回调函数
 * @param deps 依赖项
 */
export function useHotkey(
  keyCombo: string,
  callback: (e: KeyboardEvent) => void,
  deps: React.DependencyList = []
): void {
  useEffect(() => {
    const keys = keyCombo.toLowerCase().split('+');
    const mainKey = keys[keys.length - 1];
    const modifiers = {
      ctrl: keys.includes('ctrl') || keys.includes('control'),
      shift: keys.includes('shift'),
      alt: keys.includes('alt'),
      meta: keys.includes('meta') || keys.includes('cmd')
    };

    const handler = (e: KeyboardEvent) => {
      // 检查是否在输入框中
      const target = e.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      const isEditable = target.isContentEditable;

      // 某些快捷键在输入框中也应该生效
      const globalShortcuts = ['escape', 'f1', 'f2', 'f3'];
      const isGlobalShortcut = globalShortcuts.includes(mainKey);

      if ((isInput || isEditable) && !isGlobalShortcut) {
        return;
      }

      const matchesKey = e.key.toLowerCase() === mainKey;
      const matchesModifiers =
        e.ctrlKey === modifiers.ctrl &&
        e.shiftKey === modifiers.shift &&
        e.altKey === modifiers.alt &&
        e.metaKey === modifiers.meta;

      if (matchesKey && matchesModifiers) {
        e.preventDefault();
        callback(e);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [keyCombo, callback, ...deps]);
}

/**
 * 剪贴板 Hook
 */
export function useClipboard(): {
  copy: (text: string) => Promise<boolean>;
  paste: () => Promise<string>;
} {
  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 降级方案
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
      } catch {
        return false;
      }
    }
  }, []);

  const paste = useCallback(async (): Promise<string> => {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return '';
    }
  }, []);

  return { copy, paste };
}

/**
 * 窗口大小 Hook
 */
export function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

/**
 * 确认对话框 Hook（替代 browser confirm）
 */
export function useConfirm(): (message: string) => Promise<boolean> {
  return useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      // 使用原生 confirm，后续可替换为自定义模态框
      resolve(window.confirm(message));
    });
  }, []);
}

