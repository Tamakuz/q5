// dashboard/src/components/longform/AlurfilmAnalyzeStep.tsx
import React, { useState, useEffect } from 'react';
import type { AlurfilmChunk, AlurfilmAnalysisResult, AlurfilmAudioResult } from '../../electron-api';

import { validateScriptAnalysis } from '../../utils/scriptValidation';

const api = window.electronAPI;

const AlurfilmAnalyzeStep: React.FC = () => {
  const [contentId, setContentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [analyses, setAnalyses] = useState<Record<number, AlurfilmAnalysisResult>>({});
  const [audios, setAudios] = useState<Record<number, AlurfilmAudioResult>>({});
  const [activePart, setActivePart] = useState<number>(1);

  const [activeTab, setActiveTab] = useState<'script' | 'characters' | 'timeline' | 'json'>('script');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Video Preview toggle for the active chunk
  const [showChunkVideo, setShowChunkVideo] = useState<boolean>(true);

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

          const audioList = await api.listAlurfilmAudios(id);
          const aMap: Record<number, AlurfilmAudioResult> = {};
          if (audioList) {
            for (const item of audioList) aMap[item.part] = item;
          }
          setAudios(aMap);

          if (chunkList && chunkList.length > 0) {
            setActivePart(chunkList[0].part);
          }
        }
      } catch (err: any) {
        console.error(err);
      }
    })();
  }, []);

  const [copiedPromptPart, setCopiedPromptPart] = useState<number | null>(null);

  const handleCopyPromptForPart = async (partNum: number) => {
    let prevContext = null;
    if (partNum > 1 && analyses[partNum - 1]?.data) {
      const prevData = analyses[partNum - 1].data;
      prevContext = {
        previous_script_text: prevData.naskah_voiceover?.script_text || '',
        macro_summary: prevData.naskah_voiceover?.macro_summary || '',
        character_registry: prevData.character_registry || [],
      };
    }

    try {
      const totalChunks = chunks.length || 1;
      let formattedPrompt = '';
      if (api.getAlurfilmPrompt) {
        formattedPrompt = await api.getAlurfilmPrompt(partNum, totalChunks, prevContext);
      }
      
      if (!formattedPrompt || formattedPrompt.includes('Kamu adalah Master Scriptwriter Alur Film. Tulis naskah')) {
        let promptTpl = await api.readFromProject('dashboard/prompts/longform/script-prompt.md');
        if (!promptTpl) {
          promptTpl = await api.readFromProject('dashboard/prompts/longform/alurfilm-singlepass-prompt.md');
        }
        const computedWords = 250;
        const isFirstPartStr = partNum === 1 ? 'YA (Part Pembuka)' : `TIDAK (Chunk #${partNum} / Part Lanjutan)`;
        const isLastPartStr = partNum === totalChunks ? 'YA (Part Penutup / Final Part)' : 'TIDAK (Part Bukan Penutup)';
        const prevCtxStr = prevContext ? JSON.stringify(prevContext, null, 2) : 'Tidak ada (Chunk #1 / Awal Film)';
        formattedPrompt = (promptTpl || '')
          .replace(/\{\{chunk_part\}\}/g, String(partNum))
          .replace(/\{\{total_chunks\}\}/g, String(totalChunks))
          .replace(/\{\{is_first_part\}\}/g, isFirstPartStr)
          .replace(/\{\{is_last_part\}\}/g, isLastPartStr)
          .replace(/\{\{target_words_per_chunk\}\}/g, String(computedWords))
          .replace(/\{\{previous_context\}\}/g, prevCtxStr)
          .replace(/\{\{style_example\}\}/g, 'Gunakan gaya penceritaan alur film santai, jernih, dan mengalir.');
      }

      let copied = false;
      if (api.copyToClipboard) {
        try {
          await api.copyToClipboard(formattedPrompt);
          copied = true;
        } catch {}
      }
      if (!copied && navigator.clipboard) {
        await navigator.clipboard.writeText(formattedPrompt);
        copied = true;
      }

      setCopiedPromptPart(partNum);
      setTimeout(() => setCopiedPromptPart(null), 3000);
      showToast(`📋 Copied Prompt for Part #${partNum}! Silakan paste ke AI Studio / Gemini.`);
    } catch (err: any) {
      setError(`Failed to format prompt: ${err.message}`);
    }
  };


  const handleManualImportJson = async () => {
    if (!pasteJsonInput.trim()) return;
    setError(null);
    try {
      const report = validateScriptAnalysis(pasteJsonInput, activePart);
      if (!report.isValid) {
        setError(`⚠️ Script JSON Validation Error: ${report.summaryText}`);
        return;
      }

      const validData = report.normalizedData;
      const partNum = validData?.chunk_part || activePart;

      const saveRes = await api.saveAlurfilmAnalysis(partNum, validData);
      setAnalyses((prev) => ({ ...prev, [partNum]: saveRes }));
      setShowPasteModal(false);
      setPasteJsonInput('');
      showToast(`🎉 Successfully saved & validated Script Analysis JSON for Part #${partNum}!`);
    } catch (err: any) {
      setError(`Failed to save Script JSON: ${err.message}`);
    }
  };

  const currentChunk = chunks.find((c) => c.part === activePart);
  const currentAnalysis = analyses[activePart]?.data;
  const currentAudio = audios[activePart];

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-6 overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-purple-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl border border-purple-400 animate-bounce">
          {toast}
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-800 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="p-2 bg-purple-600/20 text-purple-400 rounded-lg text-lg">⚡</span>
            Alur Film Script & Story Generator
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Generate & preview 10-minute recap scripts alongside video scene chunks (~350 words/part for 2-3 min VO).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPasteModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-purple-600/20"
          >
            <span>📋</span> Import / Paste AI Studio JSON
          </button>
        </div>
      </div>

      {/* Main Grid Workspace with Side Parts List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5 flex-1 min-h-0 overflow-hidden">
        {/* SIDE COLUMN: Vertical Parts Selector (Col 2) */}
        <div className="lg:col-span-2 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800 shrink-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Parts ({chunks.length})
            </span>
            <span className="text-[10px] text-purple-400 font-mono font-bold">10-Min</span>
          </div>

          {chunks.length > 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
              {chunks.map((chunk) => {
                const isDone = !!analyses[chunk.part]?.data;
                const isActive = activePart === chunk.part;
                return (
                  <button
                    key={chunk.part}
                    onClick={() => setActivePart(chunk.part)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-between border ${
                      isActive
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                        : isDone
                        ? 'bg-purple-950/40 border-purple-800/60 text-purple-300 hover:bg-purple-900/50'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <span>Part #{chunk.part}</span>
                    <span className="text-xs">{isDone ? '✓' : '○'}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-amber-400 p-2 text-center">
              Belum ada part split.
            </div>
          )}
        </div>

        {/* CENTER PANEL: Chunk Video Preview & AI Studio Prompt (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          {/* Header & Prompt Button */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🤖</span> Part #{activePart} Video & Prompt
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Preview Part #{activePart} video & copy prompt for AI Studio.
              </p>
            </div>

            <button
              onClick={() => handleCopyPromptForPart(activePart)}
              className={`px-3.5 py-2 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 shrink-0 ${
                copiedPromptPart === activePart
                  ? 'bg-emerald-600 border border-emerald-400 shadow-emerald-600/30 ring-2 ring-emerald-500/50'
                  : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
              }`}
            >
              <span>{copiedPromptPart === activePart ? '✓' : '📋'}</span>
              {copiedPromptPart === activePart ? `Copied Part #${activePart}!` : `Copy Prompt #${activePart}`}
            </button>
          </div>

          {/* Integrated Video Player for Active Part Chunk */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-bold flex items-center gap-1">
                <span>📹</span> Part #{activePart} Video Preview
              </span>
              <button
                onClick={() => setShowChunkVideo(!showChunkVideo)}
                className="text-purple-400 hover:underline text-[11px]"
              >
                {showChunkVideo ? 'Hide Player' : 'Show Player'}
              </button>
            </div>

            {showChunkVideo && (
              <div className="bg-black rounded-xl overflow-hidden border border-gray-800 h-48 flex items-center justify-center relative shadow-inner">
                {currentChunk ? (
                  <video
                    key={currentChunk.mediaUrl || currentChunk.url}
                    src={currentChunk.mediaUrl || currentChunk.url}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-4 space-y-1">
                    <span className="text-2xl">📹</span>
                    <p className="text-xs text-gray-400">No video chunk file loaded for Part #{activePart}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prompt Configuration Box */}
          <div className="flex-1 bg-gray-950 p-4 rounded-xl border border-gray-800 overflow-y-auto space-y-2.5 font-mono text-xs text-gray-300 leading-relaxed min-h-0">
            <p className="text-purple-400 font-bold">// Prompt Configuration for Part #{activePart}</p>
            <p>- Part: {activePart} / {chunks.length || 1}</p>
            <p>- Target VO Duration: ~2.0 - 3.0 Menit (~350 Kata per Part)</p>
            <p>- Status: {activePart === 1 ? 'Part Pembuka (Intro Film)' : activePart === (chunks.length || 1) ? 'Part Penutup (Outro Recap)' : `Part Lanjutan (Connected to Part #${activePart - 1})`}</p>
            {activePart > 1 && analyses[activePart - 1]?.data && (
              <div className="p-2.5 bg-purple-950/40 rounded-lg border border-purple-800/40 text-[11px] text-purple-300">
                ✓ Context & Characters from Part #{activePart - 1} auto-attached.
              </div>
            )}
          </div>


          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Script Output Tabs & Interactive Guided Workflow (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Header Tabs */}
          <div className="flex items-center justify-between bg-gray-900 px-4 py-3 border-b border-gray-800 shrink-0">
            <div className="flex gap-1.5 bg-gray-950 p-1 rounded-lg border border-gray-800 overflow-x-auto">
              <button
                onClick={() => setActiveTab('script')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'script' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                📜 Script
              </button>
              <button
                onClick={() => setActiveTab('characters')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'characters' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                👤 Characters ({currentAnalysis?.character_registry?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'timeline' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                🎬 Scenes ({currentAnalysis?.timeline_edits?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'json' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                📄 JSON
              </button>
            </div>

            {currentAnalysis && (
              <button
                onClick={() => {
                  const text = currentAnalysis.naskah_voiceover?.script_text || '';
                  if (api.copyToClipboard) {
                    api.copyToClipboard(text);
                    showToast(`📋 Copied Naskah Part #${activePart}!`);
                  }
                }}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-medium transition-all flex items-center gap-1 shrink-0"
              >
                📋 Copy
              </button>
            )}
          </div>

          {/* Body Content */}
          <div className="p-5 flex-1 flex flex-col min-h-0 overflow-y-auto space-y-4">
            {currentAnalysis ? (
              <>
                {activeTab === 'script' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs bg-gray-950 p-3 rounded-xl border border-gray-800">
                      <span className="text-gray-400">Word Count: <strong className="text-purple-400 font-mono">{currentAnalysis.naskah_voiceover?.word_count || 0} Kata</strong></span>
                      <span className="text-gray-400">Status: <strong className="text-emerald-400 font-mono">✓ Script Ready</strong></span>
                    </div>

                    {currentAudio && (
                      <div className="p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl flex items-center justify-between gap-3 text-xs">
                        <span className="text-indigo-300 font-bold flex items-center gap-1.5 truncate">
                          <span>🎙️</span> Audio: {currentAudio.name}
                        </span>
                        <audio src={currentAudio.mediaUrl || currentAudio.url} controls className="h-8 w-44" />
                      </div>
                    )}

                    {currentAnalysis.naskah_voiceover?.macro_summary && (
                      <div className="p-3.5 bg-purple-950/30 border border-purple-800/40 rounded-xl text-xs space-y-1">
                        <span className="font-bold text-purple-300 block">📌 Macro Summary:</span>
                        <p className="text-gray-300 leading-relaxed">{currentAnalysis.naskah_voiceover.macro_summary}</p>
                      </div>
                    )}

                    <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
                      <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap select-all font-sans">
                        {currentAnalysis.naskah_voiceover?.script_text}
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'characters' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Character Registry & Consistency</h4>
                    {currentAnalysis.character_registry?.length ? (
                      currentAnalysis.character_registry.map((char, idx) => (
                        <div key={idx} className="p-3.5 bg-gray-950 rounded-xl border border-gray-800 space-y-1 flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 flex items-center justify-center font-bold text-base shrink-0">
                            👤
                          </div>
                          <div>
                            <span className="text-xs font-bold text-purple-400 block">{char.assigned_name}</span>
                            <p className="text-xs text-gray-300 leading-relaxed mt-0.5">{char.visual_description}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 italic">No character descriptions listed for this part.</p>
                    )}
                  </div>
                )}

                {activeTab === 'timeline' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Scene Edits & Key Timestamps</h4>
                    {currentAnalysis.timeline_edits?.length ? (
                      currentAnalysis.timeline_edits.map((edit) => (
                        <div key={edit.id} className="p-3.5 bg-gray-950 rounded-xl border border-gray-800 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold text-white block">{edit.scene_label}</span>
                            <span className="text-gray-400 text-[11px] mt-0.5 block">{edit.narrative_focus}</span>
                          </div>
                          <span className="font-mono text-purple-400 font-bold bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-800/60 text-[11px]">
                            ⏱️ {edit.start_time} - {edit.end_time}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 italic">No specific timeline edit breakdown listed.</p>
                    )}
                  </div>
                )}

                {activeTab === 'json' && (
                  <pre className="bg-gray-950 text-gray-300 text-xs font-mono p-4 rounded-xl border border-gray-800 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(currentAnalysis, null, 2)}
                  </pre>
                )}
              </>
            ) : (
              /* Guided 3-Step Assistant when no script analysis is imported yet */
              <div className="flex-1 flex flex-col justify-center items-center p-6 border border-dashed border-gray-800 rounded-2xl space-y-5">
                <div className="text-center space-y-1.5">
                  <div className="w-12 h-12 bg-purple-600/10 text-purple-400 rounded-2xl flex items-center justify-center text-xl mx-auto border border-purple-500/20">
                    ⚡
                  </div>
                  <h3 className="text-xs font-bold text-white">Belum Ada Script Generator Part #{activePart}</h3>
                  <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                    Ikuti 3 langkah mudah berikut untuk menghasilkan naskah cerita 10-menit:
                  </p>
                </div>

                {/* 3 Step Guide Cards */}
                <div className="space-y-2 w-full max-w-sm">
                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">1</span>
                    <div>
                      <h4 className="text-xs font-bold text-white">Copy Prompt</h4>
                      <p className="text-[10px] text-gray-400">Klik "Copy Prompt #{activePart}" pada panel tengah.</p>
                    </div>
                  </div>

                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">2</span>
                    <div>
                      <h4 className="text-xs font-bold text-white">Paste di AI Studio</h4>
                      <p className="text-[10px] text-gray-400">Jalankan prompt di Google AI Studio atau Gemini.</p>
                    </div>
                  </div>

                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">3</span>
                    <div>
                      <h4 className="text-xs font-bold text-white">Import Output</h4>
                      <p className="text-[10px] text-gray-400">Klik "Paste AI Studio JSON" dan simpan hasilnya.</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowPasteModal(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2"
                >
                  <span>📋</span> Paste JSON Hasil Script Part #{activePart}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📋</span> Paste Script Analysis JSON (Part #{activePart})
              </h3>
              <button onClick={() => setShowPasteModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <p className="text-xs text-gray-400">
              Tempelkan output JSON naskah cerita dari AI Studio / Gemini di bawah ini:
            </p>
            <textarea
              value={pasteJsonInput}
              onChange={(e) => setPasteJsonInput(e.target.value)}
              placeholder={`{\n  "chunk_part": ${activePart},\n  "naskah_voiceover": {\n    "word_count": 1450,\n    "macro_summary": "...",\n    "script_text": "..."\n  }\n}`}
              className="w-full h-64 bg-gray-950 text-gray-200 text-xs font-mono p-3 rounded-xl border border-gray-800 focus:border-purple-500 focus:outline-none resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPasteModal(false)} className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs font-medium">Batal</button>
              <button onClick={handleManualImportJson} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30">Save JSON Naskah</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlurfilmAnalyzeStep;
