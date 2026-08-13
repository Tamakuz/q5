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

// Spensia Feature Components
import SpensiaTopicsStep from './components/spensia/SpensiaTopicsStep';
import SpensiaScriptStep from './components/spensia/SpensiaScriptStep';
import SpensiaBreakdownStep from './components/spensia/SpensiaBreakdownStep';
import SpensiaImagePromptStep from './components/spensia/SpensiaImagePromptStep';
import SpensiaImageGeneratorStep from './components/spensia/SpensiaImageGeneratorStep';
import SpensiaVoiceOverStep from './components/spensia/SpensiaVoiceOverStep';
import SpensiaTimelineMappingStep from './components/spensia/SpensiaTimelineMappingStep';
import SpensiaRenderStep from './components/spensia/SpensiaRenderStep';
import SpensiaThumbnailStep from './components/spensia/SpensiaThumbnailStep';

// UGC Feature Components
import UGCStudioStep from './components/ugc/UGCStudioStep';
import UGCProductsManager from './components/ugc/UGCProductsManager';
import UGCVideoAssetsManager from './components/ugc/UGCVideoAssetsManager';
import UGCRenderStudioStep from './components/ugc/UGCRenderStudioStep';

// Shorts (Pabrik & Crafting) Feature Components
import ShortsSourceStep from './components/shorts/ShortsSourceStep';
import ShortsAnalyzeStep from './components/shorts/ShortsAnalyzeStep';
import ShortsAudioStep from './components/shorts/ShortsAudioStep';
import ShortsRenderStep from './components/shorts/ShortsRenderStep';
import ShortsMetadataStep from './components/shorts/ShortsMetadataStep';

type Status = 'ready' | 'rendering' | 'error';

const App: React.FC = () => {
  const [activeStep, setActiveStep] = useState<StepId>('source');
  const [contentMode, setContentMode] = useState<ContentMode>('spensia');
  const [status] = useState<Status>('ready');
  const [longformId, setLongformId] = useState<string | null>(null);
  const [longformTab, setLongformTab] = useState<'main' | 'testing'>('main');

  const [spensiaResetKey, setSpensiaResetKey] = useState<number>(0);
  const [longformResetKey, setLongformResetKey] = useState<number>(0);

  // Global Media Preview Drawer state
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  React.useEffect(() => {
    if (contentMode === 'longform') {
      (async () => {
        try {
          if (window.electronAPI?.getContentId) {
            const id = await window.electronAPI.getContentId('longform');
            setLongformId(id);
          }
        } catch { }
      })();
    }
  }, [contentMode]);

  const handleResetProject = async () => {
    setActiveStep('source');
    if (contentMode === 'spensia') {
      setSpensiaResetKey((prev) => prev + 1);
      try {
        Object.keys(localStorage).forEach((key) => {
          if (key.toLowerCase().includes('spensia')) {
            localStorage.removeItem(key);
          }
        });
      } catch {}
    } else if (contentMode === 'longform') {
      setLongformResetKey((prev) => prev + 1);
      try {
        Object.keys(localStorage).forEach((key) => {
          if (key.toLowerCase().includes('longform') || key.toLowerCase().includes('alurfilm')) {
            localStorage.removeItem(key);
          }
        });
      } catch {}
    }
    try {
      if (window.electronAPI?.getContentId) {
        const id = await window.electronAPI.getContentId(contentMode);
        if (contentMode === 'longform') {
          setLongformId(id);
        }
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
          onModeChange={setContentMode}
          longformTab={longformTab}
          onLongformTabChange={setLongformTab}
        />

        <main className="flex-1 p-6 overflow-auto bg-gradient-to-br from-gray-950 via-gray-950 to-gray-900">
          {contentMode === 'shorts' ? (
            activeStep === 'source' ? (
              <ShortsSourceStep key="shorts-source" />
            ) : activeStep === 'analyze' ? (
              <ShortsAnalyzeStep key="shorts-analyze" />
            ) : activeStep === 'audio' ? (
              <ShortsAudioStep key="shorts-audio" />
            ) : activeStep === 'render' ? (
              <ShortsRenderStep key="shorts-render" />
            ) : activeStep === 'upload' ? (
              <ShortsMetadataStep key="shorts-metadata" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-12 bg-gray-950 border border-dashed border-gray-800 rounded-3xl space-y-4">
                <div className="w-20 h-20 bg-amber-600/10 text-amber-400 rounded-3xl flex items-center justify-center text-4xl border border-amber-500/20 shadow-xl shadow-amber-950/40">
                  🎬
                </div>
                <div className="max-w-md space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-xs font-mono font-bold uppercase tracking-wider">
                      Workflow Shorts Pabrik
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white pt-1">Step Belum Konfigurasi</h2>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Langkah ini belum dikonfigurasi untuk Shorts Pabrik.
                  </p>
                </div>
              </div>
            )
          ) : contentMode === 'ugc' ? (
            activeStep === 'source' ? (
              <UGCStudioStep key="ugc-studio" />
            ) : activeStep === 'analyze' ? (
              <div className="p-6 bg-gray-950/80 border border-gray-800 rounded-3xl min-h-full space-y-8">
                <UGCProductsManager />
              </div>
            ) : activeStep === 'audio' ? (
              <div className="p-6 bg-gray-950/80 border border-gray-800 rounded-3xl min-h-full space-y-8">
                <UGCVideoAssetsManager />
              </div>
            ) : activeStep === 'render' ? (
              <div className="p-6 bg-gray-950/80 border border-gray-800 rounded-3xl min-h-full space-y-8">
                <UGCRenderStudioStep />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-12 bg-gray-950 border border-dashed border-gray-800 rounded-3xl space-y-4">
                <div className="w-20 h-20 bg-cyan-600/10 text-cyan-400 rounded-3xl flex items-center justify-center text-4xl border border-cyan-500/20 shadow-xl shadow-cyan-950/40">
                  ⚡
                </div>
                <div className="max-w-md space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-mono font-bold uppercase tracking-wider">
                      Workflow UGC
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white pt-1">Step Belum Konfigurasi</h2>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Langkah ini belum dikonfigurasi untuk UGC.
                  </p>
                </div>
              </div>
            )
          ) : contentMode === 'spensia' ? (
            activeStep === 'source' ? (
              <SpensiaTopicsStep key={`spensia-topics-${spensiaResetKey}`} />
            ) : activeStep === 'analyze' ? (
              <SpensiaScriptStep key={`spensia-script-${spensiaResetKey}`} />
            ) : activeStep === 'audio' ? (
              <SpensiaBreakdownStep key={`spensia-breakdown-${spensiaResetKey}`} />
            ) : activeStep === 'mapping' ? (
              <SpensiaImagePromptStep key={`spensia-image-prompts-${spensiaResetKey}`} />
            ) : activeStep === 'render' ? (
              <SpensiaImageGeneratorStep key={`spensia-image-generator-${spensiaResetKey}`} />
            ) : activeStep === 'publish' ? (
              <SpensiaVoiceOverStep key={`spensia-voice-over-${spensiaResetKey}`} onStepChange={setActiveStep} />
            ) : activeStep === 'upload' ? (
              <SpensiaRenderStep key={`spensia-render-studio-${spensiaResetKey}`} />
            ) : activeStep === 'thumbnail' ? (
              <SpensiaThumbnailStep key={`spensia-thumbnail-studio-${spensiaResetKey}`} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-12 bg-gray-950 border border-dashed border-gray-800 rounded-3xl space-y-4">
                <div className="w-20 h-20 bg-emerald-600/10 text-emerald-400 rounded-3xl flex items-center justify-center text-4xl border border-emerald-500/20 shadow-xl shadow-emerald-950/40">
                  ✨
                </div>
                <div className="max-w-md space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-mono font-bold uppercase tracking-wider">
                      Workflow Spensia
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white pt-1">Workflow Step Belum Ada</h2>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Langkah ini belum dikonfigurasi untuk Spensia. Gunakan Step 1 (Topics) atau Step 2 (Script Generator).
                  </p>
                </div>
              </div>
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
