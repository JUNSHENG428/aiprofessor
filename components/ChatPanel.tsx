import React, { useRef, useEffect } from 'react';
import { Message } from '../types';
import { MarkdownView } from './MarkdownView';

interface ChatPanelProps {
  messages: Message[];
  isStreaming: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, isStreaming }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-white shadow-inner markdown-body">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-lg font-medium">Ready for the lecture</p>
          <p className="text-sm">Upload a PDF to start.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-4xl w-full p-4 rounded-xl ${
                  msg.role === 'user' 
                    ? 'bg-indigo-50 text-indigo-900 border border-indigo-100 ml-12' 
                    : 'bg-white text-gray-800'
                }`}
              >
                {msg.role === 'model' && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                    <div className="w-6 h-6 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold">
                      AI
                    </div>
                    <span className="text-sm font-semibold text-teal-700">Professor Gemini</span>
                  </div>
                )}
                <div className="prose prose-sm md:prose-base max-w-none text-slate-800">
                  <MarkdownView content={msg.content} />
                </div>
              </div>
            </div>
          ))}
          {isStreaming && (
             <div className="flex justify-start">
               <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                 <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                 </div>
               </div>
             </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};