// dashboard/src/components/longform/AlurfilmAudioStep.tsx
import React, { useState, useEffect } from 'react';
import type { AlurfilmChunk, AlurfilmAudioResult } from '../../electron-api';

const api = window.electronAPI;

const AlurfilmAudioStep: React.FC = () => {
  const [contentId, setContentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [audios, setAudios] = useState<Record<number, AlurfilmAudioResult>>({});
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

        const audioList = await api.listAlurfilmAudios(id);
        const map: Record<number, AlurfilmAudioResult> = {};
        if (audioList) {
          for (const item of audioList) {
            map[item.part] = item;
          }
        }
        setAudios(map);

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

  const handleUploadVoiceoverForPart = async (partNum: number) => {
    setError(null);
    try {
      const selected = await api.selectAudio();
      if (!selected) return;

      setUploading(true);
      const res = await api.uploadAlurfilmAudio(contentId || 'default', partNum, selected.path);
      setAudios((prev) => ({ ...prev, [partNum]: res }));
      showToast(`🎉 Uploaded Voiceover for Part #${partNum} (${res.name})!`);
    } catch (err: any) {
      setError(`Failed to upload audio: ${err.message}`);
    }
    setUploading(false);
  };

  const currentChunk = chunks.find((c) => c.part === activePart);
  const currentAudio = audios[activePart];

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
            Upload & preview voiceover audio narration alongside Video Chunk Part #{activePart}.
          </p>
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
            <span className="text-[10px] text-purple-400 font-mono font-bold">Audio</span>
          </div>

          {chunks.length > 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
              {chunks.map((chunk) => {
                const isDone = !!audios[chunk.part];
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

        {/* CENTER PANEL: Voiceover Upload & Controls (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🎙️</span> Part #{activePart} Voiceover Audio
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Upload MP3/WAV voiceover file for scene Part #{activePart}.
              </p>
            </div>

            <button
              onClick={() => handleUploadVoiceoverForPart(activePart)}
              disabled={uploading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-1.5 shrink-0"
            >
              <span>📁</span>
              <span>{uploading ? 'Uploading...' : currentAudio ? 'Replace Audio File' : 'Upload Audio File'}</span>
            </button>
          </div>

          {currentAudio ? (
            <div className="bg-gray-950 p-6 rounded-xl border border-purple-900/50 space-y-4 shadow-inner">
              <div className="flex items-center gap-3">
                <span className="p-3.5 bg-purple-600/20 text-purple-400 rounded-xl text-2xl border border-purple-500/30">🎙️</span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white font-mono truncate">{currentAudio.name}</h4>
                  <p className="text-[11px] text-purple-400 font-mono mt-0.5">Part #{currentAudio.part} Voiceover File Ready</p>
                </div>
              </div>

              <audio src={currentAudio.mediaUrl || currentAudio.url} controls className="w-full h-10 rounded-lg" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-800 rounded-2xl space-y-3">
              <div className="w-12 h-12 bg-gray-900 text-gray-600 rounded-xl flex items-center justify-center text-xl">
                🎙️
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-400">Belum Ada Voiceover Audio Part #{activePart}</h4>
                <p className="text-[11px] text-gray-500 mt-1 max-w-xs">
                  Upload file audio voiceover (.mp3 / .wav) untuk scene Part #{activePart}.
                </p>
              </div>
              <button
                onClick={() => handleUploadVoiceoverForPart(activePart)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition-all"
              >
                Upload Audio Voiceover
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Synced Video Chunk Preview (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white pb-3 border-b border-gray-800 flex items-center gap-2">
            <span>📹</span> Part #{activePart} Synced Video Chunk Preview
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
