// dashboard/src/components/longform/AlurfilmAudioStep.tsx
import React, { useState, useEffect } from 'react';
import type { AlurfilmChunk, AlurfilmAudioResult } from '../../electron-api';

const api = window.electronAPI;

const AlurfilmAudioStep: React.FC = () => {
  const [contentId, setContentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [audioList, setAudioList] = useState<AlurfilmAudioResult[]>([]);
  const [selectedParts, setSelectedParts] = useState<number[]>([]);
  const [activePart, setActivePart] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
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

        if (chunkList && chunkList.length > 0) {
          setActivePart(chunkList[0].part);
          // Default select all available parts or part 1
          setSelectedParts(chunkList.map(c => c.part));
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
    if (selectedParts.length === 0) {
      showToast('⚠️ Silakan pilih minimal 1 Part Video Split!');
      return;
    }

    setError(null);
    try {
      const selected = await api.selectAudio();
      if (!selected) return;

      setUploading(true);
      const res = await api.uploadAlurfilmAudio(contentId || 'default', selectedParts, selected.path);
      
      const updatedList = await api.listAlurfilmAudios(contentId || 'default');
      setAudioList(updatedList || []);
      showToast(`🎉 Uploaded Voiceover Audio untuk Part #${selectedParts.join(', #')} (${res.name})!`);
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
      showToast('🗑️ Audio file deleted.');
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
            Upload & preview voiceover audio narration (single file or multi-part) for Video Chunks.
          </p>
        </div>
      </div>

      {/* Main Grid Workspace with Side Parts List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5 flex-1 min-h-0 overflow-hidden">
        {/* SIDE COLUMN: Vertical Parts Selector (Col 2) */}
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
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold font-mono transition-all flex flex-col gap-1 border ${
                      isActive
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                        : isDone
                        ? 'bg-purple-950/40 border-purple-800/60 text-purple-300 hover:bg-purple-900/50'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>Part #{chunk.part}</span>
                      <span className="text-xs">{isDone ? '✓' : '○'}</span>
                    </div>
                    {assignedAudio && (
                      <span className="text-[9px] text-purple-300/80 font-normal truncate">
                        Audio Parts #{assignedAudio.parts.join(', #')}
                      </span>
                    )}
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

        {/* CENTER PANEL: Target Split Selector & Voiceover Controls (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🎙️</span> Part #{activePart} Voiceover Audio
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Pilih target split parts terlebih dahulu, lalu upload file VO (.mp3 / .wav).
              </p>
            </div>
          </div>

          {/* TARGET SPLIT PARTS SELECTOR */}
          <div className="bg-gray-950/80 p-4 rounded-xl border border-gray-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <span>🎯</span> Target Split Parts untuk Audio ini:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedParts(chunks.map(c => c.part))}
                  className="text-[10px] text-purple-400 hover:underline font-bold"
                >
                  Pilih Semua ({chunks.length})
                </button>
                <span className="text-gray-700">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedParts([])}
                  className="text-[10px] text-gray-500 hover:underline font-bold"
                >
                  Bersihkan
                </button>
              </div>
            </div>

            {chunks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {chunks.map(chunk => {
                  const isSelected = selectedParts.includes(chunk.part);
                  return (
                    <button
                      key={chunk.part}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedParts(selectedParts.filter(p => p !== chunk.part));
                        } else {
                          setSelectedParts([...selectedParts, chunk.part].sort((a, b) => a - b));
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                      }`}
                    >
                      <span>{isSelected ? '☑' : '☐'}</span>
                      <span>Part #{chunk.part}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-amber-400">Belum ada video split part tersedia.</p>
            )}
          </div>

          {/* UPLOAD BUTTON ACTION */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleUploadVoiceover}
              disabled={uploading || selectedParts.length === 0}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
                selectedParts.length === 0
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
              }`}
            >
              <span>📁</span>
              <span>
                {uploading
                  ? 'Uploading Audio...'
                  : selectedParts.length === 0
                  ? 'Pilih minimal 1 Part Split'
                  : `Upload Audio untuk Part #${selectedParts.join(', #')}`}
              </span>
            </button>
          </div>

          {/* AUDIO PLAYER & COVERED PARTS CARD */}
          {currentAudio ? (
            <div className="bg-gray-950 p-5 rounded-xl border border-purple-900/50 space-y-4 shadow-inner">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="p-3 bg-purple-600/20 text-purple-400 rounded-xl text-xl border border-purple-500/30 shrink-0">🎙️</span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white font-mono truncate">{currentAudio.name}</h4>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-gray-400 font-mono">Mencakup:</span>
                      {currentAudio.parts && currentAudio.parts.map(p => (
                        <span key={p} className="px-2 py-0.5 bg-purple-900/60 border border-purple-700 text-purple-200 text-[10px] font-mono rounded font-bold">
                          Part #{p}
                        </span>
                      ))}
                    </div>
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
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-gray-800 rounded-2xl space-y-2.5">
              <div className="w-10 h-10 bg-gray-900 text-gray-600 rounded-xl flex items-center justify-center text-lg">
                🎙️
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-400">Belum Ada Audio untuk Part #{activePart}</h4>
                <p className="text-[11px] text-gray-500 mt-0.5 max-w-xs">
                  Pilih part target di atas lalu klik button upload untuk menetapkan audio.
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

