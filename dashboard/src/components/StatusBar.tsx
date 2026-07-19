// dashboard/src/components/StatusBar.tsx
import React from 'react';

interface StatusBarProps {
  status: 'ready' | 'rendering' | 'error';
}

const STATUS_CONFIG: Record<StatusBarProps['status'], { dot: string; label: string }> = {
  ready: { dot: 'bg-green-500', label: 'Ready' },
  rendering: { dot: 'bg-yellow-500 animate-pulse', label: 'Rendering...' },
  error: { dot: 'bg-red-500', label: 'Error' },
};

const StatusBar: React.FC<StatusBarProps> = ({ status }) => {
  const config = STATUS_CONFIG[status];

  return (
    <footer className="flex items-center h-8 px-4 bg-gray-900 border-t border-gray-800 text-xs text-gray-400 shrink-0">
      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${config.dot}`} />
      {config.label}
    </footer>
  );
};

export default StatusBar;
