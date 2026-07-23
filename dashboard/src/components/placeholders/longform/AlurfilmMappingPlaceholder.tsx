// dashboard/src/components/placeholders/longform/AlurfilmMappingPlaceholder.tsx
import React, { useState, useEffect } from 'react';
import type {
  AlurfilmChunk,
  AlurfilmAudioResult,
  AlurfilmTranscriptResult,
  AlurfilmMappingResult
} from '../../../electron-api';

const api = window.electronAPI;

function formatMinute(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const AlurfilmMappingPlaceholder: React.FC = () => {
  const [contentId, setContentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [audios, setAudios] = useState<Record<number, AlurfilmAudioResult>>({});
  const [transcripts, setTranscripts] = useState<Record<number, AlurfilmTranscriptResult>>({});
  const [mappings, setMappings] = useState<Record<number, AlurfilmMappingResult>>({});
  const [activePart, setActivePart] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [pasteJsonInput, setPasteJsonInput] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const id = await api.getContentId('longform');
      setContentId(id);

      if (id) {
        // Load chunks
        const chunkList = await api.listAlurfilmChunks(id);
        setChunks(chunkList || []);

        // Load audios
        const audioList = await api.listAlurfilmAudios(id);
        const audioMap: Record<number, AlurfilmAudioResult> = {};
        if (audioList) {
          for (const item of audioList) {
            audioMap[item.part] = item;
          }
        }
        setAudios(audioMap);

        // Load transcripts
        const transcriptList = await api.listAlurfilmTranscripts(id);
        const transcriptMap: Record<number, AlurfilmTranscriptResult> = {};
        if (transcriptList) {
          for (const item of transcriptList) {
            transcriptMap[item.part] = item;
          }
        }
        setTranscripts(transcriptMap);

        // Load mappings
        const mappingList = await api.listAlurfilmMappings(id);
        const mappingMap: Record<number, AlurfilmMappingResult> = {};
        if (mappingList) {
          for (const item of mappingList) {
            mappingMap[item.part] = item;
          }
        }
        setMappings(mappingMap);

        if (chunkList && chunkList.length > 0) {
          setActivePart(chunkList[0].part);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data mapping');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyMappingPrompt = async (partNum: number) => {
    try {
      const totalChunksCount = Math.max(1, chunks.length);
      const promptText = await api.getAlurfilmMappingPrompt(partNum, totalChunksCount);
      await api.copyToClipboard(promptText);
      showToast(`📋 FFmpeg Mapping Prompt Part ${partNum} disalin! Paste ke Google AI Studio.`);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil prompt mapping');
    }
  };

  const handleSaveImportedJson = async () => {
    if (!pasteJsonInput.trim()) return;

    try {
      setError(null);
      let raw = pasteJsonInput.trim();
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      const parsed = JSON.parse(raw);
      if (!parsed.mappings || !Array.isArray(parsed.mappings)) {
        setError('Data JSON mapping harus memiliki array "mappings"');
        return;
      }

      const savedResult = await api.saveAlurfilmMapping(activePart, JSON.stringify(parsed));
      setMappings((prev) => ({ ...prev, [activePart]: savedResult }));
      setShowImportModal(false);
      setPasteJsonInput('');
      showToast(`✨ JSON Video Mapping Part ${activePart} berhasil disimpan! (${parsed.mappings.length} kalimat)`);
    } catch (err: any) {
      setError(`Format JSON tidak valid: ${err.message}`);
    }
  };

  const handleCopyJson = async () => {
    const data = mappings[activePart]?.data;
    if (!data) return;
    try {
      await api.copyToClipboard(JSON.stringify(data, null, 2));
      showToast(`📋 Mapping JSON Part ${activePart} disalin ke clipboard!`);
    } catch (err: any) {}
  };

  const totalPartsCount = Math.max(chunks.length, Object.keys(mappings).length, 1);
  const partsList = Array.from({ length: totalPartsCount }, (_, i) => i + 1);

  const completedMappingsCount = partsList.filter((p) => mappings[p]?.data?.mappings?.length > 0).length;
  const mappingProgressPercent = Math.round((completedMappingsCount / totalPartsCount) * 100);

  const activeMappingData = mappings[activePart]?.data;

  // Calculate Visual Clip Distribution Statistics
  const visualStats = {
    slow_motion: 0,
    mirror_cut: 0,
    freeze_frame_with_zoom: 0,
    video_cut: 0,
    pan_and_zoom_cut: 0,
    total: 0,
  };

  if (activeMappingData?.mappings) {
    for (const m of activeMappingData.mappings) {
      if (m.visuals) {
        for (const vis of m.visuals) {
          visualStats.total += 1;
          if (vis.type in visualStats) {
            (visualStats as any)[vis.type] += 1;
          }
        }
      }
    }
  }

  const getPercent = (count: number) => {
    if (visualStats.total === 0) return 0;
    return Math.round((count / visualStats.total) * 100);
  };

  const filteredSentenceMappings = (activeMappingData?.mappings || []).filter((item) => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    return item.text.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl font-medium text-sm flex items-center gap-2 border border-emerald-400/30 animate-in fade-in slide-in-from-top-4">
          <span>{toast}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-2xl text-rose-200 text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs bg-rose-900 hover:bg-rose-800 px-3 py-1.5 rounded-xl font-bold transition-all text-rose-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* JSON Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-purple-800 rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-purple-400 font-bold uppercase">
                  Part #{activePart} FFmpeg Video Mapping
                </span>
                <h3 className="text-lg font-bold text-white">Import JSON Output FFmpeg Mapping</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-all text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Paste JSON mapping yang dihasilkan dari AI untuk Part #{activePart}:
            </p>

            <textarea
              value={pasteJsonInput}
              onChange={(e) => setPasteJsonInput(e.target.value)}
              placeholder='{\n  "scene_id": "part_01",\n  "mappings": [\n    {\n      "sentence_index": 0,\n      "text": "...",\n      "start": 0.0,\n      "end": 3.12,\n      "duration": 3.12,\n      "visuals": [\n        {\n          "type": "slow_motion",\n          "duration": 3.12,\n          "source_start_seconds": 2.5,\n          "slow_mo_factor": 0.6,\n          "color_grading_shift": {"contrast": 1.04, "brightness": 0.005, "saturation": 1.05}\n        }\n      ]\n    }\n  ],\n  "status": "done"\n}'
              rows={12}
              className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs font-mono text-purple-200 placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-all leading-relaxed"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleSaveImportedJson}
                disabled={!pasteJsonInput.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
              >
                💾 Save & Import Mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Title & Stats Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-xs font-mono font-bold uppercase tracking-wider">
                16:9 Alur Film Studio
              </span>
              {contentId && (
                <span className="text-xs font-mono text-gray-500 bg-gray-950 px-2.5 py-1 rounded-lg border border-gray-800">
                  ID: #{contentId}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2 pt-1">
              <span>🎯</span> Video Scene Mapping Studio
            </h1>
            <p className="text-xs text-gray-400 max-w-xl">
              Pencocokan adegan video dengan naskah voiceover per part menggunakan aturan 5 tipe visual (Slow-Mo, Mirror, Freeze Zoom, Normal, Pan) untuk mencegah klaim copyright.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl border border-gray-700 transition-all flex items-center gap-2"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span> Refresh
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-800/80">
          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Part Scene</span>
            <span className="text-lg font-black text-white">{totalPartsCount} Part</span>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Status Mapping</span>
            <span className="text-lg font-black text-purple-400">
              {completedMappingsCount} / {totalPartsCount} Ready
            </span>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Durasi Mapping Part #{activePart}</span>
            <span className="text-lg font-black text-emerald-400">
              {activeMappingData?.mappings ? (
                <>
                  {activeMappingData.mappings.reduce((acc, m) => acc + (m.duration || 0), 0).toFixed(1)}s
                  <span className="text-xs font-mono font-normal text-gray-400 block">
                    ({formatMinute(activeMappingData.mappings.reduce((acc, m) => acc + (m.duration || 0), 0))})
                  </span>
                </>
              ) : '0.0s'}
            </span>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-2xl border border-gray-800/80 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Progress Mapping</span>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-gray-300">{mappingProgressPercent}%</span>
                <span className={completedMappingsCount === totalPartsCount ? 'text-emerald-400' : 'text-purple-400'}>
                  {completedMappingsCount === totalPartsCount ? 'Lengkap' : 'Dalam Proses'}
                </span>
              </div>
              <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${mappingProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Part List & Mapping Actions */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Daftar Part / Scene</h3>
            <span className="text-[10px] font-mono text-purple-400 font-bold bg-purple-950 px-2 py-0.5 rounded border border-purple-900">
              {partsList.length} Part
            </span>
          </div>

          <div className="space-y-2">
            {partsList.map((partNum) => {
              const isSelected = activePart === partNum;
              const hasMapping = !!mappings[partNum]?.data?.mappings?.length;
              const sentenceCount = mappings[partNum]?.data?.mappings?.length || 0;

              return (
                <div
                  key={partNum}
                  onClick={() => setActivePart(partNum)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-150 flex flex-col space-y-2 relative overflow-hidden cursor-pointer ${
                    isSelected
                      ? 'bg-purple-950/60 border-purple-500/80 text-white shadow-xl shadow-purple-950/30'
                      : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-850 hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <span>Part #{partNum}</span>
                    </span>

                    {hasMapping ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                        <span>🎯</span> Mapping Ready
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1">
                        <span>⏳</span> Pending Mapping
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <span>🎬</span> {hasMapping ? `${sentenceCount} Kalimat Mapped` : 'Belum Ada Mapping'}
                    </span>
                  </div>

                  {/* Actions Bar per part */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-800/80">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyMappingPrompt(partNum);
                      }}
                      className="flex-1 py-1.5 px-2 bg-gray-800 hover:bg-purple-900/60 text-purple-300 rounded-lg text-[10px] font-bold transition-all border border-purple-900/40 flex items-center justify-center gap-1"
                      title="Copy FFmpeg mapping prompt"
                    >
                      <span>📋</span> Copy Prompt
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePart(partNum);
                        setShowImportModal(true);
                      }}
                      className="flex-1 py-1.5 px-2 bg-purple-600/20 hover:bg-purple-600 text-purple-200 hover:text-white rounded-lg text-[10px] font-bold transition-all border border-purple-500/30 flex items-center justify-center gap-1"
                      title="Import output JSON dari AI"
                    >
                      <span>📥</span> Import JSON
                    </button>
                  </div>

                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500 rounded-r" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Mapping Display & Fair-Use Stats */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-6 shadow-xl">
            {/* Header for Active Part */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-purple-400 font-bold bg-purple-950/80 px-2.5 py-0.5 rounded-md border border-purple-800">
                    PART #{activePart} FFMEPG MAPPING
                  </span>
                  {activeMappingData ? (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-800">
                      ✅ {activeMappingData.mappings?.length || 0} Sentence Mappings
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-md border border-amber-800">
                      ⚠️ Belum Ada Mapping JSON
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white pt-2">
                  Video Clip & Visual Sync Part #{activePart}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyMappingPrompt(activePart)}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>📋</span> Copy Mapping Prompt
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs rounded-xl border border-gray-700 transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>📥</span> Import JSON
                </button>
              </div>
            </div>

            {/* Fair-Use Copyright Protection Stats Widget */}
            {visualStats.total > 0 && (
              <div className="bg-gray-950 border border-purple-900/50 rounded-2xl p-5 space-y-3 shadow-lg">
                <div className="flex items-center justify-between border-b border-gray-850 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                      YouTube Content ID Fair-Use Compliance
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 bg-gray-900 px-2 py-0.5 rounded border border-gray-800 font-bold">
                    {visualStats.total} Klip Visual Total
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 text-center">
                    <span className="text-[10px] text-gray-400 font-bold block">Slow Motion</span>
                    <span className="text-sm font-black text-purple-300">{getPercent(visualStats.slow_motion)}%</span>
                    <span className="text-[9px] text-gray-500 block">Target ~30%</span>
                  </div>

                  <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 text-center">
                    <span className="text-[10px] text-gray-400 font-bold block">Mirror Cut</span>
                    <span className="text-sm font-black text-indigo-300">{getPercent(visualStats.mirror_cut)}%</span>
                    <span className="text-[9px] text-gray-500 block">Target ~25%</span>
                  </div>

                  <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 text-center">
                    <span className="text-[10px] text-gray-400 font-bold block">Freeze Zoom</span>
                    <span className="text-sm font-black text-blue-300">{getPercent(visualStats.freeze_frame_with_zoom)}%</span>
                    <span className="text-[9px] text-gray-500 block">Target ~20%</span>
                  </div>

                  <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 text-center">
                    <span className="text-[10px] text-gray-400 font-bold block">Video Normal</span>
                    <span className="text-sm font-black text-emerald-300">{getPercent(visualStats.video_cut)}%</span>
                    <span className="text-[9px] text-gray-500 block">Target ~15%</span>
                  </div>

                  <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 text-center">
                    <span className="text-[10px] text-gray-400 font-bold block">Pan & Zoom</span>
                    <span className="text-sm font-black text-amber-300">{getPercent(visualStats.pan_and_zoom_cut)}%</span>
                    <span className="text-[9px] text-gray-500 block">Target ~10%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Toolbar Search */}
            {activeMappingData?.mappings && activeMappingData.mappings.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-950 p-3 rounded-2xl border border-gray-800">
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="🔍 Cari narasi / teks VO..."
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <button
                  onClick={handleCopyJson}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                >
                  <span>📋</span> Copy JSON
                </button>
              </div>
            )}

            {/* Sentence Mappings Table */}
            {filteredSentenceMappings.length > 0 ? (
              <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-inner">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-gray-900 border-b border-gray-800 text-[10px] uppercase font-mono text-gray-400 font-bold">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">Teks Voiceover Narasi</th>
                        <th className="py-3 px-4 w-28">Durasi VO</th>
                        <th className="py-3 px-4 w-80">Visual Clips & Effect Specs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-850">
                      {filteredSentenceMappings.map((m) => (
                        <tr key={m.sentence_index} className="hover:bg-purple-950/20 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-gray-500 text-center">
                            {m.sentence_index}
                          </td>
                          <td className="py-3 px-4 text-white font-medium leading-relaxed">
                            {m.text}
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-400 text-[11px]">
                            {m.duration.toFixed(2)}s
                            <span className="text-[10px] text-gray-600 block">
                              ({formatMinute(m.start)} ➔ {formatMinute(m.end)})
                            </span>
                          </td>
                          <td className="py-3 px-4 space-y-1.5">
                            {m.visuals && m.visuals.map((v, vIdx) => (
                              <div
                                key={vIdx}
                                className="p-2 bg-gray-900 rounded-xl border border-gray-800 text-[11px] font-mono space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="px-2 py-0.5 rounded font-bold uppercase text-[9px] bg-purple-950 text-purple-300 border border-purple-800">
                                    {v.type}
                                  </span>
                                  <span className="text-gray-400 text-[10px]">
                                    Durasi: {v.duration}s
                                  </span>
                                </div>

                                <div className="text-gray-400 text-[10px] space-y-0.5 pt-0.5">
                                  {v.source_start_seconds !== undefined && (
                                    <div>Source Start: <span className="text-purple-300 font-bold">{v.source_start_seconds}s</span> ({formatMinute(v.source_start_seconds)})</div>
                                  )}
                                  {v.source_timestamp_seconds !== undefined && (
                                    <div>Freeze Point: <span className="text-blue-300 font-bold">{v.source_timestamp_seconds}s</span> ({formatMinute(v.source_timestamp_seconds)})</div>
                                  )}
                                  {v.slow_mo_factor && (
                                    <div>Slow-Mo Factor: <span className="text-emerald-300">{v.slow_mo_factor}x</span></div>
                                  )}
                                  {v.mirror_mode && (
                                    <div>Mirror Mode: <span className="text-indigo-300">{v.mirror_mode}</span></div>
                                  )}
                                  {v.color_grading_shift && (
                                    <div className="text-[9px] text-gray-500">
                                      Color Shift: C:{v.color_grading_shift.contrast || 1} | B:{v.color_grading_shift.brightness || 0} | S:{v.color_grading_shift.saturation || 1}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center bg-gray-950 border border-dashed border-gray-850 rounded-2xl space-y-3">
                <div className="w-16 h-16 bg-purple-950 text-purple-400 rounded-2xl flex items-center justify-center text-3xl mx-auto border border-purple-900 shadow-xl">
                  🎯
                </div>
                <h3 className="text-sm font-bold text-white">Video Mapping Part #{activePart} Belum Ada</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                  Salin prompt dengan menekan <strong>"Copy Mapping Prompt"</strong>, lalu paste ke AI bersama data naskah voiceover. Setelah itu paste JSON output-nya via tombol <strong>"Import JSON"</strong>.
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={() => handleCopyMappingPrompt(activePart)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center gap-1.5"
                  >
                    <span>📋</span> Copy Mapping Prompt Part #{activePart}
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs rounded-xl border border-gray-700 transition-all flex items-center gap-1.5"
                  >
                    <span>📥</span> Import JSON
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

export default AlurfilmMappingPlaceholder;
