// dashboard/src/components/longform/AlurfilmTranscriptStep.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { AlurfilmChunk, AlurfilmAudioResult, AlurfilmTranscriptResult, AlurfilmTranscriptEntry } from '../../electron-api';
import {
  validateTranscript,
  autoFixTranscript,
  formatMinute,
  ValidationReport,
} from '../../utils/transcriptValidation';

const api = window.electronAPI;

function normalizeEntry(entry: any, index: number): AlurfilmTranscriptEntry {
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
    text: entry.text || entry.narration || entry.speech || '',
    speaker: entry.speaker || 'Narator',
  };
}

const AlurfilmTranscriptStep: React.FC = () => {
  const [contentId, setContentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [audios, setAudios] = useState<Record<number, AlurfilmAudioResult>>({});
  const [transcripts, setTranscripts] = useState<Record<number, AlurfilmTranscriptResult>>({});
  const [activePart, setActivePart] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Audio Durations per Part (cache for validation)
  const [audioDurations, setAudioDurations] = useState<Record<number, number>>({});

  // Player ref for click-to-seek
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [mediaMode, setMediaMode] = useState<'audio' | 'video'>('audio');

  // JSON Import & Edit Modal State
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [pasteJsonInput, setPasteJsonInput] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const id = await api.getContentId('longform');
      setContentId(id);

      if (id) {
        const chunkList = await api.listAlurfilmChunks(id);
        setChunks(chunkList || []);

        const audioList = await api.listAlurfilmAudios(id);
        const audioMap: Record<number, AlurfilmAudioResult> = {};
        const durMap: Record<number, number> = {};
        if (audioList) {
          for (const item of audioList) {
            audioMap[item.part] = item;
            if (item.filePath) {
              try {
                const meta = await api.getVideoMeta(item.filePath);
                if (meta && meta.duration) {
                  durMap[item.part] = meta.duration;
                }
              } catch {}
            }
          }
        }
        setAudios(audioMap);
        setAudioDurations(durMap);

        const transcriptList = await api.listAlurfilmTranscripts(id);
        const transcriptMap: Record<number, AlurfilmTranscriptResult> = {};
        if (transcriptList) {
          for (const item of transcriptList) {
            transcriptMap[item.part] = item;
          }
        }
        setTranscripts(transcriptMap);

        if (chunkList && chunkList.length > 0) {
          setActivePart(chunkList[0].part);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load transcript files');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyPromptForPart = async (partNum: number) => {
    try {
      let promptTpl = await api.readFromProject('dashboard/prompts/longform/transcript-prompt.md');
      if (!promptTpl) {
        promptTpl = await api.readFromProject('dashboard/prompts/longform/alurfilm-transcript-prompt.md');
      }
      if (!promptTpl) {
        promptTpl = `Kamu adalah seorang "Master AI Audio Transcriber & Synchronizer" presisi tinggi. Audio Part {{chunk_part}} dari {{total_chunks}} Part Total. Total duration: {{audio_duration}}.`;
      }

      const totalChunks = chunks.length || 1;
      const audioDurationSec = audioDurations[partNum] || 0;
      const durationStr = audioDurationSec > 0 
        ? `${audioDurationSec.toFixed(1)}s (${formatMinute(audioDurationSec)})`
        : 'Unknown Duration';

      let formattedPrompt = promptTpl
        .replace(/\{\{chunk_part\}\}/g, String(partNum))
        .replace(/\{\{total_chunks\}\}/g, String(totalChunks))
        .replace(/\{\{audio_duration\}\}/g, durationStr);

      if (api.copyToClipboard) {
        await api.copyToClipboard(formattedPrompt);
        showToast(`📋 Copied Audio Transcript Prompt for Part #${partNum}!`);
      }
    } catch (err: any) {
      setError(`Failed to format prompt: ${err.message}`);
    }
  };

  const handleSaveImportedJson = async () => {
    if (!pasteJsonInput.trim()) return;
    setError(null);
    try {
      let raw = pasteJsonInput.trim();
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setError('Transcript JSON must be a non-empty array of items');
        return;
      }

      const normalizedEntries = parsed.map((e, idx) => normalizeEntry(e, idx));

      const res = await api.saveAlurfilmTranscript(contentId || 'default', activePart, normalizedEntries);
      setTranscripts((prev) => ({ ...prev, [activePart]: res }));
      setShowImportModal(false);
      setPasteJsonInput('');
      showToast(`🎉 Saved Transcript for Part #${activePart} (${normalizedEntries.length} items)!`);
    } catch (err: any) {
      setError(`Invalid JSON: ${err.message}`);
    }
  };

  const handleSeekToTime = (startSec: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = startSec;
      mediaRef.current.play();
      showToast(`▶️ Playing from ${startSec.toFixed(1)}s`);
    }
  };

  const currentChunk = chunks.find((c) => c.part === activePart);
  const currentAudio = audios[activePart];
  const currentTranscriptResult = transcripts[activePart];
  const currentEntries: AlurfilmTranscriptEntry[] | null = currentTranscriptResult?.entries || null;
  const currentAudioDuration = audioDurations[activePart] || null;

  const currentReport: ValidationReport = useMemo(() => {
    return validateTranscript(currentEntries, currentAudioDuration);
  }, [currentEntries, currentAudioDuration]);

  const handleAutoFixCurrentPart = async () => {
    if (!currentEntries || currentEntries.length === 0) return;
    const fixed = autoFixTranscript(currentEntries, currentAudioDuration);
    try {
      const res = await api.saveAlurfilmTranscript(contentId || 'default', activePart, fixed);
      setTranscripts((prev) => ({ ...prev, [activePart]: res }));
      showToast(`⚡ Auto-fixed timing issues for Part #${activePart}!`);
    } catch (err: any) {
      setError(`Failed auto-fix: ${err.message}`);
    }
  };

  const filteredEntries = currentEntries ? currentEntries.filter((e) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      e.text.toLowerCase().includes(term) ||
      (e.speaker || '').toLowerCase().includes(term) ||
      e.timestamp_minute.toLowerCase().includes(term)
    );
  }) : [];

  const totalTranscriptDuration = currentEntries && currentEntries.length > 0
    ? currentEntries[currentEntries.length - 1].end_seconds
    : 0;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-6 overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-purple-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl border border-purple-400 animate-bounce">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-800 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="p-2 bg-purple-600/20 text-purple-400 rounded-lg text-lg">📝</span>
            Alur Film Audio Transcript & Timestamp Studio
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Click any transcript line to preview & seek audio/video narration in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (currentEntries) {
                setPasteJsonInput(JSON.stringify(currentEntries, null, 2));
              } else {
                setPasteJsonInput('');
              }
              setShowImportModal(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border border-purple-500/30 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-purple-600/20"
          >
            <span>📋</span> {currentEntries ? 'Edit / Replace JSON' : 'Paste Transcript JSON'}
          </button>
        </div>
      </div>

      {/* Main Grid Workspace with Side Parts List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5 flex-1 min-h-0 overflow-hidden">
        {/* SIDE COLUMN: Vertical Parts Selector (Col 2) */}
        <div className="lg:col-span-2 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800 shrink-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Parts ({chunks.length})
            </span>
            <span className="text-[10px] text-purple-400 font-mono font-bold">Text</span>
          </div>

          {chunks.length > 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
              {chunks.map((chunk) => {
                const isDone = !!transcripts[chunk.part]?.entries?.length;
                const isActive = activePart === chunk.part;
                return (
                  <button
                    key={chunk.part}
                    onClick={() => setActivePart(chunk.part)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-between border ${
                      isActive
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                        : isDone
                        ? 'bg-purple-950/40 border-purple-800/60 text-purple-300 hover:bg-purple-900/50'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <span>Part #{chunk.part}</span>
                    <span className="text-xs">{isDone ? '✓' : '○'}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-amber-400 p-2 text-center">
              Belum ada part split.
            </div>
          )}
        </div>

        {/* CENTER PANEL: Media Preview Player & Prompt (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🤖</span> Part #{activePart} Player & Prompt
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Click lines on right to seek preview player.
              </p>
            </div>

            <button
              onClick={() => handleCopyPromptForPart(activePart)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center gap-1 shrink-0"
            >
              <span>📋</span> Copy Prompt #{activePart}
            </button>
          </div>

          {/* Player Mode Switcher: Audio vs Video */}
          <div className="flex items-center gap-2 bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => setMediaMode('audio')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mediaMode === 'audio' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              🎙️ Voiceover Audio
            </button>
            <button
              onClick={() => setMediaMode('video')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mediaMode === 'video' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              📹 Video Chunk
            </button>
          </div>

          {/* Media Player Box */}
          <div className="bg-black rounded-xl p-3 border border-gray-800 flex flex-col items-center justify-center min-h-[160px] shadow-inner">
            {mediaMode === 'audio' ? (
              currentAudio ? (
                <div className="w-full space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-purple-600/20 text-purple-400 rounded-lg text-lg">🎙️</span>
                    <span className="text-xs font-mono font-bold text-white truncate">{currentAudio.name}</span>
                  </div>
                  <audio
                    ref={mediaRef as React.RefObject<HTMLAudioElement>}
                    src={currentAudio.mediaUrl || currentAudio.url}
                    controls
                    className="w-full h-10 rounded-lg"
                  />
                </div>
              ) : (
                <p className="text-xs text-gray-500">No Audio uploaded for Part #{activePart}</p>
              )
            ) : (
              currentChunk ? (
                <video
                  ref={mediaRef as React.RefObject<HTMLVideoElement>}
                  src={currentChunk.mediaUrl || currentChunk.url}
                  controls
                  className="w-full h-44 object-contain rounded-lg"
                />
              ) : (
                <p className="text-xs text-gray-500">No Video Chunk for Part #{activePart}</p>
              )
            )}
          </div>

          <div className="flex-1 bg-gray-950 p-4 rounded-xl border border-gray-800 overflow-y-auto space-y-2 font-mono text-xs text-gray-300 leading-relaxed min-h-0">
            <p className="text-purple-400 font-bold">// Transcript Instructions</p>
            <p>- Part: {activePart} of {chunks.length || 1}</p>
            <p>- Audio Duration: {currentAudioDuration ? `${currentAudioDuration.toFixed(1)}s` : 'Unknown'}</p>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Transcript Table with Interactive Seek (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>💬</span> Speech Lines ({filteredEntries.length})
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Click lines to seek playback.
              </p>
            </div>

            {currentEntries && currentEntries.length > 0 && (
              <button
                onClick={() => {
                  if (api.copyToClipboard) {
                    api.copyToClipboard(JSON.stringify(currentEntries, null, 2));
                    showToast(`📋 Copied JSON Transcript for Part #${activePart}!`);
                  }
                }}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-medium transition-all"
              >
                📋 Copy JSON
              </button>
            )}
          </div>

          {currentEntries && currentEntries.length > 0 ? (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              {/* Stats & Search */}
              <div className="flex items-center justify-between gap-3 bg-gray-950 p-3 rounded-xl border border-gray-800">
                <span className="text-xs text-gray-400">
                  Total: <strong className="text-purple-400 font-mono">{currentEntries.length} items</strong>
                </span>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search text..."
                  className="bg-gray-900 text-gray-200 text-xs rounded-lg px-3 py-1 border border-gray-800 focus:border-purple-500 focus:outline-none w-32"
                />
              </div>

              {/* Validation Report Banner */}
              {currentReport.issues.length > 0 && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium ${
                    currentReport.status === 'ERROR'
                      ? 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                      : 'bg-amber-950/40 border-amber-800/50 text-amber-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span>{currentReport.status === 'ERROR' ? '🔴' : '⚠️'}</span>
                      <span>{currentReport.summaryText}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleAutoFixCurrentPart}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow transition-all shrink-0 flex items-center gap-1"
                  >
                    <span>⚡</span> Auto-Fix
                  </button>
                </div>
              )}

              {/* Click-to-Seek Transcript List */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                {filteredEntries.map((e, idx) => (
                  <div
                    key={e.id || idx}
                    onClick={() => handleSeekToTime(e.start_seconds)}
                    className="p-3 bg-gray-950 hover:bg-purple-950/40 border border-gray-800 hover:border-purple-600/50 rounded-xl space-y-1.5 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-gray-500">#{e.id || idx + 1}</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800/50 group-hover:bg-purple-600 group-hover:text-white transition-all">
                          ▶️ {e.timestamp_minute}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-500 font-mono">
                        {e.start_seconds.toFixed(1)}s - {e.end_seconds.toFixed(1)}s
                      </span>
                    </div>
                    <p className="text-xs text-gray-200 leading-relaxed font-normal bg-gray-900 p-2.5 rounded-lg border border-gray-800 group-hover:border-purple-500/30">
                      "{e.text}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-800 rounded-2xl space-y-3">
              <div className="w-12 h-12 bg-gray-900 text-gray-600 rounded-xl flex items-center justify-center text-xl">
                📝
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-400">Belum Ada Transkrip Part #{activePart}</h4>
                <p className="text-[11px] text-gray-500 mt-1 max-w-xs">
                  Copy prompt di tengah, jalankan di AI Studio dengan voiceover audio, lalu paste hasilnya ke sini.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📋</span> Paste / Edit Transcript JSON (Part #{activePart})
            </h3>
            <textarea
              value={pasteJsonInput}
              onChange={(e) => setPasteJsonInput(e.target.value)}
              placeholder={`[\n  {\n    "id": 1,\n    "start_seconds": 0.0,\n    "end_seconds": 3.4,\n    "timestamp_minute": "00:00 - 00:03",\n    "text": "..."\n  }\n]`}
              className="w-full h-64 bg-gray-950 text-gray-200 text-xs font-mono p-3 rounded-xl border border-gray-800 focus:border-purple-500 focus:outline-none resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs font-medium">Batal</button>
              <button onClick={handleSaveImportedJson} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold">Save Transcript</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlurfilmTranscriptStep;
