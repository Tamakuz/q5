// dashboard/src/components/longform/testing/AlurfilmTestingHub.tsx
import React, { useState } from 'react';
import AlurfilmIntroTestStep from './AlurfilmIntroTestStep';
import AlurfilmVisualOnlyTestStep from './AlurfilmVisualOnlyTestStep';

type SubTab = 'intro' | 'visual_only';

const AlurfilmTestingHub: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('visual_only');

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
          onClick={() => setActiveSubTab('visual_only')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
            activeSubTab === 'visual_only'
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-md shadow-amber-500/5'
              : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
          }`}
        >
          <span>🎥</span> No-VO Visual Clips Studio
        </button>
      </div>

      {/* Active Sub-Tab View */}
      {activeSubTab === 'intro' ? (
        <AlurfilmIntroTestStep />
      ) : (
        <AlurfilmVisualOnlyTestStep />
      )}
    </div>
  );
};

export default AlurfilmTestingHub;
