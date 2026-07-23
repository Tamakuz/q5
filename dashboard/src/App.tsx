// dashboard/src/App.tsx
import React, { useState } from 'react';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import type { StepId, ContentMode } from './components/Sidebar';
import StatusBar from './components/StatusBar';
import BuildPlaceholder from './components/placeholders/BuildPlaceholder';
import AnalyzePlaceholder from './components/placeholders/AnalyzePlaceholder';
import RenderPlaceholder from './components/placeholders/RenderPlaceholder';
import UploadPlaceholder from './components/placeholders/UploadPlaceholder';
import AlurfilmSplitterPlaceholder from './components/placeholders/longform/AlurfilmSplitterPlaceholder';
import AlurfilmAnalyzePlaceholder from './components/placeholders/longform/AlurfilmAnalyzePlaceholder';
import AlurfilmAudioPlaceholder from './components/placeholders/longform/AlurfilmAudioPlaceholder';
import AlurfilmTranscriptPlaceholder from './components/placeholders/longform/AlurfilmTranscriptPlaceholder';
import AlurfilmMappingPlaceholder from './components/placeholders/longform/AlurfilmMappingPlaceholder';
import AlurfilmRenderPlaceholder from './components/placeholders/longform/AlurfilmRenderPlaceholder';
import TranscriptPlaceholder from './components/placeholders/TranscriptPlaceholder';

type Status = 'ready' | 'rendering' | 'error';

const SHORTFORM_PLACEHOLDERS: Record<StepId, React.FC> = {
  source: BuildPlaceholder,
  analyze: AnalyzePlaceholder,
  audio: AnalyzePlaceholder,
  transcript: TranscriptPlaceholder,
  mapping: RenderPlaceholder,
  render: RenderPlaceholder,
  upload: UploadPlaceholder,
};

const App: React.FC = () => {
  const [activeStep, setActiveStep] = useState<StepId>('source');
  const [contentMode, setContentMode] = useState<ContentMode>('shortform');
  const [status] = useState<Status>('ready');
  const [longformId, setLongformId] = useState<string | null>(null);

  React.useEffect(() => {
    if (contentMode === 'longform') {
      (async () => {
        try {
          if (window.electronAPI?.getContentId) {
            const id = await window.electronAPI.getContentId('longform');
            setLongformId(id);
          }
        } catch {}
      })();
    }
  }, [contentMode]);

  const handleResetProject = () => {
    setActiveStep('source');
  };

  const ActivePlaceholder = SHORTFORM_PLACEHOLDERS[activeStep] || BuildPlaceholder;

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <TopBar onResetProject={handleResetProject} contentMode={contentMode} />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          activeStep={activeStep}
          onStepChange={setActiveStep}
          contentMode={contentMode}
          onModeChange={setContentMode}
        />
        <main className="flex-1 p-6 overflow-auto">
          {contentMode === 'shortform' ? (
            <ActivePlaceholder key={`shortform-${activeStep}`} />
          ) : activeStep === 'source' ? (
            <AlurfilmSplitterPlaceholder key={`longform-source-${longformId}`} />
          ) : activeStep === 'analyze' ? (
            <AlurfilmAnalyzePlaceholder key={`longform-analyze-${longformId}`} />
          ) : activeStep === 'audio' ? (
            <AlurfilmAudioPlaceholder key={`longform-audio-${longformId}`} />
          ) : activeStep === 'transcript' ? (
            <AlurfilmTranscriptPlaceholder key={`longform-transcript-${longformId}`} />
          ) : activeStep === 'mapping' ? (
            <AlurfilmMappingPlaceholder key={`longform-mapping-${longformId}`} />
          ) : activeStep === 'render' ? (
            <AlurfilmRenderPlaceholder key={`longform-render-${longformId}`} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-12 bg-gray-950 border border-dashed border-gray-800 rounded-3xl space-y-4">
              <div className="w-20 h-20 bg-purple-600/10 text-purple-400 rounded-3xl flex items-center justify-center text-4xl border border-purple-500/20 shadow-xl shadow-purple-950/40">
                🍿
              </div>
              <div className="max-w-md space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-xs font-mono font-bold uppercase tracking-wider">
                    Alur Cerita Film (16:9)
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white pt-1">Workflow Step Belum Ada</h2>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Langkah ini belum dibuat untuk Alur Cerita Film (16:9). Gunakan step 1 (Splitter 10 Min).
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
      <StatusBar status={status} />
    </div>
  );
};

export default App;
