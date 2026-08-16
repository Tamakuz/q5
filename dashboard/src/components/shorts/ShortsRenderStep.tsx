// dashboard/src/components/shorts/ShortsRenderStep.tsx
import React, { useState, useEffect, useMemo } from 'react';
import type { ShortsSegmentFromStep2, ScriptSegmentsJSONFromStep2, ShortsSegmentMappingData, VideoMappingManifest } from './ShortsMappingStep';

export interface ShortsRenderProgress {
  segmentId: string;
  lang: 'id' | 'en';
  percent: number;
  detail: string;
}

export interface RenderResultItem {
  segmentId: string;
  lang: 'id' | 'en';
  outputPath: string;
  outputFilename: string;
  fileSizeBytes: number;
  elapsedSec: string;
}

const ShortsRenderStep: React.FC = () => {
  const [segments, setSegments] = useState<ShortsSegmentFromStep2[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('');
  const [mappingMap, setMappingMap] = useState<Record<string, ShortsSegmentMappingData>>({});
  const [renderedResults, setRenderedResults] = useState<Record<string, RenderResultItem>>({});

  const [selectedLang, setSelectedLang] = useState<'id' | 'en'>('id');
  const [isLoading, setIsLoading] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<ShortsRenderProgress | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Load all data on mount
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      try {
        if (window.electronAPI?.readFromProject) {
          // 1. Read Step 2 segments
          const rawSegs = await window.electronAPI.readFromProject('input/shorts/script-segments.json');
          if (rawSegs) {
            const data: ScriptSegmentsJSONFromStep2 = typeof rawSegs === 'string' ? JSON.parse(rawSegs) : rawSegs;
            if (data && data.segments && data.segments.length > 0) {
              setSegments(data.segments);
              setSelectedSegmentId(data.segments[0].id);
            }
          }

          // 2. Read Step 4 video mapping manifest
          const rawMapping = await window.electronAPI.readFromProject('input/shorts/video-mapping.json');
          if (rawMapping) {
            const manifest: VideoMappingManifest = typeof rawMapping === 'string' ? JSON.parse(rawMapping) : rawMapping;
            if (manifest && manifest.items) {
              setMappingMap(manifest.items);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load ShortsRenderStep data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, []);

  // Listen for real-time render progress events
  useEffect(() => {
    if (!window.electronAPI?.onShortsRenderProgress) return;
    const cleanup = window.electronAPI.onShortsRenderProgress((progressData: ShortsRenderProgress) => {
      setRenderProgress(progressData);
    });
    return () => {
      if (cleanup && typeof cleanup === 'function') cleanup();
    };
  }, []);

  const activeSegment = segments.find((s) => s.id === selectedSegmentId) || segments[0];
  const activeMapping = selectedSegmentId ? mappingMap[selectedSegmentId] : null;
  const activeCuts = selectedLang === 'id' ? activeMapping?.cuts_id || [] : activeMapping?.cuts_en || [];
  const renderKey = selectedSegmentId ? `${selectedSegmentId}_${selectedLang}` : '';
  const activeRenderResult = renderKey ? renderedResults[renderKey] : null;

  // Helper: Format media URL for Electron video player
  const getMediaUrl = (filePath?: string): string => {
    if (!filePath) return '';
    if (filePath.startsWith('media://') || filePath.startsWith('http://') || filePath.startsWith('blob:')) {
      return filePath;
    }
    if (window.electronAPI?.getMediaUrl) {
      return window.electronAPI.getMediaUrl(filePath);
    }
    return `media://content-auto/${encodeURIComponent(filePath)}`;
  };

  const activeRenderedMediaUrl = getMediaUrl(activeRenderResult?.outputPath);

  // Trigger FFmpeg Render for single active segment
  const handleRenderActiveSegment = async () => {
    if (!activeSegment) return;
    if (activeCuts.length === 0) {
      setErrorMsg(`Belum ada data Video Mapping (Step 4) untuk Bahasa ${selectedLang === 'id' ? 'Indonesia' : 'Inggris'}.`);
      return;
    }

    setIsRendering(true);
    setErrorMsg(null);
    setRenderProgress({
      segmentId: activeSegment.id,
      lang: selectedLang,
      percent: 5,
      detail: 'Menyiapkan proses FFmpeg rendering...',
    });

    try {
      if (!window.electronAPI?.renderShortsSegment) {
        throw new Error('Electron API renderShortsSegment tidak tersedia.');
      }

      const res = await window.electronAPI.renderShortsSegment({
        segmentId: activeSegment.id,
        lang: selectedLang,
      });

      if (res && res.success && res.outputPath) {
        const item: RenderResultItem = {
          segmentId: activeSegment.id,
          lang: selectedLang,
          outputPath: res.outputPath,
          outputFilename: res.outputFilename || `seg_${activeSegment.id}_${selectedLang}_final.mp4`,
          fileSizeBytes: res.fileSizeBytes || 0,
          elapsedSec: res.elapsedSec || '0',
        };

        setRenderedResults((prev) => ({
          ...prev,
          [renderKey]: item,
        }));

        showToast(`🎉 Segmen #${activeSegment.id} (${selectedLang.toUpperCase()}) Berhasil Dirender dalam ${res.elapsedSec}s!`);
      } else {
        throw new Error(res?.error || 'Gagal merender video segmen Shorts.');
      }
    } catch (err: any) {
      console.error('Render Shorts Segment Error:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan saat merender video.');
    } finally {
      setIsRendering(false);
      setRenderProgress(null);
    }
  };

  // Batch Render All Shorts Segments sequentially
  const handleBatchRenderAll = async () => {
    if (segments.length === 0) return;
    setIsRendering(true);
    setErrorMsg(null);

    let successCount = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segMapping = mappingMap[seg.id];
      const cuts = selectedLang === 'id' ? segMapping?.cuts_id || [] : segMapping?.cuts_en || [];

      if (cuts.length === 0) continue;

      setRenderProgress({
        segmentId: seg.id,
        lang: selectedLang,
        percent: Math.round(((i) / segments.length) * 100),
        detail: `[${i + 1}/${segments.length}] Merender segmen: ${seg.title}...`,
      });

      try {
        if (window.electronAPI?.renderShortsSegment) {
          const res = await window.electronAPI.renderShortsSegment({
            segmentId: seg.id,
            lang: selectedLang,
          });

          if (res && res.success && res.outputPath) {
            const key = `${seg.id}_${selectedLang}`;
            const item: RenderResultItem = {
              segmentId: seg.id,
              lang: selectedLang,
              outputPath: res.outputPath,
              outputFilename: res.outputFilename || `seg_${seg.id}_${selectedLang}_final.mp4`,
              fileSizeBytes: res.fileSizeBytes || 0,
              elapsedSec: res.elapsedSec || '0',
            };
            setRenderedResults((prev) => ({ ...prev, [key]: item }));
            successCount++;
          }
        }
      } catch (err) {
        console.warn(`Batch render error for segment ${seg.id}:`, err);
      }
    }

    setIsRendering(false);
    setRenderProgress(null);
    showToast(`🚀 Batch Render Selesai! ${successCount} dari ${segments.length} segmen berhasil dirender.`);
  };

  return (
    <div className="p-6 bg-gray-950/90 border border-gray-800 rounded-3xl min-h-full space-y-8 text-gray-100">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-amber-500 text-gray-950 text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl border border-amber-300 animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* Step Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800/80 pb-5 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center text-2xl border border-amber-500/20 shadow-lg shadow-amber-950/40">
            🎬
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
              Step 5: Shorts FFmpeg Video Render Studio
              <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 text-xs font-mono font-semibold">
                9:16 Vertical Video Renderer
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Gabungkan klip video hasil mapping Step 4 dengan audio voiceover Step 3 menjadi video Shorts vertikal (9:16) siap publish.
            </p>
          </div>
        </div>

        {/* Global Language Toggle */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-xl text-xs font-mono flex items-center gap-2">
            <span className="text-gray-400">Bahasa Output:</span>
            <div className="flex bg-gray-950 rounded-lg p-0.5 border border-gray-800">
              <button
                onClick={() => setSelectedLang('id')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                  selectedLang === 'id' ? 'bg-amber-500 text-gray-950 shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                🇮🇩 Indonesia
              </button>
              <button
                onClick={() => setSelectedLang('en')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                  selectedLang === 'en' ? 'bg-amber-500 text-gray-950 shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                🇺🇸 English
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-gray-400 font-mono">Memuat data segmen & video mapping...</span>
        </div>
      ) : (
        /* Main Layout: Left Segments List + Right Render Studio Workspace */
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Panel: Shorts Segments Sidebar List */}
          <div className="w-full lg:w-80 shrink-0 bg-gray-900/80 border border-gray-800 rounded-2xl p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800/80">
              <h2 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono flex items-center gap-2">
                <span>✂️</span> Segmen Shorts ({segments.length})
              </h2>
              <span className="text-[10px] text-gray-500 font-mono">Step 4 Mapping</span>
            </div>

            {segments.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500 italic border border-dashed border-gray-800 rounded-xl">
                Belum ada segmen dari Step 2.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
                {segments.map((seg, i) => {
                  const isSelected = seg.id === selectedSegmentId;
                  const segMapping = mappingMap[seg.id];
                  const hasCuts = selectedLang === 'id' ? (segMapping?.cuts_id?.length || 0) > 0 : (segMapping?.cuts_en?.length || 0) > 0;
                  const resItem = renderedResults[`${seg.id}_${selectedLang}`];

                  return (
                    <button
                      key={seg.id}
                      onClick={() => setSelectedSegmentId(seg.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-950/30'
                          : 'bg-gray-950/60 border-gray-800/80 text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold font-mono text-amber-400 truncate">
                          #{i + 1}: {seg.title}
                        </span>
                        {isSelected && <span className="text-xs">🎯</span>}
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-gray-500">
                        {resItem ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <span>✅</span> Rendered MP4
                          </span>
                        ) : hasCuts ? (
                          <span className="text-amber-300 font-semibold flex items-center gap-1">
                            <span>🎯</span> Ready to Render
                          </span>
                        ) : (
                          <span className="text-gray-600">⚠️ Belum Ada Mapping</span>
                        )}

                        <span className="text-cyan-400">
                          {selectedLang === 'id' ? `${segMapping?.cuts_id?.length || 0} Cuts` : `${segMapping?.cuts_en?.length || 0} Cuts`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Workspace: Render Control & Preview Player */}
          <div className="flex-1 min-w-0 space-y-8 w-full">
            {/* Render Settings & Controls Box */}
            <div className="bg-gray-900/70 border border-gray-800 p-5 rounded-2xl space-y-4 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800/80 pb-4">
                <div>
                  <h2 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2 font-mono">
                    <span>🎬</span> FFmpeg Video Render Controls ({selectedLang === 'id' ? '🇮🇩 Bahasa Indonesia' : '🇺🇸 English'})
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Segment: #{segments.findIndex((s) => s.id === selectedSegmentId) + 1} - {activeSegment?.title} ({activeCuts.length} Video Cuts)
                  </p>
                </div>

                {/* Render Trigger Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={handleBatchRenderAll}
                    disabled={isRendering || segments.length === 0}
                    className="px-4 py-2 bg-gray-950 hover:bg-gray-800 text-amber-300 border border-amber-500/40 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <span>🚀</span> Batch Render Semua Segmen
                  </button>

                  <button
                    onClick={handleRenderActiveSegment}
                    disabled={isRendering || activeCuts.length === 0}
                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center gap-2 disabled:opacity-40 shrink-0"
                  >
                    {isRendering ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-gray-950 border-t-transparent rounded-full animate-spin"></div>
                        <span>Rendering FFmpeg...</span>
                      </>
                    ) : (
                      <>
                        <span>🎬</span>
                        <span>Render Segmen Ini (9:16)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Render Settings Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs text-gray-300">
                <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 flex flex-col gap-0.5">
                  <span className="text-[10px] text-gray-500 uppercase">Format Video</span>
                  <span className="text-amber-300 font-bold">9:16 Vertikal (Shorts)</span>
                </div>
                <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 flex flex-col gap-0.5">
                  <span className="text-[10px] text-gray-500 uppercase">Frame Rate</span>
                  <span className="text-amber-300 font-bold">30 FPS</span>
                </div>
                <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 flex flex-col gap-0.5">
                  <span className="text-[10px] text-gray-500 uppercase">Jumlah Klip Adegan</span>
                  <span className="text-amber-300 font-bold">{activeCuts.length} Klip Video</span>
                </div>
                <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 flex flex-col gap-0.5">
                  <span className="text-[10px] text-gray-500 uppercase">Voiceover Audio</span>
                  <span className="text-amber-300 font-bold">
                    {selectedLang === 'id'
                      ? (activeMapping?.audio_path_id ? '🇮🇩 Uploaded' : 'No Audio')
                      : (activeMapping?.audio_path_en ? '🇺🇸 Uploaded' : 'No Audio')}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              {isRendering && renderProgress && (
                <div className="bg-gray-950 p-4 rounded-2xl border border-amber-500/30 space-y-2.5 shadow-inner">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-amber-300 font-bold">{renderProgress.detail}</span>
                    <span className="text-amber-400 font-bold">{renderProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-300 shadow"
                      style={{ width: `${renderProgress.percent}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {errorMsg && (
                <div className="p-3.5 bg-red-950/80 border border-red-800/80 rounded-xl text-red-200 text-xs font-mono flex items-center justify-between">
                  <span>⚠️ {errorMsg}</span>
                  <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200">✕</button>
                </div>
              )}
            </div>

            {/* Render Output Player Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2.5">
                    <span>📱</span> Hasil Render Video Shorts (9:16 MP4)
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Pratinjau pemutar video Shorts hasil render FFmpeg yang sudah menggabungkan potongan adegan video dan audio narasi.
                  </p>
                </div>
              </div>

              {activeRenderResult ? (
                <div className="bg-gray-900/70 border border-gray-800 p-5 rounded-2xl space-y-4">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 font-mono text-xs">
                      <div className="text-emerald-400 font-bold flex items-center gap-2">
                        <span>✅</span> {activeRenderResult.outputFilename}
                      </div>
                      <div className="text-gray-400 text-[11px]">
                        Ukuran File: {(activeRenderResult.fileSizeBytes / 1024 / 1024).toFixed(2)} MB | Waktu Render: {activeRenderResult.elapsedSec}s
                      </div>
                    </div>

                    <code className="text-[10px] font-mono bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-800 text-amber-300 truncate max-w-sm">
                      {activeRenderResult.outputPath}
                    </code>
                  </div>

                  {/* 9:16 Vertical Player Frame */}
                  <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 flex justify-center items-center">
                    <video
                      src={activeRenderedMediaUrl}
                      controls
                      className="h-[480px] w-[270px] rounded-xl object-contain bg-black shadow-2xl border border-gray-800"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-gray-900/40 border border-dashed border-gray-800 p-12 rounded-2xl text-center space-y-3">
                  <div className="text-4xl text-amber-500/40">🎬</div>
                  <h3 className="text-sm font-bold text-gray-300">Belum Ada Video Hasil Render</h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    Klik <strong>Render Segmen Ini (9:16)</strong> di atas untuk memicu proses pemotongan dan penggabungan video FFmpeg.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Storage Path */}
      <div className="border-t border-gray-800/80 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
        <div className="flex items-center gap-2 font-mono">
          <span>📂 Output Directory:</span>
          <code className="text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
            output/shorts/
          </code>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span>⚙️ Engine Renderer:</span>
          <code className="text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
            cli.ts render (FFmpeg 9:16 CLI)
          </code>
        </div>
      </div>
    </div>
  );
};

export default ShortsRenderStep;
