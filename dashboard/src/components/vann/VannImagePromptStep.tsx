// dashboard/src/components/waku/WakuImagePromptStep.tsx
import React, { useState, useEffect } from 'react';
import { validateWakuImagePrompts, WakuImagePromptItem, WakuImagePromptsValidationReport } from '../../utils/vannValidation';

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
  hasPrompts?: boolean;
}

const WakuImagePromptStep: React.FC = () => {
  const [segmentsListStr, setSegmentsListStr] = useState<string>('');
  const [segmentsCount, setSegmentsCount] = useState<number>(0);
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
  const [imagePrompts, setImagePrompts] = useState<WakuImagePromptItem[]>([]);
  const [activeTab, setActiveTab] = useState<'cards' | 'json'>('cards');

  const [toast, setToast] = useState<string | null>(null);
  const [validationReport, setValidationReport] = useState<WakuImagePromptsValidationReport | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadPromptFromFile = async () => {
    try {
      if (api?.readFromProject) {
        const loadedPrompt = await api.readFromProject('dashboard/prompts/vann/image-prompt-generator-prompt.md');
        if (loadedPrompt && loadedPrompt.trim().length > 0) {
          setMasterPrompt(loadedPrompt);
          return loadedPrompt;
        }
      }
    } catch (err) {
      console.error('Error reading image-prompt-generator-prompt.md:', err);
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

          // Check per-topic prompt files to update hasPrompts badges
          const checkedTopics = await Promise.all(
            loadedTopics.map(async (top) => {
              try {
                const specificPrompts = await api.readFromProject(`input/vann/prompts/image_prompts_topic_${top.id}.json`);
                return { ...top, hasPrompts: Boolean(specificPrompts && specificPrompts.trim()) };
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

          // 2. Load segments & prompts for active topic
          await loadTopicData(selectedId, checkedTopics);
        }
      } catch (err) {
        console.error('Error initializing Waku Image Prompt Step:', err);
      }
    })();
  }, []);

  const loadTopicData = async (topicId: number | null, topicList?: BatchTopicItem[]) => {
    if (!api?.readFromProject) return;

    // Load segments for this topic
    let segmentsText = '';
    let count = 0;
    if (topicId) {
      const segFileStr = (await api.readFromProject(`input/vann/breakdowns/segments_topic_${topicId}.json`)) || '';
      if (segFileStr) {
        try {
          const parsed = JSON.parse(segFileStr);
          if (Array.isArray(parsed.segments)) {
            count = parsed.segments.length;
            segmentsText = parsed.segments.map((s: any) => `Segmen ${s.segment_id}: "${s.text}"`).join('\n\n');
          }
        } catch {}
      }
      if (!segmentsText) {
        segmentsText = (await api.readFromProject(`input/vann/breakdowns/breakdown_topic_${topicId}.json`)) || '';
      }
    }

    if (!segmentsText) {
      const segmentsJsonStr = (await api.readFromProject('input/vann/segments.json')) || '';
      if (segmentsJsonStr) {
        try {
          const parsed = JSON.parse(segmentsJsonStr);
          if (Array.isArray(parsed.segments)) {
            count = parsed.segments.length;
            segmentsText = parsed.segments.map((s: any) => `Segmen ${s.segment_id}: "${s.text}"`).join('\n\n');
          }
        } catch {}
      }
    }
    if (!segmentsText) {
      segmentsText = (await api.readFromProject('input/vann/breakdown.json')) || '';
    }

    setSegmentsCount(count);
    setSegmentsListStr(segmentsText || '');

    // Load image prompts for this topic
    const promptFile = topicId
      ? `input/vann/prompts/image_prompts_topic_${topicId}.json`
      : 'input/vann/image_prompts.json';

    let promptsJson = (await api.readFromProject(promptFile)) || '';
    if (!promptsJson && topicId) {
      promptsJson = (await api.readFromProject('input/vann/image_prompts.json')) || '';
    }

    if (promptsJson) {
      setPastedOutput(promptsJson);
      const report = validateWakuImagePrompts(promptsJson);
      setValidationReport(report);
      if (report.normalizedData) {
        setImagePrompts(report.normalizedData.image_prompts);
        return;
      }
    }

    setPastedOutput('');
    setImagePrompts([]);
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

  const getComputedPrompt = (promptTplStr?: string, customSegmentsStr?: string) => {
    const tpl = promptTplStr || masterPrompt;
    const targetSegments = customSegmentsStr || segmentsListStr;
    return tpl
      .replace(/{tempel list segmen dari Step 3 di sini}/g, targetSegments || '[List Segmen]')
      .replace(/{list_segmen}/g, targetSegments || '[List Segmen]');
  };

  // 🎨 Auto Generate Image Prompts via AI (Realtime SSE Streaming)
  const handleAutoGenerate = async () => {
    if (!segmentsListStr.trim()) {
      showToast('⚠️ Mohon pastikan segmen adegan dari Step 3 telah dibuat!');
      return;
    }

    setIsGenerating(true);
    setGeneratingTopicId(activeTopicId);
    setBatchCurrentIndex(1);
    setBatchTotalCount(1);
    setPastedOutput('');
    let unsubscribeStream: (() => void) | null = null;

    try {
      let currentPrompt = (await loadPromptFromFile()) || masterPrompt;

      const computed = getComputedPrompt(currentPrompt);

      if (!api?.generateWakuImagePrompts) {
        throw new Error('API generateWakuImagePrompts tidak tersedia pada Electron preload.');
      }

      if (api?.onWakuImagePromptsChunk) {
        unsubscribeStream = api.onWakuImagePromptsChunk(({ fullText }) => {
          setPastedOutput(fullText);
        });
      }

      const res = await api.generateWakuImagePrompts(computed, selectedModel);
      const rawContent = res?.rawText || JSON.stringify(res);
      setPastedOutput(rawContent);

      const report = validateWakuImagePrompts(rawContent);
      setValidationReport(report);

      if (report.normalizedData && report.normalizedData.image_prompts.length > 0) {
        setImagePrompts(report.normalizedData.image_prompts);
        savePromptsState(report.normalizedData.image_prompts, rawContent);
        showToast(`✨ Generasi Image Prompt Berhasil: ${report.normalizedData.image_prompts.length} prompt gambar dibuat!`);
      } else {
        showToast(`⚠️ Validasi Image Prompt Gagal: ${report.summaryText}`);
      }
    } catch (err: any) {
      console.error('Image prompt generate error:', err);
      showToast(`❌ Gagal me-generate prompt gambar: ${err?.message || err}`);
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
      showToast('📋 Prompt Generator disalin ke Clipboard!');
    } else {
      navigator.clipboard.writeText(computed);
      showToast('📋 Prompt Generator disalin ke Clipboard!');
    }
  };

  const handleSavePrompt = async () => {
    try {
      if (api?.saveToProject) {
        await api.saveToProject('dashboard/prompts/vann/image-prompt-generator-prompt.md', masterPrompt);
        showToast('💾 Master prompt disimpan ke image-prompt-generator-prompt.md!');
      }
    } catch (err) {
      showToast('❌ Gagal menyimpan prompt.');
    }
  };

  const handleResetPrompt = async () => {
    await loadPromptFromFile();
    showToast('🔄 Prompt dimuat ulang dari file md!');
  };

  const handleProcessOutput = async () => {
    if (!pastedOutput.trim()) return;

    const report = validateWakuImagePrompts(pastedOutput);
    setValidationReport(report);

    if (report.normalizedData && report.normalizedData.image_prompts.length > 0) {
      setImagePrompts(report.normalizedData.image_prompts);
      savePromptsState(report.normalizedData.image_prompts, pastedOutput);
      showToast(`✅ Validasi Image Prompts Berhasil (${report.normalizedData.image_prompts.length} Prompt)!`);
    } else {
      showToast(`⚠️ Validasi Gagal: ${report.summaryText}`);
    }
  };

  const savePromptsState = async (prompts: WakuImagePromptItem[], rawStr: string, topicId?: number) => {
    try {
      const targetId = topicId || activeTopicId;
      if (api?.saveToProject) {
        await api.saveToProject('input/vann/image_prompts.json', rawStr);
        const formattedTxt = prompts.map((p) => `Segmen ${p.segment_id}: "${p.segment_quote}"\nPrompt:\n${p.prompt}`).join('\n\n---\n\n');
        await api.saveToProject('input/vann/prompts.txt', formattedTxt);

        if (targetId) {
          await api.saveToProject(`input/vann/prompts/image_prompts_topic_${targetId}.json`, rawStr);
          await api.saveToProject(`input/vann/prompts/prompts_topic_${targetId}.txt`, formattedTxt);
        }
      }
      if (targetId) {
        setBatchTopics((prev) =>
          prev.map((t) => (t.id === targetId ? { ...t, hasPrompts: true } : t))
        );
      }
    } catch (err) {
      console.error('Error saving image prompts state:', err);
    }
  };

  const handleBatchGenerateAll = async () => {
    if (batchTopics.length === 0) return;
    setIsBatchGenerating(true);
    setBatchTotalCount(batchTopics.length);
    showToast(`🚀 Memulai Batch Image Prompt Generator untuk ${batchTopics.length} Topik...`);

    let unsubscribeStream: (() => void) | null = null;
    try {
      if (api?.onWakuImagePromptsChunk) {
        unsubscribeStream = api.onWakuImagePromptsChunk(({ fullText }) => {
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

        // Load segments for this topic
        let segmentsText = '';
        if (api?.readFromProject) {
          const segFileStr = (await api.readFromProject(`input/vann/breakdowns/segments_topic_${topic.id}.json`)) || '';
          if (segFileStr) {
            try {
              const parsed = JSON.parse(segFileStr);
              if (Array.isArray(parsed.segments)) {
                segmentsText = parsed.segments.map((s: any) => `Segmen ${s.segment_id}: "${s.text}"`).join('\n\n');
              }
            } catch {}
          }
          if (!segmentsText) {
            segmentsText = (await api.readFromProject(`input/vann/breakdowns/breakdown_topic_${topic.id}.json`)) || '';
          }
        }
        if (!segmentsText) segmentsText = segmentsListStr;
        setSegmentsListStr(segmentsText);

        if (!segmentsText.trim()) {
          showToast(`⚠️ Breakdown segmen Topik #${topic.id} belum ada! Lewati...`);
          continue;
        }

        try {
          let currentPrompt = (await loadPromptFromFile()) || masterPrompt;
          const computed = getComputedPrompt(currentPrompt, segmentsText);

          if (api?.generateWakuImagePrompts) {
            const res = await api.generateWakuImagePrompts(computed, selectedModel);
            const rawContent = res?.rawText || JSON.stringify(res);
            const report = validateWakuImagePrompts(rawContent);

            if (report.normalizedData && report.normalizedData.image_prompts.length > 0) {
              await savePromptsState(report.normalizedData.image_prompts, rawContent, topic.id);
              setImagePrompts(report.normalizedData.image_prompts);
              setPastedOutput(rawContent);
              showToast(`✓ Image Prompts Topik #${topic.id} Selesai (${report.normalizedData.image_prompts.length} Prompt)!`);
            }
          }
        } catch (err: any) {
          console.error(`Gagal image prompts topik #${topic.id}:`, err);
        }
      }

      showToast(`✨ Seluruh (${batchTopics.length}) Image Prompts Batch Berhasil Di-generate!`);
    } finally {
      if (unsubscribeStream) unsubscribeStream();
      setIsBatchGenerating(false);
      setGeneratingTopicId(null);
    }
  };

  const handleUpdatePromptText = (id: number, newPrompt: string) => {
    const updated = imagePrompts.map((p) => (p.segment_id === id ? { ...p, prompt: newPrompt } : p));
    setImagePrompts(updated);
    savePromptsState(updated, JSON.stringify({ total_prompts: updated.length, image_prompts: updated }, null, 2));
  };

  const handleCopySinglePrompt = async (item: WakuImagePromptItem) => {
    if (api?.copyToClipboard) {
      await api.copyToClipboard(item.prompt);
    } else {
      navigator.clipboard.writeText(item.prompt);
    }
    showToast(`📋 Prompt gambar Segmen #${item.segment_id} disalin!`);
  };

  const handleCopyAllPrompts = async () => {
    const formatted = imagePrompts.map((p) => `[Segmen #${p.segment_id}]\n${p.prompt}`).join('\n\n---\n\n');
    if (api?.copyToClipboard) {
      await api.copyToClipboard(formatted);
    } else {
      navigator.clipboard.writeText(formatted);
    }
    showToast(`📋 Seluruh ${imagePrompts.length} prompt gambar disalin!`);
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
                ✨ Vann AI Workflow — Step 4
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>🎨</span> Image Prompt Generator (Vann)
            </h1>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              Generate prompt gambar ber-style Gritty Graphic Novel Dark Anime, desaturated cool blue-grey chiaroscuro, & first-person POV storytelling unik untuk setiap segmen adegan Vann.
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
                  <span>Generating Prompts...</span>
                </>
              ) : (
                <>
                  <span>🎨</span>
                  <span>Auto Generate Prompts (AI)</span>
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
                Pilih Topik untuk Prompt Gambar Visual:
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
                    <span>Auto Generate Semua Image Prompt Batch</span>
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
                        : t.hasPrompts
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-gray-900 text-emerald-400 border border-gray-800'
                    }`}
                  >
                    {isGeneratingThis ? '⚡ Generating...' : t.hasPrompts ? '✓ Ready' : '⏳ Belum'}
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
                <span>⚡</span> Realtime Image Prompt Monitor
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
                        : t.hasPrompts
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
                      {isGeneratingThis ? '⚡ Generating...' : t.hasPrompts ? '✓ Ready' : '⏳ Waiting'}
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
                <span>📝</span> Live Image Prompts JSON Stream:
              </span>
              <span className="text-emerald-300 font-bold bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-800">
                {imagePrompts.length} Prompt Gambar
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
              <span>📝</span> Master Image Prompt Generator (`image-prompt-generator-prompt.md`)
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
            placeholder="Loading prompt from file..."
          />
        </div>
      )}

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Segments Input Preview */}
        <div className="md:col-span-1 bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-xl space-y-5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <span className="p-1 bg-emerald-950 text-emerald-400 rounded-lg text-xs">✂️</span>
            Source Segmen (Step 3)
          </h2>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-300">
                Segmen Adegan:
              </label>
              <span className="text-[10px] font-mono text-emerald-300 font-bold">
                {segmentsCount} Segmen Loaded
              </span>
            </div>

            <textarea
              value={segmentsListStr}
              onChange={(e) => setSegmentsListStr(e.target.value)}
              rows={12}
              placeholder="List segmen dari Step 3 akan otomatis terisi di sini..."
              className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-3.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500 transition-all leading-relaxed font-mono"
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
                  <span>Generating Prompts...</span>
                </>
              ) : (
                <>
                  <span>🎨</span>
                  <span>Auto Generate Prompts (1-Click)</span>
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

        {/* Right Column: Generated Image Prompts Cards Display */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-xl space-y-4">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-emerald-950 text-emerald-400 rounded-lg text-xs">🖼️</span>
                <h2 className="text-sm font-bold text-white">Prompt Gambar per Segmen</h2>
                {imagePrompts.length > 0 && (
                  <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-800 font-bold">
                    {imagePrompts.length} Prompts
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {imagePrompts.length > 0 && (
                  <button
                    onClick={handleCopyAllPrompts}
                    className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <span>📋</span>
                    <span>Salin Semua Prompt (.txt)</span>
                  </button>
                )}

                <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
                  <button
                    onClick={() => setActiveTab('cards')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'cards' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    🖼️ Visual Cards
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

            {/* Live Streaming & Validation Badge */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                {isGenerating && (
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 font-bold animate-pulse flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>🔴 Streaming Image Prompts Live... ({pastedOutput.length} char)</span>
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
                    {validationReport.isValid ? '✓ Image Prompts Valid' : `⚠️ ${validationReport.summaryText}`}
                  </span>
                )}
              </div>
            </div>

            {/* Tab 1: Visual Cards View */}
            {activeTab === 'cards' && (
              <div className="space-y-4">
                {imagePrompts.length === 0 ? (
                  <div className="bg-gray-950 border border-dashed border-gray-800 rounded-3xl p-12 text-center space-y-3">
                    <div className="w-14 h-14 bg-emerald-600/10 text-emerald-400 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-emerald-500/20">
                      🎨
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Belum Ada Prompt Gambar</h4>
                      <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        Klik <strong>"Auto Generate Prompts (AI)"</strong> untuk membuat prompt gambar ber-style Waku DNA.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {imagePrompts.map((item) => (
                      <div
                        key={item.segment_id}
                        className="p-4 bg-gray-950 border border-gray-800 hover:border-gray-700 rounded-2xl space-y-3 transition-all duration-200 group"
                      >
                        <div className="flex items-start justify-between gap-3 border-b border-gray-800/80 pb-2.5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-mono font-bold flex items-center justify-center">
                                #{item.segment_id}
                              </span>
                              <h4 className="text-xs font-bold text-white">
                                Prompt Gambar Segmen #{item.segment_id}
                              </h4>
                            </div>

                            {item.segment_quote && (
                              <p className="text-[11px] text-gray-400 italic pl-8">
                                "{item.segment_quote}"
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() => handleCopySinglePrompt(item)}
                            className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-emerald-300 rounded-xl text-xs font-bold border border-gray-800 transition-all flex items-center gap-1 shrink-0"
                          >
                            <span>📋</span>
                            <span>Salin Prompt</span>
                          </button>
                        </div>

                        <textarea
                          value={item.prompt}
                          onChange={(e) => handleUpdatePromptText(item.segment_id, e.target.value)}
                          rows={6}
                          className="w-full bg-gray-900/90 border border-gray-800 rounded-xl p-3.5 text-xs text-emerald-100 font-mono leading-relaxed focus:outline-none focus:border-emerald-500 transition-all"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Raw / JSON Text Output */}
            {activeTab === 'json' && (
              <div className="space-y-3">
                <textarea
                  value={pastedOutput}
                  onChange={(e) => setPastedOutput(e.target.value)}
                  rows={14}
                  placeholder="Paste or edit raw image prompts output here..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs font-mono text-gray-300 focus:outline-none focus:border-emerald-500 transition-all leading-relaxed"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleProcessOutput}
                    disabled={!pastedOutput.trim()}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
                  >
                    <span>⚡ Validasi & Process</span>
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

export default WakuImagePromptStep;
