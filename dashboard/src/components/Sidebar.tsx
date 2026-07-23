// dashboard/src/components/Sidebar.tsx
import React from 'react';

export type StepId = 'source' | 'analyze' | 'audio' | 'transcript' | 'mapping' | 'render' | 'upload';
export type ContentMode = 'shortform' | 'longform';

interface Step {
  id: StepId;
  icon: string;
  label: string;
}

const STEPS: Step[] = [
  { id: 'source', icon: '🎬', label: 'Source' },
  { id: 'analyze', icon: '⚡', label: 'Analyze' },
  { id: 'render', icon: '🎥', label: 'Render' },
  { id: 'upload', icon: '🚀', label: 'Publish' },
];

const LONGFORM_STEPS: Step[] = [
  { id: 'source', icon: '✂️', label: 'Splitter (10 Min)' },
  { id: 'analyze', icon: '⚡', label: 'Script Generator' },
  { id: 'audio', icon: '🎙️', label: 'Voice Over Audio' },
  { id: 'transcript', icon: '📝', label: 'Audio Transcript' },
  { id: 'mapping', icon: '🎯', label: 'Video Mapping' },
  { id: 'render', icon: '🎬', label: 'Video Render' },
];

interface SidebarProps {
  activeStep: StepId;
  onStepChange: (step: StepId) => void;
  contentMode: ContentMode;
  onModeChange: (mode: ContentMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeStep, onStepChange, contentMode, onModeChange }) => {
  const activeStepsList = contentMode === 'shortform' ? STEPS : LONGFORM_STEPS;

  return (
    <nav className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col py-4 shrink-0 justify-between">
      <div className="space-y-4">
        {/* Content Mode / Type Switcher */}
        <div className="px-3 pb-3 border-b border-gray-800 space-y-1.5">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block px-1">
            Content Category
          </span>
          <div className="grid grid-cols-2 gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => onModeChange('shortform')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1 ${
                contentMode === 'shortform'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              <span>📱</span> Shorts
            </button>
            <button
              onClick={() => onModeChange('longform')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1 ${
                contentMode === 'longform'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              <span>🍿</span> Alur Film
            </button>
          </div>
        </div>

        {/* Step Navigation Buttons */}
        <div className="space-y-1">
          <div className="px-4 pb-1 flex items-center justify-between text-[11px] text-gray-500 font-mono">
            <span>WORKFLOW</span>
            <span className={contentMode === 'shortform' ? 'text-indigo-400' : 'text-purple-400'}>
              {contentMode === 'shortform' ? '9:16 Shorts' : '16:9 Alur Film'}
            </span>
          </div>

          {activeStepsList.map((step) => {
            const isActive = activeStep === step.id;
            return (
              <button
                key={step.id}
                onClick={() => onStepChange(step.id)}
                className={`
                  flex items-center gap-3 px-5 py-3 mx-2 rounded-lg text-sm font-medium
                  transition-all duration-150 text-left w-[calc(100%-16px)]
                  ${isActive
                    ? contentMode === 'shortform'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }
                `}
              >
                <span className="text-lg">{step.icon}</span>
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Info Badge */}
      <div className="px-4 pt-4 border-t border-gray-800">
        <div className="p-3 bg-gray-950 rounded-xl border border-gray-800 space-y-1 text-xs">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Active Content Type</span>
          <p className="font-bold text-white text-[11px]">
            {contentMode === 'shortform' ? '📱 TikTok / YouTube Shorts' : '🍿 Alur Cerita Film (16:9)'}
          </p>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
