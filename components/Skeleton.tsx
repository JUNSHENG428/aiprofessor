import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * 骨架屏组件 - 用于加载状态占位
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse'
}) => {
  const baseClasses = 'bg-gray-200';
  
  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-lg'
  };
  
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'skeleton-wave',
    none: ''
  };

  const style: React.CSSProperties = {
    width: width,
    height: height
  };

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
};

/**
 * 卡片骨架屏
 */
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 1 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white rounded-lg p-4 space-y-3 border border-gray-100">
        <Skeleton variant="text" width="60%" height={20} />
        <Skeleton variant="text" width="100%" height={16} />
        <Skeleton variant="text" width="80%" height={16} />
        <div className="flex gap-2 pt-2">
          <Skeleton variant="rounded" width={60} height={24} />
          <Skeleton variant="rounded" width={60} height={24} />
        </div>
      </div>
    ))}
  </>
);

/**
 * 列表项骨架屏
 */
export const ListItemSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="70%" height={16} />
          <Skeleton variant="text" width="50%" height={12} />
        </div>
      </div>
    ))}
  </>
);

/**
 * 消息骨架屏
 */
export const MessageSkeleton: React.FC = () => (
  <div className="flex gap-4">
    <Skeleton variant="circular" width={40} height={40} />
    <div className="flex-1 space-y-2">
      <Skeleton variant="rounded" width="100%" height={80} />
    </div>
  </div>
);

/**
 * 思维导图节点骨架屏
 */
export const MindMapSkeleton: React.FC = () => (
  <div className="space-y-2 p-4">
    <Skeleton variant="rounded" width="40%" height={36} />
    <div className="ml-6 space-y-2">
      <Skeleton variant="rounded" width="35%" height={32} />
      <Skeleton variant="rounded" width="30%" height={32} />
      <div className="ml-6 space-y-2">
        <Skeleton variant="rounded" width="25%" height={28} />
        <Skeleton variant="rounded" width="28%" height={28} />
      </div>
    </div>
    <div className="ml-6 space-y-2">
      <Skeleton variant="rounded" width="32%" height={32} />
    </div>
  </div>
);

/**
 * 闪卡骨架屏
 */
export const FlashcardSkeleton: React.FC = () => (
  <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-100">
    <div className="flex flex-col items-center justify-center space-y-4 min-h-[200px]">
      <Skeleton variant="text" width={60} height={16} />
      <Skeleton variant="text" width="80%" height={24} />
      <Skeleton variant="text" width="60%" height={24} />
      <Skeleton variant="text" width={100} height={14} className="mt-4" />
    </div>
  </div>
);

/**
 * 统计数据骨架屏
 */
export const StatsSkeleton: React.FC = () => (
  <div className="flex gap-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="flex items-center gap-2">
        <Skeleton variant="circular" width={16} height={16} />
        <Skeleton variant="text" width={50} height={14} />
      </div>
    ))}
  </div>
);

/**
 * 页面加载骨架屏
 */
export const PageSkeleton: React.FC = () => (
  <div className="flex h-screen bg-gray-100">
    {/* Sidebar */}
    <div className="w-64 bg-slate-900 p-4 space-y-4">
      <Skeleton variant="rounded" width="100%" height={40} className="bg-slate-800" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width="100%" height={48} className="bg-slate-800" />
        ))}
      </div>
    </div>
    
    {/* Main Content */}
    <div className="flex-1 p-6 space-y-4">
      <Skeleton variant="rounded" width="100%" height={60} />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton variant="rounded" width="100%" height={300} />
        <Skeleton variant="rounded" width="100%" height={300} />
      </div>
    </div>
  </div>
);

