// dashboard/src/components/placeholders/TranscriptPlaceholder.tsx
import React, { useState, useEffect } from 'react';

const api = window.electronAPI;

export interface TranscriptEntry {
  id?: number;
  start_seconds?: number;
  end_seconds?: number;
  start?: number;
  end?: number;
  timestamp_minute?: string;
  timestamp?: string;
  text?: string;
  narration?: string;
  speaker?: string;
}

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

export function normalizeEntry(entry: any, index: number): NormalizedTranscriptEntry {
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
  const [collapsedPrompt, setCollapsedPrompt] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      // Load prompt template
      const savedPrompt = await api.readFromProject('dashboard/prompts/transcript-prompt.md');
      if (savedPrompt) {
        setPrompt(savedPrompt);
      }

      // Load existing saved transcript if available
      const savedTranscript = await api.readFromProject('input/transcript.json');
      if (savedTranscript) {
        try {
          const parsed = JSON.parse(savedTranscript);
          if (Array.isArray(parsed)) {
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

      for (let i = 0; i < parsed.length; i++) {
        const e = parsed[i];
        const startSec = typeof e.start_seconds === 'number' ? e.start_seconds : e.start;
        const endSec = typeof e.end_seconds === 'number' ? e.end_seconds : e.end;

        if (typeof startSec !== 'number' || typeof endSec !== 'number') {
          setError(`Entry #${i + 1}: field start_seconds / start dan end_seconds / end harus berformat angka float`);
          return;
        }
        if (!e.text && !e.narration && !e.speech && !e.visual) {
          setError(`Entry #${i + 1}: wajib memiliki field "text" berisi teks ucapan audio`);
          return;
        }
      }

      const normalized = parsed.map((e, idx) => normalizeEntry(e, idx));
      setEntries(normalized);
      setSaved(false);
    } catch (e: any) {
      setError(`Format JSON tidak valid: ${e.message}`);
    }
  };

  const handleSave = async () => {
    if (!entries) return;
    try {
      const jsonString = JSON.stringify(entries, null, 2);
      await api.saveToProject('input/transcript.json', jsonString);
      setSaved(true);
    } catch (e: any) {
      setError(`Gagal menyimpan: ${e.message}`);
    }
  };

  const handleClear = () => {
    setEntries(null);
    setJsonRaw('');
    setError(null);
    setSaved(false);
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
    <div className="flex flex-col h-full overflow-auto py-4 px-4">
      {/* Top Header */}
      <div className="text-center shrink-0 mb-6">
        <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
          <span>📜</span> Transkrip Audio
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Transkrip percakapan audio dengan timestamp detik float dan penanda menit (<code className="text-cyan-400">MM:SS</code>).
        </p>
      </div>

      <div className="w-full max-w-4xl mx-auto space-y-5 flex-1">
        {/* Prompt AI Generator Section */}
        <div className="border border-gray-800 bg-gray-900/60 rounded-xl overflow-hidden shadow-lg backdrop-blur-sm">
          <button
            onClick={() => setCollapsedPrompt(!collapsedPrompt)}
            className="w-full flex items-center justify-between px-5 py-3 bg-gray-800/80 hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 text-base">🤖</span>
              <span className="text-sm font-semibold text-gray-200">Prompt AI Transkripsi Audio (Kirim ke ChatGPT / Claude / Gemini)</span>
            </div>
            <span className="text-xs text-gray-400 font-mono">
              {collapsedPrompt ? '▶ Tampilkan' : '▼ Sembunyikan'}
            </span>
          </button>

          {!collapsedPrompt && (
            <div className="p-4 space-y-3">
              <div className="relative">
                <pre className="w-full max-h-56 overflow-y-auto bg-gray-950 text-cyan-300 text-xs font-mono rounded-lg p-3.5 border border-gray-800 whitespace-pre-wrap leading-relaxed">
                  {prompt || 'Loading prompt template...'}
                </pre>
                <button
                  onClick={handleCopyPrompt}
                  className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded-md text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md flex items-center gap-1.5"
                >
                  <span>{copiedPrompt ? '✓' : '📋'}</span>
                  <span>{copiedPrompt ? 'Copied Prompt!' : 'Copy Prompt'}</span>
                </button>
              </div>
              <p className="text-xs text-gray-400">
                💡 <strong>Cara pakai:</strong> Copy prompt di atas, lalu upload file audio/video ke AI Multimodal (seperti Gemini / Claude / ChatGPT) untuk merender transkrip ucapan berformat JSON presisi.
              </p>
            </div>
          )}
        </div>

        {/* Input & Validator Mode (When no parsed entries or user editing) */}
        {(!entries || !saved) && (
          <div className="border border-gray-800 bg-gray-900/60 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <span>📥</span> Paste Hasil Transkrip Audio JSON AI
              </h3>
              {entries && !saved && (
                <span className="text-xs text-yellow-400 bg-yellow-950/60 border border-yellow-700/50 px-2.5 py-0.5 rounded-full font-medium">
                  Belum Disimpan
                </span>
              )}
            </div>

            <textarea
              value={jsonRaw}
              onChange={(e) => setJsonRaw(e.target.value)}
              placeholder={`Paste JSON array transkrip audio dari AI di sini...\n\n[\n  {\n    "id": 1,\n    "start_seconds": 0.0,\n    "end_seconds": 3.5,\n    "timestamp_minute": "00:00 - 00:03",\n    "text": "Selamat datang di tutorial pembuatan konten otomatis.",\n    "speaker": "Host"\n  }\n]`}
              className="w-full h-52 bg-gray-950 text-gray-200 text-xs font-mono rounded-lg p-3.5 border border-gray-800 focus:border-cyan-500 focus:outline-none resize-none leading-relaxed"
              spellCheck={false}
            />

            {error && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              {entries && (
                <button
                  onClick={handleClear}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
                >
                  Batal / Reset
                </button>
              )}
              <button
                onClick={handleParse}
                disabled={!jsonRaw.trim()}
                className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  !jsonRaw.trim()
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30'
                }`}
              >
                Validate & Preview JSON
              </button>
            </div>
          </div>
        )}

        {/* Parsed / Saved Transcript View */}
        {entries && entries.length > 0 && (
          <div className="border border-gray-800 bg-gray-900/60 rounded-xl p-5 shadow-lg space-y-4">
            {/* Header & Stats */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-950 border border-cyan-800 rounded-lg text-cyan-400 text-lg">
                  🎙️
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Transkrip Percakapan Terstruktur</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Total: <strong className="text-cyan-400">{entries.length} ucapan</strong> · Total Durasi: <strong className="text-cyan-400">{formatMinute(totalDuration)} ({totalDuration.toFixed(1)}s)</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyJson}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors flex items-center gap-1"
                >
                  <span>{copiedJson ? '✓' : '📋'}</span>
                  <span>{copiedJson ? 'Copied JSON' : 'Copy JSON'}</span>
                </button>
                <button
                  onClick={() => setSaved(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 hover:bg-gray-700 text-cyan-400 transition-colors"
                >
                  ✏️ Edit JSON
                </button>
                {!saved ? (
                  <button
                    onClick={handleSave}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-md"
                  >
                    💾 Simpan ke Project
                  </button>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center gap-1">
                    <span>✓</span> Tersimpan
                  </span>
                )}
              </div>
            </div>

            {/* Search filter bar */}
            <div className="relative">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Cari teks ucapan, pembicara, atau timestamp menit..."
                className="w-full bg-gray-950 text-gray-200 text-xs rounded-lg pl-9 pr-4 py-2 border border-gray-800 focus:border-cyan-500 focus:outline-none"
              />
              <span className="absolute left-3 top-2.5 text-xs text-gray-500">🔍</span>
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter('')}
                  className="absolute right-3 top-2 text-xs text-gray-400 hover:text-gray-200"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Interactive Entries Table / List */}
            <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {filteredEntries.map((e) => (
                <div
                  key={e.id}
                  className="p-3.5 rounded-xl bg-gray-950/70 border border-gray-800/80 hover:border-cyan-800/60 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-3"
                >
                  {/* Left Column: ID & Timestamps */}
                  <div className="flex items-center md:flex-col md:items-start shrink-0 gap-2 md:gap-1 w-44">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-gray-500 font-mono">#{e.id}</span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono">
                        ⏱️ {e.timestamp_minute}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono">
                      ⚡ {e.start_seconds.toFixed(1)}s - {e.end_seconds.toFixed(1)}s ({(e.end_seconds - e.start_seconds).toFixed(1)}s)
                    </span>
                  </div>

                  {/* Middle Column: Audio Speech Text Content */}
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <p className="text-xs text-cyan-100 leading-relaxed font-normal bg-gray-900/80 p-2.5 rounded-lg border border-gray-800 flex items-start gap-2">
                      <span className="text-cyan-400 shrink-0 text-sm">💬</span>
                      <span className="flex-1">"{e.text}"</span>
                    </p>
                  </div>

                  {/* Right Column: Speaker Badge (if present) */}
                  {e.speaker && (
                    <div className="flex items-center shrink-0">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-purple-950/80 text-purple-300 border border-purple-800/50 flex items-center gap-1">
                        <span>🎙️</span>
                        <span>{e.speaker}</span>
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {filteredEntries.length === 0 && (
                <div className="py-8 text-center text-xs text-gray-500">
                  Tidak ada transkrip ucapan yang cocok dengan kata pencarian "{searchFilter}".
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptPlaceholder;
