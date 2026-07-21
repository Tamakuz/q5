// dashboard/src/components/TopBar.tsx
import React, { useState } from 'react';

interface TopBarProps {
  onResetProject?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onResetProject }) => {
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      if (window.electronAPI?.resetProject) {
        await window.electronAPI.resetProject();
      }
      if (onResetProject) {
        onResetProject();
      }
    } catch (err) {
      console.error('Reset project error:', err);
    }
    setResetting(false);
    setShowConfirm(false);
    // Force clean UI reload so all React component states and cached assets re-initialize fresh
    window.location.reload();
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
        </div>

        {/* Reset Workspace Action */}
        <button
          onClick={() => setShowConfirm(true)}
          className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 rounded-lg text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
        >
          <span>🔄</span>
          <span>New Content / Reset Workspace</span>
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
              <h3 className="text-base font-bold text-white">Reset Workspace?</h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Tindakan ini akan menghapus data transkrip, mapping JSON, file video di input & output, serta aset sementara untuk memulai pembuatan konten video baru dari awal.
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
                {resetting ? 'Resetting...' : 'Ya, Reset Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopBar;
