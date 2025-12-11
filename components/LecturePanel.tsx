
import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../types';
import { Bot, User, Sparkles, Copy, Check, Languages } from 'lucide-react';

interface LecturePanelProps {
  messages: Message[];
  isStreaming: boolean;
  onTranslate?: (index: number, content: string) => void;
}

const MessageItem: React.FC<{ msg: Message; index: number; onTranslate?: (index: number, content: string) => void }> = ({ msg, index, onTranslate }) => {
  const [copied, setCopied] = useState(false);
  const [translating, setTranslating] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const handleTranslateClick = () => {
    if (onTranslate && !translating) {
      setTranslating(true);
      // We don't await here because the parent handles the streaming
      onTranslate(index, msg.content);
      // Reset translating state after a bit or let parent control. 
      // For simplicity, we just toggle it off after 1s or leave it since the stream will start.
      setTimeout(() => setTranslating(false), 1000);
    }
  };

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
             {/* Translate Button (Only for AI messages) */}
             {msg.role === 'model' && onTranslate && (
               <button
                 onClick={handleTranslateClick}
                 className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-500"
                 title="Translate to Chinese"
               >
                 <Languages size={14} />
               </button>
             )}
             
             {/* Copy Button */}
             <button
               onClick={handleCopy}
               className={`p-1.5 rounded-md ${
                 msg.role === 'user' 
                  ? 'bg-indigo-500 hover:bg-indigo-400 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
               }`}
               title="Copy text"
             >
               {copied ? <Check size={14} /> : <Copy size={14} />}
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
};

export const LecturePanel: React.FC<LecturePanelProps> = ({ messages, isStreaming, onTranslate }) => {
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
          <h3 className="text-xl font-bold text-slate-700 mb-2">Ready to Learn</h3>
          <p className="text-center max-w-sm text-slate-500">
            Upload a PDF and I will act as your professor. I can explain slides in batches, summarize concepts, and help you prepare for exams.
          </p>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto p-6 space-y-8">
          {messages.map((msg, index) => (
            <MessageItem key={index} msg={msg} index={index} onTranslate={onTranslate} />
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
