// dashboard/src/components/shortform/ShortformTranscriptStep.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  validateTranscript,
  autoFixTranscript,
  formatMinute,
  ValidationReport
} from '../../utils/transcriptValidation';

const api = window.electronAPI;

export interface NormalizedTranscriptEntry {
  id: number;
  start_seconds: number;
  end_seconds: number;
  timestamp_minute: string;
  text: string;
  speaker: string;
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

interface ShortformTranscriptStepProps {
  onStepChange?: (step: any) => void;
}

const ShortformTranscriptStep: React.FC<ShortformTranscriptStepProps> = ({ onStepChange }) => {
  const [prompt, setPrompt] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [jsonRaw, setJsonRaw] = useState<string>('');
  const [entries, setEntries] = useState<NormalizedTranscriptEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [voDuration, setVoDuration] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const savedPrompt = await api.readFromProject('dashboard/prompts/shortform/transcript-prompt.md');
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

      try {
        const savedVO = await api.readFromProject('input/voiceover.json');
        if (savedVO && savedVO.trim()) {
          const parsedVO = JSON.parse(savedVO);
          if (parsedVO.filePath) {
            const meta = await api.getVideoMeta(parsedVO.filePath);
            if (meta && meta.duration) {
              setVoDuration(meta.duration);
            }
          }
        }
      } catch {}
    })();
  }, []);

  const report: ValidationReport = useMemo(() => {
    return validateTranscript(entries, voDuration);
  }, [entries, voDuration]);

  const finalPrompt = useMemo(() => {
    if (!prompt) return '';
    if (voDuration && voDuration > 0) {
      const durFormatted = `${voDuration.toFixed(1)}s (${formatMinute(voDuration)})`;
      return prompt.replace(/\{\{audio_duration\}\}/g, durFormatted);
    }
    return prompt;
  }, [prompt, voDuration]);

  const handleCopyPrompt = async () => {
    await api.copyToClipboard(finalPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyJson = async () => {
    if (!entries) return;
    await api.copyToClipboard(JSON.stringify(entries, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
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

  const handleParse = (customData?: NormalizedTranscriptEntry[]) => {
    setError(null);
    try {
      let normalized: NormalizedTranscriptEntry[] = [];
      if (customData) {
        normalized = customData;
      } else {
        let raw = jsonRaw.trim();
        if (raw.startsWith('```')) {
          raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          setError('Data transkrip harus berupa JSON array non-kosong');
          return;
        }

        normalized = parsed.map((e, idx) => normalizeEntry(e, idx));
      }

      setEntries(normalized);
      setJsonRaw(JSON.stringify(normalized, null, 2));
      setIsEditing(false);
      handleSave(normalized);
    } catch (e: any) {
      setError(`Format JSON tidak valid: ${e.message}`);
    }
  };

  const handleAutoFixValidation = async () => {
    if (!entries || entries.length === 0) return;
    const fixed = autoFixTranscript(entries, voDuration).map((e) => ({
      ...e,
      speaker: e.speaker || '',
    }));
    setEntries(fixed);
    setJsonRaw(JSON.stringify(fixed, null, 2));
    await handleSave(fixed);
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
            <span className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg text-lg">📝</span>
            Shorts Audio Transcript & Timestamp Studio
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Transcribe voiceover audio with exact decimal timestamps (`start_seconds`, `end_seconds`) and validate continuity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
            saved && report.isValid
              ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300 shadow-lg shadow-emerald-950/40'
              : saved
              ? 'bg-amber-950/60 border-amber-700/50 text-amber-300'
              : 'bg-gray-900 border-gray-800 text-gray-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${saved && report.isValid ? 'bg-emerald-400 animate-pulse' : saved ? 'bg-amber-400' : 'bg-gray-600'}`}></span>
            <span>{saved ? (report.isValid ? 'Transcript Ready' : report.summaryText) : 'No Transcript'}</span>
          </div>

          {onStepChange && (
            <button
              onClick={() => onStepChange('render')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
            >
              <span>Next: 4. Render Video</span>
              <span>➔</span>
            </button>
          )}
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
                {finalPrompt || 'Loading prompt template...'}
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
                {report.issues.length > 0 && (
                  <button
                    onClick={handleAutoFixValidation}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-all shadow flex items-center gap-1"
                  >
                    <span>⚡</span> Auto-Fix Validation
                  </button>
                )}
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
                    {voDuration ? ` · VO: ${formatMinute(voDuration)} (${voDuration.toFixed(1)}s)` : ''}
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

                {/* Validation Status & Auto-Fix Banner */}
                {report.issues.length > 0 && (
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium ${
                      report.status === 'ERROR'
                        ? 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                        : 'bg-amber-950/40 border-amber-800/50 text-amber-300'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>{report.status === 'ERROR' ? '🔴' : '⚠️'}</span>
                        <span>{report.summaryText}</span>
                      </div>
                      <div className="text-[11px] font-mono opacity-90">
                        {report.issues[0]?.message}
                        {report.issues.length > 1 ? ` (+${report.issues.length - 1} isu lainnya)` : ''}
                      </div>
                    </div>

                    <button
                      onClick={handleAutoFixValidation}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow transition-all shrink-0 flex items-center gap-1"
                    >
                      <span>⚡</span> Auto-Fix Timing
                    </button>
                  </div>
                )}

                {/* Table List */}
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                  {filteredEntries.map((e, idx) => {
                    const itemNum = e.id || idx + 1;
                    const rowIssue = report.issues.find((i) => i.itemIndex === itemNum);

                    return (
                      <div
                        key={e.id}
                        className={`p-3 rounded-xl border transition-all space-y-1.5 ${
                          rowIssue?.severity === 'error'
                            ? 'bg-rose-950/30 border-rose-800'
                            : rowIssue?.severity === 'warning'
                            ? 'bg-amber-950/20 border-amber-800/60'
                            : 'bg-gray-950 border-gray-800 hover:border-cyan-900/60'
                        }`}
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
                        {rowIssue && (
                          <div className="text-[10px] font-mono text-amber-300 pt-0.5 flex items-center gap-1">
                            <span>{rowIssue.severity === 'error' ? '🔴' : '⚠️'}</span>
                            <span>{rowIssue.message}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                    onClick={() => handleParse()}
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

export default ShortformTranscriptStep;
