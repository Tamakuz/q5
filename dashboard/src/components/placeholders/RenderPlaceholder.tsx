// dashboard/src/components/placeholders/RenderPlaceholder.tsx
import React, { useState, useEffect } from 'react';
import type { SourceInfo, AudioInfo, RenderProgress } from '../../electron-api';

const api = window.electronAPI;

// ─── Types ─────────────────────────────────────────────

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
  start: number;
  end: number;
  visual: string;
  shot: string;
  characters: string[];
  action: string;
  emotion: string;
}

// ─── Helpers ────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── Component ──────────────────────────────────────────

const RenderPlaceholder: React.FC = () => {
  const [sourceVideo, setSourceVideo] = useState<SourceInfo | null>(null);
  const [voiceOver, setVoiceOver] = useState<AudioInfo | null>(null);
  const [inputsLoaded, setInputsLoaded] = useState(false);

  const [mappingPrompt, setMappingPrompt] = useState('');
  const [mappingJson, setMappingJson] = useState('');
  const [mapping, setMapping] = useState<MappingTimeline | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mappingSaved, setMappingSaved] = useState(false);

  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [renderResult, setRenderResult] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState({ inputs: false, prompt: false, mapping: false });
  const [transcript, setTranscript] = useState<TranscriptEntry[] | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // ─── Load on mount ────────────────────────────────────

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
        if (raw) { try { setVoiceOver(JSON.parse(raw)); } catch {} }
        else {
          const audioFiles = await api.listAudio();
          if (audioFiles.length > 0) setVoiceOver(audioFiles[0]);
        }
      } catch {}
      try {
        const raw = await api.readFromProject('input/mapping.json');
        if (raw) { setMappingJson(raw); setMappingSaved(true); }
      } catch {}
      try {
        const raw = await api.readFromProject('input/transcript.json');
        if (raw) { try { setTranscript(JSON.parse(raw)); } catch {} }
      } catch {}
      setInputsLoaded(true);
    })();
  }, []);

  useEffect(() => {
    const cleanup = api.onRenderProgress((data) => {
      setRenderProgress(data);
      if (data.stage === 'done') setRendering(false);
    });
    return cleanup;
  }, []);

  // ─── Handlers ──────────────────────────────────────────

  const handleCopyPrompt = async () => {
    await api.copyToClipboard(mappingPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleParseMapping = () => {
    setMappingError(null);
    try {
      let raw = mappingJson.trim();
      if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      const parsed = JSON.parse(raw);
      if (!parsed.settings?.fps || !parsed.settings?.format) { setMappingError('Missing settings'); return; }
      if (!Array.isArray(parsed.timeline) || parsed.timeline.length === 0) { setMappingError('Missing timeline'); return; }
      for (const b of parsed.timeline) {
        if (!b.id && b.id !== 0) { setMappingError('Block missing id'); return; }
        // Detect old format
        if (b.raw_video_start !== undefined || b.audio_duration !== undefined) {
          setMappingError('Old format detected. Use "ss" instead of "raw_video_start" and "t" instead of "audio_duration".');
          return;
        }
        if (typeof b.t !== 'number' || b.t <= 0) { setMappingError(`Block #${b.id}: bad duration (t)`); return; }
        if (typeof b.ss !== 'number' || b.ss < 0) { setMappingError(`Block #${b.id}: bad seek start (ss)`); return; }
      }
      setMapping(parsed);
    } catch (e: any) { setMappingError(`Invalid JSON: ${e.message}`); }
  };

  const handleSaveMapping = async () => {
    if (!mapping) return;
    try {
      const json = JSON.stringify(mapping, null, 2);
      await api.saveToProject('input/mapping.json', json);
      setMappingSaved(true);
    } catch {}
  };

  const handleRender = async () => {
    if (!mapping || !sourceVideo) return;
    // Save mapping first
    const json = JSON.stringify(mapping, null, 2);
    await api.saveToProject('input/mapping.json', json);
    setRendering(true);
    setRenderError(null);
    setRenderResult(null);
    try {
      const result = await api.renderVideo(
        mapping, sourceVideo.filePath || sourceVideo.url,
        voiceOver?.filePath || voiceOver?.url || undefined,
      );
      if ('error' in result) { setRenderError(result.error); setRendering(false); }
      else { setRenderResult(result.outputPath); }
    } catch (e: any) { setRenderError(e.message || 'Render failed'); setRendering(false); }
  };

  const totalDuration = mapping
    ? mapping.timeline.reduce((s, b) => s + b.t, 0)
    : 0;

  // ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-auto py-4 px-4">
      <h2 className="text-lg font-semibold text-white mb-4 text-center shrink-0">Render Pipeline</h2>

      <div className="w-full max-w-3xl mx-auto space-y-4 flex-1">

        {/* A. Inputs */}
        <div className="border border-blue-700/50 rounded-xl overflow-hidden">
          <button onClick={() => setCollapsed(c => ({ ...c, inputs: !c.inputs }))}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800 hover:bg-gray-800/70">
            <span className="text-sm font-medium text-blue-300">📦 Inputs</span>
            <span className="text-xs text-gray-500">{collapsed.inputs ? '▶' : '▼'}</span>
          </button>
          {!collapsed.inputs && inputsLoaded && (
            <div className="p-3 space-y-1">
              <div className="flex gap-2 text-xs"><span>{sourceVideo ? '✅' : '⚠️'}</span><span className="text-blue-300">Video:</span><span className="text-gray-400">{sourceVideo ? formatSize(sourceVideo.size) : 'none'}</span></div>
              <div className="flex gap-2 text-xs"><span>{voiceOver ? '✅' : '⚠️'}</span><span className="text-blue-300">VO:</span><span className="text-gray-400">{voiceOver ? formatSize(voiceOver.size) : 'none (auto)'}</span></div>
              <div className="flex gap-2 text-xs"><span>{transcript ? '✅' : '⚠️'}</span><span className="text-blue-300">Transcript:</span><span className="text-gray-400">{transcript ? `${transcript.length} entries · ${transcript[transcript.length-1].end.toFixed(0)}s` : 'none (skip)'}</span></div>
            </div>
          )}
        </div>

        {/* B. Prompt */}
        <div className="border border-purple-700/50 rounded-xl overflow-hidden">
          <button onClick={() => setCollapsed(c => ({ ...c, prompt: !c.prompt }))}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800 hover:bg-gray-800/70">
            <span className="text-sm font-medium text-purple-300">🤖 AI Mapping Prompt</span>
            <span className="text-xs text-gray-500">{collapsed.prompt ? '▶' : '▼'}</span>
          </button>
          {!collapsed.prompt && (
            <div className="p-3">
              <div className="relative">
                <pre className="w-full max-h-48 overflow-y-auto bg-gray-900 text-gray-300 text-xs font-mono rounded-lg p-3 border border-gray-700 whitespace-pre-wrap">
                  {mappingPrompt || 'Loading...'}
                </pre>
                <button onClick={handleCopyPrompt}
                  className="absolute top-2 right-2 px-3 py-1 rounded text-xs font-medium bg-purple-700 hover:bg-purple-600 text-white">
                  {copiedPrompt ? '✓' : '📋 Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Copy prompt + source video + VO audio → paste ke AI multimodal.</p>
              {transcript && <p className="text-xs text-cyan-400 mt-1">💡 Transcript tersedia ({transcript.length} entries). Sertakan transcript JSON saat kirim prompt ke AI untuk presisi maksimal.</p>}
            </div>
          )}
        </div>

        {/* C. Mapping JSON */}
        <div className="border border-green-700/50 rounded-xl overflow-hidden">
          <button onClick={() => setCollapsed(c => ({ ...c, mapping: !c.mapping }))}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800 hover:bg-gray-800/70">
            <span className="text-sm font-medium text-green-300">📨 Mapping JSON</span>
            <div className="flex items-center gap-2">
              {mapping && <span className="text-xs text-green-400">✓ {mapping.timeline.length} clips</span>}
              {mappingSaved && <span className="text-xs text-green-400">💾</span>}
              <span className="text-xs text-gray-500">{collapsed.mapping ? '▶' : '▼'}</span>
            </div>
          </button>
          {!collapsed.mapping && (
            <div className="p-3 space-y-2">
              <textarea value={mappingJson} onChange={e => setMappingJson(e.target.value)}
                placeholder={`Paste AI mapping JSON...\n\n{\n  "settings": { "fps": 30, "format": "9:16" },\n  "timeline": [\n    { "id": 1, "text": "...", "ss": 32.0, "t": 2.5 }\n  ]\n}`}
                className="w-full h-48 bg-gray-900 text-gray-300 text-xs font-mono rounded-lg p-3 border border-gray-700 focus:border-green-500 focus:outline-none resize-none"
                spellCheck={false} />

              {mappingError && <div className="p-2 rounded bg-red-900/30 border border-red-700/50"><p className="text-xs text-red-400">{mappingError}</p></div>}

              {!mapping && (
                <div className="flex justify-center">
                  <button onClick={handleParseMapping} disabled={!mappingJson.trim()}
                    className={`px-6 py-2 rounded-lg text-sm font-medium ${!mappingJson.trim() ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}>
                    Validate
                  </button>
                </div>
              )}

              {mapping && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-green-400">✅ {mapping.timeline.length} clips · {mapping.settings.format} @{mapping.settings.fps}fps · ~{Math.round(totalDuration)}s</span>
                    <button onClick={() => { setMapping(null); setMappingJson(''); setMappingError(null); setMappingSaved(false); }}
                      className="text-xs text-gray-500 hover:text-gray-300">Clear</button>
                  </div>
                  <div className="flex justify-center gap-2">
                    <button onClick={handleSaveMapping}
                      className={`px-4 py-1.5 rounded text-xs font-medium ${mappingSaved ? 'bg-green-800 text-green-300' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                      {mappingSaved ? '✓ Saved' : '💾 Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* D. Render */}
        {mapping && (
          <div className="flex flex-col items-center gap-4 py-2">
            {!renderResult && !renderError && (
              <button onClick={handleRender} disabled={rendering}
                className={`px-8 py-3 rounded-xl text-sm font-bold transition-colors ${rendering ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg'}`}>
                {rendering ? '⏳ Rendering...' : '🎬 Render Video'}
              </button>
            )}
            {rendering && renderProgress && (
              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs text-gray-400"><span>{renderProgress.message}</span><span>{Math.round(renderProgress.progress * 100)}%</span></div>
                <div className="w-full bg-gray-700 rounded-full h-2"><div className="bg-purple-500 h-full rounded-full transition-all" style={{ width: `${Math.round(renderProgress.progress * 100)}%` }} /></div>
              </div>
            )}
            {renderResult && (
              <div className="p-4 rounded-xl bg-green-900/30 border border-green-700/50 text-center space-y-2 w-full max-w-md">
                <p className="text-sm text-green-400">✅ Done!</p>
                <p className="text-xs text-gray-300 font-mono break-all">{renderResult}</p>
                <button onClick={() => { setRenderResult(null); setRenderProgress(null); }}
                  className="px-4 py-1.5 rounded text-xs font-medium bg-green-700 hover:bg-green-600 text-white">Render Again</button>
              </div>
            )}
            {renderError && (
              <div className="p-4 rounded-xl bg-red-900/30 border border-red-700/50 text-center space-y-2 w-full max-w-md">
                <p className="text-sm text-red-400">❌ Failed</p>
                <p className="text-xs text-red-300 whitespace-pre-wrap">{renderError}</p>
                <button onClick={handleRender} className="px-4 py-1.5 rounded text-xs font-medium bg-red-700 hover:bg-red-600 text-white">Retry</button>
              </div>
            )}
          </div>
        )}
        <div className="h-8" />
      </div>
    </div>
  );
};

export default RenderPlaceholder;
