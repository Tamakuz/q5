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

const SpensiaImageGeneratorStep: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState<string>('cx/gpt-5.5-image');
  const [selectedSize, setSelectedSize] = useState<string>('1280x720');
  const [selectedQuality, setSelectedQuality] = useState<string>('low');
  const [selectedDetail, setSelectedDetail] = useState<string>('low');
  const [concurrency, setConcurrency] = useState<number>(5);

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
          // 1. Load image prompts from Step 4
          const promptsJsonStr = await api.readFromProject('input/spensia/image_prompts.json');
          let parsedPrompts: any[] = [];
          if (promptsJsonStr) {
            try {
              const obj = JSON.parse(promptsJsonStr);
              if (Array.isArray(obj.image_prompts)) parsedPrompts = obj.image_prompts;
            } catch {}
          }

          // 2. Load existing generated images state if any
          const savedGenJson = await api.readFromProject('input/spensia/generated_images.json');
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
                status: existing?.url ? 'success' : 'idle',
              };
            });
            setItems(mappedItems);
          }
        }
      } catch (err) {
        console.error('Error loading image generator state:', err);
      }
    })();
  }, []);

  // Listen to batch progress events
  useEffect(() => {
    let unsubProgress: (() => void) | null = null;
    let unsubChunk: (() => void) | null = null;

    if (api?.onSpensiaImageProgress) {
      unsubProgress = api.onSpensiaImageProgress((progress) => {
        setBatchProgress({ current: progress.current, total: progress.total });
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
      });
    }

    if (api?.onSpensiaImageChunkStart) {
      unsubChunk = api.onSpensiaImageChunkStart(({ segmentIds }) => {
        setItems((prev) =>
          prev.map((item) => {
            if (segmentIds.includes(item.segment_id)) {
              return { ...item, status: 'generating' };
            }
            return item;
          })
        );
      });
    }

    return () => {
      if (unsubProgress) unsubProgress();
      if (unsubChunk) unsubChunk();
    };
  }, []);

  const saveGeneratedState = async (updatedItems: GeneratedImageItem[]) => {
    try {
      if (api?.saveToProject) {
        await api.saveToProject(
          'input/spensia/generated_images.json',
          JSON.stringify({ total_images: updatedItems.length, images: updatedItems }, null, 2)
        );
      }
    } catch (err) {
      console.error('Error saving generated images state:', err);
    }
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
        selectedDetail
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

  // Batch generate all pending images handler
  const handleGenerateBatch = async () => {
    if (items.length === 0) {
      showToast('⚠️ Belum ada prompt gambar dari Step 4!');
      return;
    }

    const pendingItems = items.filter((i) => i.status !== 'success' || !i.url);

    if (pendingItems.length === 0) {
      showToast('✨ Semua segmen sudah memiliki ilustrasi gambar!');
      return;
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
        concurrency
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

      showToast(`✨ Batch Image Generation Selesai (${pendingItems.length} gambar baru)!`);
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

  const successCount = items.filter((i) => i.status === 'success').length;

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
              disabled={isBatchGenerating || items.length === 0}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-600/30 transition-all flex items-center gap-2"
            >
              {isBatchGenerating ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Generating Batch...</span>
                </>
              ) : (
                <>
                  <span>🖼️</span>
                  <span>Generate All Images (Batch)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

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
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="p-1 bg-orange-950 text-orange-400 rounded-lg text-xs">🖼️</span>
                Galeri Ilustrasi Adegan ({items.length} Segmen)
              </h2>

              <span className="text-[10px] font-mono text-gray-400">
                Klik gambar untuk memperbesar preview
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
                        <div className="p-6 text-center space-y-1">
                          <span className="text-red-400 text-xs font-bold block">Gagal Me-generate Gambar</span>
                          <span className="text-[11px] text-gray-500 font-mono">{item.error}</span>
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
