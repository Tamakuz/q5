// dashboard/src/components/spensia/SpensiaTopicsStep.tsx
import React, { useState, useEffect } from 'react';
import { validateSpensiaTopics, SpensiaTopicsValidationReport } from '../../utils/spensiaValidation';

const api = window.electronAPI;

export interface TopicItem {
  id: number;
  title: string;
  summary: string;
  viral_score?: number;
  viral_reason?: string;
  selected?: boolean;
}

const PRESET_THEMES = [
  { label: '🏛️ Sejarah Kuno', value: 'Sejarah Kuno' },
  { label: '🧠 Psikologi Manusia', value: 'Psikologi Manusia' },
  { label: '🧬 Evolusi & Sains', value: 'Evolusi & Sains' },
  { label: '💰 Sejarah Kekayaan', value: 'Sejarah Kekayaan' },
  { label: '🍞 Kehidupan Sehari-hari', value: 'Kehidupan Sehari-hari' },
];

const MODEL_OPTIONS = [
  { id: 'cx/gpt-5.5', name: 'cx/gpt-5.5 (Default)' },
  { id: 'cmc/deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

const SpensiaTopicsStep: React.FC = () => {
  const [topicTheme, setTopicTheme] = useState<string>('Sejarah Kuno');
  const [itemCount, setItemCount] = useState<number>(5);
  const [masterPrompt, setMasterPrompt] = useState<string>('');
  const [showPromptEditor, setShowPromptEditor] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('cx/gpt-5.5');

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [pastedOutput, setPastedOutput] = useState<string>('');
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
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
            if (data.selectedTopicId) setSelectedTopicId(data.selectedTopicId);
          }
        }
      } catch (err) {
        console.error('Error loading Spensia topics state:', err);
      }
    })();
  }, []);

  const getComputedPrompt = (promptTextStr?: string) => {
    const tpl = promptTextStr || masterPrompt;
    return tpl
      .replace(/{topik_umum}/g, topicTheme || '[Topik Umum]')
      .replace(/{topik umum, misal: "sejarah kekayaan", "psikologi manusia", "evolusi manusia purba"}/g, topicTheme || '[Topik Umum]')
      .replace(/{jumlah}/g, String(itemCount));
  };

  // 🤖 Automated Generation Handler via 9router API with Strict Validation
  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    try {
      let currentPrompt = masterPrompt;
      if (!currentPrompt) {
        currentPrompt = await loadPromptFromFile();
      }

      const computed = getComputedPrompt(currentPrompt);

      if (!api?.generateSpensiaTopics) {
        throw new Error('API generateSpensiaTopics tidak tersedia pada Electron preload.');
      }

      const res = await api.generateSpensiaTopics(computed, selectedModel);
      const rawContent = res?.rawText || JSON.stringify(res);
      setPastedOutput(rawContent);

      // Perform Strict JSON Validation
      const report = validateSpensiaTopics(rawContent);
      setValidationReport(report);

      if (report.normalizedData && report.normalizedData.topics.length > 0) {
        setTopics(report.normalizedData.topics);
        saveTopicsState(report.normalizedData.topics, topicTheme, selectedTopicId);
        showToast(`✨ Strict JSON Valid: ${report.normalizedData.topics.length} ide topik berhasil di-generate!`);
      } else {
        showToast(`⚠️ Validasi JSON Gagal: ${report.summaryText}`);
      }
    } catch (err: any) {
      console.error('Auto generate error:', err);
      showToast(`❌ Gagal me-generate topik: ${err?.message || err}`);
    } finally {
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
      saveTopicsState(report.normalizedData.topics, topicTheme, selectedTopicId);
      showToast(`✅ Validasi Strict JSON Berhasil (${report.normalizedData.topics.length} topik)!`);
    } else {
      showToast(`⚠️ Validasi Gagal: ${report.summaryText}`);
    }
  };

  const saveTopicsState = async (topicsList: TopicItem[], themeStr: string, activeId: number | null) => {
    try {
      if (api?.saveToProject) {
        await api.saveToProject(
          'input/spensia/topics.json',
          JSON.stringify({ topics: topicsList, theme: themeStr, selectedTopicId: activeId, updatedAt: new Date().toISOString() }, null, 2)
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectTopic = (id: number) => {
    const nextId = selectedTopicId === id ? null : id;
    setSelectedTopicId(nextId);
    saveTopicsState(topics, topicTheme, nextId);
    if (nextId !== null) {
      showToast(`🎯 Topik #${id} dipilih untuk naskah Spensia!`);
    }
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
              onClick={handleAutoGenerate}
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

          {/* Topik Umum / Tema Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-300 block">
              Topik Umum / Tema:
            </label>
            <input
              type="text"
              value={topicTheme}
              onChange={(e) => setTopicTheme(e.target.value)}
              placeholder='Contoh: "sejarah kekayaan", "psikologi manusia"'
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-all font-semibold"
            />

            {/* Quick Preset Badges */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] text-gray-500 font-mono block">Rekomendasi Tema:</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_THEMES.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setTopicTheme(preset.value)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                      topicTheme === preset.value
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
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

          {/* Dual Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              onClick={handleAutoGenerate}
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
                  <span>Auto Generate AI (1-Click)</span>
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
                {validationReport && (
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
                      issue.severity === 'error' ? 'text-red-400' : 'text-amber-400'
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

          {/* Generated Topic Cards Display */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Daftar Ide Topik ({topics.length})
              </h3>
              {selectedTopicId && (
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <span>🎯</span> Topik #{selectedTopicId} Terpilih
                </span>
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
                  const isSelected = selectedTopicId === topic.id;
                  return (
                    <div
                      key={topic.id}
                      className={`p-4 rounded-2xl border transition-all duration-200 relative group ${
                        isSelected
                          ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                          : 'bg-gray-900/90 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2 flex-1 min-w-0">
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
                                    ? 'bg-amber-950/90 text-amber-300 border-amber-700/80'
                                    : 'bg-gray-800 text-gray-300 border-gray-700'
                                }`}
                              >
                                <span>🔥</span>
                                <span>{topic.viral_score}/100 Potential</span>
                              </span>
                            )}
                          </div>

                          {topic.summary && (
                            <p className="text-xs text-gray-400 leading-relaxed pl-8">
                              <strong className="text-gray-500 font-mono">Ringkasan:</strong> {topic.summary}
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

                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                          <button
                            onClick={() => handleCopySingleTopic(topic)}
                            title="Salin ide topik ini"
                            className="p-2 bg-gray-950 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl text-xs border border-gray-800 transition-all"
                          >
                            📋
                          </button>

                          <button
                            onClick={() => handleSelectTopic(topic.id)}
                            title={isSelected ? 'Batalkan pilihan' : 'Pilih topik ini untuk naskah Spensia'}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 ${
                              isSelected
                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/30'
                                : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                          >
                            <span>{isSelected ? '✓ Terpilih' : '🎯 Pilih'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpensiaTopicsStep;
