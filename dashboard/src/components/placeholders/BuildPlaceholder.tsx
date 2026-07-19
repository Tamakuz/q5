// dashboard/src/components/placeholders/BuildPlaceholder.tsx
import React from 'react';

const BuildPlaceholder: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md p-8 rounded-xl bg-gray-800/50 border border-gray-700">
        <span className="text-5xl block mb-4">📝</span>
        <h2 className="text-xl font-semibold text-white mb-2">Scene Builder</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Create and edit scene JSON with visual tools. Add text, images, animations, and transitions.
        </p>
      </div>
    </div>
  );
};

export default BuildPlaceholder;
