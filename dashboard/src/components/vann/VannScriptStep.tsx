// dashboard/src/components/waku/WakuScriptStep.tsx
import React, { useState, useEffect } from 'react';
import { validateWakuScript, WakuScriptData, WakuScriptValidationReport } from '../../utils/vannValidation';

const api = window.electronAPI;

const MODEL_OPTIONS = [
  { id: 'ag/gemini-3-flash-agent', name: 'ag/gemini-3-flash-agent (Recommended)' },
  { id: 'cx/gpt-5.5', name: 'cx/gpt-5.5' },
  { id: 'cmc/deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

const DURATION_PRESETS = [
  { duration: '5 menit', words: 750, label: '5 Menit (±750 Kata)' },
  { duration: '8 menit', words: 1200, label: '8 Menit (±1200 Kata)' },
  { duration: '10 menit', words: 1500, label: '10 Menit (±1500 Kata)' },
  { duration: '12 menit', words: 1800, label: '12 Menit (±1800 Kata)' },
  { duration: '15 menit', words: 2250, label: '15 Menit (±2250 Kata)' },
];

export interface BatchTopicItem {
  id: number;
  title: string;
  summary: string;
  hasScript?: boolean;
}

const WakuScriptStep: React.FC = () => {
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [topicSummary, setTopicSummary] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<string>('10 menit');
  const [targetWords, setTargetWords] = useState<number>(1500);

  const [batchTopics, setBatchTopics] = useState<BatchTopicItem[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<number | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);

  const [batchCurrentIndex, setBatchCurrentIndex] = useState<number>(0);
  const [batchTotalCount, setBatchTotalCount] = useState<number>(0);
  const [generatingTopicId, setGeneratingTopicId] = useState<number | null>(null);

  const [selectedModel, setSelectedModel] = useState<string>('ag/gemini-3-flash-agent');
  const [masterPrompt, setMasterPrompt] = useState<string>('');
  const [showPromptEditor, setShowPromptEditor] = useState<boolean>(false);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [pastedOutput, setPastedOutput] = useState<string>('');
  const [scriptData, setScriptData] = useState<WakuScriptData | null>(null);
  const [activeTab, setActiveTab] = useState<'full' | 'sections' | 'json'>('full');

  const [toast, setToast] = useState<string | null>(null);
  const [validationReport, setValidationReport] = useState<WakuScriptValidationReport | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadPromptFromFile = async () => {
    try {
      if (api?.readFromProject) {
        let loadedPrompt = await api.readFromProject('dashboard/prompts/vann/script-prompt.md');
        if (!loadedPrompt || !loadedPrompt.trim()) {
          loadedPrompt = await api.readFromProject('dashboard/prompts/vann/script-prompt.md');
        }
        if (loadedPrompt && loadedPrompt.trim().length > 0) {
          setMasterPrompt(loadedPrompt);
          return loadedPrompt;
        }
      }
    } catch (err) {
      console.error('Error reading script-prompt.md:', err);
    }
    return '';
  };

  // Load initial prompt, batch topics, and saved script state on mount
  useEffect(() => {
    (async () => {
      await loadPromptFromFile();
      try {
        if (api?.readFromProject) {
          // 1. Load selected topics from Step 1
          let savedTopicsJson = await api.readFromProject('input/vann/topics.json');
          if (!savedTopicsJson) {
            savedTopicsJson = await api.readFromProject('input/vann/topics.json');
          }
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

          // Check per-topic script files to update hasScript badges
          const checkedTopics = await Promise.all(
            loadedTopics.map(async (top) => {
              try {
                let specificScript = await api.readFromProject(`input/vann/scripts/script_topic_${top.id}.json`);
                if (!specificScript) {
                  specificScript = await api.readFromProject(`input/vann/scripts/script_topic_${top.id}.json`);
                }
                return { ...top, hasScript: Boolean(specificScript && specificScript.trim()) };
              } catch {
                return top;
              }
            })
          );

          setBatchTopics(checkedTopics);
          if (selectedId !== null) {
            setActiveTopicId(selectedId);
            const activeTop = checkedTopics.find((t) => t.id === selectedId) || checkedTopics[0];
            if (activeTop) {
              setVideoTitle(activeTop.title);
              setTopicSummary(activeTop.summary);
            }
          }

          // 2. Load saved script for active topic or primary script
          const activeScriptFile = selectedId
            ? `input/vann/scripts/script_topic_${selectedId}.json`
            : 'input/vann/script.json';

          let savedScriptJson = await api.readFromProject(activeScriptFile);
          if (!savedScriptJson && selectedId) {
            savedScriptJson = await api.readFromProject(`input/vann/scripts/script_topic_${selectedId}.json`);
          }
          if (!savedScriptJson) {
            savedScriptJson = await api.readFromProject('input/vann/script.json');
          }
          if (!savedScriptJson) {
            savedScriptJson = await api.readFromProject('input/vann/script.json');
          }

          if (savedScriptJson) {
            setPastedOutput(savedScriptJson);
            const report = validateWakuScript(savedScriptJson);
            setValidationReport(report);
            if (report.normalizedData) {
              setScriptData(report.normalizedData);
              if (report.normalizedData.video_title) setVideoTitle(report.normalizedData.video_title);
              if (report.normalizedData.target_duration) setSelectedDuration(report.normalizedData.target_duration);
            }
          }
        }
      } catch (err) {
        console.error('Error initializing Vann script step:', err);
      }
    })();
  }, []);

  const handleSwitchTopic = async (topic: BatchTopicItem) => {
    setActiveTopicId(topic.id);
    setVideoTitle(topic.title);
    setTopicSummary(topic.summary);

    if (isBatchGenerating || isGenerating) {
      return;
    }

    try {
      if (api?.readFromProject) {
        let specificScript = await api.readFromProject(`input/vann/scripts/script_topic_${topic.id}.json`);
        if (!specificScript) {
          specificScript = await api.readFromProject(`input/vann/scripts/script_topic_${topic.id}.json`);
        }
        if (!specificScript && batchTopics.length === 1) {
          specificScript = await api.readFromProject('input/vann/script.json');
        }

        if (specificScript) {
          setPastedOutput(specificScript);
          const report = validateWakuScript(specificScript, targetWords);
          setValidationReport(report);
          if (report.normalizedData) {
            setScriptData(report.normalizedData);
            return;
          }
        }
      }
    } catch (e) {
      console.error(e);
    }

    setPastedOutput('');
    setScriptData(null);
    setValidationReport(null);
  };

  const handleDurationChange = (dur: string, words: number) => {
    setSelectedDuration(dur);
    setTargetWords(words);
  };

  const getComputedPrompt = (promptTplStr?: string, customTitle?: string, customSummary?: string) => {
    const tpl = promptTplStr || masterPrompt;
    const words = targetWords || 1500;
    const minWords = Math.max(300, Math.round(words * 0.90));
    const maxWords = Math.round(words * 1.10);
    const perSectionWords = Math.max(80, Math.round((words - 250) / 5));

    return tpl
      .replace(/{judul}/g, customTitle || videoTitle || '[Judul Video]')
      .replace(/{ringkasan}/g, customSummary || topicSummary || '[Ringkasan Topik]')
      .replace(/{durasi}/g, selectedDuration)
      .replace(/{word_count}/g, String(words))
      .replace(/{min_words}/g, String(minWords))
      .replace(/{max_words}/g, String(maxWords))
      .replace(/{per_section_words}/g, String(perSectionWords));
  };

  // 🤖 Auto Generate Script Handler via AI with Realtime SSE Streaming
  const handleAutoGenerate = async () => {
    if (!videoTitle.trim()) {
      showToast('⚠️ Mohon isi judul video terlebih dahulu!');
      return;
    }

    setIsGenerating(true);
    setGeneratingTopicId(activeTopicId);
    setBatchCurrentIndex(1);
    setBatchTotalCount(1);
    setPastedOutput('');
    setActiveTab('json'); // Switch to json tab to see live streaming text
    let unsubscribeStream: (() => void) | null = null;

    try {
      let currentPrompt = masterPrompt;
      if (!currentPrompt) {
        currentPrompt = await loadPromptFromFile();
      }

      const computed = getComputedPrompt(currentPrompt);

      if (!api?.generateWakuScript) {
        throw new Error('API generateWakuScript tidak tersedia pada Electron preload.');
      }

      if (api?.onWakuScriptChunk) {
        unsubscribeStream = api.onWakuScriptChunk(({ fullText }) => {
          setPastedOutput(fullText);
        });
      }

      const res = await api.generateWakuScript(computed, selectedModel);
      const rawContent = res?.rawText || JSON.stringify(res);
      setPastedOutput(rawContent);

      const report = validateWakuScript(rawContent, targetWords);
      setValidationReport(report);

      if (report.normalizedData) {
        setScriptData(report.normalizedData);
        saveScriptState(report.normalizedData, rawContent);
        setActiveTab('full');
        showToast(`✨ Naskah Waku berhasil dibuat (${report.normalizedData.actual_word_count} Kata)!`);
      } else {
        showToast(`⚠️ Validasi JSON Gagal: ${report.summaryText}`);
      }
    } catch (err: any) {
      showToast(`❌ Gagal me-generate naskah: ${err?.message || err}`);
    } finally {
      if (unsubscribeStream) unsubscribeStream();
      setIsGenerating(false);
      setGeneratingTopicId(null);
    }
  };

  // 📋 Copy Prompt Handler
  const handleCopyPrompt = async () => {
    let currentPrompt = masterPrompt;
    if (!currentPrompt) {
      currentPrompt = await loadPromptFromFile();
    }
    const computed = getComputedPrompt(currentPrompt);

    if (api?.copyToClipboard) {
      await api.copyToClipboard(computed);
      showToast('📋 Prompt Naskah berhasil disalin ke Clipboard!');
    } else {
      navigator.clipboard.writeText(computed);
      showToast('📋 Prompt Naskah disalin ke Clipboard!');
    }
  };

  const handleSavePrompt = async () => {
    try {
      if (api?.saveToProject) {
        await api.saveToProject('dashboard/prompts/vann/script-prompt.md', masterPrompt);
        await api.saveToProject('dashboard/prompts/vann/script-prompt.md', masterPrompt);
        showToast('💾 Master script prompt disimpan ke script-prompt.md!');
      }
    } catch (err) {
      showToast('❌ Gagal menyimpan script prompt.');
    }
  };

  const handleResetPrompt = async () => {
    await loadPromptFromFile();
    showToast('🔄 Prompt dimuat ulang dari script-prompt.md!');
  };

  const handleProcessOutput = async () => {
    if (!pastedOutput.trim()) return;

    const report = validateWakuScript(pastedOutput);
    setValidationReport(report);

    if (report.normalizedData) {
      setScriptData(report.normalizedData);
      saveScriptState(report.normalizedData, pastedOutput);
      showToast(`✅ Validasi Strict JSON Naskah Berhasil (${report.normalizedData.actual_word_count} Kata)!`);
    } else {
      showToast(`⚠️ Validasi Gagal: ${report.summaryText}`);
    }
  };

  const saveScriptState = async (data: WakuScriptData, rawStr: string, topicId?: number) => {
    try {
      const targetId = topicId || activeTopicId;
      if (api?.saveToProject) {
        await api.saveToProject('input/vann/script.json', rawStr);
        await api.saveToProject('input/vann/full_script.txt', data.full_script);

        if (targetId) {
          await api.saveToProject(`input/vann/scripts/script_topic_${targetId}.json`, rawStr);
          await api.saveToProject(`input/vann/scripts/full_script_topic_${targetId}.txt`, data.full_script);
        }
      }
      if (targetId) {
        setBatchTopics((prev) =>
          prev.map((t) => (t.id === targetId ? { ...t, hasScript: true } : t))
        );
      }
    } catch (err) {
      console.error('Error saving script state:', err);
    }
  };

  const handleBatchGenerateAll = async () => {
    if (batchTopics.length === 0) return;
    setIsBatchGenerating(true);
    setBatchTotalCount(batchTopics.length);
    showToast(`🚀 Memulai Batch Script Generator untuk ${batchTopics.length} Topik...`);

    let unsubscribeStream: (() => void) | null = null;
    try {
      if (api?.onWakuScriptChunk) {
        unsubscribeStream = api.onWakuScriptChunk(({ fullText }) => {
          setPastedOutput(fullText);
        });
      }

      let idx = 0;
      for (const topic of batchTopics) {
        idx++;
        setBatchCurrentIndex(idx);
        setGeneratingTopicId(topic.id);
        setActiveTopicId(topic.id);
        setVideoTitle(topic.title);
        setTopicSummary(topic.summary);
        setPastedOutput('');

        try {
          let currentPrompt = masterPrompt || (await loadPromptFromFile());
          const computed = getComputedPrompt(currentPrompt, topic.title, topic.summary);

          if (api?.generateWakuScript) {
            const res = await api.generateWakuScript(computed, selectedModel);
            const rawContent = res?.rawText || JSON.stringify(res);
            const report = validateWakuScript(rawContent, targetWords);

            if (report.normalizedData) {
              await saveScriptState(report.normalizedData, rawContent, topic.id);
              setScriptData(report.normalizedData);
              setPastedOutput(rawContent);
              showToast(`✓ Naskah Topik #${topic.id} Selesai (${report.normalizedData.actual_word_count} Kata)!`);
            }
          }
        } catch (err: any) {
          console.error(`Gagal batch script topik #${topic.id}:`, err);
        }
      }

      showToast(`✨ Seluruh (${batchTopics.length}) Naskah Batch Berhasil Di-generate!`);
    } finally {
      if (unsubscribeStream) unsubscribeStream();
      setIsBatchGenerating(false);
      setGeneratingTopicId(null);
    }
  };

  const handleCopyFullScript = async () => {
    if (!scriptData?.full_script) return;
    if (api?.copyToClipboard) {
      await api.copyToClipboard(scriptData.full_script);
    } else {
      navigator.clipboard.writeText(scriptData.full_script);
    }
    showToast('📋 Seluruh naskah voiceover disalin ke Clipboard!');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-2xl font-semibold text-xs flex items-center gap-2 border border-emerald-400/30 animate-bounce">
          <span>{toast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-gray-900 to-gray-950 p-6 rounded-3xl border border-emerald-800/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                ✨ Vann AI Workflow — Step 2
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>⚡</span> Script Generator (Vann)
            </h1>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              Generate naskah voiceover edukasi kontraintuitif dengan ritme kalimat tajam & Style DNA Vann siap pakai.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowPromptEditor(!showPromptEditor)}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold border border-gray-700 transition-all flex items-center gap-1.5"
            >
              <span>⚙️</span>
              <span>{showPromptEditor ? 'Sembunyikan Prompt' : 'Master Prompt'}</span>
            </button>

            <button
              onClick={handleCopyPrompt}
              className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-emerald-300 rounded-xl text-xs font-semibold border border-emerald-800/80 transition-all flex items-center gap-1.5"
            >
              <span>📋</span>
              <span>Salin Prompt</span>
            </button>

            <button
              onClick={handleAutoGenerate}
              disabled={isGenerating || isBatchGenerating}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Generating AI...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Auto Generate Naskah</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Batch Queue Topic Tabs Selector */}
      {batchTopics.length > 0 && (
        <div className="bg-gray-900/90 p-4 rounded-3xl border border-emerald-800/40 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold font-mono text-[10px] uppercase">
                🚀 Batch Queue ({batchTopics.length} Topik)
              </span>
              <h3 className="text-xs font-bold text-white">
                Pilih Topik untuk Edit / Generate Naskah:
              </h3>
            </div>

            {batchTopics.length > 1 && (
              <button
                onClick={handleBatchGenerateAll}
                disabled={isGenerating || isBatchGenerating}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-1.5 shrink-0"
              >
                {isBatchGenerating ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span>
                    <span>Generating Batch...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Auto Generate Semua Naskah Batch</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-800">
            {batchTopics.map((t) => {
              const isActive = activeTopicId === t.id;
              const isGeneratingThis = generatingTopicId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSwitchTopic(t)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-2 max-w-xs ${
                    isGeneratingThis
                      ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-500/50 animate-pulse'
                      : isActive
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-md ring-1 ring-emerald-500/40'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-900 border border-gray-800 text-emerald-300 shrink-0">
                    #{t.id}
                  </span>
                  <span className="truncate">"{t.title}"</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      isGeneratingThis
                        ? 'bg-emerald-900 text-emerald-200 border border-emerald-500 animate-pulse'
                        : t.hasScript
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-gray-900 text-emerald-400 border border-gray-800'
                    }`}
                  >
                    {isGeneratingThis ? '⚡ Generating...' : t.hasScript ? '✓ Ready' : '⏳ Belum'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Realtime Process Monitor Panel */}
      {(isGenerating || isBatchGenerating) && (
        <div className="bg-gray-900/95 p-5 rounded-3xl border border-emerald-500/60 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <h3 className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2">
                <span>⚡</span> Realtime Process Monitor
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                Model: {selectedModel}
              </span>
            </div>

            {batchTotalCount > 0 && (
              <span className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-1.5">
                <span>📊</span> Progress: Topik {batchCurrentIndex} dari {batchTotalCount} ({Math.round((batchCurrentIndex / batchTotalCount) * 100)}% Selesai)
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {batchTotalCount > 0 && (
            <div className="w-full bg-gray-950 rounded-full h-2.5 overflow-hidden border border-gray-800 p-0.5">
              <div
                className="bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-md shadow-emerald-500/50"
                style={{ width: `${Math.max(5, Math.round((batchCurrentIndex / batchTotalCount) * 100))}%` }}
              />
            </div>
          )}

          {/* Live Queue Cards Grid */}
          {batchTopics.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {batchTopics.map((t) => {
                const isGeneratingThis = generatingTopicId === t.id;
                return (
                  <div
                    key={t.id}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                      isGeneratingThis
                        ? 'bg-emerald-950/80 border-emerald-400 text-white shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-400/50 animate-pulse'
                        : t.hasScript
                        ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                        : 'bg-gray-950 border-gray-800 text-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-900 shrink-0">
                        #{t.id}
                      </span>
                      <span className="truncate font-semibold">{t.title}</span>
                    </div>
                    <span className="text-[10px] font-bold shrink-0">
                      {isGeneratingThis ? '⚡ Generating...' : t.hasScript ? '✓ Ready' : '⏳ Waiting'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Live Word Count & Streaming Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-400 flex items-center gap-1">
                <span>📝</span> Streaming Response Live:
              </span>
              <span className="text-emerald-300 font-bold bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-800">
                {pastedOutput.trim() ? pastedOutput.trim().split(/\s+/).filter(Boolean).length : 0} / {targetWords} Kata (Target: {selectedDuration})
              </span>
            </div>

            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 font-mono text-xs text-gray-300 max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap selection:bg-emerald-900 selection:text-white border-emerald-900/40">
              {pastedOutput ? (
                <>
                  {pastedOutput}
                  <span className="inline-block w-2 h-4 bg-emerald-400 ml-1 animate-ping" />
                </>
              ) : (
                <span className="text-gray-600 italic">⏳ Menunggu respon pertama dari API AI stream...</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Master Prompt Editor */}
      {showPromptEditor && (
        <div className="bg-gray-900/90 p-5 rounded-3xl border border-emerald-800/40 shadow-xl space-y-3 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <span>📝</span> Master Script Prompt (`script-prompt.md`)
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetPrompt}
                className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg text-[11px] font-mono transition-all"
              >
                Reload dari File
              </button>
              <button
                onClick={handleSavePrompt}
                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-bold transition-all"
              >
                Simpan Prompt
              </button>
            </div>
          </div>

          <textarea
            value={masterPrompt}
            onChange={(e) => setMasterPrompt(e.target.value)}
            rows={12}
            className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs font-mono text-gray-300 focus:outline-none focus:border-emerald-500/80 leading-relaxed resize-y"
            placeholder="Loading prompt from script-prompt.md..."
          />
        </div>
      )}

      {/* Main Grid: Parameters & Output Views */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Input Parameter Form */}
        <div className="md:col-span-1 bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-xl space-y-5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <span className="p-1 bg-emerald-950 text-emerald-400 rounded-lg text-xs">✍️</span>
            Input Parameter Naskah
          </h2>

          {/* Video Title */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-300 block">
              Judul Video:
            </label>
            <input
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="Judul pertanyaan provokatif video..."
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-all font-semibold"
            />
          </div>

          {/* Topic Summary */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-300 block">
              Ringkasan Topik / Core Facts:
            </label>
            <textarea
              value={topicSummary}
              onChange={(e) => setTopicSummary(e.target.value)}
              rows={3}
              placeholder="Fakta kontraintuitif utama yang akan dibahas dalam naskah..."
              className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-all leading-relaxed"
            />
          </div>

          {/* Target Duration Preset Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-300 block">
              Target Durasi & Estimasi Kata:
            </label>
            <div className="space-y-1.5">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.duration}
                  onClick={() => handleDurationChange(preset.duration, preset.words)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-between ${
                    selectedDuration === preset.duration
                      ? 'bg-emerald-950 border-emerald-600 text-emerald-300 shadow-md'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  <span>{preset.label}</span>
                  {selectedDuration === preset.duration && <span>✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* AI Model Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-300 block">
              Model AI (9router API):
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-emerald-300 focus:outline-none focus:border-emerald-500 font-mono font-semibold"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              onClick={handleAutoGenerate}
              disabled={isGenerating}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-2xl text-xs shadow-xl shadow-emerald-950/50 transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Generating Naskah...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Auto Generate Naskah (1-Click)</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyPrompt}
              className="w-full py-2.5 bg-gray-950 hover:bg-gray-800 text-gray-300 font-semibold rounded-2xl text-xs border border-gray-800 transition-all flex items-center justify-center gap-2"
            >
              <span>📋</span>
              <span>Salin Prompt (Manual Copy/Paste)</span>
            </button>
          </div>
        </div>

        {/* Right Column: Generated Script Output & View Tabs */}
        <div className="md:col-span-2 space-y-6">
          {/* Output Viewer Panel */}
          <div className="bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-xl space-y-4">
            {/* View Tabs & Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-emerald-950 text-emerald-400 rounded-lg text-xs">🎬</span>
                <h2 className="text-sm font-bold text-white">Naskah Waku</h2>
                {scriptData && (
                  <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-800 font-bold">
                    {scriptData.actual_word_count} Kata ({scriptData.target_duration})
                  </span>
                )}
              </div>

              {/* Tabs Switcher */}
              <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
                <button
                  onClick={() => setActiveTab('full')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'full'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  📜 Naskah Lengkap
                </button>

                <button
                  onClick={() => setActiveTab('sections')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'sections'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🧩 DNA Segmen
                </button>

                <button
                  onClick={() => setActiveTab('json')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'json'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  📥 Raw JSON
                </button>
              </div>
            </div>

            {/* Validation Badge & Issues */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                {isGenerating && (
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 font-bold animate-pulse flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>🔴 Streaming Script Live... ({pastedOutput.length} char)</span>
                  </span>
                )}
                {!isGenerating && validationReport && (
                  <span
                    className={`text-[10px] font-mono px-2.5 py-0.5 rounded-md border font-bold ${
                      validationReport.isValid
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                        : 'bg-red-950 text-red-400 border-red-800'
                    }`}
                  >
                    {validationReport.isValid ? '✓ Strict JSON Script Valid' : `⚠️ ${validationReport.summaryText}`}
                  </span>
                )}
              </div>

                {scriptData && (
                  <button
                    onClick={handleCopyFullScript}
                    className="px-3 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <span>📋</span>
                    <span>Salin Naskah Voiceover</span>
                  </button>
                )}
              </div>

            {/* Tab 1: Full Formatted Script View */}
            {activeTab === 'full' && (
              <div className="space-y-4">
                {!scriptData ? (
                  <div className="bg-gray-950 border border-dashed border-gray-800 rounded-3xl p-12 text-center space-y-3">
                    <div className="w-14 h-14 bg-emerald-600/10 text-emerald-400 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-emerald-500/20">
                      ⚡
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Naskah Belum Di-generate</h4>
                      <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        Klik <strong>"Auto Generate Naskah"</strong> untuk membuat naskah voiceover lengkap berdasarkan topik Waku.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 space-y-4 leading-relaxed font-sans text-xs text-gray-200">
                    <div className="border-b border-gray-800/80 pb-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-extrabold text-white">{scriptData.video_title}</h3>
                        <span className="text-[10px] text-gray-500 font-mono">
                          Target Durasi: {scriptData.target_duration} | Real Word Count: {scriptData.actual_word_count} kata
                        </span>
                      </div>
                    </div>

                    <div className="whitespace-pre-line text-xs font-normal leading-relaxed text-gray-300 space-y-3">
                      {scriptData.full_script}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: DNA Segmen Breakdown View */}
            {activeTab === 'sections' && (
              <div className="space-y-4">
                {!scriptData ? (
                  <div className="bg-gray-950 border border-dashed border-gray-800 rounded-3xl p-10 text-center text-xs text-gray-500">
                    Belum ada naskah tersimpan.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Hook Card */}
                    {scriptData.hook && (
                      <div className="p-4 bg-emerald-950/30 border border-emerald-800/60 rounded-2xl space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-mono font-bold rounded-md uppercase">
                            🎣 HOOK STYLE
                          </span>
                        </div>

                        {scriptData.hook.imaginative_scenario && (
                          <p className="text-xs text-gray-300">
                            <strong className="text-emerald-400">Skenario Imajinatif:</strong> {scriptData.hook.imaginative_scenario}
                          </p>
                        )}
                        {scriptData.hook.surprising_detail && (
                          <p className="text-xs text-gray-300">
                            <strong className="text-emerald-400">Detail Mengejutkan:</strong> {scriptData.hook.surprising_detail}
                          </p>
                        )}
                        {scriptData.hook.philosophical_closing && (
                          <p className="text-xs text-gray-300 italic border-l-2 border-emerald-500 pl-2">
                            <strong className="text-emerald-300">Penutup Reflektif:</strong> "{scriptData.hook.philosophical_closing}"
                          </p>
                        )}
                      </div>
                    )}

                    {/* Segments Cards */}
                    {scriptData.sections && scriptData.sections.length > 0 && (
                      <div className="space-y-3">
                        {scriptData.sections.map((sec) => (
                          <div key={sec.section_number} className="p-4 bg-gray-950 border border-gray-800 rounded-2xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white flex items-center gap-2">
                                <span className="w-5 h-5 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded-lg text-[10px] flex items-center justify-center font-mono">
                                  #{sec.section_number}
                                </span>
                                {sec.section_title}
                              </span>

                              {sec.transition_phrase && (
                                <span className="text-[10px] text-gray-500 font-mono italic">
                                  Transisi: "{sec.transition_phrase}"
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-gray-300 leading-relaxed pt-1">
                              {sec.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Closing Reflection */}
                    {scriptData.closing_reflection && (
                      <div className="p-4 bg-emerald-950/30 border border-emerald-800/60 rounded-2xl space-y-1">
                        <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-mono font-bold rounded-md uppercase">
                          💡 CLOSING REFLECTION
                        </span>
                        <p className="text-xs text-gray-300 italic leading-relaxed pt-1">
                          "{scriptData.closing_reflection}"
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Raw / JSON Text Output & Import */}
            {activeTab === 'json' && (
              <div className="space-y-3">
                <textarea
                  value={pastedOutput}
                  onChange={(e) => setPastedOutput(e.target.value)}
                  rows={14}
                  placeholder="Paste or edit raw script JSON here..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs font-mono text-gray-300 focus:outline-none focus:border-emerald-500 transition-all leading-relaxed"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleProcessOutput}
                    disabled={!pastedOutput.trim()}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
                  >
                    <span>⚡ Validasi Strict JSON & Process</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WakuScriptStep;
