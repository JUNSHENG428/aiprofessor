import React, { useState, useEffect } from 'react';
import { AppSettings, DEFAULT_SETTINGS, APIProvider, TeachingStyle, ThemeMode } from '../types';
import { PRESET_MODELS, PRESET_URLS, TEACHING_STYLES } from '../constants';
import { Button } from './Button';
import { validateConnection } from '../services/aiService';
import { Settings, Check, AlertCircle, X, Key, Link2, Sparkles, MessageCircle, Sun, Moon, Monitor } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentSettings, onSave }) => {
  const [settings, setSettings] = useState<AppSettings>(currentSettings);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings, isOpen]);

  const handleProviderChange = (provider: APIProvider) => {
    setSettings(prev => ({
      ...prev,
      provider,
      model: PRESET_MODELS[provider]?.[0] || '',
      baseUrl: PRESET_URLS[provider] || ''
    }));
    setTestStatus('idle');
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus('idle');
    const success = await validateConnection(settings);
    setTestStatus(success ? 'success' : 'error');
    setIsTesting(false);
  };

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white/85 dark:bg-slate-900/80 backdrop-blur-xl border border-gray-200/70 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-white">
            <Settings size={22} />
            <h2 className="font-bold text-lg">Settings</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto bg-white dark:bg-slate-900">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">AI Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {(['gemini', 'openai', 'deepseek', 'ollama', 'custom'] as APIProvider[]).map(p => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`px-3 py-2.5 text-sm rounded-lg border capitalize transition-all ${
                    settings.provider === p 
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-medium shadow-sm dark:bg-indigo-500/15 dark:border-indigo-400/30 dark:text-indigo-200' 
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:border-white/15'
                  }`}
                >
                  {p === 'ollama' ? '🦙 Ollama' : p}
                </button>
              ))}
            </div>
            {settings.provider === 'ollama' && (
              <p className="mt-2 text-xs text-gray-500 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 p-2 rounded-lg border border-amber-100 dark:border-amber-400/20">
                💡 Ollama 是本地运行的 LLM 服务。确保已安装并运行 Ollama (默认端口 11434)。
                <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline ml-1">
                  下载 Ollama →
                </a>
              </p>
            )}
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">API Key</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key size={16} className="text-gray-400 dark:text-slate-400" />
              </div>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                className="pl-10 block w-full rounded-xl border-gray-300 dark:border-white/10 border py-2.5 px-3 text-sm bg-white dark:bg-white/5 text-slate-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/60 dark:focus:ring-indigo-400/30 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                placeholder={settings.provider === 'ollama' ? 'Not required for Ollama' : `Enter your ${settings.provider} API key`}
              />
            </div>
            {settings.provider === 'ollama' && (
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Ollama 本地服务不需要 API Key</p>
            )}
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Model</label>
            {PRESET_MODELS[settings.provider]?.length > 0 ? (
              <select
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                className="block w-full rounded-xl border-gray-300 dark:border-white/10 border py-2.5 px-3 text-sm bg-white dark:bg-white/5 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/60 dark:focus:ring-indigo-400/30 outline-none"
              >
                {PRESET_MODELS[settings.provider].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                className="block w-full rounded-xl border-gray-300 dark:border-white/10 border py-2.5 px-3 text-sm bg-white dark:bg-white/5 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/60 dark:focus:ring-indigo-400/30 outline-none"
                placeholder="e.g. gpt-4o"
              />
            )}
          </div>

          {/* Base URL (Optional) */}
          {(settings.provider === 'custom' || settings.provider === 'openai' || settings.provider === 'deepseek') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Base URL</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Link2 size={16} className="text-gray-400 dark:text-slate-400" />
                </div>
                <input
                  type="text"
                  value={settings.baseUrl}
                  onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                  className="pl-10 block w-full rounded-xl border-gray-300 dark:border-white/10 border py-2.5 px-3 text-sm font-mono bg-white dark:bg-white/5 text-gray-600 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/60 dark:focus:ring-indigo-400/30 outline-none"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
            </div>
          )}

          {/* Batch Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
              Batch Size <span className="text-gray-400 dark:text-slate-500 font-normal">(pages per explanation)</span>
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={settings.batchSize}
              onChange={(e) => setSettings({ ...settings, batchSize: parseInt(e.target.value) || 1 })}
              className="block w-full rounded-xl border-gray-300 dark:border-white/10 border py-2.5 px-3 text-sm bg-white dark:bg-white/5 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/60 dark:focus:ring-indigo-400/30 outline-none"
            />
          </div>

          {/* AI Enhancement Section */}
          <div className="pt-4 border-t border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={18} className="text-indigo-500 dark:text-indigo-400" />
              <h3 className="font-medium text-gray-800 dark:text-slate-100">AI 功能增强</h3>
            </div>
            
            {/* Teaching Style */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">教学风格</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(TEACHING_STYLES) as TeachingStyle[]).map(style => (
                  <button
                    key={style}
                    onClick={() => setSettings({ ...settings, teachingStyle: style })}
                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-xl border transition-all text-left ${
                      settings.teachingStyle === style
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-500/15 dark:border-indigo-400/30 dark:text-indigo-200'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
                    }`}
                  >
                    <span>{TEACHING_STYLES[style].icon}</span>
                    <div>
                      <span className="font-medium">{TEACHING_STYLES[style].name}</span>
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                {TEACHING_STYLES[settings.teachingStyle]?.description}
              </p>
            </div>
            
            {/* Multi-turn Context */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-200">
                  <MessageCircle size={14} className="text-gray-500 dark:text-slate-400" />
                  多轮对话上下文
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableContext}
                    onChange={(e) => setSettings({ ...settings, enableContext: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              {settings.enableContext && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-slate-400">保留</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={settings.contextTurns}
                    onChange={(e) => setSettings({ ...settings, contextTurns: parseInt(e.target.value) || 5 })}
                    className="w-16 rounded-lg border-gray-300 dark:border-white/10 border py-1 px-2 text-sm text-center bg-white dark:bg-white/5 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/60 dark:focus:ring-indigo-400/30 outline-none"
                  />
                  <span className="text-xs text-gray-500 dark:text-slate-400">轮对话上下文</span>
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                启用后，AI 会记住之前的对话内容，提供更连贯的回答
              </p>
            </div>
            
            {/* Custom Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                自定义提示词 <span className="text-gray-400 dark:text-slate-500 font-normal">(可选)</span>
              </label>
              <textarea
                value={settings.customPrompt || ''}
                onChange={(e) => setSettings({ ...settings, customPrompt: e.target.value })}
                placeholder="添加额外的教学指令，如：请用更多例子解释、请详细说明公式推导过程..."
                className="block w-full rounded-xl border-gray-300 dark:border-white/10 border py-2 px-3 text-sm bg-white dark:bg-white/5 text-slate-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/60 dark:focus:ring-indigo-400/30 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none resize-none h-20"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                这些指令会添加到每次 AI 回答中
              </p>
            </div>
          </div>

          {/* Theme Settings */}
          <div className="pt-4 border-t border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <Moon size={18} className="text-indigo-500" />
              <h3 className="font-medium text-gray-800 dark:text-slate-100">主题设置</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'light' as ThemeMode, icon: Sun, label: '浅色', desc: '明亮模式' },
                { value: 'dark' as ThemeMode, icon: Moon, label: '深色', desc: '暗黑模式' },
                { value: 'system' as ThemeMode, icon: Monitor, label: '跟随系统', desc: '自动切换' },
              ].map(({ value, icon: Icon, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setSettings({ ...settings, theme: value })}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                    settings.theme === value
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm dark:bg-indigo-500/15 dark:border-indigo-400/30 dark:text-indigo-200'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                >
                  <Icon size={20} className={settings.theme === value ? 'text-indigo-500 dark:text-indigo-300' : ''} />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-[10px] opacity-60">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Test Status */}
          {testStatus !== 'idle' && (
            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
              testStatus === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-400/20'
                : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-200 dark:border-red-400/20'
            }`}>
              {testStatus === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
              {testStatus === 'success' ? 'Connection Successful!' : 'Connection Failed. Check your Key/URL.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-white/5 px-6 py-4 border-t border-gray-100 dark:border-white/10 flex justify-between items-center">
          <Button variant="ghost" onClick={handleTestConnection} isLoading={isTesting} disabled={!settings.apiKey && settings.provider !== 'ollama'}>
            Test Connection
          </Button>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
