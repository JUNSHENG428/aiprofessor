import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

// Toast 类型
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// Toast 图标配置
const TOAST_CONFIG = {
  success: {
    icon: CheckCircle,
    bg: 'bg-emerald-500',
    border: 'border-emerald-400',
    text: 'text-white'
  },
  error: {
    icon: XCircle,
    bg: 'bg-red-500',
    border: 'border-red-400',
    text: 'text-white'
  },
  warning: {
    icon: AlertCircle,
    bg: 'bg-amber-500',
    border: 'border-amber-400',
    text: 'text-white'
  },
  info: {
    icon: Info,
    bg: 'bg-blue-500',
    border: 'border-blue-400',
    text: 'text-white'
  }
};

// 单个 Toast 组件
const ToastItem: React.FC<{
  toast: Toast;
  onRemove: (id: string) => void;
}> = ({ toast, onRemove }) => {
  const config = TOAST_CONFIG[toast.type];
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border
        ${config.bg} ${config.border} ${config.text}
        animate-slide-in-right
        min-w-[280px] max-w-[400px]
      `}
      style={{
        animation: 'slideInRight 0.3s ease-out'
      }}
    >
      <Icon size={20} className="flex-shrink-0" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 p-1 hover:bg-white/20 rounded-full transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
};

// Toast 容器
export const ToastContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { id, type, message, duration }]);
  }, []);

  const contextValue: ToastContextType = {
    showToast,
    success: (message) => showToast('success', message),
    error: (message) => showToast('error', message),
    warning: (message) => showToast('warning', message),
    info: (message) => showToast('info', message)
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* Toast 渲染区域 */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
      
      {/* 动画样式 */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

// Hook 使用 Toast
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    // 如果没有 Provider，返回一个使用 console 的备用实现
    return {
      showToast: (type, message) => console.log(`[${type}] ${message}`),
      success: (message) => console.log(`[success] ${message}`),
      error: (message) => console.error(`[error] ${message}`),
      warning: (message) => console.warn(`[warning] ${message}`),
      info: (message) => console.info(`[info] ${message}`)
    };
  }
  return context;
};

