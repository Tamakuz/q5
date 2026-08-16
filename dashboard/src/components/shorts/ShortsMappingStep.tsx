// dashboard/src/components/shorts/ShortsMappingStep.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { ShortsAudioSegmentData, AudioTranscriptsManifest } from './ShortsAudioStep';

export interface VideoCutMappingItem {
  id: string;
  sentence_index: number;
  text: string;
  audio_start: number;
  audio_end: number;
  duration: number;
  video_start: number;
  video_end: number;
  overlay_text?: string;
}

export interface ShortsSegmentMappingData {
  segment_id: string;
  segment_title: string;
  source_video_path: string;

  audio_path_id?: string;
  cuts_id: VideoCutMappingItem[];

  audio_path_en?: string;
  cuts_en: VideoCutMappingItem[];
}

export interface VideoMappingManifest {
  updated_at: string;
  items: Record<string, ShortsSegmentMappingData>;
}

export interface ShortsSegmentFromStep2 {
  id: string;
  title: string;
  hook_text_id?: string;
  narration_script_id?: string;
  sentences_id?: string[];

  hook_text_en?: string;
  narration_script_en?: string;
  sentences_en?: string[];

  start_time_sec?: number;
  end_time_sec?: number;
}

export interface ScriptSegmentsJSONFromStep2 {
  updated_at: string;
  source_video_id: string;
  source_video_title: string;
  source_video_path: string;
  segments: ShortsSegmentFromStep2[];
}

export interface ShortsVideoSourceItem {
  id: string;
  title: string;
  youtube_url: string;
  raw_video_path?: string;
  compressed_video_path?: string;
  duration_sec?: number;
}

export interface VideoSourcesManifest {
  updated_at: string;
  items: ShortsVideoSourceItem[];
}

