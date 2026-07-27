// dashboard/src/components/spensia/SpensiaScriptStep.tsx
import React, { useState, useEffect } from 'react';
import { validateSpensiaScript, SpensiaScriptData, SpensiaScriptValidationReport } from '../../utils/spensiaValidation';

const api = window.electronAPI;

const MODEL_OPTIONS = [
  { id: 'cx/gpt-5.5', name: 'cx/gpt-5.5 (Default)' },
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

const SpensiaScriptStep: React.FC = () => {
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [topicSummary, setTopicSummary] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<string>('10 menit');
  const [targetWords, setTargetWords] = useState<number>(1500);

  const [selectedModel, setSelectedModel] = useState<string>('cx/gpt-5.5');
  const [masterPrompt, setMasterPrompt] = useState<string>('');
  const [showPromptEditor, setShowPromptEditor] = useState<boolean>(false);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [pastedOutput, setPastedOutput] = useState<string>('');
  const [scriptData, setScriptData] = useState<SpensiaScriptData | null>(null);
  const [activeTab, setActiveTab] = useState<'full' | 'sections' | 'json'>('full');

  const [toast, setToast] = useState<string | null>(null);
  const [validationReport, setValidationReport] = useState<SpensiaScriptValidationReport | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadPromptFromFile = async () => {
    try {
      if (api?.readFromProject) {
        const loadedPrompt = await api.readFromProject('dashboard/prompts/spensia/script-prompt.md');
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

  // Load initial prompt, topic state, and saved script state on mount
  useEffect(() => {
    (async () => {
      await loadPromptFromFile();
      try {
        if (api?.readFromProject) {
          // 1. Load selected topic from Step 1
          const savedTopicsJson = await api.readFromProject('input/spensia/topics.json');
          if (savedTopicsJson) {
            const topicState = JSON.parse(savedTopicsJson);
            if (Array.isArray(topicState.topics) && topicState.selectedTopicId) {
              const matched = topicState.topics.find((t: any) => t.id === topicState.selectedTopicId);
              if (matched) {
                setVideoTitle(matched.title || '');
                setTopicSummary(matched.summary || '');
              }
            }
          }

          // 2. Load saved script if exists
          const savedScriptJson = await api.readFromProject('input/spensia/script.json');
          if (savedScriptJson) {
            setPastedOutput(savedScriptJson);
            const report = validateSpensiaScript(savedScriptJson);
            setValidationReport(report);
            if (report.normalizedData) {
              setScriptData(report.normalizedData);
              if (report.normalizedData.video_title) setVideoTitle(report.normalizedData.video_title);
              if (report.normalizedData.target_duration) setSelectedDuration(report.normalizedData.target_duration);
            }
          }
        }
      } catch (err) {
        console.error('Error initializing Spensia script step:', err);
      }
    })();
  }, []);

  const handleDurationChange = (dur: string, words: number) => {
    setSelectedDuration(dur);
    setTargetWords(words);
  };

  const getComputedPrompt = (promptTplStr?: string) => {
    const tpl = promptTplStr || masterPrompt;
    return tpl
      .replace(/{judul}/g, videoTitle || '[Judul Video]')
      .replace(/{ringkasan}/g, topicSummary || '[Ringkasan Topik]')
      .replace(/{durasi}/g, selectedDuration)
      .replace(/{word_count}/g, String(targetWords));
  };

  // 🤖 Auto Generate Script Handler via AI with Realtime SSE Streaming
  const handleAutoGenerate = async () => {
    if (!videoTitle.trim()) {
      showToast('⚠️ Mohon isi judul video terlebih dahulu!');
      return;
    }

    setIsGenerating(true);
    setPastedOutput('');
    setActiveTab('json'); // Switch to json tab to see live streaming text
    let unsubscribeStream: (() => void) | null = null;

    try {
      let currentPrompt = masterPrompt;
      if (!currentPrompt) {
        currentPrompt = await loadPromptFromFile();
      }

      const computed = getComputedPrompt(currentPrompt);

      if (!api?.generateSpensiaScript) {
        throw new Error('API generateSpensiaScript tidak tersedia pada Electron preload.');
      }

      if (api?.onSpensiaScriptChunk) {
        unsubscribeStream = api.onSpensiaScriptChunk(({ fullText }) => {
          setPastedOutput(fullText);
        });
      }

      const res = await api.generateSpensiaScript(computed, selectedModel);
      const rawContent = res?.rawText || JSON.stringify(res);
      setPastedOutput(rawContent);

      const report = validateSpensiaScript(rawContent);
      setValidationReport(report);

      if (report.normalizedData) {
        setScriptData(report.normalizedData);
        saveScriptState(report.normalizedData, rawContent);
        setActiveTab('full');
        showToast(`✨ Naskah Spensia berhasil dibuat (${report.normalizedData.actual_word_count} Kata)!`);
      } else {
        showToast(`⚠️ Validasi JSON Gagal: ${report.summaryText}`);
      }
    } catch (err: any) {
      showToast(`❌ Gagal me-generate naskah: ${err?.message || err}`);
    } finally {
      if (unsubscribeStream) unsubscribeStream();
      setIsGenerating(false);
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
        await api.saveToProject('dashboard/prompts/spensia/script-prompt.md', masterPrompt);
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

    const report = validateSpensiaScript(pastedOutput);
    setValidationReport(report);

    if (report.normalizedData) {
      setScriptData(report.normalizedData);
      saveScriptState(report.normalizedData, pastedOutput);
      showToast(`✅ Validasi Strict JSON Naskah Berhasil (${report.normalizedData.actual_word_count} Kata)!`);
    } else {
      showToast(`⚠️ Validasi Gagal: ${report.summaryText}`);
    }
  };

  const saveScriptState = async (data: SpensiaScriptData, rawStr: string) => {
    try {
      if (api?.saveToProject) {
        await api.saveToProject('input/spensia/script.json', rawStr);
        await api.saveToProject('input/spensia/full_script.txt', data.full_script);
      }
    } catch (err) {
      console.error('Error saving script state:', err);
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
      <div className="bg-gradient-to-r from-purple-950/80 via-gray-900 to-gray-950 p-6 rounded-3xl border border-purple-800/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                ✨ Spensia AI Workflow — Step 2
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>⚡</span> Script Generator (Spensia)
            </h1>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              Generate naskah voiceover edukasi kontraintuitif dengan ritme kalimat tajam & Style DNA Spensia siap pakai.
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
              className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-purple-300 rounded-xl text-xs font-semibold border border-purple-800/80 transition-all flex items-center gap-1.5"
            >
              <span>📋</span>
              <span>Salin Prompt</span>
            </button>

            <button
              onClick={handleAutoGenerate}
              disabled={isGenerating}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Generating Script...</span>
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

      {/* Collapsible Master Prompt Editor */}
      {showPromptEditor && (
        <div className="bg-gray-900/90 p-5 rounded-3xl border border-purple-800/40 shadow-xl space-y-3 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
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
                className="px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-[11px] font-bold transition-all"
              >
                Simpan Prompt
              </button>
            </div>
          </div>

          <textarea
            value={masterPrompt}
            onChange={(e) => setMasterPrompt(e.target.value)}
            rows={12}
            className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs font-mono text-gray-300 focus:outline-none focus:border-purple-500/80 leading-relaxed resize-y"
            placeholder="Loading prompt from script-prompt.md..."
          />
        </div>
      )}

      {/* Main Grid: Parameters & Output Views */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Input Parameter Form */}
        <div className="md:col-span-1 bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-xl space-y-5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <span className="p-1 bg-purple-950 text-purple-400 rounded-lg text-xs">✍️</span>
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
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all font-semibold"
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
              className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all leading-relaxed"
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
                      ? 'bg-purple-950 border-purple-600 text-purple-300 shadow-md'
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
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-purple-300 focus:outline-none focus:border-purple-500 font-mono font-semibold"
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
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl text-xs shadow-xl shadow-purple-950/50 transition-all flex items-center justify-center gap-2"
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
                <span className="p-1 bg-purple-950 text-purple-400 rounded-lg text-xs">🎬</span>
                <h2 className="text-sm font-bold text-white">Naskah Spensia</h2>
                {scriptData && (
                  <span className="text-[11px] font-mono text-purple-300 bg-purple-950 px-2.5 py-0.5 rounded-full border border-purple-800 font-bold">
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
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  📜 Naskah Lengkap
                </button>

                <button
                  onClick={() => setActiveTab('sections')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'sections'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🧩 DNA Segmen
                </button>

                <button
                  onClick={() => setActiveTab('json')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'json'
                      ? 'bg-purple-600 text-white shadow-md'
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
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-purple-950/90 text-purple-300 border border-purple-700/80 font-bold animate-pulse flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
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
                    className="px-3 py-1 bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
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
                    <div className="w-14 h-14 bg-purple-600/10 text-purple-400 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-purple-500/20">
                      ⚡
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Naskah Belum Di-generate</h4>
                      <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        Klik <strong>"Auto Generate Naskah"</strong> untuk membuat naskah voiceover lengkap berdasarkan topik Spensia.
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
                      <div className="p-4 bg-purple-950/30 border border-purple-800/60 rounded-2xl space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-700 text-[10px] font-mono font-bold rounded-md uppercase">
                            🎣 HOOK STYLE
                          </span>
                        </div>

                        {scriptData.hook.imaginative_scenario && (
                          <p className="text-xs text-gray-300">
                            <strong className="text-purple-400">Skenario Imajinatif:</strong> {scriptData.hook.imaginative_scenario}
                          </p>
                        )}
                        {scriptData.hook.surprising_detail && (
                          <p className="text-xs text-gray-300">
                            <strong className="text-purple-400">Detail Mengejutkan:</strong> {scriptData.hook.surprising_detail}
                          </p>
                        )}
                        {scriptData.hook.philosophical_closing && (
                          <p className="text-xs text-gray-300 italic border-l-2 border-purple-500 pl-2">
                            <strong className="text-purple-300">Penutup Reflektif:</strong> "{scriptData.hook.philosophical_closing}"
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
                                <span className="w-5 h-5 bg-purple-950 border border-purple-800 text-purple-300 rounded-lg text-[10px] flex items-center justify-center font-mono">
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
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs font-mono text-gray-300 focus:outline-none focus:border-purple-500 transition-all leading-relaxed"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleProcessOutput}
                    disabled={!pastedOutput.trim()}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
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

export default SpensiaScriptStep;
