// dashboard/src/components/placeholders/longform/AlurfilmAudioPlaceholder.tsx
import React, { useState, useEffect } from 'react';
import type { AlurfilmChunk, AlurfilmAnalysisResult, AlurfilmAudioResult } from '../../../electron-api';

const api = window.electronAPI;

const SCENE = "A master scriptwriter and storyteller passionately recapping a movie plot in a cozy, professional recording studio.";
const SAMPLE_CONTEXT = "Speaking in a clear, engaging, conversational, and natural Indonesian voiceover style. Smooth storytelling pacing, easy to understand, captivating, with no narrator meta-comments.";

const AlurfilmAudioPlaceholder: React.FC = () => {
  const [contentId, setContentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [analyses, setAnalyses] = useState<Record<number, AlurfilmAnalysisResult>>({});
  const [audios, setAudios] = useState<Record<number, AlurfilmAudioResult>>({});
  const [activePart, setActivePart] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploadingPart, setUploadingPart] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Static Scene & Sample Context State (100% Static English Prompts)
  const [sceneInput, setSceneInput] = useState<string>(SCENE);
  const [sampleContextInput, setSampleContextInput] = useState<string>(SAMPLE_CONTEXT);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const id = await api.getContentId('longform');
      setContentId(id);

      if (id) {
        // Load chunks
        const chunkList = await api.listAlurfilmChunks(id);
        setChunks(chunkList || []);

        // Load script analyses
        const analysisList = await api.listAlurfilmAnalyses(id);
        const analysisMap: Record<number, AlurfilmAnalysisResult> = {};
        if (analysisList) {
          for (const item of analysisList) {
            const p = item.data?.chunk_part || item.part || 1;
            analysisMap[p] = item;
          }
        }
        setAnalyses(analysisMap);

        // Load audios
        const audioList = await api.listAlurfilmAudios(id);
        const audioMap: Record<number, AlurfilmAudioResult> = {};
        if (audioList) {
          for (const item of audioList) {
            audioMap[item.part] = item;
          }
        }
        setAudios(audioMap);

        if (chunkList && chunkList.length > 0) {
          setActivePart(chunkList[0].part);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data audio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectAndUploadAudio = async (partNum: number) => {
    try {
      setError(null);
      const selected = await api.selectAudio();
      if (!selected) return;

      setUploadingPart(partNum);
      const result = await api.uploadAlurfilmAudio(partNum, selected.path);
      setAudios((prev) => ({ ...prev, [partNum]: result }));
      showToast(`🎙️ Audio Voice Over Part ${partNum} berhasil disimpan! (${(result.size / (1024 * 1024)).toFixed(2)} MB)`);
    } catch (err: any) {
      setError(`Gagal menyimpan audio: ${err.message}`);
    } finally {
      setUploadingPart(null);
    }
  };

  const handleDeleteAudio = async (partNum: number) => {
    try {
      setError(null);
      await api.deleteAlurfilmAudio(partNum);
      setAudios((prev) => {
        const next = { ...prev };
        delete next[partNum];
        return next;
      });
      showToast(`🗑️ Audio Voice Over Part ${partNum} berhasil dihapus.`);
    } catch (err: any) {
      setError(`Gagal menghapus audio: ${err.message}`);
    }
  };

  const handleCopyScript = async (scriptText: string, partNum: number) => {
    if (!scriptText) return;
    try {
      await api.copyToClipboard(scriptText);
      showToast(`📋 Naskah Voice Over Part ${partNum} disalin ke clipboard!`);
    } catch (err: any) {
      setError('Gagal menyalin naskah');
    }
  };

  const handleCopyAiStudioPrompt = async () => {
    const activeAnalysisData = analyses[activePart]?.data;
    const scriptText = activeAnalysisData?.naskah_voiceover?.script_text || '';

    const formattedPrompt = `Scene: ${sceneInput}
Sample Context: ${sampleContextInput}

[SCRIPT TEXT]
${scriptText}`;

    try {
      await api.copyToClipboard(formattedPrompt);
      showToast(`✨ Scene & Sample Context Part ${activePart} disalin! Paste ke Google AI Studio.`);
    } catch (err: any) {
      setError('Gagal menyalin prompt TTS');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const totalPartsCount = Math.max(chunks.length, Object.keys(analyses).length, 1);
  const partsList = Array.from({ length: totalPartsCount }, (_, i) => i + 1);

  const completedAudiosCount = partsList.filter((p) => audios[p]).length;
  const audioProgressPercent = Math.round((completedAudiosCount / totalPartsCount) * 100);

  const totalWords = partsList.reduce((acc, p) => {
    return acc + (analyses[p]?.data?.naskah_voiceover?.word_count || 0);
  }, 0);

  const activeAnalysis = analyses[activePart]?.data;
  const activeAudio = audios[activePart];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl font-medium text-sm flex items-center gap-2 border border-emerald-400/30 animate-in fade-in slide-in-from-top-4">
          <span>{toast}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-2xl text-rose-200 text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs bg-rose-900 hover:bg-rose-800 px-3 py-1.5 rounded-xl font-bold transition-all text-rose-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Page Title & Stats Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-xs font-mono font-bold uppercase tracking-wider">
                16:9 Alur Film Studio
              </span>
              {contentId && (
                <span className="text-xs font-mono text-gray-500 bg-gray-950 px-2.5 py-1 rounded-lg border border-gray-800">
                  ID: #{contentId}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2 pt-1">
              <span>🎙️</span> Voice Over Audio Manager
            </h1>
            <p className="text-xs text-gray-400 max-w-xl">
              Simpan dan kelola file audio voiceover per scene/part lengkap dengan parameter Scene dan Sample Context.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl border border-gray-700 transition-all flex items-center gap-2"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span> Refresh
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-800/80">
          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Part Scene</span>
            <span className="text-lg font-black text-white">{totalPartsCount} Part</span>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Status Audio</span>
            <span className="text-lg font-black text-emerald-400">
              {completedAudiosCount} / {totalPartsCount} Ready
            </span>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Estimasi Kata</span>
            <span className="text-lg font-black text-purple-400">{totalWords.toLocaleString()} Kata</span>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Progress Audio</span>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-gray-300">{audioProgressPercent}%</span>
                <span className={completedAudiosCount === totalPartsCount ? 'text-emerald-400' : 'text-purple-400'}>
                  {completedAudiosCount === totalPartsCount ? 'Lengkap' : 'Dalam Proses'}
                </span>
              </div>
              <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${audioProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scene / Part Navigation */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Daftar Part / Scene</h3>
            <span className="text-[10px] font-mono text-purple-400 font-bold bg-purple-950 px-2 py-0.5 rounded border border-purple-900">
              {partsList.length} Part
            </span>
          </div>

          <div className="space-y-2">
            {partsList.map((partNum) => {
              const isSelected = activePart === partNum;
              const hasScript = !!analyses[partNum]?.data?.naskah_voiceover?.script_text;
              const hasAudio = !!audios[partNum];
              const wordCount = analyses[partNum]?.data?.naskah_voiceover?.word_count || 0;

              return (
                <button
                  key={partNum}
                  onClick={() => setActivePart(partNum)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-150 flex flex-col space-y-2 relative overflow-hidden ${
                    isSelected
                      ? 'bg-purple-950/60 border-purple-500/80 text-white shadow-xl shadow-purple-950/30'
                      : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-850 hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <span>Part #{partNum}</span>
                    </span>

                    {hasAudio ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                        <span>🎙️</span> Audio Ready
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1">
                        <span>⏳</span> Pending Audio
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                    <span className="flex items-center gap-1">
                      <span>📝</span> {hasScript ? `${wordCount} Kata` : 'Belum Ada Naskah'}
                    </span>
                    {audios[partNum] && (
                      <span className="font-mono text-[10px] text-emerald-300">
                        {formatFileSize(audios[partNum].size)}
                      </span>
                    )}
                  </div>

                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500 rounded-r" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Part Audio & Scene / Sample Context */}
        <div className="lg:col-span-8 space-y-6">
          {/* Header Card for Active Part */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-purple-400 font-bold bg-purple-950/80 px-2.5 py-0.5 rounded-md border border-purple-800">
                    PART #{activePart} DARI {totalPartsCount}
                  </span>
                  {activeAudio ? (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-800">
                      ✅ Audio File Tersimpan
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-md border border-amber-800">
                      ⚠️ Belum Ada File Audio
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white pt-2">
                  {activeAnalysis?.timeline_edits?.[0]?.scene_label || `Adegan Voice Over Part ${activePart}`}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyAiStudioPrompt}
                  className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>✨</span> Copy Scene & Context Prompt
                </button>
                {activeAnalysis?.naskah_voiceover?.script_text && (
                  <button
                    onClick={() => handleCopyScript(activeAnalysis.naskah_voiceover.script_text, activePart)}
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs rounded-xl border border-gray-700 transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <span>📋</span> Naskah Only
                  </button>
                )}
              </div>
            </div>

            {/* 🎬 Scene & Sample Context Card (Pure Scene & Sample Context) */}
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-850 pb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
                  <span>🎬</span> Scene & Sample Context
                </h3>
              </div>

              {/* Scene Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300 block">
                  Scene
                </label>
                <input
                  type="text"
                  value={sceneInput}
                  onChange={(e) => setSceneInput(e.target.value)}
                  placeholder="e.g. A bustling street at night..."
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all font-mono"
                />
              </div>

              {/* Sample Context Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300 block">
                  Sample Context
                </label>
                <input
                  type="text"
                  value={sampleContextInput}
                  onChange={(e) => setSampleContextInput(e.target.value)}
                  placeholder="e.g. Previous speaker just finished a long story..."
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all font-mono"
                />
              </div>
            </div>

            {/* Audio Upload / Player Box */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <span>🎙️</span> Voice Over Audio File (Part #{activePart})
              </h3>

              {activeAudio ? (
                <div className="bg-gray-950 border border-emerald-900/50 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center text-2xl border border-emerald-800/80 shrink-0">
                        🔊
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white truncate max-w-xs">{activeAudio.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-gray-400 pt-0.5">
                          <span>Ukuran: {formatFileSize(activeAudio.size)}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-medium">Part #{activePart}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSelectAndUploadAudio(activePart)}
                        disabled={uploadingPart === activePart}
                        className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl border border-gray-700 transition-all flex items-center gap-1.5"
                      >
                        <span>🔄</span> Ganti Audio
                      </button>
                      <button
                        onClick={() => handleDeleteAudio(activePart)}
                        className="px-3.5 py-2 bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-bold rounded-xl border border-rose-800 transition-all flex items-center gap-1.5"
                      >
                        <span>🗑️</span> Hapus
                      </button>
                    </div>
                  </div>

                  {/* Audio Player Control */}
                  <div className="pt-2">
                    <audio
                      src={activeAudio.url}
                      controls
                      className="w-full h-10 rounded-xl accent-purple-500"
                    />
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => handleSelectAndUploadAudio(activePart)}
                  className="border-2 border-dashed border-gray-800 hover:border-purple-500/80 bg-gray-950/60 hover:bg-purple-950/20 rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 group space-y-3"
                >
                  <div className="w-14 h-14 bg-gray-900 group-hover:bg-purple-950 text-gray-400 group-hover:text-purple-300 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-gray-800 group-hover:border-purple-800 transition-all shadow-inner">
                    {uploadingPart === activePart ? (
                      <span className="animate-spin">⏳</span>
                    ) : (
                      <span>🎙️</span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-purple-200 transition-all">
                      {uploadingPart === activePart ? 'Mengunggah & Menyimpan Audio...' : `Pilih / Unggah File Audio Part #${activePart}`}
                    </h4>
                    <p className="text-xs text-gray-400 pt-1">
                      Format audio yang didukung: <span className="text-gray-300 font-mono">.mp3, .wav, .m4a, .aac, .flac</span>
                    </p>
                  </div>
                  <button
                    disabled={uploadingPart === activePart}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition-all inline-flex items-center gap-2"
                  >
                    <span>📁</span> Browse File Audio
                  </button>
                </div>
              )}
            </div>

            {/* Voiceover Script Content Preview */}
            <div className="space-y-3 pt-4 border-t border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <span>📜</span> Naskah Voice Over Part #{activePart}
                </h3>
                {activeAnalysis?.naskah_voiceover?.word_count && (
                  <span className="text-xs font-mono font-bold text-purple-400 bg-purple-950 px-2.5 py-1 rounded-lg border border-purple-900">
                    {activeAnalysis.naskah_voiceover.word_count} Kata
                  </span>
                )}
              </div>

              {activeAnalysis?.naskah_voiceover?.script_text ? (
                <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 space-y-4">
                  <div className="text-sm leading-relaxed text-gray-200 font-normal whitespace-pre-wrap selection:bg-purple-900 selection:text-purple-100 font-sans">
                    {activeAnalysis.naskah_voiceover.script_text}
                  </div>

                  {activeAnalysis.naskah_voiceover.macro_summary && (
                    <div className="p-3.5 bg-gray-900 rounded-xl border border-gray-800 text-xs space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                        Macro Summary Part ini
                      </span>
                      <p className="text-gray-300 italic">
                        "{activeAnalysis.naskah_voiceover.macro_summary}"
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-gray-950 border border-dashed border-gray-850 rounded-2xl space-y-2">
                  <p className="text-sm font-bold text-gray-400">Naskah Voice Over Belum Tersedia</p>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Silakan jalankan atau impor JSON dari <strong>Script Generator (Step 2)</strong> terlebih dahulu untuk Part #{activePart}.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlurfilmAudioPlaceholder;
