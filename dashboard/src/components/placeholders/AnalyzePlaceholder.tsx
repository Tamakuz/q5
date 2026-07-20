// dashboard/src/components/placeholders/AnalyzePlaceholder.tsx
import React, { useState, useEffect } from 'react';

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
  const [collapsed, setCollapsed] = useState({ prompt: false, json: false });
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

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
    })();
  }, []);

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

          {/* Actions */}
          <div className="flex justify-center gap-3">
            <button onClick={handleClear} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors">
              New analysis
            </button>
            <button onClick={handleCopyJson} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors">
              {copiedJson ? 'Copied!' : 'Copy JSON'}
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
              <p className="text-xs text-gray-500 mt-1.5">
                Prompt tersimpan di <code className="text-indigo-400">input/prompt.md</code>. Copy + paste ke AI (ChatGPT/Claude) bareng video-nya.
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

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Result preview (before save) */}
        {result && !saved && (
          <div className="p-4 rounded-xl bg-gray-800/50 border border-indigo-700/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-indigo-400">✅ Valid JSON</span>
              <span className="text-xs text-gray-500">
                {result.script_blocks.length} blocks · ~{result.total_estimated_words} words
              </span>
            </div>
            <p className="text-sm text-gray-300 mb-3">{result.episode_summary}</p>
            <div className="flex justify-end gap-2">
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
