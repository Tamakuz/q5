// dashboard/src/App.tsx
import React, { useState } from 'react';
import TopBar from './components/common/TopBar';
import Sidebar from './components/common/Sidebar';
import type { StepId, ContentMode } from './components/common/Sidebar';
import MediaPreviewDrawer from './components/common/MediaPreviewDrawer';
import StatusBar from './components/common/StatusBar';

// Longform (Alur Film) Feature Components
import AlurfilmSplitterStep from './components/longform/AlurfilmSplitterStep';
import AlurfilmAnalyzeStep from './components/longform/AlurfilmAnalyzeStep';
import AlurfilmAudioStep from './components/longform/AlurfilmAudioStep';
import AlurfilmTranscriptStep from './components/longform/AlurfilmTranscriptStep';
import AlurfilmMappingStep from './components/longform/AlurfilmMappingStep';
import AlurfilmRenderStep from './components/longform/AlurfilmRenderStep';
import AlurfilmMetadataStep from './components/longform/AlurfilmMetadataStep';
import AlurfilmTestingHub from './components/longform/testing/AlurfilmTestingHub';
import ShortsMergerStep from './components/shorts/ShortsMergerStep';
import ShortsPromptStep from './components/shorts/ShortsPromptStep';

type Status = 'ready' | 'rendering' | 'error';

const App: React.FC = () => {
  const [activeStep, setActiveStep] = useState<StepId>('source');
  const [contentMode, setContentMode] = useState<ContentMode>('longform');
  const [status] = useState<Status>('ready');
  const [longformId, setLongformId] = useState<string | null>(null);
  const [longformTab, setLongformTab] = useState<'main' | 'testing'>('main');

  const [longformResetKey, setLongformResetKey] = useState<number>(0);

  // Global Media Preview Drawer state
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  React.useEffect(() => {
    (async () => {
      try {
        if (window.electronAPI?.getContentId) {
          const id = await window.electronAPI.getContentId('longform');
          setLongformId(id);
        }
      } catch { }
    })();
  }, []);

  const handleResetProject = async () => {
    setActiveStep('source');
    setLongformResetKey((prev) => prev + 1);
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.toLowerCase().includes('longform') || key.toLowerCase().includes('alurfilm')) {
          localStorage.removeItem(key);
        }
      });
    } catch {}
    try {
      if (window.electronAPI?.getContentId) {
        const id = await window.electronAPI.getContentId('longform');
        setLongformId(id);
      }
    } catch { }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 font-sans overflow-hidden">
      <TopBar onResetProject={handleResetProject} contentMode={contentMode} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          activeStep={activeStep}
          onStepChange={setActiveStep}
          contentMode={contentMode}
          onModeChange={(mode) => {
            setContentMode(mode);
            if (mode === 'shorts') {
              setActiveStep('analyze');
            } else {
              setActiveStep('source');
            }
          }}
          longformTab={longformTab}
          onLongformTabChange={setLongformTab}
        />

        <main className="flex-1 p-6 overflow-auto bg-gradient-to-br from-gray-950 via-gray-950 to-gray-900">
          {contentMode === 'shorts' ? (
            activeStep === 'render' ? (
              <ShortsMergerStep key="shorts-merger-step" />
            ) : (
              <ShortsPromptStep
                key="shorts-prompt-step"
                onNavigateToMerger={() => setActiveStep('render')}
              />
            )
          ) : longformTab === 'testing' ? (
            <AlurfilmTestingHub key="longform-testing-hub" />
          ) : activeStep === 'source' ? (
            <AlurfilmSplitterStep key={`longform-source-${longformId}-${longformResetKey}`} />
          ) : activeStep === 'analyze' ? (
            <AlurfilmAnalyzeStep key={`longform-analyze-${longformId}-${longformResetKey}`} />
          ) : activeStep === 'audio' ? (
            <AlurfilmAudioStep key={`longform-audio-${longformId}-${longformResetKey}`} />
          ) : activeStep === 'transcript' ? (
            <AlurfilmTranscriptStep key={`longform-transcript-${longformId}-${longformResetKey}`} />
          ) : activeStep === 'mapping' ? (
            <AlurfilmMappingStep key={`longform-mapping-${longformId}-${longformResetKey}`} />
          ) : activeStep === 'render' ? (
            <AlurfilmRenderStep key={`longform-render-${longformId}-${longformResetKey}`} />
          ) : activeStep === 'upload' ? (
            <AlurfilmMetadataStep key={`longform-metadata-${longformId}-${longformResetKey}`} />
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
                  Langkah ini belum dibuat untuk Alur Cerita Film (16:9). Gunakan step 1 (Splitter 20 Min).
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      <StatusBar status={status} />

      {/* Global Media Preview Center Drawer */}
      <MediaPreviewDrawer
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
};

export default App;
