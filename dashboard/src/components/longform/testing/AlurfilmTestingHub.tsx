// dashboard/src/components/longform/testing/AlurfilmTestingHub.tsx
import React, { useState } from 'react';
import AlurfilmIntroTestStep from './AlurfilmIntroTestStep';

type SubTab = 'intro' | 'feature_slot_2';

const AlurfilmTestingHub: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('intro');

  return (
    <div className="space-y-6">
      {/* Sub-Tab Menu Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
        <button
          onClick={() => setActiveSubTab('intro')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
            activeSubTab === 'intro'
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-md shadow-amber-500/5'
              : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
          }`}
        >
          <span>🎬</span> Intro Studio Test
        </button>

        <button
          onClick={() => setActiveSubTab('feature_slot_2')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
            activeSubTab === 'feature_slot_2'
              ? 'bg-purple-500/10 border-purple-500/40 text-purple-300 shadow-md shadow-purple-500/5'
              : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
          }`}
        >
          <span>🔮</span> Feature Test Slot (Coming Soon)
        </button>
      </div>

      {/* Active Sub-Tab View */}
      {activeSubTab === 'intro' ? (
        <AlurfilmIntroTestStep />
      ) : (
        <div className="flex flex-col items-center justify-center p-16 bg-gray-900/60 border border-dashed border-gray-800 rounded-3xl text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center text-3xl border border-purple-500/20">
            🔮
          </div>
          <h3 className="text-base font-bold text-white">Slot Experimental Feature</h3>
          <p className="text-xs text-gray-400 max-w-sm">
            Area ini disiapkan untuk pengujian fitur-fitur baru Alur Film mendatang.
          </p>
        </div>
      )}
    </div>
  );
};

export default AlurfilmTestingHub;
