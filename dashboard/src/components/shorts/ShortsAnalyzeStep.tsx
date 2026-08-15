// dashboard/src/components/shorts/ShortsAnalyzeStep.tsx
import React, { useState, useEffect, useRef } from 'react';

export interface ShortsSegment {
  id: string;
  title: string;

  // Indonesian version
  hook_text_id: string;
  narration_script_id: string;
  sentences_id: string[];

  // English version
  hook_text_en: string;
  narration_script_en: string;
  sentences_en: string[];

  // Time range
  formatted_start: string;
  formatted_end: string;
  start_time_sec: number;
  end_time_sec: number;

  // Active view language tab ('id' | 'en')
  activeLang?: 'id' | 'en';
}

export interface ScriptSegmentsJSON {
  updated_at: string;
  source_video_id: string;
  source_video_title: string;
  source_video_path: string;
  segments: ShortsSegment[];
}

export interface VideoSourceItem {
  id: string;
  title: string;
  youtube_url: string;
  video_filename?: string;
  video_path?: string;
  compressed_video_filename?: string;
  compressed_video_path?: string;
  compressed_file_size_bytes?: number;
  status: 'idle' | 'downloading' | 'compressing' | 'downloaded' | 'error';
  file_size_bytes?: number;
  downloaded_at?: string;
}

interface VideoSourcesJSON {
  updated_at: string;
  items: VideoSourceItem[];
}

