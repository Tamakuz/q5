// dashboard/src/components/ugc/UGCVideoAssetsManager.tsx
import React, { useState, useEffect } from 'react';
import type { UGCProduct, UGCVideoAsset, SelectedFile } from '../../electron-api';

const UGCVideoAssetsManager: React.FC = () => {
  const [activeProduct, setActiveProduct] = useState<UGCProduct | null>(null);
  const [videoAssets, setVideoAssets] = useState<UGCVideoAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [previewVideo, setPreviewVideo] = useState<UGCVideoAsset | null>(null);

  // URL Download Modal State
  const [showUrlModal, setShowUrlModal] = useState<boolean>(false);
  const [inputUrl, setInputUrl] = useState<string>('');
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadInfo, setDownloadInfo] = useState<string>('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const fetchActiveProductAndVideos = async () => {
    setLoading(true);
    try {
      if (window.electronAPI?.getActiveUGCProduct && window.electronAPI?.getUGCProducts) {
        const activeId = await window.electronAPI.getActiveUGCProduct();
        const products = await window.electronAPI.getUGCProducts();
        const currentProd = products.find((p) => p.id === activeId) || null;
        setActiveProduct(currentProd);

        if (currentProd && window.electronAPI?.listUGCVideoAssets) {
          const videos = await window.electronAPI.listUGCVideoAssets(currentProd.id);
          setVideoAssets(videos || []);
        }
      }
    } catch (err) {
      console.error('Failed to load active product / video assets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveProductAndVideos();
  }, []);

  // Subscribe to download progress events
  useEffect(() => {
    if (window.electronAPI?.onUGCVideoDownloadProgress) {
      const cleanup = window.electronAPI.onUGCVideoDownloadProgress((data) => {
        if (activeProduct && data.productId === activeProduct.id) {
          setDownloadProgress(data.progress || 0);
          if (data.totalBytes > 0) {
            setDownloadInfo(`${formatFileSize(data.loadedBytes)} / ${formatFileSize(data.totalBytes)}`);
          } else {
            setDownloadInfo(`${formatFileSize(data.loadedBytes)} downloaded`);
          }
        }
      });
      return cleanup;
    }
  }, [activeProduct]);

  const handleUploadVideos = async () => {
    if (!activeProduct) return;
    try {
      if (window.electronAPI?.selectUGCVideoFile) {
        const files: SelectedFile[] = await window.electronAPI.selectUGCVideoFile();
        if (files && files.length > 0) {
          setUploading(true);
          for (const file of files) {
            if (window.electronAPI?.uploadUGCVideoAsset) {
              const newAsset = await window.electronAPI.uploadUGCVideoAsset(
                activeProduct.id,
                file.path
              );
              if (newAsset) {
                setVideoAssets((prev) => [newAsset, ...prev]);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to upload video assets:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadFromUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;
    if (!inputUrl.trim()) {
      setUrlError('URL video wajib diisi!');
      return;
    }

    setDownloading(true);
    setUrlError(null);
    setDownloadProgress(0);
    setDownloadInfo('Menghubungkan ke server...');

    try {
      if (window.electronAPI?.downloadUGCVideoAsset) {
        const newAsset = await window.electronAPI.downloadUGCVideoAsset(
          activeProduct.id,
          inputUrl.trim()
        );
        if (newAsset) {
          setVideoAssets((prev) => [newAsset, ...prev]);
        }
      }
      setInputUrl('');
      setShowUrlModal(false);
    } catch (err: any) {
      console.error('Download video error:', err);
      setUrlError(err.message || 'Gagal mengunduh video dari URL.');
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
      setDownloadInfo('');
    }
  };

  const handleDeleteVideo = async (asset: UGCVideoAsset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeProduct) return;
    if (!confirm(`Hapus video "${asset.name}"?`)) return;

    try {
      if (window.electronAPI?.deleteUGCVideoAsset) {
        await window.electronAPI.deleteUGCVideoAsset(activeProduct.id, asset.fileName);
        setVideoAssets((prev) => prev.filter((v) => v.fileName !== asset.fileName));
        if (previewVideo?.fileName === asset.fileName) {
          setPreviewVideo(null);
        }
      }
    } catch (err) {
      console.error('Delete video error:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header Section with Active Product Info */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-cyan-600/20 text-cyan-400 rounded-lg text-xs font-mono font-bold">
              📹 VIDEO ASSETS (RAW)
            </span>
            {activeProduct && (
              <span className="px-2.5 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-mono font-bold rounded-md flex items-center gap-1.5">
                <span>📦</span> {activeProduct.name}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Aset Video Raw Terisolasi
          </h2>
          <p className="text-xs text-gray-400">
            Upload & kelola berkas video raw khusus untuk produk yang sedang aktif.
          </p>
        </div>

        {activeProduct && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUrlModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gray-900 hover:bg-gray-800 text-cyan-400 border border-cyan-500/40 text-xs font-bold rounded-xl transition-all shadow-md"
            >
              <span>🔗</span> Import via Link URL
            </button>
            <button
              onClick={handleUploadVideos}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-950/50 transition-all border border-cyan-400/30 disabled:opacity-50"
            >
              <span>📁+</span> {uploading ? 'Mengunggah...' : 'Upload File Lokal'}
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
              Silakan kembali ke <strong>Step 2 (Products Manager)</strong> dan buat atau pilih produk aktif terlebih dahulu untuk mengunggah aset video.
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center p-12 text-gray-500 text-xs font-mono animate-pulse">
          Memuat aset video terisolasi...
        </div>
      ) : videoAssets.length === 0 ? (
        /* Empty Video Assets State */
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-gray-800 rounded-2xl bg-gray-950/60 text-center space-y-4">
          <div className="w-16 h-16 bg-cyan-600/10 text-cyan-400 rounded-2xl flex items-center justify-center text-3xl border border-cyan-500/20">
            📹
          </div>
          <div className="max-w-sm space-y-1">
            <h3 className="text-sm font-bold text-white">Belum Ada Video Raw</h3>
            <p className="text-xs text-gray-400">
              Unggah video footage raw pertama kamu untuk produk <strong>{activeProduct?.name}</strong>.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUrlModal(true)}
              className="px-4 py-2 bg-gray-900 border border-cyan-500/40 text-cyan-400 hover:bg-gray-800 text-xs font-bold rounded-xl transition-all"
            >
              🔗 Import via Link URL
            </button>
            <button
              onClick={handleUploadVideos}
              disabled={uploading}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-950/40"
            >
              📁 Upload File Lokal
            </button>
          </div>
        </div>
      ) : (
        /* Video Gallery Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videoAssets.map((asset) => (
            <div
              key={asset.id}
              onClick={() => setPreviewVideo(asset)}
              className="group relative flex flex-col p-3 rounded-2xl border border-gray-800/80 bg-gray-900/60 hover:bg-gray-800/60 hover:border-gray-700 transition-all cursor-pointer select-none space-y-2.5"
            >
              {/* Video Thumbnail / Preview Container */}
              <div className="w-full h-36 rounded-xl bg-gray-950 border border-gray-800 overflow-hidden relative flex items-center justify-center">
                <video
                  src={asset.url}
                  className="w-full h-full object-cover"
                  preload="metadata"
                />
                {/* Play Button Overlay */}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                  <div className="w-10 h-10 rounded-full bg-cyan-600/90 text-white flex items-center justify-center text-lg pl-0.5 shadow-lg group-hover:scale-110 transition-transform">
                    ▶
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  onClick={(e) => handleDeleteVideo(asset, e)}
                  title="Hapus Video Asset"
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-950/80 hover:bg-rose-600 text-gray-400 hover:text-white flex items-center justify-center text-xs transition-colors opacity-0 group-hover:opacity-100 z-10"
                >
                  ✕
                </button>
              </div>

              {/* Video Info */}
              <div className="space-y-0.5 px-1">
                <h4 className="text-xs font-bold text-white truncate" title={asset.name}>
                  {asset.name}
                </h4>
                <div className="flex items-center justify-between text-[10px] font-mono text-gray-500">
                  <span>{formatFileSize(asset.size)}</span>
                  <span>
                    {new Date(asset.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Upload Card Button */}
          <div
            onClick={() => setShowUrlModal(true)}
            className="flex flex-col items-center justify-center p-6 rounded-2xl border border-dashed border-gray-800 hover:border-cyan-500/60 bg-gray-950/40 hover:bg-cyan-950/20 transition-all cursor-pointer group min-h-[190px] space-y-2 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-cyan-600/10 text-cyan-400 group-hover:bg-cyan-600 group-hover:text-white flex items-center justify-center text-xl font-bold transition-all border border-cyan-500/30">
              🔗
            </div>
            <span className="text-xs font-bold text-gray-400 group-hover:text-cyan-300">
              Import Video via URL Link
            </span>
          </div>
        </div>
      )}

      {/* URL Downloader Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="text-cyan-400">🔗</span> Import Video Asset via URL
              </h3>
              <button
                onClick={() => !downloading && setShowUrlModal(false)}
                disabled={downloading}
                className="text-gray-500 hover:text-white text-sm disabled:opacity-30"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDownloadFromUrl} className="space-y-4">
              {urlError && (
                <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl">
                  ⚠️ {urlError}
                </div>
              )}

              {/* URL Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 block">
                  URL Link Video <span className="text-rose-400">*</span>
                </label>
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  disabled={downloading}
                  placeholder="https://domain.com/video.mp4"
                  className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                />
                <span className="text-[10px] text-gray-500 font-mono block">
                  Pastikan link berupa URL video publik langsung.
                </span>
              </div>

              {/* Live Download Progress Indicator */}
              {downloading && (
                <div className="p-3 bg-cyan-950/60 border border-cyan-800/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-cyan-300 font-bold">Mengunduh Video...</span>
                    <span className="text-cyan-400 font-bold">{downloadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-950 rounded-full overflow-hidden border border-cyan-900">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-200"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                  {downloadInfo && (
                    <span className="text-[10px] text-gray-400 font-mono block text-right">
                      {downloadInfo}
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowUrlModal(false)}
                  disabled={downloading}
                  className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={downloading}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-950/40 disabled:opacity-50 flex items-center gap-2"
                >
                  <span>📥</span> {downloading ? 'Mengunduh...' : 'Download & Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="w-full max-w-3xl bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="truncate pr-4">
                <h3 className="text-sm font-bold text-white truncate">
                  📹 {previewVideo.name}
                </h3>
                <span className="text-[10px] font-mono text-cyan-400">
                  Ukuran: {formatFileSize(previewVideo.size)}
                </span>
              </div>
              <button
                onClick={() => setPreviewVideo(null)}
                className="text-gray-500 hover:text-white text-base px-2"
              >
                ✕
              </button>
            </div>

            <div className="w-full rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-gray-800">
              <video
                src={previewVideo.url}
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

export default UGCVideoAssetsManager;
