// dashboard/src/components/spensia/SpensiaThumbnailStep.tsx
import React, { useState, useEffect } from 'react';
import type { SpensiaThumbnailConcept, SpensiaThumbnailResult, SpensiaUploadMetadata } from '../../electron-api';

const TEXT_MODELS = [
  { id: 'cx/gpt-5.5', name: 'cx/gpt-5.5 (Default / Recommended)' },
  { id: 'google/gemini-2.5-flash', name: 'Google Gemini 2.5 Flash' },
  { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini' },
];

const IMAGE_MODELS = [
  { id: 'cx/gpt-5.5-image', name: 'cx/gpt-5.5-image (Default / Recommended)' },
  { id: 'imagen-3.0-generate-002', name: 'Google Imagen 3' },
  { id: 'recraft-v3', name: 'Recraft V3 (Visual Vector 2D)' },
  { id: 'flux-schnell', name: 'FLUX Schnell' },
  { id: 'dall-e-3', name: 'OpenAI DALL-E 3' },
];

const RESOLUTION_OPTIONS = [
  { size: '1280x720', label: '1280x720 (720p Landscape — Default Spensia)' },
  { size: '1024x576', label: '1024x576 (Low HD 16:9 — Super Hemat)' },
  { size: '1792x1024', label: '1792x1024 (16:9 Full HD Landscape)' },
];

export interface BatchTopicItem {
  id: number;
  title: string;
  summary?: string;
  hasTimeline?: boolean;
}

const SpensiaThumbnailStep: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'metadata' | 'thumbnail'>('metadata');

  // Metadata State
  const [uploadMetadata, setUploadMetadata] = useState<SpensiaUploadMetadata | null>(null);
  const [selectedTitleIndex, setSelectedTitleIndex] = useState<number>(0);
  const [loadingMetadata, setLoadingMetadata] = useState<boolean>(false);
  const [streamingMetadataText, setStreamingMetadataText] = useState<string>('');

  // Thumbnail State
  const [concepts, setConcepts] = useState<SpensiaThumbnailConcept[]>([]);
  const [renderedThumbnails, setRenderedThumbnails] = useState<SpensiaThumbnailConcept[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [aiModel, setAiModel] = useState<string>('cx/gpt-5.5');
  const [imageModel, setImageModel] = useState<string>('cx/gpt-5.5-image');
  const [imageSize, setImageSize] = useState<string>('1280x720');

  const [loadingPrompts, setLoadingPrompts] = useState<boolean>(false);
  const [streamingText, setStreamingText] = useState<string>('');

  const [loadingImages, setLoadingImages] = useState<boolean>(false);
  const [imageProgress, setImageProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const api = window.electronAPI;

  // Batch Topics State
  const [batchTopics, setBatchTopics] = useState<BatchTopicItem[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<number | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>('');

  const loadTopicData = async (topicId: number) => {
    setUploadMetadata(null);
    setConcepts([]);
    setRenderedThumbnails([]);
    setSelectedId(null);
    setStreamingText('');
    setStreamingMetadataText('');
    setErrorMsg(null);
    setSuccessMsg(null);

    if (api?.getSpensiaUploadMetadata) {
      try {
        const meta = await api.getSpensiaUploadMetadata(topicId);
        if (meta && meta.titles) {
          setUploadMetadata(meta);
        }
      } catch (err) {
        console.warn('Error loading upload metadata:', err);
      }
    }

    if (api?.getSpensiaThumbnails) {
      try {
        const res = await api.getSpensiaThumbnails(topicId);
        if (res?.concepts && res.concepts.length > 0) {
          setConcepts(res.concepts);
        }
        if (res?.rendered && res.rendered.length > 0) {
          setRenderedThumbnails(res.rendered);
        }
        if (res?.selected) {
          setSelectedId(res.selected.selectedId);
        }
      } catch (err: any) {
        console.warn('Failed to load thumbnail data:', err);
      }
    }
  };

  const handleSelectTopic = async (topic: BatchTopicItem) => {
    setActiveTopicId(topic.id);
    setVideoTitle(topic.title);
    await loadTopicData(topic.id);
  };

  // Load existing data on mount
  useEffect(() => {
    (async () => {
      let loadedTopics: BatchTopicItem[] = [];
      if (api?.readFromProject) {
        try {
          const topicsJson = await api.readFromProject('input/spensia/topics.json');
          let selectedId: number | null = null;
          if (topicsJson) {
            const topicState = JSON.parse(topicsJson);
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
            setBatchTopics(loadedTopics);
          }

          if (loadedTopics.length > 0) {
            const activeId = selectedId !== null ? selectedId : loadedTopics[0].id;
            const matchedTopic = loadedTopics.find((t) => t.id === activeId) || loadedTopics[0];
            setActiveTopicId(matchedTopic.id);
            setVideoTitle(matchedTopic.title);
            await loadTopicData(matchedTopic.id);
          }
        } catch (err) {
          console.warn('Failed to load topics.json:', err);
        }
      }
    })();

    // Listeners
    const cleanupMetaStream = api?.onSpensiaUploadMetadataChunk?.((data) => {
      setStreamingMetadataText(data.fullText || '');
    });

    const cleanupStream = api?.onSpensiaThumbnailPromptsChunk?.((data) => {
      setStreamingText(data.fullText || '');
    });

    const cleanupImageProg = api?.onSpensiaThumbnailImageProgress?.((data) => {
      setImageProgress({
        current: data.current,
        total: data.total,
        message: data.message,
      });

      if (data.item) {
        setRenderedThumbnails((prev) => {
          const exists = prev.some((p) => p.id === data.conceptId);
          if (exists) {
            return prev.map((p) => (p.id === data.conceptId ? { ...p, ...data.item } : p));
          }
          return [...prev, data.item!];
        });
      }
    });

    return () => {
      if (cleanupMetaStream) cleanupMetaStream();
      if (cleanupStream) cleanupStream();
      if (cleanupImageProg) cleanupImageProg();
    };
  }, [api]);

  // Handler: Generate YouTube Upload Metadata (SEO Titles, Description, Tags)
  const handleGenerateMetadata = async () => {
    setLoadingMetadata(true);
    setStreamingMetadataText('');
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!api?.generateSpensiaUploadMetadata) {
        throw new Error('IPC handler generateSpensiaUploadMetadata tidak tersedia.');
      }

      let scriptContent = '';
      if (api.readFromProject && activeTopicId) {
        scriptContent = (await api.readFromProject(`input/spensia/scripts/full_script_topic_${activeTopicId}.txt`)) || '';
        if (!scriptContent) {
          scriptContent = (await api.readFromProject(`input/spensia/full_script_topic_${activeTopicId}.txt`)) || '';
        }
        if (!scriptContent) {
          scriptContent = (await api.readFromProject('input/spensia/full_script.txt')) || '';
        }
      }

      const res = await api.generateSpensiaUploadMetadata(
        scriptContent,
        videoTitle || 'Spensia Educational Facts',
        aiModel,
        activeTopicId || undefined
      );

      if (res && res.titles && res.titles.length > 0) {
        setUploadMetadata(res);
        setSuccessMsg('🎉 Material Upload YouTube (Judul, Deskripsi, Tags & Chapters) berhasil dibuat!');
      } else {
        throw new Error('Gagal menghasilkan material upload YouTube.');
      }
    } catch (err: any) {
      setErrorMsg(`❌ Error Generate Upload Metadata: ${err.message}`);
    } finally {
      setLoadingMetadata(false);
    }
  };

  // Handler: Generate 3 High-CTR Thumbnail Prompts
  const handleGeneratePrompts = async () => {
    setLoadingPrompts(true);
    setStreamingText('');
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!api?.generateSpensiaThumbnailPrompts) {
        throw new Error('IPC handler generateSpensiaThumbnailPrompts tidak tersedia.');
      }

      let scriptContent = '';
      if (api.readFromProject && activeTopicId) {
        scriptContent = (await api.readFromProject(`input/spensia/scripts/full_script_topic_${activeTopicId}.txt`)) || '';
        if (!scriptContent) {
          scriptContent = (await api.readFromProject(`input/spensia/full_script_topic_${activeTopicId}.txt`)) || '';
        }
        if (!scriptContent) {
          scriptContent = (await api.readFromProject('input/spensia/full_script.txt')) || '';
        }
      }

      // Ambil judul terpilih dari tab metadata sebagai referensi prompt
      const selectedTitleObj = uploadMetadata?.titles?.[selectedTitleIndex];
      const selectedTitleText = typeof selectedTitleObj === 'string'
        ? selectedTitleObj
        : selectedTitleObj?.title || undefined;

      const res = await api.generateSpensiaThumbnailPrompts(
        scriptContent,
        videoTitle || 'Spensia Educational Facts',
        selectedTitleText,  // judul terpilih dari metadata
        aiModel,             // model AI (parameter ke-4)
        activeTopicId || undefined
      );

      if (res?.concepts && res.concepts.length > 0) {
        setConcepts(res.concepts);
        setSuccessMsg('🎉 3 Konsep Prompt Thumbnail High-CTR berhasil dibuat!');
      } else {
        throw new Error('Gagal menghasilkan konsep prompt thumbnail.');
      }
    } catch (err: any) {
      setErrorMsg(`❌ Error Generate Prompt: ${err.message}`);
    } finally {
      setLoadingPrompts(false);
    }
  };

  // Handler: Generate 3 Thumbnail Images
  const handleGenerateImages = async () => {
    if (concepts.length === 0) {
      setErrorMsg('Silakan generate konsep prompt thumbnail terlebih dahulu.');
      return;
    }

    setLoadingImages(true);
    setImageProgress({ current: 0, total: concepts.length, message: 'Mempersiapkan generator gambar...' });
    setRenderedThumbnails([]);   // hapus hasil render lama dari UI
    setSelectedId(null);         // reset seleksi
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!api?.generateSpensiaThumbnailImages) {
        throw new Error('IPC handler generateSpensiaThumbnailImages tidak tersedia.');
      }

      const results = await api.generateSpensiaThumbnailImages(concepts, imageModel, imageSize, activeTopicId || undefined);
      setRenderedThumbnails(results);

      // Auto select highest viral score if none selected
      const highest = [...results].sort((a, b) => (b.viral_score || 0) - (a.viral_score || 0))[0];
      if (highest && highest.id) {
        setSelectedId(highest.id);
        if (api.saveSpensiaThumbnailSelection) {
          await api.saveSpensiaThumbnailSelection(highest.id, highest, activeTopicId || undefined);
        }
      }

      setSuccessMsg('🎨 3 Gambar Thumbnail High-CTR berhasil di-render!');
    } catch (err: any) {
      setErrorMsg(`❌ Error Generate Image: ${err.message}`);
    } finally {
      setLoadingImages(false);
      setImageProgress(null);
    }
  };

  // Handler: Select Primary Thumbnail
  const handleSelectThumbnail = async (item: SpensiaThumbnailConcept) => {
    setSelectedId(item.id);
    setSuccessMsg(`✅ Thumbnail Concept #${item.id} ("${item.title}") dipilih sebagai Thumbnail Utama!`);
    try {
      if (api?.saveSpensiaThumbnailSelection) {
        await api.saveSpensiaThumbnailSelection(item.id, item, activeTopicId || undefined);
      }
    } catch (err: any) {
      console.warn('Error saving selection:', err);
    }
  };

  const handleUpdatePromptText = (id: number, field: 'prompt' | 'text_overlay', value: string) => {
    setConcepts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-gray-900 to-indigo-950 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold tracking-wider uppercase">
                🚀 STEP 9: PUBLISH HUB & THUMBNAIL STUDIO
              </span>
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold">
                🔥 SEO Titles, Description, Tags & 3x Thumbnail
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              YouTube Upload Materials & High-CTR Thumbnail Studio
            </h1>
            <p className="text-xs text-gray-300 max-w-2xl leading-relaxed">
              Buat seluruh bahan upload YouTube (Judul &lt;60 Karakter SEO, Deskripsi lengkap Timestamps, Tags) dan 3 variasi thumbnail kartun 2D/vektor ber-potensi viral dalam satu studio terpadu.
            </p>
          </div>

          {/* Tab Navigation Controls */}
          <div className="flex items-center gap-2 bg-gray-950 p-1.5 rounded-2xl border border-gray-800">
            <button
              onClick={() => setActiveTab('metadata')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'metadata'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>📝</span>
              <span>1. Upload SEO Metadata</span>
            </button>
            <button
              onClick={() => setActiveTab('thumbnail')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'thumbnail'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>🖼️</span>
              <span>2. Thumbnail Studio</span>
            </button>
          </div>
        </div>
      </div>

      {/* Batch Topics Tab Switcher */}
      {batchTopics.length > 1 && (
        <div className="flex flex-wrap gap-2 p-3 bg-gray-900/80 rounded-3xl border border-gray-800 shadow-2xl backdrop-blur-md">
          {batchTopics.map((top) => {
            const isActive = activeTopicId === top.id;
            return (
              <button
                key={top.id}
                onClick={() => handleSelectTopic(top)}
                className={`px-4 py-2 rounded-2xl text-xs font-black tracking-wide transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 transform scale-[1.03]'
                    : 'bg-gray-950 text-gray-400 border border-gray-900 hover:border-gray-800 hover:text-gray-200 hover:bg-gray-900'
                }`}
              >
                <span>📌</span>
                <span>Topic {top.id}: {top.title.slice(0, 30)}{top.title.length > 30 ? '...' : ''}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs font-mono">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-mono">
          {successMsg}
        </div>
      )}

      {/* TAB 1: YOUTUBE UPLOAD METADATA (SEO TITLES, DESCRIPTION, TAGS) */}
      {activeTab === 'metadata' && (
        <div className="space-y-6">
          {/* Top Bar Action */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gray-900/90 border border-gray-800 rounded-2xl p-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-400 font-mono">SEO MATERIAL GENERATOR</span>
              <p className="text-xs text-gray-300">
                Membuat 3 Judul SEO (&lt;60 Karakter), Deskripsi lengkap dengan Timestamps & CTA, 15-25 Tags, dan Hashtags.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 font-mono focus:border-emerald-500 outline-none"
              >
                {TEXT_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>

              <button
                onClick={handleGenerateMetadata}
                disabled={loadingMetadata}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loadingMetadata ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span>
                    <span>Streaming SEO Metadata...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Generate Upload Materials</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* STREAMING TEXT OUTPUT FOR METADATA */}
          {loadingMetadata && (
            <div className="bg-gray-950 border border-emerald-500/40 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-emerald-400 font-bold">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  STREAMING REAL-TIME YOUTUBE SEO METADATA
                </span>
                <span>{streamingMetadataText.length} bytes</span>
              </div>
              <pre className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-[11px] text-gray-300 font-mono leading-relaxed overflow-x-auto max-h-48 whitespace-pre-wrap">
                {streamingMetadataText || 'Menghubungkan ke 9router AI SEO Studio...'}
              </pre>
            </div>
          )}

          {/* RESULTS DISPLAY FOR METADATA */}
          {uploadMetadata && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Judul & Description */}
              <div className="md:col-span-8 space-y-6">
                {/* 1. TITLES (3 High-CTR Alternatives) */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>📌</span> 1. Judul Video (Maksimal 60 Karakter SEO)
                    </h2>
                    <span className="text-[11px] text-emerald-400 font-mono font-bold">Keyword Utama di Awal</span>
                  </div>

                  <div className="space-y-3">
                    {uploadMetadata.titles?.map((item, idx) => {
                      const titleText = typeof item === 'string' ? item : item.title;
                      const score = typeof item === 'object' ? item.ctr_score || (95 - idx * 3) : (95 - idx * 3);
                      const reason = typeof item === 'object' ? item.ctr_reason : null;

                      const charCount = titleText.length;
                      const isSelected = selectedTitleIndex === idx;
                      const isPerfectLen = charCount <= 60;
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedTitleIndex(idx)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                            isSelected
                              ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-xl ring-1 ring-emerald-500/40'
                              : 'bg-gray-950 border-gray-800 hover:border-gray-700 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-emerald-400">OPTION #{idx + 1}</span>
                              <span className={`px-2.5 py-0.5 rounded-full font-bold ${score >= 92 ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-amber-950 text-amber-300 border border-amber-500/40'}`}>
                                {score}% 🔥 CTR Rating
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full font-bold ${isPerfectLen ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-red-950 text-red-300 border border-red-500/40'}`}>
                                {charCount} / 60 Chars {isPerfectLen ? '✓' : '⚠️ Over 60'}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(titleText);
                                }}
                                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                              >
                                📋 Copy
                              </button>
                            </div>
                          </div>

                          <p className="text-xs font-mono font-bold leading-snug text-white">{titleText}</p>

                          {reason && (
                            <p className="text-[11px] text-gray-400 italic leading-relaxed pt-0.5 border-t border-gray-800/60">
                              "{reason}"
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. DESCRIPTION */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>📝</span> 2. Deskripsi Video (Hook, Timestamps & CTA)
                    </h2>
                    <button
                      onClick={() => navigator.clipboard.writeText(uploadMetadata.description || '')}
                      className="px-3 py-1 rounded-xl bg-gray-950 border border-gray-800 hover:border-emerald-500 text-emerald-400 text-xs font-mono font-bold transition-colors cursor-pointer"
                    >
                      📋 Copy Full Description
                    </button>
                  </div>

                  <textarea
                    rows={12}
                    value={uploadMetadata.description || ''}
                    onChange={(e) => setUploadMetadata({ ...uploadMetadata, description: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-xs text-gray-200 font-mono leading-relaxed focus:border-emerald-500 outline-none resize-none"
                  />
                </div>
              </div>

              {/* Right Column: Tags & Hashtags */}
              <div className="md:col-span-4 space-y-6">
                {/* 3. TAGS */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>🏷️</span> 3. Tags ({uploadMetadata.tags?.length || 0})
                    </h2>
                    <button
                      onClick={() => navigator.clipboard.writeText(uploadMetadata.tags?.join(', ') || '')}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono font-bold transition-colors cursor-pointer"
                    >
                      📋 Copy CSV
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto p-2 bg-gray-950 border border-gray-800 rounded-xl">
                    {uploadMetadata.tags?.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-[11px] font-mono text-gray-300 hover:text-white"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 4. HASHTAGS */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>#️⃣</span> 4. Hashtags (YouTube Header)
                    </h2>
                    <button
                      onClick={() => navigator.clipboard.writeText(uploadMetadata.hashtags?.join(' ') || '')}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono font-bold transition-colors cursor-pointer"
                    >
                      📋 Copy
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 p-2 bg-gray-950 border border-gray-800 rounded-xl">
                    {uploadMetadata.hashtags?.map((tag, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI THUMBNAIL STUDIO & VIRAL SCORE */}
      {activeTab === 'thumbnail' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gray-900/90 border border-gray-800 rounded-2xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-400">Model Image Generator (Sama Step 5):</label>
                <select
                  value={imageModel}
                  onChange={(e) => setImageModel(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-gray-200 font-mono focus:border-indigo-500 outline-none"
                >
                  {IMAGE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-400">Resolusi Thumbnail (16:9):</label>
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-gray-200 font-mono focus:border-teal-500 outline-none"
                >
                  {RESOLUTION_OPTIONS.map((r) => (
                    <option key={r.size} value={r.size}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleGeneratePrompts}
                disabled={loadingPrompts || loadingImages}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {loadingPrompts ? '⏳ Streaming Prompts...' : '🚀 1. Generate 3 Prompts'}
              </button>

              {concepts.length > 0 && (
                <button
                  onClick={handleGenerateImages}
                  disabled={loadingPrompts || loadingImages}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-900/40 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {loadingImages ? '🎨 Rendering Images...' : '🖼️ 2. Render 3 Thumbnails'}
                </button>
              )}
            </div>
          </div>

          {/* WARNING: Metadata belum di-generate */}
          {!uploadMetadata && (
            <div className="p-4 rounded-2xl bg-amber-950/80 border border-amber-500/40 text-amber-200 text-xs font-mono flex items-start gap-3">
              <span className="text-base">⚠️</span>
              <div>
                <strong>YouTube Upload Metadata belum dibuat.</strong>{' '}
                Buat dulu di tab <strong>"Upload SEO Metadata"</strong> → Generate Upload Materials → pilih judul, lalu kembali ke tab ini.
                Ini penting agar konsep thumbnail yang dihasilkan relevan dengan judul video terpilih.
              </div>
            </div>
          )}

          {/* STREAMING TEXT CONSOLE FOR THUMBNAIL PROMPTS */}
          {loadingPrompts && (
            <div className="bg-gray-950 border border-emerald-500/40 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-emerald-400 font-bold">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  STREAMING REAL-TIME PROMPT GENERATOR OUTPUT
                </span>
                <span>{streamingText.length} bytes</span>
              </div>
              <pre className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-[11px] text-gray-300 font-mono leading-relaxed overflow-x-auto max-h-48 whitespace-pre-wrap">
                {streamingText || 'Menghubungkan ke 9router AI Studio stream...'}
              </pre>
            </div>
          )}

          {/* REAL-TIME IMAGE GENERATION PROGRESS CARD */}
          {loadingImages && imageProgress && (
            <div className="bg-gray-950 border border-indigo-500/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-indigo-400 font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                  PROSES GENERATE THUMBNAIL IMAGE ({imageProgress.current} / {imageProgress.total})
                </span>
                <span className="text-gray-400">
                  {Math.round((imageProgress.current / imageProgress.total) * 100)}% Complete
                </span>
              </div>

              <div className="w-full bg-gray-900 h-2.5 rounded-full overflow-hidden border border-gray-800">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(imageProgress.current / imageProgress.total) * 100}%` }}
                />
              </div>

              <p className="text-xs text-gray-300 font-mono italic">
                {imageProgress.message}
              </p>
            </div>
          )}

          {/* SECTION 1: 3 THUMBNAIL PROMPT CONCEPTS */}
          {concepts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>💡</span> 3 Konsep Prompt Thumbnail (High CTR Formula)
                </h2>
                <span className="text-xs text-gray-400 font-mono">Formula: 2D Cartoon, Split Contrast, Expressive Face</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {concepts.map((concept) => (
                  <div
                    key={concept.id}
                    className="bg-gray-900 border border-gray-800 hover:border-emerald-500/50 rounded-2xl p-4 space-y-3 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 font-mono">
                          CONCEPT #{concept.id}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                            (concept.viral_score || 90) >= 92
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {concept.viral_score || 90}% 🔥 Viral Score
                        </span>
                      </div>

                      <h3 className="text-xs font-bold text-white line-clamp-1">{concept.title}</h3>
                      <p className="text-[11px] text-gray-400 italic leading-relaxed">"{concept.viral_reason}"</p>

                      <div className="space-y-1 pt-1">
                        <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Teks Overlay Headline:</label>
                        <input
                          type="text"
                          value={concept.text_overlay || ''}
                          onChange={(e) => handleUpdatePromptText(concept.id, 'text_overlay', e.target.value)}
                          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold focus:border-amber-500 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prompt AI Image Generator:</label>
                        <textarea
                          rows={5}
                          value={concept.prompt}
                          onChange={(e) => handleUpdatePromptText(concept.id, 'prompt', e.target.value)}
                          className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-[11px] text-gray-300 font-mono leading-relaxed focus:border-emerald-500 outline-none resize-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px] text-gray-500">
                      <span>Badge: <strong className="text-red-400 font-mono">{concept.badge_text || 'VS'}</strong></span>
                      <button
                        onClick={() => navigator.clipboard.writeText(concept.prompt)}
                        className="hover:text-emerald-400 transition-colors font-mono cursor-pointer"
                      >
                        📋 Copy Prompt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: 3 RENDERED THUMBNAILS & SELECTION GRID */}
          {renderedThumbnails.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>🎨</span> Hasil Render 3 Thumbnail (Pilih Thumbnail Utama)
                </h2>
                <span className="text-xs text-emerald-400 font-mono">Aspect Ratio: 16:9 (YouTube Optimized)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {renderedThumbnails.map((item) => {
                  const isSelected = selectedId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`bg-gray-900 border rounded-3xl p-4 space-y-4 transition-all relative overflow-hidden ${
                        isSelected
                          ? 'border-emerald-500 shadow-xl shadow-emerald-950/60 ring-2 ring-emerald-500/50'
                          : 'border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      {/* Selection Ribbon */}
                      {isSelected && (
                        <div className="absolute top-0 right-0 bg-emerald-500 text-gray-950 text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl shadow-md tracking-wider">
                          ★ SELECTED THUMBNAIL
                        </div>
                      )}

                      {/* Image Card Container */}
                      <div className="relative aspect-video bg-gray-950 rounded-2xl overflow-hidden border border-gray-800 group">
                        {item.url ? (
                          <img
                            src={item.url}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                            onClick={() => setFullscreenImage(item.url || null)}
                          />
                        ) : item.error ? (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-xs text-red-400 bg-red-950/20">
                            <span>⚠️ Failed to render image</span>
                            <span className="text-[10px] text-red-500 font-mono mt-1">{item.error}</span>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-500 gap-1">
                            <span className="animate-spin text-lg">🎨</span>
                            <span>Rendering Thumbnail #{item.id}...</span>
                          </div>
                        )}

                        {/* Simulation Headline Text Overlay on Image */}
                        {item.text_overlay && item.url && (
                          <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-md border border-amber-500/40 rounded-xl p-2 text-center">
                            <span className="text-xs font-black text-amber-300 font-mono tracking-wider drop-shadow-md uppercase">
                              "{item.text_overlay}"
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Thumbnail Details & Viral Score */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-white line-clamp-1">{item.title}</h3>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                            {item.viral_score || 90}% Viral Score
                          </span>
                        </div>

                        <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                          {item.viral_reason}
                        </p>

                        {/* Score Bar */}
                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                            <span>ESTIMATED CTR POTENTIAL</span>
                            <span className="text-emerald-400 font-bold">{item.viral_score || 90}%</span>
                          </div>
                          <div className="w-full bg-gray-950 h-2 rounded-full overflow-hidden border border-gray-800">
                            <div
                              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                              style={{ width: `${item.viral_score || 90}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-gray-800 flex items-center gap-2">
                        <button
                          onClick={() => handleSelectThumbnail(item)}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500 text-gray-950 font-black shadow-lg shadow-emerald-500/20'
                              : 'bg-gray-800 hover:bg-gray-700 text-white'
                          }`}
                        >
                          {isSelected ? '✓ Primary Selected' : 'Pilih Thumbnail'}
                        </button>

                        {item.url && (
                          <a
                            href={item.url}
                            download={`spensia_thumbnail_${item.id}.png`}
                            className="py-2 px-3 rounded-xl bg-gray-950 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white text-xs font-mono transition-colors flex items-center justify-center"
                            title="Download Thumbnail"
                          >
                            ⬇️
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Image Preview Modal */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 cursor-pointer"
          onClick={() => setFullscreenImage(null)}
        >
          <div className="relative max-w-5xl max-h-full space-y-2">
            <img
              src={fullscreenImage}
              alt="Thumbnail Preview Fullscreen"
              className="max-h-[85vh] w-auto rounded-2xl border border-gray-800 shadow-2xl mx-auto"
            />
            <p className="text-center text-xs text-gray-400 font-mono">Klik di mana saja untuk menutup preview</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpensiaThumbnailStep;