const DEFAULT_PROMPT_TEMPLATE = `Kamu adalah "Viral Social Media Growth Hacker & Master Scriptwriter" spesialis YouTube Shorts & TikTok FYP berniche Pabrik, Industri, Mekanik Handal, dan Street Food / Crafting.

TUGAS UTAMA:
Analisislah video mentah berikut dan tentukan jumlah segmen Shorts terbaik (1 hingga beberapa segmen). Setiap segmen WAJIB dilengkapi DUA VERSI NASKAH NARASI: **Versi Bahasa Indonesia (🇮🇩)** dan **Versi Bahasa Inggris (🇺🇸)**.

NAMA VIDEO: {{video_title}}
URL / KETERANGAN: {{video_url}}

---

FORMULA & TRIK PSIKOLOGI SCRIPTWRITING (WAJIB DIIKUTI UNTUK KEDUA BAHASA):
1. ⚡ **HOOK (00:00 - 00:04)**: Kalimat pembuka ekstrem yang memicu rasa penasaran (*Curiosity Gap* / *Pattern Interrupt*).
2. 🍿 **RETAINER & SETUP (00:04 - 00:10)**: Menjelaskan latar belakang/alat secara dramatis.
3. 🚀 **ESCALATION & BREAKDOWN (00:10 - 00:18)**: Detail teknik/kecepatan/presisi yang membuat penonton takjub.
4. ✨ **THE CLIMAX / SATISFYING MOMENT (00:18 - 00:25)**: Momen puncak paling memuaskan (*Oddly Satisfying*).
5. 🎉 **THE RESULT / PAYOFF (00:25 - 00:30)**: Hasil akhir produk massal atau karya mulus sempurna.
6. 🔄 **SEAMLESS LOOP ENDING (00:30+)**: Kalimat penutup yang dirancang khusus MENYAMBUNG KEMBALI ke kalimat Hook pembuka, sehingga saat video mengulang (*looping*), penonton tidak sadar video telah selesai!

---

FORMAT OUTPUT (STRICTLY VALID JSON ARRAY OBJECT BILINGUAL, TANPA MARKDOWN PENGANTAR):

\`\`\`json
[
  {
    "id": "seg_1",
    "title": "Mekanik Level Dewa Bongkar Mesin Karatan",
    "formatted_start": "01:15",
    "formatted_end": "01:45",
    "start_time_sec": 75,
    "end_time_sec": 105,
    "id_version": {
      "hook_text": "Sumpah, mekanik ini otaknya udah bukan manusia lagi!",
      "narration_script": "Sumpah, mekanik ini otaknya udah bukan manusia lagi. Lihat baik-baik. Dia cuma pakai satu alat rongsokan ini buat ngebongkar blok mesin karatan puluhan tahun. Kalau orang biasa pasti udah dipotong pakai gerinda. Tapi perhatiin detail tangannya, dia nemuin celah rahasia yang cuma mekanik level dewa yang tahu. Tunggu... lihat momen pas besi ini copot. Asli, ini lebih satisfying daripada meletusin bubble wrap. Mesin yang tadinya mau dibuang sekarang mulus kayak baru keluar dari pabrik. Beneran deh, kalau kalian butuh bukti skill tingkat tinggi, tonton lagi karena...",
      "sentences": [
        "Sumpah, mekanik ini otaknya udah bukan manusia lagi.",
        "Lihat baik-baik. Dia cuma pakai satu alat rongsokan ini buat ngebongkar blok mesin karatan puluhan tahun.",
        "Kalau orang biasa pasti udah dipotong pakai gerinda.",
        "Tapi perhatiin detail tangannya, dia nemuin celah rahasia yang cuma mekanik level dewa yang tahu.",
        "Tunggu... lihat momen pas besi ini copot. Asli, ini lebih satisfying daripada meletusin bubble wrap.",
        "Mesin yang tadinya mau dibuang sekarang mulus kayak baru keluar dari pabrik.",
        "Beneran deh, kalau kalian butuh bukti skill tingkat tinggi, tonton lagi karena..."
      ]
    },
    "en_version": {
      "hook_text": "I swear, this mechanic’s brain operates in 4D!",
      "narration_script": "I swear, this mechanic’s brain operates in 4D. Look closely. He only uses this single scrap tool to disassemble an engine block that's been rusted for decades. A normal person would've cut it with a grinder. But look at his hands, he found a secret clearance only a god-level mechanic knows. Wait... look at the moment this iron pops out. Honestly, this is more satisfying than popping bubble wrap. An engine that was about to be scrapped is now smooth as new. Seriously, if you need proof of high-level skill, watch again because...",
      "sentences": [
        "I swear, this mechanic’s brain operates in 4D.",
        "Look closely. He only uses this single scrap tool to disassemble an engine block that's been rusted for decades.",
        "A normal person would've cut it with a grinder.",
        "But look at his hands, he found a secret clearance only a god-level mechanic knows.",
        "Wait... look at the moment this iron pops out.",
        "Honestly, this is more satisfying than popping bubble wrap.",
        "An engine that was about to be scrapped is now smooth as new.",
        "Seriously, if you need proof of high-level skill, watch again because..."
      ]
    }
  }
]
\`\`\`

ATURAN STRICT:
- HANYA keluarkan Array JSON murni \`[...]\` tanpa triple backtick atau teks pengantar.
- Setiap segmen WAJIB memuat objek \`id_version\` (Bahasa Indonesia) dan \`en_version\` (Bahasa Inggris).
- Kedua versi naskah harus menggunakan **Hook kuat di awal** dan **Seamless Loop Ending di akhir**!`;

