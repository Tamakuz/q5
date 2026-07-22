// dashboard/src/components/placeholders/longform/AlurfilmSplitterPlaceholder.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { SourceInfo, AlurfilmChunk } from '../../../electron-api';

const api = window.electronAPI;

function formatSecondsToHHMMSS(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

const AlurfilmSplitterPlaceholder: React.FC = () => {
  const [uploadingMaster, setUploadingMaster] = useState<boolean>(false);
  const [contentId, setContentId] = useState<string | null>(null);
  const [masterSource, setMasterSource] = useState<SourceInfo | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<AlurfilmChunk | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  
  const [startTime, setStartTime] = useState<string>('00:00:00');
  const [endTime, setEndTime] = useState<string>('00:00:00');
  
  const [splitting, setSplitting] = useState<boolean>(false);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [toast, setToast] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    (async () => {
      try {
        const id = await api.getContentId('longform');
        setContentId(id);

        if (id) {
          const existingChunks = await api.listAlurfilmChunks(id);
          if (existingChunks && existingChunks.length > 0) {
            setChunks(existingChunks);
          }
        }
      } catch {}
    })();
  }, []);

  const handleSelectMaster = async () => {
    try {
      const selected = await api.selectFile();
      if (!selected) return;

      setUploadingMaster(true);
      setError(null);
      setSelectedChunk(null);

      const uploaded = await api.uploadAlurfilmSource(selected.path);
      setMasterSource(uploaded);

      const meta = await api.getVideoMeta(selected.path);
      if (meta && meta.duration) {
        setVideoDuration(meta.duration);
        setStartTime('00:00:00');
        setEndTime(formatSecondsToHHMMSS(meta.duration));
      }
      showToast(`Master video loaded directly: ${uploaded.name}`);
    } catch (err: any) {
      setError(err.message || 'Failed to load master video');
    } finally {
      setUploadingMaster(false);
    }
  };

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (dur && !videoDuration && !selectedChunk) {
        setVideoDuration(dur);
        setEndTime(formatSecondsToHHMMSS(dur));
      }
    }
  };

  const handleSplitVideo = async () => {
    if (!masterSource || !masterSource.filePath) {
      setError('Upload a master video first');
      return;
    }

    setSplitting(true);
    setError(null);

    try {
      const resultChunks = await api.splitAlurfilmVideo(
        masterSource.filePath,
        startTime,
        endTime
      );
      setChunks(resultChunks);
      if (resultChunks.length > 0) {
        setSelectedChunk(resultChunks[0]);
      }
      showToast(`Successfully split video into ${resultChunks.length} parts (600s each)!`);
    } catch (err: any) {
      setError(err.message || 'Failed to split video');
    }
    setSplitting(false);
  };

  const handleCopyPath = async (e: React.MouseEvent, pathStr: string, idx: number) => {
    e.stopPropagation();
    await api.copyToClipboard(pathStr);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const activeVideoUrl = selectedChunk ? selectedChunk.url : masterSource?.url;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-6 overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-purple-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl border border-purple-400 animate-bounce">
          {toast}
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-800 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold font-mono uppercase tracking-wider">
              16:9 Alur Cerita Film Mode
            </span>
            <span className="text-xs text-gray-500">• Workflow Step 1: Video Splitter</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
            <span className="p-2 bg-purple-600/20 text-purple-400 rounded-lg text-lg">✂️</span>
            Alur Film Master Video & 10-Min Splitter Engine
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Upload file video film utuh dan potong menjadi segmen per 10 menit (600 detik). Klik hasil potongan untuk memutar preview.
          </p>
        </div>

        {contentId && (
          <div className="flex items-center gap-2">
            <div className="px-3.5 py-1.5 rounded-lg border border-purple-700/50 bg-purple-950/60 text-purple-300 text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-purple-950/40">
              <span>🆔</span>
              <span>{contentId}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 flex-1 min-h-0 overflow-hidden">
        {/* LEFT PANEL: Video Player & Controls (Col 6) */}
        <div className="lg:col-span-6 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>{selectedChunk ? '▶️' : '🎬'}</span>
                <span>{selectedChunk ? `Previewing Part ${selectedChunk.part}` : 'Master Movie File'}</span>
              </span>
              {selectedChunk && (
                <span className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-700/60 rounded text-[10px] font-mono font-bold">
                  {selectedChunk.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedChunk && masterSource && (
                <button
                  onClick={() => setSelectedChunk(null)}
                  className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-purple-300 rounded-lg text-[11px] font-semibold transition-all border border-gray-700 flex items-center gap-1"
                >
                  <span>🎬</span> Switch to Master
                </button>
              )}
              <button
                onClick={handleSelectMaster}
                disabled={uploadingMaster}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 ${
                  uploadingMaster
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
                }`}
              >
                <span>{uploadingMaster ? '⏳' : '📁'}</span>
                <span>{uploadingMaster ? 'Loading 1GB+...' : 'Select Master'}</span>
              </button>
            </div>
          </div>

          {/* Video Player Container */}
          <div className="flex-1 bg-black rounded-xl overflow-hidden flex items-center justify-center border border-gray-800 min-h-0 relative">
            {uploadingMaster ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <div>
                  <p className="text-xs font-bold text-purple-300">Membaca Master Video...</p>
                  <p className="text-[11px] text-gray-500 mt-1">Membaca langsung dari path asli tanpa penyalinan.</p>
                </div>
              </div>
            ) : activeVideoUrl ? (
              <video
                ref={videoRef}
                key={activeVideoUrl}
                src={activeVideoUrl}
                controls
                autoPlay={!!selectedChunk}
                preload="metadata"
                onLoadedMetadata={handleVideoLoadedMetadata}
                className="w-full h-full object-contain max-h-[360px]"
              />
            ) : (
              <div
                onClick={handleSelectMaster}
                className="w-full h-full flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-800 hover:border-purple-600/50 rounded-xl cursor-pointer transition-all text-center space-y-3 group"
              >
                <div className="w-14 h-14 bg-purple-600/10 text-purple-400 rounded-2xl flex items-center justify-center text-2xl border border-purple-500/20 group-hover:scale-105 transition-transform">
                  🎬
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Click to Select Master Video File</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Membaca langsung dari lokasi file asli tanpa penyalinan (0s Instant Load)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Master / Chunk Specs Badge */}
          {masterSource && (
            <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-[11px]">Currently Playing:</span>
                <span className="text-purple-300 font-mono font-bold truncate max-w-[260px]">
                  {selectedChunk ? selectedChunk.name : masterSource.name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-[11px]">Master Duration:</span>
                <span className="text-gray-200 font-mono font-bold">
                  {formatSecondsToHHMMSS(videoDuration)} ({Math.round(videoDuration)}s)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-[11px]">File Path:</span>
                <button
                  onClick={(e) => handleCopyPath(e, selectedChunk ? selectedChunk.filePath : (masterSource.filePath || ''), 999)}
                  className="text-[10px] font-mono text-purple-400 hover:underline truncate max-w-[240px]"
                >
                  {copiedIndex === 999 ? '✓ Copied Path' : (selectedChunk ? selectedChunk.filePath : (masterSource.filePath || ''))}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Custom Time Range & Split Controls (Col 6) */}
        <div className="lg:col-span-6 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>⏱️</span> Custom Split Range & Settings
            </span>
            <span className="px-2.5 py-1 rounded-md bg-purple-950/80 border border-purple-800 text-[11px] font-mono font-bold text-purple-300">
              🔒 Locked 600s / 10 Min
            </span>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Time Picker Controls */}
          <div className="grid grid-cols-2 gap-4 bg-gray-950 p-4 rounded-xl border border-gray-800">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Start Time (HH:MM:SS)
              </label>
              <input
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="00:00:00"
                className="w-full bg-gray-900 border border-gray-700 text-white font-mono text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                End Time (HH:MM:SS)
              </label>
              <input
                type="text"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="01:30:00"
                className="w-full bg-gray-900 border border-gray-700 text-white font-mono text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Execute Split Action Button */}
          <button
            onClick={handleSplitVideo}
            disabled={splitting || !masterSource}
            className={`w-full py-3 rounded-xl font-bold text-xs shadow-xl transition-all flex items-center justify-center gap-2 ${
              splitting || !masterSource
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
            }`}
          >
            <span>{splitting ? '⏳' : '✂️'}</span>
            <span>{splitting ? 'Splitting Video per 10 Min...' : 'Split Video (Per 10 Menit)'}</span>
          </button>

          {/* Generated Chunks Gallery List */}
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Hasil Potongan (Click item to preview)
              </span>
              <span className="text-[11px] text-purple-400 font-mono font-bold">
                {chunks.length} Parts Generated
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
              {chunks.length > 0 ? (
                chunks.map((chunk, idx) => {
                  const isSelected = selectedChunk?.filePath === chunk.filePath;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedChunk(chunk)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-purple-950/70 border-purple-500 shadow-lg shadow-purple-950/40 ring-1 ring-purple-500/50'
                          : 'bg-gray-950 border-gray-800 hover:border-purple-700/60 hover:bg-gray-900/80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 border ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                            : 'bg-purple-950 text-purple-300 border-purple-800'
                        }`}>
                          P{chunk.part}
                        </div>
                        <div className="min-w-0">
                          <span className={`text-xs font-bold font-mono truncate block ${isSelected ? 'text-purple-200' : 'text-white'}`}>
                            {chunk.name}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono block">
                            {(chunk.size / (1024 * 1024)).toFixed(1)} MB • Segmen 10 Min {isSelected && '• ▶️ Playing'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => handleCopyPath(e, chunk.filePath, idx)}
                          className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md text-[11px] font-medium transition-all"
                        >
                          {copiedIndex === idx ? '✓ Copied' : 'Copy Path'}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-28 flex flex-col items-center justify-center border border-dashed border-gray-800 rounded-xl text-center p-4 text-gray-500 text-xs">
                  <span>Belum ada hasil potongan video. Klik "Split Video" untuk memotong master video.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlurfilmSplitterPlaceholder;
