// dashboard/src/components/shorts/ShortsSourceStep.tsx
import React, { useState, useEffect, useRef } from 'react';

export interface VideoSourceItem {
  id: string;
  title: string;
  youtube_url: string;
  video_filename?: string;
  video_path?: string;
  status: 'idle' | 'downloading' | 'downloaded' | 'error';
  file_size_bytes?: number;
  downloaded_at?: string;
  error?: string;
  progressPercentage?: number;
  progressSpeed?: string;
}

interface VideoSourcesJSON {
  updated_at: string;
  items: VideoSourceItem[];
}

const ShortsSourceStep: React.FC = () => {
  const [cards, setCards] = useState<VideoSourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Keep cards ref up to date for event listener callbacks
  const cardsRef = useRef<VideoSourceItem[]>(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  // Load existing cards from input/shorts/video-sources.json on mount
  useEffect(() => {
    const loadSources = async () => {
      setIsLoading(true);
      try {
        if (window.electronAPI?.readFromProject) {
          const raw = await window.electronAPI.readFromProject('input/shorts/video-sources.json');
          if (raw) {
            const data: VideoSourcesJSON = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (data.items && Array.isArray(data.items) && data.items.length > 0) {
              setCards(data.items);
              setIsLoading(false);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load input/shorts/video-sources.json:', err);
      }

      // Default: Start with 1 blank card if no file exists
      setCards([
        {
          id: `vid_${Date.now()}_1`,
          title: '',
          youtube_url: '',
          status: 'idle',
        },
      ]);
      setIsLoading(false);
    };

    loadSources();
  }, []);

  // Listen for real-time yt-dlp progress events from Electron IPC
  useEffect(() => {
    if (!window.electronAPI?.onShortsDownloadProgress) return;

    const cleanup = window.electronAPI.onShortsDownloadProgress((progressData: any) => {
      const { keywordId, percentage, speed } = progressData;
      setCards((prevCards) =>
        prevCards.map((card) => {
          if (card.id === keywordId) {
            return {
              ...card,
              status: 'downloading',
              progressPercentage: Math.min(100, Math.max(0, percentage || 0)),
              progressSpeed: speed || '',
            };
          }
          return card;
        })
      );
    });

    return () => {
      if (cleanup && typeof cleanup === 'function') cleanup();
    };
  }, []);

  // Save current cards list to input/shorts/video-sources.json
  const persistCards = async (updatedCards: VideoSourceItem[]) => {
    if (!window.electronAPI?.saveToProject) return;
    try {
      const payload: VideoSourcesJSON = {
        updated_at: new Date().toISOString(),
        items: updatedCards.map((c) => ({
          id: c.id,
          title: c.title,
          youtube_url: c.youtube_url,
          video_filename: c.video_filename,
          video_path: c.video_path,
          status: c.status,
          file_size_bytes: c.file_size_bytes,
          downloaded_at: c.downloaded_at,
          error: c.error,
        })),
      };
      await window.electronAPI.saveToProject(
        'input/shorts/video-sources.json',
        JSON.stringify(payload, null, 2)
      );
    } catch (err) {
      console.error('Failed to save to input/shorts/video-sources.json:', err);
    }
  };

  // Add new dynamic card
  const handleAddCard = () => {
    const newCard: VideoSourceItem = {
      id: `vid_${Date.now()}_${cards.length + 1}`,
      title: '',
      youtube_url: '',
      status: 'idle',
    };
    const updated = [...cards, newCard];
    setCards(updated);
    persistCards(updated);
  };

  // Delete card
  const handleDeleteCard = (id: string) => {
    const updated = cards.filter((c) => c.id !== id);
    setCards(updated);
    persistCards(updated);
  };

  // Update card field (title / youtube_url)
  const handleFieldChange = (id: string, field: 'title' | 'youtube_url', value: string) => {
    const updated = cards.map((c) => {
      if (c.id === id) {
        return { ...c, [field]: value };
      }
      return c;
    });
    setCards(updated);
    persistCards(updated);
  };

  // Single card download handler
  const handleDownloadSingle = async (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card || !card.youtube_url.trim()) {
      setGlobalError('Harap isi Link YouTube terlebih dahulu.');
      return;
    }

    setGlobalError(null);

    // Update state to downloading
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, status: 'downloading', progressPercentage: 0, error: undefined }
          : c
      )
    );

    try {
      if (!window.electronAPI?.downloadShortsVideo) {
        throw new Error('Electron API downloadShortsVideo tidak tersedia.');
      }

      const res = await window.electronAPI.downloadShortsVideo({
        keywordId: card.id,
        subNiche: card.title || 'shorts_video',
        keyword: card.title || 'youtube_source',
        youtubeUrl: card.youtube_url.trim(),
      });

      if (res && res.success) {
        const now = new Date().toISOString();
        setCards((prev) => {
          const updated = prev.map((c) => {
            if (c.id === cardId) {
              return {
                ...c,
                status: 'downloaded' as const,
                video_path: res.videoPath,
                video_filename: res.videoPath ? res.videoPath.split('/').pop() : undefined,
                file_size_bytes: res.fileSizeBytes,
                downloaded_at: now,
                progressPercentage: 100,
                error: undefined,
              };
            }
            return c;
          });
          persistCards(updated);
          return updated;
        });
      } else {
        const errMsg = res?.error || 'Gagal mengunduh video dari YouTube.';
        setCards((prev) => {
          const updated = prev.map((c) =>
            c.id === cardId ? { ...c, status: 'error' as const, error: errMsg } : c
          );
          persistCards(updated);
          return updated;
        });
      }
    } catch (err: any) {
      console.error('Download error:', err);
      const errMsg = err.message || 'Terjadi kesalahan sistem saat mendownload.';
      setCards((prev) => {
        const updated = prev.map((c) =>
          c.id === cardId ? { ...c, status: 'error' as const, error: errMsg } : c
        );
        persistCards(updated);
        return updated;
      });
    }
  };

  // Download all pending cards sequentially
  const handleDownloadAll = async () => {
    const pending = cards.filter(
      (c) => c.youtube_url.trim() !== '' && c.status !== 'downloaded'
    );
    if (pending.length === 0) {
      setGlobalError('Tidak ada video pending dengan link YouTube untuk diunduh.');
      return;
    }

    setIsBatchDownloading(true);
    setGlobalError(null);

    for (const card of pending) {
      await handleDownloadSingle(card.id);
    }

    setIsBatchDownloading(false);
  };

  // Format media URL for Electron HTML5 <video> preview player
  const getMediaUrl = (filePath?: string): string => {
    if (!filePath) return '';
    if (filePath.startsWith('media://') || filePath.startsWith('http://') || filePath.startsWith('blob:')) {
      return filePath;
    }
    if (window.electronAPI?.getMediaUrl) {
      return window.electronAPI.getMediaUrl(filePath);
    }
    return `media://content-auto/${encodeURIComponent(filePath)}`;
  };

  // Format file size in B, KB, MB, GB
  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes <= 0) return '0 MB';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const totalBytesDownloaded = cards.reduce((acc, c) => acc + (c.file_size_bytes || 0), 0);
  const downloadedCount = cards.filter((c) => c.status === 'downloaded').length;

  return (
    <div className="p-6 bg-gray-950/90 border border-gray-800 rounded-3xl min-h-full space-y-8 text-gray-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800/80 pb-5 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center text-2xl border border-amber-500/20 shadow-lg shadow-amber-950/40">
            📥
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
              Step 1: Shorts Video Downloader
              <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 text-xs font-mono font-semibold">
                Dynamic Cards (1080p/720p HD)
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Input link YouTube secara dinamis, unduh video mentahan HD (*1080p/720p*), dan preview hasil download.
            </p>
          </div>
        </div>

        {/* Global Action Badges */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-xl text-xs font-mono flex items-center gap-2">
            <span className="text-gray-400">Total Cards:</span>
            <span className="text-amber-400 font-bold">{cards.length}</span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">Downloaded:</span>
            <span className="text-emerald-400 font-bold">{downloadedCount}</span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">Total Size:</span>
            <span className="text-cyan-400 font-bold">{formatFileSize(totalBytesDownloaded)}</span>
          </div>

          <button
            onClick={handleDownloadAll}
            disabled={isBatchDownloading || cards.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isBatchDownloading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-gray-950 border-t-transparent rounded-full animate-spin"></div>
                <span>Downloading Batch...</span>
              </>
            ) : (
              <>
                <span>📥</span>
                <span>Download Semua Pending</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {globalError && (
        <div className="p-4 bg-red-950/80 border border-red-800/80 rounded-2xl text-red-200 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚠️</span>
            <span>{globalError}</span>
          </div>
          <button
            onClick={() => setGlobalError(null)}
            className="text-red-400 hover:text-red-200 text-xs font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-gray-400 font-mono">Memuat daftar video...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Dynamic Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {cards.map((card, index) => {
              const isDownloading = card.status === 'downloading';
              const isDownloaded = card.status === 'downloaded';
              const isError = card.status === 'error';
              const mediaUrl = isDownloaded ? getMediaUrl(card.video_path) : '';
              const formattedSize = formatFileSize(card.file_size_bytes);

              return (
                <div
                  key={card.id}
                  className={`bg-gray-900/70 border ${
                    isDownloaded
                      ? 'border-emerald-500/40 hover:border-emerald-500/60'
                      : isDownloading
                      ? 'border-amber-500/60 shadow-amber-950/20'
                      : isError
                      ? 'border-red-500/50'
                      : 'border-gray-800 hover:border-gray-700'
                  } p-5 rounded-2xl space-y-4 transition-all shadow-md flex flex-col justify-between`}
                >
                  <div className="space-y-4">
                    {/* Card Top Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-gray-800/60">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🎬</span>
                        <span className="text-xs font-bold text-amber-400 font-mono">
                          Video #{index + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Status & Size Badges */}
                        {isDownloaded && (
                          <>
                            <span className="px-2.5 py-0.5 bg-emerald-950/90 text-emerald-400 border border-emerald-800/80 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1">
                              <span>✅</span> Downloaded
                            </span>
                            <span className="px-2 py-0.5 bg-cyan-950/90 text-cyan-300 border border-cyan-800/80 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1">
                              <span>💾</span> {formattedSize}
                            </span>
                          </>
                        )}
                        {isDownloading && (
                          <span className="px-2.5 py-0.5 bg-amber-950/90 text-amber-300 border border-amber-800/80 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                            Downloading...
                          </span>
                        )}
                        {isError && (
                          <span className="px-2.5 py-0.5 bg-red-950/90 text-red-300 border border-red-800/80 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1">
                            <span>⚠️</span> Error
                          </span>
                        )}
                        {!isDownloaded && !isDownloading && !isError && (
                          <span className="px-2.5 py-0.5 bg-gray-800 text-gray-400 border border-gray-700 rounded-full text-[10px] font-mono">
                            Ready
                          </span>
                        )}

                        {/* Delete Card Button */}
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          disabled={isDownloading}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-all disabled:opacity-30"
                          title="Hapus Card"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Link YouTube Video
                        </label>
                        <input
                          type="text"
                          placeholder="https://www.youtube.com/watch?v=... atau https://youtu.be/..."
                          value={card.youtube_url}
                          onChange={(e) =>
                            handleFieldChange(card.id, 'youtube_url', e.target.value)
                          }
                          disabled={isDownloading}
                          className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-amber-500 transition-all placeholder:text-gray-600 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Judul / Keterangan (Opsional)
                        </label>
                        <input
                          type="text"
                          placeholder="Contoh: Factory Process / Woodworking Clips"
                          value={card.title}
                          onChange={(e) => handleFieldChange(card.id, 'title', e.target.value)}
                          disabled={isDownloading}
                          className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-amber-500 transition-all placeholder:text-gray-600"
                        />
                      </div>
                    </div>

                    {/* Download Progress Bar */}
                    {isDownloading && (
                      <div className="bg-gray-950 p-3 rounded-xl border border-amber-500/30 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-amber-300 font-bold">
                            Downloading: {card.progressPercentage || 0}%
                          </span>
                          {card.progressSpeed && (
                            <span className="text-gray-400 text-[10px]">
                              {card.progressSpeed}
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-200"
                            style={{ width: `${card.progressPercentage || 0}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Error Banner on Card */}
                    {isError && card.error && (
                      <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-300 text-xs font-mono">
                        <p className="line-clamp-2">Error: {card.error}</p>
                      </div>
                    )}

                    {/* Downloaded Video Preview Player */}
                    {isDownloaded && mediaUrl && (
                      <div className="bg-black/90 p-3 rounded-xl border border-emerald-800/60 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                          <span className="truncate max-w-[180px] text-emerald-300">
                            📹 {card.video_filename || 'video.mp4'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-purple-300 bg-purple-950/90 px-2 py-0.5 rounded border border-purple-800/60 font-bold">
                              ✨ 1080p HD
                            </span>
                            <span className="text-cyan-300 bg-cyan-950/90 px-2 py-0.5 rounded border border-cyan-800/60 font-bold">
                              💾 {formattedSize}
                            </span>
                          </div>
                        </div>
                        <video
                          src={mediaUrl}
                          controls
                          className="w-full rounded-lg max-h-48 bg-black object-contain border border-gray-800"
                        />
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="pt-3 border-t border-gray-800/60 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-gray-500 font-mono">
                      {isDownloaded && card.downloaded_at
                        ? `Downloaded: ${new Date(card.downloaded_at).toLocaleTimeString('id-ID')}`
                        : 'Ready to download'}
                    </span>

                    <button
                      onClick={() => handleDownloadSingle(card.id)}
                      disabled={isDownloading || !card.youtube_url.trim()}
                      className={`px-4 py-2 font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 ${
                        isDownloaded
                          ? 'bg-gray-800 hover:bg-gray-700 text-amber-300 border border-amber-500/30'
                          : 'bg-amber-600 hover:bg-amber-500 text-gray-950 shadow-amber-600/20'
                      } disabled:opacity-40`}
                    >
                      {isDownloading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          <span>Downloading...</span>
                        </>
                      ) : isDownloaded ? (
                        <>
                          <span>🔄</span>
                          <span>Download Ulang</span>
                        </>
                      ) : (
                        <>
                          <span>📥</span>
                          <span>Download Video</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add New Card Button */}
          <div className="pt-2">
            <button
              onClick={handleAddCard}
              className="w-full py-4 border-2 border-dashed border-gray-800 hover:border-amber-500/50 hover:bg-amber-500/5 text-gray-300 hover:text-amber-400 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 group"
            >
              <span className="text-base group-hover:scale-110 transition-transform">➕</span>
              <span>Tambah Card / Video YouTube Lainnya</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer Info & Storage Path Consistency */}
      <div className="border-t border-gray-800/80 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
        <div className="flex items-center gap-2 font-mono">
          <span>📂 Output MP4:</span>
          <code className="text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
            input/shorts/raw_videos/
          </code>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span>📄 Persistence:</span>
          <code className="text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
            input/shorts/video-sources.json
          </code>
        </div>
      </div>
    </div>
  );
};

export default ShortsSourceStep;
