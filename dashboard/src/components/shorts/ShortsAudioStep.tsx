// dashboard/src/components/shorts/ShortsAudioStep.tsx
import React, { useState, useEffect, useRef } from 'react';

export interface TranscriptSentence {
  id: string;
  text: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export interface ShortsAudioSegmentData {
  segment_id: string;
  segment_title: string;

  audio_path_id?: string;
  audio_filename_id?: string;
  sentences_id: TranscriptSentence[];

  audio_path_en?: string;
  audio_filename_en?: string;
  sentences_en: TranscriptSentence[];
}

export interface AudioTranscriptsManifest {
  updated_at: string;
  items: Record<string, ShortsAudioSegmentData>;
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

const ShortsAudioStep: React.FC = () => {
  const [segments, setSegments] = useState<ShortsSegmentFromStep2[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('');
  const [audioDataMap, setAudioDataMap] = useState<Record<string, ShortsAudioSegmentData>>({});
  const [selectedLang, setSelectedLang] = useState<'id' | 'en'>('id');

  const [isLoading, setIsLoading] = useState(true);
  const [isAligning, setIsAligning] = useState(false);
  const [alignProgress, setAlignProgress] = useState<{ step: string; percent: number; detail: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load Step 2 script-segments.json and audio-transcripts.json on mount
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      try {
        if (window.electronAPI?.readFromProject) {
          // Read Step 2 segments
          const rawSegs = await window.electronAPI.readFromProject('input/shorts/script-segments.json');
          if (rawSegs) {
            const data: ScriptSegmentsJSONFromStep2 = typeof rawSegs === 'string' ? JSON.parse(rawSegs) : rawSegs;
            if (data && data.segments && data.segments.length > 0) {
              setSegments(data.segments);
              setSelectedSegmentId(data.segments[0].id);
            }
          }

          // Read existing audio-transcripts.json
          const rawAudio = await window.electronAPI.readFromProject('input/shorts/audio-transcripts.json');
          if (rawAudio) {
            const manifest: AudioTranscriptsManifest = typeof rawAudio === 'string' ? JSON.parse(rawAudio) : rawAudio;
            if (manifest && manifest.items) {
              setAudioDataMap(manifest.items);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load ShortsAudioStep data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, []);

  // Listen for real-time Whisper progress events
  useEffect(() => {
    if (!window.electronAPI?.onShortsWhisperProgress) return;
    const cleanup = window.electronAPI.onShortsWhisperProgress((progressData: any) => {
      setAlignProgress(progressData);
    });
    return () => {
      if (cleanup && typeof cleanup === 'function') cleanup();
    };
  }, []);

  const activeSegment = segments.find((s) => s.id === selectedSegmentId) || segments[0];

  // Helper: Get audio segment item or initialize default
  const getAudioSegmentData = (segId: string, segTitle?: string): ShortsAudioSegmentData => {
    if (audioDataMap[segId]) return audioDataMap[segId];

    const seg = segments.find((s) => s.id === segId);
    const scriptIdSentences = seg?.sentences_id || [];
    const scriptEnSentences = seg?.sentences_en || [];

    // Estimate initial timestamps evenly across ~35 seconds
    const initIdSentences: TranscriptSentence[] = scriptIdSentences.map((text, idx) => ({
      id: `sent_id_${idx + 1}`,
      text,
      start: parseFloat((idx * 4.5).toFixed(2)),
      end: parseFloat(((idx + 1) * 4.5).toFixed(2)),
    }));

    const initEnSentences: TranscriptSentence[] = scriptEnSentences.map((text, idx) => ({
      id: `sent_en_${idx + 1}`,
      text,
      start: parseFloat((idx * 4.5).toFixed(2)),
      end: parseFloat(((idx + 1) * 4.5).toFixed(2)),
    }));

    return {
      segment_id: segId,
      segment_title: segTitle || seg?.title || `Segment ${segId}`,
      sentences_id: initIdSentences,
      sentences_en: initEnSentences,
    };
  };

  const activeAudioData = selectedSegmentId ? getAudioSegmentData(selectedSegmentId, activeSegment?.title) : null;

  // Persist updated audio-transcripts.json
  const persistAudioManifest = async (updatedMap: Record<string, ShortsAudioSegmentData>) => {
    if (!window.electronAPI?.saveToProject) return;
    try {
      const manifest: AudioTranscriptsManifest = {
        updated_at: new Date().toISOString(),
        items: updatedMap,
      };
      await window.electronAPI.saveToProject(
        'input/shorts/audio-transcripts.json',
        JSON.stringify(manifest, null, 2)
      );
    } catch (err) {
      console.error('Failed to save to input/shorts/audio-transcripts.json:', err);
    }
  };

  // Helper: Format media URL for Electron audio player
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

  const activeAudioPath = selectedLang === 'id' ? activeAudioData?.audio_path_id : activeAudioData?.audio_path_en;
  const activeMediaUrl = getMediaUrl(activeAudioPath);

  // File Upload Handler (browse / drag drop)
  const handleFileUpload = async (file: File) => {
    if (!activeSegment) return;
    setErrorMsg(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const ext = file.name.split('.').pop() || 'mp3';

      if (!window.electronAPI?.uploadShortsVoAudio) {
        throw new Error('Electron API uploadShortsVoAudio tidak tersedia.');
      }

      const res = await window.electronAPI.uploadShortsVoAudio({
        segmentId: activeSegment.id,
        lang: selectedLang,
        bufferArray: arrayBuffer,
        extension: ext,
      });

      if (res && res.success) {
        const currentData = getAudioSegmentData(activeSegment.id, activeSegment.title);
        const updatedSegmentData: ShortsAudioSegmentData = {
          ...currentData,
          ...(selectedLang === 'id'
            ? { audio_path_id: res.audioPath, audio_filename_id: res.audioFilename }
            : { audio_path_en: res.audioPath, audio_filename_en: res.audioFilename }),
        };

        const updatedMap = {
          ...audioDataMap,
          [activeSegment.id]: updatedSegmentData,
        };

        setAudioDataMap(updatedMap);
        persistAudioManifest(updatedMap);
      } else {
        throw new Error('Gagal menyimpan file audio narasi.');
      }
    } catch (err: any) {
      console.error('VO Audio Upload error:', err);
      setErrorMsg(err.message || 'Gagal mengunggah file audio.');
    }
  };

  // Run Faster-Whisper Auto Alignment
  const handleRunWhisperAlignment = async () => {
    if (!activeSegment || !activeAudioPath) {
      setErrorMsg('Harap unggah file audio Voiceover terlebih dahulu.');
      return;
    }

    setIsAligning(true);
    setErrorMsg(null);
    setAlignProgress({ step: 'init', percent: 5, detail: 'Memulai engine Faster-Whisper...' });

    try {
      if (!window.electronAPI?.runShortsWhisperAlignment) {
        throw new Error('Electron API runShortsWhisperAlignment tidak tersedia.');
      }

      const isIndo = selectedLang === 'id';
      const scriptText = isIndo
        ? activeSegment.narration_script_id || (activeSegment.sentences_id || []).join(' ')
        : activeSegment.narration_script_en || (activeSegment.sentences_en || []).join(' ');

      const res = await window.electronAPI.runShortsWhisperAlignment({
        audioPath: activeAudioPath,
        scriptText,
      });

      if (res && res.success && res.result) {
        let alignedSentences: TranscriptSentence[] = [];

        // Parse whisper alignment result output format
        const rawJson = res.result;
        if (Array.isArray(rawJson.sentences)) {
          alignedSentences = rawJson.sentences.map((item: any, idx: number) => ({
            id: `sent_${selectedLang}_${idx + 1}`,
            text: item.text || item.sentence || '',
            start: parseFloat(Number(item.start || 0).toFixed(2)),
            end: parseFloat(Number(item.end || 0).toFixed(2)),
          }));
        } else if (Array.isArray(rawJson.segments)) {
          alignedSentences = rawJson.segments.map((item: any, idx: number) => ({
            id: `sent_${selectedLang}_${idx + 1}`,
            text: item.text || '',
            start: parseFloat(Number(item.start || 0).toFixed(2)),
            end: parseFloat(Number(item.end || 0).toFixed(2)),
          }));
        }

        if (alignedSentences.length > 0) {
          const currentData = getAudioSegmentData(activeSegment.id, activeSegment.title);
          const updatedSegmentData: ShortsAudioSegmentData = {
            ...currentData,
            ...(isIndo ? { sentences_id: alignedSentences } : { sentences_en: alignedSentences }),
          };

          const updatedMap = {
            ...audioDataMap,
            [activeSegment.id]: updatedSegmentData,
          };

          setAudioDataMap(updatedMap);
          persistAudioManifest(updatedMap);
        }
      } else {
        throw new Error(res?.error || 'Gagal menjalankan alignment transkrip.');
      }
    } catch (err: any) {
      console.error('Whisper Alignment error:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan saat memproses alignment.');
    } finally {
      setIsAligning(false);
      setAlignProgress(null);
    }
  };

  // Test Play single sentence line in audio player
  const handleTestPlaySentence = (startSec: number, endSec: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = startSec;
      audioRef.current.play().catch((e) => console.warn('Audio play error:', e));

      // Auto pause at endSec
      const checkPause = () => {
        if (audioRef.current && audioRef.current.currentTime >= endSec) {
          audioRef.current.pause();
          audioRef.current.removeEventListener('timeupdate', checkPause);
        }
      };
      audioRef.current.addEventListener('timeupdate', checkPause);
    }
  };

  // Update sentence field
  const handleUpdateSentence = (sentenceId: string, updates: Partial<TranscriptSentence>) => {
    if (!activeSegment) return;
    const currentData = getAudioSegmentData(activeSegment.id, activeSegment.title);
    const isIndo = selectedLang === 'id';
    const targetSentences = isIndo ? currentData.sentences_id : currentData.sentences_en;

    const updatedSentences = targetSentences.map((s) => {
      if (s.id === sentenceId) {
        return { ...s, ...updates };
      }
      return s;
    });

    const updatedSegmentData: ShortsAudioSegmentData = {
      ...currentData,
      ...(isIndo ? { sentences_id: updatedSentences } : { sentences_en: updatedSentences }),
    };

    const updatedMap = {
      ...audioDataMap,
      [activeSegment.id]: updatedSegmentData,
    };

    setAudioDataMap(updatedMap);
    persistAudioManifest(updatedMap);
  };

  // Add sentence line manually
  const handleAddSentence = () => {
    if (!activeSegment) return;
    const currentData = getAudioSegmentData(activeSegment.id, activeSegment.title);
    const isIndo = selectedLang === 'id';
    const targetSentences = isIndo ? currentData.sentences_id : currentData.sentences_en;

    const lastEnd = targetSentences.length > 0 ? targetSentences[targetSentences.length - 1].end : 0;
    const newSentence: TranscriptSentence = {
      id: `sent_${selectedLang}_${Date.now()}`,
      text: 'New sentence text here...',
      start: parseFloat(lastEnd.toFixed(2)),
      end: parseFloat((lastEnd + 3.0).toFixed(2)),
    };

    const updatedSentences = [...targetSentences, newSentence];
    const updatedSegmentData: ShortsAudioSegmentData = {
      ...currentData,
      ...(isIndo ? { sentences_id: updatedSentences } : { sentences_en: updatedSentences }),
    };

    const updatedMap = {
      ...audioDataMap,
      [activeSegment.id]: updatedSegmentData,
    };

    setAudioDataMap(updatedMap);
    persistAudioManifest(updatedMap);
  };

  // Delete sentence line
  const handleDeleteSentence = (sentenceId: string) => {
    if (!activeSegment) return;
    const currentData = getAudioSegmentData(activeSegment.id, activeSegment.title);
    const isIndo = selectedLang === 'id';
    const targetSentences = isIndo ? currentData.sentences_id : currentData.sentences_en;

    const updatedSentences = targetSentences.filter((s) => s.id !== sentenceId);
    const updatedSegmentData: ShortsAudioSegmentData = {
      ...currentData,
      ...(isIndo ? { sentences_id: updatedSentences } : { sentences_en: updatedSentences }),
    };

    const updatedMap = {
      ...audioDataMap,
      [activeSegment.id]: updatedSegmentData,
    };

    setAudioDataMap(updatedMap);
    persistAudioManifest(updatedMap);
  };

  const currentSentences = selectedLang === 'id' ? activeAudioData?.sentences_id || [] : activeAudioData?.sentences_en || [];

  return (
    <div className="p-6 bg-gray-950/90 border border-gray-800 rounded-3xl min-h-full space-y-8 text-gray-100">
      {/* Step Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800/80 pb-5 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center text-2xl border border-amber-500/20 shadow-lg shadow-amber-950/40">
            🎙️
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
              Step 3: Voiceover Audio & Transcript Sync Studio
              <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 text-xs font-mono font-semibold">
                Faster-Whisper AI Alignment
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Unggah audio voiceover narasi (Indo/English), jalankan Faster-Whisper untuk sinkronisasi timestamp transkrip per kalimat secara presisi.
            </p>
          </div>
        </div>

        {/* Global Language Toggle */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-xl text-xs font-mono flex items-center gap-2">
            <span className="text-gray-400">Bahasa Narasi:</span>
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
          <span className="text-xs text-gray-400 font-mono">Memuat data audio & transkrip...</span>
        </div>
      ) : (
        /* Main Layout: Left Segments List + Right Audio/Transcript Workspace */
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
                  const segData = audioDataMap[seg.id];
                  const hasIdAudio = Boolean(segData?.audio_path_id);
                  const hasEnAudio = Boolean(segData?.audio_path_en);

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
                          {hasIdAudio ? <span className="text-emerald-400">🇮🇩 Audio</span> : <span className="text-gray-600">🇮🇩 -</span>}
                          <span>|</span>
                          {hasEnAudio ? <span className="text-emerald-400">🇺🇸 Audio</span> : <span className="text-gray-600">🇺🇸 -</span>}
                        </div>
                        <span className="text-cyan-400 font-semibold">
                          {(segData?.sentences_id?.length || 0)} Kalimat
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Workspace Area: Audio Upload, Whisper Alignment & Transcript Table */}
          <div className="flex-1 min-w-0 space-y-8 w-full">
            {/* Section 1: Audio Upload & Player Box */}
            <div className="bg-gray-900/70 border border-gray-800 p-5 rounded-2xl space-y-4 shadow-md">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <span>🎙️</span> Voiceover Audio ({selectedLang === 'id' ? '🇮🇩 Bahasa Indonesia' : '🇺🇸 English'})
                </h2>
                <span className="text-[10px] text-gray-500 font-mono">
                  Segment: #{segments.findIndex((s) => s.id === selectedSegmentId) + 1} - {activeSegment?.title}
                </span>
              </div>

              {/* Drag-and-Drop / Upload Trigger Box */}
              <div className="flex flex-col md:flex-row items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mp3,audio/wav,audio/m4a,audio/aac,audio/ogg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full md:w-auto px-5 py-3 bg-gray-950 hover:bg-gray-800 border border-dashed border-amber-500/40 hover:border-amber-400 text-amber-300 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow"
                >
                  <span className="text-base">📁</span>
                  <span>{activeAudioPath ? 'Ganti File Audio VO' : 'Upload File Audio VO (.mp3 / .wav)'}</span>
                </button>

                {activeAudioPath ? (
                  <div className="flex-1 w-full bg-gray-950 p-3 rounded-xl border border-emerald-800/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 truncate max-w-[300px]">
                      <span className="text-emerald-400 text-base">🎵</span>
                      <span className="text-xs text-emerald-300 font-mono truncate">
                        {selectedLang === 'id' ? activeAudioData?.audio_filename_id : activeAudioData?.audio_filename_en}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <audio ref={audioRef} src={activeMediaUrl} controls className="h-9 max-w-[260px]" />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 w-full p-3 bg-gray-950/40 border border-dashed border-gray-800 rounded-xl text-xs text-gray-500 italic text-center">
                    Belum ada file audio voiceover diunggah untuk Bahasa {selectedLang === 'id' ? 'Indonesia' : 'Inggris'}.
                  </div>
                )}
              </div>

              {/* Faster-Whisper Alignment Button & Progress */}
              <div className="pt-2 border-t border-gray-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-gray-400">
                  <p>Klik **Run Auto Alignment** untuk menghitung timestamp transkrip kalimat secara presisi menggunakan AI Faster-Whisper.</p>
                </div>

                <button
                  onClick={handleRunWhisperAlignment}
                  disabled={isAligning || !activeAudioPath}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center gap-2 disabled:opacity-40 shrink-0"
                >
                  {isAligning ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-gray-950 border-t-transparent rounded-full animate-spin"></div>
                      <span>Whisper Aligning...</span>
                    </>
                  ) : (
                    <>
                      <span>🎙️</span>
                      <span>Run Auto Alignment (Faster-Whisper)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Alignment Progress Bar */}
              {isAligning && alignProgress && (
                <div className="bg-gray-950 p-3 rounded-xl border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-amber-300 font-bold">{alignProgress.detail}</span>
                    <span className="text-amber-400 font-bold">{alignProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-300"
                      style={{ width: `${alignProgress.percent}%` }}
                    ></div>
                  </div>
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

            {/* Section 2: Sentence Transcript Timestamps Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2.5">
                  <span>📜</span> Tabel Transkrip Kalimat & Timestamps ({currentSentences.length} Kalimat)
                </h2>

                <button
                  onClick={handleAddSentence}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                >
                  <span>➕</span> Tambah Kalimat
                </button>
              </div>

              {currentSentences.length === 0 ? (
                <div className="bg-gray-900/40 border border-dashed border-gray-800 p-10 rounded-2xl text-center space-y-3">
                  <div className="text-4xl text-amber-500/50">🎙️</div>
                  <h3 className="text-sm font-bold text-gray-300">Belum Ada Transkrip Kalimat</h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    Upload audio narasi VO di atas lalu klik Run Auto Alignment, atau klik Tambah Kalimat untuk menyusun manual.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentSentences.map((sent, idx) => {
                    const durationSec = Math.max(0, sent.end - sent.start).toFixed(2);

                    return (
                      <div
                        key={sent.id}
                        className="bg-gray-900/70 border border-gray-800 hover:border-gray-700 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <span className="w-6 h-6 bg-amber-500/10 text-amber-400 rounded-md flex items-center justify-center text-xs font-mono font-bold border border-amber-500/20 shrink-0">
                            #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={sent.text}
                            onChange={(e) => handleUpdateSentence(sent.id, { text: e.target.value })}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-amber-500 font-sans"
                            placeholder="Teks kalimat narasi"
                          />
                        </div>

                        {/* Timestamp Controls & Actions */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1.5 bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-800 text-xs font-mono">
                            <span className="text-gray-500 text-[10px]">Start:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={sent.start}
                              onChange={(e) => handleUpdateSentence(sent.id, { start: parseFloat(e.target.value) || 0 })}
                              className="w-16 bg-gray-900 border border-gray-800 rounded px-1.5 py-0.5 text-amber-300 font-mono focus:outline-none"
                            />
                            <span className="text-gray-600">s</span>

                            <span className="text-gray-500 text-[10px] ml-1">End:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={sent.end}
                              onChange={(e) => handleUpdateSentence(sent.id, { end: parseFloat(e.target.value) || 0 })}
                              className="w-16 bg-gray-900 border border-gray-800 rounded px-1.5 py-0.5 text-amber-300 font-mono focus:outline-none"
                            />
                            <span className="text-gray-600">s</span>
                          </div>

                          <span className="px-2 py-1 bg-amber-950/80 text-amber-300 border border-amber-800/60 rounded text-[10px] font-mono font-bold">
                            {durationSec}s
                          </span>

                          <button
                            onClick={() => handleTestPlaySentence(sent.start, sent.end)}
                            disabled={!activeAudioPath}
                            className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-lg transition-all flex items-center gap-1 disabled:opacity-30"
                            title="Play audio pada kalimat ini"
                          >
                            <span>▶ Line</span>
                          </button>

                          <button
                            onClick={() => handleDeleteSentence(sent.id)}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-all text-xs"
                            title="Hapus Kalimat"
                          >
                            🗑️
                          </button>
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
          <span>📂 Audio Directory:</span>
          <code className="text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
            input/shorts/audio/
          </code>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span>📄 Persistence Transkrip:</span>
          <code className="text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
            input/shorts/audio-transcripts.json
          </code>
        </div>
      </div>
    </div>
  );
};

export default ShortsAudioStep;
