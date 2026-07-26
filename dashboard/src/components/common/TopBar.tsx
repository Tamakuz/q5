// dashboard/src/components/common/TopBar.tsx
import React, { useState, useEffect } from 'react';

import type { ContentMode } from './Sidebar';

interface TopBarProps {
  onResetProject?: () => void;
  contentMode: ContentMode;
}

const TopBar: React.FC<TopBarProps> = ({ onResetProject, contentMode }) => {
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [contentId, setContentId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        if (window.electronAPI?.getContentId) {
          const id = await window.electronAPI.getContentId(contentMode);
          setContentId(id);
        }
      } catch {}
    })();
  }, [contentMode]);

  const handleCopyId = async () => {
    if (!contentId) return;
    if (window.electronAPI?.copyToClipboard) {
      await window.electronAPI.copyToClipboard(contentId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      if (window.electronAPI?.resetProject) {
        const res = await window.electronAPI.resetProject(contentMode);
        if (res?.content_id) {
          setContentId(res.content_id);
        }
      }
      if (onResetProject) {
        onResetProject();
      }
    } catch (err) {
      console.error('Reset project error:', err);
    }
    setResetting(false);
    setShowConfirm(false);
    // Refresh mode state
    try {
      if (window.electronAPI?.getContentId) {
        const id = await window.electronAPI.getContentId(contentMode);
        setContentId(id);
      }
    } catch {}
  };

  return (
    <>
      <header className="flex items-center justify-between h-14 px-6 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg text-sm">🎬</span>
            Content Auto
          </h1>
          <span className="text-[10px] font-mono text-gray-400 bg-gray-800 px-2 py-0.5 rounded-md border border-gray-700">
            v0.1.0
          </span>

          {/* Mode Indicator Badge */}
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
            contentMode === 'shortform'
              ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80'
              : contentMode === 'longform'
              ? 'bg-purple-950/80 text-purple-300 border-purple-800/80'
              : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
          }`}>
            {contentMode === 'shortform' ? '📱 Shorts Mode' : contentMode === 'longform' ? '🍿 Alur Film Mode' : '✨ Spensia Mode'}
          </span>

          {/* Content ID Badge */}
          {contentId && (
            <button
              onClick={handleCopyId}
              title={`Click to copy Content ID for ${contentMode}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all text-xs font-mono border ml-1 ${
                contentMode === 'shortform'
                  ? 'bg-indigo-950/60 hover:bg-indigo-900/80 border-indigo-700/50 text-indigo-300'
                  : contentMode === 'longform'
                  ? 'bg-purple-950/60 hover:bg-purple-900/80 border-purple-700/50 text-purple-300'
                  : 'bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-700/50 text-emerald-300'
              }`}
            >
              <span>🆔</span>
              <span className="font-bold">{contentId}</span>
              <span className="text-[10px]">
                {copiedId ? '✓ Copied' : '📋'}
              </span>
            </button>
          )}
        </div>

        {/* Reset Workspace Action */}
        <button
          onClick={() => setShowConfirm(true)}
          className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 rounded-lg text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
        >
          <span>🔄</span>
          <span>New Content / Reset ID ({contentMode === 'shortform' ? 'Shorts' : contentMode === 'longform' ? 'Alur Film' : 'Spensia'})</span>
        </button>
      </header>

      {/* Glassmorphic Reset Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 bg-red-600/10 text-red-400 rounded-2xl flex items-center justify-center text-xl border border-red-500/20">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Reset Workspace & Content ID?</h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Tindakan ini akan membuat Content ID baru untuk kategori <strong className="text-white uppercase">{contentMode}</strong> dan membersihkan data temporer proyek.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={resetting}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={resetting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-red-600/30 flex items-center gap-1.5"
              >
                {resetting ? 'Resetting...' : 'Ya, Generate Content ID Baru'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopBar;
