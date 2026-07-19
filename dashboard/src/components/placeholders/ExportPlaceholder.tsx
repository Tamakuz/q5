// dashboard/src/components/placeholders/ExportPlaceholder.tsx
import React from 'react';

const ExportPlaceholder: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md p-8 rounded-xl bg-gray-800/50 border border-gray-700">
        <span className="text-5xl block mb-4">📦</span>
        <h2 className="text-xl font-semibold text-white mb-2">Export</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Download rendered videos or push directly to YouTube and other platforms.
        </p>
      </div>
    </div>
  );
};

export default ExportPlaceholder;
