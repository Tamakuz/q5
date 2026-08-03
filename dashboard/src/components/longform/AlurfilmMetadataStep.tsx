// dashboard/src/components/longform/AlurfilmMetadataStep.tsx
import React, { useState, useEffect } from 'react';
import type { AlurfilmMetadataResult, AlurfilmMetadataTitle } from '../../electron-api';

const MODEL_OPTIONS = [
  { id: 'ag/gemini-3-flash-agent', name: 'ag/gemini-3-flash-agent (9router Recommended)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

const AlurfilmMetadataStep: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState<string>('ag/gemini-3-flash-agent');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [streamProgressText, setStreamProgressText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [metadata, setMetadata] = useState<AlurfilmMetadataResult | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>('');
  const [selectedYellowText, setSelectedYellowText] = useState<string>('');
  const [selectedRedText, setSelectedRedText] = useState<string>('');
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [selectedNotes, setSelectedNotes] = useState<string>('');

  const [editedDescription, setEditedDescription] = useState<string>('');
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Load existing metadata on mount
  useEffect(() => {
    (async () => {
      try {
        if (window.electronAPI?.getAlurfilmMetadata) {
          const saved = await window.electronAPI.getAlurfilmMetadata();
          if (saved) {
            setMetadata(saved);
            const first = saved.titles?.[0];
            setSelectedTitle(saved.selectedTitle || first?.title || '');
            setSelectedYellowText(first?.thumbnail_text_yellow || 'TAK BISA');
            setSelectedRedText(first?.thumbnail_text_red || 'KABUR');
            setSelectedPrompt(saved.selectedThumbnailPrompt || first?.thumbnail_prompt || '');
            setSelectedNotes(first?.thumbnail_composition_notes || '');
            setEditedDescription(saved.description || '');
            setEditedTags(saved.tags || []);
          }
        }
      } catch (err: any) {
        console.error('Error loading metadata:', err);
      }
    })();
  }, []);

  // Subscribe to streaming chunk updates
  useEffect(() => {
    if (window.electronAPI?.onAlurfilmMetadataChunk) {
      const cleanup = window.electronAPI.onAlurfilmMetadataChunk(({ chunk, fullText }) => {
        setStreamProgressText(fullText || chunk);
      });
      return cleanup;
    }
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setStreamProgressText('Menghubungkan ke 9router AI API...');

    try {
      if (!window.electronAPI?.generateAlurfilmMetadata) {
        throw new Error('Electron API generateAlurfilmMetadata tidak tersedia.');
      }

      const result = await window.electronAPI.generateAlurfilmMetadata({
        model: selectedModel,
        customNotes,
      });

      setMetadata(result);
      const first = result.titles?.[0];
      setSelectedTitle(first?.title || '');
      setSelectedYellowText(first?.thumbnail_text_yellow || 'TAK BISA');
      setSelectedRedText(first?.thumbnail_text_red || 'KABUR');
      setSelectedPrompt(first?.thumbnail_prompt || '');
      setSelectedNotes(first?.thumbnail_composition_notes || '');
      setEditedDescription(result.description || '');
      setEditedTags(result.tags || []);

      showToast('✨ AI Metadata & Thumbnail Prompt berhasil di-generate!');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Gagal menghasilkan AI Metadata.');
    } finally {
      setIsGenerating(false);
      setStreamProgressText('');
    }
  };

  const handleSave = async (
    titleToSave = selectedTitle,
    yellowText = selectedYellowText,
    redText = selectedRedText,
    promptToSave = selectedPrompt,
    descToSave = editedDescription,
    tagsToSave = editedTags
  ) => {
    if (!metadata) return;

    try {
      const updated: AlurfilmMetadataResult = {
        ...metadata,
        selectedTitle: titleToSave,
        selectedThumbnailText: `${yellowText} ${redText}`.trim(),
        selectedThumbnailPrompt: promptToSave,
        description: descToSave,
        tags: tagsToSave,
      };

      if (window.electronAPI?.saveAlurfilmMetadata) {
        await window.electronAPI.saveAlurfilmMetadata({ metadata: updated });
        setMetadata(updated);
        showToast('💾 Metadata berhasil disimpan.');
      }
    } catch (err: any) {
      setErrorMessage('Gagal menyimpan metadata: ' + err.message);
    }
  };

  const handleSelectTitleCard = (item: AlurfilmMetadataTitle) => {
    const yellow = item.thumbnail_text_yellow || item.thumbnail_text?.split(' ')[0] || 'TAK BISA';
    const red = item.thumbnail_text_red || item.thumbnail_text?.split(' ').slice(1).join(' ') || 'KABUR';
    const prompt = item.thumbnail_prompt || '';
    const notes = item.thumbnail_composition_notes || '';

    setSelectedTitle(item.title);
    setSelectedYellowText(yellow);
    setSelectedRedText(red);
    setSelectedPrompt(prompt);
    setSelectedNotes(notes);

    handleSave(item.title, yellow, red, prompt, editedDescription, editedTags);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (window.electronAPI?.copyToClipboard) {
        await window.electronAPI.copyToClipboard(text);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopiedField(label);
      showToast(`📋 Copied ${label} to clipboard!`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs border border-emerald-400 animate-bounce">
          <span>✨</span> {successToast}
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-gray-900 to-indigo-950 p-6 rounded-3xl border border-purple-800/40 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/60 text-[11px] font-mono font-bold uppercase tracking-wider">
              Step 7 • Metadata & Thumbnail Studio
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800 text-[10px] font-mono font-bold">
              Formula CTR & Visual 2-Warna
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            🚀 Video Metadata & AI Thumbnail Prompt Studio
          </h1>
          <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
            Generate 5 variasi judul CTR Formula (<span className="text-purple-300 font-mono">[Tindakan] + [Status] + [Konflik] — Alur Cerita Film</span>), rekomendasi <strong className="text-amber-300">Teks Thumbnail 2-Warna (Kuning + Merah)</strong>, dan <strong className="text-cyan-300">Prompt Gambar AI (Skala Kontras Raksasa vs Manusia Kecil)</strong>.
          </p>
        </div>

        {/* Model Selection & Action */}
        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isGenerating}
            className="bg-gray-950 text-gray-200 text-xs border border-gray-800 rounded-xl px-3 py-2.5 font-mono focus:outline-none focus:border-purple-500 transition-all"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 ${
              isGenerating
                ? 'bg-purple-900/50 text-purple-300 cursor-not-allowed border border-purple-700/40'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30 border border-purple-400/30 active:scale-95'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
                <span>Generating Metadata...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Generate AI Metadata & Prompts</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="p-4 bg-rose-950/80 border border-rose-800 text-rose-200 rounded-2xl text-xs flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 font-bold text-xs"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Stream Loading Status Box */}
      {isGenerating && streamProgressText && (
        <div className="p-5 bg-gray-900 border border-purple-800/40 rounded-3xl space-y-2 shadow-xl animate-pulse">
          <div className="flex items-center justify-between text-xs font-mono text-purple-400">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              Menganalisis Naskah & Merancang Visual Thumbnail via 9router...
            </span>
            <span className="text-[10px] text-gray-500">ag/gemini-3-flash-agent</span>
          </div>
          <div className="bg-gray-950 p-4 rounded-xl text-xs text-gray-400 font-mono max-h-40 overflow-auto whitespace-pre-wrap border border-gray-800/80">
            {streamProgressText}
          </div>
        </div>
      )}

      {/* Custom Notes Input */}
      <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-4 space-y-2">
        <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
          <span>💡 Catatan Khusus untuk AI Metadata & Thumbnail (Opsional)</span>
          <span className="text-[10px] font-normal text-gray-500">
            Misal: "Fokus visual pada raksasa es beku atau labirin emas"
          </span>
        </label>
        <input
          type="text"
          value={customNotes}
          onChange={(e) => setCustomNotes(e.target.value)}
          placeholder="Tuliskan petunjuk visual khusus atau kata kunci adegan yang ingin ditonjolkan..."
          disabled={isGenerating}
          className="w-full bg-gray-950 text-gray-200 border border-gray-800 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Main Results Display */}
      {metadata && metadata.titles && metadata.titles.length > 0 && (
        <div className="space-y-8">
          {/* Selected Active Title & 2-Color Thumbnail Preview */}
          {selectedTitle && (
            <div className="bg-gradient-to-r from-emerald-950/80 via-gray-900 to-gray-950 p-6 rounded-3xl border border-emerald-500/40 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 text-[10px] font-bold font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <span>✅</span> Judul & Konsep Thumbnail Aktif
                </span>
                <button
                  onClick={() => copyToClipboard(selectedTitle, 'Judul Utama')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-95"
                >
                  <span>{copiedField === 'Judul Utama' ? '✓ Copied' : '📋 Copy Judul'}</span>
                </button>
              </div>

              <h2 className="text-lg font-black text-white leading-snug">{selectedTitle}</h2>

              {/* 2-Color Thumbnail Text Box (Visual Style Match YouTube Viral) */}
              <div className="bg-gray-950/90 p-4 rounded-2xl border border-emerald-900/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <span>🖼️</span> Rekomendasi Teks Thumbnail 2-Warna (Viral Youtube Style):
                  </span>
                  <button
                    onClick={() => copyToClipboard(`${selectedYellowText} ${selectedRedText}`, 'Teks Thumbnail')}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-bold"
                  >
                    Copy Both Words
                  </button>
                </div>

                <div className="flex items-center justify-center p-4 bg-gradient-to-r from-gray-900 via-black to-gray-900 rounded-xl border border-gray-800 shadow-inner">
                  <div className="text-xl sm:text-2xl md:text-3xl font-black font-sans uppercase tracking-tight flex items-center gap-3 drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                    <span className="text-yellow-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {selectedYellowText || 'TAK BISA'}
                    </span>
                    <span className="text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.7)] stroke-black">
                      {selectedRedText || 'KABUR'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Prompt Generator AI & Composition Guide */}
              {selectedPrompt && (
                <div className="bg-gray-950 p-4 rounded-2xl border border-cyan-900/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                      <span>🎨</span> AI Image Prompt (Midjourney / Flux / DALL-E / Google Flow):
                    </span>
                    <button
                      onClick={() => copyToClipboard(selectedPrompt, 'AI Prompt Gambar')}
                      className="px-2.5 py-1 rounded-lg bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 text-[11px] font-bold transition-all border border-cyan-700/60 flex items-center gap-1"
                    >
                      <span>📋</span> Copy AI Prompt
                    </button>
                  </div>

                  <p className="text-xs text-gray-300 font-mono bg-gray-900 p-3 rounded-xl border border-gray-800 leading-relaxed select-all">
                    {selectedPrompt}
                  </p>

                  {selectedNotes && (
                    <div className="pt-2 text-[11px] text-gray-400 flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold">💡 Tips Kontras & Skala:</span>
                      <span className="leading-relaxed">{selectedNotes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 5 Title Emotion Options & Thumbnail Ideas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🎯</span> 5 Opsi Judul & Visual Thumbnail (CTR Formula)
              </h3>
              <span className="text-[11px] text-gray-400">Klik kartu untuk memilih judul & konsep thumbnail aktif</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {metadata.titles.map((item) => {
                const isSelected = selectedTitle === item.title;
                const yellowText = item.thumbnail_text_yellow || item.thumbnail_text?.split(' ')[0] || 'TAK BISA';
                const redText = item.thumbnail_text_red || item.thumbnail_text?.split(' ').slice(1).join(' ') || 'KABUR';

                const emotionBadgeColor =
                  item.emotion_category === 'balas_dendam'
                    ? 'bg-rose-950 text-rose-300 border-rose-800'
                    : item.emotion_category === 'underdog'
                    ? 'bg-sky-950 text-sky-300 border-sky-800'
                    : item.emotion_category === 'aksi_nekat'
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : item.emotion_category === 'kaget'
                    ? 'bg-purple-950 text-purple-300 border-purple-800'
                    : 'bg-indigo-950 text-indigo-300 border-indigo-800';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectTitleCard(item)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                      isSelected
                        ? 'bg-gray-900 border-purple-500 shadow-xl shadow-purple-950/40 ring-1 ring-purple-500'
                        : 'bg-gray-950/80 border-gray-800 hover:border-gray-700 hover:bg-gray-900/60'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border font-mono ${emotionBadgeColor}`}>
                            {item.emotion_label || item.emotion_category}
                          </span>
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                              Selected Active
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-gray-100 leading-snug">{item.title}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(item.title, `Judul (${item.emotion_category})`);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold transition-all border border-gray-700"
                        >
                          📋 Copy
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectTitleCard(item);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-900 hover:bg-purple-900/40 text-purple-300 border border-purple-800/60'
                          }`}
                        >
                          {isSelected ? '✓ Active' : 'Pilih Konsep Ini'}
                        </button>
                      </div>
                    </div>

                    {/* Thumbnail 2-Color Preview Pill */}
                    <div className="pt-2 border-t border-gray-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div className="flex items-center gap-2 text-xs bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                        <span className="text-gray-400 font-bold shrink-0">🖼️ Text:</span>
                        <div className="font-black text-sm uppercase flex items-center gap-1.5">
                          <span className="text-yellow-400">{yellowText}</span>
                          <span className="text-red-500">{redText}</span>
                        </div>
                      </div>

                      {item.thumbnail_prompt && (
                        <div className="flex items-center justify-between text-xs bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                          <span className="text-cyan-400 font-mono text-[11px] truncate mr-2">
                            🎨 {item.thumbnail_prompt.slice(0, 55)}...
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(item.thumbnail_prompt || '', 'AI Prompt');
                            }}
                            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold shrink-0 underline"
                          >
                            Copy Prompt
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Description Editor */}
          <div className="space-y-3 bg-gray-900/90 border border-gray-800/80 p-5 rounded-3xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📝</span> Deskripsi Video (YouTube SEO Optimized)
              </h3>
              <button
                onClick={() => copyToClipboard(editedDescription, 'Deskripsi Video')}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <span>📋</span>
                <span>Copy Description</span>
              </button>
            </div>

            <textarea
              rows={12}
              value={editedDescription}
              onChange={(e) => {
                setEditedDescription(e.target.value);
                handleSave(selectedTitle, selectedYellowText, selectedRedText, selectedPrompt, e.target.value, editedTags);
              }}
              placeholder="Deskripsi otomatis akan muncul di sini..."
              className="w-full bg-gray-950 text-gray-200 border border-gray-800 rounded-2xl p-4 text-xs font-mono leading-relaxed focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Tags & Keywords Section */}
          <div className="space-y-3 bg-gray-900/90 border border-gray-800/80 p-5 rounded-3xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🏷️</span> Tags & Keywords YouTube ({editedTags.length} tags)
              </h3>
              <button
                onClick={() => copyToClipboard(editedTags.join(', '), 'Tags Video')}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <span>📋</span>
                <span>Copy All Tags</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 bg-gray-950 p-4 rounded-2xl border border-gray-800/80 max-h-48 overflow-auto">
              {editedTags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-xs font-mono text-gray-300 flex items-center gap-1.5"
                >
                  <span>#{tag}</span>
                  <button
                    onClick={() => {
                      const newTags = editedTags.filter((_, i) => i !== idx);
                      setEditedTags(newTags);
                      handleSave(selectedTitle, selectedYellowText, selectedRedText, selectedPrompt, editedDescription, newTags);
                    }}
                    className="text-gray-500 hover:text-rose-400 font-bold ml-1 text-xs"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlurfilmMetadataStep;
