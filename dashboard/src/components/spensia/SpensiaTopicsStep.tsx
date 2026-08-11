// dashboard/src/components/spensia/SpensiaTopicsStep.tsx
import React, { useState, useEffect } from 'react';
import { validateSpensiaTopics, SpensiaTopicsValidationReport } from '../../utils/spensiaValidation';

const api = window.electronAPI;

export interface TopicItem {
  id: number;
  title: string;
  summary: string;
  angles?: string[];
  selected_angle_index?: number;
  viral_score?: number;
  viral_reason?: string;
  ruthless_critique?: string;
  search_keyphrases?: string[];
  outlier_search_guide?: string;
  outlier_evidence?: {
    channel_name?: string;
    video_title?: string;
    views_count?: string;
    notes?: string;
  };
  selected?: boolean;
}

const MODEL_OPTIONS = [
  { id: 'ag/gemini-3-flash-agent', name: 'ag/gemini-3-flash-agent (Recommended)' },
  { id: 'cx/gpt-5.5', name: 'cx/gpt-5.5' },
  { id: 'cmc/deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

const SpensiaTopicsStep: React.FC = () => {
  const [topicTheme, setTopicTheme] = useState<string>('');
  const [itemCount, setItemCount] = useState<number>(5);
  const [masterPrompt, setMasterPrompt] = useState<string>('');
  const [showPromptEditor, setShowPromptEditor] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('ag/gemini-3-flash-agent');

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [pastedOutput, setPastedOutput] = useState<string>('');
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);
  const [validationReport, setValidationReport] = useState<SpensiaTopicsValidationReport | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadPromptFromFile = async () => {
    try {
      if (api?.readFromProject) {
        const loadedPrompt = await api.readFromProject('dashboard/prompts/spensia/topics-prompt.md');
        if (loadedPrompt && loadedPrompt.trim().length > 0) {
          setMasterPrompt(loadedPrompt);
          return loadedPrompt;
        }
      }
    } catch (err) {
      console.error('Error reading prompt file dashboard/prompts/spensia/topics-prompt.md:', err);
    }
    return '';
  };

  // Load saved prompt & topics on mount
  useEffect(() => {
    (async () => {
      await loadPromptFromFile();
      try {
        if (api?.readFromProject) {
          const savedTopicsJson = await api.readFromProject('input/spensia/topics.json');
          if (savedTopicsJson) {
            const data = JSON.parse(savedTopicsJson);
            if (Array.isArray(data.topics)) {
              setTopics(data.topics);
              const report = validateSpensiaTopics(data);
              setValidationReport(report);
            }
            if (data.theme) setTopicTheme(data.theme);
            if (Array.isArray(data.selectedTopicIds)) {
              setSelectedTopicIds(data.selectedTopicIds);
              setSelectedTopicId(data.selectedTopicIds[0] || null);
            } else if (data.selectedTopicId) {
              setSelectedTopicIds([data.selectedTopicId]);
              setSelectedTopicId(data.selectedTopicId);
            }
          }
        }
      } catch (err) {
        console.error('Error loading Spensia topics state:', err);
      }
    })();
  }, []);

  const getComputedPrompt = (promptTextStr?: string) => {
    const tpl = promptTextStr || masterPrompt;
    const themeValue = topicTheme.trim() ? topicTheme.trim() : 'Semua Niche Spensia Channel (Sejarah, Psikologi, Sains, Fakta Purba vs Modern)';
    return tpl
      .replace(/{topik_umum}/g, themeValue)
      .replace(/{topik umum, misal: "sejarah kekayaan", "psikologi manusia", "evolusi manusia purba"}/g, themeValue)
      .replace(/{jumlah}/g, String(itemCount));
  };

  // 🔍 Generate Keyphrases & Ruthless Critique ONLY for existing topics
  const handleGenerateKeyphrasesOnly = async (topicsToProcess = topics) => {
    if (topicsToProcess.length === 0) {
      showToast('⚠️ Belum ada topik yang dibuat. Generate topik terlebih dahulu.');
      return;
    }

    setIsGenerating(true);
    setPastedOutput('');
    let unsubscribeStream: (() => void) | null = null;

    try {
      const topicSummaryList = topicsToProcess
        .map((t) => `- ID ${t.id}: "${t.title}" (Ringkasan: ${t.summary})`)
        .join('\n');

      let templatePrompt: string = '';
      if (api?.readFromProject) {
        const loaded = await api.readFromProject('dashboard/prompts/spensia/demand-keyphrases-prompt.md');
        if (loaded) templatePrompt = loaded;
      }

      if (!templatePrompt || !templatePrompt.trim()) {
        throw new Error('File prompt dashboard/prompts/spensia/demand-keyphrases-prompt.md tidak ditemukan atau kosong.');
      }

      const keyphrasePrompt = templatePrompt
        .replace(/{jumlah}/g, String(topicsToProcess.length))
        .replace(/{daftar_topik}/g, topicSummaryList);

      if (!api?.generateSpensiaTopics) {
        throw new Error('API generateSpensiaTopics tidak tersedia pada Electron preload.');
      }

      if (api?.onSpensiaTopicsChunk) {
        unsubscribeStream = api.onSpensiaTopicsChunk(({ fullText }) => {
          setPastedOutput(fullText);
        });
      }

      const res = await api.generateSpensiaTopics(keyphrasePrompt, selectedModel);
      const rawContent = res?.rawText || JSON.stringify(res);
      setPastedOutput(rawContent);

      let cleaned = rawContent.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
      }

      let parsed: any = null;
      try {
        parsed = JSON.parse(cleaned);
      } catch (err: any) {
        console.error('Failed to parse JSON for keyphrases:', err);
      }

      const keyphraseList: any[] = parsed?.topics_keyphrases || parsed?.topics || (Array.isArray(parsed) ? parsed : []);

      if (keyphraseList.length > 0) {
        const updatedTopics = topicsToProcess.map((topic) => {
          const match = keyphraseList.find((k: any) => Number(k.id) === topic.id);
          if (match) {
            return {
              ...topic,
              ruthless_critique: match.ruthless_critique || match.critique || topic.ruthless_critique,
              search_keyphrases: Array.isArray(match.search_keyphrases)
                ? match.search_keyphrases.map((x: any) => String(x).trim())
                : topic.search_keyphrases,
              outlier_search_guide: match.outlier_search_guide || match.panduan_outlier || topic.outlier_search_guide,
            };
          }
          return topic;
        });

        setTopics(updatedTopics);
        saveTopicsState(updatedTopics, topicTheme, selectedTopicIds);
        showToast(`✨ Kata kunci & Bedah Kritis berhasil ditambahkan untuk ${updatedTopics.length} topik!`);
      } else {
        showToast('⚠️ Respon diterima, silakan periksa output JSON.');
      }
    } catch (err: any) {
      showToast(`❌ Gagal me-generate kata kunci: ${err?.message || err}`);
    } finally {
      if (unsubscribeStream) unsubscribeStream();
      setIsGenerating(false);
    }
  };

  // 🤖 Automated Generation Handler via 9router API with Realtime Streaming & Strict Validation
  const handleAutoGenerate = async (forceNewTopics = false) => {
    // If topics already exist and user didn't explicitly force brand-new topics:
    if (topics.length > 0 && !forceNewTopics) {
      const hasMissingKeyphrases = topics.some((t) => !t.search_keyphrases || t.search_keyphrases.length === 0);
      if (hasMissingKeyphrases) {
        await handleGenerateKeyphrasesOnly(topics);
        return;
      }
    }

    setIsGenerating(true);
    setPastedOutput('');
    let unsubscribeStream: (() => void) | null = null;

    try {
      let currentPrompt = masterPrompt;
      if (!currentPrompt) {
        currentPrompt = await loadPromptFromFile();
      }

      const computed = getComputedPrompt(currentPrompt);

      if (!api?.generateSpensiaTopics) {
        throw new Error('API generateSpensiaTopics tidak tersedia pada Electron preload.');
      }

      // Subscribe to real-time streaming chunks
      if (api?.onSpensiaTopicsChunk) {
        unsubscribeStream = api.onSpensiaTopicsChunk(({ fullText }) => {
          setPastedOutput(fullText);
        });
      }

      const res = await api.generateSpensiaTopics(computed, selectedModel);
      const rawContent = res?.rawText || JSON.stringify(res);
      setPastedOutput(rawContent);

      // Perform Strict JSON Validation
      const report = validateSpensiaTopics(rawContent);
      setValidationReport(report);

      if (report.normalizedData && report.normalizedData.topics.length > 0) {
        setTopics(report.normalizedData.topics);
        saveTopicsState(report.normalizedData.topics, topicTheme, selectedTopicIds);
        showToast(`✨ Strict JSON Valid: ${report.normalizedData.topics.length} konsep topik berhasil di-generate!`);
      } else {
        showToast(`⚠️ Validasi JSON Gagal: ${report.summaryText}`);
      }
    } catch (err: any) {
      showToast(`❌ Gagal me-generate topik: ${err?.message || err}`);
    } finally {
      if (unsubscribeStream) unsubscribeStream();
      setIsGenerating(false);
    }
  };

  // 📋 Manual Copy Prompt Handler
  const handleCopyPrompt = async () => {
    let currentPrompt = masterPrompt;
    if (!currentPrompt) {
      currentPrompt = await loadPromptFromFile();
    }
    const computed = getComputedPrompt(currentPrompt);

    if (api?.copyToClipboard) {
      await api.copyToClipboard(computed);
      showToast('📋 Prompt berhasil disalin ke Clipboard!');
    } else {
      navigator.clipboard.writeText(computed);
      showToast('📋 Prompt disalin ke Clipboard!');
    }
  };

  const handleSavePrompt = async () => {
    try {
      if (api?.saveToProject) {
        await api.saveToProject('dashboard/prompts/spensia/topics-prompt.md', masterPrompt);
        showToast('💾 Master prompt disimpan ke topics-prompt.md!');
      }
    } catch (err) {
      showToast('❌ Gagal menyimpan prompt.');
    }
  };

  const handleResetPrompt = async () => {
    await loadPromptFromFile();
    showToast('🔄 Prompt dimuat ulang dari topics-prompt.md!');
  };

  // Process and Validate input text (supports strict JSON or regex fallback)
  const handleProcessOutput = async () => {
    if (!pastedOutput.trim()) return;

    const report = validateSpensiaTopics(pastedOutput);
    setValidationReport(report);

    if (report.normalizedData && report.normalizedData.topics.length > 0) {
      setTopics(report.normalizedData.topics);
      saveTopicsState(report.normalizedData.topics, topicTheme, selectedTopicIds);
      showToast(`✅ Validasi Strict JSON Berhasil (${report.normalizedData.topics.length} topik)!`);
    } else {
      showToast(`⚠️ Validasi Gagal: ${report.summaryText}`);
    }
  };

  const saveTopicsState = async (topicsList: TopicItem[], themeStr: string, activeIds: number[]) => {
    try {
      if (api?.saveToProject) {
        const selectedTopicsList = topicsList.filter((t) => activeIds.includes(t.id));
        await api.saveToProject(
          'input/spensia/topics.json',
          JSON.stringify(
            {
              topics: topicsList,
              theme: themeStr,
              selectedTopicId: activeIds[0] || null,
              selectedTopicIds: activeIds,
              selectedTopics: selectedTopicsList,
              updatedAt: new Date().toISOString()
            },
            null,
            2
          )
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectAngle = (topicId: number, angleIdx: number, angleText: string) => {
    const updatedTopics = topics.map((t) => {
      if (t.id === topicId) {
        return { ...t, title: angleText, selected_angle_index: angleIdx };
      }
      return t;
    });
    setTopics(updatedTopics);
    saveTopicsState(updatedTopics, topicTheme, selectedTopicIds);
    showToast(`🎯 Opsi Judul Angle #${angleIdx + 1} dipilih untuk Topik #${topicId}!`);
  };

  const handleToggleTopic = (id: number) => {
    let nextIds: number[];
    if (selectedTopicIds.includes(id)) {
      nextIds = selectedTopicIds.filter((tid) => tid !== id);
    } else {
      nextIds = [...selectedTopicIds, id];
    }
    setSelectedTopicIds(nextIds);
    setSelectedTopicId(nextIds[0] || null);
    saveTopicsState(topics, topicTheme, nextIds);
  };

  const handleSelectTop3 = () => {
    if (topics.length === 0) return;
    const sorted = [...topics].sort((a, b) => (b.viral_score || 0) - (a.viral_score || 0));
    const top3Ids = sorted.slice(0, 3).map((t) => t.id);
    setSelectedTopicIds(top3Ids);
    setSelectedTopicId(top3Ids[0] || null);
    saveTopicsState(topics, topicTheme, top3Ids);
    showToast(`⚡ ${top3Ids.length} topik dengan Viral Score tertinggi otomatis dipilih ke Batch Queue!`);
  };

  const handleSelectAll = () => {
    if (topics.length === 0) return;
    const allIds = topics.map((t) => t.id);
    setSelectedTopicIds(allIds);
    setSelectedTopicId(allIds[0] || null);
    saveTopicsState(topics, topicTheme, allIds);
    showToast(`✨ Semua (${allIds.length}) topik berhasil dimasukkan ke Batch Queue!`);
  };

  const handleClearSelection = () => {
    setSelectedTopicIds([]);
    setSelectedTopicId(null);
    saveTopicsState(topics, topicTheme, []);
    showToast('🧹 Pilihan Batch Queue dibersihkan.');
  };

  const handleCopySingleTopic = async (topic: TopicItem) => {
    const text = `Topik: "${topic.title}"\nRingkasan: ${topic.summary}`;
    if (api?.copyToClipboard) {
      await api.copyToClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }
    showToast(`📋 Topik #${topic.id} disalin!`);
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
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                ✨ Spensia AI Workflow — Step 1
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>💡</span> Topics Generator (Spensia)
            </h1>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              Generate ide topik video edukasi provokatif dengan fakta kontraintuitif & detail kehidupan kuno vs modern ala Lumensia / Spensia.
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
              onClick={() => handleAutoGenerate(false)}
              disabled={isGenerating}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Generating AI...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Auto Generate AI</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Master Prompt Editor Collapsible */}
      {showPromptEditor && (
        <div className="bg-gray-900/90 p-5 rounded-3xl border border-emerald-800/40 shadow-xl space-y-3 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <span>📝</span> Master Prompt (`topics-prompt.md`)
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
            placeholder="Loading prompt from topics-prompt.md..."
          />
        </div>
      )}

      {/* Grid Configuration Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Input Parameter Panel */}
        <div className="md:col-span-1 bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-xl space-y-5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <span className="p-1 bg-emerald-950 text-emerald-400 rounded-lg text-xs">🎯</span>
            Parameter Input
          </h2>

          {/* Channel Niche DNA Profile Card */}
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl space-y-1.5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                <span>📺</span> Channel DNA (Spensia Profile)
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 font-bold">
                Auto Mode
              </span>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              AI akan otomatis riset & me-generate ide ber-demand tinggi dari <strong className="text-emerald-300">dunia nyata, isu viral, tren modern, fenomena sosial, hingga skenario imajinatif tentang kehidupan</strong>.
            </p>
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

          {/* Optional Theme Filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-300 block">
                Filter Tema Spesifik <span className="text-[10px] text-gray-500 font-normal">(Opsional)</span>:
              </label>
              {topicTheme && (
                <button
                  onClick={() => setTopicTheme('')}
                  className="text-[10px] text-gray-500 hover:text-gray-300 underline"
                >
                  Reset Auto
                </button>
              )}
            </div>
            <input
              type="text"
              value={topicTheme}
              onChange={(e) => setTopicTheme(e.target.value)}
              placeholder='Kosongkan untuk AI riset bebas ide ber-demand tinggi di dunia nyata...'
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-all font-semibold"
            />
          </div>

          {/* Jumlah Ide Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-300 block">
              Jumlah Ide Topik:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[3, 5, 10, 15].map((num) => (
                <button
                  key={num}
                  onClick={() => setItemCount(num)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    itemCount === num
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/30'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  {num} Ide
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            {topics.length > 0 ? (
              <>
                <button
                  onClick={() => handleGenerateKeyphrasesOnly(topics)}
                  disabled={isGenerating}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-2xl text-xs shadow-xl shadow-emerald-950/40 transition-all flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <span className="animate-spin text-sm">⏳</span>
                      <span>Menganalisis Demand & Kata Kunci...</span>
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      <span>Generate Kata Kunci Riset ({topics.length} Topik Saat Ini)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleAutoGenerate(true)}
                  disabled={isGenerating}
                  className="w-full py-2.5 bg-gray-950 hover:bg-gray-800 text-gray-300 font-semibold rounded-2xl text-xs border border-gray-800 transition-all flex items-center justify-center gap-2"
                >
                  <span>🔄</span>
                  <span>Buat Topik Baru dari Awal (Reset)</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => handleAutoGenerate(false)}
                disabled={isGenerating}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold rounded-2xl text-xs shadow-xl shadow-emerald-950/50 transition-all flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span>
                    <span>Generating AI...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Auto Generate Topik & Demand AI (1-Click)</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleCopyPrompt}
              className="w-full py-2 bg-gray-950 hover:bg-gray-800 text-gray-400 hover:text-gray-200 text-[11px] font-semibold rounded-xl border border-gray-800/80 transition-all flex items-center justify-center gap-1.5"
            >
              <span>📋</span>
              <span>Salin Prompt (Manual Copy/Paste)</span>
            </button>
          </div>
        </div>

        {/* Right Column: AI Output Import & Topics Display */}
        <div className="md:col-span-2 space-y-6">
          {/* Import / Paste AI Output Box */}
          <div className="bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="p-1 bg-emerald-950 text-emerald-400 rounded-lg text-xs">📥</span>
                Hasil Respon AI (Auto / Manual Paste)
              </h2>
              <div className="flex items-center gap-2">
                {isGenerating && (
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 font-bold animate-pulse flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>🔴 Streaming Response Live... ({pastedOutput.length} char)</span>
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
                    {validationReport.isValid ? '✓ Strict JSON Valid' : `⚠️ ${validationReport.summaryText}`}
                  </span>
                )}
                {topics.length > 0 && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-800 font-bold">
                    {topics.length} Ide Tersimpan
                  </span>
                )}
              </div>
            </div>

            <textarea
              value={pastedOutput}
              onChange={(e) => setPastedOutput(e.target.value)}
              rows={5}
              placeholder='Teks/JSON hasil dari AI akan otomatis terisi di sini, atau Anda bisa menempel (paste) hasil manual di sini...'
              className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-3.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500 transition-all placeholder-gray-600 leading-relaxed font-mono"
            />

            {/* Validation Issues Display if any */}
            {validationReport && validationReport.issues.length > 0 && (
              <div className="p-3 bg-gray-950 border border-gray-800 rounded-xl space-y-1.5 text-[11px] font-mono">
                <span className="text-gray-400 font-bold block">Strict JSON Audit Logs:</span>
                {validationReport.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-1.5 ${
                      issue.severity === 'error' ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    <span>{issue.severity === 'error' ? '❌' : '⚠️'}</span>
                    <span>
                      [{issue.field}]: {issue.message}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleProcessOutput}
                disabled={!pastedOutput.trim()}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-1.5"
              >
                <span>⚡</span>
                <span>Validasi Strict JSON & Simpan</span>
              </button>
            </div>
          </div>

          {/* Generated Topic Cards Display & Batch Queue controls */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 bg-gray-900/40 p-3 rounded-2xl border border-gray-800">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                  Daftar Ide Topik ({topics.length})
                </h3>
                {selectedTopicIds.length > 0 && (
                  <span className="text-xs text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-800 font-bold flex items-center gap-1">
                    <span>🚀</span> Batch Queue: {selectedTopicIds.length} Terpilih
                  </span>
                )}
              </div>

              {/* Batch Quick Action Controls */}
              {topics.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleSelectTop3}
                    title="Otomatis pilih 3 ide topik dengan skor viral tertinggi"
                    className="px-2.5 py-1 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 shadow-sm"
                  >
                    <span>⚡</span>
                    <span>Pilih Top 3 (High Potential)</span>
                  </button>

                  <button
                    onClick={handleSelectAll}
                    className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1"
                  >
                    <span>🔘</span>
                    <span>Pilih Semua</span>
                  </button>

                  {selectedTopicIds.length > 0 && (
                    <button
                      onClick={handleClearSelection}
                      className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 rounded-xl text-xs font-semibold transition-all flex items-center gap-1"
                    >
                      <span>🧹</span>
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {topics.length === 0 ? (
              <div className="bg-gray-950 border border-dashed border-gray-800 rounded-3xl p-10 text-center space-y-3">
                <div className="w-14 h-14 bg-emerald-600/10 text-emerald-400 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-emerald-500/20">
                  💡
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Belum Ada Ide Topik</h4>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Klik <strong>"Auto Generate AI"</strong> untuk buat ide topik langsung, atau salin prompt dan tempel hasil manual di atas.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {topics.map((topic) => {
                  const isSelected = selectedTopicIds.includes(topic.id);
                  return (
                    <div
                      key={topic.id}
                      onClick={() => handleToggleTopic(topic.id)}
                      className={`p-4 rounded-2xl border transition-all duration-200 relative group cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                          : 'bg-gray-900/90 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Checkbox Icon */}
                          <div className="pt-0.5 shrink-0">
                            <div
                              className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                                isSelected
                                  ? 'bg-emerald-500 border-emerald-400 text-gray-950 font-bold'
                                  : 'bg-gray-950 border-gray-700 group-hover:border-emerald-500/50'
                              }`}
                            >
                              {isSelected && <span className="text-xs">✓</span>}
                            </div>
                          </div>

                          <div className="space-y-2.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="w-6 h-6 rounded-lg bg-gray-950 border border-gray-800 text-emerald-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                                #{topic.id}
                              </span>
                              <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors leading-snug">
                                "{topic.title}"
                              </h4>

                              {/* Viral Rating Score Badge */}
                              {topic.viral_score && (
                                <span
                                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shadow-sm flex items-center gap-1 ${
                                    topic.viral_score >= 92
                                      ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/80 shadow-emerald-950/40'
                                      : topic.viral_score >= 85
                                      ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/80'
                                      : 'bg-gray-800 text-gray-300 border-gray-700'
                                  }`}
                                >
                                  <span>🔥</span>
                                  <span>{topic.viral_score}/100 Potential</span>
                                </span>
                              )}
                            </div>



                            {/* Ruthless Critique (Anti Yes-Man AI) */}
                            {topic.ruthless_critique && (
                              <div className="pl-8 pt-1" onClick={(e) => e.stopPropagation()}>
                                <div className="p-3 bg-red-950/30 border border-red-800/60 rounded-xl space-y-1 text-xs">
                                  <div className="flex items-center gap-1.5 text-red-400 font-bold text-[11px] uppercase tracking-wider">
                                    <span>💥</span>
                                    <span>Bedah Kritis AI (Anti Yes-Man Analysis):</span>
                                  </div>
                                  <p className="text-red-200/90 leading-relaxed text-[11px]">
                                    {topic.ruthless_critique}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Search Keyphrases (Riset Autocomplete YouTube) */}
                            {topic.search_keyphrases && topic.search_keyphrases.length > 0 && (
                              <div className="pl-8 pt-1 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                                    <span>🔍</span>
                                    <span>Kata Kunci Autocomplete (Cek Demand YouTube):</span>
                                  </span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(topic.search_keyphrases?.join('\n') || '');
                                      showToast('📋 Kata kunci riset disalin!');
                                    }}
                                    className="text-[10px] text-emerald-300 hover:text-white underline font-mono"
                                  >
                                    Copy Kueri
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {topic.search_keyphrases.map((kp, kIdx) => (
                                    <span
                                      key={kIdx}
                                      className="px-2 py-0.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-[10px] font-mono"
                                    >
                                      "{kp}"
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Outlier Search Guide */}
                            {topic.outlier_search_guide && (
                              <div className="pl-8 pt-0.5" onClick={(e) => e.stopPropagation()}>
                                <div className="p-2.5 bg-gray-950 border border-gray-800 rounded-xl text-[11px] text-gray-300 space-y-1">
                                  <span className="font-bold text-emerald-400 block text-[10px] uppercase font-mono">
                                    🎯 Panduan Outlier Channel Kecil (Filter: Upload Date → This Week):
                                  </span>
                                  <p className="text-gray-400 leading-normal">{topic.outlier_search_guide}</p>
                                </div>
                              </div>
                            )}

                            {topic.summary && (
                              <p className="text-xs text-gray-400 leading-relaxed pl-8">
                                <strong className="text-gray-500 font-mono">Ringkasan Faktual:</strong> {topic.summary}
                              </p>
                            )}

                            {topic.viral_reason && (
                              <div className="pl-8 pt-0.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-950 border border-gray-800 text-[11px] text-emerald-400/90">
                                  <span>💡</span>
                                  <span><strong className="text-gray-400">Viral Reason:</strong> {topic.viral_reason}</span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleCopySingleTopic(topic)}
                            title="Salin ide topik ini"
                            className="p-2 bg-gray-950 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl text-xs border border-gray-800 transition-all"
                          >
                            📋
                          </button>

                          <button
                            onClick={() => handleToggleTopic(topic.id)}
                            title={isSelected ? 'Keluarkan dari Batch' : 'Tambahkan ke Batch Queue'}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 ${
                              isSelected
                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/30'
                                : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                          >
                            <span>{isSelected ? '✓ Terpilih di Batch' : '+ Pilih Batch'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sticky Batch Queue Control Bar */}
          {selectedTopicIds.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-emerald-950 via-gray-900 to-gray-950 rounded-2xl border border-emerald-500/50 shadow-2xl space-y-3 animate-in slide-in-from-bottom-4 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-gray-950 font-bold font-mono text-[10px] uppercase">
                      Batch Queue Ready
                    </span>
                    <h4 className="text-xs font-bold text-white">
                      {selectedTopicIds.length} Ide Topik Siap Diproses dalam Batch
                    </h4>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Semua topik terpilih tersimpan di <code className="text-emerald-300 font-mono">input/spensia/topics.json</code>.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleClearSelection}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition-all"
                  >
                    Kosongkan Batch
                  </button>
                </div>
              </div>

              {/* Selected Topics Chips */}
              <div className="flex flex-wrap gap-2 pt-1 border-t border-emerald-900/60">
                {topics
                  .filter((t) => selectedTopicIds.includes(t.id))
                  .map((t) => (
                    <span
                      key={t.id}
                      className="px-2.5 py-1 rounded-xl bg-gray-950 border border-emerald-800/80 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                    >
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">#{t.id}</span>
                      <span className="truncate max-w-[200px]">"{t.title}"</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTopic(t.id);
                        }}
                        className="text-gray-500 hover:text-red-400 ml-1 font-bold"
                        title="Keluarkan topik ini"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpensiaTopicsStep;
