// dashboard/src/App.tsx
import React, { useState } from 'react';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import type { StepId } from './components/Sidebar';
import StatusBar from './components/StatusBar';
import BuildPlaceholder from './components/placeholders/BuildPlaceholder';
import AnalyzePlaceholder from './components/placeholders/AnalyzePlaceholder';
import RenderPlaceholder from './components/placeholders/RenderPlaceholder';
import UploadPlaceholder from './components/placeholders/UploadPlaceholder';

type Status = 'ready' | 'rendering' | 'error';

const PLACEHOLDERS: Record<StepId, React.FC> = {
  source: BuildPlaceholder,
  analyze: AnalyzePlaceholder,
  render: RenderPlaceholder,
  upload: UploadPlaceholder,
};

const App: React.FC = () => {
  const [activeStep, setActiveStep] = useState<StepId>('source');
  const [status] = useState<Status>('ready');

  const handleResetProject = () => {
    setActiveStep('source');
  };

  const ActivePlaceholder = PLACEHOLDERS[activeStep];

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <TopBar onResetProject={handleResetProject} />
      <div className="flex flex-1 min-h-0">
        <Sidebar activeStep={activeStep} onStepChange={setActiveStep} />
        <main className="flex-1 p-6 overflow-auto">
          <ActivePlaceholder key={activeStep === 'source' ? Date.now() : activeStep} />
        </main>
      </div>
      <StatusBar status={status} />
    </div>
  );
};

export default App;
