// dashboard/src/components/shorts/ShortsAnalyzeStep.tsx
import React, { useState, useEffect } from 'react';

interface GeneratedKeyword {
  id: string;
  sub_niche: string;
  keyword: string;
  youtube_search_url: string;
  target_market: string;
  used_at: string;
  expires_at: string;
}

interface KeywordsHistoryData {
  cooldown_days: number;
  history: GeneratedKeyword[];
}

interface VideoSourceItem {
  keyword_id: string;
  sub_niche: string;
  keyword: string;
  youtube_url: string;
  video_filename: string;
  video_path: string;
  status: 'downloaded' | 'failed' | 'pending';
  downloaded_at: string;
  file_size_bytes: number;
  script_text?: string;
}

interface VideoSourcesData {
  items: VideoSourceItem[];
}

const SUB_NICHE_ICONS: Record<string, string> = {
  'Mass Food Production': '🍕',
  'Industrial Manufacturing': '⚙️',
  'Master Crafting & Rare Processing': '🔪',
  'Woodworking & Resin Crafting': '🪵',
};

/**
 * Builds a high-converting, viral storytelling AI Prompt in English.
 * Formatted for YouTube Shorts with curiosity-gap hook (0-3s), cozy pacing,
 * and clear retention structure.
 */
const buildEngagingNarrationPrompt = (subNiche: string, keyword: string) => {
  return `You are a world-class viral YouTube Shorts scriptwriter specializing in high-retention Factory, Industrial Manufacturing, Master Crafting, and Woodworking storytelling.

Target Audience: US & Global English YouTube Shorts viewers.
Content Sub-Niche: ${subNiche}
Video Keyword / Topic: "${keyword}"
Ideal Script Duration: 35–45 seconds (approx. 90–120 words spoken at a natural, cozy, and engaging pace).

KEY REQUIREMENTS FOR MAXIMUM RETENTION & VIRALITY:
1. ⚡ KILLER HOOK (00:00 - 00:03):
   - MUST open with an irresistible curiosity gap or pattern interrupt.
   - Conversational, warm, and mind-blowing (NOT a dry or formal documentary tone).
   - Examples:
     * "Have you ever wondered how 10,000 of these are produced in just ONE hour?"
     * "Wait until you see how this master craftsman slices a $50,000 raw block of wood like butter..."
     * "This is why factories use a 2,000-degree molten furnace for just one tiny detail..."

2. 🍿 COZY STORYTELLING & SATISFYING PACING (00:03 - 00:35):
   - Explain the process in simple, mesmerizing, and comfortable words that make the viewer feel relaxed and fascinated.
   - Highlight satisfying sensory details ("watch how smoothly", "precision blade", "satisfying pop").
   - Reveal cool behind-the-scenes factory secrets or extreme speed stats.
   - Keep sentences short, rhythmic, and easy to follow.

3. 🔥 CURIOSITY PEAK & MASS OUTCOME (00:35 - 00:42):
   - Showcase the final, flawless mass product or stunning finished piece.

4. 💬 NATURAL CTA (00:42 - 00:45):
   - Friendly and quick call to action: "Hit that subscribe button for more satisfying factory breakdowns!"

OUTPUT FORMAT REQUIREMENT:
Return ONLY the final voiceover script text divided into timestamps and voiceover lines (include audio tone cues in brackets [like this]), ready to be copied into ElevenLabs or TTS generators.`;
};