const ShortsMappingStep: React.FC = () => {
  const [segments, setSegments] = useState<ShortsSegmentFromStep2[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('');
  const [audioDataMap, setAudioDataMap] = useState<Record<string, ShortsAudioSegmentData>>({});
  const [mappingMap, setMappingMap] = useState<Record<string, ShortsSegmentMappingData>>({});
  const [videoSources, setVideoSources] = useState<ShortsVideoSourceItem[]>([]);
  const [sourceVideoPath, setSourceVideoPath] = useState<string>('');

  const [selectedLang, setSelectedLang] = useState<'id' | 'en'>('id');
  const [isLoading, setIsLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Load all data on mount
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      try {
        if (window.electronAPI?.readFromProject) {
          // 1. Read Step 2 segments
          const rawSegs = await window.electronAPI.readFromProject('input/shorts/script-segments.json');
          if (rawSegs) {
            const data: ScriptSegmentsJSONFromStep2 = typeof rawSegs === 'string' ? JSON.parse(rawSegs) : rawSegs;
            if (data && data.segments && data.segments.length > 0) {
              setSegments(data.segments);
              setSelectedSegmentId(data.segments[0].id);
              if (data.source_video_path) {
                setSourceVideoPath(data.source_video_path);
              }
            }
          }

          // 2. Read Step 1 video sources
          const rawSources = await window.electronAPI.readFromProject('input/shorts/video-sources.json');
          if (rawSources) {
            const manifest: VideoSourcesManifest = typeof rawSources === 'string' ? JSON.parse(rawSources) : rawSources;
            if (manifest && manifest.items) {
              setVideoSources(manifest.items);
            }
          }

          // 3. Read Step 3 audio transcripts
          const rawAudio = await window.electronAPI.readFromProject('input/shorts/audio-transcripts.json');
          if (rawAudio) {
            const manifest: AudioTranscriptsManifest = typeof rawAudio === 'string' ? JSON.parse(rawAudio) : rawAudio;
            if (manifest && manifest.items) {
              setAudioDataMap(manifest.items);
            }
          }

          // 4. Read Step 4 existing video-mapping.json
          const rawMapping = await window.electronAPI.readFromProject('input/shorts/video-mapping.json');
          if (rawMapping) {
            const manifest: VideoMappingManifest = typeof rawMapping === 'string' ? JSON.parse(rawMapping) : rawMapping;
            if (manifest && manifest.items) {
              setMappingMap(manifest.items);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load ShortsMappingStep data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, []);

  const activeSegment = segments.find((s) => s.id === selectedSegmentId) || segments[0];
  const activeAudioData = selectedSegmentId ? audioDataMap[selectedSegmentId] : null;

  // Active raw/compressed video path
  const activeVideoPath = useMemo(() => {
    if (sourceVideoPath) return sourceVideoPath;
    if (videoSources.length > 0) {
      const item = videoSources[0];
      return item.compressed_video_path || item.raw_video_path || '';
    }
    return '';
  }, [sourceVideoPath, videoSources]);

  // Helper: Format media URL for Electron video player
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

  const activeMediaUrl = getMediaUrl(activeVideoPath);

  // Helper: Get or initialize mapping data for segment
  const getSegmentMappingData = (segId: string): ShortsSegmentMappingData => {
    if (mappingMap[segId]) return mappingMap[segId];

    const seg = segments.find((s) => s.id === segId);
    const audioData = audioDataMap[segId];

    return {
      segment_id: segId,
      segment_title: seg?.title || `Segment ${segId}`,
      source_video_path: activeVideoPath,
      audio_path_id: audioData?.audio_path_id,
      cuts_id: [],
      audio_path_en: audioData?.audio_path_en,
      cuts_en: [],
    };
  };

  const currentSegmentMapping = selectedSegmentId ? getSegmentMappingData(selectedSegmentId) : null;
  const currentCuts = selectedLang === 'id' ? currentSegmentMapping?.cuts_id || [] : currentSegmentMapping?.cuts_en || [];

  // Persist updated video-mapping.json
  const persistMappingManifest = async (updatedMap: Record<string, ShortsSegmentMappingData>) => {
    if (!window.electronAPI?.saveToProject) return;
    try {
      const manifest: VideoMappingManifest = {
        updated_at: new Date().toISOString(),
        items: updatedMap,
      };
      await window.electronAPI.saveToProject(
        'input/shorts/video-mapping.json',
        JSON.stringify(manifest, null, 2)
      );
    } catch (err) {
      console.error('Failed to save to input/shorts/video-mapping.json:', err);
    }
  };

  // Auto-Generate Video Cuts Mapping from Step 2 & Step 3
  const handleAutoMapCuts = () => {
    if (!activeSegment) return;
    const isIndo = selectedLang === 'id';
    const audioData = audioDataMap[activeSegment.id];
    const sentences = isIndo ? audioData?.sentences_id || [] : audioData?.sentences_en || [];

    if (sentences.length === 0) {
      setErrorMsg('Belum ada data transkrip audio dari Step 3 untuk dipetakan.');
      return;
    }

    const baseOffset = activeSegment.start_time_sec || 0;
    const defaultHookText = isIndo
      ? activeSegment.hook_text_id || activeSegment.title
      : activeSegment.hook_text_en || activeSegment.title;

    const generatedCuts: VideoCutMappingItem[] = sentences.map((sent, idx) => {
      const dur = parseFloat(Math.max(0.5, sent.end - sent.start).toFixed(2));
      const vStart = parseFloat((baseOffset + sent.start).toFixed(2));
      const vEnd = parseFloat((baseOffset + sent.end).toFixed(2));

      return {
        id: `cut_${selectedLang}_${idx + 1}`,
        sentence_index: idx,
        text: sent.text,
        audio_start: sent.start,
        audio_end: sent.end,
        duration: dur,
        video_start: vStart,
        video_end: vEnd,
        overlay_text: idx === 0 ? defaultHookText : sent.text,
      };
    });

    const currentMapping = getSegmentMappingData(activeSegment.id);
    const updatedMapping: ShortsSegmentMappingData = {
      ...currentMapping,
      source_video_path: activeVideoPath,
      ...(isIndo
        ? { cuts_id: generatedCuts, audio_path_id: audioData?.audio_path_id }
        : { cuts_en: generatedCuts, audio_path_en: audioData?.audio_path_en }),
    };

    const updatedMap = {
      ...mappingMap,
      [activeSegment.id]: updatedMapping,
    };

    setMappingMap(updatedMap);
    persistMappingManifest(updatedMap);
    showToast(`⚡ Berhasil auto-map ${generatedCuts.length} klip video untuk ${isIndo ? '🇮🇩 Indo' : '🇺🇸 English'}!`);
  };

  // Test Play single video cut range in video player
  const handleTestPlayCut = (videoStart: number, videoEnd: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = videoStart;
      videoRef.current.play().catch((e) => console.warn('Video play error:', e));

      const checkPause = () => {
        if (videoRef.current && videoRef.current.currentTime >= videoEnd) {
          videoRef.current.pause();
          videoRef.current.removeEventListener('timeupdate', checkPause);
        }
      };
      videoRef.current.addEventListener('timeupdate', checkPause);
    }
  };

  // Set Cut video_start from Player current time
  const handleSetStartFromPlayer = (cutId: string) => {
    if (videoRef.current) {
      const currentSec = parseFloat(videoRef.current.currentTime.toFixed(2));
      handleUpdateCut(cutId, { video_start: currentSec });
      showToast(`⏱️ Video Start di-set ke ${currentSec}s!`);
    }
  };

  // Set Cut video_end from Player current time
  const handleSetEndFromPlayer = (cutId: string) => {
    if (videoRef.current) {
      const currentSec = parseFloat(videoRef.current.currentTime.toFixed(2));
      handleUpdateCut(cutId, { video_end: currentSec });
      showToast(`⏱️ Video End di-set ke ${currentSec}s!`);
    }
  };

  // Update single cut field
  const handleUpdateCut = (cutId: string, updates: Partial<VideoCutMappingItem>) => {
    if (!activeSegment) return;
    const currentMapping = getSegmentMappingData(activeSegment.id);
    const isIndo = selectedLang === 'id';
    const targetCuts = isIndo ? currentMapping.cuts_id : currentMapping.cuts_en;

    const updatedCuts = targetCuts.map((c) => {
      if (c.id === cutId) {
        return { ...c, ...updates };
      }
      return c;
    });

    const updatedMapping: ShortsSegmentMappingData = {
      ...currentMapping,
      ...(isIndo ? { cuts_id: updatedCuts } : { cuts_en: updatedCuts }),
    };

    const updatedMap = {
      ...mappingMap,
      [activeSegment.id]: updatedMapping,
    };

    setMappingMap(updatedMap);
    persistMappingManifest(updatedMap);
  };

  return (
    <div className="p-6 bg-gray-950/90 border border-gray-800 rounded-3xl min-h-full space-y-8 text-gray-100">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-amber-500 text-gray-950 text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl border border-amber-300 animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* Step Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800/80 pb-5 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center text-2xl border border-amber-500/20 shadow-lg shadow-amber-950/40">
            🎯
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
              Step 4: Shorts Video Mapping Studio
              <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 text-xs font-mono font-semibold">
                FFmpeg Clip Cutter Prep
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Petakan potongan klip video sumber ke setiap kalimat narasi audio voiceover untuk persediaan render FFmpeg.
            </p>
          </div>
        </div>

        {/* Global Language Toggle */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-xl text-xs font-mono flex items-center gap-2">
            <span className="text-gray-400">Bahasa Mapping:</span>
            <div className="flex bg-gray-950 rounded-lg p-0.5 border border-gray-800">
              <button
                onClick={() => setSelectedLang('id')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                  selectedLang === 'id' ? 'bg-amber-500 text-gray-950 shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                🇮🇩 Indonesia
              </button>
              <button
                onClick={() => setSelectedLang('en')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                  selectedLang === 'en' ? 'bg-amber-500 text-gray-950 shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                🇺🇸 English
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-gray-400 font-mono">Memuat data video & mapping...</span>
        </div>
      ) : (
        /* Main Layout: Left Segments List + Right Video Mapping Workspace */
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Panel: Shorts Segments Sidebar List */}
          <div className="w-full lg:w-80 shrink-0 bg-gray-900/80 border border-gray-800 rounded-2xl p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800/80">
              <h2 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono flex items-center gap-2">
                <span>✂️</span> Segmen Shorts ({segments.length})
              </h2>
              <span className="text-[10px] text-gray-500 font-mono">Step 2 Output</span>
            </div>

            {segments.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500 italic border border-dashed border-gray-800 rounded-xl">
                Belum ada segmen hasil dari Step 2.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
                {segments.map((seg, i) => {
                  const isSelected = seg.id === selectedSegmentId;
                  const segMapping = mappingMap[seg.id];
                  const hasIdCuts = (segMapping?.cuts_id?.length || 0) > 0;
                  const hasEnCuts = (segMapping?.cuts_en?.length || 0) > 0;

                  return (
                    <button
                      key={seg.id}
                      onClick={() => setSelectedSegmentId(seg.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-950/30'
                          : 'bg-gray-950/60 border-gray-800/80 text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold font-mono text-amber-400 truncate">
                          #{i + 1}: {seg.title}
                        </span>
                        {isSelected && <span className="text-xs">🎯</span>}
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-gray-500">
                        <div className="flex items-center gap-1.5">
                          {hasIdCuts ? <span className="text-emerald-400">🇮🇩 {segMapping?.cuts_id?.length} Cuts</span> : <span className="text-gray-600">🇮🇩 -</span>}
                          <span>|</span>
                          {hasEnCuts ? <span className="text-emerald-400">🇺🇸 {segMapping?.cuts_en?.length} Cuts</span> : <span className="text-gray-600">🇺🇸 -</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Workspace: Video Preview & Mapping Table */}
          <div className="flex-1 min-w-0 space-y-8 w-full">
            {/* Top Bar: Source Video Player & Auto-Map Trigger */}
            <div className="bg-gray-900/70 border border-gray-800 p-5 rounded-2xl space-y-4 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2 font-mono">
                    <span>🎬</span> Source Video Preview ({activeVideoPath ? activeVideoPath.split('/').pop() : 'No Video'})
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Segment: #{segments.findIndex((s) => s.id === selectedSegmentId) + 1} - {activeSegment?.title}
                  </p>
                </div>

                <button
                  onClick={handleAutoMapCuts}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center gap-2 shrink-0"
                >
                  <span>⚡</span>
                  <span>Auto-Map Cuts dari Step 2 & 3</span>
                </button>
              </div>

              {/* Video Player */}
              {activeMediaUrl ? (
                <div className="bg-gray-950 p-3 rounded-2xl border border-gray-800 flex flex-col items-center">
                  <video
                    ref={videoRef}
                    src={activeMediaUrl}
                    controls
                    className="w-full max-h-[320px] rounded-xl object-contain bg-black"
                  />
                </div>
              ) : (
                <div className="bg-gray-950/40 border border-dashed border-gray-800 p-8 rounded-2xl text-center text-xs text-gray-500">
                  Video sumber dari Step 1 belum tersedia.
                </div>
              )}

              {/* Error Banner */}
              {errorMsg && (
                <div className="p-3 bg-red-950/80 border border-red-800/80 rounded-xl text-red-200 text-xs font-mono flex items-center justify-between">
                  <span>⚠️ {errorMsg}</span>
                  <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200">✕</button>
                </div>
              )}
            </div>

            {/* Video Cut Mapping Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2.5">
                    <span>🎬</span> Tabel Video Mapping Clip Cuts ({currentCuts.length} Klip Video)
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Potongan video dari video sumber yang dicrop untuk mengisi setiap kalimat narasi audio.
                  </p>
                </div>
              </div>

              {currentCuts.length === 0 ? (
                <div className="bg-gray-900/40 border border-dashed border-gray-800 p-10 rounded-2xl text-center space-y-3">
                  <div className="text-4xl text-amber-500/50">🎯</div>
                  <h3 className="text-sm font-bold text-gray-300">Belum Ada Video Cut Mapping</h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    Klik <strong>Auto-Map Cuts dari Step 2 & 3</strong> di atas untuk membuat potongan video otomatis dari timestamp transkrip narasi.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentCuts.map((cut, idx) => (
                    <div
                      key={cut.id}
                      className="bg-gray-900/70 border border-gray-800 hover:border-gray-700 p-4 rounded-2xl space-y-3 transition-all"
                    >
                      {/* Cut Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 bg-amber-500/10 text-amber-400 rounded-md flex items-center justify-center text-xs font-mono font-bold border border-amber-500/20 shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-800/50">
                            🎙️ Audio VO: {cut.audio_start.toFixed(1)}s - {cut.audio_end.toFixed(1)}s ({cut.duration}s)
                          </span>
                        </div>

                        <button
                          onClick={() => handleTestPlayCut(cut.video_start, cut.video_end)}
                          disabled={!activeVideoPath}
                          className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-30"
                          title="Play potongan video ini"
                        >
                          <span>▶ Play Cut ({cut.video_start}s - {cut.video_end}s)</span>
                        </button>
                      </div>

                      {/* Sentence Text Display */}
                      <div className="text-xs text-gray-300 font-sans bg-gray-950 p-2.5 rounded-xl border border-gray-800/80">
                        <span className="text-gray-500 font-mono text-[10px] mr-2">Kalimat:</span>
                        <span>"{cut.text}"</span>
                      </div>

                      {/* Video Crop Controls & Overlay Text */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-1 border-t border-gray-800/60 text-xs font-mono">
                        {/* Video Start & End Inputs */}
                        <div className="md:col-span-6 flex items-center gap-2 bg-gray-950 p-2 rounded-xl border border-gray-800">
                          <span className="text-amber-400 font-bold text-[10px]">Video Crop (s):</span>
                          
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 text-[10px]">Start:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={cut.video_start}
                              onChange={(e) => handleUpdateCut(cut.id, { video_start: parseFloat(e.target.value) || 0 })}
                              className="w-16 bg-gray-900 border border-gray-800 rounded px-1.5 py-0.5 text-amber-300 focus:outline-none"
                            />
                            <button
                              onClick={() => handleSetStartFromPlayer(cut.id)}
                              className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 text-amber-300 rounded text-[10px]"
                              title="Set Video Start dari posisi Player saat ini"
                            >
                              ⏱️ Player
                            </button>
                          </div>

                          <div className="flex items-center gap-1 ml-2">
                            <span className="text-gray-500 text-[10px]">End:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={cut.video_end}
                              onChange={(e) => handleUpdateCut(cut.id, { video_end: parseFloat(e.target.value) || 0 })}
                              className="w-16 bg-gray-900 border border-gray-800 rounded px-1.5 py-0.5 text-amber-300 focus:outline-none"
                            />
                            <button
                              onClick={() => handleSetEndFromPlayer(cut.id)}
                              className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 text-amber-300 rounded text-[10px]"
                              title="Set Video End dari posisi Player saat ini"
                            >
                              ⏱️ Player
                            </button>
                          </div>
                        </div>

                        {/* Overlay / Subtitle Text */}
                        <div className="md:col-span-6 flex items-center gap-2">
                          <span className="text-gray-400 text-[10px] shrink-0">Visual Subtitle:</span>
                          <input
                            type="text"
                            value={cut.overlay_text || ''}
                            onChange={(e) => handleUpdateCut(cut.id, { overlay_text: e.target.value })}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1 text-xs text-amber-200 focus:outline-none focus:border-amber-500 font-sans"
                            placeholder="Visual overlay text"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Persistence */}
      <div className="border-t border-gray-800/80 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
        <div className="flex items-center gap-2 font-mono">
          <span>📂 Source Video:</span>
          <code className="text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40 truncate max-w-xs">
            {activeVideoPath || 'None'}
          </code>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span>📄 Persistence Mapping:</span>
          <code className="text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
            input/shorts/video-mapping.json
          </code>
        </div>
      </div>
    </div>
  );
};

export default ShortsMappingStep;
