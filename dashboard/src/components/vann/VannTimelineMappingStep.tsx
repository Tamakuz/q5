// dashboard/src/components/waku/WakuTimelineMappingStep.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  validateWakuWordTranscript,
  WakuTranscriptData,
  WakuSegmentTimestamp,
} from '../../utils/wakuValidation';

const api = window.electronAPI;

interface WakuTimelineMappingStepProps {
  onStepChange?: (step: 'upload') => void;
}

export interface TimelineClipItem {
  clip_id: number;
  segment_id: number;
  part_id: number;
  quote: string;
  image_path?: string;
  image_url?: string;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
}

export interface FullTimelineData {
  title?: string;
  total_duration_sec: number;
  audio_tracks?: any[];
  video_clips: TimelineClipItem[];
  captions?: any[];
  segments?: WakuSegmentTimestamp[];
}

export interface BatchTopicItem {
  id: number;
  title: string;
  summary?: string;
  hasTimeline?: boolean;
}

const WakuTimelineMappingStep: React.FC<WakuTimelineMappingStepProps> = ({ onStepChange }) => {
  const [batchTopics, setBatchTopics] = useState<BatchTopicItem[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<number | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>('');

  const [timelineData, setTimelineData] = useState<FullTimelineData | null>(null);
  const [breakdownSegments, setBreakdownSegments] = useState<any[]>([]);
  const [fullScript, setFullScript] = useState<string>('');
  const [transcriptionPrompt, setTranscriptionPrompt] = useState<string>('');

  const [pastedJson, setPastedJson] = useState<string>('');
  const [isGeneratingTimeline, setIsGeneratingTimeline] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleTogglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const formatTime = (sec: number): string => {
    if (!sec || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Find active clip based on current audio playback time
  const activeClip = timelineData?.video_clips?.find((clip, idx, arr) => {
    const isLast = idx === arr.length - 1;
    return currentTime >= clip.start_sec && (currentTime < clip.end_sec || (isLast && currentTime <= clip.end_sec + 1.0));
  });

  // Auto scroll active segment into view when playback progresses
  useEffect(() => {
    if (activeClip && isPlaying) {
      const el = document.getElementById(`segment-row-${activeClip.segment_id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeClip?.segment_id, isPlaying]);

  // Helper to construct full prompt for Gemini with Naskah/Script & Breakdown Segments attached
  const getGeminiPromptWithScript = (): string => {
    let promptResult = transcriptionPrompt || '';

    if (promptResult.includes('{{FULL_SCRIPT}}')) {
      promptResult = promptResult.replace('{{FULL_SCRIPT}}', fullScript || 'Full Script Narration');
    } else if (promptResult) {
      promptResult += `\n\nNASKAH ASLI (SCRIPT REFERENCE):\n${fullScript}`;
    }

    let formattedBreakdown = '';
    if (breakdownSegments && breakdownSegments.length > 0) {
      formattedBreakdown = breakdownSegments
        .map((s: any, idx: number) => `Segmen #${s.segment_id || s.id || idx + 1}: "${s.quote || s.text || s.visual_description || ''}"`)
        .join('\n');
    }

    if (promptResult.includes('{{BREAKDOWN_SEGMENTS}}')) {
      promptResult = promptResult.replace('{{BREAKDOWN_SEGMENTS}}', formattedBreakdown || 'Segmen #1: Full Narration');
    } else if (formattedBreakdown) {
      promptResult += `\n\nDAFTAR SEGMEN BREAKDOWN (SCENE SEGMENTS):\n${formattedBreakdown}`;
    }

    return promptResult;
  };

  const handleCopyGeminiPrompt = async () => {
    const promptText = getGeminiPromptWithScript();
    if (!promptText.trim()) {
      showToast('⚠️ Prompt Gemini masih kosong!');
      return;
    }
    if (api?.copyToClipboard) {
      await api.copyToClipboard(promptText);
    } else {
      await navigator.clipboard.writeText(promptText);
    }
    showToast('📋 Prompt Alignment Gemini (Lengkap Naskah & Segmen) berhasil disalin!');
  };

  // Load Timeline Data for specific topic
  const loadTopicTimelineData = async (topicId: number) => {
    if (!api?.readFromProject) return;

    // 1. Load script
    let loadedScript = await api.readFromProject(`input/waku/scripts/full_script_topic_${topicId}.txt`);
    if (!loadedScript) loadedScript = await api.readFromProject(`input/waku/full_script_topic_${topicId}.txt`);
    if (!loadedScript && topicId === 1) loadedScript = await api.readFromProject('input/waku/full_script.txt');
    if (loadedScript) setFullScript(loadedScript);
    else setFullScript('');

    // 2. Load breakdown
    let bJson = await api.readFromProject(`input/waku/breakdowns/breakdown_topic_${topicId}.json`);
    if (!bJson) bJson = await api.readFromProject(`input/waku/breakdown_topic_${topicId}.json`);
    if (!bJson && topicId === 1) bJson = await api.readFromProject('input/waku/breakdown.json');
    if (bJson) {
      try {
        const parsedB = JSON.parse(bJson);
        const segs = Array.isArray(parsedB) ? parsedB : (parsedB.segments || parsedB.breakdown || []);
        if (Array.isArray(segs)) setBreakdownSegments(segs);
      } catch {}
    } else {
      setBreakdownSegments([]);
    }

    // 3. Load audio final URL for this topic
    let foundAudioUrl: string | null = null;
    let savedVo2Json = await api.readFromProject(`input/waku/mappings/vo_2parts_state_topic_${topicId}.json`);
    if (!savedVo2Json) {
      savedVo2Json = await api.readFromProject(`input/waku/vo_2parts_state_topic_${topicId}.json`);
    }
    if (!savedVo2Json && topicId === 1) {
      savedVo2Json = await api.readFromProject('input/waku/mappings/vo_2parts_state.json');
      if (!savedVo2Json) {
        savedVo2Json = await api.readFromProject('input/waku/vo_2parts_state.json');
      }
    }

    if (savedVo2Json) {
      try {
        const parsedVo = JSON.parse(savedVo2Json);
        if (parsedVo.mergedVo?.audioUrl || parsedVo.mergedVo?.audioPath) {
          foundAudioUrl = parsedVo.mergedVo.audioUrl || `media://content-auto/${encodeURIComponent(parsedVo.mergedVo.audioPath)}`;
        } else if (parsedVo.parts && Array.isArray(parsedVo.parts)) {
          const partWithAudio = parsedVo.parts.find((p: any) => p.audioUrl || p.audioPath);
          if (partWithAudio) {
            foundAudioUrl = partWithAudio.audioUrl || `media://content-auto/${encodeURIComponent(partWithAudio.audioPath)}`;
          }
        }
      } catch {}
    }

    if (!foundAudioUrl) {
      const topicAudioPath = `/home/jovan/project/content-auto/input/waku/audio/topic_${topicId}/full_narration_topic_${topicId}.wav`;
      foundAudioUrl = `media://content-auto/${encodeURIComponent(topicAudioPath)}`;
    }

    setAudioUrl(foundAudioUrl);

    // 4. Load timeline JSON from timelines/ folder or waku_timeline_topic_${topicId}.json
    let timelineJson = await api.readFromProject(`input/waku/timelines/timeline_topic_${topicId}.json`);
    if (!timelineJson) {
      timelineJson = await api.readFromProject(`input/waku/waku_timeline_topic_${topicId}.json`);
    }
    if (!timelineJson && topicId === 1) {
      timelineJson = await api.readFromProject('input/waku/waku_timeline.json');
    }

    if (timelineJson) {
      try {
        const parsed = JSON.parse(timelineJson);
        if (parsed && Array.isArray(parsed.video_clips)) {
          setTimelineData(parsed);
          return;
        }
      } catch {}
    } else {
      setTimelineData(null);
    }

    // Fallback: load waku_mapping_topic_${topicId}.json
    let mappingJson = await api.readFromProject(`input/waku/mappings/waku_mapping_topic_${topicId}.json`);
    if (!mappingJson) {
      mappingJson = await api.readFromProject(`input/waku/waku_mapping_topic_${topicId}.json`);
    }
    if (!mappingJson && topicId === 1) {
      mappingJson = await api.readFromProject('input/waku/mappings/waku_mapping.json');
      if (!mappingJson) {
        mappingJson = await api.readFromProject('input/waku/waku_mapping.json');
      }
    }

    if (mappingJson) {
      setPastedJson(mappingJson);
    } else {
      setPastedJson('');
    }
  };

  // Initial data load on mount
  useEffect(() => {
    (async () => {
      try {
        if (api?.readFromProject) {
          // 1. Load prompt template
          let loadedPrompt = await api.readFromProject('dashboard/prompts/waku/audio-mapping-prompt.md');
          if (!loadedPrompt || !loadedPrompt.trim()) {
            loadedPrompt = await api.readFromProject('dashboard/prompts/waku/audio-transcription-prompt.md');
          }
          if (loadedPrompt) setTranscriptionPrompt(loadedPrompt);

          // 2. Load topics from Step 1
          const savedTopicsJson = await api.readFromProject('input/waku/topics.json');
          let selectedId: number | null = null;
          let loadedTopics: BatchTopicItem[] = [];

          if (savedTopicsJson) {
            const topicState = JSON.parse(savedTopicsJson);
            if (Array.isArray(topicState.selectedTopics) && topicState.selectedTopics.length > 0) {
              loadedTopics = topicState.selectedTopics.map((t: any) => ({
                id: t.id,
                title: t.title,
                summary: t.summary,
              }));
              selectedId = topicState.selectedTopicId || loadedTopics[0]?.id || null;
            } else if (Array.isArray(topicState.topics) && topicState.selectedTopicId) {
              const matched = topicState.topics.find((t: any) => t.id === topicState.selectedTopicId);
              if (matched) {
                loadedTopics = [{ id: matched.id, title: matched.title, summary: matched.summary }];
                selectedId = matched.id;
              }
            }
          }

          // Check per-topic timeline files in timelines/ folder
          const checkedTopics = await Promise.all(
            loadedTopics.map(async (top) => {
              try {
                let specificTl = await api.readFromProject(`input/waku/timelines/timeline_topic_${top.id}.json`);
                if (!specificTl) {
                  specificTl = await api.readFromProject(`input/waku/waku_timeline_topic_${top.id}.json`);
                }
                if (!specificTl && top.id === 1) {
                  specificTl = await api.readFromProject('input/waku/waku_timeline.json');
                }
                return { ...top, hasTimeline: Boolean(specificTl && specificTl.trim()) };
              } catch {
                return top;
              }
            })
          );

          setBatchTopics(checkedTopics);
          const targetId = selectedId || checkedTopics[0]?.id || 1;
          setActiveTopicId(targetId);
          const activeTop = checkedTopics.find((t) => t.id === targetId) || checkedTopics[0];
          if (activeTop) setVideoTitle(activeTop.title);

          await loadTopicTimelineData(targetId);
        }
      } catch (err) {
        console.error('Error initializing Waku Timeline Mapping Step:', err);
      }
    })();
  }, []);

  const handleSwitchTopic = async (topic: BatchTopicItem) => {
    setActiveTopicId(topic.id);
    setVideoTitle(topic.title);
    await loadTopicTimelineData(topic.id);
  };

  // Generate Timeline Mapping via Backend Main IPC
  const handleGenerateTimeline = async () => {
    setIsGeneratingTimeline(true);
    showToast(`⚙️ Membangun Timeline Mapping JSON untuk Topik #${activeTopicId || 1}...`);
    try {
      if (!api?.generateWakuTimeline) {
        throw new Error('API generateWakuTimeline tidak tersedia pada environment ini.');
      }

      const res = await api.generateWakuTimeline(activeTopicId || undefined);
      if (res?.error) {
        throw new Error(res.error);
      }

      if (res?.timeline) {
        setTimelineData(res.timeline);
        setBatchTopics((prev) =>
          prev.map((t) => (t.id === (activeTopicId || 1) ? { ...t, hasTimeline: true } : t))
        );
        showToast(
          `✨ Timeline Mapping Topik #${activeTopicId || 1} Berhasil Dibuat (${res.timeline.video_clips?.length || 0} Segmen, Total ${
            res.timeline.total_duration_sec?.toFixed(1) || 0
          }s)!`
        );
      }
    } catch (err: any) {
      showToast(`❌ Gagal generate timeline mapping: ${err?.message || err}`);
    } finally {
      setIsGeneratingTimeline(false);
    }
  };

  // Generate Timeline Mapping for ALL Topics in Bulk
  const handleGenerateAllTimelines = async () => {
    if (batchTopics.length === 0) {
      await handleGenerateTimeline();
      return;
    }

    setIsGeneratingTimeline(true);
    showToast(`🚀 Memulai Bulk Generate Timeline Mapping untuk ${batchTopics.length} Topik...`);

    let successCount = 0;
    try {
      if (!api?.generateWakuTimeline) {
        throw new Error('API generateWakuTimeline tidak tersedia pada environment ini.');
      }

      for (const topic of batchTopics) {
        showToast(`⚙️ Memproses Timeline Mapping Topik #${topic.id} ("${topic.title}")...`);
        const res = await api.generateWakuTimeline(topic.id);
        if (res?.timeline) {
          successCount++;
          setBatchTopics((prev) =>
            prev.map((t) => (t.id === topic.id ? { ...t, hasTimeline: true } : t))
          );
          if (topic.id === (activeTopicId || 1)) {
            setTimelineData(res.timeline);
          }
        }
      }

      showToast(`🎉 Bulk Timeline Selesai! ${successCount} / ${batchTopics.length} topik berhasil di-generate!`);
      if (activeTopicId) {
        await loadTopicTimelineData(activeTopicId);
      }
    } catch (err: any) {
      showToast(`❌ Error Bulk Generate Timeline: ${err?.message || err}`);
    } finally {
      setIsGeneratingTimeline(false);
    }
  };

  // Process & Validate Manual Gemini JSON Paste
  const handleProcessPastedJson = async () => {
    const text = pastedJson.trim();
    if (!text) {
      showToast('⚠️ Mohon paste teks JSON hasil Gemini terlebih dahulu!');
      return;
    }

    const report = validateWakuWordTranscript(text);
    if (!report.normalizedData) {
      showToast(`❌ Format JSON Gemini Tidak Valid: ${report.summaryText}`);
      return;
    }

    try {
      if (api?.saveToProject) {
        const topId = activeTopicId || 1;
        await api.saveToProject(`input/waku/mappings/waku_mapping_topic_${topId}.json`, JSON.stringify(report.normalizedData, null, 2));
        await api.saveToProject(`input/waku/transcripts/merged_transcript_topic_${topId}.json`, JSON.stringify(report.normalizedData, null, 2));

        if (topId === 1) {
          await api.saveToProject('input/waku/mappings/waku_mapping.json', JSON.stringify(report.normalizedData, null, 2));
          await api.saveToProject('input/waku/transcripts/merged_transcript.json', JSON.stringify(report.normalizedData, null, 2));
        }
      }

      showToast(`✨ Validasi Berhasil! ${report.summaryText}`);
      // Re-trigger timeline generation with updated mapping JSON
      await handleGenerateTimeline();
    } catch (err: any) {
      showToast(`❌ Error menyimpan mapping JSON: ${err?.message || err}`);
    }
  };

  const processDirectUpload = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const bufferArray = Array.from(new Uint8Array(arrayBuffer));

    let res: any = null;
    if (api?.uploadWakuVoAudio) {
      res = await api.uploadWakuVoAudio(undefined, (file as any).path || file.name, bufferArray);
    } else {
      const objectUrl = URL.createObjectURL(file);
      res = { filename: file.name, url: objectUrl };
    }

    setAudioUrl(res.url);
    showToast(`🎙️ Audio VO (${res.filename || file.name}) berhasil di-upload!`);
  };

  const handleUploadAudioFile = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg';
      input.onchange = async (e: any) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) await processDirectUpload(selectedFile);
      };
      input.click();
    } catch (err: any) {
      showToast(`❌ Gagal upload audio: ${err?.message || err}`);
    }
  };

  const handleSeekAudio = (sec: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = sec;
      audioRef.current.play();
      setIsPlaying(true);
      setCurrentTime(sec);
      showToast(`▶️ Play Audio pada segmen ${sec.toFixed(2)}s`);
    } else {
      showToast(`▶️ Timestamp Segmen: ${sec.toFixed(2)}s`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-in fade-in duration-300">
      {/* Hidden native audio element for precise time tracking */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl font-semibold text-xs flex items-center gap-2 border border-emerald-400/30 animate-bounce">
          <span>{toast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/90 via-gray-900 to-gray-950 p-6 rounded-3xl border border-emerald-800/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                ✨ Waku AI Workflow — Step 7
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>🎯</span> Timeline & Mapping Studio (`waku_mapping.json`)
            </h1>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              Memeta rentang detik desimal per segmen adegan (`start_sec` ➔ `end_sec`), menginspeksi durasi tiap gambar, dan menyiapkan file mapping JSON utuh sebelum masuk ke Step 8 Render Studio (FFmpeg).
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {batchTopics.length > 1 && (
              <button
                onClick={handleGenerateAllTimelines}
                disabled={isGeneratingTimeline}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 hover:from-emerald-400 hover:to-emerald-400 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950/60 border border-emerald-300/30 transition-all flex items-center gap-2 disabled:opacity-50"
                title="Generate timeline mapping untuk seluruh topik sekaligus"
              >
                {isGeneratingTimeline ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Proses Bulk Timeline...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Generate Timeline All Topics ({batchTopics.length})</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleGenerateTimeline}
              disabled={isGeneratingTimeline}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-950/60 border border-emerald-300/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isGeneratingTimeline ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Membangun Timeline...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Generate Timeline Topic #{activeTopicId || 1}</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyGeminiPrompt}
              className="px-3.5 py-2.5 bg-emerald-900 hover:bg-emerald-800 text-emerald-100 rounded-xl text-xs font-extrabold border border-emerald-700 shadow-md transition-all flex items-center gap-1.5"
            >
              <span>📋</span>
              <span>Copy Gemini Prompt</span>
            </button>

            {onStepChange && (
              <button
                onClick={() => onStepChange('upload')}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950/60 border border-emerald-400/40 transition-all flex items-center gap-1.5"
              >
                <span>🎬</span>
                <span>Lanjut ke Step 8: Render Studio ➔</span>
              </button>
            )}
          </div>
        </div>

        {/* Top Topic Selector Bar */}
        {batchTopics.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-emerald-900/40 relative z-10">
            {batchTopics.map((t) => {
              const isActive = activeTopicId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSwitchTopic(t)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-2 max-w-xs ${
                    isActive
                      ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200 shadow-md ring-1 ring-emerald-500/40'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-900 border border-gray-800 text-emerald-300 shrink-0">
                    #{t.id}
                  </span>
                  <span className="truncate">"{t.title}"</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      t.hasTimeline
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-gray-900 text-gray-500 border border-gray-800'
                    }`}
                  >
                    {t.hasTimeline ? '✓ Timeline Ready' : '⏳ Pending'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Timeline Segments Visual Mapping Inspector */}
      <div className="bg-gray-900/90 p-6 rounded-3xl border border-emerald-800/60 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
          <div>
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <span>🗺️</span> Visual Timeline Mapping Adegan Video (`waku_timeline.json`)
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Daftar segmen adegan lengkap dengan gambar ilustrasi, rentang detik awal/akhir, dan durasi klip untuk rendering FFmpeg.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleUploadAudioFile}
              className="px-3 py-1.5 bg-gray-950 hover:bg-gray-800 text-emerald-300 border border-emerald-800/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
              title="Upload atau ganti file audio Voice Over"
            >
              <span>🎙️</span>
              <span>{audioUrl ? 'Ganti Audio VO' : 'Upload Audio VO'}</span>
            </button>

            {timelineData && (
              <div className="flex items-center gap-2 text-xs font-mono font-bold">
                <span className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-xl">
                  {timelineData.video_clips?.length || 0} Segmen
                </span>
                <span className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-xl">
                  Total: {timelineData.total_duration_sec?.toFixed(1) || 0}s
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Embedded Modern Audio Player Bar (ALWAYS VISIBLE ABOVE TABLE) */}
        <div className="p-4 bg-gradient-to-r from-gray-950 via-emerald-950/40 to-gray-950 border border-emerald-700/60 rounded-2xl space-y-3 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={handleTogglePlayPause}
                className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl flex items-center justify-center text-base font-black shadow-lg border border-emerald-300/30 transition-all shrink-0"
                title={isPlaying ? 'Pause Audio' : 'Play Audio'}
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>

              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h5 className="text-xs font-extrabold text-white">Audio VO Player Sync</h5>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold">
                    {formatTime(currentTime)} / {formatTime(duration || timelineData?.total_duration_sec || 0)}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  {isPlaying
                    ? '▶️ Audio sedang diputar — segmen aktif di-highlight warna hijau di bawah.'
                    : '⏸️ Klik tombol Play di atas atau tombol ▶️ Play di baris tabel segmen untuk memutar.'}
                </p>
              </div>
            </div>

            {/* Native Browser Audio Controls Widget + Active Segment Pill */}
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end">
              {audioUrl && (
                <audio
                  controls
                  src={audioUrl}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onTimeUpdate={handleTimeUpdate}
                  className="h-8 w-48 sm:w-60 rounded-lg opacity-90 focus:outline-none"
                />
              )}

              {/* Active Segment Info Pill (ONLY SHOWN WHEN PLAYING) */}
              {isPlaying && activeClip ? (
                <div className="px-3 py-1.5 bg-emerald-950 border border-emerald-400/60 rounded-xl flex items-center gap-2 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <div className="text-[10px] font-mono text-emerald-300 font-extrabold uppercase tracking-wider">
                    🎯 AKTIF: <span className="text-white">#{activeClip.segment_id}</span> ({activeClip.start_sec.toFixed(1)}s ➔ {activeClip.end_sec.toFixed(1)}s)
                  </div>
                </div>
              ) : (
                <div className="px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-xl text-[10px] font-mono text-gray-500">
                  ⏸️ Audio Paused (Klik Play untuk Aktif)
                </div>
              )}
            </div>
          </div>

          {/* Interactive Timeline Progress Slider */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-[10px] font-mono font-bold text-gray-400 shrink-0">{currentTime.toFixed(1)}s</span>
            <input
              type="range"
              min={0}
              max={duration || timelineData?.total_duration_sec || 100}
              step={0.05}
              value={currentTime}
              onChange={(e) => {
                const newSec = parseFloat(e.target.value);
                if (audioRef.current) audioRef.current.currentTime = newSec;
                setCurrentTime(newSec);
              }}
              className="w-full h-2 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-emerald-400 border border-gray-800"
            />
            <span className="text-[10px] font-mono font-bold text-gray-400 shrink-0">
              {(duration || timelineData?.total_duration_sec || 0).toFixed(1)}s
            </span>
          </div>
        </div>

        {timelineData && timelineData.video_clips && timelineData.video_clips.length > 0 ? (
          <div className="space-y-3">
            <div className="overflow-x-auto border border-gray-800 rounded-2xl shadow-inner max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-950 text-gray-400 font-mono text-[11px] uppercase tracking-wider border-b border-gray-800 sticky top-0 z-20">
                  <tr>
                    <th className="py-3 px-4">Segmen</th>
                    <th className="py-3 px-4">Gambar Adegan</th>
                    <th className="py-3 px-4">Rentang Waktu (Start ➔ End)</th>
                    <th className="py-3 px-4">Durasi</th>
                    <th className="py-3 px-4">Naskah / Quote Adegan</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/70 font-mono text-gray-300 bg-gray-900/50">
                  {timelineData.video_clips.map((clip) => {
                    const isActive = isPlaying && activeClip ? clip.clip_id === activeClip.clip_id : false;
                    return (
                      <tr
                        key={clip.clip_id}
                        id={`segment-row-${clip.segment_id}`}
                        className={`transition-all duration-300 ${
                          isActive
                            ? 'bg-gradient-to-r from-emerald-950 via-emerald-950/80 to-gray-900 border-l-4 border-l-emerald-400 shadow-xl shadow-emerald-950/40 text-white font-medium'
                            : 'hover:bg-gray-800/60 text-gray-300'
                        }`}
                      >
                        <td className="py-3 px-4 font-extrabold">
                          <div className="flex flex-col gap-1">
                            <span className={`text-sm ${isActive ? 'text-emerald-300 font-black' : 'text-emerald-400'}`}>
                              #{clip.segment_id}
                            </span>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-black text-[9px] font-black uppercase tracking-wider animate-pulse inline-flex items-center gap-1 shadow-md w-max">
                                <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                                NOW PLAYING
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {clip.image_url ? (
                            <div className={`w-16 h-10 rounded-lg overflow-hidden border bg-black shrink-0 relative transition-all ${
                              isActive ? 'border-emerald-400 ring-2 ring-emerald-500/40 shadow-lg scale-105' : 'border-gray-700'
                            }`}>
                              <img src={clip.image_url} alt={`Segmen #${clip.segment_id}`} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-500 italic">No image</span>
                          )}
                        </td>
                        <td className={`py-3 px-4 font-bold ${isActive ? 'text-emerald-200 text-sm' : 'text-emerald-300'}`}>
                          {clip.start_sec.toFixed(2)}s ➔ {clip.end_sec.toFixed(2)}s
                        </td>
                        <td className={`py-3 px-4 font-extrabold ${isActive ? 'text-emerald-200 text-sm' : 'text-emerald-300'}`}>
                          {clip.duration_sec.toFixed(2)}s
                        </td>
                        <td className={`py-3 px-4 font-sans max-w-sm truncate ${isActive ? 'text-white font-semibold' : 'text-gray-300'}`} title={clip.quote}>
                          {clip.quote}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleSeekAudio(clip.start_sec)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition-all flex items-center gap-1 ml-auto ${
                              isActive
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-300 shadow-lg shadow-emerald-950/80 animate-pulse'
                                : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                            }`}
                          >
                            {isActive ? '🔊 Playing...' : `▶️ Play ${clip.start_sec.toFixed(1)}s`}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
              <button
                onClick={handleGenerateTimeline}
                className="px-4 py-2 bg-gray-950 border border-gray-800 hover:bg-gray-800 text-gray-300 font-bold text-xs rounded-xl flex items-center gap-2"
              >
                <span>🔄</span>
                <span>Refresh / Re-generate Timeline Mapping</span>
              </button>

              {onStepChange && (
                <button
                  onClick={() => onStepChange('upload')}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-emerald-950/60 border border-emerald-400/40 transition-all flex items-center gap-2"
                >
                  <span>🎬</span>
                  <span>Siap Render! Lanjut ke Step 8: Render Studio (16:9) ➔</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-10 bg-gray-950 border-2 border-dashed border-gray-800 rounded-3xl text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-950 text-emerald-400 rounded-3xl flex items-center justify-center text-2xl mx-auto border border-emerald-800 shadow-inner">
              🗺️
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">Timeline Mapping Belum Dibuat</h4>
              <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                Klik tombol <strong>"Generate Timeline Mapping"</strong> di atas atau tempelkan JSON hasil alignment dari Gemini untuk membuat mapping timestamp adegan secara otomatis.
              </p>
            </div>
            <button
              onClick={handleGenerateTimeline}
              disabled={isGeneratingTimeline}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-extrabold text-xs rounded-2xl shadow-xl hover:from-emerald-400 hover:to-emerald-500 border border-emerald-300/30"
            >
              ⚡ Generate Timeline Mapping Sekarang
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WakuTimelineMappingStep;
