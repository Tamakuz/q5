// dashboard/src/components/spensia/SpensiaVoiceOverStep.tsx
import React, { useState, useEffect, useRef } from 'react';
import { validateSpensiaWordTranscript, SpensiaWordTimestamp, SpensiaTranscriptValidationReport } from '../../utils/spensiaValidation';

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
  transcript?: {
    transcript_full: string;
    words: SpensiaWordTimestamp[];
  };
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

  const [parts, setParts] = useState<VoPartItem[]>([
    { part_id: 1, part_title: PART_CONFIGS[0].title, sub_title: PART_CONFIGS[0].subtitle, text: '', status: 'pending' },
    { part_id: 2, part_title: PART_CONFIGS[1].title, sub_title: PART_CONFIGS[1].subtitle, text: '', status: 'pending' },
  ]);

  const [transcriptionPrompt, setTranscriptionPrompt] = useState<string>('');
  const [showPromptEditor, setShowPromptEditor] = useState<boolean>(false);
  const [pastedJsonMap, setPastedJsonMap] = useState<Record<number, string>>({});

  const [activeTab, setActiveTab] = useState<number>(1);
  const [transcriptTab, setTranscriptTab] = useState<'words' | 'full'>('words');
  const [toast, setToast] = useState<string | null>(null);

  const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({});

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadTranscriptionPromptFromFile = async () => {
    try {
      if (api?.readFromProject) {
        const loadedPrompt = await api.readFromProject('dashboard/prompts/spensia/audio-transcription-prompt.md');
        if (loadedPrompt && loadedPrompt.trim().length > 0) {
          setTranscriptionPrompt(loadedPrompt);
          return loadedPrompt;
        }
      }
    } catch (err) {
      console.error('Error reading audio-transcription-prompt.md:', err);
    }
    return '';
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
          // 1. Load full script from Step 2
          const loadedScript = await api.readFromProject('input/spensia/full_script.txt');
          const scriptStr = loadedScript && loadedScript.trim() ? loadedScript : '';
          setFullScript(scriptStr);

          const splitTextParts = splitScriptInto2Parts(scriptStr);

          // 2. Load existing 2-part VO state
          const savedVo2Json = await api.readFromProject('input/spensia/vo_2parts_state.json');
          let savedPartsMap: Record<number, any> = {};
          if (savedVo2Json) {
            try {
              const obj = JSON.parse(savedVo2Json);
              if (Array.isArray(obj.parts)) {
                obj.parts.forEach((p: any) => {
                  savedPartsMap[p.part_id] = p;
                });
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
        }
      } catch (err) {
        console.error('Error initializing Spensia 2-Part VO step:', err);
      }
    })();
  }, []);

  const save2PartsState = async (updatedParts: VoPartItem[]) => {
    try {
      const payload = JSON.stringify({ total_parts: updatedParts.length, parts: updatedParts }, null, 2);
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
      save2PartsState(updated);
      return updated;
    });
  };

  // Quick copy text
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

    setParts((prev) => {
      const updated = prev.map((p) =>
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
      save2PartsState(updated);
      return updated;
    });

    showToast(`🎙️ Audio VO Part #${partId} (${res.filename}) berhasil di-upload!`);
  };

  // Process & Validate Manual JSON Transcript Paste
  const handleProcessManualTranscriptJson = (partId: number) => {
    const jsonText = (pastedJsonMap[partId] || '').trim();
    if (!jsonText) {
      showToast('⚠️ Mohon paste teks JSON hasil transkrip AI Studio terlebih dahulu!');
      return;
    }

    const report: SpensiaTranscriptValidationReport = validateSpensiaWordTranscript(jsonText);

    if (report.normalizedData) {
      setParts((prev) => {
        const updated = prev.map((p) =>
          p.part_id === partId
            ? { ...p, rawTranscriptJson: jsonText, transcript: report.normalizedData! }
            : p
        );
        save2PartsState(updated);

        // Save transcript file to project workspace
        if (api?.saveToProject) {
          api.saveToProject(
            `input/spensia/transcripts/part_${partId}_transcript.json`,
            JSON.stringify(report.normalizedData, null, 2)
          );
        }

        return updated;
      });

      showToast(`✨ Transkrip Part #${partId} Berhasil Diproses (${report.normalizedData.words.length} Kata)!`);
    } else {
      showToast(`❌ Parse Transkrip Gagal: ${report.summaryText}`);
    }
  };

  const handleAudioLoadedMetadata = (partId: number, e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const duration = e.currentTarget.duration;
    if (duration && !isNaN(duration)) {
      setParts((prev) => {
        const updated = prev.map((p) => (p.part_id === partId ? { ...p, duration } : p));
        save2PartsState(updated);
        return updated;
      });
    }
  };

  const handleSeekAudioToTime = (partId: number, seconds: number) => {
    const audioEl = audioRefs.current[partId];
    if (audioEl) {
      audioEl.currentTime = seconds;
      audioEl.play();
      showToast(`▶️ Play Audio Part #${partId} di timestamp ${seconds.toFixed(2)}s`);
    }
  };

  const formatDuration = (sec?: number | null) => {
    if (!sec || isNaN(sec)) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const uploadedCount = parts.filter((p) => p.status === 'uploaded').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-2xl font-semibold text-xs flex items-center gap-2 border border-emerald-400/30 animate-bounce">
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
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>🎙️</span> Voice Over Studio & Word-Level Transcripter
            </h1>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              Naskah terbagi menjadi 2 Part utama. Salin prompt transkrip untuk Google AI Studio, lalu paste hasil JSON transkrip di bawah.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleCopyText(transcriptionPrompt, 'Prompt Transkrip AI Studio')}
              className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5"
            >
              <span>📋</span>
              <span>Copy Prompt Transkrip</span>
            </button>
            <button
              onClick={() => setShowPromptEditor(!showPromptEditor)}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold border border-gray-700 transition-all flex items-center gap-1.5"
            >
              <span>⚙️</span>
              <span>{showPromptEditor ? 'Sembunyikan' : 'Edit Prompt'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Transcription Prompt Editor */}
      {showPromptEditor && (
        <div className="bg-gray-900/90 p-5 rounded-3xl border border-emerald-800/40 shadow-xl space-y-3 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <span>📝</span> Master Transcription Prompt (`audio-transcription-prompt.md`)
            </h3>
            <button
              onClick={() => handleCopyText(transcriptionPrompt, 'Prompt Transkrip')}
              className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-900"
            >
              📋 Copy Prompt
            </button>
          </div>
          <textarea
            value={transcriptionPrompt}
            onChange={(e) => setTranscriptionPrompt(e.target.value)}
            rows={10}
            className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs font-mono text-gray-300 focus:outline-none focus:border-emerald-500 leading-relaxed resize-y"
          />
        </div>
      )}

      {/* Top Global TTS Context Presets (Spacious Card) */}
      <div className="bg-gray-900/80 p-6 rounded-3xl border border-gray-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-950 text-emerald-400 rounded-xl text-xs font-bold">⚙️</span>
            <h2 className="text-sm font-bold text-white">Preset Komponen TTS Google AI Studio</h2>
          </div>
          <span className="text-[11px] text-gray-400 font-mono">Salin komponen ini sekali untuk AI Studio</span>
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

      {/* 2 Parts Tab Selection Navigation */}
      <div className="flex items-center gap-3 bg-gray-950 p-2 rounded-2xl border border-gray-800">
        {parts.map((p) => (
          <button
            key={p.part_id}
            onClick={() => setActiveTab(p.part_id)}
            className={`flex-1 py-3.5 px-6 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 ${
              activeTab === p.part_id
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-950/50'
                : 'text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
          >
            <span className="w-6 h-6 rounded-lg bg-black/30 flex items-center justify-center font-mono text-xs font-bold">
              #{p.part_id}
            </span>
            <span className="text-xs font-extrabold">{p.part_title}</span>
            {p.status === 'uploaded' ? (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-gray-600 shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Spacious Single Part Focus View */}
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

                    <button
                      onClick={() => handleUploadPartAudio(part.part_id)}
                      className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-emerald-300 rounded-xl text-xs font-bold border border-gray-800 transition-all flex items-center gap-1.5"
                    >
                      <span>🔄</span>
                      <span>Ganti Audio Part #{part.part_id}</span>
                    </button>
                  </div>

                  {/* Audio Player with Ref for Timestamp Sync */}
                  <audio
                    ref={(el) => (audioRefs.current[part.part_id] = el)}
                    src={part.audioUrl}
                    controls
                    onLoadedMetadata={(e) => handleAudioLoadedMetadata(part.part_id, e)}
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
                      Upload file hasil audio VO dari Google AI Studio (.mp3 / .wav / .m4a)
                    </p>
                  </div>
                </div>
              )}

              {/* Manual Input Area for JSON Transcript from Google AI Studio */}
              <div className="p-5 bg-gray-950 border border-gray-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-teal-400 flex items-center gap-2">
                    <span>📋</span> Paste Hasil Transkrip JSON dari Google AI Studio:
                  </label>

                  <button
                    onClick={() => handleCopyText(transcriptionPrompt, 'Prompt Transkrip AI Studio')}
                    className="text-xs text-emerald-400 hover:underline font-mono font-bold"
                  >
                    📋 Copy Prompt Transkrip
                  </button>
                </div>

                <textarea
                  value={pastedJsonMap[part.part_id] || ''}
                  onChange={(e) => setPastedJsonMap({ ...pastedJsonMap, [part.part_id]: e.target.value })}
                  rows={5}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3.5 text-xs text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-teal-500"
                  placeholder='Paste hasil JSON di sini (contoh: {"transcript_full": "...", "words": [{"word": "...", "start": 0.0, "end": 0.5}]})'
                />

                <div className="flex justify-end">
                  <button
                    onClick={() => handleProcessManualTranscriptJson(part.part_id)}
                    className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5"
                  >
                    <span>✨</span>
                    <span>Proses & Validasi Transkrip Part #{part.part_id}</span>
                  </button>
                </div>
              </div>

              {/* Display Interactive Word-Level Transcript Results */}
              {part.transcript && part.transcript.words && part.transcript.words.length > 0 && (
                <div className="p-5 bg-gray-950 border border-emerald-800/60 rounded-2xl space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1 bg-emerald-950 text-emerald-400 rounded-lg text-xs">📝</span>
                      <h4 className="text-xs font-bold text-white">
                        Transkrip Presisi Per Kata Part #{part.part_id} ({part.transcript.words.length} Kata)
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyText(JSON.stringify(part.transcript, null, 2), `JSON Words Timestamps Part #${part.part_id}`)}
                        className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-emerald-300 rounded-xl text-[11px] font-mono font-bold border border-gray-800 transition-all"
                      >
                        📋 Copy JSON Words
                      </button>

                      <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800">
                        <button
                          onClick={() => setTranscriptTab('words')}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                            transcriptTab === 'words' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          ⏱️ Interactive Words
                        </button>
                        <button
                          onClick={() => setTranscriptTab('full')}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                            transcriptTab === 'full' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          📜 Full Text
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Word Timestamps View */}
                  {transcriptTab === 'words' && (
                    <div className="space-y-3">
                      <p className="text-[11px] text-gray-400 italic">
                        💡 Klik pada kata di bawah untuk langsung memutar audio pada detik persis kata tersebut diucapkan!
                      </p>

                      <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-3 bg-gray-900/90 rounded-xl border border-gray-800/80">
                        {part.transcript.words.map((w, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSeekAudioToTime(part.part_id, w.start)}
                            className="px-2.5 py-1.5 bg-gray-950 hover:bg-emerald-950 hover:border-emerald-500 border border-gray-800 rounded-lg text-xs font-mono text-gray-200 hover:text-emerald-300 transition-all flex items-center gap-1.5 group"
                          >
                            <span className="font-semibold text-white">{w.word}</span>
                            <span className="text-[9px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-900">
                              {w.start.toFixed(2)}s
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full Text View */}
                  {transcriptTab === 'full' && (
                    <div className="space-y-2">
                      <textarea
                        readOnly
                        value={part.transcript.transcript_full}
                        rows={6}
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3.5 text-xs text-gray-200 font-mono leading-relaxed focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SpensiaVoiceOverStep;
