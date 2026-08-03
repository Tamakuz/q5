// dashboard/src/components/ugc/UGCProfilesManager.tsx
import React, { useState, useEffect } from 'react';
import type { UGCProfile, SelectedFile } from '../../electron-api';

interface UGCProfilesManagerProps {
  onProfileSelect?: (profile: UGCProfile) => void;
}

const UGCProfilesManager: React.FC<UGCProfilesManagerProps> = ({ onProfileSelect }) => {
  const [profiles, setProfiles] = useState<UGCProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Form State
  const [charName, setCharName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      if (window.electronAPI?.getUGCProfiles) {
        const list = await window.electronAPI.getUGCProfiles();
        setProfiles(list || []);
      }
      if (window.electronAPI?.getActiveUGCProfile) {
        const activeId = await window.electronAPI.getActiveUGCProfile();
        setActiveProfileId(activeId);
      }
    } catch (err) {
      console.error('Failed to load UGC profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleSelectFile = async () => {
    try {
      if (window.electronAPI?.selectUGCImageFile) {
        const file = await window.electronAPI.selectUGCImageFile();
        if (file) {
          setSelectedFile(file);
          setErrorMsg(null);
        }
      }
    } catch (err) {
      console.error('Failed to select file:', err);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim()) {
      setErrorMsg('Nama karakter wajib diisi!');
      return;
    }
    if (!selectedFile) {
      setErrorMsg('Foto karakter wajib dipilih!');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      if (window.electronAPI?.createUGCProfile) {
        const newProfile = await window.electronAPI.createUGCProfile(
          charName.trim(),
          selectedFile.path
        );
        if (newProfile) {
          setProfiles((prev) => [...prev, newProfile]);
          setActiveProfileId(newProfile.id);
          if (onProfileSelect) onProfileSelect(newProfile);
        }
      }
      setCharName('');
      setSelectedFile(null);
      setShowAddModal(false);
    } catch (err: any) {
      console.error('Create profile error:', err);
      setErrorMsg(err.message || 'Gagal menyimpan profile karakter.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetActive = async (profile: UGCProfile) => {
    try {
      if (window.electronAPI?.selectActiveUGCProfile) {
        await window.electronAPI.selectActiveUGCProfile(profile.id);
        setActiveProfileId(profile.id);
        if (onProfileSelect) onProfileSelect(profile);
      }
    } catch (err) {
      console.error('Set active profile error:', err);
    }
  };

  const handleDeleteProfile = async (profileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Apakah kamu yakin ingin menghapus karakter ini?')) return;

    try {
      if (window.electronAPI?.deleteUGCProfile) {
        await window.electronAPI.deleteUGCProfile(profileId);
        setProfiles((prev) => prev.filter((p) => p.id !== profileId));
        if (activeProfileId === profileId) {
          setActiveProfileId(null);
        }
      }
    } catch (err) {
      console.error('Delete profile error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-cyan-600/20 text-cyan-400 rounded-lg text-xs font-mono font-bold">
              ⚡ UGC PROFILES
            </span>
            <span className="text-xs font-mono text-gray-500">
              ({profiles.length} Karakter Tersimpan)
            </span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Karakter & Profile UGC
          </h2>
          <p className="text-xs text-gray-400">
            Pilih atau tambahkan avatar & profil karakter untuk pembuatan konten UGC kamu.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-950/50 transition-all border border-cyan-400/30"
        >
          <span>👤+</span> Tambah Karakter
        </button>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-gray-500 text-xs font-mono animate-pulse">
          Memuat data karakter UGC...
        </div>
      ) : profiles.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-gray-800 rounded-2xl bg-gray-950/60 text-center space-y-4">
          <div className="w-16 h-16 bg-cyan-600/10 text-cyan-400 rounded-2xl flex items-center justify-center text-3xl border border-cyan-500/20">
            🎭
          </div>
          <div className="max-w-sm space-y-1">
            <h3 className="text-sm font-bold text-white">Belum Ada Profile Karakter</h3>
            <p className="text-xs text-gray-400">
              Tambahkan karakter UGC pertama kamu dengan mengunggah foto dan memberikan nama.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-950/40"
          >
            + Tambah Profile Karakter
          </button>
        </div>
      ) : (
        /* Profiles Cards Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {profiles.map((profile) => {
            const isActive = activeProfileId === profile.id;
            return (
              <div
                key={profile.id}
                onClick={() => handleSetActive(profile)}
                className={`
                  group relative flex flex-col items-center p-4 rounded-2xl border transition-all cursor-pointer select-none
                  ${
                    isActive
                      ? 'bg-gradient-to-b from-cyan-950/80 to-gray-900 border-cyan-500 shadow-xl shadow-cyan-950/50 ring-2 ring-cyan-500/50'
                      : 'bg-gray-900/60 border-gray-800/80 hover:bg-gray-800/60 hover:border-gray-700'
                  }
                `}
              >
                {/* Active Indicator Badge */}
                {isActive && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 bg-cyan-500 text-gray-950 font-bold text-[9px] uppercase tracking-wider rounded-full shadow">
                    Active
                  </span>
                )}

                {/* Delete Action Button */}
                <button
                  onClick={(e) => handleDeleteProfile(profile.id, e)}
                  title="Hapus Karakter"
                  className="absolute top-3 left-3 w-6 h-6 rounded-full bg-gray-950/80 hover:bg-rose-600 text-gray-400 hover:text-white flex items-center justify-center text-xs transition-colors opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>

                {/* Avatar Photo */}
                <div
                  className={`w-24 h-24 rounded-full overflow-hidden border-2 mb-3 bg-gray-950 flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 ${
                    isActive ? 'border-cyan-400 shadow-cyan-500/20' : 'border-gray-700'
                  }`}
                >
                  {profile.photoUrl ? (
                    <img
                      src={profile.photoUrl}
                      alt={profile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">👤</span>
                  )}
                </div>

                {/* Character Name */}
                <h4 className="text-xs font-bold text-white text-center truncate w-full px-1">
                  {profile.name}
                </h4>

                <span className="text-[10px] font-mono text-gray-500 mt-1">
                  {new Date(profile.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            );
          })}

          {/* Add Character Card Button */}
          <div
            onClick={() => setShowAddModal(true)}
            className="flex flex-col items-center justify-center p-4 rounded-2xl border border-dashed border-gray-800 hover:border-cyan-500/60 bg-gray-950/40 hover:bg-cyan-950/20 transition-all cursor-pointer group min-h-[190px] space-y-2 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-cyan-600/10 text-cyan-400 group-hover:bg-cyan-600 group-hover:text-white flex items-center justify-center text-xl font-bold transition-all border border-cyan-500/30">
              +
            </div>
            <span className="text-xs font-bold text-gray-400 group-hover:text-cyan-300">
              Tambah Karakter
            </span>
          </div>
        </div>
      )}

      {/* Add Profile Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="text-cyan-400">👤</span> Tambah Karakter UGC Baru
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProfile} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl">
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Photo Upload Section */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 block">
                  Foto Karakter <span className="text-rose-400">*</span>
                </label>
                <div
                  onClick={handleSelectFile}
                  className="flex flex-col items-center justify-center p-5 border border-dashed border-gray-700 hover:border-cyan-500 rounded-2xl bg-gray-950 cursor-pointer transition-all space-y-2 text-center group"
                >
                  {selectedFile ? (
                    <div className="space-y-1">
                      <span className="text-2xl">🖼️</span>
                      <p className="text-xs font-bold text-cyan-400 truncate max-w-xs">
                        {selectedFile.name}
                      </p>
                      <span className="text-[10px] font-mono text-gray-500">
                        Klik untuk mengganti foto
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-cyan-600/10 text-cyan-400 flex items-center justify-center text-lg">
                        📸
                      </div>
                      <p className="text-xs text-gray-300 font-semibold group-hover:text-cyan-300">
                        Klik untuk memilih foto karakter
                      </p>
                      <span className="text-[10px] text-gray-500 font-mono">
                        PNG, JPG, WEBP
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Character Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 block">
                  Nama Karakter <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  placeholder="Contoh: Sarah Creator / Budi Reviewer"
                  className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                />
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
                  {submitting ? 'Menyimpan...' : 'Simpan Karakter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UGCProfilesManager;
