// dashboard/src/components/placeholders/UploadPlaceholder.tsx
import React, { useState, useEffect } from 'react';
import type { YoutubeTitleResult } from '../../electron-api';

const api = window.electronAPI;

const UploadPlaceholder: React.FC = () => {
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [generating, setGenerating] = useState<boolean>(false);
  const [result, setResult] = useState<YoutubeTitleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<'youtube' | 'tiktok'>('youtube');
  const [selectedTitle, setSelectedTitle] = useState<string>('');
  const [selectedTiktokCaption, setSelectedTiktokCaption] = useState<string>('');

  const [copiedTitle, setCopiedTitle] = useState<boolean>(false);
  const [copiedDesc, setCopiedDesc] = useState<boolean>(false);
  const [copiedPath, setCopiedPath] = useState<boolean>(false);

  const [renderedVideoPath, setRenderedVideoPath] = useState<string | null>(null);
  const [rendersList, setRendersList] = useState<any[]>([]);
  const [contentId, setContentId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      // 0. Load Content ID
      try {
        if (api.getContentId) {
          const id = await api.getContentId();
          setContentId(id);
        }
      } catch {}

      // 1. Load transcript text for AI context
      try {
        const rawTranscript = await api.readFromProject('input/transcript.json');
        if (rawTranscript) {
          try {
            const parsed = JSON.parse(rawTranscript);
            if (Array.isArray(parsed)) {
              const fullText = parsed.map((e: any) => e.text || e.narration || '').join(' ');
              setTranscriptText(fullText);
            }
          } catch {
            setTranscriptText(rawTranscript);
          }
        }
      } catch {}

      // 2. Load latest rendered video outputs
      try {
        if (api.listRenders) {
          const renders = await api.listRenders();
          if (renders && renders.length > 0) {
            setRendersList(renders);
            setRenderedVideoPath(renders[0].fullPath || renders[0].filePath);
            return;
          }
        }
      } catch {}

      // Fallback: check default output paths
      const fallbackPaths = [
        'output/render_1784607133168.mp4',
        'output/test_bgm_render.mp4',
        'output/video.mp4'
      ];
      setRenderedVideoPath(fallbackPaths[0]);
    })();
  }, []);

  const handleGenerateTitles = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.generateYoutubeTitles(transcriptText);
      setResult(res);

      const ytTitle = res.youtube?.recommended_title || res.recommended_title || res.youtube?.titles?.[0] || res.titles?.[0] || '';
      setSelectedTitle(ytTitle);

      const ttCaption = res.tiktok?.recommended_caption || res.tiktok?.captions?.[0] || '';
      setSelectedTiktokCaption(ttCaption);
    } catch (err: any) {
      setError(err.message || 'Failed to generate viral social media titles via AI');
    }
    setGenerating(false);
  };

  const handleCopy = async (text: string, setFn: (v: boolean) => void) => {
    await api.copyToClipboard(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  const ytData = result?.youtube || (result?.titles ? {
    titles: result.titles,
    description: result.description || '',
    hashtags: result.hashtags || [],
    recommended_title: result.recommended_title || ''
  } : null);

  const ttData = result?.tiktok || null;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-6 overflow-hidden">
      {/* Top Header & Readiness Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-800 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="p-2 bg-gradient-to-r from-red-600 to-cyan-600 text-white rounded-lg text-lg">🚀</span>
            TikTok FYP & YouTube Shorts Publishing Hub
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Generate viral CTR titles, engagement captions, FYP hashtag strategies, and prepare video assets.
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <div className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
            result
              ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300 shadow-lg shadow-emerald-950/40'
              : 'bg-gray-900 border-gray-800 text-gray-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${result ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`}></span>
            <span>{result ? 'Social Metadata Ready' : 'Awaiting AI Generator'}</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 flex-1 min-h-0 overflow-hidden">
        {/* LEFT PANEL: AI Social Metadata Generator (Col 6) */}
        <div className="lg:col-span-6 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="flex items-center justify-between bg-gray-900 px-4 py-3 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-950 p-1 rounded-lg border border-gray-800">
                <button
                  onClick={() => setActivePlatform('youtube')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activePlatform === 'youtube'
                      ? 'bg-red-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span>🔴</span> YouTube Shorts
                </button>
                <button
                  onClick={() => setActivePlatform('tiktok')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activePlatform === 'tiktok'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span>🎵</span> TikTok FYP
                </button>
              </div>
            </div>

            <button
              onClick={handleGenerateTitles}
              disabled={generating}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 ${
                generating
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-red-600 to-cyan-600 hover:from-red-500 hover:to-cyan-500 text-white shadow-indigo-600/30'
              }`}
            >
              <span>{generating ? '⏳' : '✨'}</span>
              <span>{generating ? 'Generating...' : 'Generate Social Metadata'}</span>
            </button>
          </div>

          <div className="p-4 flex-1 flex flex-col min-h-0 overflow-y-auto space-y-4">
            {error && (
              <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400">
                {error}
              </div>
            )}

            {result ? (
              <div className="space-y-4">
                {/* 1. YOUTUBE SHORTS TAB */}
                {activePlatform === 'youtube' && ytData && (
                  <div className="space-y-4">
                    {/* Active Selected Title */}
                    <div className="bg-gray-950 p-4 rounded-xl border border-red-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                          <span>🔴</span> Selected Title (CTR Optimized)
                        </span>
                        <button
                          onClick={() => handleCopy(selectedTitle, setCopiedTitle)}
                          className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md text-[11px] font-medium transition-all"
                        >
                          {copiedTitle ? '✓ Copied' : 'Copy Title'}
                        </button>
                      </div>
                      <p className="text-sm font-bold text-white leading-snug">{selectedTitle || ytData.recommended_title}</p>
                    </div>

                    {/* Title Variations */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Shorts Title Variations (Click to select)
                      </span>
                      <div className="space-y-1.5">
                        {ytData.titles.map((title, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedTitle(title)}
                            className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between gap-2 ${
                              selectedTitle === title
                                ? 'bg-red-950/40 border-red-600 text-white font-bold'
                                : 'bg-gray-950 border-gray-800 hover:border-gray-700 text-gray-300'
                            }`}
                          >
                            <span className="truncate">{title}</span>
                            {selectedTitle === title && <span className="text-red-400 text-xs shrink-0">✓</span>}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* SEO Description */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          Shorts SEO Description
                        </span>
                        <button
                          onClick={() => handleCopy(ytData.description, setCopiedDesc)}
                          className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md text-[11px] font-medium transition-all"
                        >
                          {copiedDesc ? '✓ Copied' : 'Copy Description'}
                        </button>
                      </div>
                      <textarea
                        readOnly
                        value={ytData.description}
                        className="w-full h-28 bg-gray-950 text-gray-300 text-xs font-mono p-3 rounded-xl border border-gray-800 resize-none leading-relaxed"
                      />
                    </div>

                    {/* Hashtags Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {ytData.hashtags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-red-950/60 border border-red-800/50 text-red-300 rounded-lg text-[11px] font-mono font-medium"
                        >
                          {tag.startsWith('#') ? tag : `#${tag}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. TIKTOK FYP TAB */}
                {activePlatform === 'tiktok' && (
                  <div className="space-y-4">
                    {ttData ? (
                      <>
                        {/* Selected FYP Caption */}
                        <div className="bg-gray-950 p-4 rounded-xl border border-cyan-900/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                              <span>🎵</span> Selected FYP Caption (Engagement Hook)
                            </span>
                            <button
                              onClick={() => handleCopy(selectedTiktokCaption, setCopiedTitle)}
                              className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-cyan-300 rounded-md text-[11px] font-medium transition-all"
                            >
                              {copiedTitle ? '✓ Copied' : 'Copy Caption'}
                            </button>
                          </div>
                          <p className="text-xs text-cyan-100 font-medium leading-relaxed bg-gray-900/80 p-3 rounded-lg border border-gray-800">
                            {selectedTiktokCaption || ttData.recommended_caption}
                          </p>
                        </div>

                        {/* Strategy Tip */}
                        {ttData.fyp_strategy_tip && (
                          <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-xl text-xs text-cyan-300 flex items-start gap-2">
                            <span className="text-sm">💡</span>
                            <span>{ttData.fyp_strategy_tip}</span>
                          </div>
                        )}

                        {/* FYP Caption Variations */}
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            TikTok Caption Variations (Click to select)
                          </span>
                          <div className="space-y-1.5">
                            {ttData.captions.map((caption, idx) => (
                              <button
                                key={idx}
                                onClick={() => setSelectedTiktokCaption(caption)}
                                className={`w-full p-3 rounded-xl border text-left text-xs transition-all flex items-start justify-between gap-2 ${
                                  selectedTiktokCaption === caption
                                    ? 'bg-cyan-950/40 border-cyan-600 text-white font-medium'
                                    : 'bg-gray-950 border-gray-800 hover:border-gray-700 text-gray-300'
                                }`}
                              >
                                <span className="leading-relaxed">{caption}</span>
                                {selectedTiktokCaption === caption && <span className="text-cyan-400 text-xs shrink-0 mt-0.5">✓</span>}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* TikTok Full Description */}
                        {ttData.description && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                TikTok Full Caption & Description
                              </span>
                              <button
                                onClick={() => handleCopy(ttData.description, setCopiedDesc)}
                                className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md text-[11px] font-medium transition-all"
                              >
                                {copiedDesc ? '✓ Copied' : 'Copy Full Description'}
                              </button>
                            </div>
                            <textarea
                              readOnly
                              value={ttData.description}
                              className="w-full h-24 bg-gray-950 text-gray-300 text-xs font-mono p-3 rounded-xl border border-gray-800 resize-none leading-relaxed"
                            />
                          </div>
                        )}

                        {/* FYP Hashtags */}
                        <div className="flex flex-wrap gap-1.5">
                          {ttData.hashtags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 rounded-lg text-[11px] font-mono font-medium"
                            >
                              {tag.startsWith('#') ? tag : `#${tag}`}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      /* Fallback when old format is loaded */
                      <div className="space-y-3 p-4 bg-gray-950 rounded-xl border border-gray-800 text-xs text-gray-400">
                        <p className="text-cyan-400 font-bold">🎵 Generated FYP Suggestions:</p>
                        <p className="text-gray-200 italic">"{selectedTitle}"</p>
                        <p>Hashtags: #fyp #foryou #foryoupage #viral #WakuVibes #AnimeRecap</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3 border border-dashed border-gray-800 rounded-2xl">
                <div className="w-14 h-14 bg-gradient-to-r from-red-600/20 to-cyan-600/20 text-cyan-400 rounded-2xl flex items-center justify-center text-2xl border border-cyan-500/20">
                  ✨
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Generate Social Media Metadata</h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm">
                    Click "Generate Social Metadata" to invoke AI for viral YouTube Shorts titles & TikTok FYP engagement captions.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Video Asset & Upload Hub (Col 6) */}
        <div className="lg:col-span-6 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📹</span> Final Video Asset & Upload Hub
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Preview rendered video output and copy metadata.
              </p>
            </div>
            {rendersList.length > 1 && (
              <select
                value={renderedVideoPath || ''}
                onChange={(e) => setRenderedVideoPath(e.target.value)}
                className="bg-gray-950 text-gray-200 border border-gray-800 rounded-lg px-2.5 py-1 text-xs font-mono"
              >
                {rendersList.map((r, idx) => (
                  <option key={idx} value={r.fullPath || r.filePath}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Video Preview Frame */}
          <div className="flex-1 bg-black rounded-xl overflow-hidden flex items-center justify-center border border-gray-800 min-h-0 relative">
            {renderedVideoPath ? (
              <video
                key={renderedVideoPath}
                src={`media://content-auto/${encodeURIComponent(renderedVideoPath)}`}
                controls
                className="w-full h-full object-contain max-h-[380px]"
              />
            ) : (
              <div className="text-center text-xs text-gray-500 p-6">
                No rendered output found. Complete rendering in the Render tab first.
              </div>
            )}
          </div>

          {/* Video File Specs & Copy Path */}
          <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-3">
            {contentId && (
              <div className="flex items-center justify-between pb-2 border-b border-gray-800/80">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider">Content Identifier</span>
                  <span className="text-xs font-mono font-bold text-indigo-300 block">
                    {contentId}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(contentId, setCopiedId)}
                  className="px-2.5 py-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/50 text-indigo-300 rounded-md text-[11px] font-medium transition-all"
                >
                  {copiedId ? '✓ Copied' : 'Copy ID'}
                </button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-500 uppercase block">Selected File Path</span>
                <span className="text-xs font-mono font-bold text-gray-200 truncate max-w-[280px] block">
                  {renderedVideoPath || 'No video selected'}
                </span>
              </div>
              {renderedVideoPath && (
                <button
                  onClick={() => handleCopy(renderedVideoPath, setCopiedPath)}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition-all shrink-0"
                >
                  {copiedPath ? '✓ Copied' : 'Copy File Path'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPlaceholder;
