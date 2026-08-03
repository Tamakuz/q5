// dashboard/src/components/ugc/UGCRenderStudioStep.tsx
import React, { useState, useEffect } from 'react';
import type { UGCProduct, UGCPatternItem, UGCPatternStats } from '../../electron-api';

const UGCRenderStudioStep: React.FC = () => {
  const [activeProduct, setActiveProduct] = useState<UGCProduct | null>(null);
  const [patternItems, setPatternItems] = useState<UGCPatternItem[]>([]);
  const [stats, setStats] = useState<UGCPatternStats | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Transition Style State ('radian_glow' | 'dissolve' | 'none')
  const [transitionStyle, setTransitionStyle] = useState<'radian_glow' | 'dissolve' | 'none'>('radian_glow');

  const [loading, setLoading] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(false);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderStage, setRenderStage] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<{ name: string; url: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStudioData = async () => {
    setLoading(true);
    try {
      if (window.electronAPI?.getActiveUGCProduct && window.electronAPI?.getUGCProducts) {
        const activeId = await window.electronAPI.getActiveUGCProduct();
        const products = await window.electronAPI.getUGCProducts();
        const currentProd = products.find((p) => p.id === activeId) || null;
        setActiveProduct(currentProd);

        if (currentProd && window.electronAPI?.getUGCPatternsList) {
          const res = await window.electronAPI.getUGCPatternsList(currentProd.id);
          if (res) {
            setPatternItems(res.items || []);
            setStats(res.stats || null);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load UGC render studio data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudioData();
  }, []);

  // Listen to render progress events
  useEffect(() => {
    if (window.electronAPI?.onUGCRenderProgress) {
      const cleanup = window.electronAPI.onUGCRenderProgress((data) => {
        if (activeProduct && data.productId === activeProduct.id) {
          setRenderProgress(data.progress || 0);
          setRenderStage(data.stage || 'rendering');
        }
      });
      return cleanup;
    }
  }, [activeProduct]);

  // Checkbox selection handlers
  const toggleSelectPattern = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectAllUnrendered = () => {
    const unrenderedKeys = patternItems
      .filter((item) => !item.rendered)
      .map((item) => item.patternKey);
    setSelectedKeys(new Set(unrenderedKeys));
  };

  const handleClearSelection = () => {
    setSelectedKeys(new Set());
  };

  // Smart Reshuffle Pattern Order
  const handleShufflePatternOrder = async () => {
    if (!activeProduct) return;
    try {
      if (window.electronAPI?.shuffleUGCPatterns) {
        await window.electronAPI.shuffleUGCPatterns(activeProduct.id);
        await fetchStudioData();
      }
    } catch (err) {
      console.error('Shuffle patterns error:', err);
    }
  };

  // Render individual pattern with pattern index (1-based)
  const handleRenderSinglePattern = async (item: UGCPatternItem, patternIndex: number) => {
    if (!activeProduct) return;
    setRendering(true);
    setErrorMsg(null);
    setRenderProgress(10);
    setRenderStage(`Merender Pola #${patternIndex} (${item.pattern.join(' ➔ ')})...`);

    try {
      if (window.electronAPI?.renderUGCPattern) {
        await window.electronAPI.renderUGCPattern(activeProduct.id, item.pattern, patternIndex, transitionStyle);
        await fetchStudioData();
      }
    } catch (err: any) {
      console.error('Render pattern error:', err);
      setErrorMsg(err.message || 'Gagal merender pola.');
    } finally {
      setRendering(false);
      setRenderProgress(0);
      setRenderStage('');
    }
  };

  // Batch render selected patterns
  const handleRenderSelectedPatterns = async () => {
    if (!activeProduct || selectedKeys.size === 0) return;

    const selectedEntries = patternItems
      .map((item, index) => ({ item, index: index + 1 }))
      .filter(({ item }) => selectedKeys.has(item.patternKey));

    if (!confirm(`Merender ${selectedEntries.length} pola terpilih?`)) return;

    setRendering(true);
    setErrorMsg(null);

    try {
      let count = 0;
      for (const { item, index } of selectedEntries) {
        count++;
        setRenderStage(`[${count}/${selectedEntries.length}] Merender video_${index} (${item.pattern.join(' ➔ ')})...`);
        setRenderProgress(Math.round(((count - 0.5) / selectedEntries.length) * 100));

        if (window.electronAPI?.renderUGCPattern) {
          await window.electronAPI.renderUGCPattern(activeProduct.id, item.pattern, index, transitionStyle);
        }
      }
      setSelectedKeys(new Set());
      await fetchStudioData();
    } catch (err: any) {
      console.error('Batch render error:', err);
      setErrorMsg(err.message || 'Gagal dalam proses batch render.');
    } finally {
      setRendering(false);
      setRenderProgress(0);
      setRenderStage('');
    }
  };

  // Toggle Uploaded Status
  const handleToggleUploaded = async (item: UGCPatternItem) => {
    if (!activeProduct) return;
    const nextState = !item.uploaded;
    try {
      if (window.electronAPI?.toggleUGCOploadStatus) {
        await window.electronAPI.toggleUGCOploadStatus(activeProduct.id, item.patternKey, nextState);
        setPatternItems((prev) =>
          prev.map((i) => (i.patternKey === item.patternKey ? { ...i, uploaded: nextState } : i))
        );
        if (stats) {
          setStats({
            ...stats,
            uploadedCount: (stats.uploadedCount || 0) + (nextState ? 1 : -1),
          });
        }
      }
    } catch (err) {
      console.error('Toggle uploaded error:', err);
    }
  };

  // Delete Render Output & Reset Pattern Status
  const handleDeletePatternRender = async (item: UGCPatternItem) => {
    if (!activeProduct) return;
    if (!confirm(`Hapus video hasil render untuk pola ini?`)) return;

    try {
      if (window.electronAPI?.deleteUGCRenderPattern) {
        await window.electronAPI.deleteUGCRenderPattern(activeProduct.id, item.patternKey);
        await fetchStudioData();
      }
    } catch (err) {
      console.error('Delete pattern render error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-cyan-600/20 text-cyan-400 rounded-lg text-xs font-mono font-bold">
              🎬 UGC RENDER STUDIO
            </span>
            {activeProduct && (
              <span className="px-2.5 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-mono font-bold rounded-md flex items-center gap-1.5">
                <span>📦</span> {activeProduct.name}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Pattern List & Transisi CapCut Studio
          </h2>
          <p className="text-xs text-gray-400">
            Daftar kombinasi 3-clip full dengan Transisi Radian Glow (CapCut style), pengacakan pola pintar, & batch render.
          </p>
        </div>

        {activeProduct && (
          <div className="flex items-center gap-2">
            {/* Transition Style Selector Dropdown */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 border border-cyan-800/80 rounded-xl">
              <span className="text-xs">✨ Transisi:</span>
              <select
                value={transitionStyle}
                onChange={(e) => setTransitionStyle(e.target.value as any)}
                disabled={rendering}
                className="bg-gray-950 text-xs font-bold text-cyan-300 border-0 focus:ring-0 cursor-pointer outline-none rounded"
              >
                <option value="radian_glow">🌟 Radian Glow (CapCut)</option>
                <option value="dissolve">🔄 Soft Dissolve</option>
                <option value="none">⚡ Tanpa Transisi (Hard Cut)</option>
              </select>
            </div>

            <button
              onClick={handleShufflePatternOrder}
              disabled={rendering || patternItems.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-gray-800 text-cyan-400 border border-cyan-500/40 text-xs font-bold rounded-xl transition-all shadow-md disabled:opacity-50"
              title="Acak urutan pola agar tidak kelihatan sekuensial saat di-upload"
            >
              <span>🔀</span> Acak Urutan
            </button>

            {selectedKeys.size > 0 && (
              <button
                onClick={handleRenderSelectedPatterns}
                disabled={rendering}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-950/50 transition-all border border-cyan-400/30 disabled:opacity-50"
              >
                <span>⚡</span> {rendering ? 'Merender...' : `Render Selected (${selectedKeys.size})`}
              </button>
            )}

            <button
              onClick={handleSelectAllUnrendered}
              disabled={rendering || patternItems.length === 0}
              className="px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-cyan-300 border border-cyan-500/40 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
            >
              Select Unrendered
            </button>
          </div>
        )}
      </div>

      {/* Warning State if no product active */}
      {!loading && !activeProduct ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-amber-800/60 rounded-2xl bg-amber-950/20 text-center space-y-4">
          <div className="w-16 h-16 bg-amber-600/10 text-amber-400 rounded-2xl flex items-center justify-center text-3xl border border-amber-500/20 shadow-xl shadow-amber-950/40">
            ⚠️
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-sm font-bold text-white">Belum Ada Produk yang Dipilih</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Silakan kembali ke <strong>Step 2 (Products Manager)</strong> dan buat/pilih produk aktif terlebih dahulu.
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center p-12 text-gray-500 text-xs font-mono animate-pulse">
          Menganalisis pola kombinasi video raw...
        </div>
      ) : (
        <>
          {/* Stats Bar */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-2xl bg-gray-900/60 border border-gray-800/80 space-y-1">
                <span className="text-[10px] font-mono text-gray-500 uppercase block font-bold">
                  📹 Total Video Raw
                </span>
                <span className="text-lg font-bold text-white font-mono">
                  {stats.totalRawClips} <span className="text-xs font-normal text-gray-500">Clips</span>
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-800/60 space-y-1">
                <span className="text-[10px] font-mono text-cyan-400 uppercase block font-bold">
                  🎲 Total Variasi Pola
                </span>
                <span className="text-lg font-bold text-cyan-300 font-mono">
                  {stats.totalPossiblePatterns} <span className="text-xs font-normal text-cyan-500">Pola</span>
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 space-y-1">
                <span className="text-[10px] font-mono text-emerald-400 uppercase block font-bold">
                  ✅ Sudah Di-render
                </span>
                <span className="text-lg font-bold text-emerald-300 font-mono">
                  {stats.renderedCount} <span className="text-xs font-normal text-emerald-500">Video</span>
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/60 space-y-1">
                <span className="text-[10px] font-mono text-purple-400 uppercase block font-bold">
                  🚀 Sudah Di-upload
                </span>
                <span className="text-lg font-bold text-purple-300 font-mono">
                  {stats.uploadedCount || 0} <span className="text-xs font-normal text-purple-500">Pola</span>
                </span>
              </div>
            </div>
          )}

          {/* Insufficient Clips Notice */}
          {stats && stats.totalRawClips < 3 && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-3">
              <span className="text-xl">💡</span>
              <p>
                Modul membutuhkan minimal <strong>3 file video raw</strong> di Step 3 untuk dapat membentuk kombinasi pola render. Silakan tambah video raw di Step 3 terlebih dahulu.
              </p>
            </div>
          )}

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Render Progress Indicator Bar */}
          {rendering && (
            <div className="p-4 bg-cyan-950/60 border border-cyan-800/80 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-300 font-bold">🎬 {renderStage}</span>
                <span className="text-cyan-400 font-bold">{renderProgress}%</span>
              </div>
              <div className="w-full h-2.5 bg-gray-950 rounded-full overflow-hidden border border-cyan-900">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-200"
                  style={{ width: `${renderProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Pattern List Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📋</span> Daftar Pola Kombinasi 3-Clip ({patternItems.length})
              </h3>
              {selectedKeys.size > 0 && (
                <button
                  onClick={handleClearSelection}
                  className="text-xs text-gray-400 hover:text-white underline font-mono"
                >
                  Reset Pilihan ({selectedKeys.size})
                </button>
              )}
            </div>

            {patternItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 border border-dashed border-gray-800 rounded-2xl bg-gray-950/60 text-center space-y-2">
                <span className="text-3xl">📋</span>
                <p className="text-xs text-gray-400">
                  Belum ada pola kombinasi. Tambahkan minimal 3 video raw di Step 3.
                </p>
              </div>
            ) : (
              <div className="border border-gray-800/80 rounded-2xl overflow-hidden bg-gray-900/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-950 border-b border-gray-800 text-[10px] uppercase font-mono text-gray-400 tracking-wider">
                        <th className="py-3 px-4 w-10 text-center">#</th>
                        <th className="py-3 px-4">Urutan Pola 3-Clip Full</th>
                        <th className="py-3 px-4 w-32">Status</th>
                        <th className="py-3 px-4 w-64 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60 font-mono">
                      {patternItems.map((item, idx) => {
                        const patternIndex = idx + 1;
                        const isSelected = selectedKeys.has(item.patternKey);
                        return (
                          <tr
                            key={item.patternKey}
                            className={`hover:bg-gray-800/40 transition-colors ${
                              isSelected ? 'bg-cyan-950/30' : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectPattern(item.patternKey)}
                                className="w-4 h-4 rounded border-gray-700 bg-gray-950 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-gray-900"
                              />
                            </td>

                            {/* Pattern Sequence */}
                            <td className="py-3 px-4 font-semibold text-gray-200">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-gray-500 font-mono">
                                  #{patternIndex}
                                </span>

                                <span className="px-2.5 py-1 rounded-lg bg-gray-950 border border-gray-800 text-cyan-300 text-xs">
                                  {item.pattern[0]}
                                </span>
                                <span className="text-gray-600">➔</span>
                                <span className="px-2.5 py-1 rounded-lg bg-gray-950 border border-gray-800 text-cyan-300 text-xs">
                                  {item.pattern[1]}
                                </span>
                                <span className="text-gray-600">➔</span>
                                <span className="px-2.5 py-1 rounded-lg bg-gray-950 border border-gray-800 text-cyan-300 text-xs">
                                  {item.pattern[2]}
                                </span>
                              </div>
                            </td>

                            {/* Status Badges */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.rendered ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                                    🎬 Rendered
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 text-[10px]">
                                    ⚪ Belum Render
                                  </span>
                                )}

                                {item.uploaded && (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold">
                                    🚀 Uploaded
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Render Individual Button */}
                                {!item.rendered && (
                                  <button
                                    onClick={() => handleRenderSinglePattern(item, patternIndex)}
                                    disabled={rendering}
                                    className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold rounded-lg transition-all shadow"
                                  >
                                    🎬 Render
                                  </button>
                                )}

                                {/* Video Preview Button ONLY for Rendered Output */}
                                {item.rendered && item.videoUrl && (
                                  <button
                                    onClick={() =>
                                      setPreviewUrl({
                                        name: item.outputFileName || `video_${patternIndex}.mp4`,
                                        url: item.videoUrl!,
                                      })
                                    }
                                    className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1"
                                  >
                                    <span>▶️</span> Preview Video
                                  </button>
                                )}

                                {/* Mark Uploaded Toggle */}
                                <button
                                  onClick={() => handleToggleUploaded(item)}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                                    item.uploaded
                                      ? 'bg-purple-950 border-purple-700 text-purple-300 hover:bg-purple-900'
                                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white'
                                  }`}
                                >
                                  {item.uploaded ? '✓ Uploaded' : '🚀 Tandai Upload'}
                                </button>

                                {/* Delete Video / Pattern */}
                                {item.rendered && (
                                  <button
                                    onClick={() => handleDeletePatternRender(item)}
                                    title="Hapus Video Render"
                                    className="p-1 text-gray-500 hover:text-rose-400 rounded-lg hover:bg-rose-950/40 transition-colors"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Rendered Videos Visual Gallery Section */}
          {patternItems.some((i) => i.rendered && i.videoUrl) && (
            <div className="space-y-3 pt-4 border-t border-gray-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🎞️</span> Galeri Visual Hasil Render ({patternItems.filter((i) => i.rendered).length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {patternItems
                  .filter((item) => item.rendered && item.videoUrl)
                  .map((item) => (
                    <div
                      key={item.patternKey}
                      onClick={() => setPreviewUrl({ name: item.outputFileName!, url: item.videoUrl! })}
                      className="group relative flex flex-col p-3 rounded-2xl border border-gray-800/80 bg-gray-900/60 hover:bg-gray-800/60 hover:border-cyan-500/50 transition-all cursor-pointer select-none space-y-2.5"
                    >
                      {/* Video Player Card Preview */}
                      <div className="w-full h-36 rounded-xl bg-gray-950 border border-gray-800 overflow-hidden relative flex items-center justify-center">
                        <video
                          src={item.videoUrl!}
                          className="w-full h-full object-cover"
                          preload="metadata"
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                          <div className="w-10 h-10 rounded-full bg-cyan-600/90 text-white flex items-center justify-center text-lg pl-0.5 shadow-lg group-hover:scale-110 transition-transform">
                            ▶
                          </div>
                        </div>

                        {item.uploaded && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-purple-950/90 text-purple-300 border border-purple-700 text-[10px] font-bold z-10">
                            ✓ Uploaded
                          </span>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePatternRender(item);
                          }}
                          title="Hapus Video Render"
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-950/80 hover:bg-rose-600 text-gray-400 hover:text-white flex items-center justify-center text-xs transition-colors opacity-0 group-hover:opacity-100 z-10"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Video Pattern Info */}
                      <div className="space-y-1 px-1">
                        <h4 className="text-xs font-bold text-white truncate" title={item.outputFileName || ''}>
                          {item.outputFileName}
                        </h4>
                        <div className="text-[10px] font-mono text-cyan-400 truncate">
                          {item.pattern.join(' ➔ ')}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Video Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="w-full max-w-3xl bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-sm font-bold text-white truncate">
                🎬 {previewUrl.name}
              </h3>
              <button
                onClick={() => setPreviewUrl(null)}
                className="text-gray-500 hover:text-white text-base px-2"
              >
                ✕
              </button>
            </div>

            <div className="w-full rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-gray-800">
              <video
                src={previewUrl.url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UGCRenderStudioStep;
