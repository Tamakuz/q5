// dashboard/src/components/placeholders/UploadPlaceholder.tsx
import React, { useState, useEffect } from 'react';
import type { YoutubeTitleResult } from '../../electron-api';

const api = window.electronAPI;

const UploadPlaceholder: React.FC = () => {
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [generating, setGenerating] = useState<boolean>(false);
  const [result, setResult] = useState<YoutubeTitleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>('');

  const [copiedTitle, setCopiedTitle] = useState<boolean>(false);
  const [copiedDesc, setCopiedDesc] = useState<boolean>(false);
  const [copiedPath, setCopiedPath] = useState<boolean>(false);

  const [renderedVideoPath, setRenderedVideoPath] = useState<string | null>(null);
  const [rendersList, setRendersList] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
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
      setSelectedTitle(res.recommended_title || res.titles?.[0] || '');
    } catch (err: any) {
      setError(err.message || 'Failed to generate YouTube titles via AI');
    }
    setGenerating(false);
  };

  const handleCopy = async (text: string, setFn: (v: boolean) => void) => {
    await api.copyToClipboard(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-6 overflow-hidden">
      {/* Top Header & Readiness Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-800 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="p-2 bg-red-600/20 text-red-400 rounded-lg text-lg">🚀</span>
            YouTube Shorts Upload & Automation
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Generate viral CTR titles, SEO descriptions, and prepare video assets for automated upload.
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <div className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
            result
              ? 'bg-red-950/60 border-red-700/50 text-red-300 shadow-lg shadow-red-950/40'
              : 'bg-gray-900 border-gray-800 text-gray-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${result ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`}></span>
            <span>{result ? 'Metadata Ready' : 'Awaiting AI Title'}</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 flex-1 min-h-0 overflow-hidden">
        {/* LEFT PANEL: AI YouTube Title & Meta Generator (Col 6) */}
        <div className="lg:col-span-6 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="flex items-center justify-between bg-gray-900 px-4 py-3 border-b border-gray-800 shrink-0">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🤖</span> AI Shorts Metadata Generator (DeepSeek AI)
            </span>
            <button
              onClick={handleGenerateTitles}
              disabled={generating}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 ${
                generating
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
              }`}
            >
              <span>{generating ? '⏳' : '✨'}</span>
              <span>{generating ? 'Generating...' : 'Generate Viral Titles'}</span>
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
                {/* Active / Selected Title */}
                <div className="bg-gray-950 p-4 rounded-xl border border-red-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
                      Selected Title (CTR Optimized)
                    </span>
                    <button
                      onClick={() => handleCopy(selectedTitle, setCopiedTitle)}
                      className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md text-[11px] font-medium transition-all"
                    >
                      {copiedTitle ? '✓ Copied' : 'Copy Title'}
                    </button>
                  </div>
                  <p className="text-sm font-bold text-white leading-snug">{selectedTitle}</p>
                </div>

                {/* 5 Title Variations */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Title Variations (Click to select)
                  </span>
                  <div className="space-y-1.5">
                    {result.titles.map((title, idx) => (
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
                      SEO Description & Hashtags
                    </span>
                    <button
                      onClick={() => handleCopy(result.description, setCopiedDesc)}
                      className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md text-[11px] font-medium transition-all"
                    >
                      {copiedDesc ? '✓ Copied' : 'Copy Description'}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={result.description}
                    className="w-full h-28 bg-gray-950 text-gray-300 text-xs font-mono p-3 rounded-xl border border-gray-800 resize-none leading-relaxed"
                  />
                </div>

                {/* Hashtags Badges */}
                <div className="flex flex-wrap gap-1.5">
                  {result.hashtags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-red-950/60 border border-red-800/50 text-red-300 rounded-lg text-[11px] font-mono font-medium"
                    >
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3 border border-dashed border-gray-800 rounded-2xl">
                <div className="w-14 h-14 bg-red-600/10 text-red-400 rounded-2xl flex items-center justify-center text-2xl border border-red-500/20">
                  ✨
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Generate YouTube Shorts Metadata</h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm">
                    Click "Generate Viral Titles" to invoke DeepSeek AI for CTR-boosted titles and SEO hashtags.
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
