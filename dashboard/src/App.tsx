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

type Status = 'ready' | 'rendering' | 'error';

const SHORTFORM_PLACEHOLDERS: Record<StepId, React.FC> = {
  source: BuildPlaceholder,
  analyze: AnalyzePlaceholder,
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

  const ActivePlaceholder = SHORTFORM_PLACEHOLDERS[activeStep];

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
                <h2 className="text-lg font-bold text-white pt-1">Workflow Alur Cerita Film Masih Kosong</h2>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Alur pekerjaan untuk Alur Cerita Film (16:9) belum dibuat dan terisolasi sepenuhnya dari Shorts.
                </p>
                {longformId && (
                  <div className="pt-2">
                    <span className="text-[10px] text-purple-400 font-mono font-bold uppercase block">
                      Isolated Content ID:
                    </span>
                    <span className="inline-block mt-1 px-3 py-1 bg-purple-950/80 border border-purple-700/50 text-purple-200 text-xs font-mono font-bold rounded-lg">
                      🆔 {longformId}
                    </span>
                  </div>
                )}
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
