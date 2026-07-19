// dashboard/src/components/placeholders/PreviewPlaceholder.tsx
import React from 'react';

const PreviewPlaceholder: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md p-8 rounded-xl bg-gray-800/50 border border-gray-700">
        <span className="text-5xl block mb-4">👁</span>
        <h2 className="text-xl font-semibold text-white mb-2">Live Preview</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Preview your video composition in real-time as you build. See text, images, and animations come to life.
        </p>
      </div>
    </div>
  );
};

export default PreviewPlaceholder;
