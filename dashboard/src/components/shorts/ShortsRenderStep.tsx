// dashboard/src/components/shorts/ShortsRenderStep.tsx
import React from 'react';

const ShortsRenderStep: React.FC = () => {
  return (
    <div className="p-6 bg-gray-950/80 border border-gray-800 rounded-3xl min-h-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-600/10 text-amber-400 rounded-2xl flex items-center justify-center text-2xl border border-amber-500/20 shadow-lg shadow-amber-950/40">
            🎬
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              4. Shorts Render Studio (9:16 Vertical)
              <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 text-xs font-mono font-semibold">
                Factory Generator
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Render video Shorts 9:16 dengan subtitle animasi otomatis warna Kuning/Merah & Watermark.
            </p>
          </div>
        </div>
      </div>

      {/* Content Placeholder */}
      <div className="bg-gray-900/40 border border-dashed border-gray-800/90 p-12 rounded-2xl text-center space-y-3">
        <div className="text-4xl text-amber-500/60">📽️</div>
        <h3 className="text-sm font-bold text-gray-300">Shorts Factory Render Engine</h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto">
          Modul rendering video 9:16 vertical, pengolahan subtitle kata-per-kata otomatis, dan penyeimbangan suara.
        </p>
      </div>
    </div>
  );
};

export default ShortsRenderStep;
