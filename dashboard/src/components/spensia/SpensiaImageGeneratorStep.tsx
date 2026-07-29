// dashboard/src/components/spensia/SpensiaImageGeneratorStep.tsx
import React, { useState, useEffect } from 'react';

const api = window.electronAPI;

export interface GeneratedImageItem {
  segment_id: number;
  segment_quote: string;
  prompt: string;
  url?: string;
  filePath?: string;
  status: 'idle' | 'generating' | 'success' | 'error';
  error?: string;
}

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
  { size: 'auto', label: 'Auto (9router Auto)' },
];

export interface BatchTopicItem {
  id: number;
  title: string;
  summary: string;
  hasImages?: boolean;
  imagesCount?: number;
  totalPromptsCount?: number;
}

const SpensiaImageGeneratorStep: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState<string>('cx/gpt-5.5-image');
  const [selectedSize, setSelectedSize] = useState<string>('1280x720');
  const [selectedQuality, setSelectedQuality] = useState<string>('low');
  const [selectedDetail, setSelectedDetail] = useState<string>('low');
  const [concurrency, setConcurrency] = useState<number>(5);

  const [batchTopics, setBatchTopics] = useState<BatchTopicItem[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<number | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [isBatchQueueRunning, setIsBatchQueueRunning] = useState<boolean>(false);
  const [batchQueueIndex, setBatchQueueIndex] = useState<number>(0);
  const [batchQueueTotal, setBatchQueueTotal] = useState<number>(0);
  const [generatingTopicId, setGeneratingTopicId] = useState<number | null>(null);

  const [items, setItems] = useState<GeneratedImageItem[]>([]);
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Initial load on mount
  useEffect(() => {
    (async () => {
      try {
        if (api?.readFromProject) {
          // 1. Load selected topics from Step 1
          const savedTopicsJson = await api.readFromProject('input/spensia/topics.json');
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

          // Check per-topic image files to update hasImages badges
          const checkedTopics = await Promise.all(
            loadedTopics.map(async (top) => {
              try {
                const specificGen = (await api.readFromProject(`input/spensia/images/generated_images_topic_${top.id}.json`)) || '';
                let successCount = 0;
                let totalPrompts = 0;
                if (specificGen) {
                  const parsed = JSON.parse(specificGen);
                  if (Array.isArray(parsed.images)) {
                    totalPrompts = parsed.images.length;
                    successCount = parsed.images.filter((i: any) => i.status === 'success' || i.url).length;
                  }
                }
                return {
                  ...top,
                  hasImages: successCount > 0,
                  imagesCount: successCount,
                  totalPromptsCount: totalPrompts,
                };
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

          // 2. Load image prompts & images for active topic
          await loadTopicData(selectedId, checkedTopics);
        }
      } catch (err) {
        console.error('Error loading image generator state:', err);
      }
    })();
  }, []);

  const loadTopicData = async (topicId: number | null, topicList?: BatchTopicItem[]) => {
    if (!api?.readFromProject) return;

    // Load image prompts for this topic
    const promptFile = topicId
      ? `input/spensia/prompts/image_prompts_topic_${topicId}.json`
      : 'input/spensia/image_prompts.json';

    let promptsJsonStr = (await api.readFromProject(promptFile)) || '';
    if (!promptsJsonStr && topicId) {
      promptsJsonStr = (await api.readFromProject('input/spensia/image_prompts.json')) || '';
    }

    let parsedPrompts: any[] = [];
    if (promptsJsonStr) {
      try {
        const obj = JSON.parse(promptsJsonStr);
        if (Array.isArray(obj.image_prompts)) parsedPrompts = obj.image_prompts;
      } catch {}
    }

    // Load generated images state for this topic
    const genFile = topicId
      ? `input/spensia/images/generated_images_topic_${topicId}.json`
      : 'input/spensia/generated_images.json';

    let savedGenJson = (await api.readFromProject(genFile)) || '';
    if (!savedGenJson && topicId) {
      savedGenJson = (await api.readFromProject('input/spensia/generated_images.json')) || '';
    }

    let savedGenMap: Record<number, any> = {};
    if (savedGenJson) {
      try {
        const parsedGen = JSON.parse(savedGenJson);
        if (Array.isArray(parsedGen.images)) {
          parsedGen.images.forEach((img: any) => {
            savedGenMap[img.segment_id] = img;
          });
        }
      } catch {}
    }

    if (parsedPrompts.length > 0) {
      const mappedItems: GeneratedImageItem[] = parsedPrompts.map((p) => {
        const existing = savedGenMap[p.segment_id];
        return {
          segment_id: p.segment_id,
          segment_quote: p.segment_quote || `Segmen #${p.segment_id}`,
          prompt: p.prompt,
          url: existing?.url || undefined,
          filePath: existing?.filePath || undefined,
          status: existing?.url ? ('success' as const) : ('idle' as const),
        };
      });
      setItems(mappedItems);
    } else {
      setItems([]);
    }
  };

  const handleSwitchTopic = async (topic: BatchTopicItem) => {
    setActiveTopicId(topic.id);
    setVideoTitle(topic.title);

    if (isBatchQueueRunning) {
      return;
    }

    await loadTopicData(topic.id);
  };

  // Listen to batch progress events
  useEffect(() => {
    let unsubProgress: (() => void) | null = null;
    let unsubChunk: (() => void) | null = null;

    if (api?.onSpensiaImageProgress) {
      unsubProgress = api.onSpensiaImageProgress((progress) => {
        setBatchProgress({ current: progress.current, total: progress.total });
        if (!progress.topicId || progress.topicId === activeTopicId) {
          setItems((prev) =>
            prev.map((item) => {
              if (item.segment_id === progress.segmentId) {
                if (progress.status === 'success' && progress.saved) {
                  return {
                    ...item,
                    status: 'success',
                    url: progress.saved.url,
                    filePath: progress.saved.filePath,
                    error: undefined,
                  };
                } else if (progress.status === 'error') {
                  return {
                    ...item,
                    status: 'error',
                    error: progress.error || 'Gagal me-generate gambar',
                  };
                }
              }
              return item;
            })
          );
        }
      });
    }

    if (api?.onSpensiaImageChunkStart) {
      unsubChunk = api.onSpensiaImageChunkStart(({ segmentIds, topicId }) => {
        if (!topicId || topicId === activeTopicId) {
          setItems((prev) =>
            prev.map((item) => {
              if (segmentIds.includes(item.segment_id)) {
                return { ...item, status: 'generating' };
              }
              return item;
            })
          );
        }
      });
    }

    return () => {
      if (unsubProgress) unsubProgress();
      if (unsubChunk) unsubChunk();
    };
  }, [activeTopicId]);

  const saveGeneratedState = async (updatedItems: GeneratedImageItem[], topicId?: number) => {
    try {
      const targetId = topicId || activeTopicId;
      if (api?.saveToProject) {
        await api.saveToProject(
          'input/spensia/generated_images.json',
          JSON.stringify({ total_images: updatedItems.length, images: updatedItems }, null, 2)
        );

        if (targetId) {
          await api.saveToProject(
            `input/spensia/images/generated_images_topic_${targetId}.json`,
            JSON.stringify({ total_images: updatedItems.length, images: updatedItems }, null, 2)
          );
        }
      }
      if (targetId) {
        const successNum = updatedItems.filter((i) => i.status === 'success').length;
        setBatchTopics((prev) =>
          prev.map((t) =>
            t.id === targetId
              ? { ...t, hasImages: successNum > 0, imagesCount: successNum, totalPromptsCount: updatedItems.length }
              : t
          )
        );
      }
    } catch (err) {
      console.error('Error saving generated images state:', err);
    }
  };

  const handleBatchQueueAll = async () => {
    if (batchTopics.length === 0) return;
    setIsBatchQueueRunning(true);
    setBatchQueueTotal(batchTopics.length);
    showToast(`🚀 Memulai Batch Image Generator untuk ${batchTopics.length} Topik...`);

    let idx = 0;
    for (const topic of batchTopics) {
      idx++;
      setBatchQueueIndex(idx);
      setGeneratingTopicId(topic.id);
      setActiveTopicId(topic.id);
      setVideoTitle(topic.title);

      // Load prompts for this topic
      let topicItems: GeneratedImageItem[] = [];
      if (api?.readFromProject) {
        const promptsJsonStr = (await api.readFromProject(`input/spensia/prompts/image_prompts_topic_${topic.id}.json`)) || '';
        let parsedPrompts: any[] = [];
        if (promptsJsonStr) {
          try {
            const obj = JSON.parse(promptsJsonStr);
            if (Array.isArray(obj.image_prompts)) parsedPrompts = obj.image_prompts;
          } catch {}
        }

        const savedGenJson = (await api.readFromProject(`input/spensia/images/generated_images_topic_${topic.id}.json`)) || '';
        let savedGenMap: Record<number, any> = {};
        if (savedGenJson) {
          try {
            const parsedGen = JSON.parse(savedGenJson);
            if (Array.isArray(parsedGen.images)) {
              parsedGen.images.forEach((img: any) => {
                savedGenMap[img.segment_id] = img;
              });
            }
          } catch {}
        }

        if (parsedPrompts.length > 0) {
          topicItems = parsedPrompts.map((p) => {
            const existing = savedGenMap[p.segment_id];
            return {
              segment_id: p.segment_id,
              segment_quote: p.segment_quote || `Segmen #${p.segment_id}`,
              prompt: p.prompt,
              url: existing?.url || undefined,
              filePath: existing?.filePath || undefined,
              status: existing?.url ? ('success' as const) : ('idle' as const),
            };
          });
        }
      }
      if (topicItems.length === 0) topicItems = items;
      setItems(topicItems);

      const pendingItems = topicItems.filter((i) => i.status !== 'success' || !i.url);
      if (pendingItems.length === 0) {
        showToast(`✓ Gambar Topik #${topic.id} sudah lengkap. Lewati...`);
        continue;
      }

      try {
        if (api?.generateSpensiaBatchImages) {
          setBatchProgress({ current: 0, total: pendingItems.length });
          const results = await api.generateSpensiaBatchImages(
            pendingItems.map((i) => ({ segment_id: i.segment_id, prompt: i.prompt })),
            selectedModel,
            selectedSize,
            selectedQuality,
            selectedDetail,
            concurrency,
            topic.id
          );

          const updated = topicItems.map((item) => {
            const res = results.find((r: any) => r.segmentId === item.segment_id);
            if (res && res.status === 'success') {
              return { ...item, status: 'success' as const, url: res.url, filePath: res.filePath, error: undefined };
            } else if (res && res.status === 'error') {
              return { ...item, status: 'error' as const, error: res.error };
            }
            return item;
          });

          setItems(updated);
          await saveGeneratedState(updated, topic.id);
          showToast(`✓ Gambar Topik #${topic.id} Selesai (${updated.filter((i) => i.status === 'success').length}/${updated.length})!`);
        }
      } catch (err: any) {
        console.error(`Gagal batch image topik #${topic.id}:`, err);
      }
    }

    setIsBatchQueueRunning(false);
    setGeneratingTopicId(null);
    setBatchProgress(null);
    showToast(`✨ Seluruh (${batchTopics.length}) Gambar Batch Queue Berhasil Di-generate!`);
  };

  // Generate single image handler
  const handleGenerateSingle = async (segmentId: number) => {
    const targetItem = items.find((i) => i.segment_id === segmentId);
    if (!targetItem) return;

    setItems((prev) => prev.map((i) => (i.segment_id === segmentId ? { ...i, status: 'generating' } : i)));

    try {
      if (!api?.generateSpensiaSingleImage) {
        throw new Error('API generateSpensiaSingleImage tidak tersedia pada Electron preload.');
      }

      const res = await api.generateSpensiaSingleImage(
        segmentId,
        targetItem.prompt,
        selectedModel,
        selectedSize,
        selectedQuality,
        selectedDetail,
        activeTopicId || undefined
      );

      setItems((prev) => {
        const updated = prev.map((i) =>
          i.segment_id === segmentId
            ? { ...i, status: 'success' as const, url: res.url, filePath: res.filePath, error: undefined }
            : i
        );
        saveGeneratedState(updated);
        return updated;
      });

      showToast(`✨ Gambar Segmen #${segmentId} berhasil di-generate!`);
    } catch (err: any) {
      setItems((prev) =>
        prev.map((i) => (i.segment_id === segmentId ? { ...i, status: 'error', error: err?.message || String(err) } : i))
      );
      showToast(`❌ Gagal me-generate gambar Segmen #${segmentId}: ${err?.message || err}`);
    }
  };

  // Batch generate all pending/failed images handler (skips already successful ones!)
  const handleGenerateBatch = async () => {
    if (items.length === 0) {
      showToast('⚠️ Belum ada prompt gambar dari Step 4!');
      return;
    }

    const pendingItems = items.filter((i) => i.status !== 'success' || !i.url);

    if (pendingItems.length === 0) {
      showToast('✨ Semua segmen sudah memiliki ilustrasi gambar! (0 gambar pending)');
      return;
    }

    const skippedCount = items.length - pendingItems.length;
    if (skippedCount > 0) {
      showToast(`⚡ Memulai generasi ${pendingItems.length} gambar pending/failed (Melewati ${skippedCount} gambar yang sudah ada)...`);
    } else {
      showToast(`🚀 Memulai Batch Image Generation untuk ${pendingItems.length} segmen...`);
    }

    setIsBatchGenerating(true);
    setBatchProgress({ current: 0, total: pendingItems.length });

    try {
      if (!api?.generateSpensiaBatchImages) {
        throw new Error('API generateSpensiaBatchImages tidak tersedia pada Electron preload.');
      }

      const results = await api.generateSpensiaBatchImages(
        pendingItems.map((i) => ({ segment_id: i.segment_id, prompt: i.prompt })),
        selectedModel,
        selectedSize,
        selectedQuality,
        selectedDetail,
        concurrency,
        activeTopicId || undefined
      );

      setItems((prev) => {
        const updated = prev.map((item) => {
          const res = results.find((r: any) => r.segmentId === item.segment_id);
          if (res && res.status === 'success') {
            return { ...item, status: 'success' as const, url: res.url, filePath: res.filePath, error: undefined };
          } else if (res && res.status === 'error') {
            return { ...item, status: 'error' as const, error: res.error };
          }
          return item;
        });
        saveGeneratedState(updated);
        return updated;
      });

      showToast(`✨ Batch Image Generation Selesai (${pendingItems.length} gambar diproses)!`);
    } catch (err: any) {
      showToast(`❌ Batch Image Generation Gagal: ${err?.message || err}`);
    } finally {
      setIsBatchGenerating(false);
      setBatchProgress(null);
    }
  };

  const handleCopyImageUrl = (url?: string) => {
    if (!url) return;
    if (api?.copyToClipboard) {
      api.copyToClipboard(url);
    } else {
      navigator.clipboard.writeText(url);
    }
    showToast('📋 URL Gambar disalin ke Clipboard!');
  };

  const successCount = items.filter((i) => i.status === 'success' && i.url).length;
  const pendingCount = items.filter((i) => i.status !== 'success' || !i.url).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-2xl font-semibold text-xs flex items-center gap-2 border border-emerald-400/30 animate-bounce">
          <span>{toast}</span>
        </div>
      )}

      {/* Full Image Preview Modal */}
      {selectedPreviewImage && (
        <div
          onClick={() => setSelectedPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 cursor-zoom-out animate-in fade-in duration-200"
        >
          <div className="relative max-w-5xl max-h-full">
            <img
              src={selectedPreviewImage}
              alt="Generated Illustration Preview"
              className="max-w-full max-h-[85vh] rounded-2xl border border-gray-800 shadow-2xl object-contain"
            />
            <button
              onClick={() => setSelectedPreviewImage(null)}
              className="absolute top-3 right-3 px-3 py-1 bg-gray-900/90 text-white rounded-xl text-xs font-bold border border-gray-700"
            >
              ✕ Tutup
            </button>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-orange-950/80 via-gray-900 to-gray-950 p-6 rounded-3xl border border-orange-800/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-orange-950 text-orange-300 border border-orange-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                ✨ Spensia AI Workflow — Step 5
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>🖼️</span> Image Generator (9router Image API)
            </h1>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              Generate ilustrasi adegan 9router (Imagen 3, Recraft V3, FLUX, DALL-E 3) untuk setiap segmen naskah Spensia.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleGenerateBatch}
              disabled={isBatchGenerating || isBatchQueueRunning || items.length === 0}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-600/30 transition-all flex items-center gap-2"
            >
              {isBatchGenerating ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Generating Batch...</span>
                </>
              ) : pendingCount > 0 ? (
                <>
                  <span>⚡</span>
                  <span>Generate / Retry ({pendingCount}) Gambar Pending</span>
                </>
              ) : (
                <>
                  <span>✓</span>
                  <span>Semua Gambar Topik Ini Ready</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Batch Queue Topic Tabs Selector */}
      {batchTopics.length > 0 && (
        <div className="bg-gray-900/90 p-4 rounded-3xl border border-orange-800/40 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-orange-950 text-orange-300 border border-orange-800 font-bold font-mono text-[10px] uppercase">
                🚀 Batch Queue ({batchTopics.length} Topik)
              </span>
              <h3 className="text-xs font-bold text-white">
                Pilih Topik untuk Generasi Ilustrasi Gambar:
              </h3>
            </div>

            {batchTopics.length > 1 && (
              <button
                onClick={handleBatchQueueAll}
                disabled={isBatchGenerating || isBatchQueueRunning}
                className="px-3.5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-900/40 transition-all flex items-center gap-1.5 shrink-0"
              >
                {isBatchQueueRunning ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span>
                    <span>Generating Queue...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Auto Generate Semua Gambar Batch Queue</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-800">
            {batchTopics.map((t) => {
              const isActive = activeTopicId === t.id;
              const isGeneratingThis = generatingTopicId === t.id;
              const isReady = t.hasImages;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSwitchTopic(t)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-2 max-w-xs ${
                    isGeneratingThis
                      ? 'bg-orange-950/90 border-orange-400 text-orange-200 shadow-lg shadow-orange-950/60 ring-2 ring-orange-500/50 animate-pulse'
                      : isActive
                      ? 'bg-orange-950/80 border-orange-500 text-orange-200 shadow-md ring-1 ring-orange-500/40'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-900 border border-gray-800 text-orange-300 shrink-0">
                    #{t.id}
                  </span>
                  <span className="truncate">"{t.title}"</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      isGeneratingThis
                        ? 'bg-orange-900 text-orange-200 border border-orange-500 animate-pulse'
                        : isReady
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-gray-900 text-amber-400 border border-gray-800'
                    }`}
                  >
                    {isGeneratingThis ? '⚡ Rendering...' : isReady ? `✓ ${t.imagesCount}/${t.totalPromptsCount || '?'}` : '⏳ Belum'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Realtime Process Monitor Panel */}
      {(isBatchGenerating || isBatchQueueRunning) && (
        <div className="bg-gray-900/95 p-5 rounded-3xl border border-orange-500/60 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500" />
              </span>
              <h3 className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2">
                <span>⚡</span> Realtime Image Generation Monitor
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-orange-950 text-orange-300 border border-orange-800 font-bold">
                Model: {selectedModel} ({selectedSize})
              </span>
            </div>

            {batchQueueTotal > 0 && (
              <span className="text-xs font-mono font-bold text-orange-300 flex items-center gap-1.5">
                <span>📊</span> Progress Topik: {batchQueueIndex} dari {batchQueueTotal} ({Math.round((batchQueueIndex / batchQueueTotal) * 100)}% Selesai)
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {batchProgress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-400">Rendering Gambar Segmen...</span>
                <span className="text-orange-300 font-bold">
                  {batchProgress.current} / {batchProgress.total} Gambar ({Math.round((batchProgress.current / batchProgress.total) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-gray-950 rounded-full h-2.5 overflow-hidden border border-gray-800 p-0.5">
                <div
                  className="bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-md shadow-orange-500/50"
                  style={{ width: `${Math.max(5, Math.round((batchProgress.current / batchProgress.total) * 100))}%` }}
                />
              </div>
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
                        ? 'bg-orange-950/80 border-orange-400 text-white shadow-lg shadow-orange-950/50 ring-1 ring-orange-400/50 animate-pulse'
                        : t.hasImages
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
                      {isGeneratingThis ? '⚡ Rendering...' : t.hasImages ? `✓ ${t.imagesCount || 0} Img` : '⏳ Waiting'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Control & Progress Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Settings Form */}
        <div className="md:col-span-1 bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-xl space-y-5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <span className="p-1 bg-orange-950 text-orange-400 rounded-lg text-xs">⚙️</span>
            Pengaturan Image Generator
          </h2>

          {/* Model Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-300 block">
              Model Gambar AI (9router API):
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-orange-300 focus:outline-none focus:border-orange-500 font-mono font-semibold"
            >
              {IMAGE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Resolution Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-300 block">
              Resolusi & Aspect Ratio:
            </label>
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono font-semibold"
            >
              {RESOLUTION_OPTIONS.map((r) => (
                <option key={r.size} value={r.size}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Concurrency Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-300 block">
              Kecepatan Batch (Parallel Generation):
            </label>
            <select
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-orange-400 focus:outline-none focus:border-orange-500 font-mono font-semibold"
            >
              <option value={3}>3 Gambar Paralel</option>
              <option value={5}>5 Gambar Paralel (Default / Cepat)</option>
              <option value={8}>8 Gambar Paralel (Super Cepat)</option>
              <option value={10}>10 Gambar Paralel (Maksimal)</option>
            </select>
          </div>

          {/* Quality & Cost Saving Controls */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-300 block">
                Quality:
              </label>
              <select
                value={selectedQuality}
                onChange={(e) => setSelectedQuality(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-2 text-xs text-emerald-400 focus:outline-none focus:border-orange-500 font-mono font-semibold"
              >
                <option value="low">Low (Super Hemat)</option>
                <option value="standard">Standard</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-300 block">
                Image Detail:
              </label>
              <select
                value={selectedDetail}
                onChange={(e) => setSelectedDetail(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-2 text-xs text-emerald-400 focus:outline-none focus:border-orange-500 font-mono font-semibold"
              >
                <option value="low">Low Detail (Hemat)</option>
                <option value="high">High Detail</option>
              </select>
            </div>
          </div>

          {/* Status summary */}
          <div className="p-4 bg-gray-950 border border-gray-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300">Status Ilustrasi:</span>
              <span className="text-xs font-mono font-bold text-orange-400">
                {successCount} / {items.length} Selesai
              </span>
            </div>

            {batchProgress && (
              <div className="space-y-1.5 pt-1">
                <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-gray-800">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-amber-400 h-full transition-all duration-300"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 font-mono block text-right">
                  Segmen {batchProgress.current} dari {batchProgress.total} sedang di-generate...
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleGenerateBatch}
            disabled={isBatchGenerating || items.length === 0}
            className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold rounded-2xl text-xs shadow-xl shadow-orange-950/50 transition-all flex items-center justify-center gap-2"
          >
            {isBatchGenerating ? (
              <>
                <span className="animate-spin text-sm">⏳</span>
                <span>Generating Batch...</span>
              </>
            ) : (
              <>
                <span>🖼️</span>
                <span>Generate All Segments (Batch)</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Generated Images Grid / Cards */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-orange-950 text-orange-300 rounded-xl text-xs font-mono font-bold border border-orange-800 shrink-0">
                  🖼️ Panel Topik #{activeTopicId || 1}
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-white flex items-center gap-1.5 truncate max-w-md">
                    "{videoTitle || 'Topik Utama'}"
                  </h2>
                  <span className="text-[11px] text-gray-400 font-mono block">
                    {successCount} / {items.length} Segmen Gambar Ready
                  </span>
                </div>
              </div>

              <span className="text-[10px] font-mono text-gray-400 bg-gray-950 px-2.5 py-1 rounded-lg border border-gray-800 self-start sm:self-auto">
                🔍 Klik gambar untuk zoom preview
              </span>
            </div>

            {items.length === 0 ? (
              <div className="bg-gray-950 border border-dashed border-gray-800 rounded-3xl p-12 text-center space-y-3">
                <div className="w-14 h-14 bg-orange-600/10 text-orange-400 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-orange-500/20">
                  🖼️
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Belum Ada Prompt Gambar Loaded</h4>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Pastikan Anda telah menyelesaikan Step 4 (Image Prompt Generator) terlebih dahulu.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {items.map((item) => (
                  <div
                    key={item.segment_id}
                    className="p-4 bg-gray-950 border border-gray-800 hover:border-gray-700 rounded-2xl space-y-3 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-gray-800/80 pb-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-orange-950 border border-orange-800 text-orange-300 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                            #{item.segment_id}
                          </span>
                          <h4 className="text-xs font-bold text-white">
                            Segmen Adegan #{item.segment_id}
                          </h4>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                              item.status === 'success'
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                                : item.status === 'generating'
                                ? 'bg-amber-950 text-amber-300 border-amber-800 animate-pulse'
                                : item.status === 'error'
                                ? 'bg-red-950 text-red-400 border-red-800'
                                : 'bg-gray-900 text-gray-400 border-gray-800'
                            }`}
                          >
                            {item.status === 'success'
                              ? '✓ Gambar Ready'
                              : item.status === 'generating'
                              ? '⏳ Generating...'
                              : item.status === 'error'
                              ? '❌ Error'
                              : '⚪ Belum Generated'}
                          </span>
                        </div>

                        {item.segment_quote && (
                          <p className="text-[11px] text-gray-400 italic pl-8">
                            "{item.segment_quote}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.url && (
                          <button
                            onClick={() => handleCopyImageUrl(item.url)}
                            className="p-2 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded-xl text-xs border border-gray-800 transition-all"
                            title="Salin URL Gambar"
                          >
                            📋
                          </button>
                        )}

                        <button
                          onClick={() => handleGenerateSingle(item.segment_id)}
                          disabled={item.status === 'generating' || isBatchGenerating}
                          className="px-3 py-1.5 bg-orange-950 hover:bg-orange-900 border border-orange-800 disabled:opacity-40 text-orange-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <span>{item.url ? '🔄 Re-generate' : '🎨 Generate'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Image Preview / Skeleton Area */}
                    <div className="relative min-h-[160px] bg-gray-900/60 rounded-xl border border-gray-800/80 overflow-hidden flex items-center justify-center">
                      {item.status === 'generating' ? (
                        <div className="flex flex-col items-center justify-center p-8 space-y-2">
                          <span className="animate-spin text-2xl text-orange-400">⏳</span>
                          <span className="text-xs text-orange-300 font-mono">Me-generate ilustrasi 9router API...</span>
                        </div>
                      ) : item.url ? (
                        <img
                          src={item.url}
                          alt={`Segmen ${item.segment_id}`}
                          onClick={() => setSelectedPreviewImage(item.url || null)}
                          className="w-full h-56 object-cover cursor-zoom-in hover:scale-[1.01] transition-transform duration-300"
                        />
                      ) : item.status === 'error' ? (
                        <div className="p-6 text-center space-y-2">
                          <span className="text-red-400 text-xs font-bold block flex items-center justify-center gap-1">
                            <span>❌</span> Gagal Me-generate Gambar
                          </span>
                          <span className="text-[11px] text-gray-500 font-mono block max-w-md mx-auto">{item.error}</span>
                          <button
                            onClick={() => handleGenerateSingle(item.segment_id)}
                            className="px-3 py-1 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 shadow-md"
                          >
                            <span>🔄 Retry Segmen #{item.segment_id}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="p-6 text-center space-y-1">
                          <span className="text-gray-500 text-xs font-mono block">Belum Di-generate</span>
                          <span className="text-[10px] text-gray-600">Klik "Generate" untuk membuat ilustrasi adegan segmen ini</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpensiaImageGeneratorStep;
