// dashboard/src/components/Sidebar.tsx
import React from 'react';

export type StepId = 'build' | 'preview' | 'render' | 'export';

interface Step {
  id: StepId;
  icon: string;
  label: string;
}

const STEPS: Step[] = [
  { id: 'build', icon: '📝', label: 'Build' },
  { id: 'preview', icon: '👁', label: 'Preview' },
  { id: 'render', icon: '🎬', label: 'Render' },
  { id: 'export', icon: '📦', label: 'Export' },
];

interface SidebarProps {
  activeStep: StepId;
  onStepChange: (step: StepId) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeStep, onStepChange }) => {
  return (
    <nav className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col py-4 shrink-0">
      {STEPS.map((step) => {
        const isActive = activeStep === step.id;
        return (
          <button
            key={step.id}
            onClick={() => onStepChange(step.id)}
            className={`
              flex items-center gap-3 px-5 py-3 mx-2 rounded-lg text-sm font-medium
              transition-colors duration-150 text-left
              ${isActive
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }
            `}
          >
            <span className="text-lg">{step.icon}</span>
            <span>{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default Sidebar;
