// dashboard/src/components/placeholders/longform/AlurfilmMappingPlaceholder.tsx
import React, { useState, useEffect, useMemo } from 'react';
import type {
  AlurfilmChunk,
  AlurfilmAudioResult,
  AlurfilmTranscriptResult,
  AlurfilmMappingResult
} from '../../../electron-api';
import {
  validateAlurfilmMapping,
  autoFixAlurfilmMapping,
  MappingValidationReport,
  AlurfilmMappingData
} from '../../../utils/mappingValidation';

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

  const totalPartsCount = Math.max(chunks.length, Object.keys(mappings).length, 1);
  const partsList = Array.from({ length: totalPartsCount }, (_, i) => i + 1);

  // Compute validation reports per part
  const validationReports = useMemo(() => {
    const reports: Record<number, MappingValidationReport> = {};
    for (const p of partsList) {
      const mData = mappings[p]?.data;
      const tData = transcripts[p]?.data;
      reports[p] = validateAlurfilmMapping(mData, tData);
    }
    return reports;
  }, [mappings, transcripts, partsList]);

  const activeReport = validationReports[activePart] || validateAlurfilmMapping(mappings[activePart]?.data, transcripts[activePart]?.data);

  // Modal Pre-Validation calculation
  const modalPreValidation = useMemo(() => {
    if (!pasteJsonInput.trim()) return null;
    try {
      let raw = pasteJsonInput.trim();
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.mappings || !Array.isArray(parsed.mappings)) return null;
      return {
        parsed: parsed as AlurfilmMappingData,
        report: validateAlurfilmMapping(parsed, transcripts[activePart]?.data),
      };
    } catch {
      return null;
    }
  }, [pasteJsonInput, transcripts, activePart]);

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

  const handleSaveImportedJson = async (customData?: AlurfilmMappingData) => {
    try {
      setError(null);
      let dataToSave: AlurfilmMappingData;

      if (customData) {
        dataToSave = customData;
      } else {
        if (!pasteJsonInput.trim()) return;
        let raw = pasteJsonInput.trim();
        if (raw.startsWith('```')) {
          raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
        }

        const parsed = JSON.parse(raw);
        if (!parsed.mappings || !Array.isArray(parsed.mappings)) {
          setError('Data JSON mapping harus memiliki array "mappings"');
          return;
        }
        dataToSave = parsed;
      }

      const savedResult = await api.saveAlurfilmMapping(activePart, JSON.stringify(dataToSave));
      setMappings((prev) => ({ ...prev, [activePart]: savedResult }));
      setShowImportModal(false);
      setPasteJsonInput('');
      showToast(`✨ JSON Video Mapping Part ${activePart} berhasil disimpan! (${dataToSave.mappings.length} kalimat)`);
    } catch (err: any) {
      setError(`Format JSON tidak valid: ${err.message}`);
    }
  };

  const handleAutoFixAndImport = async () => {
    if (!modalPreValidation) return;
    const fixed = autoFixAlurfilmMapping(modalPreValidation.parsed, transcripts[activePart]?.data);
    await handleSaveImportedJson(fixed);
  };

  const handleAutoFixValidation = async () => {
    const currentData = mappings[activePart]?.data;
    if (!currentData || !currentData.mappings) return;

    try {
      const fixed = autoFixAlurfilmMapping(currentData, transcripts[activePart]?.data);
      const savedResult = await api.saveAlurfilmMapping(activePart, JSON.stringify(fixed));
      setMappings((prev) => ({ ...prev, [activePart]: savedResult }));
      showToast(`⚡ Presisi Durasi Visual & Timing Part ${activePart} berhasil diselaraskan otomatis!`);
    } catch (err: any) {
      setError(`Gagal melakukan auto-fix mapping: ${err.message}`);
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

  const completedMappingsCount = partsList.filter((p) => mappings[p]?.data?.mappings?.length > 0).length;
  const validMappingsCount = partsList.filter((p) => validationReports[p]?.status === 'SUCCESS').length;
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

      {/* JSON Import & Live Pre-Validation Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-purple-800 rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
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
              Paste JSON mapping dari AI Transcriber/Editor untuk Part #{activePart}. Sistem akan otomatis memeriksa presisi durasi visual desimal vs VO:
            </p>

            <textarea
              value={pasteJsonInput}
              onChange={(e) => setPasteJsonInput(e.target.value)}
              placeholder='{\n  "scene_id": "part_01",\n  "mappings": [\n    {\n      "sentence_index": 0,\n      "text": "...",\n      "start": 0.0,\n      "end": 3.12,\n      "duration": 3.12,\n      "visuals": [\n        {\n          "type": "slow_motion",\n          "duration": 3.12,\n          "source_start_seconds": 2.5,\n          "slow_mo_factor": 0.6,\n          "color_grading_shift": {"contrast": 1.04, "brightness": 0.005, "saturation": 1.05}\n        }\n      ]\n    }\n  ],\n  "status": "done"\n}'
              rows={9}
              className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs font-mono text-purple-200 placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-all leading-relaxed"
            />

            {/* Modal Live Pre-Validation Box */}
            {modalPreValidation && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-2 ${
                  modalPreValidation.report.status === 'SUCCESS'
                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                    : modalPreValidation.report.status === 'WARNING'
                    ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                    : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <span>
                      {modalPreValidation.report.status === 'SUCCESS'
                        ? '✅'
                        : modalPreValidation.report.status === 'WARNING'
                        ? '⚠️'
                        : '🔴'}
                    </span>
                    <span>{modalPreValidation.report.summaryText}</span>
                  </span>
                  <span className="font-mono text-[11px]">
                    {modalPreValidation.report.sentenceCount} Kalimat | {modalPreValidation.report.totalVisualClips} Klip | Durasi: {modalPreValidation.report.totalMappingDuration.toFixed(1)}s
                  </span>
                </div>

                {modalPreValidation.report.issues.length > 0 && (
                  <ul className="space-y-1 pt-1 text-[11px] font-mono border-t border-gray-800/60 max-h-28 overflow-y-auto">
                    {modalPreValidation.report.issues.map((issue, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span>•</span>
                        <span>{issue.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
              >
                Batal
              </button>

              {modalPreValidation && modalPreValidation.report.issues.length > 0 && (
                <button
                  onClick={handleAutoFixAndImport}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30 transition-all flex items-center gap-1.5"
                  title="Otomatis selaraskan total durasi klip visual dengan VO desimal per kalimat"
                >
                  <span>⚡</span> Auto-Fix & Import
                </button>
              )}

              <button
                onClick={() => handleSaveImportedJson()}
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
              <span>🎯</span> Video Clip & Visual Sync
            </h1>
            <p className="text-xs text-gray-400 max-w-xl">
              Pemetaan visual klip adegan dari video mentah dengan presisi timestamp tinggi untuk eksekusi FFmpeg rendering per part.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl border border-gray-700 transition-all flex items-center gap-2"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span> Refresh & Validasi
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
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Status Validasi Visual Sync</span>
            <span className={`text-lg font-black ${validMappingsCount === totalPartsCount ? 'text-emerald-400' : 'text-amber-400'}`}>
              {validMappingsCount} / {totalPartsCount} Valid
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
        {/* Left Column: Part List & Prompt Actions */}
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
              const mappedCount = mappings[partNum]?.data?.mappings?.length || 0;
              const partReport = validationReports[partNum];

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
                      partReport?.status === 'SUCCESS' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                          <span>✅</span> Mapping Valid
                        </span>
                      ) : partReport?.status === 'WARNING' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1">
                          <span>⚠️</span> Warning ({partReport.warningCount})
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800 flex items-center gap-1">
                          <span>🔴</span> Error ({partReport.errorCount})
                        </span>
                      )
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1">
                        <span>⏳</span> Pending Mapping
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <span>🎬</span> {hasMapping ? `${mappedCount} Kalimat Mapped` : 'Belum Ada Mapping'}
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

        {/* Right Column: Mapping Visual Sync & Effect Specs */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-6 shadow-xl">
            {/* Header for Active Part */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-purple-400 font-bold bg-purple-950/80 px-2.5 py-0.5 rounded-md border border-purple-800">
                    PART #{activePart} FFMPEG MAPPING
                  </span>
                  {activeMappingData?.mappings ? (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-800">
                      ✅ {activeMappingData.mappings.length} Sentence Mappings
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-md border border-amber-800">
                      ⚠️ Belum Ada Data Mapping
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

            {/* Validation Banner for Active Part Mapping */}
            {activeMappingData?.mappings && activeMappingData.mappings.length > 0 && (
              <div
                className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                  activeReport.status === 'SUCCESS'
                    ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200'
                    : activeReport.status === 'WARNING'
                    ? 'bg-amber-950/30 border-amber-800/80 text-amber-200'
                    : 'bg-rose-950/30 border-rose-800/80 text-rose-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <span>
                      {activeReport.status === 'SUCCESS' ? '✅' : activeReport.status === 'WARNING' ? '⚠️' : '🔴'}
                    </span>
                    <span>{activeReport.summaryText}</span>
                    <span className="font-mono text-xs opacity-80">
                      ({activeReport.sentenceCount} Kalimat, {activeReport.totalVisualClips} Klip Visual)
                    </span>
                  </div>

                  {activeReport.issues.length > 0 && (
                    <div className="text-[11px] font-mono opacity-90 space-y-0.5 pt-1">
                      {activeReport.issues.map((iss, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span>•</span>
                          <span>{iss.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {activeReport.issues.some((i) => i.fixable) && (
                  <button
                    onClick={handleAutoFixValidation}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-600/30 transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <span>⚡</span> Auto-Fix Mapping
                  </button>
                )}
              </div>
            )}

            {/* Visual Effect Distribution & Compliance Meter */}
            {activeMappingData?.mappings && visualStats.total > 0 && (
              <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      YouTube Content ID Fair-Use Compliance
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 font-bold">
                    {visualStats.total} klip visual total
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 text-center">
                    <span className="text-[9px] font-bold text-gray-500 uppercase block">Slow Motion</span>
                    <span className="text-sm font-black text-purple-400">{getPercent(visualStats.slow_motion)}%</span>
                    <span className="text-[8px] text-gray-600 block">Target ~30%</span>
                  </div>

                  <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 text-center">
                    <span className="text-[9px] font-bold text-gray-500 uppercase block">Mirror Cut</span>
                    <span className="text-sm font-black text-purple-400">{getPercent(visualStats.mirror_cut)}%</span>
                    <span className="text-[8px] text-gray-600 block">Target ~25%</span>
                  </div>

                  <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 text-center">
                    <span className="text-[9px] font-bold text-gray-500 uppercase block">Freeze Zoom</span>
                    <span className="text-sm font-black text-purple-400">{getPercent(visualStats.freeze_frame_with_zoom)}%</span>
                    <span className="text-[8px] text-gray-600 block">Target ~20%</span>
                  </div>

                  <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 text-center">
                    <span className="text-[9px] font-bold text-gray-500 uppercase block">Video Normal</span>
                    <span className="text-sm font-black text-purple-400">{getPercent(visualStats.video_cut)}%</span>
                    <span className="text-[8px] text-gray-600 block">Target ~15%</span>
                  </div>

                  <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 text-center">
                    <span className="text-[9px] font-bold text-gray-500 uppercase block">Pan & Zoom</span>
                    <span className="text-sm font-black text-purple-400">{getPercent(visualStats.pan_and_zoom_cut)}%</span>
                    <span className="text-[8px] text-gray-600 block">Target ~10%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Mapping Timeline Toolbar */}
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

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleAutoFixValidation}
                    className="px-3 py-1.5 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                    title="Perbaiki total durasi desimal visual klip agar 100% cocok dengan VO"
                  >
                    <span>⚡</span> Auto-Fix Durasi Visual
                  </button>

                  <button
                    onClick={handleCopyJson}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <span>📋</span> Copy JSON
                  </button>
                </div>
              </div>
            )}

            {/* Mapping Timeline Table */}
            {filteredSentenceMappings.length > 0 ? (
              <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-inner">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-gray-900 border-b border-gray-800 text-[10px] uppercase font-mono text-gray-400 font-bold">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">Teks Voiceover Narasi</th>
                        <th className="py-3 px-4 w-28">Durasi VO</th>
                        <th className="py-3 px-4">Visual Clips & Effect Specs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-850">
                      {filteredSentenceMappings.map((sentence, idx) => {
                        const sNum = sentence.sentence_index ?? idx;
                        const rowIssue = activeReport.issues.find((i) => i.sentenceIndex === sNum);

                        return (
                          <tr
                            key={sNum}
                            className={`transition-colors ${
                              rowIssue?.severity === 'error'
                                ? 'bg-rose-950/40 border-l-4 border-l-rose-500 hover:bg-rose-950/60'
                                : rowIssue?.severity === 'warning'
                                ? 'bg-amber-950/30 border-l-4 border-l-amber-500 hover:bg-amber-950/50'
                                : 'hover:bg-purple-950/20'
                            }`}
                          >
                            <td className="py-3 px-4 font-mono font-bold text-gray-500 text-center">
                              {sNum}
                            </td>

                            <td className="py-3 px-4 text-white font-medium leading-relaxed max-w-xs">
                              <div>{sentence.text}</div>
                              {rowIssue && (
                                <span
                                  className={`inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded ${
                                    rowIssue.severity === 'error'
                                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                                  }`}
                                >
                                  {rowIssue.severity === 'error' ? '🔴' : '⚠️'} {rowIssue.message}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 font-mono text-purple-300 text-[11px] font-bold">
                              {sentence.duration ? sentence.duration.toFixed(2) : '0.00'}s
                              <span className="text-[10px] text-gray-500 block font-normal">
                                ({formatMinute(sentence.start)} ➔ {formatMinute(sentence.end)})
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <div className="space-y-2">
                                {sentence.visuals && sentence.visuals.map((vis, visIdx) => (
                                  <div
                                    key={visIdx}
                                    className="bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-[11px] font-mono space-y-1"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-bold uppercase text-[9px] border border-purple-800">
                                        {vis.type}
                                      </span>
                                      <span className="text-gray-400 text-[10px]">
                                        Durasi: <strong>{vis.duration ? vis.duration.toFixed(2) : '0.00'}s</strong>
                                      </span>
                                    </div>

                                    <div className="text-[10px] text-gray-400 grid grid-cols-2 gap-x-2 pt-0.5">
                                      <span>
                                        Source Start: <strong>{vis.source_start_seconds ?? vis.source_timestamp_seconds ?? 0}s</strong> ({formatMinute(vis.source_start_seconds ?? 0)})
                                      </span>
                                      {vis.slow_mo_factor && (
                                        <span>Slow Mo Factor: <strong>{vis.slow_mo_factor}x</strong></span>
                                      )}
                                      {vis.mirror_mode && (
                                        <span>Mirror Mode: <strong>{vis.mirror_mode}</strong></span>
                                      )}
                                      {vis.zoom_speed && (
                                        <span>Zoom Speed: <strong>{vis.zoom_speed}x</strong></span>
                                      )}
                                      {vis.pan_direction && (
                                        <span>Pan Direction: <strong>{vis.pan_direction}</strong></span>
                                      )}
                                    </div>

                                    {vis.color_grading_shift && (
                                      <div className="text-[9px] text-gray-500 pt-0.5 border-t border-gray-850">
                                        Color Shift: C:{vis.color_grading_shift.contrast} | B:{vis.color_grading_shift.brightness} | S:{vis.color_grading_shift.saturation}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
                  Salin prompt dengan menekan <strong>"Copy Mapping Prompt"</strong>, lalu paste ke AI bersama file video mentah. Setelah itu paste JSON output-nya via tombol <strong>"Import JSON"</strong>.
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={() => handleCopyMappingPrompt(activePart)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center gap-1.5"
                  >
                    <span>📋</span> Copy Prompt Part #{activePart}
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
