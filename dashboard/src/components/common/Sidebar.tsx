// dashboard/src/components/common/Sidebar.tsx
import React from 'react';

export type StepId = 'source' | 'analyze' | 'audio' | 'transcript' | 'mapping' | 'render' | 'upload' | 'publish' | 'thumbnail';
export type ContentMode = 'longform' | 'shorts';

interface Step {
  id: StepId;
  icon: string;
  label: string;
  subText: string;
  shortLabel?: string;
}

const LONGFORM_STEPS: Step[] = [
  { id: 'source', icon: '✂️', label: '1. Splitter (20 Min)', subText: 'Cut raw movie into parts' },
  { id: 'analyze', icon: '⚡', label: '2. Script Generator', subText: 'AI Studio recap story script' },
  { id: 'audio', icon: '🎙️', label: '3. Voice Over Audio', subText: 'TTS voice narration upload' },
  { id: 'transcript', icon: '📝', label: '4. Audio Transcript', subText: 'Voiceover transcript & sync' },
  { id: 'mapping', icon: '🎯', label: '5. Video Mapping', subText: 'Visual cuts per sentence' },
  { id: 'render', icon: '🎬', label: '6. Video Render', subText: 'Render & merge final movie' },
  { id: 'upload', icon: '🚀', label: '7. Metadata Hub', subText: 'AI SEO Title, Description & Tags' },
];

const SHORTS_STEPS: Step[] = [
  { id: 'analyze', icon: '⚡', label: '1. Prompt & Script Studio', subText: 'AI Director: 8-Shot & VO JSON' },
  { id: 'render', icon: '🎬', label: '2. Video Merger (Part 1 & 2)', subText: 'Upload & gabung video linier' },
];

interface SidebarProps {
  activeStep: StepId;
  onStepChange: (step: StepId) => void;
  contentMode: ContentMode;
  onModeChange: (mode: ContentMode) => void;
  longformTab?: 'main' | 'testing';
  onLongformTabChange?: (tab: 'main' | 'testing') => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeStep,
  onStepChange,
  contentMode,
  onModeChange,
  longformTab = 'main',
  onLongformTabChange,
}) => {
  const activeStepsList = LONGFORM_STEPS;

  return (
    <nav className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col py-4 shrink-0 justify-between">
      <div className="space-y-4">
        {/* Content Mode Switcher */}
        <div className="px-3 pb-3 border-b border-gray-800 space-y-1.5">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block px-1">
            Content Category
          </span>
          <div className="grid grid-cols-2 gap-1.5 bg-gray-950 p-1.5 rounded-xl border border-gray-800">
            <button
              onClick={() => onModeChange('longform')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                contentMode === 'longform'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
            >
              <span>🍿</span> Film (16:9)
            </button>
            <button
              onClick={() => onModeChange('shorts')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                contentMode === 'shorts'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
            >
              <span>⚡</span> Shorts (9:16)
            </button>
          </div>
        </div>

        {/* Step Navigation Buttons */}
        <div className="space-y-1">
          <div className="px-4 pb-1.5 flex items-center justify-between text-[11px] text-gray-500 font-mono">
            <span>WORKFLOW STEPS</span>
            <span className={contentMode === 'shorts' ? 'text-amber-400 font-bold' : 'text-purple-400 font-bold'}>
              {contentMode === 'shorts' ? '9:16 Shorts' : '16:9 Alur Film'}
            </span>
          </div>

          {contentMode === 'longform' ? (
            <>
              <div className="px-3 pb-2 pt-0.5">
                <div className="grid grid-cols-2 gap-1 bg-gray-950 p-1 rounded-lg border border-purple-900/40">
                  <button
                    onClick={() => onLongformTabChange?.('main')}
                    className={`py-1 px-2 rounded-md text-[10px] font-bold transition-all text-center flex items-center justify-center gap-1 ${
                      longformTab === 'main'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                    }`}
                  >
                    <span>📋</span> Main
                  </button>
                  <button
                    onClick={() => onLongformTabChange?.('testing')}
                    className={`py-1 px-2 rounded-md text-[10px] font-bold transition-all text-center flex items-center justify-center gap-1 ${
                      longformTab === 'testing'
                        ? 'bg-amber-500 text-gray-950 shadow font-extrabold'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                    }`}
                  >
                    <span>🧪</span> Testing
                  </button>
                </div>
              </div>

              {activeStepsList.map((step) => {
                const isActive = activeStep === step.id;
                return (
                  <button
                    key={step.id}
                    onClick={() => onStepChange(step.id)}
                    className={`
                      group flex items-start gap-3 px-3.5 py-2.5 mx-2 rounded-xl text-xs font-semibold
                      transition-all duration-150 text-left w-[calc(100%-16px)] border
                      ${isActive
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                        : 'bg-transparent border-transparent text-gray-400 hover:bg-gray-800/80 hover:text-gray-200'
                      }
                    `}
                  >
                    <span className="text-base mt-0.5">{step.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold flex items-center justify-between">
                        <span>{step.label}</span>
                      </div>
                      <span
                        className={`text-[10px] block font-normal truncate mt-0.5 ${isActive
                          ? 'text-white opacity-90'
                          : 'text-gray-500 group-hover:text-gray-400'
                          }`}
                      >
                        {step.subText}
                      </span>
                    </div>
                  </button>
                );
              })}
            </>
          ) : (
            <div className="space-y-1">
              {SHORTS_STEPS.map((step) => {
                const isActive = step.id === 'render' ? activeStep === 'render' : activeStep !== 'render';
                return (
                  <button
                    key={step.id}
                    onClick={() => onStepChange(step.id)}
                    className={`
                      group flex items-start gap-3 px-3.5 py-2.5 mx-2 rounded-xl text-xs font-semibold
                      transition-all duration-150 text-left w-[calc(100%-16px)] border
                      ${isActive
                        ? 'bg-amber-500 border-amber-400 text-gray-950 shadow-lg shadow-amber-500/30 font-bold'
                        : 'bg-transparent border-transparent text-gray-400 hover:bg-gray-800/80 hover:text-gray-200'
                      }
                    `}
                  >
                    <span className="text-base mt-0.5">{step.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold flex items-center justify-between">
                        <span>{step.label}</span>
                      </div>
                      <span
                        className={`text-[10px] block font-normal truncate mt-0.5 ${isActive
                          ? 'text-gray-900 font-semibold'
                          : 'text-gray-500 group-hover:text-gray-400'
                          }`}
                      >
                        {step.subText}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Branding Info */}
      <div className="px-4 pt-3 border-t border-gray-800/80">
        <div className="bg-gray-950 p-3 rounded-xl border border-gray-800/80 space-y-1">
          <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">
            ACTIVE WORKFLOW MODE
          </span>
          <span className={`text-xs font-bold block ${contentMode === 'shorts' ? 'text-amber-400' : 'text-purple-400'}`}>
            {contentMode === 'shorts' ? '⚡ YouTube Shorts (9:16)' : '🍿 Alur Cerita Film (16:9)'}
          </span>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
