// dashboard/src/components/shorts/ShortsMergerStep.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { VideoMeta } from '../../electron-api';

interface LoadedVideo {
  name: string;
  path: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  url: string;
}

interface MergeProgress {
  stage: string;
  progress: number;
  message: string;
}

interface MergedResult {
  outputPath: string;
  outputUrl: string;
  outputFilename: string;
  duration: number;
  width: number;
  height: number;
  fileSizeBytes: number;
  method?: string;
}

export const ShortsMergerStep: React.FC = () => {
  const [part1, setPart1] = useState<LoadedVideo | null>(null);
  const [part2, setPart2] = useState<LoadedVideo | null>(null);
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [progress, setProgress] = useState<MergeProgress | null>(null);
  const [mergedResult, setMergedResult] = useState<MergedResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Drag-and-drop state indicators
  const [isDragging1, setIsDragging1] = useState<boolean>(false);
  const [isDragging2, setIsDragging2] = useState<boolean>(false);

  const fileInputRef1 = useRef<HTMLInputElement | null>(null);
  const fileInputRef2 = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (window.electronAPI?.onMergeShortsProgress) {
      const unsub = window.electronAPI.onMergeShortsProgress((data) => {
        setProgress(data);
      });
      return () => unsub();
    }
  }, []);

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const handleSelectFile = async (partNum: 1 | 2) => {
    setErrorMessage(null);
    try {
      if (window.electronAPI?.selectFile) {
        const file = await window.electronAPI.selectFile();
        if (!file) return;

        let meta: VideoMeta | null = null;
        if (window.electronAPI?.getVideoMeta) {
          meta = await window.electronAPI.getVideoMeta(file.path);
        }

        const loaded: LoadedVideo = {
          name: file.name,
          path: file.path,
          size: file.size,
          duration: meta?.duration || 0,
          width: meta?.width || 0,
          height: meta?.height || 0,
          url: meta?.url || `media://content-auto/${encodeURIComponent(file.path)}`,
        };

        if (partNum === 1) {
          setPart1(loaded);
        } else {
          setPart2(loaded);
        }
      }
    } catch (err: any) {
      setErrorMessage(`Gagal memilih video Part ${partNum}: ${err.message}`);
    }
  };

  const handleFileDrop = async (e: React.DragEvent, partNum: 1 | 2) => {
    e.preventDefault();
    if (partNum === 1) setIsDragging1(false);
    if (partNum === 2) setIsDragging2(false);
    setErrorMessage(null);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    const filePath = (file as any).path;
    if (!filePath) {
      setErrorMessage('Browser tidak mendukung pengambilan path file langsung. Silakan gunakan tombol pilih file.');
      return;
    }

    try {
      let meta: VideoMeta | null = null;
      if (window.electronAPI?.getVideoMeta) {
        meta = await window.electronAPI.getVideoMeta(filePath);
      }

      const loaded: LoadedVideo = {
        name: file.name,
        path: filePath,
        size: file.size,
        duration: meta?.duration || 0,
        width: meta?.width || 0,
        height: meta?.height || 0,
        url: meta?.url || `media://content-auto/${encodeURIComponent(filePath)}`,
      };

      if (partNum === 1) {
        setPart1(loaded);
      } else {
        setPart2(loaded);
      }
    } catch (err: any) {
      setErrorMessage(`Gagal memuat video drop Part ${partNum}: ${err.message}`);
    }
  };

  const handleSwapParts = () => {
    const temp = part1;
    setPart1(part2);
    setPart2(temp);
  };

  const handleMergeVideos = async () => {
    if (!part1 || !part2) {
      setErrorMessage('Harap pilih kedua video (Part 1 dan Part 2) sebelum menggabungkan.');
      return;
    }

    setIsMerging(true);
    setErrorMessage(null);
    setMergedResult(null);
    setProgress({ stage: 'start', progress: 5, message: 'Mempersiapkan penggabungan...' });

    try {
      if (window.electronAPI?.mergeShortsVideos) {
        const res = await window.electronAPI.mergeShortsVideos(part1.path, part2.path);
        if (res.success && res.outputPath) {
          setMergedResult({
            outputPath: res.outputPath,
            outputUrl: res.outputUrl || `media://content-auto/${encodeURIComponent(res.outputPath)}`,
            outputFilename: res.outputFilename || 'shorts_merged.mp4',
            duration: res.duration || 0,
            width: res.width || 1080,
            height: res.height || 1920,
            fileSizeBytes: res.fileSizeBytes || 0,
            method: res.method,
          });
        } else {
          setErrorMessage(res.error || 'Gagal menggabungkan video.');
        }
      } else {
        setErrorMessage('Fitur merge video belum tersedia di lingkungan ini.');
      }
    } catch (err: any) {
      setErrorMessage(`Terjadi kesalahan saat menggabungkan video: ${err.message}`);
    } finally {
      setIsMerging(false);
    }
  };

  const handleOpenFolder = async (filePath: string) => {
    if (window.electronAPI?.openInFolder) {
      await window.electronAPI.openInFolder(filePath);
    }
  };

  const handleCopyPath = async (filePath: string) => {
    if (window.electronAPI?.copyToClipboard) {
      await window.electronAPI.copyToClipboard(filePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalEstimatedDuration = (part1?.duration || 0) + (part2?.duration || 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Studio */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/50 text-[11px] font-mono font-bold tracking-wider uppercase">
                ⚡ Shorts Studio
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-400 text-[10px] font-mono border border-gray-700">
                Linear Concat Engine
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>🎬</span> Penggabung Video Linier (Part 1 & 2)
            </h1>
            <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
              Unggah 2 video berurutan (Part 1 sebagai awalan dan Part 2 sebagai kelanjutan). Sistem akan menyambungkannya secara mulus menjadi satu video tunggal menggunakan engine FFmpeg.
            </p>
          </div>

          {(part1 || part2) && (
            <button
              onClick={() => {
                setPart1(null);
                setPart2(null);
                setMergedResult(null);
                setProgress(null);
                setErrorMessage(null);
              }}
              disabled={isMerging}
              className="px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-xs font-semibold rounded-xl border border-gray-700 transition-all self-start md:self-auto flex items-center gap-1.5"
            >
              <span>🗑️</span> Reset Pilihan
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-4 flex items-start gap-3 shadow-lg">
          <span className="text-xl">⚠️</span>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-red-300">Terjadi Kendala</h4>
            <p className="text-xs text-red-200/80 mt-0.5 whitespace-pre-wrap">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-200 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Part 1 Card */}
        <div className="bg-gray-900/70 border border-gray-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center border border-amber-500/30">
                1
              </span>
              <h3 className="text-sm font-bold text-white">Video Part 1 (Awalan)</h3>
            </div>
            {part1 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                Siap
              </span>
            )}
          </div>

          {part1 ? (
            <div className="space-y-3">
              <div className="relative bg-black rounded-2xl overflow-hidden border border-gray-800 flex items-center justify-center max-h-64 aspect-video">
                <video
                  src={part1.url}
                  controls
                  className="w-full h-full object-contain max-h-64"
                />
              </div>

              <div className="space-y-1.5 text-xs bg-gray-950 p-3 rounded-xl border border-gray-800/80">
                <div className="font-semibold text-gray-200 truncate" title={part1.name}>
                  {part1.name}
                </div>
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-gray-400">
                  <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800">
                    ⏱️ {formatDuration(part1.duration)}
                  </span>
                  {part1.width > 0 && (
                    <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800">
                      📐 {part1.width} × {part1.height}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800">
                    💾 {formatFileSize(part1.size)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSelectFile(1)}
                  disabled={isMerging}
                  className="flex-1 py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold transition-all border border-gray-700 flex items-center justify-center gap-1.5"
                >
                  <span>🔄</span> Ganti File Part 1
                </button>
                <button
                  onClick={() => setPart1(null)}
                  disabled={isMerging}
                  className="py-2 px-3 bg-red-950/40 hover:bg-red-900/60 text-red-300 rounded-xl text-xs font-semibold transition-all border border-red-800/40"
                  title="Hapus Part 1"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging1(true); }}
              onDragLeave={() => setIsDragging1(false)}
              onDrop={(e) => handleFileDrop(e, 1)}
              onClick={() => handleSelectFile(1)}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 min-h-[220px] ${
                isDragging1
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-gray-800 bg-gray-950/50 hover:border-gray-700 hover:bg-gray-950'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-2xl border border-amber-500/20">
                📤
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-200">Pilih Video Part 1</p>
                <p className="text-[11px] text-gray-500">Klik untuk browse atau seret file ke sini</p>
              </div>
              <span className="text-[10px] font-mono text-gray-600">.mp4, .mov, .webm, .mkv</span>
            </div>
          )}
        </div>

        {/* Part 2 Card */}
        <div className="bg-gray-900/70 border border-gray-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center border border-amber-500/30">
                2
              </span>
              <h3 className="text-sm font-bold text-white">Video Part 2 (Kelanjutan)</h3>
            </div>
            {part2 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                Siap
              </span>
            )}
          </div>

          {part2 ? (
            <div className="space-y-3">
              <div className="relative bg-black rounded-2xl overflow-hidden border border-gray-800 flex items-center justify-center max-h-64 aspect-video">
                <video
                  src={part2.url}
                  controls
                  className="w-full h-full object-contain max-h-64"
                />
              </div>

              <div className="space-y-1.5 text-xs bg-gray-950 p-3 rounded-xl border border-gray-800/80">
                <div className="font-semibold text-gray-200 truncate" title={part2.name}>
                  {part2.name}
                </div>
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-gray-400">
                  <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800">
                    ⏱️ {formatDuration(part2.duration)}
                  </span>
                  {part2.width > 0 && (
                    <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800">
                      📐 {part2.width} × {part2.height}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800">
                    💾 {formatFileSize(part2.size)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSelectFile(2)}
                  disabled={isMerging}
                  className="flex-1 py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold transition-all border border-gray-700 flex items-center justify-center gap-1.5"
                >
                  <span>🔄</span> Ganti File Part 2
                </button>
                <button
                  onClick={() => setPart2(null)}
                  disabled={isMerging}
                  className="py-2 px-3 bg-red-950/40 hover:bg-red-900/60 text-red-300 rounded-xl text-xs font-semibold transition-all border border-red-800/40"
                  title="Hapus Part 2"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging2(true); }}
              onDragLeave={() => setIsDragging2(false)}
              onDrop={(e) => handleFileDrop(e, 2)}
              onClick={() => handleSelectFile(2)}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 min-h-[220px] ${
                isDragging2
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-gray-800 bg-gray-950/50 hover:border-gray-700 hover:bg-gray-950'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-2xl border border-amber-500/20">
                📤
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-200">Pilih Video Part 2</p>
                <p className="text-[11px] text-gray-500">Klik untuk browse atau seret file ke sini</p>
              </div>
              <span className="text-[10px] font-mono text-gray-600">.mp4, .mov, .webm, .mkv</span>
            </div>
          )}
        </div>
      </div>

      {/* Linear Sequence Connector & Merge Bar */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Visual Sequence Pipeline */}
          <div className="flex items-center gap-2.5 overflow-x-auto max-w-full text-xs font-semibold text-gray-400">
            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
              part1 ? 'bg-gray-950 border-amber-500/40 text-amber-300' : 'bg-gray-950/40 border-gray-800 text-gray-600'
            }`}>
              <span>1️⃣</span>
              <span className="truncate max-w-[120px]">{part1 ? part1.name : 'Part 1 Belum Dipilih'}</span>
              {part1 && <span className="text-[10px] font-mono opacity-80">({formatDuration(part1.duration)})</span>}
            </div>

            <span className="text-base text-gray-600 font-bold">➔</span>

            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
              part2 ? 'bg-gray-950 border-amber-500/40 text-amber-300' : 'bg-gray-950/40 border-gray-800 text-gray-600'
            }`}>
              <span>2️⃣</span>
              <span className="truncate max-w-[120px]">{part2 ? part2.name : 'Part 2 Belum Dipilih'}</span>
              {part2 && <span className="text-[10px] font-mono opacity-80">({formatDuration(part2.duration)})</span>}
            </div>

            <span className="text-base text-gray-600 font-bold">=</span>

            <div className="px-3 py-1.5 rounded-xl border bg-purple-950/30 border-purple-800/40 text-purple-300 flex items-center gap-1.5">
              <span>🎯</span>
              <span>Hasil Gabungan</span>
              {totalEstimatedDuration > 0 && (
                <span className="text-[10px] font-mono opacity-80">
                  (± {formatDuration(totalEstimatedDuration)})
                </span>
              )}
            </div>
          </div>

          {/* Swap Button */}
          {part1 && part2 && (
            <button
              onClick={handleSwapParts}
              disabled={isMerging}
              className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition-all border border-gray-700 flex items-center gap-1.5 shrink-0"
              title="Tukar urutan Video Part 1 dan Part 2"
            >
              <span>⇄</span> Tukar Urutan (Part 1 ↔ Part 2)
            </button>
          )}
        </div>

        {/* Action Button & Progress */}
        <div className="pt-2 border-t border-gray-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-400">
              {part1 && part2 ? (
                <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                  <span>✓</span> Kedua video siap untuk digabungkan secara linier.
                </span>
              ) : (
                <span className="text-gray-500">
                  Unggah kedua video Part 1 dan Part 2 untuk mengaktifkan tombol gabung.
                </span>
              )}
            </div>

            <button
              onClick={handleMergeVideos}
              disabled={!part1 || !part2 || isMerging}
              className={`w-full sm:w-auto px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-xl flex items-center justify-center gap-2 ${
                !part1 || !part2 || isMerging
                  ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 shadow-amber-600/30'
              }`}
            >
              {isMerging ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Sedang Menggabungkan Video...</span>
                </>
              ) : (
                <>
                  <span className="text-sm">⚡</span>
                  <span>Gabungkan Video (Part 1 + Part 2)</span>
                </>
              )}
            </button>
          </div>

          {/* Live Progress Bar */}
          {isMerging && progress && (
            <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-amber-400 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  {progress.message}
                </span>
                <span className="font-mono text-gray-300">{progress.progress}%</span>
              </div>
              <div className="w-full h-2.5 bg-gray-900 rounded-full overflow-hidden p-0.5 border border-gray-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300 shadow-lg shadow-amber-500/50"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Merged Video Result Card */}
      {mergedResult && (
        <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950/30 border border-emerald-800/50 rounded-3xl p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl border border-emerald-500/30">
                🎉
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Video Berhasil Digabungkan!</h3>
                <p className="text-xs text-gray-400">File output siap digunakan dan dipratinjau langsung di bawah ini.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenFolder(mergedResult.outputPath)}
                className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold border border-gray-700 transition-all flex items-center gap-1.5 shadow-md"
              >
                <span>📂</span> Buka di Folder
              </button>
              <button
                onClick={() => handleCopyPath(mergedResult.outputPath)}
                className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold border border-gray-700 transition-all flex items-center gap-1.5 shadow-md"
              >
                <span>{copied ? '✓' : '📋'}</span>
                <span>{copied ? 'Tersalin!' : 'Salin Path'}</span>
              </button>
            </div>
          </div>

          {/* Video Preview & Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Video Player */}
            <div className="lg:col-span-2 bg-black rounded-2xl overflow-hidden border border-gray-800 flex items-center justify-center min-h-[300px]">
              <video
                src={mergedResult.outputUrl}
                controls
                className="w-full max-h-[420px] object-contain"
                autoPlay={false}
              />
            </div>

            {/* Output Meta Details */}
            <div className="bg-gray-950 p-5 rounded-2xl border border-gray-800 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  Informasi File Output
                </span>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="text-gray-500 block text-[10px]">NAMA FILE</span>
                    <span className="font-semibold text-gray-200 break-all">{mergedResult.outputFilename}</span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[10px]">DURASI FINAL</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      ⏱️ {formatDuration(mergedResult.duration)}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[10px]">RESOLUSI</span>
                    <span className="font-mono text-gray-300">
                      📐 {mergedResult.width} × {mergedResult.height}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[10px]">UKURAN FILE</span>
                    <span className="font-mono text-gray-300">
                      💾 {formatFileSize(mergedResult.fileSizeBytes)}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[10px]">METODE PENGGABUNGAN</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-900 border border-gray-800 inline-block text-amber-300">
                      {mergedResult.method === 'copy' ? '⚡ Lossless Stream-Copy' : '🔄 Auto Re-encoded Concat'}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[10px]">LOKASI FILE</span>
                    <span className="font-mono text-[10px] text-gray-400 break-all bg-gray-900 p-2 rounded-lg border border-gray-800 block select-all">
                      {mergedResult.outputPath}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setMergedResult(null);
                  setProgress(null);
                }}
                className="w-full py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition-all border border-gray-700"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShortsMergerStep;

