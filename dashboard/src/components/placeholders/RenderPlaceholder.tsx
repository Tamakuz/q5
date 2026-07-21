// dashboard/src/components/placeholders/RenderPlaceholder.tsx
import React, { useState, useEffect } from 'react';
import type { SourceInfo, AudioInfo, RenderProgress } from '../../electron-api';

const api = window.electronAPI;

interface MappingBlock {
  id: number;
  text?: string;
  ss: number;
  t: number;
}

interface MappingTimeline {
  settings: { fps: number; format: string };
  timeline: MappingBlock[];
}

interface TranscriptEntry {
  start?: number;
  end?: number;
  start_seconds?: number;
  end_seconds?: number;
  timestamp_minute?: string;
  text?: string;
  speaker?: string;
  visual?: string;
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const RenderPlaceholder: React.FC = () => {
  const [sourceVideo, setSourceVideo] = useState<SourceInfo | null>(null);
  const [voiceOver, setVoiceOver] = useState<AudioInfo | null>(null);
  const [mappingPrompt, setMappingPrompt] = useState('');
  const [mappingJson, setMappingJson] = useState('');
  const [mapping, setMapping] = useState<MappingTimeline | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mappingSaved, setMappingSaved] = useState(false);

  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [renderResult, setRenderResult] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const [transcript, setTranscript] = useState<TranscriptEntry[] | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await api.readFromProject('dashboard/prompts/mapping-prompt.md');
        if (raw) setMappingPrompt(raw);
      } catch {}
      try {
        const sources = await api.listSources();
        if (sources.length > 0) setSourceVideo(sources[0]);
      } catch {}
      try {
        const raw = await api.readFromProject('input/voiceover.json');
        if (raw && raw.trim()) { try { setVoiceOver(JSON.parse(raw)); } catch {} }
        else {
          const audioFiles = await api.listAudio();
          if (audioFiles.length > 0) setVoiceOver(audioFiles[0]);
        }
      } catch {}
      try {
        const raw = await api.readFromProject('input/mapping.json');
        if (raw && raw.trim()) {
          setMappingJson(raw);
          try {
            const parsed = JSON.parse(raw);
            setMapping(parsed);
            setMappingSaved(true);
          } catch {}
        }
      } catch {}
      try {
        const raw = await api.readFromProject('input/transcript.json');
        if (raw && raw.trim()) { try { setTranscript(JSON.parse(raw)); } catch {} }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const cleanup = api.onRenderProgress((data) => {
      setRenderProgress(data);
      if (data.stage === 'done') setRendering(false);
    });
    return cleanup;
  }, []);

  const getFormattedPrompt = (): string => {
    if (!mappingPrompt) return 'Loading prompt...';
    const transcriptFormatted = transcript && Array.isArray(transcript) && transcript.length > 0
      ? JSON.stringify(transcript, null, 2)
      : '(No transcript available)';

    if (mappingPrompt.includes('{{transcript_json}}')) {
      return mappingPrompt.replace('{{transcript_json}}', transcriptFormatted);
    }
    return mappingPrompt;
  };

  const handleCopyPrompt = async () => {
    await api.copyToClipboard(getFormattedPrompt());
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleParseMapping = () => {
    setMappingError(null);
    try {
      let raw = mappingJson.trim();
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      const parsed = JSON.parse(raw);
      if (!parsed.timeline || !Array.isArray(parsed.timeline)) {
        setMappingError('JSON must contain a "timeline" array');
        return;
      }
      setMapping(parsed);
      handleSaveMapping(parsed);
    } catch (e: any) {
      setMappingError(`Invalid JSON: ${e.message}`);
    }
  };

  const handleSaveMapping = async (dataToSave = mapping) => {
    if (!dataToSave) return;
    try {
      const jsonString = JSON.stringify(dataToSave, null, 2);
      await api.saveToProject('input/mapping.json', jsonString);
      setMappingSaved(true);
    } catch (e: any) {
      setMappingError(e.message);
    }
  };

  const handleRender = async () => {
    if (!mapping || !sourceVideo) return;
    setRendering(true);
    setRenderError(null);
    setRenderResult(null);
    setRenderProgress({ stage: 'starting', progress: 0, message: 'Starting high-fidelity render engine...' });

    try {
      const videoTarget = sourceVideo.filePath || sourceVideo.name;
      const audioTarget = voiceOver?.filePath || voiceOver?.name;
      const res = await api.renderVideo(mapping, videoTarget, audioTarget);
      if ('error' in res) {
        setRenderError(res.error);
        setRendering(false);
      } else {
        setRenderResult(res.outputPath);
      }
    } catch (e: any) {
      setRenderError(e.message || 'Render failed');
      setRendering(false);
    }
  };

  const handleCopyPath = async (path: string) => {
    await api.copyToClipboard(path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const canRender = !!sourceVideo && !!mapping;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-6 overflow-hidden">
      {/* Top Header & Readiness Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-800 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg text-lg">🎬</span>
            High-Fidelity Render Engine
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Automated FFmpeg video stitching, dynamic captions, background blur, and randomized WakuVibes watermark overlay.
          </p>
        </div>

        {/* Readiness Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
            sourceVideo ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300' : 'bg-gray-900 border-gray-800 text-gray-500'
          }`}>
            <span>{sourceVideo ? '✓' : '○'}</span>
            <span>Source</span>
          </div>

          <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
            voiceOver ? 'bg-purple-950/60 border-purple-700/50 text-purple-300' : 'bg-gray-900 border-gray-800 text-gray-500'
          }`}>
            <span>{voiceOver ? '✓' : '○'}</span>
            <span>Voiceover</span>
          </div>

          <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
            mappingSaved ? 'bg-indigo-950/60 border-indigo-700/50 text-indigo-300' : 'bg-gray-900 border-gray-800 text-gray-500'
          }`}>
            <span>{mappingSaved ? '✓' : '○'}</span>
            <span>Timeline Mapping</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 flex-1 min-h-0 overflow-hidden">
        {/* LEFT PANEL: Render Mapping Setup & Prompt (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="flex items-center justify-between bg-gray-900 px-4 py-3 border-b border-gray-800 shrink-0">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🎯</span> Scene Timeline Mapping
            </span>
            <button
              onClick={handleCopyPrompt}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all shadow flex items-center gap-1"
            >
              <span>{copiedPrompt ? '✓' : '📋'}</span>
              <span>{copiedPrompt ? 'Copied!' : 'Copy Mapping Prompt'}</span>
            </button>
          </div>

          <div className="p-4 flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
            {/* Active Assets Specs summary */}
            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Source Video:</span>
                <span className="text-emerald-400 font-mono font-bold truncate max-w-[180px]">{sourceVideo ? sourceVideo.name : 'Not selected'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Voiceover:</span>
                <span className="text-purple-400 font-mono font-bold truncate max-w-[180px]">{voiceOver ? voiceOver.name : 'Not selected'}</span>
              </div>
            </div>

            {/* Mapping JSON Textarea / View */}
            <div className="flex-1 flex flex-col min-h-0 space-y-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mapping JSON (mapping.json)</span>
              <textarea
                value={mappingJson}
                onChange={(e) => setMappingJson(e.target.value)}
                placeholder={`{\n  "settings": { "fps": 60, "format": "9:16" },\n  "timeline": [\n    { "id": 1, "ss": 12.5, "t": 4.0, "text": "..." }\n  ]\n}`}
                className="flex-1 w-full bg-gray-950 text-gray-200 text-xs font-mono p-3.5 rounded-xl border border-gray-800 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed"
                spellCheck={false}
              />

              {mappingError && (
                <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400">
                  {mappingError}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleParseMapping}
                  disabled={!mappingJson.trim()}
                  className={`px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${
                    !mappingJson.trim()
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                  }`}
                >
                  Validate & Save Timeline
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Production Render Center (Col 7) */}
        <div className="lg:col-span-7 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🚀</span> Production Execution
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                FFmpeg 60fps HD video output with CRF 18 slow preset encoding.
              </p>
            </div>

            <button
              onClick={handleRender}
              disabled={!canRender || rendering}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-xl transition-all flex items-center gap-2 ${
                !canRender || rendering
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30 scale-102'
              }`}
            >
              <span>{rendering ? '⏳' : '⚡'}</span>
              <span>{rendering ? 'Rendering Video...' : 'Start Full Render'}</span>
            </button>
          </div>

          {/* Render Progress Monitor */}
          {rendering && renderProgress && (
            <div className="bg-gray-950 p-5 rounded-2xl border border-indigo-900/50 space-y-3 shadow-inner">
              <div className="flex justify-between items-center text-xs">
                <span className="text-indigo-400 font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
                  Stage: {renderProgress.stage}
                </span>
                <span className="text-gray-300 font-mono font-bold">{renderProgress.progress}%</span>
              </div>

              <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden border border-gray-800">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${renderProgress.progress}%` }}
                />
              </div>

              <p className="text-xs text-gray-400 font-mono truncate bg-gray-900/80 p-2 rounded-lg border border-gray-800">
                {renderProgress.message || 'Encoding video frames...'}
              </p>
            </div>
          )}

          {/* Render Error Alert */}
          {renderError && (
            <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-2xl text-xs text-red-300 space-y-1">
              <span className="font-bold block text-red-400">Render Failed:</span>
              <p className="font-mono">{renderError}</p>
            </div>
          )}

          {/* Render Result Preview */}
          {renderResult ? (
            <div className="flex-1 flex flex-col bg-gray-950 p-4 rounded-2xl border border-emerald-900/50 space-y-3 min-h-0 overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <span>🎉</span> Render Complete! Output Ready
                </span>
                <button
                  onClick={() => handleCopyPath(renderResult)}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition-all"
                >
                  {copiedPath ? '✓ Path Copied' : 'Copy File Path'}
                </button>
              </div>

              <div className="flex-1 bg-black rounded-xl overflow-hidden flex items-center justify-center border border-gray-800 min-h-0">
                <video
                  src={`media://content-auto/${encodeURIComponent(renderResult)}`}
                  controls
                  className="w-full h-full object-contain max-h-[380px]"
                />
              </div>
            </div>
          ) : (
            !rendering && (
              <div className="flex-1 bg-gray-950/50 rounded-2xl border border-dashed border-gray-800 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="w-14 h-14 bg-indigo-600/10 text-indigo-400 rounded-2xl flex items-center justify-center text-2xl border border-indigo-500/20">
                  🎬
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Ready for High-Fidelity Rendering</h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm">
                    Click "Start Full Render" to run the FFmpeg engine with WakuVibes watermark positioning and dynamic subtitles.
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default RenderPlaceholder;
