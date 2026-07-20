// dashboard/src/components/placeholders/BuildPlaceholder.tsx
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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

function formatResolution(w: number, h: number): string {
  if (!w || !h) return '—';
  return `${w}×${h}`;
}

const api = window.electronAPI;
const PREVIEW_HEIGHT = 300;

const BuildPlaceholder: React.FC = () => {
  const [source, setSource] = useState<SourceInfo | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [existingFiles, setExistingFiles] = useState<SourceInfo[]>([]);
  const [showExisting, setShowExisting] = useState(false);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch existing files ──────────────────────────

  const loadExisting = useCallback(async () => {
    try {
      const files = await api.listSources();
      setExistingFiles(files);
    } catch {}
  }, []);

  useEffect(() => { loadExisting(); }, [loadExisting]);

  const [dragOver, setDragOver] = useState(false);

  // ─── Drop handlers (Electron exposes file.path on File objects) ─────

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setError(null);

    const file = e.dataTransfer.files?.[0] as (File & { path?: string });
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('Please select a video file (MP4, MOV, etc.)');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError('File size must be under 500MB');
      return;
    }

    setLoadingMeta(true);
    try {
      // Electron exposes the full path on dropped files
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
      setError('Failed to read file');
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

  // ─── Upload & trim ─────────────────────────────────

  const handleUpload = async () => {
    if (!selection) return;
    setUploading(true);
    setError(null);

    try {
      const result = await api.uploadSource(selection.filePath, trimStart, trimEnd);
      setSource(result);
      setSelection(null);
      loadExisting();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    }
    setUploading(false);
  };

  // ─── Select existing ───────────────────────────────

  const handleSelectExisting = (info: SourceInfo) => {
    setSource(info);
    setShowExisting(false);
  };

  // ─── Cancel & Reset ────────────────────────────────

  const handleCancel = () => {
    setSelection(null);
    setError(null);
  };

  const handleReset = () => {
    setSource(null);
    setSelection(null);
    setError(null);
  };

  const handleDelete = async (info: SourceInfo) => {
    await api.deleteSource(info.name);
    if (source?.name === info.name) setSource(null);
    loadExisting();
  };

  // ════════════════════════════════════════════════════
  // SOURCE CONFIRMED
  // ════════════════════════════════════════════════════

  if (source) {
    return (
      <div className="flex flex-col items-center h-full overflow-auto py-4 px-4">
        <h2 className="text-lg font-semibold text-white mb-4">Source Video Ready</h2>
        <div className="w-full max-w-2xl space-y-4">
          <div className="flex justify-center">
            <div className="overflow-hidden rounded-lg bg-black border border-green-700/50" style={{ height: PREVIEW_HEIGHT }}>
              <video src={source.url} controls style={{ height: PREVIEW_HEIGHT, maxWidth: '100%' }} className="object-contain" />
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-gray-400">
            <span className="text-green-400 font-medium">✅ Source</span>
            <span>·</span>
            <span className="text-gray-300 font-mono max-w-[200px] truncate">{source.name}</span>
            <span>·</span>
            <span>{formatSize(source.size)}</span>
          </div>
          <div className="flex justify-center">
            <button onClick={handleReset} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors">
              Change source
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════
  // PREVIEW & TRIM
  // ════════════════════════════════════════════════════

  if (selection) {
    const scaledW = selection.width > 0 ? Math.round((PREVIEW_HEIGHT / selection.height) * selection.width) : 270;
    const trimmedDuration = trimEnd - trimStart;
    const hasTrim = trimStart > 0 || trimEnd < selection.duration;

    return (
      <div className="flex flex-col items-center h-full overflow-auto py-4 px-4">
        <h2 className="text-lg font-semibold text-white mb-4">Preview & Trim</h2>
        <div className="w-full max-w-2xl space-y-5">
          <div className="flex justify-center">
            <div className="overflow-hidden rounded-lg bg-black border border-gray-700" style={{ height: PREVIEW_HEIGHT }}>
              <video src={selection.url} controls style={{ width: scaledW, height: PREVIEW_HEIGHT, maxWidth: '100%' }} className="object-contain" />
            </div>
          </div>
          <div className="flex justify-center gap-3 text-xs text-gray-400">
            <span className="text-gray-300 truncate max-w-[200px]">{selection.name}</span>
            <span>·</span>
            <span>{formatSize(selection.size)}</span>
            <span>·</span>
            <span>{formatResolution(selection.width, selection.height)}</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-400"><span>Start: {formatDurationShort(trimStart)}</span></div>
            <input type="range" min={0} max={selection.duration} step={0.1} value={trimStart}
              onChange={(e) => { const v = parseFloat(e.target.value); if (v < trimEnd) setTrimStart(v); }}
              className="w-full h-2 rounded-full appearance-none bg-gray-700 accent-indigo-500 cursor-pointer" />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-400"><span>End: {formatDurationShort(trimEnd)}</span></div>
            <input type="range" min={0} max={selection.duration} step={0.1} value={trimEnd}
              onChange={(e) => { const v = parseFloat(e.target.value); if (v > trimStart) setTrimEnd(v); }}
              className="w-full h-2 rounded-full appearance-none bg-gray-700 accent-indigo-500 cursor-pointer" />
          </div>

          <div className="flex justify-center items-center gap-4 text-sm">
            <span className="text-gray-500">Original: <span className="text-gray-300">{formatDuration(selection.duration)}</span></span>
            {hasTrim && <>
              <span className="text-gray-600">→</span>
              <span className="text-gray-500">Trimmed: <span className="text-indigo-400 font-medium">{formatDuration(trimmedDuration)}</span></span>
            </>}
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <div className="flex justify-center gap-3">
            <button onClick={handleCancel} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors">Cancel</button>
            <button onClick={handleUpload} disabled={uploading}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${uploading ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
              {uploading ? 'Trimming & Uploading...' : 'Upload Source'}
            </button>
          </div>
          {uploading && <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden"><div className="bg-indigo-500 h-full rounded-full animate-pulse w-3/4" /></div>}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════
  // INITIAL STATE
  // ════════════════════════════════════════════════════

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center w-full max-w-md space-y-6">
        <h2 className="text-lg font-semibold text-white">Upload Source Video</h2>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={async () => {
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
              setError('Failed to open file');
            }
            setLoadingMeta(false);
          }}
          className={`w-full p-10 rounded-xl border-2 border-dashed transition-colors duration-150
            ${dragOver
              ? 'border-indigo-400 bg-indigo-500/20'
              : loadingMeta
                ? 'border-indigo-500 bg-indigo-500/10 cursor-wait'
                : 'border-gray-600 hover:border-gray-500 bg-gray-800/30 cursor-pointer'
            }`}
        >
          {loadingMeta ? (
            <>
              <div className="w-8 h-8 mx-auto mb-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Reading metadata...</p>
            </>
          ) : dragOver ? (
            <>
              <span className="text-4xl block mb-3">⬇️</span>
              <p className="text-sm text-indigo-400 mb-1">Drop your video here</p>
              <p className="text-xs text-gray-500">Release to start previewing</p>
            </>
          ) : (
            <>
              <span className="text-4xl block mb-3">📁</span>
              <p className="text-sm text-gray-400 mb-1">Drag & drop your video here</p>
              <p className="text-xs text-gray-500">or click to browse — MP4, MOV • Max 500MB</p>
            </>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {existingFiles.length > 0 && !showExisting && (
          <button onClick={() => setShowExisting(true)} className="text-sm text-gray-400 hover:text-indigo-400 underline transition-colors">
            Or choose from uploaded files ({existingFiles.length})
          </button>
        )}

        {showExisting && (
          <div className="text-left space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Uploaded Files</h3>
              <button onClick={() => setShowExisting(false)} className="text-xs text-gray-500 hover:text-gray-300">hide</button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-gray-800">
              {existingFiles.map((f) => (
                <div key={f.name} className="flex items-center justify-between px-3 py-2 hover:bg-gray-800/50 rounded transition-colors">
                  <button onClick={() => handleSelectExisting(f)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                    <span className="text-xs">🎬</span>
                    <span className="text-xs text-gray-300 truncate">{f.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">{formatSize(f.size)}</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(f); }} className="text-xs text-gray-600 hover:text-red-400 px-1 transition-colors" title="Delete">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuildPlaceholder;
