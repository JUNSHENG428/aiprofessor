import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { 
  GitBranch, Plus, Sparkles, Download, X, ChevronRight, ChevronDown,
  Trash2, FileText, ZoomIn, ZoomOut, Maximize2, Copy
} from 'lucide-react';
import { MindMap, MindMapNode, AppSettings } from '../types';
import { getMindMaps, saveMindMap, deleteMindMap } from '../services/storageService';
import { generateStream } from '../services/aiService';
import { PROMPTS } from '../constants';
import { Button } from './Button';
import { useToast } from './Toast';
import { useClipboard } from '../hooks/useOptimized';

interface MindMapPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  settings: AppSettings;
  currentContent?: string;
  currentFileId?: string;
  currentFileName?: string;
  currentPageRange?: [number, number];
}

// 递归渲染思维导图节点
const MindMapNodeComponent: React.FC<{
  node: MindMapNode;
  depth: number;
  onToggle: (nodeId: string) => void;
  collapsedNodes: Set<string>;
}> = ({ node, depth, onToggle, collapsedNodes }) => {
  const isCollapsed = collapsedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  
  // 颜色配置
  const depthColors = [
    'bg-violet-100 text-violet-800 border-violet-300',
    'bg-blue-100 text-blue-800 border-blue-300',
    'bg-green-100 text-green-800 border-green-300',
    'bg-amber-100 text-amber-800 border-amber-300',
    'bg-rose-100 text-rose-800 border-rose-300',
  ];
  
  const colorClass = depthColors[Math.min(depth, depthColors.length - 1)];

  return (
    <div className="relative">
      {/* 节点 */}
      <div 
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer
          transition-all hover:shadow-md ${colorClass}
          ${depth === 0 ? 'text-base font-bold' : 'text-sm'}
        `}
        style={{ marginLeft: depth * 24 }}
        onClick={() => hasChildren && onToggle(node.id)}
      >
        {hasChildren && (
          <span className="flex-shrink-0">
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
        {node.icon && <span>{node.icon}</span>}
        <span className="flex-1">{node.text}</span>
      </div>
      
      {/* 子节点 */}
      {hasChildren && !isCollapsed && (
        <div className="mt-1 space-y-1">
          {node.children.map(child => (
            <MindMapNodeComponent
              key={child.id}
              node={child}
              depth={depth + 1}
              onToggle={onToggle}
              collapsedNodes={collapsedNodes}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const MindMapPanel: React.FC<MindMapPanelProps> = ({
  isOpen,
  onToggle,
  settings,
  currentContent,
  currentFileId,
  currentFileName,
  currentPageRange
}) => {
  const [mindMaps, setMindMaps] = useState<MindMap[]>([]);
  const [selectedMap, setSelectedMap] = useState<MindMap | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [showList, setShowList] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { copy } = useClipboard();

  // 加载思维导图
  useEffect(() => {
    if (isOpen) {
      setMindMaps(getMindMaps());
    }
  }, [isOpen]);

  // 切换节点折叠
  const toggleNode = useCallback((nodeId: string) => {
    setCollapsedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  // 展开所有节点
  const expandAll = useCallback(() => {
    setCollapsedNodes(new Set());
  }, []);

  // 折叠所有节点
  const collapseAll = useCallback(() => {
    if (!selectedMap) return;
    
    const getAllNodeIds = (node: MindMapNode): string[] => {
      const ids = [node.id];
      if (node.children) {
        node.children.forEach(child => {
          ids.push(...getAllNodeIds(child));
        });
      }
      return ids;
    };
    
    setCollapsedNodes(new Set(getAllNodeIds(selectedMap.root)));
  }, [selectedMap]);

  // AI 生成思维导图
  const handleGenerateMap = useCallback(async () => {
    if (!currentContent) {
      toast.warning('请先进行课件讲解，然后再生成思维导图');
      return;
    }
    if (!settings.apiKey && settings.provider !== 'ollama') {
      toast.warning('请先配置 API Key');
      return;
    }

    setIsGenerating(true);
    
    try {
      const title = currentFileName 
        ? `${currentFileName} (P${currentPageRange?.[0] || 1}-${currentPageRange?.[1] || 1})`
        : '思维导图';
      
      const prompt = PROMPTS.GENERATE_MINDMAP(currentContent, title);
      let fullResponse = '';
      
      await generateStream(settings, prompt, [], (chunk) => {
        fullResponse += chunk;
      });

      // 解析 JSON 响应
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        const newMap: MindMap = {
          id: Date.now().toString(),
          title: parsed.title || title,
          root: parsed.root,
          fileId: currentFileId,
          fileName: currentFileName,
          pageRange: currentPageRange,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        saveMindMap(newMap);
        setMindMaps(getMindMaps());
        setSelectedMap(newMap);
        setShowList(false);
        setCollapsedNodes(new Set());
        toast.success('思维导图生成成功！');
      }
    } catch (error) {
      console.error('生成思维导图失败:', error);
      toast.error('生成思维导图失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [currentContent, settings, currentFileId, currentFileName, currentPageRange, toast]);

  // 删除思维导图
  const handleDeleteMap = useCallback((mapId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个思维导图吗？')) {
      deleteMindMap(mapId);
      setMindMaps(getMindMaps());
      if (selectedMap?.id === mapId) {
        setSelectedMap(null);
        setShowList(true);
      }
      toast.success('思维导图已删除');
    }
  }, [selectedMap, toast]);

  // 导出为 Markdown
  const exportToMarkdown = useCallback(() => {
    if (!selectedMap) return;

    const nodeToMarkdown = (node: MindMapNode, depth: number): string => {
      const prefix = '  '.repeat(depth);
      const bullet = depth === 0 ? '#' : '-';
      let md = `${prefix}${bullet} ${node.icon || ''} ${node.text}\n`;
      
      if (node.children) {
        node.children.forEach(child => {
          md += nodeToMarkdown(child, depth + 1);
        });
      }
      
      return md;
    };

    const markdown = nodeToMarkdown(selectedMap.root, 0);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedMap.title}.md`;
    a.click();
  }, [selectedMap]);

  // 复制为文本
  const copyAsText = useCallback(async () => {
    if (!selectedMap) return;

    const nodeToText = (node: MindMapNode, depth: number): string => {
      const indent = '  '.repeat(depth);
      let text = `${indent}${node.icon || ''} ${node.text}\n`;
      
      if (node.children) {
        node.children.forEach(child => {
          text += nodeToText(child, depth + 1);
        });
      }
      
      return text;
    };

    const text = nodeToText(selectedMap.root, 0);
    const success = await copy(text);
    if (success) {
      toast.success('已复制到剪贴板');
    } else {
      toast.error('复制失败');
    }
  }, [selectedMap, copy, toast]);

  if (!isOpen) return null;

  return (
    <div className="w-[450px] bg-white border-l border-gray-200 flex flex-col h-full shadow-xl flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-emerald-500 to-teal-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <GitBranch size={20} />
            <h2 className="font-bold">思维导图</h2>
          </div>
          <button onClick={onToggle} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-white/70 mt-1">
          将知识可视化，理清概念关系
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {showList ? (
          <>
            {/* Actions */}
            <div className="p-3 border-b border-gray-100 flex gap-2">
              <Button 
                variant="primary" 
                size="sm" 
                onClick={handleGenerateMap}
                disabled={isGenerating || !currentContent}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isGenerating ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <Sparkles size={14} className="mr-1" />
                    从讲解生成
                  </>
                )}
              </Button>
            </div>

            {/* Map List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {mindMaps.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <GitBranch size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="font-medium">还没有思维导图</p>
                  <p className="text-sm mt-1">点击"从讲解生成"创建</p>
                </div>
              ) : (
                mindMaps.map(map => (
                  <div 
                    key={map.id}
                    onClick={() => { setSelectedMap(map); setShowList(false); setCollapsedNodes(new Set()); }}
                    className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 cursor-pointer transition-colors group"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">
                          {map.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(map.createdAt).toLocaleDateString()}
                          {map.fileName && ` · ${map.fileName}`}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => handleDeleteMap(map.id, e)}
                        className="p-1 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} className="text-red-500" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : selectedMap && (
          <>
            {/* Map View Header */}
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowList(true)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronRight size={16} className="rotate-180" />
                </button>
                <span className="font-medium text-gray-800 text-sm truncate max-w-[200px]">
                  {selectedMap.title}
                </span>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={expandAll}
                  className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                  title="展开全部"
                >
                  <Maximize2 size={14} />
                </button>
                <button 
                  onClick={copyAsText}
                  className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                  title="复制文本"
                >
                  <Copy size={14} />
                </button>
                <button 
                  onClick={exportToMarkdown}
                  className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                  title="导出 Markdown"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>

            {/* Mind Map View */}
            <div ref={contentRef} className="flex-1 overflow-auto p-4">
              <MindMapNodeComponent
                node={selectedMap.root}
                depth={0}
                onToggle={toggleNode}
                collapsedNodes={collapsedNodes}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

