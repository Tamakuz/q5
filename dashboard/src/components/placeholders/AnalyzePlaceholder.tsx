// dashboard/src/components/placeholders/AnalyzePlaceholder.tsx
import React, { useState, useEffect, useCallback } from 'react';
import type { AudioInfo } from '../../electron-api';

const api = window.electronAPI;

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

const AnalyzePlaceholder: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [jsonRaw, setJsonRaw] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [collapsed, setCollapsed] = useState({ prompt: false, scene: false, context: false, json: false, voiceOver: false });
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedScene, setCopiedScene] = useState(false);
  const [copiedContext, setCopiedContext] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedNarration, setCopiedNarration] = useState(false);

  const [voiceOver, setVoiceOver] = useState<AudioInfo | null>(null);
  const [audioList, setAudioList] = useState<AudioInfo[]>([]);
  const [voiceOverUploading, setVoiceOverUploading] = useState(false);
  const [showAudioList, setShowAudioList] = useState(false);

  const SCENE = "A Gen-Z TikToker gossiping and recapping a funny cartoon episode very passionately in a casual studio.";
  const SAMPLE_CONTEXT = "Speaking very fast, using informal Indonesian slang. Laughing at their own jokes, sounding sarcastic, deadpan, and highly expressive.";

  // ─── Voice Over Audio handlers ───────────────────────

  const loadAudioList = useCallback(async () => {
    try {
      const files = await api.listAudio();
      setAudioList(files);
    } catch {}
  }, []);

  // Load saved state on mount
  useEffect(() => {
    (async () => {
      const savedPrompt = await api.readFromProject('input/prompt.md');
      if (savedPrompt) setPrompt(savedPrompt);

      const savedAnalysis = await api.readFromProject('input/analysis.json');
      if (savedAnalysis) {
        try {
          const parsed = JSON.parse(savedAnalysis);
          setResult(parsed);
          setJsonRaw(savedAnalysis);
          setSaved(true);
        } catch {}
      }

      const savedVO = await api.readFromProject('input/voiceover.json');
      if (savedVO) {
        try { setVoiceOver(JSON.parse(savedVO)); } catch {}
      }
    })();
    loadAudioList();
  }, [loadAudioList]);

  const handleCopyPrompt = async () => {
    await api.copyToClipboard(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyJson = async () => {
    const text = result ? JSON.stringify(result, null, 2) : jsonRaw;
    await api.copyToClipboard(text);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // ─── Parse & validate ──────────────────────────────

  const handleParse = () => {
    setError(null);
    try {
      let raw = jsonRaw.trim();
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      const parsed = JSON.parse(raw);

      if (!parsed.script_blocks || !Array.isArray(parsed.script_blocks)) {
        setError('Missing or invalid "script_blocks" array');
        return;
      }
      if (parsed.script_blocks.length === 0) {
        setError('script_blocks must have at least 1 entry');
        return;
      }
      for (const block of parsed.script_blocks) {
        if (!block.id && block.id !== 0) { setError('Each block must have an "id"'); return; }
        if (!block.narration) { setError(`Block #${block.id}: missing "narration"`); return; }
      }

      setResult(parsed);
    } catch (e: any) {
      setError(`Invalid JSON: ${e.message}`);
    }
  };

  // ─── Save to project ───────────────────────────────

  const handleSave = async () => {
    if (!result) return;
    try {
      const jsonString = JSON.stringify(result, null, 2);
      await api.saveToProject('input/analysis.json', jsonString);
      await saveVoiceOver(voiceOver);
      setSaved(true);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleClear = () => {
    setResult(null);
    setSaved(false);
    setJsonRaw('');
    setError(null);
    setVoiceOver(null);
  };

  // ─── Flatten narration ke plain text paragraph ─────

  const buildNarrationParagraph = (): string => {
    if (!result) return '';
    return result.script_blocks
      .map((block) => block.narration.trim())
      .join(' ');
  };

  const handleCopyNarration = async () => {
    const text = buildNarrationParagraph();
    await api.copyToClipboard(text);
    setCopiedNarration(true);
    setTimeout(() => setCopiedNarration(false), 2000);
  };

  // ─── Voice Over Audio ────────────────────────────────

  const handleBrowseAudio = async () => {
    setVoiceOverUploading(true);
    try {
      const file = await api.selectAudio();
      if (!file) { setVoiceOverUploading(false); return; }
      const result = await api.uploadAudio(file.path);
      setVoiceOver(result);
      loadAudioList();
    } catch {}
    setVoiceOverUploading(false);
  };

  const handleSelectAudio = (info: AudioInfo) => {
    setVoiceOver(info);
    setShowAudioList(false);
  };

  const handleRemoveAudio = () => {
    setVoiceOver(null);
  };

  // ─── Save voice-over reference ───────────────────────

  const saveVoiceOver = async (vo: AudioInfo | null) => {
    if (vo) {
      await api.saveToProject('input/voiceover.json', JSON.stringify(vo, null, 2));
    }
  };

  // ════════════════════════════════════════════════════
  // ANALYSIS SAVED — show script blocks
  // ════════════════════════════════════════════════════

  if (result && saved) {
    return (
      <div className="flex flex-col items-center h-full overflow-auto py-4 px-4">
        <h2 className="text-lg font-semibold text-white mb-4">Analysis Complete</h2>

        <div className="w-full max-w-2xl space-y-4">
          {/* Summary */}
          <div className="p-4 rounded-xl bg-gray-800/50 border border-green-700/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-green-400">📋 Episode Summary</span>
              <span className="text-xs text-gray-500">
                {result.script_blocks.length} blocks · ~{result.total_estimated_words} words
              </span>
            </div>
            <p className="text-sm text-gray-300">{result.episode_summary}</p>
          </div>

          {/* Script blocks */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {result.script_blocks.map((block) => (
              <div key={block.id} className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/50 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-indigo-400 font-mono font-bold">
                    #{block.id} · {block.estimated_timestamp}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-1 italic">{block.visual_context}</p>
                <p className="text-xs text-gray-300 leading-relaxed">{block.narration}</p>
              </div>
            ))}
          </div>

          {/* Voice Over Audio */}
          {voiceOver && (
            <div className="p-4 rounded-xl bg-gray-800/50 border border-purple-700/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-purple-400">🎙️ Voice Over Audio</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 font-mono truncate">{voiceOver.name}</p>
                  <p className="text-xs text-gray-500">{voiceOver.size ? `${(voiceOver.size / 1024).toFixed(0)}KB` : ''}</p>
                </div>
                <audio src={voiceOver.url} controls className="h-8" />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center gap-3 flex-wrap">
            <button onClick={handleCopyNarration} className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
              {copiedNarration ? '✓ Copied!' : '📝 Copy Narration'}
            </button>
            <button onClick={handleCopyJson} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors">
              {copiedJson ? 'Copied!' : 'Copy JSON'}
            </button>
            <button onClick={handleClear} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors">
              New analysis
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════
  // EDIT / INPUT MODE
  // ════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full overflow-auto py-4 px-4">
      <h2 className="text-lg font-semibold text-white mb-4 text-center shrink-0">Analyze Video</h2>

      <div className="w-full max-w-3xl mx-auto space-y-4 flex-1">
        {/* Prompt section — read-only */}
        <div className="border border-gray-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setCollapsed((c) => ({ ...c, prompt: !c.prompt }))}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800 hover:bg-gray-800/70 transition-colors"
          >
            <span className="text-sm font-medium text-gray-300">📋 Prompt AI</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{collapsed.prompt ? '▶ Expand' : '▼ Collapse'}</span>
            </div>
          </button>
          {!collapsed.prompt && (
            <div className="p-3">
              <div className="relative">
                <pre className="w-full max-h-64 overflow-y-auto bg-gray-900 text-gray-300 text-xs font-mono rounded-lg p-3 border border-gray-700 whitespace-pre-wrap">
                  {prompt || 'Loading prompt from input/prompt.md...'}
                </pre>
                <button
                  onClick={handleCopyPrompt}
                  className="absolute top-2 right-2 px-3 py-1 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                >
                  {copiedPrompt ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scene — collapsible */}
        <div className="border border-gray-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setCollapsed((c) => ({ ...c, scene: !c.scene }))}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800 hover:bg-gray-800/70 transition-colors"
          >
            <span className="text-sm font-medium text-yellow-300">🎬 Scene (Wajib Diisi)</span>
            <span className="text-xs text-gray-500">{collapsed.scene ? '▶ Expand' : '▼ Collapse'}</span>
          </button>
          {!collapsed.scene && (
            <div className="p-3">
              <div className="relative">
                <pre className="w-full bg-gray-900 text-gray-300 text-xs font-mono rounded-lg p-3 border border-gray-700 whitespace-pre-wrap">
                  {SCENE}
                </pre>
                <button
                  onClick={async () => { await api.copyToClipboard(SCENE); setCopiedScene(true); setTimeout(() => setCopiedScene(false), 2000); }}
                  className="absolute top-2 right-2 px-3 py-1 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                >
                  {copiedScene ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Copy-paste teks ini ke kolom <strong>Scene</strong> di AI (ChatGPT/Claude). Ini "nyawa" agar AI tahu dia lagi ada di situasi apa.
              </p>
            </div>
          )}
        </div>

        {/* Sample Context — collapsible */}
        <div className="border border-gray-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setCollapsed((c) => ({ ...c, context: !c.context }))}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800 hover:bg-gray-800/70 transition-colors"
          >
            <span className="text-sm font-medium text-emerald-300">🎙️ Sample Context (Wajib Diisi)</span>
            <span className="text-xs text-gray-500">{collapsed.context ? '▶ Expand' : '▼ Collapse'}</span>
          </button>
          {!collapsed.context && (
            <div className="p-3">
              <div className="relative">
                <pre className="w-full bg-gray-900 text-gray-300 text-xs font-mono rounded-lg p-3 border border-gray-700 whitespace-pre-wrap">
                  {SAMPLE_CONTEXT}
                </pre>
                <button
                  onClick={async () => { await api.copyToClipboard(SAMPLE_CONTEXT); setCopiedContext(true); setTimeout(() => setCopiedContext(false), 2000); }}
                  className="absolute top-2 right-2 px-3 py-1 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                >
                  {copiedContext ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Copy-paste teks ini ke kolom <strong>Sample Context</strong> di AI. Ini yang bikin tag pacing dan ekspresi bekerja maksimal.
              </p>
            </div>
          )}
        </div>

        {/* JSON Input */}
        <div className="border border-gray-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setCollapsed((c) => ({ ...c, json: !c.json }))}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800 hover:bg-gray-800/70 transition-colors"
          >
            <span className="text-sm font-medium text-gray-300">📨 Hasil Analisa AI (JSON)</span>
            <span className="text-xs text-gray-500">{collapsed.json ? '▶ Expand' : '▼ Collapse'}</span>
          </button>
          {!collapsed.json && (
            <div className="p-3">
              <textarea
                value={jsonRaw}
                onChange={(e) => setJsonRaw(e.target.value)}
                placeholder={`Paste the JSON output from AI here...\n\n{\n  "episode_summary": "...",\n  "script_blocks": [...]\n}`}
                className="w-full h-64 bg-gray-900 text-gray-300 text-xs font-mono rounded-lg p-3 border border-gray-700 focus:border-indigo-500 focus:outline-none resize-none"
                spellCheck={false}
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Supports raw JSON or markdown-wrapped JSON. Auto-stripped on validate.
              </p>
            </div>
          )}
        </div>

        {/* Voice Over Audio */}
        <div className="border border-gray-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setCollapsed((c) => ({ ...c, voiceOver: !c.voiceOver }))}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800 hover:bg-gray-800/70 transition-colors"
          >
            <span className="text-sm font-medium text-purple-300">🎙️ Voice Over Audio</span>
            <div className="flex items-center gap-2">
              {voiceOver && <span className="text-xs text-green-400">✓ Uploaded</span>}
              <span className="text-xs text-gray-500">{collapsed.voiceOver ? '▶ Expand' : '▼ Collapse'}</span>
            </div>
          </button>
          {!collapsed.voiceOver && (
            <div className="p-3 space-y-3">
              {/* No voice-over selected */}
              {!voiceOver && (
                <div className="flex flex-col items-center gap-3 py-3">
                  <p className="text-xs text-gray-500 text-center">
                    Upload your recorded voice-over narration (MP3, WAV). This audio will be synced with scenes in the Render step.
                  </p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    <button
                      onClick={handleBrowseAudio}
                      disabled={voiceOverUploading}
                      className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                        voiceOverUploading
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-500 text-white'
                      }`}
                    >
                      {voiceOverUploading ? 'Uploading...' : '🎵 Browse Audio'}
                    </button>
                    {audioList.length > 0 && !showAudioList && (
                      <button
                        onClick={() => setShowAudioList(true)}
                        className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-purple-400 hover:bg-gray-800 transition-colors"
                      >
                        Or choose uploaded ({audioList.length})
                      </button>
                    )}
                  </div>

                  {audioList.length > 0 && showAudioList && (
                    <div className="w-full text-left space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-medium text-gray-300">Uploaded Audio Files</h4>
                        <button onClick={() => setShowAudioList(false)} className="text-xs text-gray-500 hover:text-gray-300">hide</button>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-0.5 rounded-lg border border-gray-800">
                        {audioList.map((f) => (
                          <div key={f.name} className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-800/50 rounded transition-colors">
                            <button
                              onClick={() => handleSelectAudio(f)}
                              className="flex items-center gap-2 text-left flex-1 min-w-0"
                            >
                              <span className="text-xs">🎵</span>
                              <span className="text-xs text-gray-300 truncate">{f.name}</span>
                              <span className="text-xs text-gray-500 shrink-0">{f.size ? `${(f.size / 1024).toFixed(0)}KB` : ''}</span>
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await api.deleteSource(f.name);
                                loadAudioList();
                              }}
                              className="text-xs text-gray-600 hover:text-red-400 px-1 transition-colors" title="Delete"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Voice-over selected */}
              {voiceOver && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-900/60 border border-gray-700/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 font-mono truncate">{voiceOver.name}</p>
                      <p className="text-xs text-gray-500">
                        {voiceOver.size ? `${(voiceOver.size / 1024).toFixed(0)}KB` : ''}
                        {voiceOver.createdAt ? ` · ${new Date(voiceOver.createdAt).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <audio src={voiceOver.url} controls className="h-8" />
                  </div>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={handleRemoveAudio}
                      className="px-4 py-1.5 rounded-lg text-xs text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors"
                    >
                      Remove
                    </button>
                    <button
                      onClick={handleBrowseAudio}
                      disabled={voiceOverUploading}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                    >
                      {voiceOverUploading ? 'Uploading...' : 'Change'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Result preview (before save) */}
        {result && !saved && (
          <div className="p-4 rounded-xl bg-gray-800/50 border border-indigo-700/50 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-indigo-400">✅ Valid JSON</span>
              <span className="text-xs text-gray-500">
                {result.script_blocks.length} blocks · ~{result.total_estimated_words} words
              </span>
            </div>
            <p className="text-sm text-gray-300">{result.episode_summary}</p>

            {/* Narration paragraph preview */}
            <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-700/50 max-h-32 overflow-y-auto">
              <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{buildNarrationParagraph()}</p>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={handleCopyNarration} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors">
                {copiedNarration ? '✓ Copied!' : '📝 Copy Narration'}
              </button>
              <button onClick={handleClear} className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-colors">
                Clear
              </button>
              <button onClick={handleSave} className="px-4 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                Save Analysis
              </button>
            </div>
          </div>
        )}

        {/* Validate button */}
        {!result && (
          <div className="flex justify-center">
            <button
              onClick={handleParse}
              disabled={!jsonRaw.trim()}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                !jsonRaw.trim()
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              Validate & Parse
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyzePlaceholder;
