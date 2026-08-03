// dashboard/src/components/ugc/UGCProductsManager.tsx
import React, { useState, useEffect } from 'react';
import type { UGCProduct, SelectedFile } from '../../electron-api';

interface UGCProductsManagerProps {
  onProductSelect?: (product: UGCProduct) => void;
}

const UGCProductsManager: React.FC<UGCProductsManagerProps> = ({ onProductSelect }) => {
  const [products, setProducts] = useState<UGCProduct[]>([]);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Form State
  const [productName, setProductName] = useState<string>('');
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedFile | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      if (window.electronAPI?.getUGCProducts) {
        const list = await window.electronAPI.getUGCProducts();
        setProducts(list || []);
      }
      if (window.electronAPI?.getActiveUGCProduct) {
        const activeId = await window.electronAPI.getActiveUGCProduct();
        setActiveProductId(activeId);
      }
    } catch (err) {
      console.error('Failed to load UGC products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSelectPhoto = async () => {
    try {
      if (window.electronAPI?.selectUGCImageFile) {
        const file = await window.electronAPI.selectUGCImageFile();
        if (file) {
          setSelectedPhoto(file);
          setErrorMsg(null);
        }
      }
    } catch (err) {
      console.error('Failed to select product photo:', err);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      setErrorMsg('Nama produk wajib diisi!');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      if (window.electronAPI?.createUGCProduct) {
        const newProd = await window.electronAPI.createUGCProduct(
          productName.trim(),
          selectedPhoto ? selectedPhoto.path : undefined
        );
        if (newProd) {
          setProducts((prev) => [...prev, newProd]);
          setActiveProductId(newProd.id);
          if (onProductSelect) onProductSelect(newProd);
        }
      }
      setProductName('');
      setSelectedPhoto(null);
      setShowAddModal(false);
    } catch (err: any) {
      console.error('Create product error:', err);
      setErrorMsg(err.message || 'Gagal menyimpan produk.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetActive = async (product: UGCProduct) => {
    try {
      if (window.electronAPI?.selectActiveUGCProduct) {
        await window.electronAPI.selectActiveUGCProduct(product.id);
        setActiveProductId(product.id);
        if (onProductSelect) onProductSelect(product);
      }
    } catch (err) {
      console.error('Set active product error:', err);
    }
  };

  const handleDeleteProduct = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Apakah kamu yakin ingin menghapus produk ini beserta seluruh assetnya?')) return;

    try {
      if (window.electronAPI?.deleteUGCProduct) {
        await window.electronAPI.deleteUGCProduct(productId);
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        if (activeProductId === productId) {
          setActiveProductId(null);
        }
      }
    } catch (err) {
      console.error('Delete product error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-cyan-600/20 text-cyan-400 rounded-lg text-xs font-mono font-bold">
              📦 PRODUCTS MANAGER
            </span>
            <span className="text-xs font-mono text-gray-500">
              ({products.length} Produk Tersimpan)
            </span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Daftar Produk UGC
          </h2>
          <p className="text-xs text-gray-400">
            Kelola produk dan tentukan Produk Aktif untuk menyimpan asset video terisolasi.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-950/50 transition-all border border-cyan-400/30"
        >
          <span>📦+</span> Tambah Produk
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-gray-500 text-xs font-mono animate-pulse">
          Memuat daftar produk UGC...
        </div>
      ) : products.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-gray-800 rounded-2xl bg-gray-950/60 text-center space-y-4">
          <div className="w-16 h-16 bg-cyan-600/10 text-cyan-400 rounded-2xl flex items-center justify-center text-3xl border border-cyan-500/20">
            📦
          </div>
          <div className="max-w-sm space-y-1">
            <h3 className="text-sm font-bold text-white">Belum Ada Produk</h3>
            <p className="text-xs text-gray-400">
              Tambahkan produk pertama kamu untuk mengisolasi aset video secara rapi.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-950/40"
          >
            + Tambah Produk Baru
          </button>
        </div>
      ) : (
        /* Products Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => {
            const isActive = activeProductId === product.id;
            return (
              <div
                key={product.id}
                onClick={() => handleSetActive(product)}
                className={`
                  group relative flex flex-col p-4 rounded-2xl border transition-all cursor-pointer select-none space-y-3
                  ${
                    isActive
                      ? 'bg-gradient-to-b from-cyan-950/80 to-gray-900 border-cyan-500 shadow-xl shadow-cyan-950/50 ring-2 ring-cyan-500/50'
                      : 'bg-gray-900/60 border-gray-800/80 hover:bg-gray-800/60 hover:border-gray-700'
                  }
                `}
              >
                {/* Active Badge & Delete */}
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2.5 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider rounded-full ${
                      isActive
                        ? 'bg-cyan-500 text-gray-950'
                        : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {isActive ? 'Active Product' : 'Product'}
                  </span>

                  <button
                    onClick={(e) => handleDeleteProduct(product.id, e)}
                    title="Hapus Produk"
                    className="w-6 h-6 rounded-full bg-gray-950/80 hover:bg-rose-600 text-gray-400 hover:text-white flex items-center justify-center text-xs transition-colors opacity-0 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>

                {/* Product Thumbnail / Image */}
                <div className="w-full h-32 rounded-xl bg-gray-950 border border-gray-800/80 overflow-hidden flex items-center justify-center relative">
                  {product.photoUrl ? (
                    <img
                      src={product.photoUrl}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-600 space-y-1">
                      <span className="text-3xl">🛍️</span>
                      <span className="text-[10px] font-mono text-gray-500">Tanpa Foto</span>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-white truncate">
                    {product.name}
                  </h4>
                  <span className="text-[10px] font-mono text-gray-500 block">
                    Dibuat: {new Date(product.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Add Product Card Button */}
          <div
            onClick={() => setShowAddModal(true)}
            className="flex flex-col items-center justify-center p-6 rounded-2xl border border-dashed border-gray-800 hover:border-cyan-500/60 bg-gray-950/40 hover:bg-cyan-950/20 transition-all cursor-pointer group min-h-[200px] space-y-2 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-cyan-600/10 text-cyan-400 group-hover:bg-cyan-600 group-hover:text-white flex items-center justify-center text-xl font-bold transition-all border border-cyan-500/30">
              +
            </div>
            <span className="text-xs font-bold text-gray-400 group-hover:text-cyan-300">
              Tambah Produk Baru
            </span>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="text-cyan-400">📦</span> Tambah Produk Baru
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl">
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Product Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 block">
                  Nama Produk <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Contoh: Skincare Glowing Serum 30ml"
                  className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Optional Photo Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                  <span>Foto Produk</span>
                  <span className="text-[10px] font-normal text-gray-500 italic">(Opsional)</span>
                </label>
                <div
                  onClick={handleSelectPhoto}
                  className="flex items-center justify-between p-3 border border-dashed border-gray-800 hover:border-cyan-500 rounded-xl bg-gray-950 cursor-pointer transition-all"
                >
                  {selectedPhoto ? (
                    <div className="flex items-center gap-2 truncate">
                      <span>🖼️</span>
                      <span className="text-xs font-bold text-cyan-400 truncate">
                        {selectedPhoto.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">
                      Klik untuk pilih foto produk...
                    </span>
                  )}
                  <span className="text-xs font-bold text-cyan-400 hover:underline">
                    Browse
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-950/40 disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UGCProductsManager;
