// dashboard/src/components/spensia/SpensiaVoiceOverStep.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  validateSpensiaWordTranscript,
  SpensiaWordTimestamp,
  SpensiaChunkTimestamp,
  SpensiaTranscriptData,
  SpensiaTranscriptValidationReport,
} from '../../utils/spensiaValidation';

const api = window.electronAPI;

export interface VoPartItem {
  part_id: number;
  part_title: string;
  sub_title: string;
  text: string;
  audioUrl?: string;
  audioPath?: string;
  filename?: string;
  duration?: number;
  status: 'pending' | 'uploaded';
  rawTranscriptJson?: string;
  transcript?: SpensiaTranscriptData;
}

export interface MergedVoItem {
  audioUrl?: string;
  audioPath?: string;
  filename?: string;
  duration?: number;
  rawTranscriptJson?: string;
  transcript?: SpensiaTranscriptData;
}

const DEFAULT_SCENE_CONTEXT = `Educational History Storytelling for "Spensia" YouTube channel (Indonesian audience, 18-35 age group). Semi-formal, engaging, mind-blowing counterintuitive history facts.`;
const DEFAULT_SAMPLE_CONTEXT = `Speak in a natural, conversational, fast-paced rhythm with short sentence fragments. Emphasize mind-blowing history facts naturally without sounding robotic.`;

const PART_CONFIGS = [
  { id: 1, title: 'Part 1: Babak Pertama (Hook & Isi Awal)', subtitle: 'Awal video — Menyeret penonton dengan skenario imajinatif & fakta awal' },
  { id: 2, title: 'Part 2: Babak Kedua (Isi Lanjutan & Closing)', subtitle: 'Lanjutan naskah — Detail realita sejarah, refleksi filosofis & penutup' },
];

