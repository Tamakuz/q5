// dashboard/src/components/common/MediaPreviewDrawer.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { AlurfilmChunk, AlurfilmAudioResult, RenderFileInfo } from '../../electron-api';

const api = window.electronAPI;

interface MediaPreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialPart?: number;
  initialMediaType?: 'video' | 'audio' | 'render';
}

const MediaPreviewDrawer: React.FC<MediaPreviewDrawerProps> = ({
  isOpen,
  onClose,
  initialPart = 1,
  initialMediaType = 'video',
}) => {
  const [contentId, setContentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [audios, setAudios] = useState<Record<number, AlurfilmAudioResult>>({});
  const [renders, setRenders] = useState<RenderFileInfo[]>([]);

  const [activePart, setActivePart] = useState<number>(initialPart);
  const [mediaType, setMediaType] = useState<'video' | 'audio' | 'render'>(initialMediaType);
  const [selectedRenderUrl, setSelectedRenderUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (isOpen) {
      (async () => {
        try {
          const id = await api.getContentId('longform');
          setContentId(id);
          if (id) {
            const chunkList = await api.listAlurfilmChunks(id);
            setChunks(chunkList || []);

            const audioList = await api.listAlurfilmAudios(id);
            const aMap: Record<number, AlurfilmAudioResult> = {};
            if (audioList) {
              for (const a of audioList) aMap[a.part] = a;
            }
            setAudios(aMap);
          }

          const renderList = await api.listRenders();
          setRenders(renderList || []);
          if (renderList && renderList.length > 0) {
            setSelectedRenderUrl(renderList[0].url || `media://content-auto/${encodeURIComponent(renderList[0].fullPath)}`);
          }
        } catch (err) {
          console.error('Error loading media preview data:', err);
        }
      })();
    }
  }, [isOpen]);

  useEffect(() => {
    setActivePart(initialPart);
    setMediaType(initialMediaType);
  }, [initialPart, initialMediaType]);

  if (!isOpen) return null;

  const currentChunk = chunks.find((c) => c.part === activePart);
  const currentAudio = audios[activePart];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex justify-end animate-fadeIn">
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Container */}
      <div className="w-full max-w-2xl bg-gray-950 border-l border-gray-800 flex flex-col h-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-gray-900/80">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-purple-600/20 text-purple-400 rounded-xl text-xl">🎬</span>
            <div>
              <h2 className="text-base font-bold text-white">Media Preview Center</h2>
              <p className="text-xs text-gray-400">Play video chunks, voiceovers, or rendered output</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-all text-sm"
          >
            ✕
          </button>
        </div>

        {/* Media Category Tabs */}
        <div className="px-5 py-3 border-b border-gray-800/80 bg-gray-900/40 flex items-center gap-2">
          <button
            onClick={() => setMediaType('video')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              mediaType === 'video'
                ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/30'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>📹</span> Video Chunk ({chunks.length})
          </button>
          <button
            onClick={() => setMediaType('audio')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              mediaType === 'audio'
                ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/30'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>🎙️</span> Voiceover Audio ({Object.keys(audios).length})
          </button>
          <button
            onClick={() => setMediaType('render')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              mediaType === 'render'
                ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/30'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>🎞️</span> Rendered Output ({renders.length})
          </button>
        </div>

        {/* Part Selector (for video chunk & voiceover) */}
        {mediaType !== 'render' && chunks.length > 0 && (
          <div className="px-5 py-2.5 border-b border-gray-800/60 bg-gray-950 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] text-gray-500 font-mono font-bold shrink-0 uppercase">Select Part:</span>
            {chunks.map((c) => (
              <button
                key={c.part}
                onClick={() => setActivePart(c.part)}
                className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition-all shrink-0 border ${
                  activePart === c.part
                    ? 'bg-purple-600 border-purple-500 text-white shadow-sm'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                P#{c.part}
              </button>
            ))}
          </div>
        )}

        {/* Player Screen Area */}
        <div className="p-5 flex-1 flex flex-col justify-center items-center bg-black/80 min-h-0 relative">
          {mediaType === 'video' ? (
            currentChunk ? (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <video
                  key={`chunk-${activePart}-${currentChunk.mediaUrl || currentChunk.url}`}
                  ref={videoRef}
                  src={currentChunk.mediaUrl || currentChunk.url}
                  controls
                  autoPlay
                  className="max-h-[380px] w-full object-contain rounded-xl border border-gray-800 shadow-2xl"
                />
                <div className="mt-3 text-center">
                  <h3 className="text-xs font-bold text-white font-mono">{currentChunk.name}</h3>
                  <p className="text-[11px] text-purple-400 font-mono mt-0.5">Part #{currentChunk.part} Video Chunk</p>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 space-y-2">
                <div className="w-12 h-12 bg-gray-900 text-gray-600 rounded-xl flex items-center justify-center text-xl mx-auto">
                  📹
                </div>
                <p className="text-xs text-gray-400">No Video Chunk found for Part #{activePart}</p>
              </div>
            )
          ) : mediaType === 'audio' ? (
            currentAudio ? (
              <div className="w-full max-w-md bg-gray-900 p-6 rounded-2xl border border-purple-900/50 shadow-2xl space-y-4">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-purple-600/20 text-purple-400 rounded-2xl text-2xl border border-purple-500/30">
                    🎙️
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono">{currentAudio.name}</h3>
                    <p className="text-xs text-purple-400 font-mono mt-0.5">Part #{currentAudio.part} Voiceover Audio</p>
                  </div>
                </div>

                <audio
                  key={`audio-${activePart}-${currentAudio.mediaUrl || currentAudio.url}`}
                  ref={audioRef}
                  src={currentAudio.mediaUrl || currentAudio.url}
                  controls
                  autoPlay
                  className="w-full h-10 rounded-lg"
                />
              </div>
            ) : (
              <div className="text-center p-8 space-y-2">
                <div className="w-12 h-12 bg-gray-900 text-gray-600 rounded-xl flex items-center justify-center text-xl mx-auto">
                  🎙️
                </div>
                <p className="text-xs text-gray-400">No Voiceover Audio uploaded for Part #{activePart}</p>
              </div>
            )
          ) : (
            renders.length > 0 && selectedRenderUrl ? (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <video
                  key={`render-${selectedRenderUrl}`}
                  src={selectedRenderUrl}
                  controls
                  autoPlay
                  className="max-h-[380px] w-full object-contain rounded-xl border border-gray-800 shadow-2xl"
                />
                <div className="mt-3 flex items-center gap-2 overflow-x-auto max-w-full">
                  {renders.map((r) => {
                    const rUrl = r.url || `media://content-auto/${encodeURIComponent(r.fullPath)}`;
                    const isSelected = selectedRenderUrl === rUrl;
                    return (
                      <button
                        key={r.fullPath}
                        onClick={() => setSelectedRenderUrl(rUrl)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-mono font-bold transition-all shrink-0 border ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        🎬 {r.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center p-8 space-y-2">
                <div className="w-12 h-12 bg-gray-900 text-gray-600 rounded-xl flex items-center justify-center text-xl mx-auto">
                  🎞️
                </div>
                <p className="text-xs text-gray-400">No rendered videos found yet</p>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/80 flex items-center justify-between text-xs text-gray-400">
          <span>Active Content ID: <strong className="text-purple-400 font-mono">{contentId || 'Default'}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-all"
          >
            Tutup Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaPreviewDrawer;
