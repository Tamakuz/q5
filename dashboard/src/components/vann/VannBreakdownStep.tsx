// dashboard/src/components/waku/WakuBreakdownStep.tsx
import React, { useState, useEffect } from 'react';
import { validateWakuBreakdown, WakuSegmentItem, WakuBreakdownValidationReport } from '../../utils/vannValidation';

const api = window.electronAPI;

const MODEL_OPTIONS = [
  { id: 'ag/gemini-3-flash-agent', name: 'ag/gemini-3-flash-agent (Recommended)' },
  { id: 'cx/gpt-5.5', name: 'cx/gpt-5.5' },
  { id: 'cmc/deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

export interface BatchTopicItem {
  id: number;
  title: string;
  summary: string;
  hasBreakdown?: boolean;
}

const WakuBreakdownStep: React.FC = () => {
  const [fullScript, setFullScript] = useState<string>('');
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('cx/gpt-5.5');
  const [masterPrompt, setMasterPrompt] = useState<string>('');
  const [showPromptEditor, setShowPromptEditor] = useState<boolean>(false);

  const [batchTopics, setBatchTopics] = useState<BatchTopicItem[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<number | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [batchCurrentIndex, setBatchCurrentIndex] = useState<number>(0);
  const [batchTotalCount, setBatchTotalCount] = useState<number>(0);
  const [generatingTopicId, setGeneratingTopicId] = useState<number | null>(null);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [pastedOutput, setPastedOutput] = useState<string>('');
  const [segments, setSegments] = useState<WakuSegmentItem[]>([]);
  const [activeTab, setActiveTab] = useState<'cards' | 'json'>('cards');

  const [toast, setToast] = useState<string | null>(null);
  const [validationReport, setValidationReport] = useState<WakuBreakdownValidationReport | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadPromptFromFile = async () => {
    try {
      if (api?.readFromProject) {
        const loadedPrompt = await api.readFromProject('dashboard/prompts/vann/breakdown-prompt.md');
        if (loadedPrompt && loadedPrompt.trim().length > 0) {
          setMasterPrompt(loadedPrompt);
          return loadedPrompt;
        }
      }
    } catch (err) {
      console.error('Error loading breakdown-prompt.md:', err);
    }
    return '';
  };

  // Initial load on mount
  useEffect(() => {
    (async () => {
      await loadPromptFromFile();
      try {
        if (api?.readFromProject) {
          // 1. Load selected topics from Step 1
          const savedTopicsJson = await api.readFromProject('input/vann/topics.json');
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

          // Check per-topic breakdown files to update hasBreakdown badges
          const checkedTopics = await Promise.all(
            loadedTopics.map(async (top) => {
              try {
                const specificBreakdown = await api.readFromProject(`input/vann/breakdowns/breakdown_topic_${top.id}.json`);
                return { ...top, hasBreakdown: Boolean(specificBreakdown && specificBreakdown.trim()) };
              } catch {
                return top;
              }
            })
          );

          setBatchTopics(checkedTopics);
          if (selectedId !== null) {
            setActiveTopicId(selectedId);
            const activeTop = checkedTopics.find((t) => t.id === selectedId) || checkedTopics[0];
            if (activeTop) setVideoTitle(activeTop.title);
          }

          // 2. Load script & breakdown for active topic
          await loadTopicData(selectedId, checkedTopics);
        }
      } catch (err) {
        console.error('Error initializing Waku Breakdown Step:', err);
      }
    })();
  }, []);

  const loadTopicData = async (topicId: number | null, topicList?: BatchTopicItem[]) => {
    if (!api?.readFromProject) return;

    // Load full script for this topic
    let scriptText = '';
    if (topicId) {
      scriptText = (await api.readFromProject(`input/vann/scripts/full_script_topic_${topicId}.txt`)) || '';
      if (!scriptText) {
        const jsonScript = await api.readFromProject(`input/vann/scripts/script_topic_${topicId}.json`);
        if (jsonScript) {
          try {
            const parsed = JSON.parse(jsonScript);
            if (parsed.full_script) scriptText = parsed.full_script;
            if (parsed.video_title) setVideoTitle(parsed.video_title);
          } catch {}
        }
      }
    }
    if (!scriptText) {
      scriptText = (await api.readFromProject('input/vann/full_script.txt')) || '';
    }
    if (!scriptText) {
      const scriptJsonStr = await api.readFromProject('input/vann/script.json');
      if (scriptJsonStr) {
        try {
          const parsedScript = JSON.parse(scriptJsonStr);
          if (parsedScript.video_title) setVideoTitle(parsedScript.video_title);
          if (parsedScript.full_script) scriptText = parsedScript.full_script;
        } catch {}
      }
    }
    setFullScript(scriptText || '');

    // Load breakdown for this topic
    const breakdownFile = topicId
      ? `input/vann/breakdowns/breakdown_topic_${topicId}.json`
      : 'input/vann/breakdown.json';

    let breakdownJson = await api.readFromProject(breakdownFile);
    if (!breakdownJson && topicId) {
      breakdownJson = await api.readFromProject('input/vann/breakdown.json');
    }

    if (breakdownJson) {
      setPastedOutput(breakdownJson);
      const report = validateWakuBreakdown(breakdownJson);
      setValidationReport(report);
      if (report.normalizedData) {
        setSegments(report.normalizedData.segments);
        return;
      }
    }

    setPastedOutput('');
    setSegments([]);
    setValidationReport(null);
  };

  const handleSwitchTopic = async (topic: BatchTopicItem) => {
    setActiveTopicId(topic.id);
    setVideoTitle(topic.title);

    if (isBatchGenerating || isGenerating) {
      return;
    }

    await loadTopicData(topic.id);
  };

  const getComputedPrompt = (promptTplStr?: string, customScript?: string) => {
    const tpl = promptTplStr || masterPrompt;
    const targetScript = customScript || fullScript;
    return tpl
      .replace(/{tempel naskah lengkap dari Step 2 di sini}/g, targetScript || '[Naskah Lengkap]')
      .replace(/{naskah_lengkap}/g, targetScript || '[Naskah Lengkap]');
  };

  // ✂️ Auto Generate Scene Breakdown via AI (SSE Streaming)
  const handleAutoGenerate = async () => {
    if (!fullScript.trim()) {
      showToast('⚠️ Mohon isi atau pastikan naskah dari Step 2 tersedia terlebih dahulu!');
      return;
    }

    setIsGenerating(true);
    setGeneratingTopicId(activeTopicId);
    setBatchCurrentIndex(1);
    setBatchTotalCount(1);
    setPastedOutput('');
    let unsubscribeStream: (() => void) | null = null;

    try {
      let currentPrompt = await loadPromptFromFile();
      if (!currentPrompt) {
        currentPrompt = masterPrompt;
      }

      const computed = getComputedPrompt(currentPrompt);

      if (!api?.generateWakuBreakdown) {
        throw new Error('API generateWakuBreakdown tidak tersedia pada Electron preload.');
      }

      if (api?.onWakuBreakdownChunk) {
        unsubscribeStream = api.onWakuBreakdownChunk(({ fullText }) => {
          setPastedOutput(fullText);
        });
      }

      const res = await api.generateWakuBreakdown(computed, selectedModel);
      const rawContent = res?.rawText || JSON.stringify(res);
      setPastedOutput(rawContent);

      const report = validateWakuBreakdown(rawContent);
      setValidationReport(report);

      if (report.normalizedData && report.normalizedData.segments.length > 0) {
        setSegments(report.normalizedData.segments);
        saveBreakdownState(report.normalizedData.segments, rawContent);
        showToast(`✨ Pemotongan Adegan Berhasil: ${report.normalizedData.segments.length} Segmen dibuat!`);
      } else {
        showToast(`⚠️ Validasi Breakdown Gagal: ${report.summaryText}`);
      }
    } catch (err: any) {
      showToast(`❌ Gagal me-breakdown naskah: ${err?.message || err}`);
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
      showToast('📋 Prompt Breakdown berhasil disalin ke Clipboard!');
    } else {
      navigator.clipboard.writeText(computed);
      showToast('📋 Prompt Breakdown disalin ke Clipboard!');
    }
  };

  const handleSavePrompt = async () => {
    try {
      if (api?.saveToProject) {
        await api.saveToProject('dashboard/prompts/vann/breakdown-prompt.md', masterPrompt);
        showToast('💾 Master prompt disimpan ke breakdown-prompt.md!');
      }
    } catch (err) {
      showToast('❌ Gagal menyimpan prompt.');
    }
  };

  const handleResetPrompt = async () => {
    await loadPromptFromFile();
    showToast('🔄 Prompt dimuat ulang dari breakdown-prompt.md!');
  };

  const handleProcessOutput = async () => {
    if (!pastedOutput.trim()) return;

    const report = validateWakuBreakdown(pastedOutput);
    setValidationReport(report);

    if (report.normalizedData && report.normalizedData.segments.length > 0) {
      setSegments(report.normalizedData.segments);
      saveBreakdownState(report.normalizedData.segments, pastedOutput);
      showToast(`✅ Validasi Breakdown Berhasil (${report.normalizedData.segments.length} Segmen)!`);
    } else {
      showToast(`⚠️ Validasi Gagal: ${report.summaryText}`);
    }
  };

  const saveBreakdownState = async (segList: WakuSegmentItem[], rawStr: string, topicId?: number) => {
    try {
      const targetId = topicId || activeTopicId;
      if (api?.saveToProject) {
        await api.saveToProject('input/vann/breakdown.json', rawStr);
        await api.saveToProject('input/vann/segments.json', JSON.stringify({ total_segments: segList.length, segments: segList }, null, 2));

        if (targetId) {
          await api.saveToProject(`input/vann/breakdowns/breakdown_topic_${targetId}.json`, rawStr);
          await api.saveToProject(`input/vann/breakdowns/segments_topic_${targetId}.json`, JSON.stringify({ total_segments: segList.length, segments: segList }, null, 2));
        }
      }
      if (targetId) {
        setBatchTopics((prev) =>
          prev.map((t) => (t.id === targetId ? { ...t, hasBreakdown: true } : t))
        );
      }
    } catch (err) {
      console.error('Error saving breakdown state:', err);
    }
  };

  const handleBatchGenerateAll = async () => {
    if (batchTopics.length === 0) return;
    setIsBatchGenerating(true);
    setBatchTotalCount(batchTopics.length);
    showToast(`🚀 Memulai Batch Scene Splitter untuk ${batchTopics.length} Topik...`);

    let unsubscribeStream: (() => void) | null = null;
    try {
      if (api?.onWakuBreakdownChunk) {
        unsubscribeStream = api.onWakuBreakdownChunk(({ fullText }) => {
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
        setPastedOutput('');

        // Load script for this topic
        let scriptText = '';
        if (api?.readFromProject) {
          scriptText = (await api.readFromProject(`input/vann/scripts/full_script_topic_${topic.id}.txt`)) || '';
          if (!scriptText) {
            const jsonScript = await api.readFromProject(`input/vann/scripts/script_topic_${topic.id}.json`);
            if (jsonScript) {
              try {
                const parsed = JSON.parse(jsonScript);
                if (parsed.full_script) scriptText = parsed.full_script;
              } catch {}
            }
          }
        }
        if (!scriptText) scriptText = fullScript;
        setFullScript(scriptText);

        if (!scriptText.trim()) {
          showToast(`⚠️ Naskah Topik #${topic.id} belum ada! Lewati...`);
          continue;
        }

        try {
          let currentPrompt = (await loadPromptFromFile()) || masterPrompt;
          const computed = getComputedPrompt(currentPrompt, scriptText);

          if (api?.generateWakuBreakdown) {
            const res = await api.generateWakuBreakdown(computed, selectedModel);
            const rawContent = res?.rawText || JSON.stringify(res);
            const report = validateWakuBreakdown(rawContent);

            if (report.normalizedData && report.normalizedData.segments.length > 0) {
              await saveBreakdownState(report.normalizedData.segments, rawContent, topic.id);
              setSegments(report.normalizedData.segments);
              setPastedOutput(rawContent);
              showToast(`✓ Breakdown Topik #${topic.id} Selesai (${report.normalizedData.segments.length} Segmen)!`);
            }
          }
        } catch (err: any) {
          console.error(`Gagal breakdown topik #${topic.id}:`, err);
        }
      }

      showToast(`✨ Seluruh (${batchTopics.length}) Breakdown Batch Berhasil Di-generate!`);
    } finally {
      if (unsubscribeStream) unsubscribeStream();
      setIsBatchGenerating(false);
      setGeneratingTopicId(null);
    }
  };

  // Segment editing handlers
  const handleUpdateSegmentText = (id: number, newText: string) => {
    const updated = segments.map((s) => (s.segment_id === id ? { ...s, text: newText } : s));
    setSegments(updated);
    saveBreakdownState(updated, JSON.stringify({ total_segments: updated.length, segments: updated }, null, 2));
  };

  const handleDeleteSegment = (id: number) => {
    const filtered = segments.filter((s) => s.segment_id !== id).map((s, idx) => ({ ...s, segment_id: idx + 1 }));
    setSegments(filtered);
    saveBreakdownState(filtered, JSON.stringify({ total_segments: filtered.length, segments: filtered }, null, 2));
    showToast(`🗑️ Segmen #${id} dihapus.`);
  };

  const handleAddSegment = (afterId?: number) => {
    const newSeg: WakuSegmentItem = {
      segment_id: segments.length + 1,
      text: 'Segmen adegan baru...',
    };
    let updated: WakuSegmentItem[] = [];

    if (typeof afterId === 'number') {
      const idx = segments.findIndex((s) => s.segment_id === afterId);
      if (idx !== -1) {
        updated = [...segments.slice(0, idx + 1), newSeg, ...segments.slice(idx + 1)].map((s, i) => ({
          ...s,
          segment_id: i + 1,
        }));
      } else {
        updated = [...segments, newSeg];
      }
    } else {
      updated = [...segments, newSeg];
    }

    setSegments(updated);
    saveBreakdownState(updated, JSON.stringify({ total_segments: updated.length, segments: updated }, null, 2));
    showToast('➕ Segmen adegan baru ditambahkan.');
  };

  const handleCopyAllSegmentsText = async () => {
    const formatted = segments.map((s) => `Segmen ${s.segment_id}: "${s.text}"`).join('\n\n');
    if (api?.copyToClipboard) {
      await api.copyToClipboard(formatted);
    } else {
      navigator.clipboard.writeText(formatted);
    }
    showToast(`📋 Seluruh ${segments.length} segmen adegan disalin!`);
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
                ✨ Vann AI Workflow — Step 3
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>✂️</span> Scene Splitter (Vann Script Breakdown)
            </h1>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              Pecah naskah voiceover menjadi segmen-segmen adegan visual yang jelas sesuai pergeseran gambaran narasi Vann.
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
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-500 hover:to-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Splitting Scenes...</span>
                </>
              ) : (
                <>
                  <span>✂️</span>
                  <span>Auto Breakdown (AI)</span>
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
                Pilih Topik untuk Breakdown Adegan Visual:
              </h3>
            </div>

            {batchTopics.length > 1 && (
              <button
                onClick={handleBatchGenerateAll}
                disabled={isGenerating || isBatchGenerating}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-500 hover:to-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-1.5 shrink-0"
              >
                {isBatchGenerating ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span>
                    <span>Generating Batch...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Auto Generate Semua Breakdown Batch</span>
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
                        : t.hasBreakdown
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-gray-900 text-emerald-400 border border-gray-800'
                    }`}
                  >
                    {isGeneratingThis ? '⚡ Splitting...' : t.hasBreakdown ? '✓ Ready' : '⏳ Belum'}
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
                <span>⚡</span> Realtime Breakdown Monitor
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
                        : t.hasBreakdown
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
                      {isGeneratingThis ? '⚡ Splitting...' : t.hasBreakdown ? '✓ Ready' : '⏳ Waiting'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Live Streaming Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-400 flex items-center gap-1">
                <span>📝</span> Live Breakdown JSON Stream:
              </span>
              <span className="text-emerald-300 font-bold bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-800">
                {segments.length} Segmen Terurai
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
              <span>📝</span> Master Breakdown Prompt (`breakdown-prompt.md`)
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
            placeholder="Loading prompt from breakdown-prompt.md..."
          />
        </div>
      )}

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Source Script Input */}
        <div className="md:col-span-1 bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-xl space-y-5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <span className="p-1 bg-emerald-950 text-emerald-400 rounded-lg text-xs">📄</span>
            Source Script (Step 2)
          </h2>

          {videoTitle && (
            <div className="p-3 bg-gray-950 border border-gray-800 rounded-xl space-y-0.5">
              <span className="text-[10px] text-gray-500 font-mono block">Judul Video:</span>
              <h4 className="text-xs font-bold text-white">"{videoTitle}"</h4>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-300">
                Naskah Lengkap:
              </label>
              <span className="text-[10px] font-mono text-emerald-300">
                {fullScript ? fullScript.split(/\s+/).filter(Boolean).length : 0} Kata
              </span>
            </div>

            <textarea
              value={fullScript}
              onChange={(e) => setFullScript(e.target.value)}
              rows={12}
              placeholder="Naskah lengkap dari Step 2 akan otomatis terisi di sini..."
              className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-3.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500 transition-all leading-relaxed font-sans"
            />
          </div>

          {/* Model Options */}
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

          <div className="pt-2 space-y-2">
            <button
              onClick={handleAutoGenerate}
              disabled={isGenerating}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-2xl text-xs shadow-xl shadow-emerald-950/50 transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Splitting Scenes...</span>
                </>
              ) : (
                <>
                  <span>✂️</span>
                  <span>Auto Breakdown Segmen (1-Click)</span>
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

        {/* Right Column: Breakdown Segments Cards Display */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-xl space-y-4">
            {/* Header & Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-emerald-950 text-emerald-400 rounded-lg text-xs">🎬</span>
                <h2 className="text-sm font-bold text-white">Daftar Segmen Adegan</h2>
                {segments.length > 0 && (
                  <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-800 font-bold">
                    {segments.length} Segmen
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {segments.length > 0 && (
                  <button
                    onClick={handleCopyAllSegmentsText}
                    className="px-3 py-1.5 bg-gray-950 hover:bg-gray-800 border border-gray-800 text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <span>📋</span>
                    <span>Salin Semua Segmen</span>
                  </button>
                )}

                <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
                  <button
                    onClick={() => setActiveTab('cards')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'cards' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    🧩 Visual Cards
                  </button>
                  <button
                    onClick={() => setActiveTab('json')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'json' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    📥 Raw Output
                  </button>
                </div>
              </div>
            </div>

            {/* Validation Badge */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                {isGenerating && (
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 font-bold animate-pulse flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>🔴 Streaming Breakdown Live... ({pastedOutput.length} char)</span>
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
                    {validationReport.isValid ? '✓ Scene Breakdown Valid' : `⚠️ ${validationReport.summaryText}`}
                  </span>
                )}
              </div>
            </div>

            {/* Tab 1: Visual Segment Cards View */}
            {activeTab === 'cards' && (
              <div className="space-y-4">
                {segments.length === 0 ? (
                  <div className="bg-gray-950 border border-dashed border-gray-800 rounded-3xl p-12 text-center space-y-3">
                    <div className="w-14 h-14 bg-emerald-600/10 text-emerald-400 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-emerald-500/20">
                      ✂️
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Belum Ada Segmen Adegan</h4>
                      <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        Klik <strong>"Auto Breakdown (AI)"</strong> untuk memotong naskah menjadi segmen adegan visual.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {segments.map((seg) => {
                      const wordsCount = seg.text.split(/\s+/).filter(Boolean).length;
                      return (
                        <div
                          key={seg.segment_id}
                          className="p-4 bg-gray-950 border border-gray-800 hover:border-gray-700 rounded-2xl space-y-2.5 transition-all duration-200 group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-mono font-bold flex items-center justify-center">
                                #{seg.segment_id}
                              </span>
                              <span className="text-xs font-bold text-white">
                                Segmen Adegan #{seg.segment_id}
                              </span>
                              <span className="text-[10px] font-mono text-gray-500 bg-gray-900 px-2 py-0.5 rounded-md border border-gray-800">
                                {wordsCount} kata
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleAddSegment(seg.segment_id)}
                                title="Sisipkan segmen baru di bawah ini"
                                className="px-2 py-1 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded-lg text-[11px] font-mono border border-gray-800"
                              >
                                ➕ Sisip
                              </button>
                              <button
                                onClick={() => handleDeleteSegment(seg.segment_id)}
                                title="Hapus segmen ini"
                                className="p-1.5 bg-gray-900 hover:bg-red-950 text-gray-400 hover:text-red-400 rounded-lg text-xs border border-gray-800"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>

                          <textarea
                            value={seg.text}
                            onChange={(e) => handleUpdateSegmentText(seg.segment_id, e.target.value)}
                            rows={2}
                            className="w-full bg-gray-900/90 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-emerald-500 font-sans leading-relaxed resize-y"
                          />
                        </div>
                      );
                    })}

                    <div className="pt-2 flex justify-center">
                      <button
                        onClick={() => handleAddSegment()}
                        className="px-4 py-2.5 bg-gray-950 hover:bg-gray-800 text-emerald-300 rounded-2xl text-xs font-bold border border-emerald-900/60 shadow-lg transition-all flex items-center gap-2"
                      >
                        <span>➕</span>
                        <span>Tambah Segmen Adegan Baru</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Raw / JSON Text Output & Manual Import */}
            {activeTab === 'json' && (
              <div className="space-y-3">
                <textarea
                  value={pastedOutput}
                  onChange={(e) => setPastedOutput(e.target.value)}
                  rows={14}
                  placeholder="Paste or edit raw breakdown JSON / Segmen text output here..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs font-mono text-gray-300 focus:outline-none focus:border-emerald-500 transition-all leading-relaxed"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleProcessOutput}
                    disabled={!pastedOutput.trim()}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
                  >
                    <span>⚡ Validasi Strict Breakdown & Process</span>
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

export default WakuBreakdownStep;
