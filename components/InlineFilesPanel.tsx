import React, { useState, useEffect, useRef } from 'react';
import { FileRecord, Session } from '../types';
import { FileText, Trash2, Upload, FolderOpen, MessageSquare, ChevronLeft, Plus, Search, MoreVertical, History, File, HardDrive } from 'lucide-react';
import { getFileRecords, getSessions, deleteFileRecord, deleteSession, getStorageStats } from '../services/storageService';

interface InlineFilesPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onSelectFile: (fileRecord: FileRecord, session?: Session) => void;
  onUploadFile: (file: File) => void;
  currentFileId?: string;
}

export const InlineFilesPanel: React.FC<InlineFilesPanelProps> = ({
  isOpen,
  onToggle,
  onSelectFile,
  onUploadFile,
  currentFileId
}) => {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedTab, setSelectedTab] = useState<'files' | 'history'>('files');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState({ usedMB: 0, percentUsed: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load files and sessions using storage service
  useEffect(() => {
    const loadData = () => {
      setFiles(getFileRecords());
      setSessions(getSessions());
      setStorageInfo(getStorageStats());
    };
    
    loadData();
    
    // Listen for storage changes
    window.addEventListener('storage', loadData);
    
    // Refresh when panel opens
    if (isOpen) {
      loadData();
    }
    
    return () => window.removeEventListener('storage', loadData);
  }, [isOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    if (activeMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenu]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      onUploadFile(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Delete file record using storage service
  const handleDeleteFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this file and all associated sessions?')) {
      deleteFileRecord(id);
      setFiles(getFileRecords());
      setSessions(getSessions());
      setStorageInfo(getStorageStats());
    }
    setActiveMenu(null);
  };

  // Delete session using storage service
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this session?')) {
      deleteSession(id);
      setSessions(getSessions());
      setStorageInfo(getStorageStats());
    }
    setActiveMenu(null);
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Format date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Filter items by search
  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredSessions = sessions.filter(s => 
    s.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      {/* Collapsed Toggle Button */}
      {!isOpen && (
        <div className="w-12 flex-shrink-0 bg-slate-900 flex flex-col items-center py-4 gap-3 border-r border-slate-800">
          <button
            onClick={onToggle}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all hover:scale-105 shadow-lg shadow-indigo-500/20"
            title="Open Files"
          >
            <FolderOpen size={18} />
          </button>
          
          {/* Quick stats */}
          <div className="flex flex-col items-center gap-2 mt-2">
            <div className="text-center">
              <div className="text-xs font-bold text-white">{files.length}</div>
              <div className="text-[9px] text-slate-500">files</div>
            </div>
            <div className="w-6 h-px bg-slate-700"></div>
            <div className="text-center">
              <div className="text-xs font-bold text-white">{sessions.length}</div>
              <div className="text-[9px] text-slate-500">sessions</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Panel */}
      <div className={`bg-slate-900 flex flex-col transition-all duration-300 ease-in-out flex-shrink-0 ${isOpen ? 'w-64' : 'w-0'} overflow-hidden border-r border-slate-800`}>
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-600">
              <FolderOpen size={14} className="text-white" />
            </div>
            <span className="font-semibold text-sm text-white">Files</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Upload PDF"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={onToggle}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Collapse"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mx-3 mb-2 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setSelectedTab('files')}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
              selectedTab === 'files'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <File size={12} />
            Files
          </button>
          <button
            onClick={() => setSelectedTab('history')}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
              selectedTab === 'history'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History size={12} />
            History
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
          {selectedTab === 'files' ? (
            <div className="space-y-1">
              {/* Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 border border-dashed border-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 hover:border-indigo-500 hover:bg-indigo-500/10 transition-all flex items-center justify-center gap-2 text-xs mb-2"
              >
                <Upload size={14} />
                <span>Upload PDF</span>
              </button>

              {/* Files List */}
              {filteredFiles.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-800 flex items-center justify-center">
                    <FileText size={24} className="text-slate-600" />
                  </div>
                  <p className="text-xs font-medium text-slate-400">No files yet</p>
                  <p className="text-xs text-slate-600 mt-1">Upload a PDF to start</p>
                </div>
              ) : (
                filteredFiles.map(file => (
                  <div
                    key={file.id}
                    className={`group relative flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${
                      currentFileId === file.id
                        ? 'bg-indigo-600/20 ring-1 ring-indigo-500/50'
                        : 'hover:bg-slate-800'
                    }`}
                    onClick={() => {
                      const session = sessions.find(s => s.fileId === file.id);
                      onSelectFile(file, session);
                    }}
                  >
                    <div className={`p-2 rounded-lg flex-shrink-0 ${
                      currentFileId === file.id ? 'bg-indigo-600' : 'bg-slate-800'
                    }`}>
                      <FileText size={14} className={currentFileId === file.id ? 'text-white' : 'text-slate-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-xs truncate ${
                        currentFileId === file.id ? 'text-white' : 'text-slate-300'
                      }`}>{file.name}</p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                        <span>{formatSize(file.size)}</span>
                        <span className="text-slate-600">•</span>
                        <span>{file.pageCount}p</span>
                        <span className="text-slate-600">•</span>
                        <span>{formatDate(file.uploadedAt)}</span>
                      </div>
                    </div>
                    
                    {/* Action Menu */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === file.id ? null : file.id);
                        }}
                        className="p-1 text-slate-500 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-700"
                      >
                        <MoreVertical size={14} />
                      </button>
                      
                      {activeMenu === file.id && (
                        <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50 min-w-[100px]">
                          <button
                            onClick={(e) => handleDeleteFile(file.id, e)}
                            className="w-full px-3 py-1.5 text-xs text-left text-red-400 hover:bg-red-500/20 flex items-center gap-2"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Sessions List */
            <div className="space-y-1">
              {filteredSessions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-800 flex items-center justify-center">
                    <MessageSquare size={24} className="text-slate-600" />
                  </div>
                  <p className="text-xs font-medium text-slate-400">No sessions</p>
                  <p className="text-xs text-slate-600 mt-1">Chat history appears here</p>
                </div>
              ) : (
                filteredSessions.map(session => {
                  const hasFullData = session.parsedPages && session.parsedPages.length > 0;
                  const file = files.find(f => f.id === session.fileId);
                  
                  return (
                    <div
                      key={session.id}
                      className={`group relative flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${
                        currentFileId === session.fileId
                          ? 'bg-purple-600/20 ring-1 ring-purple-500/50'
                          : 'hover:bg-slate-800'
                      }`}
                      onClick={() => {
                        onSelectFile(file || { id: session.fileId, name: session.fileName, size: 0, uploadedAt: 0, pageCount: 0 }, session);
                      }}
                    >
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        currentFileId === session.fileId ? 'bg-purple-600' : 'bg-slate-800'
                      }`}>
                        <MessageSquare size={14} className={currentFileId === session.fileId ? 'text-white' : 'text-purple-400'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`font-medium text-xs truncate ${
                            currentFileId === session.fileId ? 'text-white' : 'text-slate-300'
                          }`}>{session.fileName}</p>
                          {hasFullData && (
                            <span className="flex-shrink-0 text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">✓</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                          <span>💬 {session.messages.length}</span>
                          {hasFullData && <span>📄 {session.parsedPages.length}p</span>}
                          <span className="text-slate-600">•</span>
                          <span>{formatDate(session.updatedAt)}</span>
                        </div>
                      </div>
                      
                      {/* Action Menu */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(activeMenu === session.id ? null : session.id);
                          }}
                          className="p-1 text-slate-500 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-700"
                        >
                          <MoreVertical size={14} />
                        </button>
                        
                        {activeMenu === session.id && (
                          <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50 min-w-[100px]">
                            <button
                              onClick={(e) => handleDeleteSession(session.id, e)}
                              className="w-full px-3 py-1.5 text-xs text-left text-red-400 hover:bg-red-500/20 flex items-center gap-2"
                            >
                              <Trash2 size={12} />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer with Storage Info */}
        <div className="flex-shrink-0 px-3 py-2 bg-slate-800/50 border-t border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>{files.length} files</span>
            <span>{sessions.length} sessions</span>
          </div>
          
          {/* Storage Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] text-slate-500">
              <span className="flex items-center gap-1">
                <HardDrive size={10} />
                Storage
              </span>
              <span className={storageInfo.percentUsed > 80 ? 'text-amber-400' : ''}>
                {storageInfo.usedMB}MB ({storageInfo.percentUsed}%)
              </span>
            </div>
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  storageInfo.percentUsed > 80 
                    ? 'bg-amber-500' 
                    : storageInfo.percentUsed > 50 
                      ? 'bg-blue-500' 
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, storageInfo.percentUsed)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
