// dashboard/src/components/longform/AlurfilmAnalyzeStep.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { AlurfilmChunk, AlurfilmAnalysisResult, AlurfilmAudioResult } from '../../electron-api';

import { validateScriptAnalysis } from '../../utils/scriptValidation';
import { GoogleAiStudioTtsPreset } from '../common/GoogleAiStudioTtsPreset';
import { parseScriptSegments, convertToGeminiTtsScript } from '../../../../lib/alurfilm/script-parser';

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

  // Gemini App Script Pipeline State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [pipelineProgress, setPipelineProgress] = useState<{ percent: number; step: string; message: string }>({ percent: 0, step: '', message: '' });
  const [pipelineLogs, setPipelineLogs] = useState<Array<{ level: string; message: string; timestamp: string }>>([]);
  const [showLogConsole, setShowLogConsole] = useState<boolean>(true);

  const logEndRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pipelineLogs]);

  useEffect(() => {
    if (api.onAlurfilmProgress) {
      const unsubProgress = api.onAlurfilmProgress((data) => {
        setPipelineProgress({ percent: data.percent, step: data.step, message: data.message });
      });
      const unsubLog = api.onAlurfilmLog ? api.onAlurfilmLog((logData) => {
        const timeStr = new Date().toLocaleTimeString();
        setPipelineLogs((prev) => [...prev, { level: logData.level, message: logData.message, timestamp: timeStr }]);
      }) : () => {};

      return () => {
        unsubProgress();
        unsubLog();
      };
    }
  }, []);

  const handleRunGeminiPipeline = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    setPipelineProgress({ percent: 5, step: 'init', message: `Initializing Playwright pipeline for Part #${activePart}...` });
    setPipelineLogs([{ level: 'info', message: `🚀 Starting Playwright Alurfilm Step 2 Pipeline for Part #${activePart}...`, timestamp: new Date().toLocaleTimeString() }]);
    setShowLogConsole(true);

    try {
      let previousContext = null;
      if (activePart > 1 && analyses[activePart - 1]?.data) {
        const prevData = analyses[activePart - 1].data;
        previousContext = {
          previous_script_text: prevData.naskah_voiceover?.script_text || '',
          macro_summary: prevData.naskah_voiceover?.macro_summary || '',
          character_registry: prevData.character_registry || [],
        };
      }

      const totalChunks = chunks.length || 4;

      if (api.runAlurfilmGeminiScriptPipeline) {
        const res = await api.runAlurfilmGeminiScriptPipeline({
          partNum: activePart,
          totalChunks,
          previousContext,
        });

        if (res.success && (res.extractedJson || res.rawText)) {
          let dataToSave = res.extractedJson;
          if (!dataToSave && res.rawText) {
            try {
              const firstBrace = res.rawText.indexOf('{');
              const lastBrace = res.rawText.lastIndexOf('}');
              if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                dataToSave = JSON.parse(res.rawText.substring(firstBrace, lastBrace + 1));
              }
            } catch {}
          }

          if (dataToSave) {
            const report = validateScriptAnalysis(dataToSave, activePart);
            if (!report.isValid) {
              const errMsg = `Script Analysis Validation Error: ${report.issues.map(i => i.message).join(' | ')}`;
              setError(errMsg);
              setPipelineLogs(prev => [...prev, { level: 'error', message: `❌ ${errMsg}`, timestamp: new Date().toLocaleTimeString() }]);
              showToast(`❌ ${errMsg}`);
              return;
            }

            const validData = report.normalizedData || dataToSave;
            const targetPart = Number(validData?.chunk_part || activePart) || 1;

            const saveRes = await api.saveAlurfilmAnalysis(targetPart, validData);
            
            // Refresh analyses map from disk to guarantee UI sync
            const analysisList = await api.listAlurfilmAnalyses(contentId || undefined);
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
            if (saveRes) {
              map[targetPart] = saveRes;
            }
            setAnalyses(map);
            setPipelineProgress({ percent: 100, step: 'done', message: `🎉 Part #${targetPart} Script Analysis Completed & Saved!` });
            setPipelineLogs(prev => [...prev, { level: 'info', message: `🎉 Part #${targetPart} Script Analysis Completed & Saved!`, timestamp: new Date().toLocaleTimeString() }]);
            showToast(`🎉 Playwright Pipeline completed for Part #${targetPart}! Script analysis JSON saved.`);
          } else {
            const errMsg = `Playwright Pipeline completed but output is missing mandatory "naskah_voiceover" JSON structure. File was NOT saved.`;
            setError(errMsg);
            setPipelineProgress({ percent: 0, step: 'error', message: `❌ ${errMsg}` });
            setPipelineLogs(prev => [...prev, { level: 'error', message: `❌ ${errMsg}`, timestamp: new Date().toLocaleTimeString() }]);
          }
        } else if (res.error) {
          const errMsg = `Playwright Pipeline Error: ${res.error}`;
          setError(errMsg);
          setPipelineLogs(prev => [...prev, { level: 'error', message: `❌ ${errMsg}`, timestamp: new Date().toLocaleTimeString() }]);
        }
      } else {
        const errMsg = 'Playwright Script Pipeline API is not available on window.electronAPI.';
        setError(errMsg);
        setPipelineLogs(prev => [...prev, { level: 'error', message: `❌ ${errMsg}`, timestamp: new Date().toLocaleTimeString() }]);
      }
    } catch (err: any) {
      setError(`Failed to execute Gemini Pipeline: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
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
            for (const item of audioList) {
              if (item.parts) {
                item.parts.forEach((p) => { aMap[p] = item; });
              } else if (typeof item.part === 'number') {
                aMap[item.part] = item;
              }
            }
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
        const computedWords = 300;
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
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-6 overflow-hidden space-y-4">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-purple-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl border border-purple-400 animate-bounce">
          {toast}
        </div>
      )}

      {/* Top Header & Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-800 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="p-2 bg-purple-600/20 text-purple-400 rounded-lg text-lg">⚡</span>
            Alur Film Script & Story Generator
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Generate & preview 10-minute recap scripts alongside video scene chunks (~350 words/part for 2-3 min VO).
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={handleRunGeminiPipeline}
            disabled={isGenerating}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <span className="animate-spin text-sm">⏳</span>
                <span>Generating Part #{activePart}...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Auto Generate via Playwright</span>
              </>
            )}
          </button>

          <button
            onClick={() => handleCopyPromptForPart(activePart)}
            className={`px-3.5 py-2.5 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 ${
              copiedPromptPart === activePart
                ? 'bg-emerald-600 border border-emerald-400 shadow-emerald-600/30'
                : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
            }`}
          >
            <span>{copiedPromptPart === activePart ? '✓' : '📋'}</span>
            {copiedPromptPart === activePart ? `Copied!` : `Copy Prompt`}
          </button>

          <button
            onClick={() => setShowPasteModal(true)}
            className="px-3.5 py-2.5 bg-gray-900 hover:bg-gray-800 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
          >
            <span>📥</span> Import JSON
          </button>
        </div>
      </div>

      {/* Horizontal Parts Selector Bar */}
      <div className="flex items-center justify-between bg-gray-900/80 border border-gray-800 rounded-2xl p-2.5 shrink-0 shadow-lg gap-2">
        <div className="flex items-center gap-2 overflow-x-auto py-0.5 px-1">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 shrink-0">
            PARTS ({chunks.length || 4}):
          </span>
          {(chunks.length > 0 ? chunks : [1, 2, 3, 4].map(p => ({ part: p }))).map((chunkItem: any) => {
            const partNum = typeof chunkItem === 'number' ? chunkItem : chunkItem.part;
            const isDone = !!analyses[partNum]?.data;
            const isActive = activePart === partNum;
            const isRunning = isGenerating && activePart === partNum;

            return (
              <button
                key={partNum}
                onClick={() => setActivePart(partNum)}
                className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 border shrink-0 ${
                  isActive
                    ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/40 scale-105'
                    : isDone
                    ? 'bg-purple-950/40 border-purple-800/60 text-purple-300 hover:bg-purple-900/50'
                    : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>Part #{partNum}</span>
                {isRunning ? (
                  <span className="animate-spin text-emerald-400">⏳</span>
                ) : isDone ? (
                  <span className="text-emerald-400 text-xs font-bold">✓</span>
                ) : (
                  <span className="text-gray-600 text-xs">○</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="text-[11px] text-purple-400 font-mono font-bold px-3 py-1 bg-purple-950/60 rounded-xl border border-purple-800/40 shrink-0 hidden md:block">
          Macro Storytelling 10-Min
        </div>
      </div>

      {/* Google AI Studio TTS Presets Copy-Paste Helper */}
      <GoogleAiStudioTtsPreset />

      {/* Dedicated Execution Suite & Live Terminal Console Panel */}
      {(isGenerating || pipelineLogs.length > 0) && (
        <div className="bg-gray-900/90 border border-emerald-500/40 rounded-2xl p-4 shadow-2xl space-y-3 shrink-0">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg font-bold text-sm">⚡</span>
              <div>
                <h4 className="font-bold text-white text-xs">
                  Gemini Web App Automation Suite (Part #{activePart})
                </h4>
                <p className="text-[11px] text-gray-400 truncate mt-0.5">
                  {pipelineProgress.message || 'Running Playwright automation pipeline...'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono font-bold text-emerald-400 text-sm">{pipelineProgress.percent}%</span>
              <button
                onClick={() => setShowLogConsole(!showLogConsole)}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-[11px] font-mono transition-all"
              >
                {showLogConsole ? 'Hide Terminal Log' : `View Log Terminal (${pipelineLogs.length})`}
              </button>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="w-full h-2.5 bg-gray-950 rounded-full overflow-hidden border border-gray-800 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${pipelineProgress.percent}%` }}
            />
          </div>

          {/* Spacious Live Terminal Log Console */}
          {showLogConsole && (
            <div className="bg-black/95 rounded-xl border border-gray-800 p-3.5 font-mono text-[11px] leading-relaxed max-h-52 overflow-y-auto space-y-1 text-gray-300 shadow-inner">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-800 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Console Execution Terminal Output
                </span>
                <button onClick={() => setPipelineLogs([])} className="hover:text-gray-300 text-[10px] text-purple-400 hover:underline">
                  Clear Log
                </button>
              </div>

              {pipelineLogs.length > 0 ? (
                pipelineLogs.map((log, idx) => (
                  <div key={idx} className="flex gap-2 items-start hover:bg-gray-900/50 px-1 py-0.5 rounded">
                    <span className="text-gray-600 shrink-0 text-[10px]">[{log.timestamp}]</span>
                    <span className={`shrink-0 font-bold text-[10px] px-1.5 py-0.2 rounded ${
                      log.level === 'error' ? 'bg-red-950 text-red-400 border border-red-800' :
                      log.level === 'warn' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                      'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className={log.level === 'error' ? 'text-red-400 font-bold' : log.level === 'warn' ? 'text-amber-300' : 'text-gray-200'}>
                      {log.message}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-gray-600 text-center py-3">No console logs recorded yet. Click "Auto Generate via Playwright" to launch.</div>
              )}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      )}

      {/* Main Workspace Grid (2 Columns: 6 / 6) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: Video Preview & Prompt Configuration (Col 6) */}
        <div className="lg:col-span-6 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          {/* Section Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📹</span> Part #{activePart} Video & Prompt Config
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Preview active chunk video & view context parameter values.
              </p>
            </div>

            <button
              onClick={() => setShowChunkVideo(!showChunkVideo)}
              className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-purple-400 rounded-lg text-[11px] font-medium transition-all"
            >
              {showChunkVideo ? 'Hide Player' : 'Show Player'}
            </button>
          </div>

          {/* Integrated Video Player */}
          {showChunkVideo && (
            <div className="bg-black rounded-xl overflow-hidden border border-gray-800 h-56 flex items-center justify-center relative shadow-inner shrink-0">
              {currentChunk ? (
                <video
                  key={currentChunk.mediaUrl || currentChunk.url}
                  src={currentChunk.mediaUrl || currentChunk.url}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-4 space-y-1">
                  <span className="text-3xl">📹</span>
                  <p className="text-xs text-gray-400">No video chunk file loaded for Part #{activePart}</p>
                </div>
              )}
            </div>
          )}

          {/* Prompt Configuration Box */}
          <div className="flex-1 bg-gray-950 p-4 rounded-xl border border-gray-800 overflow-y-auto space-y-2 font-mono text-xs text-gray-300 leading-relaxed min-h-0 shadow-inner">
            <p className="text-purple-400 font-bold">// Context & Parameter Values for Part #{activePart}</p>
            <p>- Target Word Count: ~300 Kata (~2.5 Menit Voiceover)</p>
            <p>- First Part (Intro): {activePart === 1 ? 'YA (Part Pembuka)' : 'TIDAK'}</p>
            <p>- Final Part (Outro): {activePart === (chunks.length || 4) ? 'YA (Part Penutup)' : 'TIDAK'}</p>
            {activePart > 1 && analyses[activePart - 1]?.data && (
              <div className="p-3 bg-purple-950/40 rounded-xl border border-purple-800/40 text-[11px] text-purple-300 mt-2 space-y-1">
                <span className="font-bold block">✓ Connected Context from Part #{activePart - 1}:</span>
                <p className="text-gray-400 truncate">Macro Summary: "{analyses[activePart - 1].data?.naskah_voiceover?.macro_summary}"</p>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400 shrink-0">
              {error}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Script Output Tabs & Interactive Guided Workflow (Col 6) */}
        <div className="lg:col-span-6 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Header Tabs */}
          <div className="flex items-center justify-between bg-gray-900 px-4 py-3 border-b border-gray-800 shrink-0 flex-wrap gap-2">
            <div className="flex gap-1.5 bg-gray-950 p-1 rounded-xl border border-gray-800 overflow-x-auto">
              <button
                onClick={() => setActiveTab('script')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'script' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                📜 Script
              </button>
              <button
                onClick={() => setActiveTab('characters')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'characters' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                👤 Characters ({currentAnalysis?.character_registry?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'timeline' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                🎬 Scenes ({currentAnalysis?.timeline_edits?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'json' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                📋 JSON
              </button>
            </div>

            {currentAnalysis && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    const text = currentAnalysis.naskah_voiceover?.script_text || '';
                    const ttsScript = convertToGeminiTtsScript(text);
                    if (api.copyToClipboard) {
                      api.copyToClipboard(ttsScript);
                      showToast(`🎙️ Copied Gemini TTS Script (<break time="..."/>) Part #${activePart}!`);
                    }
                  }}
                  className="px-2.5 py-1 bg-purple-950/60 hover:bg-purple-900 text-purple-300 border border-purple-800/60 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1"
                  title="Copy naskah lengkap dengan tag <break time='...s'/> untuk AI Studio TTS"
                >
                  <span>⚡</span> Copy Gemini TTS
                </button>
                <button
                  onClick={() => {
                    const text = currentAnalysis.naskah_voiceover?.script_text || '';
                    if (api.copyToClipboard) {
                      api.copyToClipboard(text);
                      showToast(`📋 Copied Naskah Raw Part #${activePart}!`);
                    }
                  }}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                >
                  📋 Copy Raw
                </button>
              </div>
            )}
          </div>

          {/* Body Content */}
          <div className="p-5 flex-1 flex flex-col min-h-0 overflow-y-auto space-y-4">
            {currentAnalysis ? (
              <>
                {activeTab === 'script' && (() => {
                  const rawScript = currentAnalysis.naskah_voiceover?.script_text || '';
                  const parsed = parseScriptSegments(rawScript);
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs bg-gray-950 p-3 rounded-xl border border-gray-800 flex-wrap gap-2">
                        <span className="text-gray-400">Word Count: <strong className="text-purple-400 font-mono">{currentAnalysis.naskah_voiceover?.word_count || 0} Kata</strong></span>
                        {parsed.totalVisualOnlyCount > 0 ? (
                          <span className="text-purple-300 bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded-lg text-[11px] font-semibold">
                            🎥 {parsed.totalVisualOnlyCount} Jeda Visual ({parsed.totalVisualOnlyDuration.toFixed(1)}s Total)
                          </span>
                        ) : null}
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

                      <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-2">
                        {parsed.totalVisualOnlyCount > 0 ? (
                          parsed.segments.map((seg, idx) => (
                            seg.type === 'visual_only' ? (
                              <div key={idx} className="my-2 p-2.5 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-300 text-xs font-mono flex items-center justify-between gap-2 shadow-inner">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-amber-900/80 text-amber-200 rounded font-bold text-[10px]">
                                    🎥 VISUAL ONLY
                                  </span>
                                  <span>{seg.description}</span>
                                </div>
                                <span className="font-bold text-amber-400 shrink-0">
                                  ⏱️ {seg.durationSeconds.toFixed(1)}s Jeda VO
                                </span>
                              </div>
                            ) : (
                              <p key={idx} className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap font-sans">
                                {seg.text}
                              </p>
                            )
                          ))
                        ) : (
                          <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap select-all font-sans">
                            {rawScript}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

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
                    Klik 1-tombol "Auto Generate via Playwright" atau ikuti manual 3-langkah berikut:
                  </p>
                </div>

                {/* 3 Step Guide Cards */}
                <div className="space-y-2 w-full max-w-sm">
                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">1</span>
                    <div>
                      <h4 className="text-xs font-bold text-white">Auto Generate</h4>
                      <p className="text-[10px] text-gray-400">Klik "Auto Generate via Playwright" di kanan atas.</p>
                    </div>
                  </div>

                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">2</span>
                    <div>
                      <h4 className="text-xs font-bold text-white">Copy Prompt</h4>
                      <p className="text-[10px] text-gray-400">Atau klik "Copy Prompt" untuk jalankan manual di AI Studio.</p>
                    </div>
                  </div>

                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">3</span>
                    <div>
                      <h4 className="text-xs font-bold text-white">Import Output</h4>
                      <p className="text-[10px] text-gray-400">Klik "Import JSON" dan simpan hasilnya.</p>
                    </div>
                  </div>
                </div>
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
