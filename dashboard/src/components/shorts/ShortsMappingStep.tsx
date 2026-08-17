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
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
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

  // Active raw video path (prioritizing original HD video)
  const activeVideoPath = useMemo(() => {
    if (videoSources.length > 0) {
      const item = videoSources[0];
      return item.raw_video_path || (item as any).video_path || item.compressed_video_path || '';
    }
    if (sourceVideoPath) return sourceVideoPath;
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

  // Build AI Studio Prompt for current segment & language
  const buildAiStudioPrompt = () => {
    if (!activeSegment) return '';
    const isIndo = selectedLang === 'id';
    const audioData = audioDataMap[activeSegment.id];
    const sentences = isIndo ? audioData?.sentences_id || [] : audioData?.sentences_en || [];

    const activeVideoItem = videoSources[0];
    const sourceVideoTitle = activeVideoItem?.title || activeVideoPath.split('/').pop() || 'Raw Video Source';
    const sourceVideoDuration = activeVideoItem?.duration_sec || 300;

    const transcriptJsonStr = JSON.stringify(
      sentences.map((sent, idx) => ({
        sentence_index: idx,
        text: sent.text,
        audio_start: sent.start,
        audio_end: sent.end,
        duration: parseFloat(Math.max(0.5, sent.end - sent.start).toFixed(2)),
      })),
      null,
      2
    );

    return `Kamu adalah "AI Video Director & Precision Visual Clipper" khusus untuk format YouTube Shorts & TikTok Vertikal (9:16).

---

### INPUT YANG DIBERIKAN:
- **Video Sumber Mentah**: \`${sourceVideoTitle}\` (Durasi Total: \`${sourceVideoDuration}\`s)
- **Segmen Shorts #${segments.findIndex((s) => s.id === selectedSegmentId) + 1}**: \`${activeSegment.title}\`
- **Rentang Waktu Sumber Video**: Dari detik \`0\`s hingga detik \`${sourceVideoDuration}\`s (Bebas memilih potongan adegan paling satisfying & dramatis dari sepanjang video mentah)
- **Bahasa Narasi**: \`${isIndo ? 'Bahasa Indonesia' : 'English'}\`
- **DATA TRANSKRIP NASKAH AUDIO (VO)**:
\`\`\`json
${transcriptJsonStr}
\`\`\`

---

### 🚨 TUGAS UTAMA:
Cocokkan SETIAP KALIMAT NARASI pada transkrip audio di atas dengan potongan adegan visual (clip cuts) dari video mentah sumber secara sinematik dan dramatis!

---

### 📌 ATURAN TIMELINE & VISUAL CUTS:
1. **EXACT DURATION MATCH**: Durasi visual (\`duration\`) untuk setiap klip WAJIB SAMA PERSIS dengan durasi pengucapan di Voice Over (\`audio_end - audio_start\`).
2. **SEEK START (\`video_start\`)**: Tentukan waktu mulai adegan (\`video_start\` dalam detik desimal) dari video mentah yang paling dramatis atau menggambarkan kalimat narasi tersebut.
3. **SEEK END (\`video_end\`)**: \`video_end = video_start + duration\`.

---

### 📦 FORMAT OUTPUT (MURNI JSON ARRAY):

\`\`\`json
[
  {
    "sentence_index": 0,
    "text": "${sentences[0]?.text || 'Sentence text here'}",
    "audio_start": 0.0,
    "audio_end": 4.5,
    "duration": 4.5,
    "video_start": ${activeSegment.start_time_sec || 0},
    "video_end": ${(activeSegment.start_time_sec || 0) + 4.5}
  }
]
\`\`\`

PENTING: MURNI JSON ARRAY tanpa markdown \`\`\`json.`;
  };

  // Copy AI Studio Prompt to Clipboard
  const handleCopyPrompt = () => {
    const promptText = buildAiStudioPrompt();
    if (promptText) {
      navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      showToast('📋 Prompt AI Studio Video Mapping berhasil disalin!');
      setTimeout(() => setCopiedPrompt(false), 2500);
    }
  };

  // Open Google AI Studio in External Browser
  const handleOpenAiStudio = () => {
    window.open('https://aistudio.google.com/', '_blank');
  };

  // Import JSON Output from AI Studio
  const handleImportJson = () => {
    setErrorMsg(null);
    try {
      if (!jsonInput.trim()) {
        throw new Error('Paste teks JSON dari AI Studio terlebih dahulu.');
      }

      let cleaned = jsonInput.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(cleaned);
      let cutsArray: any[] = [];

      if (Array.isArray(parsed)) {
        cutsArray = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.timeline)) cutsArray = parsed.timeline;
        else if (Array.isArray(parsed.cuts)) cutsArray = parsed.cuts;
        else if (Array.isArray(parsed.items)) cutsArray = parsed.items;
        else if (selectedLang === 'id' && Array.isArray(parsed.cuts_id)) cutsArray = parsed.cuts_id;
        else if (selectedLang === 'en' && Array.isArray(parsed.cuts_en)) cutsArray = parsed.cuts_en;
      }

      if (!cutsArray || cutsArray.length === 0) {
        throw new Error('Format JSON tidak valid atau tidak berisi array potongan video (cuts/timeline).');
      }

      const isIndo = selectedLang === 'id';
      const audioData = audioDataMap[activeSegment.id];
      const sentences = isIndo ? audioData?.sentences_id || [] : audioData?.sentences_en || [];

      const formattedCuts: VideoCutMappingItem[] = cutsArray.map((item: any, idx: number) => {
        const matchingSent = sentences[idx] || sentences.find((s) => s.text === item.text);
        const aStart = item.audio_start !== undefined ? item.audio_start : (matchingSent ? matchingSent.start : idx * 4.5);
        const aEnd = item.audio_end !== undefined ? item.audio_end : (matchingSent ? matchingSent.end : (idx + 1) * 4.5);
        const dur = parseFloat(Math.max(0.5, item.duration || (aEnd - aStart)).toFixed(2));
        const vStart = parseFloat(Number(item.video_start !== undefined ? item.video_start : (item.ss !== undefined ? item.ss : (activeSegment.start_time_sec || 0) + aStart)).toFixed(2));
        const vEnd = parseFloat(Number(item.video_end !== undefined ? item.video_end : (item.se !== undefined ? item.se : (vStart + dur))).toFixed(2));

        return {
          id: `cut_${selectedLang}_${idx + 1}`,
          sentence_index: item.sentence_index !== undefined ? item.sentence_index : idx,
          text: item.text || matchingSent?.text || '',
          audio_start: aStart,
          audio_end: aEnd,
          duration: dur,
          video_start: vStart,
          video_end: vEnd,
        };
      });

      const currentMapping = getSegmentMappingData(activeSegment.id);
      const updatedMapping: ShortsSegmentMappingData = {
        ...currentMapping,
        source_video_path: activeVideoPath,
        ...(isIndo
          ? { cuts_id: formattedCuts, audio_path_id: audioData?.audio_path_id }
          : { cuts_en: formattedCuts, audio_path_en: audioData?.audio_path_en }),
      };

      const updatedMap = {
        ...mappingMap,
        [activeSegment.id]: updatedMapping,
      };

      setMappingMap(updatedMap);
      persistMappingManifest(updatedMap);

      setShowImportModal(false);
      setJsonInput('');
      showToast(`🎉 Berhasil mengimpor ${formattedCuts.length} Video Cut Mapping dari AI Studio!`);
    } catch (err: any) {
      console.error('Import JSON Mapping Error:', err);
      setErrorMsg(err.message || 'Gagal mengimpor JSON mapping.');
    }
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
                Pure Video Clip Cuts
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Salin prompt AI Studio, dapatkan pemetaan potong adegan video sinematik (pure video cuts) per segmen Shorts, lalu impor JSON hasilnya.
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

          {/* Right Workspace: AI Studio Hub Bar & Mapping Table */}
          <div className="flex-1 min-w-0 space-y-8 w-full">
            {/* AI Studio Prompt Hub Box */}
            <div className="bg-gray-900/70 border border-gray-800 p-5 rounded-2xl space-y-4 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800/80 pb-4">
                <div>
                  <h2 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2 font-mono">
                    <span>⚡</span> AI Studio Video Mapping Hub ({selectedLang === 'id' ? '🇮🇩 Bahasa Indonesia' : '🇺🇸 English'})
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Segment: #{segments.findIndex((s) => s.id === selectedSegmentId) + 1} - {activeSegment?.title}
                  </p>
                </div>

                {/* AI Studio Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={handleCopyPrompt}
                    className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow"
                  >
                    <span>{copiedPrompt ? '✅ Copied!' : '📋 Copy Prompt AI Studio'}</span>
                  </button>

                  <button
                    onClick={handleOpenAiStudio}
                    className="px-4 py-2 bg-gray-950 hover:bg-gray-800 text-gray-200 border border-gray-800 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5"
                  >
                    <span>↗</span> Open AI Studio
                  </button>

                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center gap-1.5"
                  >
                    <span>📥</span> Import JSON Mapping
                  </button>
                </div>
              </div>

              {/* Source Video Preview Player */}
              {activeMediaUrl ? (
                <div className="bg-gray-950 p-3 rounded-2xl border border-gray-800 flex flex-col items-center">
                  <video
                    ref={videoRef}
                    src={activeMediaUrl}
                    controls
                    className="w-full max-h-[300px] rounded-xl object-contain bg-black"
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
                    <span>🎬</span> Hasil Video Mapping Clip Cuts ({currentCuts.length} Klip Video)
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Potongan adegan video dari AI Studio yang dicrop untuk mengisi setiap kalimat narasi voiceover.
                  </p>
                </div>
              </div>

              {currentCuts.length === 0 ? (
                <div className="bg-gray-900/40 border border-dashed border-gray-800 p-10 rounded-2xl text-center space-y-3">
                  <div className="text-4xl text-amber-500/50">🎯</div>
                  <h3 className="text-sm font-bold text-gray-300">Belum Ada Video Cut Mapping</h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    Klik <strong>Copy Prompt AI Studio</strong>, masukkan ke AI Studio, lalu klik <strong>Import JSON Mapping</strong> untuk memasukkan hasil potongan adegan video AI.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentCuts.map((cut, idx) => (
                    <div
                      key={cut.id}
                      className="bg-gray-900/70 border border-gray-800 hover:border-gray-700 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                    >
                      {/* Left: Cut Index, Voiceover Sentence Text */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="w-6 h-6 bg-amber-500/10 text-amber-400 rounded-md flex items-center justify-center text-xs font-mono font-bold border border-amber-500/20 shrink-0">
                          #{idx + 1}
                        </span>

                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <span className="text-xs text-gray-200 font-sans truncate">
                            "{cut.text}"
                          </span>
                          <span className="text-[10px] font-mono text-gray-500">
                            🎙️ Audio VO: <strong className="text-amber-400">{cut.audio_start.toFixed(1)}s - {cut.audio_end.toFixed(1)}s</strong> ({cut.duration}s)
                          </span>
                        </div>
                      </div>

                      {/* Right: Video Crop Controls & Play Cut Button */}
                      <div className="flex items-center gap-3 shrink-0 font-mono">
                        <div className="flex items-center gap-1.5 bg-gray-950 p-2 rounded-xl border border-gray-800 text-xs">
                          <span className="text-amber-400 font-bold text-[10px]">Crop:</span>
                          
                          <span className="text-gray-500 text-[10px]">Start:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={cut.video_start}
                            onChange={(e) => handleUpdateCut(cut.id, { video_start: parseFloat(e.target.value) || 0 })}
                            className="w-16 bg-gray-900 border border-gray-800 rounded px-1.5 py-0.5 text-amber-300 focus:outline-none text-xs"
                          />
                          <button
                            onClick={() => handleSetStartFromPlayer(cut.id)}
                            className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 text-amber-300 rounded text-[10px]"
                            title="Set Video Start dari posisi Player saat ini"
                          >
                            ⏱️ Player
                          </button>

                          <span className="text-gray-500 text-[10px] ml-1">End:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={cut.video_end}
                            onChange={(e) => handleUpdateCut(cut.id, { video_end: parseFloat(e.target.value) || 0 })}
                            className="w-16 bg-gray-900 border border-gray-800 rounded px-1.5 py-0.5 text-amber-300 focus:outline-none text-xs"
                          />
                          <button
                            onClick={() => handleSetEndFromPlayer(cut.id)}
                            className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 text-amber-300 rounded text-[10px]"
                            title="Set Video End dari posisi Player saat ini"
                          >
                            ⏱️ Player
                          </button>
                        </div>

                        <button
                          onClick={() => handleTestPlayCut(cut.video_start, cut.video_end)}
                          disabled={!activeVideoPath}
                          className="px-3.5 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-30 shrink-0"
                          title="Play potongan video ini"
                        >
                          <span>▶ Play Cut ({cut.video_start}s - {cut.video_end}s)</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* JSON Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-amber-500/40 rounded-3xl p-6 w-full max-w-2xl space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-sm font-bold text-amber-300 flex items-center gap-2 font-mono">
                <span>📥</span> Import JSON Video Mapping dari AI Studio ({selectedLang === 'id' ? '🇮🇩 Indo' : '🇺🇸 English'})
              </h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-500 hover:text-gray-200 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Paste teks hasil JSON dari AI Studio di bawah ini:
            </p>

            <textarea
              rows={10}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='Paste JSON array [...] di sini...'
              className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs font-mono text-amber-200 focus:outline-none focus:border-amber-500"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                onClick={handleImportJson}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-600/20"
              >
                ⚡ Process & Apply AI Mapping
              </button>
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
