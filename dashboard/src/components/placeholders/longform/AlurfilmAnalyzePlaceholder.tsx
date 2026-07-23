// dashboard/src/components/placeholders/longform/AlurfilmAnalyzePlaceholder.tsx
import React, { useState, useEffect } from 'react';
import type { AlurfilmChunk, AlurfilmAnalysisResult } from '../../../electron-api';

const api = window.electronAPI;

const AlurfilmAnalyzePlaceholder: React.FC = () => {
  const [contentId, setContentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [analyses, setAnalyses] = useState<Record<number, AlurfilmAnalysisResult>>({});
  const [activePart, setActivePart] = useState<number>(1);
  const [loadingPart, setLoadingPart] = useState<number | null>(null);
  const [loadingAll, setLoadingAll] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'script' | 'characters' | 'timeline' | 'json'>('script');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Manual AI Studio Import State
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [pasteJsonInput, setPasteJsonInput] = useState<string>('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    (async () => {
      try {
        const id = await api.getContentId('longform');
        setContentId(id);

        if (id) {
          const chunkList = await api.listAlurfilmChunks(id);
          setChunks(chunkList || []);

          const analysisList = await api.listAlurfilmAnalyses(id);
          const map: Record<number, AlurfilmAnalysisResult> = {};
          if (analysisList) {
            for (const item of analysisList) {
              if (item.data && item.data.chunk_part) {
                map[item.data.chunk_part] = item;
              } else if (item.part) {
                map[item.part] = item;
              }
            }
          }
          setAnalyses(map);
          if (chunkList && chunkList.length > 0) {
            setActivePart(chunkList[0].part);
          }
        }
      } catch {}
    })();
  }, []);

  const handleCopyPromptForPart = async (partNum: number) => {
    let prevContext = null;
    if (partNum > 1 && analyses[partNum - 1]?.data) {
      const prevData = analyses[partNum - 1].data;
      prevContext = {
        last_part: partNum - 1,
        macro_summary: prevData.naskah_voiceover?.macro_summary || '',
        previous_script_text: prevData.naskah_voiceover?.script_text || '',
        character_registry: prevData.character_registry || [],
      };
    }

    try {
      const totalChunksCount = Math.max(1, chunks.length);
      const promptText = await api.getAlurfilmPrompt(partNum, totalChunksCount, prevContext);
      await api.copyToClipboard(promptText);
      showToast(`📋 Prompt Part ${partNum}/${totalChunksCount} disalin! Paste ke Google AI Studio.`);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil prompt');
    }
  };

  const handleSaveImportedJson = async () => {
    if (!pasteJsonInput.trim()) return;

    try {
      setError(null);
      const savedResult = await api.saveAlurfilmAnalysis(activePart, pasteJsonInput);
      setAnalyses((prev) => ({ ...prev, [activePart]: savedResult }));
      setShowPasteModal(false);
      setPasteJsonInput('');
      showToast(`✨ Successfully imported JSON Output Part ${activePart}! (${savedResult.data.naskah_voiceover?.word_count || 0} kata)`);
    } catch (err: any) {
      setError(`Format JSON tidak valid: ${err.message}`);
    }
  };

  const handleAnalyzeChunk = async (partNum: number) => {
    const chunk = chunks.find((c) => c.part === partNum);
    if (!chunk) return;

    setLoadingPart(partNum);
    setError(null);

    try {
      let prevContext = null;
      if (partNum > 1 && analyses[partNum - 1]?.data) {
        const prevData = analyses[partNum - 1].data;
        prevContext = {
          last_part: partNum - 1,
          macro_summary: prevData.naskah_voiceover?.macro_summary || '',
          previous_script_text: prevData.naskah_voiceover?.script_text || '',
          character_registry: prevData.character_registry || [],
        };
      }

      const res = await api.analyzeAlurfilmChunk(chunk.filePath, partNum, prevContext);
      setAnalyses((prev) => ({ ...prev, [partNum]: res }));
      showToast(`✨ Naskah Part ${partNum} berhasil dibuat via API! (${res.data.naskah_voiceover?.word_count || 0} kata)`);
    } catch (err: any) {
      setError(err.message || `Gagal membuat naskah Part ${partNum}`);
    } finally {
      setLoadingPart(null);
    }
  };

  const handleAnalyzeAllChunks = async () => {
    if (chunks.length === 0) return;
    setLoadingAll(true);
    setError(null);

    try {
      let accumulatedContext: any = null;
      for (const chunk of chunks) {
        setLoadingPart(chunk.part);
        const res = await api.analyzeAlurfilmChunk(chunk.filePath, chunk.part, accumulatedContext);
        setAnalyses((prev) => ({ ...prev, [chunk.part]: res }));

        if (res.data) {
          accumulatedContext = {
            last_part: chunk.part,
            macro_summary: res.data.naskah_voiceover?.macro_summary || '',
            character_registry: res.data.character_registry || [],
          };
        }
      }
      showToast(`🚀 Selesai membuat naskah untuk seluruh ${chunks.length} parts secara berurutan!`);
    } catch (err: any) {
      setError(err.message || 'Gagal memproses analisis beruntun');
    } finally {
      setLoadingPart(null);
      setLoadingAll(false);
    }
  };

  const handleCopyText = async (text: string, label: string) => {
    await api.copyToClipboard(text);
    showToast(`✓ Copied ${label} to clipboard!`);
  };

  const activeChunk = chunks.find((c) => c.part === activePart);
  const currentAnalysis = analyses[activePart]?.data;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-6 overflow-hidden relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-purple-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl border border-purple-400 animate-bounce">
          {toast}
        </div>
      )}

      {/* Manual Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📥</span> Import JSON Result Google AI Studio (Part {activePart})
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Tempelkan output JSON yang Anda dapatkan dari Google AI Studio / Gemini ke kotak di bawah ini.
                </p>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                Output JSON Content:
              </label>
              <textarea
                rows={10}
                value={pasteJsonInput}
                onChange={(e) => setPasteJsonInput(e.target.value)}
                placeholder='Paste JSON output here: {"chunk_part": 1, "naskah_voiceover": {...}, ...}'
                className="w-full bg-gray-950 border border-gray-700 text-purple-200 font-mono text-xs p-3 rounded-xl focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleSaveImportedJson}
                disabled={!pasteJsonInput.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
              >
                💾 Save & Import Naskah
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-800 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold font-mono uppercase tracking-wider">
              16:9 Alur Cerita Film Mode
            </span>
            <span className="text-xs text-gray-500">• Workflow Step 2: Single-Pass Script Generator</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
            <span className="p-2 bg-purple-600/20 text-purple-400 rounded-lg text-lg">⚡</span>
            Macro Story Scriptwriter (Google AI Studio / Manual Prompt Workflow)
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Copy prompt & upload chunk video ke Google AI Studio, lalu paste hasil JSON untuk menghasilkan naskah alur cerita film yang presisi.
          </p>
        </div>

        {contentId && (
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-lg border border-purple-700/50 bg-purple-950/60 text-purple-300 text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-purple-950/40">
              <span>🆔</span>
              <span>{contentId}</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400 shrink-0">
          {error}
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 flex-1 min-h-0 overflow-hidden">
        {/* LEFT PANEL: Chunks Part List (Col 4) */}
        <div className="lg:col-span-4 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800 shrink-0">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
              Segmen Video 10-Min ({chunks.length})
            </span>
            <span className="text-[11px] text-purple-400 font-mono font-bold">
              {Object.keys(analyses).length} / {chunks.length} Ready
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {chunks.length > 0 ? (
              chunks.map((chunk) => {
                const hasAnalysis = !!analyses[chunk.part];
                const isActive = activePart === chunk.part;
                const isLoadingThis = loadingPart === chunk.part;

                return (
                  <div
                    key={chunk.part}
                    onClick={() => setActivePart(chunk.part)}
                    className={`p-3 rounded-xl border flex flex-col gap-2 cursor-pointer transition-all ${
                      isActive
                        ? 'bg-purple-950/70 border-purple-500 ring-1 ring-purple-500/50 shadow-lg'
                        : 'bg-gray-950 border-gray-800 hover:border-purple-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 border ${
                          isActive
                            ? 'bg-purple-600 text-white border-purple-400'
                            : 'bg-purple-950 text-purple-300 border-purple-800'
                        }`}>
                          P{chunk.part}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold font-mono text-white truncate block">
                            Part {chunk.part} (10-Min Chunk)
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono block">
                            {hasAnalysis ? `✨ ${analyses[chunk.part].data.naskah_voiceover?.word_count || 0} Kata` : '⏳ Belum Ada Script'}
                          </span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        hasAnalysis ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-gray-800 text-gray-500'
                      }`}>
                        {hasAnalysis ? 'DONE' : 'EMPTY'}
                      </span>
                    </div>

                    {/* Quick Manual Actions */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-gray-800/60">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyPromptForPart(chunk.part);
                        }}
                        className="flex-1 py-1 px-2 bg-gray-800 hover:bg-purple-900/60 text-purple-300 rounded text-[10px] font-bold transition-all border border-purple-900/40 flex items-center justify-center gap-1"
                        title="Copy prompt lengkap untuk disalin ke Google AI Studio"
                      >
                        <span>📋</span> Copy Prompt
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePart(chunk.part);
                          setShowPasteModal(true);
                        }}
                        className="flex-1 py-1 px-2 bg-purple-600/20 hover:bg-purple-600 text-purple-200 hover:text-white rounded text-[10px] font-bold transition-all border border-purple-500/30 flex items-center justify-center gap-1"
                        title="Paste & import output JSON dari Google AI Studio"
                      >
                        <span>📥</span> Import JSON
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-40 flex flex-col items-center justify-center border border-dashed border-gray-800 rounded-xl text-center p-4 text-gray-500 text-xs">
                <span>Belum ada video chunks dari Step 1. Silakan lakukan Video Splitter terlebih dahulu.</span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Script & Analysis Display (Col 8) */}
        <div className="lg:col-span-8 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          {/* Top Actions & Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-purple-950 border border-purple-800 text-purple-300 rounded-lg text-xs font-mono font-bold">
                Part {activePart} Workflow
              </span>
              {currentAnalysis?.naskah_voiceover?.word_count && (
                <span className="px-2.5 py-1 bg-gray-800 text-gray-300 rounded-lg text-xs font-mono">
                  📊 {currentAnalysis.naskah_voiceover.word_count} Kata
                </span>
              )}
            </div>

            {/* AI Studio Manual Buttons */}
            <div className="flex items-center gap-2">
              {activeChunk && (
                <button
                  onClick={() => handleCopyText(activeChunk.filePath, 'Video Chunk Path')}
                  className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold transition-all border border-gray-700 flex items-center gap-1"
                  title="Copy path file video untuk diupload ke AI Studio"
                >
                  <span>📁</span> Copy Video Path
                </button>
              )}
              <button
                onClick={() => handleCopyPromptForPart(activePart)}
                className="px-3 py-1 bg-purple-950 hover:bg-purple-900 text-purple-300 rounded-lg text-xs font-bold transition-all border border-purple-800 flex items-center gap-1.5 shadow-md shadow-purple-950/40"
              >
                <span>📋</span> Copy Prompt AI Studio
              </button>
              <button
                onClick={() => setShowPasteModal(true)}
                className="px-3.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center gap-1.5"
              >
                <span>📥</span> Import Output JSON
              </button>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('script')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'script' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                📜 Naskah Script
              </button>
              <button
                onClick={() => setActiveTab('characters')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'characters' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                👥 Karakter ({currentAnalysis?.character_registry?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'timeline' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                🎬 Edits ({currentAnalysis?.timeline_edits?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'json' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                ⚙️ Raw JSON
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {currentAnalysis ? (
              <>
                {/* TAB 1: NASKAH SCRIPT */}
                {activeTab === 'script' && (
                  <div className="flex-1 flex flex-col min-h-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Naskah Narasi Voice-Over (Target: 900 - 1.200 Kata per Part / ~8 Min Audio)
                      </span>
                      <button
                        onClick={() => handleCopyText(currentAnalysis.naskah_voiceover?.script_text || '', 'Naskah Script')}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-purple-600/30 flex items-center gap-1.5"
                      >
                        <span>📋</span> Copy Naskah Script
                      </button>
                    </div>

                    <div className="flex-1 bg-gray-950 p-5 rounded-xl border border-gray-800 font-sans text-sm text-gray-200 leading-relaxed overflow-y-auto whitespace-pre-wrap selection:bg-purple-800 selection:text-white">
                      {currentAnalysis.naskah_voiceover?.script_text}
                    </div>

                    {currentAnalysis.naskah_voiceover?.macro_summary && (
                      <div className="p-3 bg-purple-950/40 border border-purple-800/40 rounded-xl text-xs space-y-1 shrink-0">
                        <span className="text-[10px] font-mono font-bold uppercase text-purple-400 block">
                          🔗 Macro Summary untuk Chunk Selanjutnya:
                        </span>
                        <p className="text-gray-300 italic">
                          "{currentAnalysis.naskah_voiceover.macro_summary}"
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: CHARACTER REGISTRY */}
                {activeTab === 'characters' && (
                  <div className="flex-1 flex flex-col min-h-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Daftar Identifikasi Karakter (Character Mapping)
                      </span>
                      <button
                        onClick={() => handleCopyText(JSON.stringify(currentAnalysis.character_registry, null, 2), 'Character Registry')}
                        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-purple-300 rounded-lg text-xs font-bold transition-all border border-purple-800/50 flex items-center gap-1.5"
                      >
                        <span>📋</span> Copy Karakter JSON
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0 border border-gray-800 rounded-xl">
                      <table className="w-full text-left text-xs text-gray-300">
                        <thead className="bg-gray-950 text-gray-400 font-mono uppercase text-[10px] border-b border-gray-800">
                          <tr>
                            <th className="p-3">Nama Karakter Ditetapkan</th>
                            <th className="p-3">Deskripsi Visual Utama</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/60 bg-gray-950">
                          {currentAnalysis.character_registry?.map((char, idx) => (
                            <tr key={idx} className="hover:bg-gray-900/60">
                              <td className="p-3 font-bold font-mono text-purple-300">
                                👤 {char.assigned_name}
                              </td>
                              <td className="p-3 text-gray-300">{char.visual_description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 3: TIMELINE EDITS */}
                {activeTab === 'timeline' && (
                  <div className="flex-1 flex flex-col min-h-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Scene Breakdown & Timestamp Edits
                      </span>
                      <button
                        onClick={() => handleCopyText(JSON.stringify(currentAnalysis.timeline_edits, null, 2), 'Timeline Edits')}
                        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-purple-300 rounded-lg text-xs font-bold transition-all border border-purple-800/50 flex items-center gap-1.5"
                      >
                        <span>📋</span> Copy Timeline Edits
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0 border border-gray-800 rounded-xl">
                      <table className="w-full text-left text-xs text-gray-300">
                        <thead className="bg-gray-950 text-gray-400 font-mono uppercase text-[10px] border-b border-gray-800">
                          <tr>
                            <th className="p-3">Timestamp</th>
                            <th className="p-3">Adegan Label</th>
                            <th className="p-3">Fokus Cerita</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/60 bg-gray-950">
                          {currentAnalysis.timeline_edits?.map((edit, idx) => (
                            <tr key={idx} className="hover:bg-gray-900/60">
                              <td className="p-3 font-mono text-purple-300 whitespace-nowrap">
                                ⏱️ {edit.start_time} - {edit.end_time}
                              </td>
                              <td className="p-3 font-bold text-white">{edit.scene_label}</td>
                              <td className="p-3 text-gray-300">{edit.narrative_focus}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 4: RAW JSON */}
                {activeTab === 'json' && (
                  <div className="flex-1 flex flex-col min-h-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Full JSON Response
                      </span>
                      <button
                        onClick={() => handleCopyText(JSON.stringify(currentAnalysis, null, 2), 'Raw JSON')}
                        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-purple-300 rounded-lg text-xs font-bold transition-all border border-purple-800/50 flex items-center gap-1.5"
                      >
                        <span>📋</span> Copy Raw JSON
                      </button>
                    </div>

                    <pre className="flex-1 bg-gray-950 p-4 rounded-xl border border-gray-800 font-mono text-xs text-purple-300 overflow-y-auto">
                      {JSON.stringify(currentAnalysis, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-gray-800 rounded-xl text-center space-y-3">
                <div className="w-12 h-12 bg-purple-600/10 text-purple-400 rounded-2xl flex items-center justify-center text-xl border border-purple-500/20">
                  ⚡
                </div>
                <div className="max-w-md space-y-2">
                  <p className="text-xs font-bold text-white">Manual AI Studio Workflow (Part {activePart})</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    1. Klik <span className="text-purple-400 font-bold">"📋 Copy Prompt AI Studio"</span> di atas.<br/>
                    2. Upload file video chunk Part {activePart} ke Google AI Studio.<br/>
                    3. Tempelkan prompt & jalankan di AI Studio.<br/>
                    4. Klik <span className="text-purple-400 font-bold">"📥 Import Output JSON"</span> & tempelkan hasilnya di aplikasi.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlurfilmAnalyzePlaceholder;
