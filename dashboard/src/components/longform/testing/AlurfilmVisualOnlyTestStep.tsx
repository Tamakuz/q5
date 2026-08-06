// dashboard/src/components/longform/testing/AlurfilmVisualOnlyTestStep.tsx
import React, { useState, useRef, useEffect } from 'react';

interface TranscriptItem {
  sentence_index: number;
  type: 'narration' | 'visual_only';
  text: string;
  description?: string;
  start: number;
  end: number;
  duration: number;
  visuals: Array<{
    type: string;
    duration: number;
    source_start_seconds: number;
    color_grading_shift?: { contrast: number; brightness: number; saturation: number };
  }>;
}

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

const DEFAULT_RAW_SCRIPT = `Di awal cerita, Adam berjanji akan melindungi desa tersebut dari ancaman bahaya. Namun, tiba-tiba pasukan musuh menyerbu secara mendadak.

[VISUAL_ONLY: 5.0s | Adegan pertarungan sengit dan baku hantam antara Adam dan pasukan musuh]

Setelah pertarungan sengit yang berlangsung tersebut, Adam akhirnya berhasil menumbangkan seluruh musuhnya.

[VISUAL_ONLY: 6.0s | Adegan tsunami raksasa menerjang benteng pertahanan musuh]

Kota itu pun hancur total seketika tanpa menyisakan satu pun musuh.`;

const convertToGeminiTtsScript = (rawText: string): string => {
  if (!rawText) return '';
  return rawText.replace(
    /\[VISUAL_ONLY:\s*([\d.]+)\s*s?\s*(?:\|\s*([^\]]+))?\]/gi,
    (_match, secStr) => {
      const sec = parseFloat(secStr) || 5;
      return `<break time="${sec}s"/>`;
    }
  );
};

const AlurfilmVisualOnlyTestStep: React.FC = () => {
  // Setup State
  const [rawScript, setRawScript] = useState<string>(DEFAULT_RAW_SCRIPT);
  const [geminiTtsScript, setGeminiTtsScript] = useState<string>(convertToGeminiTtsScript(DEFAULT_RAW_SCRIPT));
  const [copied, setCopied] = useState<boolean>(false);

  // Audio File State
  const [audioFile, setAudioFile] = useState<{ name: string; path: string; url: string; size?: number } | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  // Faster-Whisper & Gap Detection State
  const [isWhisperRunning, setIsWhisperRunning] = useState<boolean>(false);
  const [whisperStatus, setWhisperStatus] = useState<string>('');
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);
  const [totalAudioDuration, setTotalAudioDuration] = useState<number>(0);

  // Audio Playback Sync
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  // Auto update Gemini TTS script when Raw Script changes
  useEffect(() => {
    setGeminiTtsScript(convertToGeminiTtsScript(rawScript));
  }, [rawScript]);

  // Sync active segment highlight with current audio play time
  useEffect(() => {
    if (!transcriptItems || transcriptItems.length === 0) return;
    const foundIdx = transcriptItems.findIndex(
      (item) => currentTime >= item.start && currentTime <= item.end
    );
    setActiveIndex(foundIdx);
  }, [currentTime, transcriptItems]);

  const handleUploadAudio = async () => {
    try {
      setUploading(true);
      let selectedPath = '';
      let selectedName = '';
      let selectedSize = 0;

      if (window.electronAPI?.selectAudio) {
        const fileObj = await window.electronAPI.selectAudio();
        if (fileObj && fileObj.path) {
          selectedPath = fileObj.path;
          selectedName = fileObj.name || 'Audio VO Test';
          selectedSize = fileObj.size || 0;
        }
      } else if (window.electronAPI?.selectFile) {
        const fileObj = await window.electronAPI.selectFile();
        if (fileObj && fileObj.path) {
          selectedPath = fileObj.path;
          selectedName = fileObj.name || 'Audio VO Test';
          selectedSize = fileObj.size || 0;
        }
      }

      if (selectedPath) {
        const mediaUrl = getFormattedMediaUrl(selectedPath);
        setAudioFile({
          name: selectedName,
          path: selectedPath,
          url: mediaUrl,
          size: selectedSize
        });
        // Run Faster-Whisper Transcript Alignment & Gap Detection
        runFasterWhisperTranscriptAndGapDetection(selectedPath);
      }
    } catch (err) {
      console.error('Failed to upload audio:', err);
    } finally {
      setUploading(false);
    }
  };

  // Listen to Faster-Whisper progress from backend
  useEffect(() => {
    if (window.electronAPI?.onAlurfilmTestWhisperProgress) {
      const removeListener = window.electronAPI.onAlurfilmTestWhisperProgress((data) => {
        if (data && data.message) {
          setWhisperStatus(`[${data.progress}%] ${data.message}`);
        }
      });
      return () => removeListener();
    }
  }, []);

  /**
   * Real Standalone Faster-Whisper (align_cli.py) Transcript Alignment & FFmpeg Silence Gap Splicing
   */
  const runFasterWhisperTranscriptAndGapDetection = async (audioPathStr?: string) => {
    const targetAudioPath = audioPathStr || audioFile?.path || '';
    setIsWhisperRunning(true);
    setWhisperStatus('Menjalankan Standalone Faster-Whisper & Splicing Audio Silence Gap...');

    try {
      if (window.electronAPI?.runAlurfilmTestWhisperAlignment) {
        const res = await window.electronAPI.runAlurfilmTestWhisperAlignment(targetAudioPath, rawScript) as any;
        if (res && res.success && Array.isArray(res.items)) {
          setTranscriptItems(res.items);
          setTotalAudioDuration(res.totalDurationSec || 0);

          if (res.finalAudioUrl && res.finalAudioPath) {
            setAudioFile({
              name: 'Audio VO Final (Dengan Silence Gap Presisi)',
              path: res.finalAudioPath,
              url: res.finalAudioUrl
            });
          }

          setWhisperStatus(
            res.audioSpliced
              ? '✓ Faster-Whisper Transkrip & Final Audio VO dengan Silence Gap Presisi Berhasil Dibuat!'
              : '✓ Transkrip Alignment & Silence Gap Terdeteksi'
          );
          setIsWhisperRunning(false);
          return;
        }
      }
      throw new Error('Handler IPC Faster-Whisper tidak tersedia');
    } catch (err: any) {
      console.warn('Faster-Whisper IPC error:', err);
      setWhisperStatus(`Error: ${err.message || 'Gagal memproses Faster-Whisper'}`);
    } finally {
      setIsWhisperRunning(false);
    }
  };



  const handleCopyTtsScript = () => {
    navigator.clipboard.writeText(geminiTtsScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeItem = activeIndex >= 0 && activeIndex < transcriptItems.length ? transcriptItems[activeIndex] : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-gray-900 border border-amber-500/30 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl text-xl border border-amber-500/30">
            🎙️
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">
              Faster-Whisper Transkrip & No-VO Gap Detection Studio
            </h2>
            <p className="text-xs text-gray-400">
              Pengujian <span className="text-amber-300 font-semibold">Faster-Whisper Transcript</span> untuk mendeteksi jeda hening (<code className="text-amber-300 font-mono">Silence Gap &ge; 3.5s</code>) dan memberikan <span className="text-amber-300 font-semibold">Highlight Realtime</span> saat audio diputar.
            </p>
          </div>
        </div>
      </div>

      {/* Row 1: 3 Setup Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Panel 1: Naskah Raw Master */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <span>📄</span> Panel 1: Naskah Raw Master
              </label>
              <button
                onClick={() => setRawScript(DEFAULT_RAW_SCRIPT)}
                className="text-[10px] text-amber-400 hover:text-amber-300 underline font-medium"
              >
                Reset
              </button>
            </div>

            <textarea
              value={rawScript}
              onChange={(e) => setRawScript(e.target.value)}
              rows={8}
              className="w-full bg-gray-950/80 border border-gray-800 rounded-xl p-3 text-[11px] text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-amber-500/50 transition-all resize-y"
              placeholder="Tulis naskah raw dengan tag [VISUAL_ONLY: 5.0s | Deskripsi adegan]..."
            />
          </div>
        </div>

        {/* Panel 2: Format Gemini TTS */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <span>🤖</span> Panel 2: Format Gemini TTS
              </label>
              <button
                onClick={handleCopyTtsScript}
                className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 rounded-lg text-[10px] font-bold transition-all"
              >
                {copied ? '✓ Copied' : '📋 Copy TTS'}
              </button>
            </div>

            <textarea
              value={geminiTtsScript}
              onChange={(e) => setGeminiTtsScript(e.target.value)}
              rows={8}
              className="w-full bg-gray-950/80 border border-gray-800 rounded-xl p-3 text-[11px] text-emerald-200/90 font-mono leading-relaxed focus:outline-none focus:border-emerald-500/50 transition-all resize-y"
              placeholder="Teks format Gemini TTS dengan <break time='5s'/>..."
            />
          </div>
        </div>

        {/* Panel 3: Upload Audio VO & Faster-Whisper Trigger */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <span>🎙️</span> Panel 3: Audio VO & Faster-Whisper
              </label>
            </div>

            <button
              onClick={handleUploadAudio}
              disabled={uploading}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-400 shadow-lg shadow-purple-500/10 flex items-center justify-center gap-2 transition-all"
            >
              {uploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Membuka file dialog...
                </>
              ) : (
                <>
                  <span>📤</span> Upload / Pilih File Audio VO (.mp3 / .wav)
                </>
              )}
            </button>

            {audioFile && (
              <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-3 space-y-2">
                <div className="text-[11px] font-mono text-gray-200 truncate">
                  🎵 {audioFile.name}
                </div>
                <audio
                  key={audioFile.url}
                  ref={audioRef}
                  src={audioFile.url}
                  controls
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-8 accent-purple-500"
                />

              </div>
            )}

            <button
              onClick={() => runFasterWhisperTranscriptAndGapDetection(audioFile?.path)}
              disabled={isWhisperRunning || !rawScript.trim()}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 border border-amber-400 shadow-md shadow-amber-500/10 flex items-center justify-center gap-2 transition-all"
            >
              {isWhisperRunning ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
                  Running Faster-Whisper Alignment...
                </>
              ) : (
                <>
                  <span>⚡</span> Jalankan Faster-Whisper & Deteksi Gap
                </>
              )}
            </button>

            {whisperStatus && (
              <div className="text-[10px] font-mono text-amber-300/80 bg-black/40 p-2 rounded-lg border border-amber-500/20 truncate">
                ℹ️ {whisperStatus}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Transkrip Alignment & Visual Mapping Highlight */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 space-y-5 shadow-xl">
        {/* Header Stats */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="text-xs font-bold text-white tracking-wide">
              Faster-Whisper Transkrip Timeline & Visual Mapping (Realtime Highlight)
            </h3>
          </div>
          {transcriptItems.length > 0 && (
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300">
                Kalimat Narasi: {transcriptItems.filter(i => i.type === 'narration').length}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold">
                🔥 No-VO Gap Terdeteksi: {transcriptItems.filter(i => i.type === 'visual_only').length}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold">
                Total Durasi: {totalAudioDuration}s
              </span>
            </div>
          )}
        </div>

        {/* Realtime Active Segment Showcase Banner */}
        <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-black/70 p-5 text-center min-h-[140px] flex flex-col items-center justify-center transition-all shadow-inner">
          {activeItem ? (
            activeItem.type === 'visual_only' ? (
              <div className="space-y-3 animate-fade-in">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-400 text-xs font-bold shadow-lg shadow-amber-500/10">
                  <span className="animate-ping w-2 h-2 rounded-full bg-amber-400" />
                  🔥 REALTIME ACTIVE: NO-VO VISUAL MURNI (100% VIDEO_CUT)
                </div>
                <h4 className="text-base font-extrabold text-white max-w-xl mx-auto leading-relaxed tracking-wide">
                  "{activeItem.description}"
                </h4>
                <div className="flex items-center justify-center gap-4 text-[11px] font-mono text-amber-300/90">
                  <span>⏱️ Timings: {activeItem.start}s ➔ {activeItem.end}s</span>
                  <span>⏳ Jeda Hening Terdeteksi: {activeItem.duration} Detik</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 animate-fade-in">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-[11px] font-semibold">
                  <span>🎙️</span> REALTIME ACTIVE: NARASI VOICE-OVER
                </div>
                <p className="text-sm font-semibold text-gray-200 max-w-xl mx-auto leading-relaxed font-mono">
                  "{activeItem.text}"
                </p>
                <div className="text-[11px] font-mono text-gray-400">
                  ⏱️ Timings: {activeItem.start}s ➔ {activeItem.end}s ({activeItem.duration}s)
                </div>
              </div>
            )
          ) : (
            <div className="text-xs text-gray-500 italic space-y-1">
              <div className="text-lg">🎧</div>
              <div>Putar audio di Panel 3 atau klik salah satu kartu segmen di bawah ini untuk melihat <strong>Realtime Highlight Transkrip</strong>.</div>
            </div>
          )}
        </div>

        {/* Visual Mapping Cards List */}
        {transcriptItems.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium">
              <span>Daftar Transkrip & Mapping Adegan ({transcriptItems.length} Segmen):</span>
              <span className="text-gray-500 italic">*Klik kartu untuk melompat audio ke timestamp tersebut</span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {transcriptItems.map((item) => {
                const isActive = activeIndex === item.sentence_index;
                const isVisualOnly = item.type === 'visual_only';

                return (
                  <div
                    key={item.sentence_index}
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = item.start;
                        audioRef.current.play();
                        setIsPlaying(true);
                      }
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                      isActive
                        ? isVisualOnly
                          ? 'bg-amber-500/20 border-amber-500 shadow-xl shadow-amber-500/20 scale-[1.01]'
                          : 'bg-blue-500/20 border-blue-500 shadow-xl shadow-blue-500/20 scale-[1.01]'
                        : isVisualOnly
                        ? 'bg-amber-950/20 border-amber-500/20 hover:bg-amber-950/40 text-amber-200'
                        : 'bg-gray-950/60 border-gray-800 hover:bg-gray-800/60 text-gray-300'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center border shrink-0 ${
                            isVisualOnly
                              ? 'bg-amber-500/30 text-amber-300 border-amber-500/40'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          #{item.sentence_index + 1}
                        </span>

                        {isVisualOnly ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                            <span>🔥</span> NO-VO VISUAL ONLY (100% video_cut)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-semibold">
                            🎙️ Narasi Voiceover
                          </span>
                        )}

                        {isActive && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold rounded animate-pulse">
                            ▶ NOW PLAYING
                          </span>
                        )}
                      </div>

                      <div className="font-mono text-[11px] font-bold text-gray-400">
                        {item.start}s ➔ {item.end}s ({item.duration}s)
                      </div>
                    </div>

                    {/* Text Content */}
                    <div className="text-xs font-mono leading-relaxed pl-8">
                      {isVisualOnly ? (
                        <div className="text-amber-300 font-semibold bg-black/40 p-2 rounded-lg border border-amber-500/20">
                          {item.text}
                        </div>
                      ) : (
                        <div className="text-gray-200">
                          "{item.text}"
                        </div>
                      )}
                    </div>

                    {/* Visual Cuts Breakdown */}
                    <div className="pl-8 pt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-gray-500 font-mono">Visual Cuts:</span>
                      {item.visuals.map((vis, vIdx) => (
                        <span
                          key={vIdx}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            isVisualOnly
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-bold'
                              : 'bg-gray-900 border-gray-700 text-gray-400'
                          }`}
                        >
                          Cut #{vIdx + 1}: {vis.type} ({vis.duration}s @ {vis.source_start_seconds}s)
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-10 bg-gray-950/40 border border-dashed border-gray-800 rounded-2xl text-center space-y-2">
            <div className="text-2xl">⚡</div>
            <h4 className="text-xs font-bold text-white">Faster-Whisper Transkrip Belum Diproses</h4>
            <p className="text-[11px] text-gray-400">
              Upload audio di Panel 3 atau klik tombol <strong>"⚡ Jalankan Faster-Whisper & Deteksi Gap"</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlurfilmVisualOnlyTestStep;
