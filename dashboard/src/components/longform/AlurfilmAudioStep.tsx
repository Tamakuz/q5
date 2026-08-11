// dashboard/src/components/longform/AlurfilmAudioStep.tsx
import React, { useState, useEffect } from 'react';
import type { AlurfilmChunk, AlurfilmAudioResult, AlurfilmAnalysisResult } from '../../electron-api';
import { GoogleAiStudioTtsPreset } from '../common/GoogleAiStudioTtsPreset';
import { parseScriptSegments, convertToGeminiTtsScript } from '../../../../lib/alurfilm/script-parser';

const api = window.electronAPI;

const AlurfilmAudioStep: React.FC = () => {
  const [contentId, setContentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [audioList, setAudioList] = useState<AlurfilmAudioResult[]>([]);
  const [analyses, setAnalyses] = useState<Record<number, AlurfilmAnalysisResult>>({});
  const [activePart, setActivePart] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [isSplicing, setIsSplicing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

        const list = await api.listAlurfilmAudios(id);
        setAudioList(list || []);

        const analysisList = await api.listAlurfilmAnalyses(id);
        const map: Record<number, AlurfilmAnalysisResult> = {};
        if (analysisList) {
          for (const item of analysisList) {
            if (item.data && item.data.chunk_part) {
              map[item.data.chunk_part] = item;
            } else if (item.part) {
              map[item.part] = item;
            }
          }
        }
        setAnalyses(map);

        if (chunkList && chunkList.length > 0) {
          setActivePart(chunkList[0].part);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load audio files');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUploadVoiceover = async () => {
    setError(null);
    try {
      const selected = await api.selectAudio();
      if (!selected) return;

      setUploading(true);
      const res = await api.uploadAlurfilmAudio(contentId || 'default', [activePart], selected.path);
      
      const updatedList = await api.listAlurfilmAudios(contentId || 'default');
      setAudioList(updatedList || []);
      showToast(`🎉 Uploaded Voiceover Audio untuk Part #${activePart} (${res.name})!`);
    } catch (err: any) {
      setError(`Failed to upload audio: ${err.message}`);
    }
    setUploading(false);
  };

  const handleDeleteAudio = async (audioId?: string) => {
    if (!audioId) return;
    try {
      await api.deleteAlurfilmAudio(audioId);
      const updatedList = await api.listAlurfilmAudios(contentId || 'default');
      setAudioList(updatedList || []);
      showToast(`🗑️ Audio file Part #${activePart} berhasil dihapus.`);
    } catch (err: any) {
      setError(`Failed to delete audio: ${err.message}`);
    }
  };

  const currentChunk = chunks.find((c) => c.part === activePart);
  const currentAudio = audioList.find((a) => a.parts && a.parts.includes(activePart));

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
            <span className="p-2 bg-purple-600/20 text-purple-400 rounded-lg text-lg">🎙️</span>
            Alur Film Voice Over Audio Studio
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Upload & preview voiceover audio narration per individu Part Video Split.
          </p>
        </div>
      </div>

      {/* Google AI Studio TTS Presets Copy-Paste Helper */}
      <GoogleAiStudioTtsPreset />

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5 flex-1 min-h-0 overflow-hidden">
        {/* SIDE COLUMN: Vertical Parts Selector (Col 3) */}
        <div className="lg:col-span-3 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800 shrink-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Parts ({chunks.length})
            </span>
            <span className="text-[10px] text-purple-400 font-mono font-bold">Audio Status</span>
          </div>

          {chunks.length > 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
              {chunks.map((chunk) => {
                const assignedAudio = audioList.find((a) => a.parts && a.parts.includes(chunk.part));
                const isDone = !!assignedAudio;
                const isActive = activePart === chunk.part;
                return (
                  <button
                    key={chunk.part}
                    onClick={() => setActivePart(chunk.part)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-between border ${
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

        {/* CENTER PANEL: Voiceover Controls & Player for Active Part (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🎙️</span> Part #{activePart} Voiceover Audio
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Upload & preview file VO (.mp3 / .wav) khusus untuk Part #{activePart}.
              </p>
            </div>
          </div>

          {/* UPLOAD BUTTON ACTION */}
          <div>
            <button
              type="button"
              onClick={handleUploadVoiceover}
              disabled={uploading}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              <span>📁</span>
              <span>
                {uploading
                  ? `Uploading Audio untuk Part #${activePart}...`
                  : `Upload Audio Voiceover untuk Part #${activePart}`}
              </span>
            </button>
          </div>

          {/* SCRIPT & VISUAL-ONLY BREAKDOWN FOR ACTIVE PART */}
          {(() => {
            const activeAnalysis = analyses[activePart];
            const rawScript = activeAnalysis?.data?.naskah_voiceover?.script_text || '';
            if (!rawScript) return null;
            const parsed = parseScriptSegments(rawScript);
            return (
              <div className="p-3.5 bg-gray-950/80 border border-purple-900/40 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <span>📜</span> Naskah & Visual-Only Part #{activePart}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const ttsScript = convertToGeminiTtsScript(rawScript);
                      if (api.copyToClipboard) {
                        api.copyToClipboard(ttsScript);
                        showToast(`🎙️ Copied Gemini TTS Script (<break time="..."/>) Part #${activePart}!`);
                      }
                    }}
                    className="px-2.5 py-1 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-700/60 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                    title="Copy naskah dengan tag <break time='...s'/> untuk AI Studio"
                  >
                    <span>⚡</span> Copy Gemini TTS
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono bg-gray-900/60 p-2 rounded-lg">
                  <span>Narasi: <strong className="text-purple-300">{activeAnalysis?.data?.naskah_voiceover?.word_count || 0} Kata</strong></span>
                  {parsed.totalVisualOnlyCount > 0 ? (
                    <span className="text-amber-300 font-bold bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded text-[10px]">
                      🎥 {parsed.totalVisualOnlyCount} Jeda Visual ({parsed.totalVisualOnlyDuration.toFixed(1)}s Total)
                    </span>
                  ) : (
                    <span className="text-gray-500">Tanpa Jeda Visual</span>
                  )}
                </div>

                {parsed.totalVisualOnlyCount > 0 && (
                  <div className="space-y-1 pt-1 border-t border-gray-800">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                      Daftar Jeda Visual Murni:
                    </span>
                    {parsed.segments
                      .filter((s) => s.type === 'visual_only')
                      .map((seg, idx) => (
                        <div key={idx} className="p-1.5 bg-amber-950/30 border border-amber-900/40 rounded text-[10px] font-mono text-amber-300 flex items-center justify-between gap-2">
                          <span className="truncate">🎥 {seg.description}</span>
                          <span className="font-bold text-amber-400 shrink-0">⏱️ {seg.durationSeconds.toFixed(1)}s</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* AUDIO PLAYER CARD */}
          {currentAudio ? (
            <div className="bg-gray-950 p-5 rounded-xl border border-purple-900/50 space-y-4 shadow-inner">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="p-3 bg-purple-600/20 text-purple-400 rounded-xl text-xl border border-purple-500/30 shrink-0">🎙️</span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white font-mono truncate">{currentAudio.name}</h4>
                    <span className="text-[10px] text-purple-300 font-mono font-bold mt-0.5 block">
                      Target: Part #{activePart}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteAudio(currentAudio.id)}
                  className="px-2.5 py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-400 border border-red-800/60 text-[10px] font-bold rounded-lg transition-all shrink-0"
                >
                  Hapus
                </button>
              </div>

              <audio src={currentAudio.mediaUrl || currentAudio.url} controls className="w-full h-10 rounded-lg" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-gray-800 rounded-2xl space-y-2.5 min-h-[180px]">
              <div className="w-10 h-10 bg-gray-900 text-gray-600 rounded-xl flex items-center justify-center text-lg">
                🎙️
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-400">Belum Ada Audio untuk Part #{activePart}</h4>
                <p className="text-[11px] text-gray-500 mt-0.5 max-w-xs">
                  Klik tombol di atas untuk memilih file audio voiceover untuk Part #{activePart}.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Synced Video Chunk Preview (Col 4) */}
        <div className="lg:col-span-4 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white pb-3 border-b border-gray-800 flex items-center gap-2">
            <span>📹</span> Part #{activePart} Video Preview
          </h3>

          <div className="flex-1 bg-black rounded-xl overflow-hidden border border-gray-800 flex items-center justify-center relative min-h-[260px]">
            {currentChunk ? (
              <video
                key={currentChunk.mediaUrl || currentChunk.url}
                src={currentChunk.mediaUrl || currentChunk.url}
                controls
                className="w-full h-full object-contain max-h-[360px]"
              />
            ) : (
              <div className="text-center p-8 space-y-2">
                <span className="text-3xl">📹</span>
                <p className="text-xs text-gray-400">No video chunk file loaded for Part #{activePart}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlurfilmAudioStep;
