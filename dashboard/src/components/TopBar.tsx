// dashboard/src/components/TopBar.tsx
import React from 'react';

const TopBar: React.FC = () => {
  return (
    <header className="flex items-center justify-between h-14 px-6 bg-gray-900 border-b border-gray-800 shrink-0">
      <h1 className="text-lg font-semibold text-white tracking-tight">
        Content Auto
      </h1>
      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
        v0.1.0
      </span>
    </header>
  );
};

export default TopBar;