const SpensiaVoiceOverStep: React.FC = () => {
  const [sceneContext, setSceneContext] = useState<string>(DEFAULT_SCENE_CONTEXT);
  const [sampleContext, setSampleContext] = useState<string>(DEFAULT_SAMPLE_CONTEXT);
  const [fullScript, setFullScript] = useState<string>('');
  const [breakdownSegments, setBreakdownSegments] = useState<any[]>([]);

  const [parts, setParts] = useState<VoPartItem[]>([
    { part_id: 1, part_title: PART_CONFIGS[0].title, sub_title: PART_CONFIGS[0].subtitle, text: '', status: 'pending' },
    { part_id: 2, part_title: PART_CONFIGS[1].title, sub_title: PART_CONFIGS[1].subtitle, text: '', status: 'pending' },
  ]);

  const [mergedVo, setMergedVo] = useState<MergedVoItem | null>(null);

  const [transcriptionPrompt, setTranscriptionPrompt] = useState<string>('');
  const [showPromptEditor, setShowPromptEditor] = useState<boolean>(false);
  const [pastedJsonMap, setPastedJsonMap] = useState<Record<string, string>>({});

  const [activeTab, setActiveTab] = useState<number | 'merged'>(0); // 0 = Merged Audio Final, 1 = Part 1, 2 = Part 2
  const [transcriptTab, setTranscriptTab] = useState<'chunks' | 'words' | 'full'>('chunks');
  const [audioCurrentTimes, setAudioCurrentTimes] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);

  // Pipeline execution status: 'idle' | 'merging' | 'ready' | 'completed' | 'error'
  const [pipelineStage, setPipelineStage] = useState<'idle' | 'merging' | 'ready' | 'completed' | 'error'>('idle');
  const [pipelineStatusText, setPipelineStatusText] = useState<string>('');

  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  const handleAudioTimeUpdate = (key: string, e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const curTime = e.currentTarget.currentTime;
    setAudioCurrentTimes((prev) => ({
      ...prev,
      [key]: curTime,
    }));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadTranscriptionPromptFromFile = async () => {
    try {
      if (api?.readFromProject) {
        let loadedPrompt = await api.readFromProject('dashboard/prompts/spensia/audio-mapping-prompt.md');
        if (!loadedPrompt || !loadedPrompt.trim()) {
          loadedPrompt = await api.readFromProject('dashboard/prompts/spensia/audio-transcription-prompt.md');
        }
        if (loadedPrompt && loadedPrompt.trim().length > 0) {
          setTranscriptionPrompt(loadedPrompt);
          return loadedPrompt;
        }
      }
    } catch (err) {
      console.error('Error reading audio-mapping-prompt.md:', err);
    }
    return '';
  };

  // Helper to construct full prompt for Gemini with Naskah/Script & Breakdown Segments attached
  const getGeminiPromptWithScript = (scriptText: string): string => {
    const scriptToUse = scriptText.trim() || fullScript.trim();
    let promptResult = transcriptionPrompt || '';

    if (promptResult.includes('{{FULL_SCRIPT}}')) {
      promptResult = promptResult.replace('{{FULL_SCRIPT}}', scriptToUse);
    } else if (promptResult) {
      promptResult += `\n\nNASKAH ASLI (SCRIPT REFERENCE):\n${scriptToUse}`;
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

  // Helper to split full script into 2 balanced parts
  const splitScriptInto2Parts = (rawScript: string): string[] => {
    if (!rawScript || !rawScript.trim()) return ['', ''];
    const paragraphs = rawScript.split(/\n\s*\n/).filter((p) => p.trim());
    if (paragraphs.length === 0) return ['', ''];
    if (paragraphs.length === 1) return [paragraphs[0], ''];

    const mid = Math.ceil(paragraphs.length / 2);
    const p1 = paragraphs.slice(0, mid).join('\n\n');
    const p2 = paragraphs.slice(mid).join('\n\n');
    return [p1, p2];
  };

  // Initial load on mount
  useEffect(() => {
    (async () => {
      await loadTranscriptionPromptFromFile();
      try {
        if (api?.readFromProject) {
          // 0. Load breakdown segments from Step 3
          try {
            const bJson = await api.readFromProject('input/spensia/breakdown.json');
            if (bJson) {
              const parsedB = JSON.parse(bJson);
              const segs = Array.isArray(parsedB) ? parsedB : (parsedB.segments || parsedB.breakdown || []);
              if (Array.isArray(segs)) setBreakdownSegments(segs);
            }
          } catch {}

          // 1. Load full script from Step 2
          const loadedScript = await api.readFromProject('input/spensia/full_script.txt');
          const scriptStr = loadedScript && loadedScript.trim() ? loadedScript : '';
          setFullScript(scriptStr);

          const splitTextParts = splitScriptInto2Parts(scriptStr);

          // 2. Load existing 2-part VO state & Merged VO state
          const savedVo2Json = await api.readFromProject('input/spensia/vo_2parts_state.json');
          let savedPartsMap: Record<number, any> = {};
          let savedMergedVo: MergedVoItem | null = null;

          if (savedVo2Json) {
            try {
              const obj = JSON.parse(savedVo2Json);
              if (Array.isArray(obj.parts)) {
                obj.parts.forEach((p: any) => {
                  savedPartsMap[p.part_id] = p;
                });
              }
              if (obj.mergedVo) {
                savedMergedVo = obj.mergedVo;
              }
            } catch {}
          }

          const initialParts: VoPartItem[] = PART_CONFIGS.map((config, idx) => {
            const saved = savedPartsMap[config.id];
            if (saved?.rawTranscriptJson) {
              setPastedJsonMap((prev) => ({ ...prev, [config.id]: saved.rawTranscriptJson }));
            }
            return {
              part_id: config.id,
              part_title: config.title,
              sub_title: config.subtitle,
              text: saved?.text || splitTextParts[idx] || '',
              audioUrl: saved?.audioUrl || undefined,
              audioPath: saved?.audioPath || undefined,
              filename: saved?.filename || undefined,
              duration: saved?.duration || undefined,
              status: saved?.audioUrl ? 'uploaded' : 'pending',
              rawTranscriptJson: saved?.rawTranscriptJson || undefined,
              transcript: saved?.transcript || undefined,
            };
          });

          setParts(initialParts);

          // Load merged transcript if saved independently
          const savedMergedTranscriptJson = await api.readFromProject('input/spensia/transcripts/merged_transcript.json');
          if (savedMergedTranscriptJson) {
            try {
              const report = validateSpensiaWordTranscript(savedMergedTranscriptJson);
              if (report.normalizedData) {
                savedMergedVo = {
                  ...(savedMergedVo || {}),
                  rawTranscriptJson: savedMergedTranscriptJson,
                  transcript: report.normalizedData,
                };
              }
            } catch {}
          }

          if (!savedMergedVo) {
            const partWithAudio = initialParts.find((p) => p.audioUrl || p.audioPath);
            if (partWithAudio) {
              savedMergedVo = {
                audioUrl: partWithAudio.audioUrl,
                audioPath: partWithAudio.audioPath,
                filename: partWithAudio.filename || 'segment_1.wav',
                duration: partWithAudio.duration,
                rawTranscriptJson: partWithAudio.rawTranscriptJson,
                transcript: partWithAudio.transcript,
              };
            }
          }

          if (savedMergedVo) {
            if (savedMergedVo.rawTranscriptJson) {
              setPastedJsonMap((prev) => ({ ...prev, merged: savedMergedVo!.rawTranscriptJson! }));
            }
            setMergedVo(savedMergedVo);
            if (savedMergedVo.transcript) {
              setPipelineStage('completed');
              setPipelineStatusText('Transkrip Ready');
            } else if (savedMergedVo.audioUrl) {
              setPipelineStage('ready');
              setPipelineStatusText('Audio Ready (Paste Hasil Gemini)');
            }
          }

          // Default tab: If merged audio ready, open Merged tab (0), otherwise Part 1 (1)
          if (savedMergedVo?.audioUrl) {
            setActiveTab(0);
          } else {
            setActiveTab(1);
          }
        }
      } catch (err) {
        console.error('Error initializing Spensia 2-Part VO step:', err);
      }
    })();
  }, []);

  const save2PartsState = async (updatedParts: VoPartItem[], updatedMergedVo?: MergedVoItem | null) => {
    try {
      const activeMergedVo = updatedMergedVo !== undefined ? updatedMergedVo : mergedVo;
      const payload = JSON.stringify(
        {
          total_parts: updatedParts.length,
          parts: updatedParts,
          mergedVo: activeMergedVo,
        },
        null,
        2
      );

      localStorage.setItem('spensia_vo_2parts_state', payload);
      if (api?.saveToProject) {
        await api.saveToProject('input/spensia/vo_2parts_state.json', payload);
      }
    } catch (err) {
      console.error('Error saving 2-parts VO state:', err);
    }
  };

  const handleUpdatePartText = (partId: number, newText: string) => {
    setParts((prev) => {
      const updated = prev.map((p) => (p.part_id === partId ? { ...p, text: newText } : p));
      save2PartsState(updated, mergedVo);
      return updated;
    });
  };

  // Copy text to clipboard helper
  const handleCopyText = async (text: string, label: string) => {
    if (!text.trim()) {
      showToast(`⚠️ ${label} masih kosong!`);
      return;
    }
    if (api?.copyToClipboard) {
      await api.copyToClipboard(text);
    } else {
      await navigator.clipboard.writeText(text);
    }
    showToast(`📋 ${label} berhasil disalin ke Clipboard!`);
  };

  // Copy full Gemini prompt complete with Script
  const handleCopyGeminiPrompt = async (scriptContent?: string, label?: string) => {
    const targetScript = scriptContent || (activeTab === 0 ? fullScript : (parts.find(p => p.part_id === activeTab)?.text || fullScript));
    const fullPromptWithScript = getGeminiPromptWithScript(targetScript);

    if (!fullPromptWithScript.trim()) {
      showToast('⚠️ Prompt Gemini masih kosong!');
      return;
    }

    if (api?.copyToClipboard) {
      await api.copyToClipboard(fullPromptWithScript);
    } else {
      await navigator.clipboard.writeText(fullPromptWithScript);
    }
    showToast(`📋 ${label || 'Prompt Gemini (Lengkap Naskah)'} berhasil disalin! Siap di-paste ke Google AI Studio.`);
  };

  // Upload Audio for specific Part
  const handleUploadPartAudio = async (partId: number, fileObj?: File) => {
    try {
      let file: File | null = fileObj || null;

      if (!file) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg';
        input.onchange = async (e: any) => {
          const selectedFile = e.target.files?.[0];
          if (selectedFile) await processPartUpload(selectedFile, partId);
        };
        input.click();
        return;
      }

      await processPartUpload(file, partId);
    } catch (err: any) {
      showToast(`❌ Gagal meng-upload audio Part #${partId}: ${err?.message || err}`);
    }
  };

  const processPartUpload = async (file: File, partId: number) => {
    const arrayBuffer = await file.arrayBuffer();
    const bufferArray = Array.from(new Uint8Array(arrayBuffer));

    let res: any = null;

    if (api?.uploadSpensiaVoAudio) {
      res = await api.uploadSpensiaVoAudio(partId, (file as any).path || file.name, bufferArray);
    } else {
      const objectUrl = URL.createObjectURL(file);
      res = { filename: file.name, url: objectUrl };
    }

    let updatedPartsList: VoPartItem[] = [];

    setParts((prev) => {
      updatedPartsList = prev.map((p) =>
        p.part_id === partId
          ? {
              ...p,
              status: 'uploaded' as const,
              audioUrl: res.url,
              audioPath: res.filePath,
              filename: res.filename,
            }
          : p
      );
      save2PartsState(updatedPartsList, mergedVo);
      return updatedPartsList;
    });

    showToast(`🎙️ Audio VO Part #${partId} (${res.filename}) berhasil di-upload!`);

    // Auto-trigger merge pipeline if all parts have uploaded audio!
    const allUploaded = updatedPartsList.length > 0 && updatedPartsList.every((p) => p.status === 'uploaded' && p.audioPath);
    if (allUploaded) {
      showToast('⚡ Semua Part VO siap! Menggabungkan audio secara otomatis...');
      setTimeout(() => {
        handleRunMergeAudioPipeline(updatedPartsList);
      }, 600);
    }
  };

  // Upload Single Audio Final Directly (1 File)
  const handleUploadMergedAudioDirect = async (fileObj?: File) => {
    try {
      let file: File | null = fileObj || null;
      if (!file) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg';
        input.onchange = async (e: any) => {
          const selectedFile = e.target.files?.[0];
          if (selectedFile) await processMergedDirectUpload(selectedFile);
        };
        input.click();
        return;
      }
      await processMergedDirectUpload(file);
    } catch (err: any) {
      showToast(`❌ Gagal upload audio final: ${err?.message || err}`);
    }
  };

  const processMergedDirectUpload = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const bufferArray = Array.from(new Uint8Array(arrayBuffer));

    let res: any = null;
    if (api?.uploadSpensiaVoAudio) {
      res = await api.uploadSpensiaVoAudio(undefined, (file as any).path || file.name, bufferArray);
    } else {
      const objectUrl = URL.createObjectURL(file);
      res = { filename: file.name, url: objectUrl, filePath: file.name };
    }

    const newMergedVo: MergedVoItem = {
      ...(mergedVo || {}),
      audioUrl: res.url,
      audioPath: res.filePath,
      filename: res.filename,
    };

    setMergedVo(newMergedVo);
    save2PartsState(parts, newMergedVo);

    setPipelineStage('ready');
    setPipelineStatusText('Audio Final Ready (Single Upload)');
    setActiveTab(0);
    showToast(`🎙️ Audio Final (${res.filename}) berhasil di-upload! Siap diproses Gemini alignment.`);
  };

  // ─── PIPELINE UTAMA: GABUNG AUDIO PART UNTUK GEMINI ───
  const handleRunMergeAudioPipeline = async (customParts?: VoPartItem[]) => {
    const activeParts = customParts || parts;
    const audioPaths = activeParts.map((p) => p.audioPath).filter((p): p is string => Boolean(p));

    if (audioPaths.length === 0) {
      showToast('⚠️ Silakan upload audio Voice Over terlebih dahulu (1 file atau per-part)!');
      return;
    }

    // Jika hanya 1 file audio di-upload, gunakan langsung tanpa perlu merge!
    if (audioPaths.length === 1) {
      const singlePath = audioPaths[0];
      const singlePart = activeParts.find((p) => p.audioPath === singlePath);
      const newMergedVo: MergedVoItem = {
        ...(mergedVo || {}),
        audioUrl: singlePart?.audioUrl,
        audioPath: singlePath,
        filename: singlePart?.filename || 'full_narration.mp3',
        duration: singlePart?.duration,
      };

      setMergedVo(newMergedVo);
      save2PartsState(activeParts, newMergedVo);

      setPipelineStage('ready');
      setPipelineStatusText('Audio Ready (Single Audio — Tanpa Merge)');
      setActiveTab(0);
      showToast('✨ Audio tunggal berhasil disiapkan sebagai Audio Final (Tanpa Merge)!');
      return;
    }

    setPipelineStage('merging');
    setPipelineStatusText('Menggabungkan audio...');
    setActiveTab(0); // Switch to merged view tab
    showToast('🎬 Menggabungkan seluruh audio VO part menjadi satu file audio tunggal...');

    try {
      if (!api?.mergeSpensiaVoAudio) {
        throw new Error('API mergeSpensiaVoAudio tidak tersedia di environment ini.');
      }

      const mergeRes = await api.mergeSpensiaVoAudio(audioPaths);

      if (!mergeRes || !mergeRes.filePath) {
        throw new Error('Gagal melakukan penggabungan file audio.');
      }

      const newMergedVo: MergedVoItem = {
        ...(mergedVo || {}),
        audioUrl: mergeRes.url,
        audioPath: mergeRes.filePath,
        filename: mergeRes.filename,
        duration: mergeRes.duration,
      };

      setMergedVo(newMergedVo);
      save2PartsState(activeParts, newMergedVo);

      setPipelineStage('ready');
      setPipelineStatusText('Audio Ready (Menunggu Transkrip Gemini)');
      showToast('✨ Audio gabungan berhasil dibuat! Silakan salin Prompt Gemini & unggah audio ke Google AI Studio.');
    } catch (err: any) {
      console.error('Merge Audio Error:', err);
      setPipelineStage('error');
      setPipelineStatusText(`Error: ${err.message || err}`);
      showToast(`❌ Error Penggabungan Audio: ${err.message || err}`);
    }
  };

  // Process & Validate Manual JSON Transcript Paste from Gemini for Merged Audio or Part
  const handleProcessManualTranscriptJson = (targetKey: string | number) => {
    const jsonText = (pastedJsonMap[String(targetKey)] || '').trim();
    if (!jsonText) {
      showToast('⚠️ Mohon paste teks JSON hasil transkrip dari Gemini terlebih dahulu!');
      return;
    }

    const report: SpensiaTranscriptValidationReport = validateSpensiaWordTranscript(jsonText);

    if (report.normalizedData) {
      if (targetKey === 'merged' || targetKey === 0) {
        const updatedMerged: MergedVoItem = {
          ...(mergedVo || {}),
          rawTranscriptJson: jsonText,
          transcript: report.normalizedData,
        };
        setMergedVo(updatedMerged);
        save2PartsState(parts, updatedMerged);

        if (api?.saveToProject) {
          api.saveToProject(
            'input/spensia/transcripts/merged_transcript.json',
            JSON.stringify(report.normalizedData, null, 2)
          );
          api.saveToProject(
            'input/spensia/transcripts/transcript.json',
            JSON.stringify(report.normalizedData, null, 2)
          );
          api.saveToProject(
            'input/spensia/spensia_mapping.json',
            JSON.stringify(report.normalizedData, null, 2)
          );
        }

        setPipelineStage('completed');
        setPipelineStatusText('Audio Mapping Gemini Sukses & Terkoneksi');
        const segCount = report.normalizedData.segments?.length || 0;
        const wordCount = report.normalizedData.words?.length || 0;
        showToast(
          segCount > 0
            ? `✨ Audio Mapping Gemini Berhasil Diproses (${segCount} Segmen Aligned)!`
            : `✨ Transkrip Gemini Berhasil Diproses (${wordCount} Kata Aligned)!`
        );
      } else {
        const pId = Number(targetKey);
        setParts((prev) => {
          const updated = prev.map((p) =>
            p.part_id === pId
              ? { ...p, rawTranscriptJson: jsonText, transcript: report.normalizedData! }
              : p
          );
          save2PartsState(updated, mergedVo);
          return updated;
        });
        showToast(`✨ Transkrip Part #${pId} Diproses (${report.normalizedData.words.length} Kata Aligned)!`);
      }
    } else {
      showToast(`❌ Parse Transkrip Gemini Gagal: ${report.summaryText}`);
    }
  };

  const handleAudioLoadedMetadata = (key: string, e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const duration = e.currentTarget.duration;
    if (duration && !isNaN(duration)) {
      if (key === 'merged') {
        setMergedVo((prev) => (prev ? { ...prev, duration } : { duration }));
      } else {
        const pId = Number(key);
        setParts((prev) => {
          const updated = prev.map((p) => (p.part_id === pId ? { ...p, duration } : p));
          save2PartsState(updated, mergedVo);
          return updated;
        });
      }
    }
  };

  const handleSeekAudioToTime = (key: string, seconds: number) => {
    const audioEl = audioRefs.current[key];
    if (audioEl) {
      audioEl.currentTime = seconds;
      audioEl.play();
      showToast(`▶️ Play Audio di timestamp ${seconds.toFixed(2)}s`);
    }
  };

  const formatDuration = (sec?: number | null) => {
    if (!sec || isNaN(sec)) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-in fade-in duration-300">
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
                ✨ Spensia AI Workflow — Step 6
              </span>
              {pipelineStage !== 'idle' && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                    pipelineStage === 'merging'
                      ? 'bg-amber-950 text-amber-300 border-amber-800 animate-pulse'
                      : pipelineStage === 'ready'
                      ? 'bg-teal-950 text-teal-300 border-teal-800'
                      : pipelineStage === 'completed'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-red-950 text-red-300 border-red-800'
                  }`}
                >
                  Status: {pipelineStatusText || pipelineStage}
                </span>
              )}
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>🎙️</span> Voice Over Studio & Gemini AI Audio Alignment
            </h1>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              Upload/gabungkan audio VO final, salin prompt presisi Gemini (dengan Naskah Asli), lalu tempelkan hasil JSON dari Gemini untuk timestamp kata presisi tinggi.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => handleRunMergeAudioPipeline()}
              disabled={pipelineStage === 'merging'}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-950/60 border border-emerald-300/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {pipelineStage === 'merging' ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>{pipelineStatusText}...</span>
                </>
              ) : (
                <>
                  <span>🎬</span>
                  <span>Gabung Audio VO Parts</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleCopyGeminiPrompt(undefined, 'Prompt Gemini (Lengkap Naskah)')}
              className="px-3.5 py-2.5 bg-emerald-900 hover:bg-emerald-800 text-emerald-100 rounded-xl text-xs font-extrabold border border-emerald-700 shadow-md transition-all flex items-center gap-1.5"
            >
              <span>📋</span>
              <span>Copy Gemini Prompt</span>
            </button>

            <button
              onClick={() => setShowPromptEditor(!showPromptEditor)}
              className="px-3 py-2.5 bg-gray-900 hover:bg-gray-800 text-gray-400 rounded-xl text-xs font-semibold border border-gray-800 transition-all flex items-center gap-1"
              title="Edit Master Prompt Template"
            >
              <span>⚙️</span>
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Transcription Prompt Editor */}
      {showPromptEditor && (
        <div className="bg-gray-900/90 p-5 rounded-3xl border border-emerald-800/40 shadow-xl space-y-3 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <span>📝</span> Template Master Prompt Gemini (`audio-mapping-prompt.md`)
            </h3>
            <button
              onClick={() => handleCopyText(transcriptionPrompt, 'Template Prompt Gemini')}
              className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-900"
            >
              📋 Copy Raw Template
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            Note: Tag <code className="text-emerald-300">{`{{FULL_SCRIPT}}`}</code> akan otomatis digantikan dengan naskah video saat Anda menekan tombol <strong>"Copy Gemini Prompt"</strong>.
          </p>
          <textarea
            value={transcriptionPrompt}
            onChange={(e) => setTranscriptionPrompt(e.target.value)}
            rows={10}
            className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs font-mono text-gray-300 focus:outline-none focus:border-emerald-500 leading-relaxed resize-y"
          />
        </div>
      )}

      {/* Workflow Quick Step Guide */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-950 to-gray-900 p-5 rounded-3xl border border-gray-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-2">
          <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <span>🚀</span> Langkah Penggunaan Gemini AI Audio Alignment
          </h2>
          <span className="text-[10px] font-mono text-gray-500">Gemini 1.5 Pro / Flash / 2.0 / 3.x Flash Audio</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-gray-950/80 rounded-2xl border border-gray-800 space-y-1">
            <div className="font-extrabold text-emerald-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-center text-[11px] font-mono leading-tight">1</span>
              <span>Upload Audio</span>
            </div>
            <p className="text-[11px] text-gray-400">Upload audio VO Part 1 & Part 2, lalu gabungkan audio final.</p>
          </div>
          <div className="p-3 bg-gray-950/80 rounded-2xl border border-gray-800 space-y-1">
            <div className="font-extrabold text-emerald-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-center text-[11px] font-mono leading-tight">2</span>
              <span>Copy Prompt Gemini</span>
            </div>
            <p className="text-[11px] text-gray-400">Klik <strong>"Copy Gemini Prompt"</strong> (otomatis include Naskah Asli).</p>
          </div>
          <div className="p-3 bg-gray-950/80 rounded-2xl border border-gray-800 space-y-1">
            <div className="font-extrabold text-emerald-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-center text-[11px] font-mono leading-tight">3</span>
              <span>Run di AI Studio</span>
            </div>
            <p className="text-[11px] text-gray-400">Buka Google AI Studio, upload file audio, paste prompt, lalu Generate JSON.</p>
          </div>
          <div className="p-3 bg-gray-950/80 rounded-2xl border border-gray-800 space-y-1">
            <div className="font-extrabold text-emerald-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-center text-[11px] font-mono leading-tight">4</span>
              <span>Paste Hasil JSON</span>
            </div>
            <p className="text-[11px] text-gray-400">Paste teks JSON dari Gemini ke kolom input di bawah, lalu klik Proses!</p>
          </div>
        </div>
      </div>

      {/* Top Global TTS Context Presets */}
      <div className="bg-gray-900/80 p-6 rounded-3xl border border-gray-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-950 text-emerald-400 rounded-xl text-xs font-bold">⚙️</span>
            <h2 className="text-sm font-bold text-white">Preset Komponen TTS Google AI Studio</h2>
          </div>
          <span className="text-[11px] text-gray-400 font-mono">Salin komponen ini untuk AI Studio TTS</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Scene Context */}
          <div className="space-y-2 bg-gray-950/70 p-4 rounded-2xl border border-gray-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <span>🎬</span> Scene Context:
              </label>
              <button
                onClick={() => handleCopyText(sceneContext, 'Scene Context')}
                className="px-3 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded-xl text-[11px] font-bold border border-emerald-800 transition-all flex items-center gap-1"
              >
                <span>📋</span>
                <span>Copy Scene</span>
              </button>
            </div>
            <textarea
              value={sceneContext}
              onChange={(e) => setSceneContext(e.target.value)}
              rows={3}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs text-gray-300 font-mono leading-relaxed focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Sample Context */}
          <div className="space-y-2 bg-gray-950/70 p-4 rounded-2xl border border-gray-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <span>🎙️</span> Sample Context:
              </label>
              <button
                onClick={() => handleCopyText(sampleContext, 'Sample Context')}
                className="px-3 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded-xl text-[11px] font-bold border border-emerald-800 transition-all flex items-center gap-1"
              >
                <span>📋</span>
                <span>Copy Sample</span>
              </button>
            </div>
            <textarea
              value={sampleContext}
              onChange={(e) => setSampleContext(e.target.value)}
              rows={3}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs text-gray-300 font-mono leading-relaxed focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Main Tab Selector: Merged Audio Final vs Individual Parts */}
      <div className="flex items-center gap-3 bg-gray-950 p-2 rounded-2xl border border-gray-800">
        <button
          onClick={() => setActiveTab(0)}
          className={`flex-1 py-3.5 px-6 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 ${
            activeTab === 0
              ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-400/40'
              : 'text-gray-300 hover:text-white hover:bg-gray-900'
          }`}
        >
          <span className="w-6 h-6 rounded-lg bg-black/40 flex items-center justify-center font-mono text-xs font-bold text-emerald-400">
            ⚡
          </span>
          <span className="text-xs font-black uppercase tracking-wider">
            Audio Final & Gemini Transkrip Gabungan
          </span>
          {mergedVo?.transcript ? (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
          ) : mergedVo?.audioUrl ? (
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shrink-0 animate-ping" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-gray-600 shrink-0" />
          )}
        </button>

        {parts.map((p) => (
          <button
            key={p.part_id}
            onClick={() => setActiveTab(p.part_id)}
            className={`py-3.5 px-5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === p.part_id
                ? 'bg-gray-800 text-white border border-gray-700 shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
          >
            <span className="w-5 h-5 rounded-md bg-black/30 flex items-center justify-center font-mono text-[11px] font-bold">
              #{p.part_id}
            </span>
            <span className="text-xs font-extrabold">{p.part_title.split(':')[0]}</span>
            {p.status === 'uploaded' ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-gray-600 shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* ─── TAB 0: MERGED AUDIO FINAL & GEMINI TRANSCRIPT VIEW ─── */}
      {activeTab === 0 && (
        <div className="bg-gray-900/90 p-7 rounded-3xl border border-emerald-800/40 shadow-2xl space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300 text-sm font-mono font-bold flex items-center justify-center">
                  ⚡
                </span>
                <h2 className="text-base font-extrabold text-white">Audio Final Gabungan & Gemini Transkrip</h2>
              </div>
              <p className="text-xs text-gray-400 pl-11">
                Seluruh file part audio VO digabungkan secara sequential tanpa gap/overlap. Gunakan Gemini Prompt untuk mendapatkan timestamp presisi sepanjang video.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 pl-11 sm:pl-0">
              <button
                onClick={() => handleCopyGeminiPrompt(fullScript, 'Prompt Gemini Full Script')}
                className="px-4 py-2 bg-emerald-900 hover:bg-emerald-800 text-emerald-200 rounded-xl text-xs font-extrabold border border-emerald-700 shadow-md transition-all flex items-center gap-1.5"
              >
                <span>📋</span>
                <span>Copy Gemini Prompt (Lengkap Naskah)</span>
              </button>

              <button
                onClick={() => handleRunMergeAudioPipeline()}
                disabled={pipelineStage === 'merging'}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {pipelineStage === 'merging' ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>{pipelineStatusText}...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Gabung Ulang Audio Parts</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Merged Audio Player Card */}
          {mergedVo?.audioUrl ? (
            <div className="p-5 bg-gray-950 border border-emerald-800/60 rounded-2xl space-y-3 shadow-inner">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-950 text-emerald-400 rounded-xl flex items-center justify-center text-lg border border-emerald-800 shrink-0">
                    🎵
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white truncate max-w-md">
                      {mergedVo.filename || 'merged_narration.mp3'}
                    </h5>
                    <span className="text-[11px] font-mono text-emerald-400 font-bold">
                      Durasi Audio Final: {formatDuration(mergedVo.duration)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUploadMergedAudioDirect()}
                    className="px-3 py-1 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded-xl text-xs font-semibold border border-gray-700 transition-all flex items-center gap-1"
                  >
                    <span>📤</span>
                    <span>Ganti Audio (1 File)</span>
                  </button>
                  <span className="text-xs font-mono font-bold px-3 py-1 bg-emerald-950 text-emerald-300 rounded-xl border border-emerald-800">
                    ✓ Audio Ready
                  </span>
                </div>
              </div>

              {/* Audio Player for Merged File */}
              <audio
                ref={(el) => (audioRefs.current['merged'] = el)}
                src={mergedVo.audioUrl}
                controls
                onLoadedMetadata={(e) => handleAudioLoadedMetadata('merged', e)}
                onTimeUpdate={(e) => handleAudioTimeUpdate('merged', e)}
                className="w-full h-10 focus:outline-none rounded-xl"
              />
            </div>
          ) : (
            <div className="p-8 bg-gray-950 border-2 border-dashed border-gray-800 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-950 text-emerald-400 rounded-2xl flex items-center justify-center text-xl mx-auto border border-emerald-800">
                🎙️
              </div>
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-white">Audio Final Belum Di-upload / Digabungkan</h5>
                <p className="text-[11px] text-gray-400 max-w-md mx-auto">
                  Anda bisa langsung meng-upload <strong>1 file audio VO final</strong> (tanpa merge), atau upload per-part pada tab Part 1 & Part 2 lalu klik gabungkan.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
                <button
                  onClick={() => handleUploadMergedAudioDirect()}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white font-extrabold text-xs rounded-xl hover:from-emerald-500 hover:to-cyan-500 shadow-lg shadow-emerald-950/50 flex items-center gap-2"
                >
                  <span>📤</span>
                  <span>Upload 1 File Audio Final (Langsung)</span>
                </button>
                <button
                  onClick={() => handleRunMergeAudioPipeline()}
                  className="px-4 py-2.5 bg-gray-900 border border-gray-700 text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-800 hover:text-white flex items-center gap-2"
                >
                  <span>⚡</span>
                  <span>Gunakan Audio Per-Part</span>
                </button>
              </div>
            </div>
          )}

          {/* Gemini JSON Transcript Input Area */}
          <div className="p-6 bg-gray-950 border border-teal-800/60 rounded-2xl space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
              <div>
                <label className="text-xs font-extrabold text-teal-300 flex items-center gap-2">
                  <span>📥</span> Input Hasil Audio Mapping JSON dari Gemini (Segments Timestamps):
                </label>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Paste output JSON (field <code className="text-teal-300 font-mono">segments</code>) yang dihasilkan Gemini di Google AI Studio di sini.
                </p>
              </div>

              <button
                onClick={() => handleCopyGeminiPrompt(fullScript, 'Prompt Gemini')}
                className="px-3.5 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shrink-0"
              >
                <span>📋</span>
                <span>Salin Prompt Gemini</span>
              </button>
            </div>

            <textarea
              value={pastedJsonMap['merged'] || ''}
              onChange={(e) => setPastedJsonMap({ ...pastedJsonMap, merged: e.target.value })}
              rows={6}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-teal-500 shadow-inner"
              placeholder='Paste teks JSON hasil Gemini di sini (contoh: { "segments": [ { "segment_id": 1, "quote": "...", "start_sec": 0.0, "end_sec": 5.5, "duration_sec": 5.5 } ] })...'
            />

            <div className="flex justify-end items-center gap-3">
              {mergedVo?.transcript && (
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {mergedVo.transcript.segments?.length
                    ? `✓ Valid Timeline Mapping (${mergedVo.transcript.segments.length} Segmen Aligned)`
                    : `✓ Valid Transcript (${mergedVo.transcript.words.length} Kata Aligned)`}
                </span>
              )}
              <button
                onClick={() => handleProcessManualTranscriptJson('merged')}
                className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-lg flex items-center gap-2"
              >
                <span>✨</span>
                <span>Proses & Validasi Audio Mapping</span>
              </button>
            </div>
          </div>

          {/* Display Segment Timeline Mapping Table if segments array exists */}
          {mergedVo?.transcript?.segments && mergedVo.transcript.segments.length > 0 && (
            <div className="p-5 bg-gray-950 border border-teal-800/80 rounded-2xl space-y-3 shadow-xl animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1 bg-teal-950 text-teal-300 rounded-lg text-xs font-bold">🎬</span>
                  <h4 className="text-xs font-extrabold text-white tracking-wide">
                    Timeline Mapping Segmen Adegan (`spensia_mapping.json` — Ready for FFmpeg Render)
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-teal-400 font-bold">
                  {mergedVo.transcript.segments.length} Segmen Terpetakan
                </span>
              </div>

              <div className="overflow-x-auto max-h-72 border border-gray-800/80 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-900 text-gray-400 font-mono text-[11px] uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Segmen</th>
                      <th className="py-2.5 px-3">Rentang Waktu (Start ➔ End)</th>
                      <th className="py-2.5 px-3">Durasi</th>
                      <th className="py-2.5 px-3">Teks Narasi / Quote</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 font-mono text-gray-300">
                    {mergedVo.transcript.segments.map((seg) => (
                      <tr key={seg.segment_id} className="hover:bg-gray-900/60 transition-colors">
                        <td className="py-2 px-3 font-bold text-teal-400">#{seg.segment_id}</td>
                        <td className="py-2 px-3 text-emerald-300">
                          {seg.start_sec.toFixed(2)}s ➔ {seg.end_sec.toFixed(2)}s
                        </td>
                        <td className="py-2 px-3 text-amber-300 font-bold">{seg.duration_sec.toFixed(2)}s</td>
                        <td className="py-2 px-3 font-sans text-gray-300 truncate max-w-xs" title={seg.quote}>
                          {seg.quote}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleSeekAudioToTime('merged', seg.start_sec)}
                            className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded-lg text-[10px] font-bold border border-emerald-800 transition-all"
                          >
                            ▶️ Play {seg.start_sec.toFixed(1)}s
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Display Interactive Word-Level Transcript Inspector for Merged Audio */}
          {mergedVo?.transcript && mergedVo.transcript.words && mergedVo.transcript.words.length > 0 && (
            <div className="p-5 bg-gray-950 border border-emerald-800/60 rounded-2xl space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1 bg-emerald-950 text-emerald-400 rounded-lg text-xs">📝</span>
                  <h4 className="text-xs font-bold text-white">
                    Transkrip Presisi Audio Final ({mergedVo.transcript.words.length} Kata Aligned)
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleCopyText(
                        JSON.stringify(mergedVo.transcript, null, 2),
                        'JSON Words Timestamps Audio Final'
                      )
                    }
                    className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-emerald-300 rounded-xl text-[11px] font-mono font-bold border border-gray-800 transition-all"
                  >
                    📋 Copy JSON Words
                  </button>

                  <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800">
                    <button
                      onClick={() => setTranscriptTab('chunks')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        transcriptTab === 'chunks'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      🧩 Phrase Chunks
                    </button>
                    <button
                      onClick={() => setTranscriptTab('words')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        transcriptTab === 'words'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      ⏱️ Words
                    </button>
                    <button
                      onClick={() => setTranscriptTab('full')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        transcriptTab === 'full'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      📜 Full Text
                    </button>
                  </div>
                </div>
              </div>

              {/* Phrase Chunks View */}
              {transcriptTab === 'chunks' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-gray-400 italic flex items-center justify-between">
                    <span>💡 Potongan frasa alami (Chunks) untuk subtitle video. Klik frasa untuk memutar audio!</span>
                    <span className="text-yellow-400 font-bold font-mono">
                      ⏱️ Time: {(audioCurrentTimes['merged'] || 0).toFixed(2)}s
                    </span>
                  </p>

                  <div className="space-y-2.5 max-h-80 overflow-y-auto p-3 bg-gray-900/90 rounded-xl border border-gray-800/80 scrollbar-thin">
                    {(mergedVo.transcript.chunks || []).map((chunk, cIdx) => {
                      const curTime = audioCurrentTimes['merged'] || 0;
                      const isChunkActive = curTime >= chunk.start && curTime <= chunk.end;

                      return (
                        <div
                          key={cIdx}
                          className={`p-3 rounded-xl space-y-2 transition-all duration-150 ${
                            isChunkActive
                              ? 'bg-emerald-950/90 border-2 border-emerald-400 shadow-xl shadow-emerald-950/60 ring-2 ring-emerald-400/30'
                              : 'bg-gray-950 border border-gray-800 hover:border-emerald-700/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => handleSeekAudioToTime('merged', chunk.start)}
                              className="flex items-center gap-2 text-left group"
                            >
                              <span
                                className={`px-2 py-0.5 font-mono text-[10px] rounded transition-all ${
                                  isChunkActive
                                    ? 'bg-emerald-400 text-gray-950 font-black shadow shadow-emerald-400/50 animate-pulse'
                                    : 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800 group-hover:bg-emerald-800 group-hover:text-white'
                                }`}
                              >
                                ▶ {chunk.start.toFixed(2)}s - {chunk.end.toFixed(2)}s
                              </span>
                              <span
                                className={`text-xs font-semibold transition-colors ${
                                  isChunkActive
                                    ? 'text-emerald-300 font-bold text-sm'
                                    : 'text-white group-hover:text-emerald-300'
                                }`}
                              >
                                #{chunk.chunk_id} {chunk.text}
                              </span>
                            </button>
                            <span className="text-[10px] text-gray-500 font-mono">
                              {chunk.words?.length || 0} kata
                            </span>
                          </div>

                          {chunk.words && chunk.words.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pl-2 pt-1.5 border-t border-gray-900/80">
                              {chunk.words.map((w, wIdx) => {
                                const isWordActive = curTime >= w.start && curTime <= w.end;
                                return (
                                  <button
                                    key={wIdx}
                                    onClick={() => handleSeekAudioToTime('merged', w.start)}
                                    className={`rounded font-mono transition-all duration-100 flex items-center gap-1 ${
                                      isWordActive
                                        ? 'px-3 py-1 bg-yellow-400 text-gray-950 font-black border-2 border-yellow-300 shadow-xl shadow-yellow-500/60 scale-110 z-10 animate-bounce'
                                        : 'px-2 py-1 bg-gray-900 hover:bg-emerald-950 border border-gray-800 text-[11px] text-gray-300 hover:text-emerald-300'
                                    }`}
                                  >
                                    <span>{w.word}</span>
                                    <span
                                      className={`text-[9px] ${
                                        isWordActive ? 'text-gray-900 font-bold' : 'text-emerald-400/80'
                                      }`}
                                    >
                                      {w.start.toFixed(2)}s
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Interactive Word Timestamps View */}
              {transcriptTab === 'words' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-gray-400 italic flex items-center justify-between">
                    <span>💡 Klik kata untuk memutar audio pada detik tersebut. Kata yang diucapkan akan menyala kuning!</span>
                    <span className="text-yellow-400 font-bold font-mono">
                      ⏱️ Time: {(audioCurrentTimes['merged'] || 0).toFixed(2)}s
                    </span>
                  </p>

                  <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto p-3 bg-gray-900/90 rounded-xl border border-gray-800/80 scrollbar-thin">
                    {mergedVo.transcript.words.map((w, idx) => {
                      const curTime = audioCurrentTimes['merged'] || 0;
                      const isWordActive = curTime >= w.start && curTime <= w.end;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSeekAudioToTime('merged', w.start)}
                          className={`rounded-lg font-mono transition-all duration-100 flex items-center gap-1.5 group ${
                            isWordActive
                              ? 'px-3.5 py-2 bg-yellow-400 text-gray-950 font-black border-2 border-yellow-300 text-xs shadow-xl shadow-yellow-500/60 scale-110 z-10 animate-bounce'
                              : 'px-2.5 py-1.5 bg-gray-950 hover:bg-emerald-950 hover:border-emerald-500 border border-gray-800 text-xs text-gray-200 hover:text-emerald-300'
                          }`}
                        >
                          <span className={isWordActive ? 'font-black text-gray-950' : 'font-semibold text-white'}>
                            {w.word}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded ${
                              isWordActive
                                ? 'bg-gray-950 text-yellow-300 font-bold'
                                : 'text-emerald-400 bg-emerald-950 border border-emerald-900'
                            }`}
                          >
                            {w.start.toFixed(2)}s
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Full Text View */}
              {transcriptTab === 'full' && (
                <div className="space-y-2">
                  <textarea
                    readOnly
                    value={mergedVo.transcript.transcript_full}
                    rows={6}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3.5 text-xs text-gray-200 font-mono leading-relaxed focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── INDIVIDUAL PART FOCUS VIEW (TABS 1 & 2) ─── */}
      {parts.map((part) => {
        if (part.part_id !== activeTab) return null;

        const wordCount = part.text.trim() ? part.text.trim().split(/\s+/).length : 0;
        const estimatedMin = (wordCount / 140).toFixed(1);

        return (
          <div
            key={part.part_id}
            className="bg-gray-900/90 p-7 rounded-3xl border border-gray-800 shadow-2xl space-y-6 animate-in fade-in duration-200"
          >
            {/* Part Title Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300 text-sm font-mono font-bold flex items-center justify-center">
                    #{part.part_id}
                  </span>
                  <h2 className="text-base font-extrabold text-white">{part.part_title}</h2>
                </div>
                <p className="text-xs text-gray-400 pl-11">{part.sub_title}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0 pl-11 sm:pl-0">
                <button
                  onClick={() => handleCopyGeminiPrompt(part.text, `Prompt Gemini Part #${part.part_id}`)}
                  className="px-4 py-2 bg-emerald-900 hover:bg-emerald-800 text-emerald-100 rounded-xl text-xs font-bold border border-emerald-700 transition-all flex items-center gap-1.5 shadow-md"
                >
                  <span>📋</span>
                  <span>Copy Prompt Gemini Part #{part.part_id}</span>
                </button>

                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-xl border border-emerald-800 font-bold">
                  {wordCount} Kata (~{estimatedMin} mnt)
                </span>

                <span
                  className={`text-xs font-mono font-bold px-3 py-1 rounded-xl border ${
                    part.status === 'uploaded'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      : 'bg-gray-950 text-red-400 border-red-900/60'
                  }`}
                >
                  {part.status === 'uploaded' ? '✓ VO Ready' : '⚪ Belum Upload'}
                </span>
              </div>
            </div>

            {/* Script Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-2">
                  <span>📜</span> Isi Naskah Part #{part.part_id}:
                </label>

                <button
                  onClick={() => handleCopyText(part.text, `Naskah Part #${part.part_id}`)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <span>📋</span>
                  <span>Salin Naskah Part #{part.part_id}</span>
                </button>
              </div>

              <textarea
                value={part.text}
                onChange={(e) => handleUpdatePartText(part.part_id, e.target.value)}
                rows={6}
                className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-emerald-500 shadow-inner"
                placeholder={`Ketik atau edit naskah untuk Part #${part.part_id} di sini...`}
              />
            </div>

            {/* Audio Upload & Player Section */}
            <div className="space-y-4 pt-2 border-t border-gray-800/80">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <span>🎵</span> File Audio VO Part #{part.part_id}:
              </h4>

              {part.audioUrl ? (
                <div className="p-5 bg-gray-950 border border-emerald-800/60 rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-950 text-emerald-400 rounded-xl flex items-center justify-center text-lg border border-emerald-800 shrink-0">
                        🎵
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white truncate max-w-md">
                          {part.filename || `part_${part.part_id}.mp3`}
                        </h5>
                        <span className="text-[11px] font-mono text-emerald-400 font-bold">
                          Durasi: {formatDuration(part.duration)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUploadPartAudio(part.part_id)}
                        className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-emerald-300 rounded-xl text-xs font-bold border border-gray-800 transition-all flex items-center gap-1.5"
                      >
                        <span>🔄</span>
                        <span>Ganti Audio Part #{part.part_id}</span>
                      </button>
                    </div>
                  </div>

                  {/* Audio Player */}
                  <audio
                    ref={(el) => (audioRefs.current[String(part.part_id)] = el)}
                    src={part.audioUrl}
                    controls
                    onLoadedMetadata={(e) => handleAudioLoadedMetadata(String(part.part_id), e)}
                    onTimeUpdate={(e) => handleAudioTimeUpdate(String(part.part_id), e)}
                    className="w-full h-10 focus:outline-none rounded-xl"
                  />
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleUploadPartAudio(part.part_id, file);
                  }}
                  onClick={() => handleUploadPartAudio(part.part_id)}
                  className="p-8 bg-gray-950 border-2 border-dashed border-gray-800 hover:border-emerald-500/80 rounded-2xl text-center space-y-2 cursor-pointer transition-all duration-200 group"
                >
                  <div className="w-12 h-12 bg-emerald-950 text-emerald-400 rounded-2xl flex items-center justify-center text-xl mx-auto border border-emerald-800 group-hover:scale-110 transition-transform">
                    📥
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-white">
                      Drag & Drop atau Klik untuk Upload Audio VO Part #{part.part_id}
                    </h5>
                    <p className="text-[11px] text-gray-500">
                      Upload file audio VO dari Google AI Studio (.mp3 / .wav / .m4a)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Individual Part Gemini JSON Paste */}
            <div className="p-5 bg-gray-950 border border-gray-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-teal-400 flex items-center gap-2">
                  <span>📋</span> Paste Hasil Transkrip JSON Part #{part.part_id} dari Gemini:
                </label>

                <button
                  onClick={() => handleCopyGeminiPrompt(part.text, `Prompt Part #${part.part_id}`)}
                  className="text-xs text-emerald-400 hover:underline font-mono font-bold"
                >
                  📋 Copy Gemini Prompt Part #{part.part_id}
                </button>
              </div>

              <textarea
                value={pastedJsonMap[String(part.part_id)] || ''}
                onChange={(e) => setPastedJsonMap({ ...pastedJsonMap, [part.part_id]: e.target.value })}
                rows={4}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3.5 text-xs text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-teal-500"
                placeholder={`Paste hasil JSON transkrip Gemini untuk Part #${part.part_id} di sini...`}
              />

              <div className="flex justify-end">
                <button
                  onClick={() => handleProcessManualTranscriptJson(part.part_id)}
                  className="px-5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5"
                >
                  <span>✨</span>
                  <span>Proses & Validasi Transkrip Part #{part.part_id}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SpensiaVoiceOverStep;
