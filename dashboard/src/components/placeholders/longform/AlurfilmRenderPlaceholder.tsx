import React, { useState, useEffect, useRef } from 'react';
import type {
  AlurfilmChunk,
  AlurfilmAudioResult,
  AlurfilmMappingResult,
  AlurfilmRenderResult
} from '../../../electron-api';

const api = window.electronAPI;

const AlurfilmRenderPlaceholder: React.FC = () => {
  const [contentId, setContentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [audios, setAudios] = useState<Record<number, AlurfilmAudioResult>>({});
  const [mappings, setMappings] = useState<Record<number, AlurfilmMappingResult>>({});
  const [renderOutputs, setRenderOutputs] = useState<Record<number, AlurfilmRenderResult>>({});
  const [activePart, setActivePart] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [renderingPart, setRenderingPart] = useState<number | null>(null);
  const [renderProgressMsg, setRenderProgressMsg] = useState<string>('');
  const [renderPct, setRenderPct] = useState<number>(0);
  const [renderLogs, setRenderLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isBatchRendering, setIsBatchRendering] = useState<boolean>(false);

  const logEndRef = useRef<HTMLDivElement>(null);
  const cancelBatchRef = useRef<boolean>(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Subscribe to live render-progress IPC events from main process
  useEffect(() => {
    const cleanup = api.onRenderProgress((data) => {
      if (data.progress !== undefined) {
        setRenderPct(data.progress);
      }
      if (data.message) {
        setRenderProgressMsg(data.message);
        setRenderLogs((prev) => [...prev.slice(-400), data.message]);
      }
      if (data.stage === 'error') {
        setError(data.message);
      }
    });

    return () => {
      cleanup();
    };
  }, []);

  // Auto-scroll log box to bottom when new logs arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [renderLogs]);

  const loadData = async () => {
    setLoading(true);
    try {
      const id = await api.getContentId('longform');
      setContentId(id);

      if (id) {
        // Load chunks
        const chunkList = await api.listAlurfilmChunks(id);
        setChunks(chunkList || []);

        // Load audios
        const audioList = await api.listAlurfilmAudios(id);
        const audioMap: Record<number, AlurfilmAudioResult> = {};
        if (audioList) {
          for (const item of audioList) {
            audioMap[item.part] = item;
          }
        }
        setAudios(audioMap);

        // Load mappings
        const mappingList = await api.listAlurfilmMappings(id);
        const mappingMap: Record<number, AlurfilmMappingResult> = {};
        if (mappingList) {
          for (const item of mappingList) {
            mappingMap[item.part] = item;
          }
        }
        setMappings(mappingMap);

        // Load existing renders
        const renderList = await api.listAlurfilmRenders(id);
        const renderMap: Record<number, AlurfilmRenderResult> = {};
        if (renderList) {
          for (const item of renderList) {
            renderMap[item.part] = item;
          }
        }
        setRenderOutputs(renderMap);

        if (chunkList && chunkList.length > 0) {
          setActivePart(chunkList[0].part);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data render');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRenderPartVideo = async (partNum: number) => {
    const mappingResult = mappings[partNum];
    const chunkVideo = chunks.find((c) => c.part === partNum);
    const audioVO = audios[partNum];

    if (!mappingResult || !chunkVideo) {
      setError('Data video chunk atau mapping JSON untuk Part ini belum lengkap');
      return;
    }

    setRenderingPart(partNum);
    setRenderPct(0);
    setRenderLogs([`[Alurfilm Engine] Memulai render 16:9 Part #${partNum}...`]);
    setRenderProgressMsg('Memulai Alurfilm FFmpeg 16:9 Render Engine...');
    setError(null);

    try {
      showToast(`🎬 [Alurfilm Engine] Memulai render 16:9 Part #${partNum}...`);
      const renderRes = await api.renderAlurfilmVideo(
        partNum,
        mappingResult.data,
        chunkVideo.filePath,
        audioVO?.filePath
      );

      if (renderRes.error) {
        setError(`Render Error: ${renderRes.error}`);
        setRenderLogs((prev) => [...prev, `❌ ERROR: ${renderRes.error}`]);
      } else {
        setRenderOutputs((prev) => ({ ...prev, [partNum]: renderRes }));
        showToast(`🎉 Render Part #${partNum} Selesai dalam ${renderRes.elapsed}s!`);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal me-render video Alurfilm');
      setRenderLogs((prev) => [...prev, `❌ EXCEPTION: ${err.message}`]);
    } finally {
      setRenderingPart(null);
    }
  };

  const handleRenderAllParts = async () => {
    if (isBatchRendering || renderingPart !== null) return;

    const totalPartsCount = Math.max(chunks.length, Object.keys(mappings).length, 1);
    const allParts = Array.from({ length: totalPartsCount }, (_, i) => i + 1);
    const unrenderedParts = allParts.filter((p) => !renderOutputs[p]);

    if (unrenderedParts.length === 0) {
      showToast('🎉 Semua Part sudah selesai dirender!');
      return;
    }

    cancelBatchRef.current = false;
    setIsBatchRendering(true);
    setError(null);
    showToast(`🚀 Memulai Batch Render ${unrenderedParts.length} Part secara berurutan...`);

    for (const partNum of unrenderedParts) {
      if (cancelBatchRef.current) {
        showToast('🛑 Batch Render dihentikan oleh pengguna.');
        break;
      }

      const mappingResult = mappings[partNum];
      const chunkVideo = chunks.find((c) => c.part === partNum);

      if (!mappingResult || !chunkVideo) {
        setRenderLogs((prev) => [...prev, `⚠️ Part #${partNum} dilewati: Mapping JSON atau Video Chunk belum lengkap.`]);
        continue;
      }

      setActivePart(partNum);
      await handleRenderPartVideo(partNum);
    }

    setIsBatchRendering(false);
    showToast('🎉 Seluruh proses Batch Render selesai!');
  };

  const handleStopBatch = () => {
    cancelBatchRef.current = true;
    showToast('⏳ Meminta pemberhentian batch render...');
  };

  const totalPartsCount = Math.max(chunks.length, Object.keys(mappings).length, 1);
  const partsList = Array.from({ length: totalPartsCount }, (_, i) => i + 1);

  const completedRendersCount = Object.keys(renderOutputs).length;
  const renderProgressPercent = Math.round((completedRendersCount / totalPartsCount) * 100);

  const activeMapping = mappings[activePart]?.data;
  const activeChunk = chunks.find((c) => c.part === activePart);
  const activeAudio = audios[activePart];
  const activeRenderOutput = renderOutputs[activePart];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl font-medium text-sm flex items-center gap-2 border border-emerald-400/30 animate-in fade-in slide-in-from-top-4">
          <span>{toast}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-2xl text-rose-200 text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs bg-rose-900 hover:bg-rose-800 px-3 py-1.5 rounded-xl font-bold transition-all text-rose-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Page Title & Stats Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-xs font-mono font-bold uppercase tracking-wider">
                16:9 Alur Film Studio
              </span>
              {contentId && (
                <span className="text-xs font-mono text-gray-500 bg-gray-950 px-2.5 py-1 rounded-lg border border-gray-800">
                  ID: #{contentId}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2 pt-1">
              <span>🎬</span> Dedicated Video Render Engine (16:9)
            </h1>
            <p className="text-xs text-gray-400 max-w-xl">
              Modul pemrosesan render video Alur Cerita Film (16:9) terisolasi murni. Mengolah klip video 1920x1080, efek slow-motion, mirror, color shift, serta mixing audio voiceover.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading || renderingPart !== null}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl border border-gray-700 transition-all flex items-center gap-2 disabled:opacity-40"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span> Refresh
            </button>

            {isBatchRendering ? (
              <button
                onClick={handleStopBatch}
                className="px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold rounded-xl border border-rose-500/30 transition-all flex items-center gap-2 shadow-lg shadow-rose-950/40 animate-pulse"
              >
                <span>🛑</span> Stop Batch Render
              </button>
            ) : (
              <button
                onClick={handleRenderAllParts}
                disabled={loading || renderingPart !== null || completedRendersCount === totalPartsCount}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-purple-950/50 transition-all flex items-center gap-2 disabled:opacity-40"
              >
                <span>🚀</span> Render All Parts (Auto Queue)
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-800/80">
          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Part Scene</span>
            <span className="text-lg font-black text-white">{totalPartsCount} Part</span>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Mapping Status</span>
            <span className="text-lg font-black text-purple-400">
              {Object.keys(mappings).length} / {totalPartsCount} Ready
            </span>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Hasil Render Ready</span>
            <span className="text-lg font-black text-emerald-400">
              {completedRendersCount} MP4 Video
            </span>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Progress Final Render</span>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-gray-300">{renderProgressPercent}%</span>
                <span className={completedRendersCount === totalPartsCount ? 'text-emerald-400' : 'text-purple-400'}>
                  {completedRendersCount === totalPartsCount ? 'Selesai' : 'Dalam Proses'}
                </span>
              </div>
              <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${renderProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Part Render Status List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Daftar Part / Scene</h3>
            <span className="text-[10px] font-mono text-purple-400 font-bold bg-purple-950 px-2 py-0.5 rounded border border-purple-900">
              {partsList.length} Part
            </span>
          </div>

          <div className="space-y-2">
            {partsList.map((partNum) => {
              const isSelected = activePart === partNum;
              const isRendered = !!renderOutputs[partNum];
              const hasMapping = !!mappings[partNum]?.data?.mappings?.length;
              const isRendering = renderingPart === partNum;

              return (
                <div
                  key={partNum}
                  onClick={() => setActivePart(partNum)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-150 flex flex-col space-y-2 relative overflow-hidden cursor-pointer ${
                    isSelected
                      ? 'bg-purple-950/60 border-purple-500/80 text-white shadow-xl shadow-purple-950/30'
                      : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-850 hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <span>Part #{partNum}</span>
                    </span>

                    {isRendering ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-900 text-purple-200 border border-purple-700 animate-pulse flex items-center gap-1">
                        <span>⏳</span> Rendering...
                      </span>
                    ) : isRendered ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                        <span>✅</span> Rendered MP4
                      </span>
                    ) : hasMapping ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-950 text-blue-400 border border-blue-800 flex items-center gap-1">
                        <span>🎯</span> Ready to Render
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1">
                        <span>⚠️</span> Missing Mapping
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <span>🎬</span> {isRendered ? `${renderOutputs[partNum].elapsed}s Render Time` : (hasMapping ? 'Mapping Ready' : 'Belum Ada Mapping')}
                    </span>
                  </div>

                  {/* Single Action Button per part */}
                  <div className="pt-2 border-t border-gray-800/80">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePart(partNum);
                        handleRenderPartVideo(partNum);
                      }}
                      disabled={!hasMapping || isRendering || isRendered}
                      className={`w-full py-2 rounded-xl text-[11px] font-bold transition-all border flex items-center justify-center gap-1.5 ${
                        isRendered
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60 opacity-80 cursor-not-allowed'
                          : 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border-emerald-500/30 disabled:opacity-40'
                      }`}
                    >
                      <span>{isRendering ? '⏳' : isRendered ? '✓' : '🎬'}</span>
                      <span>
                        {isRendering
                          ? 'Sedang Render...'
                          : isRendered
                          ? '✓ Render Selesai'
                          : 'Start Render Part Video'}
                      </span>
                    </button>
                  </div>

                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500 rounded-r" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Dedicated Video Render Screen & Preview Player */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-6 shadow-xl">
            {/* Active Part Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-purple-400 font-bold bg-purple-950/80 px-2.5 py-0.5 rounded-md border border-purple-800">
                    PART #{activePart} RENDER STUDIO
                  </span>
                  {activeRenderOutput ? (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-800">
                      🎉 Render Complete ({activeRenderOutput.elapsed}s)
                    </span>
                  ) : activeMapping ? (
                    <span className="text-xs font-bold text-blue-400 bg-blue-950/80 px-2.5 py-0.5 rounded-md border border-blue-800">
                      🎯 Ready to Process
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-md border border-amber-800">
                      ⚠️ Mapping Incomplete
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white pt-2">
                  Processing & Preview Studio Part #{activePart}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRenderPartVideo(activePart)}
                  disabled={!activeMapping || renderingPart === activePart || !!activeRenderOutput}
                  className={`px-5 py-2.5 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                    activeRenderOutput
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 cursor-not-allowed opacity-80'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 disabled:opacity-50'
                  }`}
                >
                  <span className={renderingPart === activePart ? 'animate-spin' : ''}>
                    {renderingPart === activePart ? '⏳' : activeRenderOutput ? '✓' : '🎬'}
                  </span>
                  <span>
                    {renderingPart === activePart
                      ? 'Rendering FFmpeg...'
                      : activeRenderOutput
                      ? `✓ Part #${activePart} Sudah Dirender`
                      : 'Render Part #' + activePart}
                  </span>
                </button>
              </div>
            </div>

            {/* Input Specs Summary Box */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gray-950 p-3.5 rounded-2xl border border-gray-800">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Source Video Chunk</span>
                <span className="text-xs font-bold text-white truncate block pt-0.5">
                  {activeChunk ? activeChunk.name : 'Not Uploaded'}
                </span>
              </div>

              <div className="bg-gray-950 p-3.5 rounded-2xl border border-gray-800">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Voiceover Audio</span>
                <span className="text-xs font-bold text-purple-300 truncate block pt-0.5">
                  {activeAudio ? activeAudio.name : 'Audio Voiceover Ready'}
                </span>
              </div>

              <div className="bg-gray-950 p-3.5 rounded-2xl border border-gray-800">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Scene Mappings</span>
                <span className="text-xs font-bold text-emerald-400 truncate block pt-0.5">
                  {activeMapping ? `${activeMapping.mappings?.length || 0} Kalimat Sync` : 'No Mapping Data'}
                </span>
              </div>
            </div>

            {/* Active Render Console Progress & Live STDOUT/STDERR Terminal */}
            {(renderingPart === activePart || renderLogs.length > 0) && (
              <div className="bg-gray-950 border border-purple-900/80 rounded-2xl p-5 space-y-3 shadow-2xl animate-in fade-in">
                <div className="flex items-center justify-between border-b border-gray-850 pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${renderingPart === activePart ? 'bg-purple-400 animate-ping' : 'bg-emerald-400'}`} />
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
                      📟 Live Terminal Logs (STDOUT & STDERR)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-black px-2.5 py-0.5 rounded border border-gray-800">
                      {Math.round(renderPct * 100)}%
                    </span>
                    <button
                      onClick={() => setRenderLogs([])}
                      className="text-[10px] text-gray-500 hover:text-gray-300 font-mono px-2 py-0.5 bg-gray-900 rounded border border-gray-800"
                    >
                      Clear
                    </button>
                    <button
                      onClick={async () => {
                        await api.copyToClipboard(renderLogs.join('\n'));
                        showToast('📋 Terminal logs copied!');
                      }}
                      className="text-[10px] text-purple-400 hover:text-purple-300 font-mono font-bold px-2 py-0.5 bg-purple-950 rounded border border-purple-900"
                    >
                      Copy Logs
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden border border-gray-800">
                  <div
                    className="bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 h-full transition-all duration-200"
                    style={{ width: `${Math.max(3, renderPct * 100)}%` }}
                  />
                </div>

                {/* Auto-scrolling Monospace Log Screen */}
                <div className="p-4 bg-black/95 rounded-xl font-mono text-[11px] border border-gray-850 max-h-64 overflow-y-auto space-y-1 leading-relaxed shadow-inner">
                  {renderLogs.length > 0 ? (
                    renderLogs.map((logLine, idx) => {
                      const isErr = logLine.includes('[STDERR]') || logLine.includes('ERROR') || logLine.includes('Exit Code') || logLine.startsWith('❌');
                      const isSuccess = logLine.includes('Done') || logLine.includes('Complete') || logLine.startsWith('🎉');
                      const isProgress = logLine.includes('%') || logLine.includes('Extracting');

                      return (
                        <div
                          key={idx}
                          className={`break-all ${
                            isErr
                              ? 'text-rose-400 font-bold bg-rose-950/30 px-1 py-0.5 rounded border border-rose-900/50'
                              : isSuccess
                              ? 'text-emerald-400 font-bold'
                              : isProgress
                              ? 'text-cyan-300'
                              : 'text-gray-300'
                          }`}
                        >
                          <span className="text-gray-600 select-none text-[10px] mr-2">
                            [{new Date().toLocaleTimeString()}]
                          </span>
                          {logLine}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-gray-600 text-xs italic">Awaiting terminal log output...</div>
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>
            )}

            {/* Rendered MP4 Video Preview Player */}
            {activeRenderOutput ? (
              <div className="bg-gray-950 border border-emerald-900/60 rounded-3xl p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-850 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                    <h3 className="text-sm font-bold text-white">Preview Output MP4 (16:9 Full HD)</h3>
                  </div>
                  <span className="text-xs font-mono text-emerald-300 bg-emerald-950 px-3 py-1 rounded-lg border border-emerald-800 font-bold">
                    Part #{activePart} • Ready
                  </span>
                </div>

                {/* 16:9 Video Player Container */}
                <div className="aspect-video w-full bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative">
                  <video
                    src={activeRenderOutput.mediaUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400 pt-1 font-mono">
                  <span>File Output: {activeRenderOutput.name}</span>
                  <button
                    onClick={() => api.copyToClipboard(activeRenderOutput.outputPath)}
                    className="text-purple-400 hover:text-purple-300 font-bold"
                  >
                    📋 Copy Path
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center bg-gray-950 border border-dashed border-gray-850 rounded-2xl space-y-3">
                <div className="w-16 h-16 bg-purple-950 text-purple-400 rounded-2xl flex items-center justify-center text-3xl mx-auto border border-purple-900 shadow-xl">
                  🎬
                </div>
                <h3 className="text-sm font-bold text-white">Belum Ada Video Hasil Render Part #{activePart}</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                  Tekan tombol <strong>"Render Part #{activePart}"</strong> di atas untuk memproses pemotongan adegan, penerapan efek Fair-Use, dan mixing voiceover audio.
                </p>
                <div className="pt-2 flex justify-center">
                  <button
                    onClick={() => handleRenderPartVideo(activePart)}
                    disabled={!activeMapping || renderingPart === activePart}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-40"
                  >
                    <span>🎬</span> Start Render Part #{activePart}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlurfilmRenderPlaceholder;
