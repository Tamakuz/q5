// dashboard/src/components/common/Sidebar.tsx
import React from 'react';

export type StepId = 'source' | 'analyze' | 'audio' | 'transcript' | 'mapping' | 'render' | 'upload' | 'publish' | 'thumbnail';
export type ContentMode = 'shortform' | 'longform' | 'spensia';

interface Step {
  id: StepId;
  icon: string;
  label: string;
  subText: string;
  shortLabel?: string;
}

const SHORTFORM_STEPS: Step[] = [
  { id: 'source', icon: '📁', label: '1. Source Assets', subText: 'Upload master raw video' },
  { id: 'analyze', icon: '⚡', label: '2. Video Analysis', subText: 'AI scene & hook analysis' },
  { id: 'transcript', icon: '📝', label: '3. Audio Transcript', subText: 'Subtitles & speech sync' },
  { id: 'render', icon: '🎬', label: '4. Render Video', shortLabel: 'Render', subText: '9:16 Shorts export' },
  { id: 'upload', icon: '🚀', label: '5. Publish Hub', subText: 'TikTok & Shorts metadata' },
];

const LONGFORM_STEPS: Step[] = [
  { id: 'source', icon: '✂️', label: '1. Splitter (20 Min)', subText: 'Cut raw movie into parts' },
  { id: 'analyze', icon: '⚡', label: '2. Script Generator', subText: 'AI Studio recap story script' },
  { id: 'audio', icon: '🎙️', label: '3. Voice Over Audio', subText: 'TTS voice narration upload' },
  { id: 'transcript', icon: '📝', label: '4. Audio Transcript', subText: 'Voiceover transcript & sync' },
  { id: 'mapping', icon: '🎯', label: '5. Video Mapping', subText: 'Visual cuts per sentence' },
  { id: 'render', icon: '🎬', label: '6. Video Render', subText: 'Render & merge final movie' },
  { id: 'upload', icon: '🚀', label: '7. Metadata Hub', subText: 'AI SEO Title, Description & Tags' },
];

const SPENSIA_STEPS: Step[] = [
  { id: 'source', icon: '💡', label: '1. Topics Generator', subText: 'Ide topik & fakta kontraintuitif' },
  { id: 'analyze', icon: '⚡', label: '2. Script Generator', subText: 'Naskah voiceover Style DNA Spensia' },
  { id: 'audio', icon: '✂️', label: '3. Scene Splitter', subText: 'Breakdown segmen visual adegan' },
  { id: 'mapping', icon: '🎨', label: '4. Image Prompt Generator', subText: 'Visual Style DNA Spensia prompts' },
  { id: 'render', icon: '🖼️', label: '5. Image Generator', subText: 'Generate ilustrasi adegan Google Flow' },
  { id: 'publish', icon: '🎙️', label: '6. Voice Over Generator', subText: 'Prompt TTS & Upload Audio Spensia' },
  { id: 'transcript', icon: '🎯', label: '7. Timeline & Mapping Studio', subText: 'Build timeline mapping & JSON sync' },
  { id: 'upload', icon: '🎬', label: '8. Render Studio (16:9)', subText: 'Watermark, caption, BGM & export' },
  { id: 'thumbnail', icon: '🚀', label: '9. Publish Hub & Thumbnail', subText: 'AI SEO Title, Tags, Description & 3x Thumbnail' },
];

interface SidebarProps {
  activeStep: StepId;
  onStepChange: (step: StepId) => void;
  contentMode: ContentMode;
  onModeChange: (mode: ContentMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeStep, onStepChange, contentMode, onModeChange }) => {
  const activeStepsList =
    contentMode === 'shortform'
      ? SHORTFORM_STEPS
      : contentMode === 'longform'
        ? LONGFORM_STEPS
        : SPENSIA_STEPS;

  return (
    <nav className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col py-4 shrink-0 justify-between">
      <div className="space-y-4">
        {/* Content Mode / Type Switcher */}
        <div className="px-3 pb-3 border-b border-gray-800 space-y-1.5">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block px-1">
            Content Category
          </span>
          <div className="grid grid-cols-3 gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => onModeChange('shortform')}
              className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1 ${contentMode === 'shortform'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
            >
              <span>📱</span> Shorts
            </button>
            <button
              onClick={() => onModeChange('longform')}
              className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1 ${contentMode === 'longform'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
            >
              <span>🍿</span> Film
            </button>
            <button
              onClick={() => onModeChange('spensia')}
              className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1 ${contentMode === 'spensia'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
            >
              <span>✨</span> Spensia
            </button>
          </div>
        </div>

        {/* Step Navigation Buttons */}
        <div className="space-y-1">
          <div className="px-4 pb-1.5 flex items-center justify-between text-[11px] text-gray-500 font-mono">
            <span>WORKFLOW STEPS</span>
            <span
              className={
                contentMode === 'shortform'
                  ? 'text-indigo-400 font-bold'
                  : contentMode === 'longform'
                    ? 'text-purple-400 font-bold'
                    : 'text-emerald-400 font-bold'
              }
            >
              {contentMode === 'shortform'
                ? '9:16 Shorts'
                : contentMode === 'longform'
                  ? '16:9 Alur Film'
                  : 'Spensia'}
            </span>
          </div>

          {activeStepsList.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-gray-500 italic border border-dashed border-gray-800/80 rounded-xl mx-2">
              Belum ada step workflow untuk Spensia
            </div>
          ) : (
            activeStepsList.map((step) => {
              const isActive = activeStep === step.id;
              return (
                <button
                  key={step.id}
                  onClick={() => onStepChange(step.id)}
                  className={`
                    group flex items-start gap-3 px-3.5 py-2.5 mx-2 rounded-xl text-xs font-semibold
                    transition-all duration-150 text-left w-[calc(100%-16px)] border
                    ${isActive
                      ? contentMode === 'shortform'
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                        : contentMode === 'longform'
                          ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                          : 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/30'
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
                        ? 'text-purple-100 opacity-90'
                        : 'text-gray-500 group-hover:text-gray-400'
                        }`}
                    >
                      {step.subText}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Branding Info */}
      <div className="px-4 pt-3 border-t border-gray-800/80">
        <div className="bg-gray-950 p-3 rounded-xl border border-gray-800/80 space-y-1">
          <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">
            ACTIVE WORKFLOW MODE
          </span>
          <span
            className={`text-xs font-bold block ${contentMode === 'shortform'
              ? 'text-indigo-400'
              : contentMode === 'longform'
                ? 'text-purple-400'
                : 'text-emerald-400'
              }`}
          >
            {contentMode === 'shortform'
              ? '📱 Shorts / TikTok (9:16)'
              : contentMode === 'longform'
                ? '🍿 Alur Cerita Film (16:9)'
                : '✨ Spensia Workflow'}
          </span>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
