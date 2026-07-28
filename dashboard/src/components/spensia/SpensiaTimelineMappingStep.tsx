// dashboard/src/components/spensia/SpensiaTimelineMappingStep.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  validateSpensiaWordTranscript,
  SpensiaTranscriptData,
  SpensiaSegmentTimestamp,
} from '../../utils/spensiaValidation';

const api = window.electronAPI;

interface SpensiaTimelineMappingStepProps {
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
  segments?: SpensiaSegmentTimestamp[];
}

const SpensiaTimelineMappingStep: React.FC<SpensiaTimelineMappingStepProps> = ({ onStepChange }) => {
  const [timelineData, setTimelineData] = useState<FullTimelineData | null>(null);
  const [breakdownSegments, setBreakdownSegments] = useState<any[]>([]);
  const [fullScript, setFullScript] = useState<string>('');
  const [transcriptionPrompt, setTranscriptionPrompt] = useState<string>('');

  const [pastedJson, setPastedJson] = useState<string>('');
  const [isGeneratingTimeline, setIsGeneratingTimeline] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

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

  // Initial data load on mount
  useEffect(() => {
    (async () => {
      try {
        if (api?.readFromProject) {
          // 1. Load prompt template
          const loadedPrompt = await api.readFromProject('dashboard/prompts/spensia/audio-transcription-prompt.md');
          if (loadedPrompt) setTranscriptionPrompt(loadedPrompt);

          // 2. Load script
          const loadedScript = await api.readFromProject('input/spensia/full_script.txt');
          if (loadedScript) setFullScript(loadedScript);

          // 3. Load breakdown
          const bJson = await api.readFromProject('input/spensia/breakdown.json');
          if (bJson) {
            try {
              const parsedB = JSON.parse(bJson);
              const segs = Array.isArray(parsedB) ? parsedB : (parsedB.segments || parsedB.breakdown || []);
              if (Array.isArray(segs)) setBreakdownSegments(segs);
            } catch {}
          }

          // 4. Load audio final URL if available
          const savedVo2Json = await api.readFromProject('input/spensia/vo_2parts_state.json');
          if (savedVo2Json) {
            try {
              const parsedVo = JSON.parse(savedVo2Json);
              if (parsedVo.mergedVo?.audioUrl) {
                setAudioUrl(parsedVo.mergedVo.audioUrl);
              }
            } catch {}
          }

          // 5. Load existing timeline mapping JSON if available
          await loadTimelineData();
        }
      } catch (err) {
        console.error('Error initializing Spensia Timeline Mapping Step:', err);
      }
    })();
  }, []);

  const loadTimelineData = async () => {
    try {
      if (!api?.readFromProject) return;
      const timelineJson = await api.readFromProject('input/spensia/spensia_timeline.json');
      if (timelineJson) {
        try {
          const parsed = JSON.parse(timelineJson);
          if (parsed && Array.isArray(parsed.video_clips)) {
            setTimelineData(parsed);
            return;
          }
        } catch {}
      }

      // Fallback: load spensia_mapping.json
      const mappingJson = await api.readFromProject('input/spensia/spensia_mapping.json');
      if (mappingJson) {
        setPastedJson(mappingJson);
      }
    } catch (err) {
      console.error('Error loading timeline mapping data:', err);
    }
  };

  // Generate Timeline Mapping via Backend Main IPC
  const handleGenerateTimeline = async () => {
    setIsGeneratingTimeline(true);
    showToast('⚙️ Membangun Timeline Mapping JSON dari data segmen & audio...');
    try {
      if (!api?.generateSpensiaTimeline) {
        throw new Error('API generateSpensiaTimeline tidak tersedia pada environment ini.');
      }

      const res = await api.generateSpensiaTimeline();
      if (res?.error) {
        throw new Error(res.error);
      }

      setTimelineData(res);
      showToast(`✨ Timeline Mapping Berhasil Dibuat (${res.video_clips?.length || 0} Segmen, Total ${res.total_duration_sec?.toFixed(1) || 0}s)!`);
    } catch (err: any) {
      showToast(`❌ Gagal generate timeline mapping: ${err?.message || err}`);
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

    const report = validateSpensiaWordTranscript(text);
    if (!report.normalizedData) {
      showToast(`❌ Format JSON Gemini Tidak Valid: ${report.summaryText}`);
      return;
    }

    try {
      if (api?.saveToProject) {
        await api.saveToProject('input/spensia/spensia_mapping.json', JSON.stringify(report.normalizedData, null, 2));
        await api.saveToProject('input/spensia/transcripts/merged_transcript.json', JSON.stringify(report.normalizedData, null, 2));
      }

      // Re-trigger timeline generation with updated mapping JSON
      await handleGenerateTimeline();
    } catch (err: any) {
      showToast(`❌ Error menyimpan mapping JSON: ${err?.message || err}`);
    }
  };

  const handleSeekAudio = (sec: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = sec;
      audioRef.current.play();
      showToast(`▶️ Play Audio pada ${sec.toFixed(2)}s`);
    } else {
      showToast(`▶️ Timestamp Segmen: ${sec.toFixed(2)}s`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-teal-600 text-white px-4 py-3 rounded-2xl shadow-2xl font-semibold text-xs flex items-center gap-2 border border-teal-400/30 animate-bounce">
          <span>{toast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-950/90 via-gray-900 to-gray-950 p-6 rounded-3xl border border-teal-800/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                ✨ Spensia AI Workflow — Step 7
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>🎯</span> Timeline & Mapping Studio (`spensia_mapping.json`)
            </h1>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              Memeta rentang detik desimal per segmen adegan (`start_sec` ➔ `end_sec`), menginspeksi durasi tiap gambar, dan menyiapkan file mapping JSON utuh sebelum masuk ke Step 8 Render Studio (FFmpeg).
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={handleGenerateTimeline}
              disabled={isGeneratingTimeline}
              className="px-4 py-2.5 bg-gradient-to-r from-teal-500 via-emerald-600 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-teal-950/60 border border-teal-300/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isGeneratingTimeline ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Membangun Timeline...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Generate Timeline Mapping</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyGeminiPrompt}
              className="px-3.5 py-2.5 bg-teal-900 hover:bg-teal-800 text-teal-100 rounded-xl text-xs font-extrabold border border-teal-700 shadow-md transition-all flex items-center gap-1.5"
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
      </div>

      {/* Audio Player Card if available */}
      {audioUrl && (
        <div className="p-4 bg-gray-900/80 border border-teal-800/60 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-950 text-teal-400 rounded-xl flex items-center justify-center text-base border border-teal-800 shrink-0">
              🎵
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">Audio Final Ready</h5>
              <span className="text-[11px] font-mono text-teal-400">Dipakai untuk pengujian preview sync timeline segmen</span>
            </div>
          </div>
          <audio ref={audioRef} src={audioUrl} controls className="w-full sm:w-80 h-9 rounded-xl focus:outline-none" />
        </div>
      )}

      {/* Gemini Alignment JSON Manual Paste Section */}
      <div className="p-6 bg-gray-900/90 border border-teal-800/60 rounded-3xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
          <div>
            <h3 className="text-xs font-extrabold text-teal-300 uppercase tracking-wider flex items-center gap-2">
              <span>📥</span> Import / Paste Output JSON Gemini Alignment (`segments` & `words`)
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Jika Anda telah me-run Gemini di Google AI Studio, paste teks JSON di sini untuk meng-update timestamp desimal segmen adegan secara presisi.
            </p>
          </div>

          <button
            onClick={handleCopyGeminiPrompt}
            className="px-3 py-1.5 bg-teal-950 hover:bg-teal-900 text-teal-300 border border-teal-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0"
          >
            <span>📋</span>
            <span>Copy Prompt</span>
          </button>
        </div>

        <textarea
          value={pastedJson}
          onChange={(e) => setPastedJson(e.target.value)}
          rows={5}
          className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs font-mono text-gray-200 leading-relaxed focus:outline-none focus:border-teal-500 shadow-inner"
          placeholder='Paste JSON Gemini di sini (contoh: { "segments": [ { "segment_id": 1, "start_sec": 0, "end_sec": 6.45 } ], "words": [...] })...'
        />

        <div className="flex justify-end items-center gap-3">
          <button
            onClick={handleProcessPastedJson}
            className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-lg flex items-center gap-2"
          >
            <span>✨</span>
            <span>Simpan & Terapkan Mapping JSON</span>
          </button>
        </div>
      </div>

      {/* Timeline Segments Visual Mapping Inspector */}
      <div className="bg-gray-900/90 p-6 rounded-3xl border border-teal-800/60 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
          <div>
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <span>🗺️</span> Visual Timeline Mapping Adegan Video (`spensia_timeline.json`)
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Daftar segmen adegan lengkap dengan gambar ilustrasi, rentang detik awal/akhir, dan durasi klip untuk rendering FFmpeg.
            </p>
          </div>

          {timelineData && (
            <div className="flex items-center gap-2 text-xs font-mono font-bold">
              <span className="px-3 py-1 bg-teal-950 text-teal-300 border border-teal-800 rounded-xl">
                {timelineData.video_clips?.length || 0} Segmen
              </span>
              <span className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-xl">
                Total: {timelineData.total_duration_sec?.toFixed(1) || 0}s
              </span>
            </div>
          )}
        </div>

        {timelineData && timelineData.video_clips && timelineData.video_clips.length > 0 ? (
          <div className="space-y-3">
            <div className="overflow-x-auto border border-gray-800 rounded-2xl shadow-inner">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-950 text-gray-400 font-mono text-[11px] uppercase tracking-wider border-b border-gray-800">
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
                  {timelineData.video_clips.map((clip) => (
                    <tr key={clip.clip_id} className="hover:bg-gray-800/60 transition-colors">
                      <td className="py-3 px-4 font-extrabold text-teal-400">#{clip.segment_id}</td>
                      <td className="py-3 px-4">
                        {clip.image_url ? (
                          <div className="w-16 h-10 rounded-lg overflow-hidden border border-gray-700 bg-black shrink-0 relative group">
                            <img src={clip.image_url} alt={`Segmen #${clip.segment_id}`} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-500 italic">No image</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-emerald-300 font-bold">
                        {clip.start_sec.toFixed(2)}s ➔ {clip.end_sec.toFixed(2)}s
                      </td>
                      <td className="py-3 px-4 text-amber-300 font-extrabold">{clip.duration_sec.toFixed(2)}s</td>
                      <td className="py-3 px-4 font-sans text-gray-300 max-w-sm truncate" title={clip.quote}>
                        {clip.quote}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleSeekAudio(clip.start_sec)}
                          className="px-3 py-1.5 bg-teal-950 hover:bg-teal-900 text-teal-300 rounded-xl text-[11px] font-bold border border-teal-800 transition-all flex items-center gap-1 ml-auto"
                        >
                          ▶️ Play {clip.start_sec.toFixed(1)}s
                        </button>
                      </td>
                    </tr>
                  ))}
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
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-emerald-950/60 border border-emerald-400/40 transition-all flex items-center gap-2"
                >
                  <span>🎬</span>
                  <span>Siap Render! Lanjut ke Step 8: Render Studio (16:9) ➔</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-10 bg-gray-950 border-2 border-dashed border-gray-800 rounded-3xl text-center space-y-4">
            <div className="w-14 h-14 bg-teal-950 text-teal-400 rounded-3xl flex items-center justify-center text-2xl mx-auto border border-teal-800 shadow-inner">
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
              className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-extrabold text-xs rounded-2xl shadow-xl hover:from-teal-400 hover:to-emerald-500 border border-teal-300/30"
            >
              ⚡ Generate Timeline Mapping Sekarang
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpensiaTimelineMappingStep;
