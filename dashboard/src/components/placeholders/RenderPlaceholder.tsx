// dashboard/src/components/placeholders/RenderPlaceholder.tsx
import React from 'react';

const RenderPlaceholder: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md p-8 rounded-xl bg-gray-800/50 border border-gray-700">
        <span className="text-5xl block mb-4">🎬</span>
        <h2 className="text-xl font-semibold text-white mb-2">Render Queue</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Start and manage video render jobs. Track progress, view history, and configure output settings.
        </p>
      </div>
    </div>
  );
};

export default RenderPlaceholder;
