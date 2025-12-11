import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Note } from '../types';
import { Plus, Trash2, Edit3, Save, X, StickyNote, Check, Copy, Download, Clipboard } from 'lucide-react';

interface InlineNotesPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  currentFileId?: string;
  currentFileName?: string;
}

export const InlineNotesPanel: React.FC<InlineNotesPanelProps> = ({ 
  isOpen, 
  onToggle,
  currentFileId,
  currentFileName
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load notes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ai_professor_notes');
    if (saved) {
      setNotes(JSON.parse(saved));
    }
  }, []);

  // Save notes to localStorage
  const saveNotes = (updatedNotes: Note[]) => {
    setNotes(updatedNotes);
    localStorage.setItem('ai_professor_notes', JSON.stringify(updatedNotes));
  };

  // Start new note
  const handleNewNote = () => {
    setIsEditing(true);
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  // Edit existing note
  const handleEditNote = (note: Note) => {
    setIsEditing(true);
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  // Save note
  const handleSaveNote = () => {
    if (!noteTitle.trim()) return;

    if (editingNote) {
      // Update existing
      const updatedNotes = notes.map(n => 
        n.id === editingNote.id 
          ? { ...n, title: noteTitle, content: noteContent, updatedAt: Date.now() }
          : n
      );
      saveNotes(updatedNotes);
    } else {
      // Create new
      const newNote: Note = {
        id: Date.now().toString(),
        title: noteTitle,
        content: noteContent,
        fileId: currentFileId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      saveNotes([newNote, ...notes]);
    }

    setIsEditing(false);
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    
    // Show saved indicator
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  // Delete note
  const handleDeleteNote = (id: string) => {
    if (confirm('Delete this note?')) {
      saveNotes(notes.filter(n => n.id !== id));
      if (editingNote?.id === id) {
        setIsEditing(false);
        setEditingNote(null);
      }
    }
  };

  // Delete all notes
  const handleDeleteAllNotes = () => {
    if (notes.length === 0) return;
    if (confirm(`Delete all ${notes.length} notes? This cannot be undone.`)) {
      saveNotes([]);
      setIsEditing(false);
      setEditingNote(null);
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setIsEditing(false);
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
  };

  // Copy single note
  const handleCopyNote = async (note: Note) => {
    const text = `# ${note.title}\n\n${note.content}`;
    try {
      await navigator.clipboard.writeText(text);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Copy all notes
  const handleCopyAllNotes = async () => {
    if (filteredNotes.length === 0) return;
    
    const allNotesText = filteredNotes.map(note => {
      const date = new Date(note.createdAt).toLocaleDateString();
      return `# ${note.title}\n_Created: ${date}_\n\n${note.content}`;
    }).join('\n\n---\n\n');
    
    const header = `# 📝 My Notes\n_Exported on ${new Date().toLocaleString()}_\n_Total: ${filteredNotes.length} notes_\n\n---\n\n`;
    
    try {
      await navigator.clipboard.writeText(header + allNotesText);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Export all notes as Markdown file
  const handleExportNotes = () => {
    if (filteredNotes.length === 0) return;
    
    const allNotesText = filteredNotes.map(note => {
      const date = new Date(note.createdAt).toLocaleDateString();
      return `# ${note.title}\n_Created: ${date}_\n\n${note.content}`;
    }).join('\n\n---\n\n');
    
    const header = `# 📝 My Notes\n_Exported on ${new Date().toLocaleString()}_\n_Total: ${filteredNotes.length} notes_\n\n---\n\n`;
    
    const blob = new Blob([header + allNotesText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes_${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Quick note from selection
  const handleQuickNote = () => {
    const selection = window.getSelection()?.toString();
    if (selection) {
      setNoteContent(prev => prev + (prev ? '\n\n' : '') + `> ${selection}`);
      if (!isEditing) {
        setIsEditing(true);
        setNoteTitle('Quick Note');
      }
    }
  };

  // Filter notes for current file
  const filteredNotes = currentFileId 
    ? notes.filter(n => n.fileId === currentFileId || !n.fileId)
    : notes;

  return (
    <div className={`border-l border-gray-200 bg-white flex flex-col transition-all duration-300 ${isOpen ? 'w-80' : 'w-0'} overflow-hidden`}>
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <StickyNote size={18} />
          <span className="font-semibold text-sm">Notes</span>
          <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">
            {filteredNotes.length}
          </span>
          {showSaved && (
            <span className="flex items-center gap-1 text-xs bg-green-500/30 px-2 py-0.5 rounded-full">
              <Check size={12} /> Saved
            </span>
          )}
          {showCopied && (
            <span className="flex items-center gap-1 text-xs bg-blue-500/30 px-2 py-0.5 rounded-full">
              <Check size={12} /> Copied
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewNote}
            className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors"
            title="New Note"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors"
            title="Close Notes"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Action Bar */}
      {!isEditing && filteredNotes.length > 0 && (
        <div className="flex-shrink-0 px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopyAllNotes}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-md transition-colors"
              title="Copy all notes to clipboard"
            >
              <Clipboard size={12} />
              Copy All
            </button>
            <button
              onClick={handleExportNotes}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded-md transition-colors"
              title="Export notes as Markdown file"
            >
              <Download size={12} />
              Export
            </button>
          </div>
          <button
            onClick={handleDeleteAllNotes}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded-md transition-colors"
            title="Delete all notes"
          >
            <Trash2 size={12} />
            Clear All
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isEditing ? (
          /* Edit Mode */
          <div className="p-3 space-y-3">
            <input
              type="text"
              placeholder="Note title..."
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
            />
            <textarea
              ref={textareaRef}
              placeholder="Write your note... (Markdown supported)"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="w-full h-40 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="flex-1 px-3 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                disabled={!noteTitle.trim()}
                className="flex-1 px-3 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <Save size={14} />
                Save
              </button>
            </div>
          </div>
        ) : (
          /* Notes List */
          <div className="p-3 space-y-2">
            {/* Quick note tip */}
            <div className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg border border-dashed border-gray-200">
              💡 Select text in the lecture and click <button onClick={handleQuickNote} className="text-amber-600 font-medium hover:underline">here</button> to add to notes
            </div>

            {filteredNotes.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <StickyNote size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notes yet</p>
                <button
                  onClick={handleNewNote}
                  className="mt-2 text-amber-600 text-sm hover:underline"
                >
                  + Create your first note
                </button>
              </div>
            ) : (
              filteredNotes.map(note => (
                <div
                  key={note.id}
                  className="bg-amber-50/50 border border-amber-100 rounded-lg overflow-hidden hover:shadow-sm transition-shadow"
                >
                  <div className="px-3 py-2 flex items-center justify-between border-b border-amber-100">
                    <h4 className="font-medium text-sm text-gray-800 truncate flex-1">{note.title}</h4>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleCopyNote(note)}
                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                        title="Copy note"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={() => handleEditNote(note)}
                        className="p-1 text-gray-400 hover:text-amber-600 transition-colors"
                        title="Edit"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-2 text-xs text-gray-600 max-h-24 overflow-y-auto markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {note.content || '*No content*'}
                    </ReactMarkdown>
                  </div>
                  <div className="px-3 py-1 bg-gray-50/50 border-t border-amber-100 text-[10px] text-gray-400">
                    {new Date(note.updatedAt).toLocaleDateString()} {new Date(note.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {currentFileName && (
        <div className="flex-shrink-0 px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          📄 {currentFileName}
        </div>
      )}
    </div>
  );
};
