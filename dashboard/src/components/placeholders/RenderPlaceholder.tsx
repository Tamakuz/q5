// dashboard/src/components/placeholders/RenderPlaceholder.tsx
import React, { useState, useEffect, useCallback } from 'react';
import type { SourceInfo, AudioInfo, RenderProgress } from '../../electron-api';

const api = window.electronAPI;

// ─── Types ─────────────────────────────────────────────

interface ScriptBlock {
  id: number;
  estimated_timestamp: string;
  visual_context: string;
  narration: string;
}

interface AnalysisResult {
  episode_summary: string;
  total_estimated_words: number;
  script_blocks: ScriptBlock[];
}

interface MappingBlock {
  id: number;
  text: string;
  audio_start_in_final: number;
  audio_duration: number;
  raw_video_start: number;
}

interface MappingTimeline {
  settings: { fps: number; format: string };
  timeline: MappingBlock[];
}

// ─── Helpers ────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── Component ──────────────────────────────────────────

const RenderPlaceholder: React.FC = () => {
  // Inputs from previous steps
  const [sourceVideo, setSourceVideo] = useState<SourceInfo | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [voiceOver, setVoiceOver] = useState<AudioInfo | null>(null);
  const [inputsLoaded, setInputsLoaded] = useState(false);

  // Mapping prompt (loaded from file)
  const [mappingPrompt, setMappingPrompt] = useState('');

  // Mapping
  const [mappingJson, setMappingJson] = useState('');
  const [mapping, setMapping] = useState<MappingTimeline | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);

  // Generated config
  const [videoConfig, setVideoConfig] = useState<string>('');
  const [configSaved, setConfigSaved] = useState(false);

  // Render
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [renderResult, setRenderResult] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // UI state
  const [collapsed, setCollapsed] = useState({
    inputs: false,
    prompt: false,
    mapping: false,
    config: false,
  });
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);

  // ─── Load inputs on mount ────────────────────────────

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
        const raw = await api.readFromProject('input/analysis.json');
        if (raw) {
          const parsed = JSON.parse(raw);
          setAnalysis(parsed);
        }
      } catch {}

      try {
        const raw = await api.readFromProject('input/voiceover.json');
        if (raw) {
          const parsed = JSON.parse(raw);
          setVoiceOver(parsed);
        }
      } catch {}

      try {
        const raw = await api.readFromProject('input/render-config.json');
        if (raw) {
          setVideoConfig(raw);
          setConfigSaved(true);
        }
      } catch {}

      setInputsLoaded(true);
    })();
  }, []);

  // ─── Listen for render progress ──────────────────────

  useEffect(() => {
    const cleanup = api.onRenderProgress((data) => {
      setRenderProgress(data);
      if (data.stage === 'done') {
        setRendering(false);
      }
    });
    return cleanup;
  }, []);

  // ─── Copy handlers ────────────────────────────────────

  const handleCopyPrompt = async () => {
    await api.copyToClipboard(mappingPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyConfig = async () => {
    await api.copyToClipboard(videoConfig);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  // ─── Validate mapping JSON ────────────────────────────

  const handleParseMapping = () => {
    setMappingError(null);
    try {
      let raw = mappingJson.trim();
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      const parsed = JSON.parse(raw);

      if (!parsed.settings?.fps || !parsed.settings?.format) {
        setMappingError('Missing "settings" with "fps" and "format"');
        return;
      }
      if (!parsed.timeline || !Array.isArray(parsed.timeline) || parsed.timeline.length === 0) {
        setMappingError('Missing or empty "timeline" array');
        return;
      }
      for (const b of parsed.timeline) {
        if (!b.id && b.id !== 0) { setMappingError('Each block must have an "id"'); return; }
        if (!b.text) { setMappingError(`Block #${b.id}: missing "text"`); return; }
        if (typeof b.audio_start_in_final !== 'number') { setMappingError(`Block #${b.id}: missing "audio_start_in_final"`); return; }
        if (!b.audio_duration || b.audio_duration <= 0) { setMappingError(`Block #${b.id}: missing "audio_duration"`); return; }
        if (typeof b.raw_video_start !== 'number') { setMappingError(`Block #${b.id}: missing "raw_video_start"`); return; }
      }

      setMapping(parsed);
    } catch (e: any) {
      setMappingError(`Invalid JSON: ${e.message}`);
    }
  };

  // ─── Generate VideoConfig from mapping ────────────────

  const generateConfig = useCallback(() => {
    if (!mapping || !sourceVideo) return;

    const totalDuration = mapping.timeline.reduce(
      (sum, b) => sum + b.audio_duration,
      0,
    );

    const scenes = mapping.timeline.map((block) => ({
      type: 'video_clip',
      duration: block.audio_duration,
      transition: 'fade',
      data: {
        src: sourceVideo.url,
        startFrom: block.raw_video_start,
        caption: block.text,
      },
    }));

    const config = {
      version: '1' as const,
      metadata: {
        title: analysis?.episode_summary || 'Content Auto Render',
        duration: Math.ceil(totalDuration),
        resolution: {
          width: mapping.settings.format === '16:9' ? 1920 : 1080,
          height: mapping.settings.format === '16:9' ? 1080 : 1920,
        },
        fps: mapping.settings.fps,
      },
      audio: voiceOver
        ? { bgm: voiceOver.url, volume: 1.0 }
        : undefined,
      scenes,
    };

    setVideoConfig(JSON.stringify(config, null, 2));
    setConfigSaved(false);
  }, [mapping, sourceVideo, voiceOver, analysis]);

  useEffect(() => {
    if (mapping) generateConfig();
  }, [mapping, generateConfig]);

  // ─── Save config ──────────────────────────────────────

  const handleSaveConfig = async () => {
    try {
      await api.saveToProject('input/render-config.json', videoConfig);
      setConfigSaved(true);
    } catch {}
  };

  // ─── Render ────────────────────────────────────────────

  const handleRender = async () => {
    if (!videoConfig) return;
    // Save first
    try {
      await api.saveToProject('input/render-config.json', videoConfig);
      setConfigSaved(true);
    } catch {}
    setRendering(true);
    setRenderError(null);
    setRenderResult(null);
    try {
      const result = await api.renderVideo();
      if ('error' in result) {
        setRenderError(result.error);
        setRendering(false);
      } else {
        setRenderResult(result.outputPath);
      }
    } catch (e: any) {
      setRenderError(e.message || 'Render failed');
      setRendering(false);
    }
  };

  // ───────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-auto py-4 px-4">
      <h2 className="text-lg font-semibold text-white mb-4 text-center shrink-0">Render Pipeline</h2>

      <div className="w-full max-w-3xl mx-auto space-y-4 flex-1">
        {/* A. Inputs Summary */}
        <div className="border border-blue-700/50 rounded-xl overflow-hidden">
          <button
            onClick={() => setCollapsed((c) => ({ ...c, inputs: !c.inputs }))}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800 hover:bg-gray-800/70 transition-colors"
          >
            <span className="text-sm font-medium text-blue-300">📦 Inputs Summary</span>
            <span className="text-xs text-gray-500">{collapsed.inputs ? '▶ Expand' : '▼ Collapse'}</span>
          </button>
          {!collapsed.inputs && (
            <div className="p-3 space-y-2">
              {!inputsLoaded && <p className="text-xs text-gray-500">Loading inputs...</p>}
              {inputsLoaded && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{sourceVideo ? '✅' : '⚠️'}</span>
                    <span className="text-xs text-blue-300 font-medium">Source Video:</span>
                    {sourceVideo ? (
                      <span className="text-xs text-gray-400">1 file · {formatSize(sourceVideo.size)}</span>
                    ) : (
                      <span className="text-xs text-yellow-500">Not found — upload in Source step</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{analysis ? '✅' : '⚠️'}</span>
                    <span className="text-xs text-blue-300 font-medium">Analysis:</span>
                    {analysis ? (
                      <span className="text-xs text-gray-400">{analysis.script_blocks.length} blocks · ~{analysis.total_estimated_words} words</span>
                    ) : (
                      <span className="text-xs text-yellow-500">Not found — complete Analyze step first</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{voiceOver ? '✅' : '⚠️'}</span>
                    <span className="text-xs text-blue-300 font-medium">Voice Over:</span>
                    {voiceOver ? (
                      <span className="text-xs text-gray-400">1 file · {formatSize(voiceOver.size)}</span>
                    ) : (
                      <span className="text-xs text-yellow-500">Not found — upload in Analyze step</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* B. AI Auto-Mapper Prompt */}
        <div className="border border-purple-700/50 rounded-xl overflow-hidden">
          <button
            onClick={() => setCollapsed((c) => ({ ...c, prompt: !c.prompt }))}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800 hover:bg-gray-800/70 transition-colors"
          >
            <span className="text-sm font-medium text-purple-300">🤖 AI Auto-Mapper Prompt</span>
            <span className="text-xs text-gray-500">{collapsed.prompt ? '▶ Expand' : '▼ Collapse'}</span>
          </button>
          {!collapsed.prompt && (
            <div className="p-3">
              <div className="relative">
                <pre className="w-full max-h-64 overflow-y-auto bg-gray-900 text-gray-300 text-xs font-mono rounded-lg p-3 border border-gray-700 whitespace-pre-wrap">
                  {mappingPrompt || 'Loading prompt from dashboard/prompts/mapping-prompt.md...'}
                </pre>
                <button
                  onClick={handleCopyPrompt}
                  className="absolute top-2 right-2 px-3 py-1 rounded text-xs font-medium bg-purple-700 hover:bg-purple-600 text-white transition-colors"
                >
                  {copiedPrompt ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Copy prompt ini + source video + voice-over audio ke AI multimodal (Gemini 1.5 Pro / ChatGPT).
                AI akan mengembalikan JSON mapping timeline.
              </p>
            </div>
          )}
        </div>

        {/* C. Mapping JSON Input */}
        <div className="border border-green-700/50 rounded-xl overflow-hidden">
          <button
            onClick={() => setCollapsed((c) => ({ ...c, mapping: !c.mapping }))}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800 hover:bg-gray-800/70 transition-colors"
          >
            <span className="text-sm font-medium text-green-300">📨 AI Mapping Result (JSON)</span>
            <div className="flex items-center gap-2">
              {mapping && <span className="text-xs text-green-400">✓ {mapping.timeline.length} blocks</span>}
              <span className="text-xs text-gray-500">{collapsed.mapping ? '▶ Expand' : '▼ Collapse'}</span>
            </div>
          </button>
          {!collapsed.mapping && (
            <div className="p-3 space-y-2">
              <textarea
                value={mappingJson}
                onChange={(e) => setMappingJson(e.target.value)}
                placeholder={`Paste the mapping JSON from AI here...\n\n{\n  "settings": { "fps": 30, "format": "9:16" },\n  "timeline": [\n    {\n      "id": 1,\n      "text": "Lu pernah nggak sih ngebayangin Suneo,",\n      "audio_start_in_final": 0.0,\n      "audio_duration": 2.5,\n      "raw_video_start": 32.0\n    },\n    {\n      "id": 2,\n      "text": "yang gayanya selangit,",\n      "audio_start_in_final": 2.5,\n      "audio_duration": 2.0,\n      "raw_video_start": 45.5\n    }\n  ]\n}`}
                className="w-full h-48 bg-gray-900 text-gray-300 text-xs font-mono rounded-lg p-3 border border-gray-700 focus:border-green-500 focus:outline-none resize-none"
                spellCheck={false}
              />

              {mappingError && (
                <div className="p-2 rounded-lg bg-red-900/30 border border-red-700/50">
                  <p className="text-xs text-red-400">{mappingError}</p>
                </div>
              )}

              {!mapping && (
                <div className="flex justify-center">
                  <button
                    onClick={handleParseMapping}
                    disabled={!mappingJson.trim()}
                    className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                      !mappingJson.trim()
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    Validate & Parse
                  </button>
                </div>
              )}

              {mapping && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-green-400">
                      ✅ {mapping.timeline.length} blocks · {mapping.settings.format} @ {mapping.settings.fps}fps
                    </span>
                    <button
                      onClick={() => { setMapping(null); setMappingJson(''); setMappingError(null); setVideoConfig(''); }}
                      className="text-xs text-gray-500 hover:text-gray-300"
                    >
                      Clear
                    </button>
                  </div>
                  {mapping.timeline.map((b) => (
                    <div key={b.id} className="text-xs text-gray-400 pl-2 border-l border-green-800/50">
                      <span className="text-gray-300 font-mono">#{b.id}</span>{' '}
                      audio @ {b.audio_start_in_final.toFixed(1)}s ({b.audio_duration.toFixed(1)}s){' '}
                      → video @ {b.raw_video_start.toFixed(1)}s{' '}
                      <span className="text-gray-500 truncate">— "{b.text.slice(0, 50)}..."</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* D. Generated VideoConfig */}
        {videoConfig && (
          <div className="border border-indigo-700/50 rounded-xl overflow-hidden">
            <button
              onClick={() => setCollapsed((c) => ({ ...c, config: !c.config }))}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800 hover:bg-gray-800/70 transition-colors"
            >
              <span className="text-sm font-medium text-indigo-300">📄 Generated Remotion Config</span>
              <div className="flex items-center gap-2">
                {configSaved && <span className="text-xs text-green-400">💾 Saved</span>}
                <span className="text-xs text-gray-500">{collapsed.config ? '▶ Expand' : '▼ Collapse'}</span>
              </div>
            </button>
            {!collapsed.config && (
              <div className="p-3 space-y-3">
                <div className="relative">
                  <pre className="w-full max-h-96 overflow-y-auto bg-gray-900 text-gray-300 text-xs font-mono rounded-lg p-3 border border-gray-700 whitespace-pre-wrap">
                    {videoConfig}
                  </pre>
                  <button
                    onClick={handleCopyConfig}
                    className="absolute top-2 right-2 px-3 py-1 rounded text-xs font-medium bg-indigo-700 hover:bg-indigo-600 text-white transition-colors"
                  >
                    {copiedConfig ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
                <div className="flex justify-center gap-2 flex-wrap">
                  <button
                    onClick={handleSaveConfig}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                      configSaved
                        ? 'bg-green-800 text-green-300 cursor-default'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {configSaved ? '✓ Saved' : '💾 Save Config'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* E. Render */}
        {videoConfig && (
          <div className="flex flex-col items-center gap-4 py-2">
            {!renderResult && !renderError && (
              <button
                onClick={handleRender}
                disabled={rendering}
                className={`px-8 py-3 rounded-xl text-sm font-bold transition-colors ${
                  rendering
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/30'
                }`}
              >
                {rendering ? '⏳ Rendering...' : '🎬 Render Video'}
              </button>
            )}

            {rendering && renderProgress && (
              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{renderProgress.message}</span>
                  <span>{Math.round(renderProgress.progress * 100)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(renderProgress.progress * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {renderResult && (
              <div className="p-4 rounded-xl bg-green-900/30 border border-green-700/50 text-center space-y-2 w-full max-w-md">
                <p className="text-sm text-green-400 font-medium">✅ Render Complete!</p>
                <p className="text-xs text-gray-300 font-mono break-all">{renderResult}</p>
                <button
                  onClick={() => {
                    // Reset for new render
                    setRenderResult(null);
                    setRenderProgress(null);
                  }}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-green-700 hover:bg-green-600 text-white transition-colors"
                >
                  Render Again
                </button>
              </div>
            )}

            {renderError && (
              <div className="p-4 rounded-xl bg-red-900/30 border border-red-700/50 text-center space-y-2 w-full max-w-md">
                <p className="text-sm text-red-400 font-medium">❌ Render Failed</p>
                <p className="text-xs text-red-300">{renderError}</p>
                <button
                  onClick={handleRender}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-red-700 hover:bg-red-600 text-white transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bottom spacing */}
        <div className="h-8" />
      </div>
    </div>
  );
};

export default RenderPlaceholder;
