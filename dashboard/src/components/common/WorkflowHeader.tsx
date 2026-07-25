// dashboard/src/components/common/WorkflowHeader.tsx
import React from 'react';
import type { StepId, ContentMode } from './Sidebar';

interface StepItem {
  id: StepId;
  label: string;
  icon: string;
  shortLabel: string;
}

const SHORTFORM_STEPS: StepItem[] = [
  { id: 'source', label: '1. Master Assets', shortLabel: 'Source', icon: '📁' },
  { id: 'analyze', label: '2. Video Analysis', shortLabel: 'Analyze', icon: '⚡' },
  { id: 'transcript', label: '3. Transcript', shortLabel: 'Transcript', icon: '📝' },
  { id: 'render', label: '4. Render Video', shortLabel: 'Render', icon: '🎬' },
  { id: 'upload', label: '5. Publish Hub', shortLabel: 'Publish', icon: '🚀' },
];

const LONGFORM_STEPS: StepItem[] = [
  { id: 'source', label: '1. Splitter (10M)', shortLabel: 'Splitter', icon: '✂️' },
  { id: 'analyze', label: '2. Script Generator', shortLabel: 'Script', icon: '⚡' },
  { id: 'audio', label: '3. Voice Over', shortLabel: 'Audio', icon: '🎙️' },
  { id: 'transcript', label: '4. Transcript', shortLabel: 'Transcript', icon: '📝' },
  { id: 'mapping', label: '5. Video Mapping', shortLabel: 'Mapping', icon: '🎯' },
  { id: 'render', label: '6. Video Render', shortLabel: 'Render', icon: '🎬' },
];

interface WorkflowHeaderProps {
  contentMode: ContentMode;
  activeStep: StepId;
  onStepChange: (step: StepId) => void;
  onOpenPreview?: () => void;
}

const WorkflowHeader: React.FC<WorkflowHeaderProps> = ({
  contentMode,
  activeStep,
  onStepChange,
  onOpenPreview,
}) => {
  const steps = contentMode === 'shortform' ? SHORTFORM_STEPS : LONGFORM_STEPS;
  const activeIndex = steps.findIndex((s) => s.id === activeStep);

  return (
    <div className="bg-gray-900/90 border-b border-gray-800/80 px-6 py-2.5 flex items-center justify-between gap-4 shrink-0 backdrop-blur-md">
      {/* Visual Workflow Steps Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 flex-1 py-0.5 no-scrollbar">
        {steps.map((step, index) => {
          const isActive = step.id === activeStep;
          const isPassed = index < activeIndex;

          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => onStepChange(step.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 border ${
                  isActive
                    ? contentMode === 'shortform'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                    : isPassed
                    ? 'bg-gray-950/80 border-gray-800/90 text-gray-300 hover:border-gray-700'
                    : 'bg-gray-950/30 border-transparent text-gray-500 hover:text-gray-400 hover:bg-gray-900'
                }`}
              >
                <span className="text-sm">{step.icon}</span>
                <span className="hidden md:inline">{step.label}</span>
                <span className="inline md:hidden">{step.shortLabel}</span>
                {isPassed && (
                  <span className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-700/60 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                )}
              </button>

              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 w-4 rounded-full shrink-0 transition-colors ${
                    index < activeIndex
                      ? contentMode === 'shortform'
                        ? 'bg-indigo-500/60'
                        : 'bg-purple-500/60'
                      : 'bg-gray-800'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Media Quick Preview Trigger */}
      {onOpenPreview && (
        <button
          onClick={onOpenPreview}
          className="px-3.5 py-1.5 bg-gradient-to-r from-purple-900/60 to-indigo-900/60 hover:from-purple-800 hover:to-indigo-800 border border-purple-500/40 text-purple-200 rounded-xl text-xs font-bold shadow-lg shadow-purple-950/40 transition-all flex items-center gap-2 shrink-0 animate-pulse hover:animate-none"
        >
          <span>🎬</span>
          <span className="hidden sm:inline">Media Preview</span>
        </button>
      )}
    </div>
  );
};

export default WorkflowHeader;
