import React, { useRef, useEffect, useState, memo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../types';
import { Bot, User, Sparkles, Copy, Check, Languages, Volume2, VolumeX, Bookmark, BookmarkCheck } from 'lucide-react';

interface LecturePanelProps {
  messages: Message[];
  isStreaming: boolean;
  onTranslate?: (index: number, content: string) => void;
  onSaveMessage?: (index: number) => void;
}

// 使用 memo 优化消息项渲染
interface MessageItemProps {
  msg: Message;
  index: number;
  onTranslate?: (index: number, content: string) => void;
  onSaveMessage?: (index: number) => void;
}

const MessageItem = memo(({ msg, index, onTranslate, onSaveMessage }: MessageItemProps) => {
  const [copied, setCopied] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  }, [msg.content]);

  const handleTranslateClick = useCallback(() => {
    if (onTranslate && !translating) {
      setTranslating(true);
      onTranslate(index, msg.content);
      setTimeout(() => setTranslating(false), 1000);
    }
  }, [onTranslate, translating, index, msg.content]);

  // 语音朗读功能
  const handleSpeak = useCallback(() => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    
    // 清理 Markdown 格式
    const cleanText = msg.content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[-*]\s/g, '')
      .replace(/\n+/g, '. ')
      .substring(0, 3000); // 限制长度
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = msg.content.match(/[\u4e00-\u9fa5]/) ? 'zh-CN' : 'en-US';
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, [isSpeaking, msg.content]);

  // 收藏功能
  const handleSave = useCallback(() => {
    if (onSaveMessage) {
      onSaveMessage(index);
    }
  }, [onSaveMessage, index]);

  return (
    <div className={`flex gap-4 group ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${
        msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-teal-600 text-white'
      }`}>
        {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
      </div>

      {/* Message Bubble */}
      <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
         <div className={`relative rounded-2xl p-5 shadow-sm border ${
           msg.role === 'user' 
             ? 'bg-indigo-600 text-white border-indigo-600 text-left' 
             : 'bg-white text-slate-800 border-gray-100 markdown-body'
         }`}>
           {/* Action Buttons (visible on hover) */}
           <div className={`absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-all duration-200`}>
             {/* AI Message Actions */}
             {msg.role === 'model' && (
               <>
                 {/* Speak Button */}
                 <button
                   onClick={handleSpeak}
                   className={`p-1.5 rounded-md transition-colors ${
                     isSpeaking 
                       ? 'bg-teal-100 text-teal-600' 
                       : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                   }`}
                   title={isSpeaking ? "停止朗读" : "语音朗读"}
                 >
                   {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                 </button>
                 
                 {/* Save/Bookmark Button */}
                 {onSaveMessage && (
                   <button
                     onClick={handleSave}
                     className={`p-1.5 rounded-md transition-colors ${
                       msg.isSaved 
                         ? 'bg-amber-100 text-amber-600' 
                         : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                     }`}
                     title={msg.isSaved ? "已收藏" : "收藏此回答"}
                   >
                     {msg.isSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                   </button>
                 )}
                 
                 {/* Translate Button */}
                 {onTranslate && (
                   <button
                     onClick={handleTranslateClick}
                     className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-500"
                     title="翻译为中文"
                   >
                     <Languages size={14} />
                   </button>
                 )}
               </>
             )}
             
             {/* Copy Button */}
             <button
               onClick={handleCopy}
               className={`p-1.5 rounded-md ${
                 msg.role === 'user' 
                  ? 'bg-indigo-500 hover:bg-indigo-400 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
               }`}
               title="复制内容"
             >
               {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
             </button>
           </div>

           {msg.role === 'user' ? (
             <div>
               {/* User uploaded images */}
               {msg.images && msg.images.length > 0 && (
                 <div className="flex flex-wrap gap-2 mb-3">
                   {msg.images.map((img, imgIndex) => (
                     <img 
                       key={imgIndex}
                       src={img} 
                       alt={`Uploaded ${imgIndex + 1}`}
                       className="max-h-32 rounded-lg border border-indigo-400/30 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                       onClick={() => window.open(img, '_blank')}
                     />
                   ))}
                 </div>
               )}
               <p className="whitespace-pre-wrap">{msg.content.replace(/\n\n📷 \[\d+ image\(s\) attached\]$/, '')}</p>
             </div>
           ) : (
             <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
           )}
         </div>
      </div>
    </div>
  );
});

export const LecturePanel: React.FC<LecturePanelProps> = ({ messages, isStreaming, onTranslate, onSaveMessage }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 relative">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
          <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6">
            <Sparkles size={40} className="text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">准备好学习了</h3>
          <p className="text-center max-w-sm text-slate-500">
            上传 PDF 课件，我将作为你的教授进行讲解。支持分批讲解、总结概念、模拟考试等功能。
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
            <span className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full">📄 PDF 讲解</span>
            <span className="px-3 py-1.5 bg-teal-100 text-teal-700 rounded-full">🎯 模拟考试</span>
            <span className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full">📝 试卷转文档</span>
            <span className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full">📚 笔记整理</span>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto p-6 space-y-8">
          {messages.map((msg, index) => (
            <MessageItem 
              key={`${index}-${msg.timestamp || index}`} 
              msg={msg} 
              index={index} 
              onTranslate={onTranslate}
              onSaveMessage={onSaveMessage}
            />
          ))}
          
          {isStreaming && (
             <div className="flex gap-4">
               <div className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-sm">
                 <Bot size={20} />
               </div>
               <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-2 w-24">
                  <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce delay-75"></div>
                  <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce delay-150"></div>
               </div>
             </div>
          )}
          <div ref={bottomRef} className="h-4" />
        </div>
      )}
    </div>
  );
};