const ShortsAnalyzeStep: React.FC = () => {
  const [keywords, setKeywords] = useState<GeneratedKeyword[]>([]);
  const [videoSources, setVideoSources] = useState<Record<string, VideoSourceItem>>({});
  const [urlInputs, setUrlInputs] = useState<Record<string, string>>({});
  const [scriptInputs, setScriptInputs] = useState<Record<string, string>>({});
  const [downloadingState, setDownloadingState] = useState<Record<string, {
    isDownloading: boolean;
    percentage: number;
    totalSize: string;
    speed: string;
    error?: string;
  }>>({});
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);
  const [savedScriptMap, setSavedScriptMap] = useState<Record<string, boolean>>({});

  // Load keywords generated today & existing video sources
  useEffect(() => {
    const loadData = async () => {
      try {
        if (window.electronAPI?.readFromProject) {
          // Keywords history
          const rawHistory = await window.electronAPI.readFromProject('input/shorts/keywords-history.json');
          if (rawHistory) {
            const data: KeywordsHistoryData = typeof rawHistory === 'string' ? JSON.parse(rawHistory) : rawHistory;
            const now = new Date();
            const todays = (data.history || []).filter((item) => {
              if (!item.used_at) return false;
              const d = new Date(item.used_at);
              return (
                d.getFullYear() === now.getFullYear() &&
                d.getMonth() === now.getMonth() &&
                d.getDate() === now.getDate()
              );
            });
            const activeKw = todays.length >= 4 ? todays.slice(0, 4) : (data.history || []).slice(0, 4);
            setKeywords(activeKw);
          }

          // Video sources
          const rawSources = await window.electronAPI.readFromProject('input/shorts/video-sources.json');
          if (rawSources) {
            const data: VideoSourcesData = typeof rawSources === 'string' ? JSON.parse(rawSources) : rawSources;
            const sourcesMap: Record<string, VideoSourceItem> = {};
            const initialUrls: Record<string, string> = {};
            const initialScripts: Record<string, string> = {};

            (data.items || []).forEach((item) => {
              sourcesMap[item.keyword_id] = item;
              if (item.youtube_url) {
                initialUrls[item.keyword_id] = item.youtube_url;
              }
              if (item.script_text) {
                initialScripts[item.keyword_id] = item.script_text;
              }
            });

            setVideoSources(sourcesMap);
            setUrlInputs((prev) => ({ ...initialUrls, ...prev }));
            setScriptInputs((prev) => ({ ...initialScripts, ...prev }));
          }
        }
      } catch (err) {
        console.warn('Failed to load Shorts keywords or video sources:', err);
      }
    };

    loadData();
  }, []);

  // Subscribe to IPC download progress events
  useEffect(() => {
    if (window.electronAPI?.onShortsDownloadProgress) {
      const unsubscribe = window.electronAPI.onShortsDownloadProgress((data) => {
        setDownloadingState((prev) => ({
          ...prev,
          [data.keywordId]: {
            isDownloading: true,
            percentage: data.percentage,
            totalSize: data.totalSize,
            speed: data.speed,
          },
        }));
      });
      return () => unsubscribe();
    }
  }, []);

  const handleUrlChange = (keywordId: string, url: string) => {
    setUrlInputs((prev) => ({ ...prev, [keywordId]: url }));
  };

  const handleScriptChange = (keywordId: string, text: string) => {
    setScriptInputs((prev) => ({ ...prev, [keywordId]: text }));
  };

  const handleOpenSearch = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyPrompt = (item: GeneratedKeyword) => {
    const promptText = buildEngagingNarrationPrompt(item.sub_niche, item.keyword);
    if (window.electronAPI?.copyToClipboard) {
      window.electronAPI.copyToClipboard(promptText);
    } else {
      navigator.clipboard.writeText(promptText);
    }
    setCopiedPromptId(item.id);
    setTimeout(() => setCopiedPromptId(null), 2500);
  };

  const toggleExpandPrompt = (id: string) => {
    setExpandedPromptId((prev) => (prev === id ? null : id));
  };

  const handleSaveScript = async (item: GeneratedKeyword) => {
    const text = (scriptInputs[item.id] || '').trim();
    const existingSource = videoSources[item.id];

    const updatedSourceItem: VideoSourceItem = {
      keyword_id: item.id,
      sub_niche: item.sub_niche,
      keyword: item.keyword,
      youtube_url: existingSource?.youtube_url || urlInputs[item.id] || '',
      video_filename: existingSource?.video_filename || '',
      video_path: existingSource?.video_path || '',
      status: existingSource?.status || 'pending',
      downloaded_at: existingSource?.downloaded_at || '',
      file_size_bytes: existingSource?.file_size_bytes || 0,
      script_text: text,
    };

    const newSourcesMap = { ...videoSources, [item.id]: updatedSourceItem };
    setVideoSources(newSourcesMap);

    const itemsArray = Object.values(newSourcesMap);
    const sourcesData: VideoSourcesData = { items: itemsArray };

    try {
      if (window.electronAPI?.saveToProject) {
        await window.electronAPI.saveToProject(
          'input/shorts/video-sources.json',
          JSON.stringify(sourcesData, null, 2)
        );
      }
      setSavedScriptMap((prev) => ({ ...prev, [item.id]: true }));
      setTimeout(() => {
        setSavedScriptMap((prev) => ({ ...prev, [item.id]: false }));
      }, 2500);
    } catch (err) {
      console.error('Failed to save script output:', err);
    }
  };

  const handleDownload = async (item: GeneratedKeyword) => {
    const targetUrl = (urlInputs[item.id] || '').trim();
    if (!targetUrl) {
      alert('Silakan tempelkan link video YouTube terlebih dahulu.');
      return;
    }

    setDownloadingState((prev) => ({
      ...prev,
      [item.id]: { isDownloading: true, percentage: 0, totalSize: '0MB', speed: '0KB/s' },
    }));

    try {
      if (window.electronAPI?.downloadShortsVideo) {
        const res = await window.electronAPI.downloadShortsVideo({
          keywordId: item.id,
          subNiche: item.sub_niche,
          keyword: item.keyword,
          youtubeUrl: targetUrl,
        });

        if (res.success && res.videoPath) {
          const existingSource = videoSources[item.id];
          const newSourceItem: VideoSourceItem = {
            keyword_id: item.id,
            sub_niche: item.sub_niche,
            keyword: item.keyword,
            youtube_url: targetUrl,
            video_filename: res.videoPath.split('/').pop() || 'video.mp4',
            video_path: res.videoPath,
            status: 'downloaded',
            downloaded_at: new Date().toISOString(),
            file_size_bytes: res.fileSizeBytes || 0,
            script_text: existingSource?.script_text || scriptInputs[item.id] || '',
          };

          setVideoSources((prev) => ({ ...prev, [item.id]: newSourceItem }));
          setDownloadingState((prev) => ({
            ...prev,
            [item.id]: { isDownloading: false, percentage: 100, totalSize: '', speed: '' },
          }));
        } else {
          throw new Error(res.error || 'Gagal mengunduh video.');
        }
      } else {
        throw new Error('Electron API `downloadShortsVideo` tidak tersedia.');
      }
    } catch (err: any) {
      console.error('Download error for keyword', item.id, err);
      setDownloadingState((prev) => ({
        ...prev,
        [item.id]: {
          isDownloading: false,
          percentage: 0,
          totalSize: '',
          speed: '',
          error: err.message || 'Gagal mengunduh video',
        },
      }));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getScriptStats = (text: string) => {
    if (!text || !text.trim()) return { wordCount: 0, estSecs: 0, isGood: false };
    const words = text.trim().split(/\s+/).filter(Boolean);
    const count = words.length;
    const estSecs = Math.round(count / 2.5); // ~150 WPM / 2.5 WPS
    const isGood = count >= 70 && count <= 130;
    return { wordCount: count, estSecs, isGood };
  };

  const downloadedCount = keywords.filter((k) => videoSources[k.id]?.status === 'downloaded').length;

  return (
    <div className="p-6 bg-gray-950/90 border border-gray-800 rounded-3xl min-h-full space-y-8 text-gray-100">
      {/* Step Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800/80 pb-5 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center text-2xl border border-amber-500/20 shadow-lg shadow-amber-950/40">
            ⚡
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
              Step 2: Factory Storytelling & Video Downloader
              <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 text-xs font-mono font-semibold">
                yt-dlp + English AI Script
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Unduh video mentahan YouTube & simpan hasil naskah narasi bahasa Inggris (High Retention & Killer Hook).
            </p>
          </div>
        </div>

        {/* Global Download Status Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 bg-amber-950/80 border border-amber-800/60 text-amber-300 rounded-xl text-xs font-medium flex items-center gap-1.5">
            <span>📹</span> Status: {downloadedCount} / {keywords.length || 4} Downloaded
          </span>
          <span className="px-3 py-1 bg-purple-950/80 border border-purple-800/60 text-purple-300 rounded-xl text-xs font-medium flex items-center gap-1.5">
            <span>🎙️</span> English Narration Active
          </span>
        </div>
      </div>

      {keywords.length === 0 ? (
        /* Empty State: No Keywords from Step 1 */
        <div className="bg-gray-900/40 border border-dashed border-gray-800 p-12 rounded-2xl text-center space-y-4">
          <div className="text-4xl text-amber-500/50">🎯</div>
          <h3 className="text-sm font-bold text-gray-300">Belum Ada Keyword Hari Ini</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Silakan jalankan <span className="text-amber-400 font-medium">"Step 1: Daily AI Sourcing"</span> terlebih dahulu untuk memproduksi 4 keyword *longform* harian.
          </p>
        </div>
      ) : (
        /* 4 Isolated Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {keywords.map((item, index) => {
            const icon = SUB_NICHE_ICONS[item.sub_niche] || '🏭';
            const source = videoSources[item.id];
            const dlState = downloadingState[item.id] || { isDownloading: false, percentage: 0, totalSize: '', speed: '' };
            const inputUrl = urlInputs[item.id] || '';
            const scriptText = scriptInputs[item.id] || '';
            const isDone = source?.status === 'downloaded';
            const isCopied = copiedPromptId === item.id;
            const isExpanded = expandedPromptId === item.id;
            const isSaved = savedScriptMap[item.id];
            const promptText = buildEngagingNarrationPrompt(item.sub_niche, item.keyword);
            const stats = getScriptStats(scriptText);

            return (
              <div
                key={item.id}
                className={`bg-gray-900/70 border ${
                  isDone ? 'border-emerald-500/40 shadow-emerald-950/20' : 'border-gray-800 hover:border-amber-500/40 shadow-amber-950/20'
                } p-6 rounded-2xl space-y-4 transition-all shadow-lg flex flex-col justify-between`}
              >
                {/* Card Header */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{icon}</span>
                      <span className="text-xs font-bold text-amber-400 font-mono tracking-wide">
                        Short #{index + 1}: {item.sub_niche}
                      </span>
                    </div>
                    {isDone ? (
                      <span className="text-[10px] px-2.5 py-0.5 bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 rounded-full font-mono font-bold flex items-center gap-1">
                        <span>✅</span> Downloaded ({formatFileSize(source.file_size_bytes)})
                      </span>
                    ) : dlState.isDownloading ? (
                      <span className="text-[10px] px-2.5 py-0.5 bg-amber-950/90 text-amber-300 border border-amber-700/60 rounded-full font-mono font-bold flex items-center gap-1 animate-pulse">
                        <span>⏳</span> Downloading {dlState.percentage}%
                      </span>
                    ) : (
                      <span className="text-[10px] px-2.5 py-0.5 bg-gray-800 text-gray-400 border border-gray-700/60 rounded-full font-mono">
                        Pending Link
                      </span>
                    )}
                  </div>

                  {/* Target Keyword Display */}
                  <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800/90">
                    <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-0.5">Target Keyword (Step 1):</p>
                    <p className="text-xs font-semibold text-gray-100 tracking-wide">"{item.keyword}"</p>
                  </div>

                  {/* English AI Narration Prompt Copy Box */}
                  <div className="bg-gradient-to-r from-purple-950/50 via-gray-950 to-gray-950 border border-purple-500/30 p-3.5 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-purple-300">
                        <span>🎙️</span>
                        <span className="text-xs font-bold">1. Copy Prompt Narasi AI (English)</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800/60 rounded font-mono">
                        Hook 0-3s
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Prompt AI khusus (Hook memikat, tone santai & nyaman, durasi 35-45s) untuk di-copy ke ChatGPT / Gemini.
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleCopyPrompt(item)}
                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md ${
                          isCopied
                            ? 'bg-emerald-600 text-white border border-emerald-400 shadow-emerald-950/40'
                            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-950/50 active:scale-95'
                        }`}
                      >
                        <span>{isCopied ? '✅' : '📋'}</span>
                        <span>{isCopied ? 'Prompt Berhasil Di-Copy!' : 'Copy English AI Prompt'}</span>
                      </button>

                      <button
                        onClick={() => toggleExpandPrompt(item.id)}
                        className="py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-xl border border-gray-700/80 transition-all flex items-center gap-1"
                      >
                        <span>{isExpanded ? '🔼' : '👁️'}</span>
                        <span>{isExpanded ? 'Tutup' : 'Detail'}</span>
                      </button>
                    </div>

                    {/* Expandable Prompt Detail Preview */}
                    {isExpanded && (
                      <div className="mt-2.5 p-3 bg-gray-950 rounded-xl border border-purple-500/30 text-[11px] font-mono text-gray-300 space-y-2 leading-relaxed max-h-48 overflow-y-auto">
                        <div className="flex items-center justify-between text-[10px] text-purple-400 border-b border-gray-800 pb-1">
                          <span>Preview Prompt Bahasa Inggris:</span>
                          <button
                            onClick={() => handleCopyPrompt(item)}
                            className="text-purple-300 hover:text-white underline text-[10px]"
                          >
                            Copy Text
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap font-sans text-[11px] text-purple-200/90 leading-relaxed">
                          {promptText}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* English Script Output Input Form */}
                  <div className="bg-gray-950/90 border border-gray-800 p-3.5 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
                        <span>📝</span> 2. Hasil Output Script Narasi (English):
                      </label>
                      {stats.wordCount > 0 && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                            stats.isGood
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                              : 'bg-amber-950 text-amber-300 border border-amber-800/80'
                          }`}
                        >
                          📊 {stats.wordCount} words (~{stats.estSecs}s)
                        </span>
                      )}
                    </div>

                    <textarea
                      rows={4}
                      placeholder="Tempel naskah narasi Bahasa Inggris hasil dari ChatGPT/Gemini di sini... (contoh: [00:00] Have you ever wondered how...)"
                      value={scriptText}
                      onChange={(e) => handleScriptChange(item.id, e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs text-gray-100 focus:outline-none focus:border-purple-500 transition-all placeholder:text-gray-600 font-sans leading-relaxed resize-y"
                    />

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] text-gray-500 font-mono">
                        {scriptText ? 'Tersimpan di video-sources.json' : 'Belum diisi'}
                      </span>
                      <button
                        onClick={() => handleSaveScript(item)}
                        disabled={!scriptText.trim()}
                        className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                          isSaved
                            ? 'bg-emerald-600 text-white border border-emerald-400'
                            : 'bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-800/60 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        <span>{isSaved ? '✅' : '💾'}</span>
                        <span>{isSaved ? 'Script Tersimpan!' : 'Simpan Script Narasi'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Input Link & Download Form */}
                <div className="space-y-3 pt-3 border-t border-gray-800/80">
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400 font-medium flex items-center justify-between">
                      <span>🔗 Link Video YouTube Hasil Riset:</span>
                      <button
                        onClick={() => handleOpenSearch(item.youtube_search_url)}
                        className="text-amber-400 hover:text-amber-300 text-[10px] font-mono underline flex items-center gap-1"
                      >
                        <span>🔍 Open YouTube Search</span>
                        <span>↗</span>
                      </button>
                    </label>
                    <input
                      type="text"
                      placeholder="Tempel link YouTube (https://www.youtube.com/watch?v=...)"
                      value={inputUrl}
                      onChange={(e) => handleUrlChange(item.id, e.target.value)}
                      disabled={dlState.isDownloading}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-amber-500 transition-all placeholder:text-gray-600 disabled:opacity-60"
                    />
                  </div>

                  {/* Live Progress Bar */}
                  {dlState.isDownloading && (
                    <div className="space-y-1.5 bg-amber-950/30 border border-amber-500/20 p-3 rounded-xl">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-amber-300 font-semibold">Mengunduh via yt-dlp...</span>
                        <span className="text-amber-400 font-bold">{dlState.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-300"
                          style={{ width: `${dlState.percentage}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                        <span>Kecepatan: {dlState.speed || 'Memulai...'}</span>
                        <span>Ukuran: {dlState.totalSize || '-'}</span>
                      </div>
                    </div>
                  )}

                  {dlState.error && (
                    <div className="p-2.5 bg-red-950/80 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-center justify-between">
                      <span className="truncate">⚠️ {dlState.error}</span>
                      <button
                        onClick={() => setDownloadingState((prev) => ({ ...prev, [item.id]: { ...dlState, error: undefined } }))}
                        className="text-red-400 hover:text-red-200 text-xs ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Download Action Button */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleDownload(item)}
                      disabled={dlState.isDownloading || !inputUrl.trim()}
                      className={`w-full py-2.5 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                        isDone
                          ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60'
                          : 'bg-amber-600 hover:bg-amber-500 text-gray-950 shadow-amber-600/25 disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      {dlState.isDownloading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-gray-950 border-t-transparent rounded-full animate-spin"></div>
                          <span>Downloading MP4...</span>
                        </>
                      ) : isDone ? (
                        <>
                          <span>🔄</span>
                          <span>Re-Download Video</span>
                        </>
                      ) : (
                        <>
                          <span>📥</span>
                          <span>Download Video MP4</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Saved File Info Footer */}
                  {isDone && (
                    <div className="text-[10px] text-emerald-400/90 font-mono bg-emerald-950/40 p-2 rounded-lg border border-emerald-900/60 truncate">
                      📁 Path: {source.video_path}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShortsAnalyzeStep;