const ShortsAnalyzeStep: React.FC = () => {
  const [videoSources, setVideoSources] = useState<VideoSourceItem[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [promptTemplate, setPromptTemplate] = useState<string>(DEFAULT_PROMPT_TEMPLATE);
  const [jsonInput, setJsonInput] = useState<string>('');
  const [segmentsData, setSegmentsData] = useState<ScriptSegmentsJSON | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [globalLang, setGlobalLang] = useState<'id' | 'en'>('id');

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load video sources & script-segments.json on mount
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      try {
        if (window.electronAPI?.readFromProject) {
          const rawSources = await window.electronAPI.readFromProject('input/shorts/video-sources.json');
          if (rawSources) {
            const data: VideoSourcesJSON = typeof rawSources === 'string' ? JSON.parse(rawSources) : rawSources;
            if (data.items && data.items.length > 0) {
              setVideoSources(data.items);
              setSelectedVideoId(data.items[0].id);
            }
          }

          try {
            const promptRaw = await window.electronAPI.readFromProject('prompts/shortform/shorts-segment-script.md');
            if (promptRaw && typeof promptRaw === 'string') {
              setPromptTemplate(promptRaw);
            }
          } catch (e) {
            // Keep default
          }

          const rawSegments = await window.electronAPI.readFromProject('input/shorts/script-segments.json');
          if (rawSegments) {
            const parsedSegs: ScriptSegmentsJSON = typeof rawSegments === 'string' ? JSON.parse(rawSegments) : rawSegments;
            if (parsedSegs && parsedSegs.segments) {
              setSegmentsData(parsedSegs);
              if (parsedSegs.source_video_id) {
                setSelectedVideoId(parsedSegs.source_video_id);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Failed to initialize ShortsAnalyzeStep data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, []);

  const activeVideo = videoSources.find((v) => v.id === selectedVideoId) || videoSources[0];

  // Helper to format timestamp mm:ss to seconds
  const parseFormattedTimeToSec = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':');
    if (parts.length === 2) {
      return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
    }
    if (parts.length === 3) {
      return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
    }
    return parseFloat(timeStr) || 0;
  };

  // Helper to format seconds to mm:ss
  const formatSecToFormattedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format file size in B, KB, MB, GB
  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes <= 0) return '0 MB';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Format media URL for video player
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

  const activeVideoPath = activeVideo?.compressed_video_path || activeVideo?.video_path || '';
  const activeMediaUrl = getMediaUrl(activeVideoPath);

  // Generate dynamic prompt text for current video
  const compiledPrompt = promptTemplate
    .replace(/\{\{video_title\}\}/g, activeVideo?.title || activeVideo?.video_filename || 'Shorts Source Video')
    .replace(/\{\{video_url\}\}/g, activeVideo?.youtube_url || '');

  // Copy prompt to clipboard
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(compiledPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // Open Google AI Studio in browser
  const handleOpenAIStudio = () => {
    window.open('https://aistudio.google.com/', '_blank', 'noopener,noreferrer');
  };

  // Save current segmentsData state to input/shorts/script-segments.json
  const persistSegmentsData = async (data: ScriptSegmentsJSON) => {
    if (!window.electronAPI?.saveToProject) return;
    try {
      await window.electronAPI.saveToProject(
        'input/shorts/script-segments.json',
        JSON.stringify(data, null, 2)
      );
    } catch (err) {
      console.error('Failed to save to input/shorts/script-segments.json:', err);
    }
  };

  // Helper to split script text into sentences array
  const splitSentences = (text: string): string[] => {
    if (!text || !text.trim()) return [];
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  // Import and Parse JSON from AI Studio (Supports Bilingual id_version & en_version)
  const handleImportJSON = () => {
    setImportError(null);
    if (!jsonInput.trim()) {
      setImportError('Harap tempel (paste) output JSON dari AI Studio terlebih dahulu.');
      return;
    }

    try {
      let cleanText = jsonInput.trim();
      if (cleanText.includes('```')) {
        const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (match && match[1]) {
          cleanText = match[1].trim();
        }
      }

      const parsed = JSON.parse(cleanText);
      let rawSegmentsArr: any[] = [];

      if (Array.isArray(parsed)) {
        rawSegmentsArr = parsed;
      } else if (parsed && Array.isArray(parsed.segments)) {
        rawSegmentsArr = parsed.segments;
      } else if (parsed && Array.isArray(parsed.data)) {
        rawSegmentsArr = parsed.data;
      } else if (parsed && Array.isArray(parsed.shorts)) {
        rawSegmentsArr = parsed.shorts;
      } else if (parsed && typeof parsed === 'object') {
        rawSegmentsArr = [parsed];
      } else {
        throw new Error('Format JSON harus berupa Array Object `[...]` atau Object yang memuat segmen video.');
      }

      const formattedSegments: ShortsSegment[] = rawSegmentsArr.map((item: any, idx: number) => {
        const startSec = item.start_time_sec !== undefined ? Number(item.start_time_sec) : parseFormattedTimeToSec(item.formatted_start);
        const endSec = item.end_time_sec !== undefined ? Number(item.end_time_sec) : parseFormattedTimeToSec(item.formatted_end);

        // Parse Indonesian Version
        const idVer = item.id_version || {};
        const hookId = idVer.hook_text || item.hook_text_id || item.hook_id || item.hook_text || 'Hook Shorts Bahasa Indonesia';
        const scriptId = idVer.narration_script || item.narration_script_id || item.script_id || item.narration_script || item.script || '';
        let sentencesIdArr: string[] = idVer.sentences || item.sentences_id;
        if (!sentencesIdArr || !Array.isArray(sentencesIdArr) || sentencesIdArr.length === 0) {
          sentencesIdArr = splitSentences(scriptId);
        }

        // Parse English Version
        const enVer = item.en_version || {};
        const hookEn = enVer.hook_text || item.hook_text_en || item.hook_en || item.hook_text || 'Shorts English Hook Text';
        const scriptEn = enVer.narration_script || item.narration_script_en || item.script_en || item.narration_script || item.script || '';
        let sentencesEnArr: string[] = enVer.sentences || item.sentences_en;
        if (!sentencesEnArr || !Array.isArray(sentencesEnArr) || sentencesEnArr.length === 0) {
          sentencesEnArr = splitSentences(scriptEn);
        }

        return {
          id: item.id || `seg_${Date.now()}_${idx + 1}`,
          title: item.title || `Shorts Segment #${idx + 1}`,
          formatted_start: item.formatted_start || formatSecToFormattedTime(startSec),
          formatted_end: item.formatted_end || formatSecToFormattedTime(endSec),
          start_time_sec: startSec,
          end_time_sec: endSec,

          hook_text_id: hookId,
          narration_script_id: scriptId,
          sentences_id: sentencesIdArr,

          hook_text_en: hookEn,
          narration_script_en: scriptEn,
          sentences_en: sentencesEnArr,

          activeLang: 'id',
        };
      });

      const newSegmentsData: ScriptSegmentsJSON = {
        updated_at: new Date().toISOString(),
        source_video_id: activeVideo?.id || 'default_video',
        source_video_title: activeVideo?.title || activeVideo?.video_filename || 'Shorts Source',
        source_video_path: activeVideoPath,
        segments: formattedSegments,
      };

      setSegmentsData(newSegmentsData);
      persistSegmentsData(newSegmentsData);
      setJsonInput('');
    } catch (err: any) {
      console.error('Import JSON parse error:', err);
      setImportError(err.message || 'Format JSON tidak valid.');
    }
  };

  // Play segment timestamp range in video player
  const handlePlaySegmentPreview = (startSec: number, segId: string) => {
    setActiveSegmentId(segId);
    if (videoRef.current) {
      videoRef.current.currentTime = startSec;
      videoRef.current.play().catch((e) => console.warn('Video play error:', e));
    }
  };

  // Update a segment field
  const handleUpdateSegment = (segId: string, updates: Partial<ShortsSegment>) => {
    if (!segmentsData) return;

    const updatedSegments = segmentsData.segments.map((seg) => {
      if (seg.id === segId) {
        const updated = { ...seg, ...updates };
        if (updates.start_time_sec !== undefined) {
          updated.formatted_start = formatSecToFormattedTime(updates.start_time_sec);
        }
        if (updates.end_time_sec !== undefined) {
          updated.formatted_end = formatSecToFormattedTime(updates.end_time_sec);
        }
        if (updates.narration_script_id !== undefined) {
          updated.sentences_id = splitSentences(updates.narration_script_id);
        }
        if (updates.narration_script_en !== undefined) {
          updated.sentences_en = splitSentences(updates.narration_script_en);
        }
        return updated;
      }
      return seg;
    });

    const updatedData: ScriptSegmentsJSON = {
      ...segmentsData,
      updated_at: new Date().toISOString(),
      segments: updatedSegments,
    };

    setSegmentsData(updatedData);
    persistSegmentsData(updatedData);
  };

  // Add a manual segment card
  const handleAddManualSegment = () => {
    const newSeg: ShortsSegment = {
      id: `seg_${Date.now()}_${(segmentsData?.segments.length || 0) + 1}`,
      title: `Shorts Segment #${(segmentsData?.segments.length || 0) + 1}`,
      formatted_start: '00:00',
      formatted_end: '00:45',
      start_time_sec: 0,
      end_time_sec: 45,

      hook_text_id: 'Sumpah, mekanik ini otaknya udah bukan manusia lagi!',
      narration_script_id: 'Sumpah, mekanik ini otaknya udah bukan manusia lagi. Lihat baik-baik...',
      sentences_id: ['Sumpah, mekanik ini otaknya udah bukan manusia lagi.', 'Lihat baik-baik...'],

      hook_text_en: "I swear, this mechanic's brain operates in 4D!",
      narration_script_en: "I swear, this mechanic's brain operates in 4D. Look closely...",
      sentences_en: ["I swear, this mechanic's brain operates in 4D.", 'Look closely...'],

      activeLang: globalLang,
    };

    const updatedSegments = [...(segmentsData?.segments || []), newSeg];
    const updatedData: ScriptSegmentsJSON = {
      updated_at: new Date().toISOString(),
      source_video_id: activeVideo?.id || 'default_video',
      source_video_title: activeVideo?.title || activeVideo?.video_filename || 'Shorts Source',
      source_video_path: activeVideoPath,
      segments: updatedSegments,
    };

    setSegmentsData(updatedData);
    persistSegmentsData(updatedData);
  };

  // Delete segment card
  const handleDeleteSegment = (segId: string) => {
    if (!segmentsData) return;
    const updatedSegments = segmentsData.segments.filter((s) => s.id !== segId);
    const updatedData: ScriptSegmentsJSON = {
      ...segmentsData,
      updated_at: new Date().toISOString(),
      segments: updatedSegments,
    };
    setSegmentsData(updatedData);
    persistSegmentsData(updatedData);
  };

  // Quick timestamp setter from current video player time
  const handleSetTimeFromPlayer = (segId: string, type: 'start' | 'end') => {
    if (!videoRef.current) return;
    const currentSec = Math.floor(videoRef.current.currentTime);
    if (type === 'start') {
      handleUpdateSegment(segId, { start_time_sec: currentSec });
    } else {
      handleUpdateSegment(segId, { end_time_sec: currentSec });
    }
  };

  return (
    <div className="p-6 bg-gray-950/90 border border-gray-800 rounded-3xl min-h-full space-y-8 text-gray-100">
      {/* Step Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800/80 pb-5 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center text-2xl border border-amber-500/20 shadow-lg shadow-amber-950/40">
            ⚡
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
              Step 2: Multi-Segment & AI Script Generator
              <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 text-xs font-mono font-semibold">
                Bilingual (🇮🇩 Indo & 🇺🇸 English)
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Copy prompt ke Google AI Studio, tempel output JSON untuk mengimpor segmen Shorts bilingual (Bahasa Indonesia & Bahasa Inggris).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-gray-900 border border-gray-800 rounded-xl text-xs font-mono flex items-center gap-2">
            <span className="text-gray-400">Tampilan Naskah:</span>
            <div className="flex bg-gray-950 rounded-lg p-0.5 border border-gray-800">
              <button
                onClick={() => setGlobalLang('id')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  globalLang === 'id' ? 'bg-amber-500 text-gray-950 shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                🇮🇩 Indo
              </button>
              <button
                onClick={() => setGlobalLang('en')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  globalLang === 'en' ? 'bg-amber-500 text-gray-950 shadow' : 'text-gray-400 hover:text-gray-200'
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
          <span className="text-xs text-gray-400 font-mono">Memuat data segmen...</span>
        </div>
      ) : (
        /* Main Workspace: Left Source Video Sidebar + Right Content Area */
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Panel: Source Video Sidebar List */}
          <div className="w-full lg:w-80 shrink-0 bg-gray-900/80 border border-gray-800 rounded-2xl p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800/80">
              <h2 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono flex items-center gap-2">
                <span>📂</span> Source Videos ({videoSources.length})
              </h2>
              <span className="text-[10px] text-gray-500 font-mono">Step 1 Assets</span>
            </div>

            {videoSources.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500 italic border border-dashed border-gray-800 rounded-xl">
                Belum ada video diunduh di Step 1.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
                {videoSources.map((v, i) => {
                  const isSelected = v.id === selectedVideoId;
                  const isComp = Boolean(v.compressed_video_path);
                  const displaySize = formatFileSize(v.compressed_file_size_bytes || v.file_size_bytes);

                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVideoId(v.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-950/30'
                          : 'bg-gray-950/60 border-gray-800/80 text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold font-mono text-amber-400 truncate">
                          #{i + 1}: {v.title || v.video_filename || `Video ${i + 1}`}
                        </span>
                        {isSelected && <span className="text-xs">🎯</span>}
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-gray-500">
                        <span>{isComp ? '📦 Compressed' : '💾 Raw'}</span>
                        <span className="text-cyan-400 font-semibold">{displaySize}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Area: Prompt Copier, JSON Importer & Segments List */}
          <div className="flex-1 min-w-0 space-y-8 w-full">
            {/* Section 1: Interactive Selected Video Player */}
            {activeMediaUrl && (
              <div className="bg-gray-900/60 border border-gray-800 p-5 rounded-2xl space-y-3 shadow-inner">
                <div className="flex items-center justify-between text-xs font-mono text-gray-300">
                  <span className="flex items-center gap-2 font-bold text-amber-300">
                    <span>📹</span> Player: {activeVideo?.title || activeVideo?.video_filename}
                  </span>
                  <span className="text-gray-500 text-[11px] truncate max-w-[280px]">
                    Path: <code className="text-gray-400">{activeVideoPath}</code>
                  </span>
                </div>
                <video
                  ref={videoRef}
                  src={activeMediaUrl}
                  controls
                  className="w-full rounded-xl max-h-72 bg-black object-contain border border-gray-800 shadow-2xl"
                />
              </div>
            )}

            {/* Section 2: AI Studio Prompt Copier & Import Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Prompt Box */}
              <div className="bg-gray-900/70 border border-gray-800 p-5 rounded-2xl space-y-3.5 shadow-md flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2 font-mono">
                      <span>📋</span> 1. Prompt AI Studio (Bilingual)
                    </h2>
                    <span className="text-[10px] text-gray-500 font-mono">Template Ready</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Prompt terisi otomatis dengan instruksi naskah dual-language (🇮🇩 Indo & 🇺🇸 English).
                  </p>
                  <textarea
                    value={compiledPrompt}
                    readOnly
                    rows={7}
                    className="w-full bg-gray-950 border border-gray-800/90 rounded-xl p-3 text-[11px] text-gray-300 font-mono focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    onClick={handleCopyPrompt}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-gray-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center gap-2"
                  >
                    <span>{copiedPrompt ? '✅ Copied!' : '📋 Copy Prompt'}</span>
                  </button>

                  <button
                    onClick={handleOpenAIStudio}
                    className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <span>↗ Open AI Studio</span>
                  </button>
                </div>
              </div>

              {/* Paste Output JSON */}
              <div className="bg-gray-900/70 border border-gray-800 p-5 rounded-2xl space-y-3.5 shadow-md flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                      <span>📥</span> 2. Paste Output JSON
                    </h2>
                    <span className="text-[10px] text-gray-500 font-mono">Bilingual Parser</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Tempelkan output JSON dari AI Studio di sini lalu klik Import.
                  </p>
                  <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='[{"id": "seg_1", "id_version": {"hook_text": "...", "narration_script": "..."}, "en_version": {"hook_text": "...", "narration_script": "..."}}]'
                    rows={7}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-[11px] text-emerald-300 font-mono focus:outline-none focus:border-emerald-500 transition-all placeholder:text-gray-700 leading-relaxed"
                  />
                </div>

                {importError && (
                  <div className="p-2.5 bg-red-950/80 border border-red-800/80 rounded-xl text-red-200 text-xs font-mono flex items-center justify-between">
                    <span>⚠️ {importError}</span>
                    <button onClick={() => setImportError(null)} className="text-red-400 hover:text-red-200">✕</button>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleImportJSON}
                    disabled={!jsonInput.trim()}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-gray-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-40"
                  >
                    <span>📥</span>
                    <span>Import & Parse Segmen Bilingual</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Section 3: Generated / Imported Segments List & Editor */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2.5">
                  <span>✂️</span> Daftar Segmen Shorts ({segmentsData?.segments.length || 0} Segmen)
                </h2>

                <button
                  onClick={handleAddManualSegment}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                >
                  <span>➕</span> Tambah Segmen Manual
                </button>
              </div>

              {!segmentsData || segmentsData.segments.length === 0 ? (
                <div className="bg-gray-900/40 border border-dashed border-gray-800 p-10 rounded-2xl text-center space-y-3">
                  <div className="text-4xl text-amber-500/50">⚡</div>
                  <h3 className="text-sm font-bold text-gray-300">Belum Ada Segmen Shorts</h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    Copy prompt di atas, jalankan di Google AI Studio, lalu tempelkan output JSON untuk mengimpor segmen Shorts otomatis.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {segmentsData.segments.map((seg, idx) => {
                    const duration = Math.max(0, seg.end_time_sec - seg.start_time_sec);
                    const isActive = activeSegmentId === seg.id;
                    const cardLang = seg.activeLang || globalLang;

                    const isIndo = cardLang === 'id';
                    const activeHook = isIndo ? seg.hook_text_id : seg.hook_text_en;
                    const activeScript = isIndo ? seg.narration_script_id : seg.narration_script_en;
                    const activeSentences = isIndo ? seg.sentences_id : seg.sentences_en;

                    return (
                      <div
                        key={seg.id}
                        className={`bg-gray-900/70 border ${
                          isActive ? 'border-amber-500 shadow-lg shadow-amber-950/20' : 'border-gray-800 hover:border-gray-700'
                        } p-5 rounded-2xl space-y-4 transition-all`}
                      >
                        {/* Segment Card Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-800/60 gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 bg-amber-500/10 text-amber-400 rounded-lg flex items-center justify-center text-xs font-mono font-bold border border-amber-500/20">
                              #{idx + 1}
                            </span>
                            <input
                              type="text"
                              value={seg.title}
                              onChange={(e) => handleUpdateSegment(seg.id, { title: e.target.value })}
                              className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500 transition-all font-sans min-w-[240px]"
                              placeholder="Judul Segmen Shorts"
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Card Language Tab Switcher */}
                            <div className="flex bg-gray-950 rounded-lg p-0.5 border border-gray-800">
                              <button
                                onClick={() => handleUpdateSegment(seg.id, { activeLang: 'id' })}
                                className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                  isIndo ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:text-gray-200'
                                }`}
                              >
                                🇮🇩 Indo
                              </button>
                              <button
                                onClick={() => handleUpdateSegment(seg.id, { activeLang: 'en' })}
                                className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                  !isIndo ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:text-gray-200'
                                }`}
                              >
                                🇺🇸 English
                              </button>
                            </div>

                            <span className="px-2.5 py-1 bg-amber-950/80 text-amber-300 border border-amber-800/60 rounded-full text-[10px] font-mono font-bold">
                              Durasi: {duration} Detik
                            </span>

                            <button
                              onClick={() => handlePlaySegmentPreview(seg.start_time_sec, seg.id)}
                              className="px-3.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"
                            >
                              <span>▶ Play Segmen ({seg.formatted_start} - {seg.formatted_end})</span>
                            </button>

                            <button
                              onClick={() => handleDeleteSegment(seg.id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-all text-xs"
                              title="Hapus Segmen"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Segment Inputs Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Start & End Timestamps */}
                          <div className="space-y-3">
                            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800/80 space-y-2">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                Timestamp Range (Waktu Segmen)
                              </label>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <span className="text-[10px] text-gray-500 block mb-1">Start Time (sec):</span>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      value={seg.start_time_sec}
                                      onChange={(e) =>
                                        handleUpdateSegment(seg.id, { start_time_sec: Number(e.target.value) })
                                      }
                                      className="w-full bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                                    />
                                    <button
                                      onClick={() => handleSetTimeFromPlayer(seg.id, 'start')}
                                      className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-[10px] text-gray-300 rounded font-mono shrink-0"
                                      title="Set Start Time dari posisi player saat ini"
                                    >
                                      ⏱️ Set
                                    </button>
                                  </div>
                                  <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                                    ({seg.formatted_start})
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[10px] text-gray-500 block mb-1">End Time (sec):</span>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      value={seg.end_time_sec}
                                      onChange={(e) =>
                                        handleUpdateSegment(seg.id, { end_time_sec: Number(e.target.value) })
                                      }
                                      className="w-full bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                                    />
                                    <button
                                      onClick={() => handleSetTimeFromPlayer(seg.id, 'end')}
                                      className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-[10px] text-gray-300 rounded font-mono shrink-0"
                                      title="Set End Time dari posisi player saat ini"
                                    >
                                      ⏱️ Set
                                    </button>
                                  </div>
                                  <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                                    ({seg.formatted_end})
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Hook Text Input */}
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                                <span>Hook Text ({isIndo ? '🇮🇩 Bahasa Indonesia' : '🇺🇸 English'})</span>
                                <span className="text-gray-500">3 Detik Pertama</span>
                              </label>
                              <input
                                type="text"
                                value={activeHook}
                                onChange={(e) =>
                                  handleUpdateSegment(seg.id, isIndo ? { hook_text_id: e.target.value } : { hook_text_en: e.target.value })
                                }
                                placeholder={isIndo ? 'Contoh: Sumpah, mekanik ini otaknya...' : 'Example: I swear, this mechanic’s brain...'}
                                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-amber-300 focus:outline-none focus:border-amber-500 font-mono"
                              />
                            </div>
                          </div>

                          {/* Narration Script Textarea */}
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                              <span>Naskah Narasi Voiceover ({isIndo ? '🇮🇩 Bahasa Indonesia' : '🇺🇸 English'})</span>
                              <span className="text-amber-400">{isIndo ? '🇮🇩 Indo' : '🇺🇸 English'} Active</span>
                            </label>
                            <textarea
                              value={activeScript}
                              onChange={(e) =>
                                handleUpdateSegment(
                                  seg.id,
                                  isIndo ? { narration_script_id: e.target.value } : { narration_script_en: e.target.value }
                                )
                              }
                              placeholder={
                                isIndo
                                  ? 'Tempel atau ketik naskah narasi Bahasa Indonesia di sini...'
                                  : 'Enter or paste English narration script here...'
                              }
                              rows={5}
                              className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-amber-500 transition-all font-sans leading-relaxed resize-none"
                            />
                            <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono px-1">
                              <span>Kata: {activeScript.trim().split(/\s+/).filter(Boolean).length} Kata</span>
                              <span>Kalimat: {activeSentences.length} Kalimat</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Storage Path Consistency */}
      <div className="border-t border-gray-800/80 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
        <div className="flex items-center gap-2 font-mono">
          <span>📄 Persistence Segmen:</span>
          <code className="text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
            input/shorts/script-segments.json
          </code>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span>📋 Prompt Template:</span>
          <code className="text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
            dashboard/prompts/shortform/shorts-segment-script.md
          </code>
        </div>
      </div>
    </div>
  );
};

export default ShortsAnalyzeStep;
