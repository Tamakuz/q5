// dashboard/src/components/longform/testing/AlurfilmIntroTestStep.tsx
import React, { useState, useRef, useEffect } from 'react';

type StylePreset = 'cinematic_gold' | 'silver_epic' | 'neon_thriller';

const getFormattedMediaUrl = (pathStr: string): string => {
  if (!pathStr) return '';
  if (pathStr.startsWith('media://') || pathStr.startsWith('http://') || pathStr.startsWith('blob:')) {
    return pathStr;
  }
  if (window.electronAPI?.getMediaUrl) {
    return window.electronAPI.getMediaUrl(pathStr);
  }
  return `media://content-auto/${encodeURIComponent(pathStr)}`;
};

const AlurfilmIntroTestStep: React.FC = () => {
  // Form Configuration State
  const [titleText, setTitleText] = useState<string>('UNDER THE DOME');
  const [subtitleText, setSubtitleText] = useState<string>('FILM 2013');
  const [audioPath, setAudioPath] = useState<string>('assets/Denied Access - Density & Time.mp3');
  const [impactTimestamp, setImpactTimestamp] = useState<number>(0.48);
  const [duration, setDuration] = useState<number>(6.0);
  const [stylePreset, setStylePreset] = useState<StylePreset>('cinematic_gold');

  // Live Web Preview State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Render State
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderMsg, setRenderMsg] = useState<string>('');
  const [renderResult, setRenderResult] = useState<{ success: boolean; outputPath?: string; error?: string } | null>(null);

  // Sync Live Preview HTML5 Audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Sync IPC progress listener
  useEffect(() => {
    if (window.electronAPI?.onAlurfilmIntroProgress) {
      const removeListener = window.electronAPI.onAlurfilmIntroProgress((data) => {
        if (typeof data.percent === 'number') setRenderProgress(data.percent);
        if (data.msg) setRenderMsg(data.msg);
      });
      return () => {
        removeListener();
      };
    }
  }, []);

  const handleTogglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.currentTime = 0;
      audio.play().then(() => setIsPlaying(true)).catch((err) => console.error(err));
    }
  };

  const handleRenderTest = async () => {
    setIsRendering(true);
    setRenderProgress(0);
    setRenderMsg('Memulai FFmpeg render...');
    setRenderResult(null);

    try {
      if (window.electronAPI?.renderAlurfilmIntroTest) {
        const result = await window.electronAPI.renderAlurfilmIntroTest({
          titleText,
          subtitleText,
          audioPath,
          impactTimestamp,
          duration,
          stylePreset,
        });
        setRenderResult(result);
      } else {
        setRenderResult({ success: false, error: 'IPC handler renderAlurfilmIntroTest belum tersedia.' });
      }
    } catch (err: any) {
      setRenderResult({ success: false, error: err.message || 'Gagal me-render intro' });
    } finally {
      setIsRendering(false);
    }
  };

  // Calculate live visual text alpha & scale based on audio currentTime
  const hasImpacted = currentTime >= impactTimestamp;
  const opacity = !hasImpacted
    ? 0
    : currentTime < impactTimestamp + 0.3
    ? (currentTime - impactTimestamp) / 0.3
    : currentTime > duration - 1.0
    ? Math.max(0, (duration - currentTime) / 1.0)
    : 1;

  const subtitleOpacity = currentTime < impactTimestamp + 0.1
    ? 0
    : currentTime < impactTimestamp + 0.4
    ? (currentTime - impactTimestamp - 0.1) / 0.3
    : currentTime > duration - 1.0
    ? Math.max(0, (duration - currentTime) / 1.0)
    : 1;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-950/40 via-purple-950/40 to-gray-900 p-6 rounded-3xl border border-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono font-bold uppercase tracking-wider">
              🧪 Testing Lab • Intro Studio
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>🎬</span> Alur Film Intro Renderer Test
          </h1>
          <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
            Uji coba generator intro sinematik 16:9 tersinkronisasi dentuman soundtrack audio (<code className="text-amber-300 font-mono">0.48s</code> impact). Sesuaikan konfigurasi, preview realtime, dan render hasil ke MP4.
          </p>
        </div>

        <button
          onClick={handleRenderTest}
          disabled={isRendering}
          className={`px-6 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg shrink-0 ${
            isRendering
              ? 'bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-700'
              : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 shadow-amber-500/20 hover:shadow-amber-500/30'
          }`}
        >
          {isRendering ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              <span>Rendering ({renderProgress}%)...</span>
            </>
          ) : (
            <>
              <span>🎬</span> Render Video Test (1080p MP4)
            </>
          )}
        </button>
      </div>

      {/* Main Grid: Form Controls Left | Preview Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-5 bg-gray-900/90 border border-gray-800 p-5 rounded-3xl space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <span>⚙️</span> Parameter Konfigurasi Intro
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Judul Utama (Title)
              </label>
              <input
                type="text"
                value={titleText}
                onChange={(e) => setTitleText(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white font-bold tracking-wide focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="UNDER THE DOME"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Subtitle / Tahun Release
              </label>
              <input
                type="text"
                value={subtitleText}
                onChange={(e) => setSubtitleText(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="FILM 2013"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Audio Soundtrack Asset
              </label>
              <input
                type="text"
                value={audioPath}
                onChange={(e) => setAudioPath(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500 transition-colors"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                Soundtrack default: <code className="text-gray-400 font-mono">assets/Denied Access - Density & Time.mp3</code>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Impact Beat (Detik)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="3"
                  value={impactTimestamp}
                  onChange={(e) => setImpactTimestamp(parseFloat(e.target.value) || 0.48)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Total Durasi (s)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="3"
                  max="10"
                  value={duration}
                  onChange={(e) => setDuration(parseFloat(e.target.value) || 6.0)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Visual Style Preset
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStylePreset('cinematic_gold')}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all border text-center ${
                    stylePreset === 'cinematic_gold'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  ✨ Gold
                </button>
                <button
                  type="button"
                  onClick={() => setStylePreset('silver_epic')}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all border text-center ${
                    stylePreset === 'silver_epic'
                      ? 'bg-slate-300/20 border-slate-300 text-slate-200 shadow-md shadow-slate-300/10'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  ⚡ Silver
                </button>
                <button
                  type="button"
                  onClick={() => setStylePreset('neon_thriller')}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all border text-center ${
                    stylePreset === 'neon_thriller'
                      ? 'bg-red-500/20 border-red-500 text-red-400 shadow-md shadow-red-500/10'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  🔥 Neon
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Web Preview & Render Result */}
        <div className="lg:col-span-7 space-y-6">
          {/* Realtime Live Preview Screen */}
          <div className="bg-gray-900 border border-gray-800 p-5 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>👁️</span> Realtime Web Live Preview
              </h2>
              <span className="text-[10px] font-mono text-gray-500">
                Audio Sync Test • {currentTime.toFixed(2)}s / {duration.toFixed(1)}s
              </span>
            </div>

            {/* 16:9 Screen Box */}
            <div className="relative aspect-video w-full bg-black rounded-2xl border border-gray-800 overflow-hidden flex flex-col items-center justify-center shadow-2xl">
              {/* Text Render Container */}
              <div
                className="text-center transition-all duration-100 transform flex flex-col items-center justify-center space-y-2"
                style={{
                  opacity,
                  transform: opacity > 0 ? 'scale(1)' : 'scale(1.15)',
                }}
              >
                <h1
                  className={`text-3xl md:text-5xl font-black uppercase tracking-wider transition-colors ${
                    stylePreset === 'cinematic_gold'
                      ? 'text-amber-400 drop-shadow-[0_0_20px_rgba(229,184,58,0.4)]'
                      : stylePreset === 'silver_epic'
                      ? 'text-slate-200 drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]'
                      : 'text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                  }`}
                  style={{ fontFamily: 'serif, sans-serif', letterSpacing: '0.08em' }}
                >
                  {titleText || 'TITLE TEXT'}
                </h1>
                <p
                  className={`text-xs md:text-sm font-mono tracking-[0.35em] uppercase transition-opacity ${
                    stylePreset === 'neon_thriller' ? 'text-sky-400' : 'text-gray-300'
                  }`}
                  style={{ opacity: subtitleOpacity }}
                >
                  {subtitleText || 'SUBTITLE'}
                </p>
              </div>

              {/* Status Overlay Badge when Audio is Playing */}
              {isPlaying && (
                <div className="absolute top-3 right-3 bg-red-600/80 text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-full animate-pulse border border-red-400/30">
                  ● PLAYING AUDIO SYNC
                </div>
              )}
            </div>

            {/* Player Controls */}
            <div className="flex items-center gap-3 pt-1">
              <audio ref={audioRef} src={getFormattedMediaUrl(audioPath)} />
              <button
                onClick={handleTogglePlay}
                className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs flex items-center gap-2 transition-all border border-gray-700 shadow"
              >
                <span>{isPlaying ? '⏸ Pause' : '▶ Play Sync Preview'}</span>
              </button>
              <div className="flex-1 bg-gray-950 h-2 rounded-full overflow-hidden border border-gray-800 relative">
                <div
                  className="bg-amber-500 h-full transition-all duration-75"
                  style={{ width: `${Math.min(100, (currentTime / duration) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Render Progress & Result Card */}
          {(isRendering || renderResult) && (
            <div className="bg-gray-900/90 border border-gray-800 p-5 rounded-3xl space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🎬</span> Hasil Render Video FFmpeg
              </h3>

              {isRendering && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-400 font-mono">
                    <span>Rendering Intro MP4...</span>
                    <span>{renderProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-950 h-3 rounded-full overflow-hidden border border-gray-800">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-200"
                      style={{ width: `${renderProgress}%` }}
                    />
                  </div>
                  {renderMsg && <p className="text-[10px] font-mono text-gray-500">{renderMsg}</p>}
                </div>
              )}

              {renderResult && (
                <div className="space-y-3">
                  {renderResult.success ? (
                    <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                        <span>✅</span> Intro Video Berhasil Di-render!
                      </div>
                      <p className="text-[11px] font-mono text-gray-300 break-all">
                        Location: {renderResult.outputPath}
                      </p>
                      {/* Video Player */}
                      {renderResult.outputPath && (
                        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-gray-800">
                          <video
                            controls
                            src={getFormattedMediaUrl(renderResult.outputPath)}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-2xl text-xs text-red-400 space-y-1">
                      <div className="font-bold flex items-center gap-2">
                        <span>❌</span> Gagal Me-render Video
                      </div>
                      <p className="font-mono text-[11px] text-red-300">{renderResult.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlurfilmIntroTestStep;
