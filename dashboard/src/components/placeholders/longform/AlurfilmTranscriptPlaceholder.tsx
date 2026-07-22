// dashboard/src/components/placeholders/longform/AlurfilmTranscriptPlaceholder.tsx
import React, { useState, useEffect } from 'react';
import type { AlurfilmChunk, AlurfilmAudioResult, AlurfilmTranscriptResult, AlurfilmTranscriptEntry } from '../../../electron-api';

const api = window.electronAPI;

function formatMinute(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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

const AlurfilmTranscriptPlaceholder: React.FC = () => {
  const [contentId, setContentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [audios, setAudios] = useState<Record<number, AlurfilmAudioResult>>({});
  const [transcripts, setTranscripts] = useState<Record<number, AlurfilmTranscriptResult>>({});
  const [activePart, setActivePart] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // JSON Import & Edit Modal State
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [pasteJsonInput, setPasteJsonInput] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [audioDuration, setAudioDuration] = useState<number | null>(null);

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
        // Load chunks
        const chunkList = await api.listAlurfilmChunks(id);
        setChunks(chunkList || []);

        // Load audios
        const audioList = await api.listAlurfilmAudios(id);
        const audioMap: Record<number, AlurfilmAudioResult> = {};
        if (audioList) {
          for (const item of audioList) {
            audioMap[item.part] = item;
          }
        }
        setAudios(audioMap);

        // Load transcripts
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
      setError(err.message || 'Gagal memuat data transkrip');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update audio duration for active part if audio file exists
  useEffect(() => {
    (async () => {
      const audio = audios[activePart];
      if (audio && audio.filePath) {
        try {
          const meta = await api.getVideoMeta(audio.filePath);
          if (meta && meta.duration) {
            setAudioDuration(meta.duration);
          }
        } catch {
          setAudioDuration(null);
        }
      } else {
        setAudioDuration(null);
      }
    })();
  }, [activePart, audios]);

  const handleCopyTranscriptPrompt = async (partNum: number) => {
    try {
      const totalChunksCount = Math.max(1, chunks.length);
      const promptText = await api.getAlurfilmTranscriptPrompt(partNum, totalChunksCount);
      await api.copyToClipboard(promptText);
      showToast(`📋 Prompt Transkrip Part ${partNum} disalin! Paste ke Google AI Studio.`);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil prompt transkrip');
    }
  };

  const handleSaveImportedJson = async () => {
    if (!pasteJsonInput.trim()) return;

    try {
      setError(null);
      let raw = pasteJsonInput.trim();
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setError('Data transkrip harus berupa JSON array non-kosong');
        return;
      }

      const normalized = parsed.map((e, idx) => normalizeEntry(e, idx));
      const savedResult = await api.saveAlurfilmTranscript(activePart, JSON.stringify(normalized));

      setTranscripts((prev) => ({ ...prev, [activePart]: savedResult }));
      setShowImportModal(false);
      setPasteJsonInput('');
      showToast(`✨ Transkrip Part ${activePart} berhasil disimpan! (${normalized.length} entry)`);
    } catch (err: any) {
      setError(`Format JSON tidak valid: ${err.message}`);
    }
  };

  const handleFixTailGap = async () => {
    const currentData = transcripts[activePart]?.data;
    if (!currentData || currentData.length === 0 || !audioDuration) return;

    const updated = [...currentData];
    const lastIdx = updated.length - 1;
    const last = updated[lastIdx];

    const startSec = last.start_seconds;
    const endSec = audioDuration;
    const tsMin = `${formatMinute(startSec)} - ${formatMinute(endSec)}`;

    updated[lastIdx] = {
      ...last,
      end_seconds: endSec,
      timestamp_minute: tsMin,
    };

    try {
      const savedResult = await api.saveAlurfilmTranscript(activePart, JSON.stringify(updated));
      setTranscripts((prev) => ({ ...prev, [activePart]: savedResult }));
      showToast(`🛠️ Tail Gap Part ${activePart} disinkronkan ke ${endSec.toFixed(1)}s!`);
    } catch (err: any) {
      setError(`Gagal memperbaiki tail gap: ${err.message}`);
    }
  };

  const handleCopyJson = async () => {
    const data = transcripts[activePart]?.data;
    if (!data) return;
    try {
      await api.copyToClipboard(JSON.stringify(data, null, 2));
      showToast(`📋 Transkrip JSON Part ${activePart} disalin ke clipboard!`);
    } catch (err: any) {}
  };

  const totalPartsCount = Math.max(chunks.length, Object.keys(transcripts).length, 1);
  const partsList = Array.from({ length: totalPartsCount }, (_, i) => i + 1);

  const completedTranscriptsCount = partsList.filter((p) => transcripts[p]?.data?.length > 0).length;
  const transcriptProgressPercent = Math.round((completedTranscriptsCount / totalPartsCount) * 100);

  const activeTranscriptData = transcripts[activePart]?.data;
  const activeAudio = audios[activePart];

  const filteredEntries = (activeTranscriptData || []).filter((item) => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    return item.text.toLowerCase().includes(query) || (item.speaker && item.speaker.toLowerCase().includes(query));
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl font-medium text-sm flex items-center gap-2 border border-emerald-400/30 animate-in fade-in slide-in-from-top-4">
          <span>{toast}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-2xl text-rose-200 text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs bg-rose-900 hover:bg-rose-800 px-3 py-1.5 rounded-xl font-bold transition-all text-rose-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* JSON Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-purple-800 rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-purple-400 font-bold uppercase">
                  Part #{activePart} Audio Transcriber
                </span>
                <h3 className="text-lg font-bold text-white">Import JSON Output Transkrip AI</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-all text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Paste JSON array transkrip audio yang dihasilkan dari AI Transcriber untuk Part #{activePart}:
            </p>

            <textarea
              value={pasteJsonInput}
              onChange={(e) => setPasteJsonInput(e.target.value)}
              placeholder='[\n  {\n    "id": 1,\n    "start_seconds": 0.0,\n    "end_seconds": 3.8,\n    "timestamp_minute": "00:00 - 00:03",\n    "text": "Tekstual narasi...",\n    "speaker": "Narator"\n  }\n]'
              rows={12}
              className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs font-mono text-purple-200 placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-all leading-relaxed"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleSaveImportedJson}
                disabled={!pasteJsonInput.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
              >
                💾 Save & Import Transkrip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Title & Stats Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-xs font-mono font-bold uppercase tracking-wider">
                16:9 Alur Film Studio
              </span>
              {contentId && (
                <span className="text-xs font-mono text-gray-500 bg-gray-950 px-2.5 py-1 rounded-lg border border-gray-800">
                  ID: #{contentId}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2 pt-1">
              <span>📝</span> Audio Transcript & Subtitle Synchronizer
            </h1>
            <p className="text-xs text-gray-400 max-w-xl">
              Transkripsi audio voiceover per scene/part dengan presisi timestamp tinggi untuk sinkronisasi subjudul dan durasi rendering.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl border border-gray-700 transition-all flex items-center gap-2"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span> Refresh
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-800/80">
          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Part Scene</span>
            <span className="text-lg font-black text-white">{totalPartsCount} Part</span>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Status Transkrip</span>
            <span className="text-lg font-black text-purple-400">
              {completedTranscriptsCount} / {totalPartsCount} Ready
            </span>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Entry Transkrip (Part #{activePart})</span>
            <span className="text-lg font-black text-emerald-400">
              {activeTranscriptData ? `${activeTranscriptData.length} Frasa` : '0 Frasa'}
            </span>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Progress Transkrip</span>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-gray-300">{transcriptProgressPercent}%</span>
                <span className={completedTranscriptsCount === totalPartsCount ? 'text-emerald-400' : 'text-purple-400'}>
                  {completedTranscriptsCount === totalPartsCount ? 'Lengkap' : 'Dalam Proses'}
                </span>
              </div>
              <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${transcriptProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Part List & Prompt Actions */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Daftar Part / Scene</h3>
            <span className="text-[10px] font-mono text-purple-400 font-bold bg-purple-950 px-2 py-0.5 rounded border border-purple-900">
              {partsList.length} Part
            </span>
          </div>

          <div className="space-y-2">
            {partsList.map((partNum) => {
              const isSelected = activePart === partNum;
              const hasTranscript = !!transcripts[partNum]?.data?.length;
              const entryCount = transcripts[partNum]?.data?.length || 0;

              return (
                <div
                  key={partNum}
                  onClick={() => setActivePart(partNum)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-150 flex flex-col space-y-2 relative overflow-hidden cursor-pointer ${
                    isSelected
                      ? 'bg-purple-950/60 border-purple-500/80 text-white shadow-xl shadow-purple-950/30'
                      : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-850 hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <span>Part #{partNum}</span>
                    </span>

                    {hasTranscript ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                        <span>📝</span> Transkrip Ready
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1">
                        <span>⏳</span> Pending Transkrip
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <span>💬</span> {hasTranscript ? `${entryCount} Frasa Ucapan` : 'Belum Ada Transkrip'}
                    </span>
                  </div>

                  {/* Actions Bar per part */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-800/80">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyTranscriptPrompt(partNum);
                      }}
                      className="flex-1 py-1.5 px-2 bg-gray-800 hover:bg-purple-900/60 text-purple-300 rounded-lg text-[10px] font-bold transition-all border border-purple-900/40 flex items-center justify-center gap-1"
                      title="Copy prompt transkrip presisi tinggi"
                    >
                      <span>📋</span> Copy Prompt
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePart(partNum);
                        setShowImportModal(true);
                      }}
                      className="flex-1 py-1.5 px-2 bg-purple-600/20 hover:bg-purple-600 text-purple-200 hover:text-white rounded-lg text-[10px] font-bold transition-all border border-purple-500/30 flex items-center justify-center gap-1"
                      title="Import output JSON dari AI"
                    >
                      <span>📥</span> Import JSON
                    </button>
                  </div>

                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500 rounded-r" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: High Precision Transcript Timeline & Actions */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-6 shadow-xl">
            {/* Header for Active Part */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-purple-400 font-bold bg-purple-950/80 px-2.5 py-0.5 rounded-md border border-purple-800">
                    PART #{activePart} TRANSCRIPT TIMELINE
                  </span>
                  {activeTranscriptData ? (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-800">
                      ✅ {activeTranscriptData.length} Entry Transkrip
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-md border border-amber-800">
                      ⚠️ Belum Ada Data Transkrip
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white pt-2">
                  Transkrip Audio Sinkronisasi Part #{activePart}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyTranscriptPrompt(activePart)}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>📋</span> Copy Transcribe Prompt
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs rounded-xl border border-gray-700 transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>📥</span> Import JSON
                </button>
              </div>
            </div>

            {/* Audio Preview Box (if available for this part) */}
            {activeAudio && (
              <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-950 text-purple-300 flex items-center justify-center text-xl border border-purple-800 shrink-0">
                    🔊
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{activeAudio.name}</h4>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Durasi Audio: {audioDuration ? `${audioDuration.toFixed(1)}s (${formatMinute(audioDuration)})` : 'Loading...'}
                    </span>
                  </div>
                </div>

                <audio src={activeAudio.url} controls className="h-8 w-60 accent-purple-500" />
              </div>
            )}

            {/* Transcript Timeline Toolbar */}
            {activeTranscriptData && activeTranscriptData.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-950 p-3 rounded-2xl border border-gray-800">
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="🔍 Cari kata / ucapan..."
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {audioDuration && (
                    <button
                      onClick={handleFixTailGap}
                      className="px-3 py-1.5 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                      title="Perpanjang end_seconds item terakhir agar sesuai total durasi audio"
                    >
                      <span>🛠️</span> Fix Tail Gap ({audioDuration.toFixed(1)}s)
                    </button>
                  )}

                  <button
                    onClick={handleCopyJson}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <span>📋</span> Copy JSON
                  </button>
                </div>
              </div>
            )}

            {/* Timeline Entries Table */}
            {filteredEntries.length > 0 ? (
              <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-inner">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-gray-900 border-b border-gray-800 text-[10px] uppercase font-mono text-gray-400 font-bold">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4 w-32">Timestamp</th>
                        <th className="py-3 px-4 w-28">Durasi (Sec)</th>
                        <th className="py-3 px-4">Teks Ucapan Narasi</th>
                        <th className="py-3 px-4 w-24">Speaker</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-850">
                      {filteredEntries.map((entry) => {
                        const durationSec = (entry.end_seconds - entry.start_seconds).toFixed(1);
                        return (
                          <tr key={entry.id} className="hover:bg-purple-950/20 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-gray-500 text-center">
                              {entry.id}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-purple-300">
                              {entry.timestamp_minute}
                            </td>
                            <td className="py-3 px-4 font-mono text-gray-400 text-[11px]">
                              {entry.start_seconds.toFixed(1)}s ➔ {entry.end_seconds.toFixed(1)}s
                              <span className="text-[10px] text-gray-600 block">({durationSec}s)</span>
                            </td>
                            <td className="py-3 px-4 text-white font-medium leading-relaxed">
                              {entry.text}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800 text-[10px] font-mono text-gray-400">
                                {entry.speaker || 'Narator'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center bg-gray-950 border border-dashed border-gray-850 rounded-2xl space-y-3">
                <div className="w-16 h-16 bg-purple-950 text-purple-400 rounded-2xl flex items-center justify-center text-3xl mx-auto border border-purple-900 shadow-xl">
                  📝
                </div>
                <h3 className="text-sm font-bold text-white">Transkrip Part #{activePart} Belum Ada</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                  Salin prompt dengan menekan <strong>"Copy Transcribe Prompt"</strong>, lalu paste ke AI Audio Transcriber (seperti Google AI Studio) bersama file audio voiceover. Setelah itu paste JSON output-nya via tombol <strong>"Import JSON"</strong>.
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={() => handleCopyTranscriptPrompt(activePart)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center gap-1.5"
                  >
                    <span>📋</span> Copy Prompt Part #{activePart}
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs rounded-xl border border-gray-700 transition-all flex items-center gap-1.5"
                  >
                    <span>📥</span> Import JSON
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

export default AlurfilmTranscriptPlaceholder;
