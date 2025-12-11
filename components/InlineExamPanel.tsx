import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ClipboardCheck, ChevronRight, ChevronLeft, Send, RefreshCw, X, Loader2, GripVertical, CheckCircle, AlertCircle } from 'lucide-react';

interface InlineExamPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  examQuestions: string;
  isGenerating: boolean;
  onSubmitAnswers: (answers: string) => void;
  onRegenerateQuestions: () => void;
  gradingResult?: string;
  isGrading?: boolean;
}

// Component to display exam questions with answer hiding
const ExamQuestionsDisplay: React.FC<{ content: string }> = ({ content }) => {
  // Remove source/answer hints for display
  let displayContent = content
    .split('\n')
    .filter(line => !line.includes('【答案来源】') && !line.includes('**[Source]**') && !line.includes('[Source]'))
    .join('\n');
  
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>;
};

export const InlineExamPanel: React.FC<InlineExamPanelProps> = ({
  isOpen,
  onToggle,
  examQuestions,
  isGenerating,
  onSubmitAnswers,
  onRegenerateQuestions,
  gradingResult,
  isGrading
}) => {
  const [answers, setAnswers] = useState('');
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('ai_professor_exam_width');
    return saved ? parseInt(saved) : 380;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Save panel width
  useEffect(() => {
    localStorage.setItem('ai_professor_exam_width', panelWidth.toString());
  }, [panelWidth]);

  // Show result when grading is done
  useEffect(() => {
    if (gradingResult && !isGrading) {
      setShowResult(true);
    }
  }, [gradingResult, isGrading]);

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.min(Math.max(300, newWidth), 600));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleSubmit = () => {
    if (answers.trim()) {
      onSubmitAnswers(answers);
      setShowResult(false);
    }
  };

  const handleReset = () => {
    setAnswers('');
    setShowResult(false);
    onRegenerateQuestions();
  };

  return (
    <>
      {/* Collapsed Toggle Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-l-lg shadow-lg transition-all hover:-translate-x-0.5"
          title="Open Mock Exam"
        >
          <ClipboardCheck size={20} />
        </button>
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        style={{ width: isOpen ? `${panelWidth}px` : '0px' }}
        className={`bg-slate-900 flex flex-col transition-all duration-300 ease-in-out flex-shrink-0 overflow-hidden border-l border-slate-800 ${isResizing ? 'transition-none' : ''}`}
      >
        {/* Resize Handle */}
        {isOpen && (
          <div
            onMouseDown={handleMouseDown}
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-purple-500/50 transition-colors z-10 flex items-center"
          >
            <div className="w-full h-16 flex items-center justify-center">
              <GripVertical size={12} className="text-slate-600" />
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-purple-900/50 to-slate-900">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-600">
              <ClipboardCheck size={14} className="text-white" />
            </div>
            <div>
              <span className="font-semibold text-sm text-white">Mock Exam</span>
              <span className="text-[10px] text-purple-400 block">5 Questions</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              disabled={isGenerating || isGrading}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              title="Regenerate Questions"
            >
              <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onToggle}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Close"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isGenerating && !examQuestions ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-400/30 border-t-purple-500"></div>
                <ClipboardCheck size={16} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-400" />
              </div>
              <p className="mt-4 text-sm font-medium text-white">Generating questions...</p>
              <p className="text-xs text-slate-500 mt-1 text-center">Based on slide content</p>
            </div>
          ) : showResult && gradingResult ? (
            /* Grading Result View */
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span className="text-sm font-medium text-white">Grading Complete</span>
                </div>
                <button
                  onClick={() => setShowResult(false)}
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  Back to Questions
                </button>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 markdown-body-dark text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{gradingResult}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Questions Section */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                <div className="bg-purple-900/30 px-3 py-2 border-b border-slate-700 flex items-center gap-2">
                  <span className="text-sm">📋</span>
                  <span className="text-xs font-medium text-purple-300">Exam Questions</span>
                </div>
                <div className="p-3 markdown-body-dark text-xs">
                  {examQuestions ? (
                    <ExamQuestionsDisplay content={examQuestions} />
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <ClipboardCheck size={24} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No questions generated</p>
                      <button
                        onClick={onRegenerateQuestions}
                        className="mt-2 text-xs text-purple-400 hover:text-purple-300"
                      >
                        Generate Now
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Answer Section */}
              {examQuestions && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                  <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex items-center gap-2">
                    <span className="text-sm">✍️</span>
                    <span className="text-xs font-medium text-slate-300">Your Answers</span>
                  </div>
                  <div className="p-3">
                    <textarea
                      value={answers}
                      onChange={(e) => setAnswers(e.target.value)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 py-2.5 px-3 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-[180px] resize-none outline-none"
                      placeholder="Answer by question number:

Q1: [Your answer...]

Q2: [Your answer...]

Q3: [Your answer...]

Q4: [Your answer...]

Q5: [Your answer...]"
                    />
                    
                    {/* Tips */}
                    <div className="mt-2 flex items-start gap-2 text-[10px] text-slate-400 bg-amber-900/20 p-2 rounded-lg border border-amber-800/30">
                      <AlertCircle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>Use terminology from the slides for better scores.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {examQuestions && !showResult && (
          <div className="flex-shrink-0 px-4 py-3 bg-slate-800/50 border-t border-slate-800">
            <button
              onClick={handleSubmit}
              disabled={!answers.trim() || isGrading}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isGrading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Grading...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Submit for Grading</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

