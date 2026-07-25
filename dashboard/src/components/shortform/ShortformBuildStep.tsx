// dashboard/src/components/shortform/ShortformBuildStep.tsx
import React, { useState, useEffect, useCallback } from 'react';
import type { SourceInfo } from '../../electron-api';

interface SelectionState {
  filePath: string;
  url: string;
  name: string;
  size: number;
  duration: number;
  width: number;
  height: number;
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function formatDurationShort(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatResolution(w: number, h: number): string {
  if (!w || !h) return '—';
  return `${w}×${h}`;
}

const api = window.electronAPI;

interface ShortformBuildStepProps {
  onStepChange?: (step: any) => void;
}

const ShortformBuildStep: React.FC<ShortformBuildStepProps> = ({ onStepChange }) => {
  const [source, setSource] = useState<SourceInfo | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [existingFiles, setExistingFiles] = useState<SourceInfo[]>([]);
  const [showExistingDrawer, setShowExistingDrawer] = useState(false);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Fetch existing source files & auto-select latest if empty
  const loadExisting = useCallback(async () => {
    try {
      const files = await api.listSources();
      setExistingFiles(files);
      if (files.length > 0 && !source) {
        setSource(files[0]);
      }
      return files;
    } catch {
      return [];
    }
  }, [source]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  // Drop handlers
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setError(null);

    const file = e.dataTransfer.files?.[0] as (File & { path?: string });
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('Please select a video file (MP4, MOV, MKV, etc.)');
      return;
    }

    setLoadingMeta(true);
    try {
      const filePath = file.path || (file as any).path;
      const metaResult = await api.getVideoMeta(filePath);
      if (!metaResult) {
        setError('Failed to read video metadata');
        setLoadingMeta(false);
        return;
      }
      setSelection({
        filePath,
        url: metaResult.url,
        name: file.name,
        size: file.size,
        duration: metaResult.duration,
        width: metaResult.width,
        height: metaResult.height,
      });
      setTrimStart(0);
      setTrimEnd(metaResult.duration);
    } catch {
      setError('Failed to read video file');
    }
    setLoadingMeta(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleBrowseFile = async () => {
    if (loadingMeta) return;
    setError(null);
    setLoadingMeta(true);
    try {
      const file = await api.selectFile();
      if (!file) { setLoadingMeta(false); return; }
      const metaResult = await api.getVideoMeta(file.path);
      if (!metaResult) {
        setError('Failed to read video metadata');
        setLoadingMeta(false);
        return;
      }
      setSelection({
        filePath: file.path,
        url: metaResult.url,
        name: file.name,
        size: file.size,
        duration: metaResult.duration,
        width: metaResult.width,
        height: metaResult.height,
      });
      setTrimStart(0);
      setTrimEnd(metaResult.duration);
    } catch {
      setError('Failed to open video file');
    }
    setLoadingMeta(false);
  };

  // Upload & Trim
  const handleUpload = async () => {
    if (!selection) return;
    setUploading(true);
    setError(null);

    try {
      const result = await api.uploadSource(selection.filePath, trimStart, trimEnd);
      setSource(result);
      setSelection(null);
      await loadExisting();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    }
    setUploading(false);
  };

  const handleSelectExisting = (info: SourceInfo) => {
    setSource(info);
    setSelection(null);
    setShowExistingDrawer(false);
  };

  const handleDelete = async (info: SourceInfo) => {
    await api.deleteSource(info.name);
    if (source?.name === info.name) setSource(null);
    loadExisting();
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-6 overflow-hidden">
      {/* Top Header & Readiness Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-800 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg text-lg">🎬</span>
            Shorts Source Video Management
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Import, preview, crop, and manage raw video assets for automated Short video generation.
          </p>
        </div>

        {/* Readiness Badge & Next Step */}
        <div className="flex items-center gap-2">
          <div className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
            source
              ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300 shadow-lg shadow-emerald-950/40'
              : 'bg-gray-900 border-gray-800 text-gray-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${source ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}></span>
            <span>{source ? 'Source Ready' : 'No Source Selected'}</span>
          </div>

          {existingFiles.length > 0 && (
            <button
              onClick={() => setShowExistingDrawer(!showExistingDrawer)}
              className="px-3.5 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
            >
              <span>📁</span> Library ({existingFiles.length})
            </button>
          )}

          {onStepChange && (
            <button
              onClick={() => onStepChange('analyze')}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
            >
              <span>Next: 2. Video Analysis</span>
              <span>➔</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 min-h-0 pt-5 flex flex-col overflow-hidden">
        {/* EXISTING FILES DRAWER MODAL / ROW */}
        {showExistingDrawer && existingFiles.length > 0 && (
          <div className="mb-4 p-4 bg-gray-900/90 border border-gray-800 rounded-2xl shrink-0 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>📁</span> Uploaded Asset Library
              </span>
              <button
                onClick={() => setShowExistingDrawer(false)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Close ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-1">
              {existingFiles.map((f) => (
                <div
                  key={f.name}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                    source?.name === f.name
                      ? 'bg-indigo-950/40 border-indigo-600 text-white'
                      : 'bg-gray-950 border-gray-800 hover:border-gray-700 text-gray-300'
                  }`}
                >
                  <button
                    onClick={() => handleSelectExisting(f)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <span className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg text-sm shrink-0">🎬</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold font-mono truncate">{f.name}</p>
                      <p className="text-[11px] text-gray-500">{formatSize(f.size)}</p>
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(f); }}
                    className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-all"
                    title="Delete Asset"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONDITION 1: SOURCE CONFIRMED & READY */}
        {source && !selection && (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
            {/* Left Column: Player (Col 8) */}
            <div className="lg:col-span-8 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-4">
              <div className="flex-1 bg-black rounded-xl overflow-hidden flex items-center justify-center relative border border-gray-800">
                <video
                  src={source.url}
                  controls
                  className="w-full h-full object-contain max-h-[500px]"
                />
              </div>
            </div>

            {/* Right Column: Asset Specifications & Actions (Col 4) */}
            <div className="lg:col-span-4 flex flex-col space-y-4">
              <div className="bg-gray-900/60 border border-emerald-900/50 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">✓</span>
                  <div>
                    <h3 className="text-sm font-bold text-white">Active Shorts Source Video</h3>
                    <p className="text-xs text-emerald-400 font-medium">Ready for AI Script Analysis</p>
                  </div>
                </div>

                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-2.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">File Name:</span>
                    <span className="text-gray-200 font-mono font-semibold truncate max-w-[180px]">{source.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">File Size:</span>
                    <span className="text-gray-300 font-mono">{formatSize(source.size)}</span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={handleBrowseFile}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                  >
                    <span>🔄</span> Replace / Upload New Source
                  </button>
                  <button
                    onClick={() => setSource(null)}
                    className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded-xl text-xs font-medium transition-all"
                  >
                    Deselect Video
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONDITION 2: PREVIEW & TRIM SELECTION MODE */}
        {selection && (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
            {/* Left Column: Player (Col 7) */}
            <div className="lg:col-span-7 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden p-4 shadow-xl">
              <div className="flex-1 bg-black rounded-xl overflow-hidden flex items-center justify-center border border-gray-800">
                <video
                  src={selection.url}
                  controls
                  className="w-full h-full object-contain max-h-[440px]"
                />
              </div>
            </div>

            {/* Right Column: Trim Controls & Specs (Col 5) */}
            <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4 overflow-y-auto">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>✂️</span> Trim & Import Video
              </h3>

              {/* Specs */}
              <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800 grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block">Duration</span>
                  <span className="text-xs font-bold font-mono text-gray-200">{formatDuration(selection.duration)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block">Resolution</span>
                  <span className="text-xs font-bold font-mono text-gray-200">{formatResolution(selection.width, selection.height)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block">Size</span>
                  <span className="text-xs font-bold font-mono text-gray-200">{formatSize(selection.size)}</span>
                </div>
              </div>

              {/* Trim Controls */}
              <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-400 font-mono">
                    <span>Trim Start:</span>
                    <span className="text-indigo-400 font-bold">{formatDurationShort(trimStart)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={selection.duration}
                    step={0.1}
                    value={trimStart}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (v < trimEnd) setTrimStart(v);
                    }}
                    className="w-full h-2 rounded-full appearance-none bg-gray-800 accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-xs text-gray-400 font-mono">
                    <span>Trim End:</span>
                    <span className="text-indigo-400 font-bold">{formatDurationShort(trimEnd)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={selection.duration}
                    step={0.1}
                    value={trimEnd}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (v > trimStart) setTrimEnd(v);
                    }}
                    className="w-full h-2 rounded-full appearance-none bg-gray-800 accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="pt-2 border-t border-gray-800 flex justify-between text-xs">
                  <span className="text-gray-400">Final Duration:</span>
                  <span className="text-emerald-400 font-bold font-mono">{formatDuration(trimEnd - trimStart)}</span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setSelection(null)}
                  className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className={`flex-[2] py-2.5 rounded-xl text-xs font-semibold shadow-lg transition-all ${
                    uploading
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                  }`}
                >
                  {uploading ? 'Processing Video...' : 'Confirm & Import Source'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONDITION 3: INITIAL DROPZONE WHEN NO SOURCE SELECTED */}
        {!source && !selection && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-full max-w-xl">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleBrowseFile}
                className={`p-12 rounded-3xl border-2 border-dashed transition-all duration-200 text-center cursor-pointer shadow-2xl ${
                  dragOver
                    ? 'border-indigo-400 bg-indigo-600/10 scale-102'
                    : loadingMeta
                    ? 'border-indigo-500 bg-indigo-950/20 cursor-wait animate-pulse'
                    : 'border-gray-800 hover:border-indigo-600/50 bg-gray-900/60 hover:bg-gray-900'
                }`}
              >
                {loadingMeta ? (
                  <div className="space-y-3 py-4">
                    <div className="w-10 h-10 mx-auto border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-indigo-400 font-semibold">Reading video metadata...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-indigo-600/10 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-inner border border-indigo-500/20">
                      🎬
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Drag & Drop Shorts Source Video</h3>
                      <p className="text-xs text-gray-400 mt-1">
                        Select raw cartoon/anime episode video (MP4, MOV, MKV)
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleBrowseFile(); }}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all inline-block"
                    >
                      Browse File
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400 text-center">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShortformBuildStep;
