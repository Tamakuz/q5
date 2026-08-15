// dashboard/src/components/common/Sidebar.tsx
import React from 'react';

export type StepId = 'source' | 'analyze' | 'audio' | 'transcript' | 'mapping' | 'render' | 'upload' | 'publish' | 'thumbnail';
export type ContentMode = 'longform' | 'spensia' | 'ugc' | 'shorts';

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
  { id: 'source', icon: '📥', label: '1. Video Downloader', subText: 'Download & kompres raw video' },
  { id: 'analyze', icon: '⚡', label: '2. Segment & Script Generator', subText: 'Ekstrak segmen & naskah Shorts' },
  { id: 'audio', icon: '🎙️', label: '3. Audio & Transcript', subText: 'Upload VO & align timestamp' },
];

const SPENSIA_STEPS: Step[] = [
  { id: 'source', icon: '💡', label: '1. Topics Generator', subText: 'Ide topik & fakta kontraintuitif' },
  { id: 'analyze', icon: '⚡', label: '2. Script Generator', subText: 'Naskah voiceover Style DNA Spensia' },
  { id: 'publish', icon: '🎙️', label: '3. Voice & Timeline Studio', subText: 'Transkrip, auto timeline & visual sync' },
  { id: 'mapping', icon: '🎨', label: '4. Image Prompt Generator', subText: 'Visual Style DNA Spensia prompts' },
  { id: 'render', icon: '🖼️', label: '5. Image Generator', subText: 'Generate ilustrasi adegan Google Flow' },
  { id: 'upload', icon: '🎬', label: '6. Render Studio (16:9)', subText: 'Watermark, caption, BGM & export' },
  { id: 'thumbnail', icon: '🚀', label: '7. Publish Hub & Thumbnail', subText: 'AI SEO Title, Tags, Description & 3x Thumbnail' },
];

const UGC_STEPS: Step[] = [
  { id: 'source', icon: '👤', label: '1. Character Profiles', subText: 'Kelola nama & foto karakter UGC' },
  { id: 'analyze', icon: '📦', label: '2. Products Manager', subText: 'Kelola & pilih produk aktif' },
  { id: 'audio', icon: '📹', label: '3. Video Assets', subText: 'Upload video raw per-produk' },
  { id: 'render', icon: '🎬', label: '4. UGC Render Studio', subText: 'Generator & render pola 3-clip' },
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
  const activeStepsList =
    contentMode === 'longform'
      ? LONGFORM_STEPS
      : contentMode === 'shorts'
        ? SHORTS_STEPS
        : contentMode === 'spensia'
          ? SPENSIA_STEPS
          : UGC_STEPS;

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
              onClick={() => onModeChange('spensia')}
              className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all text-center flex items-center justify-center gap-0.5 ${contentMode === 'spensia'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
            >
              <span>✨</span> Spensia
            </button>
            <button
              onClick={() => onModeChange('longform')}
              className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all text-center flex items-center justify-center gap-0.5 ${contentMode === 'longform'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
            >
              <span>🍿</span> Film
            </button>
            <button
              onClick={() => onModeChange('shorts')}
              className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all text-center flex items-center justify-center gap-0.5 ${contentMode === 'shorts'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
            >
              <span>🎬</span> Shorts
            </button>
            <button
              onClick={() => onModeChange('ugc')}
              className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all text-center flex items-center justify-center gap-0.5 ${contentMode === 'ugc'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
            >
              <span>⚡</span> UGC
            </button>
          </div>
        </div>

        {/* Step Navigation Buttons */}
        <div className="space-y-1">
          <div className="px-4 pb-1.5 flex items-center justify-between text-[11px] text-gray-500 font-mono">
            <span>WORKFLOW STEPS</span>
            <span
              className={
                contentMode === 'longform'
                  ? 'text-purple-400 font-bold'
                  : contentMode === 'shorts'
                    ? 'text-amber-400 font-bold'
                    : contentMode === 'spensia'
                      ? 'text-emerald-400 font-bold'
                      : 'text-cyan-400 font-bold'
              }
            >
              {contentMode === 'longform'
                ? '16:9 Alur Film'
                : contentMode === 'shorts'
                  ? 'Shorts Pabrik'
                  : contentMode === 'spensia'
                    ? 'Spensia'
                    : 'UGC Mode'}
            </span>
          </div>

          {contentMode === 'longform' && (
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
          )}

          {activeStepsList.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-gray-500 italic border border-dashed border-gray-800/80 rounded-xl mx-2">
              Belum ada step workflow untuk {contentMode === 'ugc' ? 'UGC' : 'mode ini'}
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
                      ? contentMode === 'longform'
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                        : contentMode === 'shorts'
                          ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/30'
                          : contentMode === 'spensia'
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                            : 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-600/30'
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
            className={`text-xs font-bold block ${contentMode === 'longform'
              ? 'text-purple-400'
              : contentMode === 'shorts'
                ? 'text-amber-400'
                : contentMode === 'spensia'
                  ? 'text-emerald-400'
                  : 'text-cyan-400'
              }`}
          >
            {contentMode === 'longform'
              ? '🍿 Alur Cerita Film (16:9)'
              : contentMode === 'shorts'
                ? '🎬 Shorts Pabrik & Crafting'
                : contentMode === 'spensia'
                  ? '✨ Spensia Workflow'
                  : '⚡ UGC Workflow'}
          </span>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
