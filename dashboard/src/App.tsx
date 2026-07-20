// dashboard/src/App.tsx
import React, { useState } from 'react';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import type { StepId } from './components/Sidebar';
import StatusBar from './components/StatusBar';
import BuildPlaceholder from './components/placeholders/BuildPlaceholder';
import AnalyzePlaceholder from './components/placeholders/AnalyzePlaceholder';
import PreviewPlaceholder from './components/placeholders/PreviewPlaceholder';
import RenderPlaceholder from './components/placeholders/RenderPlaceholder';
import ExportPlaceholder from './components/placeholders/ExportPlaceholder';

type Status = 'ready' | 'rendering' | 'error';

const PLACEHOLDERS: Record<StepId, React.FC> = {
  source: BuildPlaceholder,
  analyze: AnalyzePlaceholder,
  preview: PreviewPlaceholder,
  render: RenderPlaceholder,
  export: ExportPlaceholder,
};

const App: React.FC = () => {
  const [activeStep, setActiveStep] = useState<StepId>('source');
  const [status] = useState<Status>('ready');

  const ActivePlaceholder = PLACEHOLDERS[activeStep];

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar activeStep={activeStep} onStepChange={setActiveStep} />
        <main className="flex-1 p-6 overflow-auto">
          <ActivePlaceholder />
        </main>
      </div>
      <StatusBar status={status} />
    </div>
  );
};

export default App;
