// dashboard/src/components/placeholders/TranscriptPlaceholder.tsx
import React, { useState, useEffect } from 'react';

const api = window.electronAPI;

export interface NormalizedTranscriptEntry {
  id: number;
  start_seconds: number;
  end_seconds: number;
  timestamp_minute: string;
  text: string;
  speaker: string;
}

function formatMinute(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function normalizeEntry(entry: any, index: number): NormalizedTranscriptEntry {
  const startSec = typeof entry.start_seconds === 'number'
    ? entry.start_seconds
    : (typeof entry.start === 'number' ? entry.start : 0);
  const endSec = typeof entry.end_seconds === 'number'
    ? entry.end_seconds
    : (typeof entry.end === 'number' ? entry.end : 0);

  const tsMin = entry.timestamp_minute || entry.timestamp || `${formatMinute(startSec)} - ${formatMinute(endSec)}`;

  return {
    id: entry.id || index + 1,
    start_seconds: startSec,
    end_seconds: endSec,
    timestamp_minute: tsMin,
    text: entry.text || entry.narration || entry.speech || entry.visual || '',
    speaker: entry.speaker || '',
  };
}

const TranscriptPlaceholder: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [jsonRaw, setJsonRaw] = useState<string>('');
  const [entries, setEntries] = useState<NormalizedTranscriptEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const savedPrompt = await api.readFromProject('dashboard/prompts/transcript-prompt.md');
      if (savedPrompt) setPrompt(savedPrompt);

      const savedTranscript = await api.readFromProject('input/transcript.json');
      if (savedTranscript) {
        try {
          const parsed = JSON.parse(savedTranscript);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const normalized = parsed.map((e, idx) => normalizeEntry(e, idx));
            setEntries(normalized);
            setJsonRaw(JSON.stringify(normalized, null, 2));
            setSaved(true);
          }
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
    if (!entries) return;
    await api.copyToClipboard(JSON.stringify(entries, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleParse = () => {
    setError(null);
    try {
      let raw = jsonRaw.trim();
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setError('Data transkrip harus berupa JSON array non-kosong');
        return;
      }

      const normalized = parsed.map((e, idx) => normalizeEntry(e, idx));
      setEntries(normalized);
      setIsEditing(false);
      handleSave(normalized);
    } catch (e: any) {
      setError(`Format JSON tidak valid: ${e.message}`);
    }
  };

  const handleSave = async (dataToSave = entries) => {
    if (!dataToSave) return;
    try {
      const jsonString = JSON.stringify(dataToSave, null, 2);
      await api.saveToProject('input/transcript.json', jsonString);
      setSaved(true);
    } catch (e: any) {
      setError(`Gagal menyimpan: ${e.message}`);
    }
  };

  const filteredEntries = entries ? entries.filter(e => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      e.text.toLowerCase().includes(term) ||
      e.speaker.toLowerCase().includes(term) ||
      e.timestamp_minute.toLowerCase().includes(term)
    );
  }) : [];

  const totalDuration = entries && entries.length > 0 ? entries[entries.length - 1].end_seconds : 0;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-6 overflow-hidden">
      {/* Top Header & Readiness Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-800 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="p-2 bg-cyan-600/20 text-cyan-400 rounded-lg text-lg">📜</span>
            Audio Transcript Management
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Generate audio speech transcription prompts, manage timestamps, and edit JSON subtitles.
          </p>
        </div>

        {/* Readiness Badge */}
        <div className="flex items-center gap-2">
          <div className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
            saved
              ? 'bg-cyan-950/60 border-cyan-700/50 text-cyan-300 shadow-lg shadow-cyan-950/40'
              : 'bg-gray-900 border-gray-800 text-gray-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${saved ? 'bg-cyan-400 animate-pulse' : 'bg-gray-600'}`}></span>
            <span>{saved ? 'Transcript Saved' : 'No Transcript'}</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 flex-1 min-h-0 overflow-hidden">
        {/* LEFT PANEL: Prompt AI Toolkit (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="flex items-center justify-between bg-gray-900 px-4 py-3 border-b border-gray-800 shrink-0">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🤖</span> Multimodal Transcript Prompt
            </span>
            <button
              onClick={handleCopyPrompt}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-all shadow flex items-center gap-1"
            >
              <span>{copiedPrompt ? '✓' : '📋'}</span>
              <span>{copiedPrompt ? 'Copied!' : 'Copy Prompt'}</span>
            </button>
          </div>

          <div className="p-4 flex-1 flex flex-col min-h-0 overflow-hidden space-y-3">
            <p className="text-xs text-gray-400">
              Copy prompt di bawah ini lalu kirim bersama audio ke Gemini/ChatGPT untuk transkrip presisi:
            </p>
            <div className="relative flex-1 min-h-0">
              <pre className="absolute inset-0 bg-gray-950 text-cyan-300 text-xs font-mono p-3.5 rounded-xl border border-gray-800 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
                {prompt || 'Loading prompt template...'}
              </pre>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Transcript Viewer & JSON Ingestion (Col 7) */}
        <div className="lg:col-span-7 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="flex items-center justify-between bg-gray-900 px-4 py-3 border-b border-gray-800 shrink-0">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>💬</span> Transcript Data
            </span>

            {entries && !isEditing && (
              <div className="flex gap-2">
                <button
                  onClick={handleCopyJson}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-medium transition-all"
                >
                  {copiedJson ? '✓ Copied' : 'Copy JSON'}
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-800/50 rounded-lg text-xs font-medium transition-all"
                >
                  Edit / Paste JSON
                </button>
              </div>
            )}
          </div>

          <div className="p-4 flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
            {/* VIEW MODE */}
            {entries && !isEditing ? (
              <div className="flex flex-col h-full space-y-3 min-h-0">
                {/* Stats & Search Bar */}
                <div className="flex items-center justify-between gap-3 bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <span className="text-xs text-gray-400">
                    Total: <strong className="text-cyan-400 font-mono">{entries.length} entries</strong> · Duration: <strong className="text-cyan-400 font-mono">{formatMinute(totalDuration)} ({totalDuration.toFixed(1)}s)</strong>
                  </span>
                  <div className="relative w-48">
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Search text..."
                      className="w-full bg-gray-900 text-gray-200 text-xs rounded-lg pl-7 pr-3 py-1 border border-gray-800 focus:border-cyan-500 focus:outline-none"
                    />
                    <span className="absolute left-2.5 top-1.5 text-[11px] text-gray-500">🔍</span>
                  </div>
                </div>

                {/* Table List */}
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                  {filteredEntries.map((e) => (
                    <div
                      key={e.id}
                      className="p-3 rounded-xl bg-gray-950 border border-gray-800 hover:border-cyan-900/60 transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-gray-500">#{e.id}</span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                            ⏱️ {e.timestamp_minute}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-500 font-mono">
                          {e.start_seconds.toFixed(1)}s - {e.end_seconds.toFixed(1)}s
                        </span>
                      </div>
                      <p className="text-xs text-gray-200 leading-relaxed font-normal bg-gray-900/80 p-2.5 rounded-lg border border-gray-800">
                        "{e.text}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* JSON INPUT MODE */
              <div className="flex flex-col h-full space-y-3 min-h-0">
                <p className="text-xs text-gray-400">Paste JSON array from AI multimodal transcription:</p>
                <textarea
                  value={jsonRaw}
                  onChange={(e) => setJsonRaw(e.target.value)}
                  placeholder={`[\n  {\n    "id": 1,\n    "start_seconds": 0.0,\n    "end_seconds": 3.5,\n    "timestamp_minute": "00:00 - 00:03",\n    "text": "..."\n  }\n]`}
                  className="flex-1 w-full bg-gray-950 text-gray-200 text-xs font-mono p-4 rounded-xl border border-gray-800 focus:border-cyan-500 focus:outline-none resize-none leading-relaxed"
                  spellCheck={false}
                />

                {error && (
                  <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400">
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  {entries && (
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium transition-all"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleParse}
                    disabled={!jsonRaw.trim()}
                    className={`px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${
                      !jsonRaw.trim()
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30'
                    }`}
                  >
                    Validate & Save Transcript
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptPlaceholder;
