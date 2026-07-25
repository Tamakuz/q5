// dashboard/src/components/longform/AlurfilmRenderStep.tsx
import React, { useState, useEffect } from 'react';
import type { AlurfilmChunk, AlurfilmAudioResult, AlurfilmMappingResult, RenderProgress } from '../../electron-api';

const api = window.electronAPI;

const AlurfilmRenderStep: React.FC = () => {
  const [contentId, setContentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [audios, setAudios] = useState<Record<number, AlurfilmAudioResult>>({});
  const [mappings, setMappings] = useState<Record<number, AlurfilmMappingResult>>({});
  
  const [activePart, setActivePart] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Render State per Part
  const [renderingPart, setRenderingPart] = useState<number | null>(null);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [renderedOutputs, setRenderedOutputs] = useState<Record<number, string>>({});
  const [renderErrors, setRenderErrors] = useState<Record<number, string>>({});

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const id = await api.getContentId('longform');
      setContentId(id);

      if (id) {
        // Chunks
        const chunkList = await api.listAlurfilmChunks(id);
        setChunks(chunkList || []);

        // Audios
        const audioList = await api.listAlurfilmAudios(id);
        const aMap: Record<number, AlurfilmAudioResult> = {};
        if (audioList) { for (const a of audioList) aMap[a.part] = a; }
        setAudios(aMap);

        // Mappings
        const mList = await api.listAlurfilmMappings(id);
        const mMap: Record<number, AlurfilmMappingResult> = {};
        if (mList) { for (const m of mList) mMap[m.part] = m; }
        setMappings(mMap);

        // List existing rendered video files
        const renders = await api.listRenders();
        const rMap: Record<number, string> = {};
        if (renders) {
          for (const r of renders) {
            const match = r.name?.match(/part_(\d+)/i) || r.name?.match(/P(\d+)/i);
            if (match) {
              const partNum = parseInt(match[1], 10);
              rMap[partNum] = r.fullPath || r.filePath;
            }
          }
        }
        setRenderedOutputs(rMap);

        if (chunkList && chunkList.length > 0) {
          setActivePart(chunkList[0].part);
        }
      }
    } catch (err: any) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    const cleanup = api.onRenderProgress((data) => {
      setRenderProgress(data);
      if (data.stage === 'done' || data.stage === 'error') {
        setRenderingPart(null);
      }
    });

    return cleanup;
  }, []);

  const handleRenderPart = async (partNum: number) => {
    const chunkInfo = chunks.find((c) => c.part === partNum);
    const audioInfo = audios[partNum];
    const mappingInfo = mappings[partNum];

    if (!chunkInfo || !audioInfo || !mappingInfo?.data) {
      alert(`Missing required files for Part #${partNum}! Needs Video Chunk, Voiceover Audio, and Video Mapping.`);
      return;
    }

    setRenderingPart(partNum);
    setRenderProgress({ stage: 'starting', progress: 0, message: `Starting Alurfilm FFmpeg render for Part #${partNum}...` });

    try {
      const res = await api.renderAlurfilmPart(
        partNum,
        chunkInfo.filePath,
        audioInfo.filePath,
        mappingInfo.data
      );

      if (res.error) {
        setRenderErrors((prev) => ({ ...prev, [partNum]: res.error! }));
      } else if (res.outputPath) {
        setRenderedOutputs((prev) => ({ ...prev, [partNum]: res.outputPath }));
        showToast(`🎉 Part #${partNum} Render Completed Successfully!`);
      }
    } catch (err: any) {
      setRenderErrors((prev) => ({ ...prev, [partNum]: err.message || 'Render failed' }));
    }
    setRenderingPart(null);
  };

  const currentChunk = chunks.find((c) => c.part === activePart);
  const currentAudio = audios[activePart];
  const currentMapping = mappings[activePart]?.data;
  const currentRenderPath = renderedOutputs[activePart];
  const currentError = renderErrors[activePart];

  const isPartReady = !!(currentChunk && currentAudio && currentMapping);

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-6 overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-purple-600 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg border border-purple-400 animate-bounce">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-800 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="p-2 bg-purple-600/20 text-purple-400 rounded-lg text-lg">🎬</span>
            Alur Film Part Render & Concatenator (16:9)
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Execute high-fidelity 16:9 FFmpeg video rendering per part chunk and concatenate full movie recap.
          </p>
        </div>
      </div>

      {/* Main Grid Workspace with Side Parts List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5 flex-1 min-h-0 overflow-hidden">
        {/* SIDE COLUMN: Vertical Parts Selector (Col 2) */}
        <div className="lg:col-span-2 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800 shrink-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Parts ({chunks.length})
            </span>
            <span className="text-[10px] text-purple-400 font-mono font-bold">Render</span>
          </div>

          {chunks.length > 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
              {chunks.map((chunk) => {
                const isRendered = !!renderedOutputs[chunk.part];
                const isActive = activePart === chunk.part;
                return (
                  <button
                    key={chunk.part}
                    onClick={() => setActivePart(chunk.part)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-between border ${
                      isActive
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                        : isRendered
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/50'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <span>Part #{chunk.part}</span>
                    <span className="text-xs">{isRendered ? '✓' : '○'}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-amber-400 p-2 text-center">
              Belum ada part.
            </div>
          )}
        </div>

        {/* CENTER PANEL: Render Execution & Specs (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🚀</span> Part #{activePart} Render Controls
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                FFmpeg 16:9 movie recap renderer engine.
              </p>
            </div>
          </div>

          {/* Readiness Checks */}
          <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-2 text-xs">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block">Render Prerequisites:</span>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">10-Min Video Chunk:</span>
              <span className={currentChunk ? 'text-emerald-400 font-bold' : 'text-gray-600'}>{currentChunk ? '✓ Ready' : '○ Missing'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Voiceover Audio File:</span>
              <span className={currentAudio ? 'text-emerald-400 font-bold' : 'text-gray-600'}>{currentAudio ? '✓ Ready' : '○ Missing'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Video Cuts Mapping:</span>
              <span className={currentMapping ? 'text-emerald-400 font-bold' : 'text-gray-600'}>{currentMapping ? '✓ Ready' : '○ Missing'}</span>
            </div>
          </div>

          <button
            onClick={() => handleRenderPart(activePart)}
            disabled={!isPartReady || renderingPart === activePart}
            className={`w-full py-3 rounded-xl text-xs font-bold shadow-xl transition-all flex items-center justify-center gap-2 ${
              !isPartReady || renderingPart === activePart
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
            }`}
          >
            <span>{renderingPart === activePart ? '⏳' : '⚡'}</span>
            <span>{renderingPart === activePart ? `Rendering Part #${activePart}...` : `Start Render Part #${activePart}`}</span>
          </button>

          {/* Render Progress Monitor */}
          {renderingPart === activePart && renderProgress && (
            <div className="bg-gray-950 p-4 rounded-xl border border-purple-900/50 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-purple-400 font-bold">Stage: {renderProgress.stage}</span>
                <span className="text-gray-300 font-mono">{renderProgress.progress}%</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
                <div className="bg-purple-500 h-full transition-all duration-300" style={{ width: `${renderProgress.progress}%` }} />
              </div>
              <p className="text-[11px] text-gray-400 font-mono truncate">{renderProgress.message}</p>
            </div>
          )}

          {currentError && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400 font-mono">
              {currentError}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Part Video Preview & Export Hub (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📹</span> Part #{activePart} Render Output
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Rendered 16:9 movie recap part output player.
              </p>
            </div>
          </div>

          <div className="flex-1 bg-black rounded-xl overflow-hidden flex items-center justify-center border border-gray-800 min-h-0 relative">
            {currentRenderPath ? (
              <video
                key={currentRenderPath}
                src={`media://content-auto/${encodeURIComponent(currentRenderPath)}`}
                controls
                className="w-full h-full object-contain max-h-[380px]"
              />
            ) : (
              <div className="text-center text-xs text-gray-500 p-8 space-y-2">
                <div className="w-12 h-12 bg-gray-900 text-gray-600 rounded-xl flex items-center justify-center text-xl mx-auto">
                  🎬
                </div>
                <h4 className="font-bold text-gray-400">No Rendered Output for Part #{activePart}</h4>
                <p className="text-[11px] text-gray-500">Click "Start Render Part #{activePart}" to generate video.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlurfilmRenderStep;
