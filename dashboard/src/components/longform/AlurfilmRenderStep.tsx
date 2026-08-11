import React, { useState, useEffect, useRef } from 'react';
import type { AlurfilmChunk, AlurfilmAudioResult, AlurfilmMappingResult, RenderProgress, RenderSettings } from '../../electron-api';

const api = window.electronAPI;

const DEFAULT_SETTINGS: RenderSettings = {
  narrationVolume: 1.8,
  bgmVolume: 0.18,
  bgmEnabled: true,
  bgmPath: 'assets/bgm/05_santai_misteri/Paper Map Morning.mp3',
  logoEnabled: true,
  logoPath: 'assets/logo.png',
  logoOpacity: 0.6,
  logoMargin: 40,
  logoScale: 60,
  introEnabled: true,
  introTitleText: 'UNDER THE DOME',
  introSubtitleText: 'ALUR CERITA FILM',
  introStylePreset: 'cinematic_gold',
  introDuration: 6.0,
  introImpactTimestamp: 0.48,
  introAudioPath: 'assets/The Final Horizon.mp3',
};

const AlurfilmRenderStep: React.FC = () => {
  const [contentId, setContentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [audios, setAudios] = useState<Record<number, AlurfilmAudioResult>>({});
  const [mappings, setMappings] = useState<Record<number, AlurfilmMappingResult>>({});
  
  const [activePart, setActivePart] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Render Settings State
  const [settings, setSettings] = useState<RenderSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [availableBgms, setAvailableBgms] = useState<Array<{ name: string; path: string }>>([]);
  const [availableLogos, setAvailableLogos] = useState<Array<{ name: string; path: string }>>([]);

  // Render State per Part
  const [renderingPart, setRenderingPart] = useState<number | null>(null);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [renderedOutputs, setRenderedOutputs] = useState<Record<number, string>>({});
  const [renderErrors, setRenderErrors] = useState<Record<number, string>>({});

  // Full Movie Render State
  const [isFullRendering, setIsFullRendering] = useState<boolean>(false);
  const [fullRenderProgress, setFullRenderProgress] = useState<string | null>(null);
  const [fullRenderResult, setFullRenderResult] = useState<{ filePath?: string; mediaUrl?: string; fileName?: string } | null>(null);
  const [fullRenderError, setFullRenderError] = useState<string | null>(null);

  // Intro State
  const [isRenderingIntro, setIsRenderingIntro] = useState<boolean>(false);
  const [introProgressPct, setIntroProgressPct] = useState<number>(0);
  const [introResult, setIntroResult] = useState<{ filePath?: string; mediaUrl?: string; fileName?: string } | null>(null);
  const [introError, setIntroError] = useState<string | null>(null);

  // Live Render Log Terminal & Sequence State
  const [renderLogs, setRenderLogs] = useState<Array<{ id: string; timestamp: string; level: 'info' | 'success' | 'warn' | 'error' | 'step'; message: string }>>([
    { id: '1', timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }), level: 'info', message: 'Render Engine initialized and ready.' }
  ]);
  const [renderStageStep, setRenderStageStep] = useState<number>(0);
  const [showLogsTerminal, setShowLogsTerminal] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const addLog = (message: string, level: 'info' | 'success' | 'warn' | 'error' | 'step' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const newLog = { id: Math.random().toString(36).substring(2, 9), timestamp, level, message };
    setRenderLogs((prev) => [...prev.slice(-300), newLog]);
  };

  const getNormalizedPct = (data?: RenderProgress | null) => {
    if (!data || data.progress === undefined || data.progress === null) return 0;
    const p = Number(data.progress);
    if (isNaN(p)) return 0;
    const pct = p <= 1.0 && p > 0 ? Math.round(p * 100) : Math.round(p);
    return Math.min(100, Math.max(0, pct));
  };

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [renderLogs]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load Render Settings
      if (api.getRenderSettings) {
        const loaded = await api.getRenderSettings();
        if (loaded) setSettings(loaded);
      }

      // Load Assets (BGM & Logo)
      if (api.listProjectAssets) {
        const assets = await api.listProjectAssets();
        if (assets) {
          if (assets.bgms) setAvailableBgms(assets.bgms);
          if (assets.logos) setAvailableLogos(assets.logos);
        }
      }

      const id = await api.getContentId('longform');
      setContentId(id);

      // Check existing intro video
      if (api.getAlurfilmIntro) {
        const existingIntro = await api.getAlurfilmIntro(id || undefined);
        if (existingIntro) {
          setIntroResult(existingIntro);
        }
      }

      if (id) {
        // Chunks
        const chunkList = await api.listAlurfilmChunks(id);
        setChunks(chunkList || []);

        // Audios
        const audioList = await api.listAlurfilmAudios(id);
        const aMap: Record<number, AlurfilmAudioResult> = {};
        if (audioList) {
          for (const a of audioList) {
            if (a.parts) {
              a.parts.forEach((p) => { aMap[p] = a; });
            } else if (typeof a.part === 'number') {
              aMap[a.part] = a;
            }
          }
        }
        setAudios(aMap);

        // Mappings
        const mList = await api.listAlurfilmMappings(id);
        const mMap: Record<number, AlurfilmMappingResult> = {};
        if (mList) { for (const m of mList) mMap[m.part] = m; }
        setMappings(mMap);

        // List existing rendered video files
        const renders = await api.listRenders();
        const rMap: Record<number, string> = {};
        if (renders) {
          for (const r of renders) {
            const match = r.name?.match(/part_(\d+)/i) || r.name?.match(/P(\d+)/i);
            if (match) {
              const partNum = parseInt(match[1], 10);
              rMap[partNum] = r.fullPath || r.filePath;
            }
          }
        }
        setRenderedOutputs(rMap);

        if (chunkList && chunkList.length > 0) {
          setActivePart(chunkList[0].part);
        }
      }
    } catch (err: any) {
      console.error(err);
      addLog(`Error loading data: ${err.message}`, 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    const cleanup = api.onRenderProgress((data) => {
      setRenderProgress(data);
      if (data.message) {
        const level = data.stage === 'error' ? 'error' : data.stage === 'done' ? 'success' : 'info';
        addLog(`[${data.stage.toUpperCase()}] ${data.message}`, level);
      }
      if (data.stage === 'done' || data.stage === 'error') {
        setRenderingPart(null);
      }
    });

    let cleanupIntro: (() => void) | undefined;
    if (api.onAlurfilmIntroProgress) {
      cleanupIntro = api.onAlurfilmIntroProgress((data) => {
        if (data.percent !== undefined) setIntroProgressPct(data.percent);
        if (data.msg) addLog(`[INTRO] ${data.msg}`, 'info');
      });
    }

    return () => {
      cleanup();
      if (cleanupIntro) cleanupIntro();
    };
  }, []);

  const handleSaveSettings = async () => {
    if (!api.saveRenderSettings) return;
    setSavingSettings(true);
    try {
      const res = await api.saveRenderSettings(settings);
      if (res.success && res.settings) {
        setSettings(res.settings);
        addLog('⚙️ Render settings saved to input/render_settings.json', 'success');
        showToast('⚙️ Setting Render Berhasil Disimpan ke File JSON!');
      } else {
        alert(`Gagal menyimpan setting: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetSettings = async () => {
    setSettings(DEFAULT_SETTINGS);
    if (api.saveRenderSettings) {
      await api.saveRenderSettings(DEFAULT_SETTINGS);
      addLog('🔄 Render settings reset to defaults', 'info');
      showToast('🔄 Setting Render Direset ke Nilai Standar Default!');
    }
  };

  const handleRenderIntro = async (): Promise<{ success: boolean; filePath?: string; error?: string }> => {
    setIsRenderingIntro(true);
    setIntroError(null);
    setIntroProgressPct(0);
    setRenderStageStep(2);
    addLog(`[STEP] 🎬 Starting Cinematic Intro Render ("${settings.introTitleText || 'UNDER THE DOME'}")...`, 'step');

    try {
      if (!api.renderAlurfilmIntroTest) {
        throw new Error('IPC renderAlurfilmIntroTest tidak tersedia.');
      }

      const res = await api.renderAlurfilmIntroTest({
        titleText: settings.introTitleText || 'UNDER THE DOME',
        subtitleText: settings.introSubtitleText || 'ALUR CERITA FILM',
        audioPath: settings.introAudioPath || 'assets/The Final Horizon.mp3',
        impactTimestamp: settings.introImpactTimestamp ?? 0.48,
        duration: settings.introDuration ?? 6.0,
        stylePreset: (settings.introStylePreset as any) || 'cinematic_gold',
      });

      if (res && res.success && res.outputPath) {
        const mediaUrl = api.getMediaUrl ? api.getMediaUrl(res.outputPath) : `media://content-auto/${encodeURIComponent(res.outputPath)}`;
        const resultObj = { filePath: res.outputPath, mediaUrl, fileName: res.outputPath.split('/').pop() || 'intro.mp4' };
        setIntroResult(resultObj);
        addLog(`🎉 Cinematic Intro Video Ready: ${res.outputPath}`, 'success');
        showToast('🎉 Render Intro Sinematik Berhasil!');
        return { success: true, filePath: res.outputPath };
      } else {
        const errMsg = res?.error || 'Gagal me-render Intro';
        setIntroError(errMsg);
        addLog(`❌ Render Intro error: ${errMsg}`, 'error');
        return { success: false, error: errMsg };
      }
    } catch (err: any) {
      const errMsg = err.message || 'Render Intro Exception';
      setIntroError(errMsg);
      addLog(`❌ Render Intro exception: ${errMsg}`, 'error');
      return { success: false, error: errMsg };
    } finally {
      setIsRenderingIntro(false);
    }
  };

  const handleRenderPart = async (partNum: number) => {
    const chunkInfo = chunks.find((c) => c.part === partNum);
    const audioInfo = audios[partNum];
    const mappingInfo = mappings[partNum];

    if (!chunkInfo || !audioInfo || !mappingInfo?.data) {
      alert(`Missing required files for Part #${partNum}! Needs Video Chunk, Voiceover Audio, and Video Mapping.`);
      return;
    }

    // MANDATORY INTRO CHECK BEFORE PARTIAL RENDER
    if (settings.introEnabled !== false && !introResult?.filePath) {
      addLog(`[STEP 0] 🎬 Mandatory Intro Check: Intro belum dirender! Me-render Intro sinematik terlebih dahulu...`, 'step');
      const introRes = await handleRenderIntro();
      if (!introRes.success) {
        addLog(`❌ Cancelled Part #${partNum} render because Intro render failed: ${introRes.error}`, 'error');
        alert(`Gagal me-render Intro wajib: ${introRes.error}. Render Part #${partNum} dibatalkan.`);
        return;
      }
    }

    setRenderingPart(partNum);
    setRenderProgress({ stage: 'starting', progress: 0, message: `Starting Alurfilm FFmpeg render for Part #${partNum}...` });
    addLog(`[STEP] ⚡ Starting Part #${partNum} Render pipeline...`, 'step');

    try {
      const res = await api.renderAlurfilmPart(
        partNum,
        chunkInfo.filePath,
        audioInfo.filePath,
        mappingInfo.data,
        settings
      );

      if (res.error) {
        setRenderErrors((prev) => ({ ...prev, [partNum]: res.error! }));
        addLog(`❌ Part #${partNum} Render error: ${res.error}`, 'error');
      } else if (res.outputPath) {
        setRenderedOutputs((prev) => ({ ...prev, [partNum]: res.outputPath }));
        addLog(`🎉 Part #${partNum} Render Complete: ${res.outputPath}`, 'success');
        showToast(`🎉 Part #${partNum} Render Completed Successfully!`);
      }
    } catch (err: any) {
      setRenderErrors((prev) => ({ ...prev, [partNum]: err.message || 'Render failed' }));
      addLog(`❌ Part #${partNum} Exception: ${err.message}`, 'error');
    }
    setRenderingPart(null);
  };

  const handleRenderFullMovie = async () => {
    if (!chunks || chunks.length === 0) return;
    const allParts = chunks.map((c) => c.part).sort((a, b) => a - b);

    setIsFullRendering(true);
    setFullRenderError(null);
    setRenderStageStep(1);
    setFullRenderProgress('Starting full movie recap render pipeline...');
    addLog('====================================================', 'info');
    addLog(`🚀 [START] Full Movie Recap Pipeline for ${allParts.length} Parts...`, 'step');
    addLog('[STEP 1/4] 🔍 Checking pre-flight file dependencies for all parts...', 'info');

    try {
      // Step 1: Render any unrendered parts sequentially first
      const currentOutputs = { ...renderedOutputs };
      for (let i = 0; i < allParts.length; i++) {
        const partNum = allParts[i];
        if (!currentOutputs[partNum]) {
          const chunkInfo = chunks.find((c) => c.part === partNum);
          const audioInfo = audios[partNum];
          const mappingInfo = mappings[partNum];

          if (!chunkInfo || !audioInfo || !mappingInfo?.data) {
            throw new Error(`Part #${partNum} belum siap (butuh Video Chunk, Voiceover Audio, dan Video Mapping).`);
          }

          setRenderingPart(partNum);
          setRenderStageStep(2);
          setFullRenderProgress(`Rendering Part #${partNum} (${i + 1}/${allParts.length})...`);
          addLog(`[STEP 2/4] ⚡ Rendering missing Part #${partNum} (${i + 1}/${allParts.length})...`, 'step');
          
          const res = await api.renderAlurfilmPart(
            partNum,
            chunkInfo.filePath,
            audioInfo.filePath,
            mappingInfo.data,
            settings
          );

          if (res.error) {
            throw new Error(`Part #${partNum} render error: ${res.error}`);
          } else if (res.outputPath) {
            currentOutputs[partNum] = res.outputPath;
            setRenderedOutputs((prev) => ({ ...prev, [partNum]: res.outputPath }));
            addLog(`✅ Part #${partNum} finished: ${res.outputPath}`, 'success');
          }
        } else {
          addLog(`✓ Part #${partNum} already rendered: ${currentOutputs[partNum]}`, 'info');
        }
      }

      setRenderingPart(null);

      // Step 2: Concat all rendered parts and overlay BGM & Logo & Intro
      setRenderStageStep(3);
      if (settings.introEnabled) {
        addLog(`[STEP 3/4] 🎬 Generating Cinematic Title Intro: "${settings.introTitleText || 'UNDER THE DOME'}"...`, 'step');
      } else {
        addLog('[STEP 3/4] ⏩ Intro title skipped (disabled in settings).', 'info');
      }

      setRenderStageStep(4);
      addLog(`[STEP 4/4] 🎵 Concatenating all ${allParts.length} parts with BGM, VO boost (${settings.narrationVolume}x), and Logo Watermark...`, 'step');
      setFullRenderProgress(`Merging all ${allParts.length} parts with BGM & Logo...`);

      if (api.concatAlurfilmFinalVideo) {
        const res = await api.concatAlurfilmFinalVideo(allParts, settings);

        if (res.error) {
          setFullRenderError(res.error);
          addLog(`❌ Full Movie Render Concat Error: ${res.error}`, 'error');
        } else if (res.filePath) {
          setFullRenderResult(res);
          setRenderStageStep(5);
          addLog(`🎉 [SUCCESS] Master Movie Recap Video Ready: ${res.filePath}`, 'success');
          addLog('====================================================', 'info');
          showToast('🎉 Full Movie Recap Render Completed Successfully!');
        }
      }
    } catch (err: any) {
      setFullRenderError(err.message || 'Full movie render failed');
      addLog(`❌ Full Movie Exception: ${err.message}`, 'error');
    } finally {
      setIsFullRendering(false);
      setRenderingPart(null);
      setFullRenderProgress(null);
    }
  };

  const currentChunk = chunks.find((c) => c.part === activePart);
  const currentAudio = audios[activePart];
  const currentMapping = mappings[activePart]?.data;
  const currentRenderPath = renderedOutputs[activePart];
  const currentError = renderErrors[activePart];

  const isPartReady = !!(currentChunk && currentAudio && currentMapping);

  return (
    <div className="flex flex-col min-h-full bg-gray-950 text-gray-100 space-y-4 pb-12">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-purple-600 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg border border-purple-400 animate-bounce">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-800 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="p-2 bg-purple-600/20 text-purple-400 rounded-lg text-lg">🎬</span>
            Alur Film Part Render & Concatenator (16:9)
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Execute high-fidelity 16:9 FFmpeg video rendering per part chunk and concatenate full movie recap.
          </p>
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
            showSettings
              ? 'bg-purple-600/30 border-purple-500 text-purple-200'
              : 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <span>⚙️</span>
          <span>{showSettings ? 'Sembunyikan Setting' : 'Pengaturan Render & Audio'}</span>
        </button>
      </div>

      {/* Render Settings Panel (Persistent JSON File: input/render_settings.json) */}
      {showSettings && (
        <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-purple-950/40 border border-purple-800/50 p-5 rounded-2xl shadow-2xl mt-3 space-y-4 shrink-0 transition-all">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800/80">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-purple-400">⚙️</span> Render & Audio Settings
                <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/60 text-[10px] font-mono rounded-full">
                  Persisted: input/render_settings.json
                </span>
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Atur volume suara narasi, volume BGM, serta watermark logo. Setting ini otomatis disimpan di file JSON agar permanen.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetSettings}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg transition-all border border-gray-700"
              >
                🔄 Reset Default
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg transition-all flex items-center gap-1.5"
              >
                <span>{savingSettings ? '⌛' : '💾'}</span>
                <span>{savingSettings ? 'Menyimpan...' : 'Simpan Setting Sebagai Default'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
            {/* Audio Settings Card */}
            <div className="bg-gray-950/80 border border-gray-800 p-4 rounded-xl space-y-3">
              <h4 className="font-bold text-purple-300 flex items-center gap-1.5 pb-2 border-b border-gray-800">
                <span>🎤</span> Suara & Audio Balance
              </h4>

              {/* Volume Narasi */}
              <div className="space-y-1">
                <div className="flex justify-between items-center font-mono text-[11px]">
                  <label className="text-gray-300">Volume Narasi / Voiceover:</label>
                  <span className="text-purple-400 font-bold">{settings.narrationVolume}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={settings.narrationVolume}
                  onChange={(e) => setSettings({ ...settings, narrationVolume: parseFloat(e.target.value) })}
                  className="w-full accent-purple-500 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Volume BGM */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between items-center font-mono text-[11px]">
                  <label className="text-gray-300">Volume Music / BGM:</label>
                  <span className="text-purple-400 font-bold">{Math.round(settings.bgmVolume * 100)}% ({settings.bgmVolume})</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.01"
                  value={settings.bgmVolume}
                  onChange={(e) => setSettings({ ...settings, bgmVolume: parseFloat(e.target.value) })}
                  className="w-full accent-purple-500 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* BGM Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-gray-300">Aktifkan BGM:</span>
                <input
                  type="checkbox"
                  checked={settings.bgmEnabled}
                  onChange={(e) => setSettings({ ...settings, bgmEnabled: e.target.checked })}
                  className="accent-purple-600 w-4 h-4 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* BGM File Selector Card */}
            <div className="bg-gray-950/80 border border-gray-800 p-4 rounded-xl space-y-3">
              <h4 className="font-bold text-indigo-300 flex items-center gap-1.5 pb-2 border-b border-gray-800">
                <span>🎵</span> File BGM Default
              </h4>

              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-400 block">Pilih BGM dari Folder Assets:</label>
                {availableBgms.length > 0 ? (
                  <select
                    value={settings.bgmPath}
                    onChange={(e) => setSettings({ ...settings, bgmPath: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2 text-[11px] font-mono focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">-- Pilihi BGM Default --</option>
                    {availableBgms.map((b) => (
                      <option key={b.path} value={b.path}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-[11px] text-gray-500 italic">Tidak ada BGM ditemukan di folder assets/</div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-gray-400 block">Path File BGM Custom:</label>
                <input
                  type="text"
                  value={settings.bgmPath}
                  onChange={(e) => setSettings({ ...settings, bgmPath: e.target.value })}
                  placeholder="assets/bgm/filename.mp3"
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2 text-[11px] font-mono focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Logo Watermark Card */}
            <div className="bg-gray-950/80 border border-gray-800 p-4 rounded-xl space-y-3">
              <h4 className="font-bold text-emerald-300 flex items-center gap-1.5 pb-2 border-b border-gray-800">
                <span>🖼️</span> Watermark Logo Settings
              </h4>

              <div className="flex items-center justify-between">
                <span className="text-gray-300">Aktifkan Logo Watermark:</span>
                <input
                  type="checkbox"
                  checked={settings.logoEnabled}
                  onChange={(e) => setSettings({ ...settings, logoEnabled: e.target.checked })}
                  className="accent-purple-600 w-4 h-4 rounded cursor-pointer"
                />
              </div>

              {/* Opacity */}
              <div className="space-y-1">
                <div className="flex justify-between items-center font-mono text-[11px]">
                  <label className="text-gray-300">Transparansi Logo (Opacity):</label>
                  <span className="text-emerald-400 font-bold">{Math.round(settings.logoOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={settings.logoOpacity}
                  onChange={(e) => setSettings({ ...settings, logoOpacity: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Scale & Margin */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400 block">Height (px):</label>
                  <input
                    type="number"
                    value={settings.logoScale}
                    onChange={(e) => setSettings({ ...settings, logoScale: parseInt(e.target.value, 10) || 60 })}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-1.5 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400 block">Margin (px):</label>
                  <input
                    type="number"
                    value={settings.logoMargin}
                    onChange={(e) => setSettings({ ...settings, logoMargin: parseInt(e.target.value, 10) || 40 })}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-1.5 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Cinematic Intro Card */}
            <div className="bg-gray-950/80 border border-amber-900/50 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span>🎬</span> Title Intro Sinematik
                </h4>
                <input
                  type="checkbox"
                  checked={settings.introEnabled ?? true}
                  onChange={(e) => setSettings({ ...settings, introEnabled: e.target.checked })}
                  className="accent-amber-500 w-4 h-4 rounded cursor-pointer"
                />
              </div>

              {/* Title Text */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <label className="text-gray-300">Judul Intro (Title):</label>
                  <button
                    type="button"
                    onClick={async () => {
                      if (api.getAlurfilmMetadata) {
                        const meta = await api.getAlurfilmMetadata(contentId || undefined);
                        if (meta) {
                          const titleToUse = meta.selectedTitle || (meta.titles && meta.titles[0]?.title);
                          if (titleToUse) {
                            setSettings((prev) => ({ ...prev, introTitleText: titleToUse.toUpperCase() }));
                            showToast(`✨ Judul Intro diisi dari Metadata: "${titleToUse}"`);
                            return;
                          }
                        }
                      }
                      showToast('⚠️ Metadata judul belum tersedia.');
                    }}
                    className="text-[10px] text-amber-400 hover:underline font-mono"
                  >
                    ✨ Auto-Fill Metadata
                  </button>
                </div>
                <input
                  type="text"
                  value={settings.introTitleText || ''}
                  onChange={(e) => setSettings({ ...settings, introTitleText: e.target.value })}
                  placeholder="UNDER THE DOME"
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2 text-[11px] font-mono focus:border-amber-500 focus:outline-none uppercase"
                />
              </div>

              {/* Subtitle Text */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-400 block">Subjudul Intro (Subtitle):</label>
                <input
                  type="text"
                  value={settings.introSubtitleText || ''}
                  onChange={(e) => setSettings({ ...settings, introSubtitleText: e.target.value })}
                  placeholder="ALUR CERITA FILM"
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2 text-[11px] font-mono focus:border-amber-500 focus:outline-none uppercase"
                />
              </div>

              {/* Style Preset */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-400 block">Preset Gaya Sinematik:</label>
                <select
                  value={settings.introStylePreset || 'cinematic_gold'}
                  onChange={(e) => setSettings({ ...settings, introStylePreset: e.target.value as any })}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-1.5 text-[11px] font-mono focus:border-amber-500 focus:outline-none"
                >
                  <option value="cinematic_gold">🏆 Cinematic Gold (Emas Sinematik)</option>
                  <option value="silver_epic">⚔️ Silver Epic (Perak Epik)</option>
                  <option value="neon_thriller">⚡ Neon Thriller (Neon Misteri)</option>
                </select>
              </div>

              {/* Duration & Impact Timestamp */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400 block">Durasi (s):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={settings.introDuration || 6.0}
                    onChange={(e) => setSettings({ ...settings, introDuration: parseFloat(e.target.value) || 6.0 })}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-1.5 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400 block">Impact (s):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={settings.introImpactTimestamp || 0.48}
                    onChange={(e) => setSettings({ ...settings, introImpactTimestamp: parseFloat(e.target.value) || 0.48 })}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-1.5 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cinematic Intro Studio & Mandatory Preview Section */}
      <div className="bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-gray-900 border border-amber-500/30 p-4 rounded-2xl shadow-xl mt-3 shrink-0 flex flex-col lg:flex-row items-stretch justify-between gap-4">
        {/* Left Side: Info & Controls */}
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm">🎬</span>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Intro Studio & Mandatory Preview
              </h3>
              {introResult?.filePath ? (
                <span className="px-2 py-0.5 bg-emerald-950/90 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold rounded-full flex items-center gap-1">
                  <span>✅</span> INTRO READY
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-amber-950/90 text-amber-300 border border-amber-800 text-[10px] font-mono font-bold rounded-full flex items-center gap-1">
                  <span>⏳</span> WAJIB UNTUK PARTIAL RENDER
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleRenderIntro}
              disabled={isRenderingIntro}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 border ${
                isRenderingIntro
                  ? 'bg-amber-800/80 border-amber-700 text-amber-200 cursor-not-allowed animate-pulse'
                  : 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 border-amber-400 text-black shadow-amber-600/20'
              }`}
            >
              <span>{isRenderingIntro ? '⌛' : '⚡'}</span>
              <span>{isRenderingIntro ? 'Rendering Intro...' : 'Render Intro Only'}</span>
            </button>
          </div>

          <p className="text-[11px] text-gray-300 leading-relaxed">
            Intro sinematik 16:9 wajib dirender sebelum me-render part video lainnya. Anda dapat me-render dan memutar preview Intro secara independen di sini.
          </p>

          {/* Settings Quick Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-gray-950/80 p-2.5 rounded-xl border border-gray-800 text-xs font-mono">
            <div>
              <span className="text-gray-400 text-[10px] block">TITLE:</span>
              <span className="text-amber-300 font-bold truncate block">{settings.introTitleText || 'UNDER THE DOME'}</span>
            </div>
            <div>
              <span className="text-gray-400 text-[10px] block">SUBTITLE:</span>
              <span className="text-gray-200 block truncate">{settings.introSubtitleText || 'ALUR CERITA FILM'}</span>
            </div>
            <div>
              <span className="text-gray-400 text-[10px] block">PRESET / DURATION:</span>
              <span className="text-purple-300 block truncate">{settings.introStylePreset || 'cinematic_gold'} ({settings.introDuration || 6}s)</span>
            </div>
          </div>

          {/* Progress bar if rendering intro */}
          {isRenderingIntro && (
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] font-mono text-amber-300">
                <span>Rendering Intro Video...</span>
                <span>{introProgressPct}%</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-amber-950">
                <div
                  className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full transition-all duration-200"
                  style={{ width: `${Math.max(5, introProgressPct)}%` }}
                />
              </div>
            </div>
          )}

          {introError && (
            <div className="p-2 bg-red-950/80 border border-red-800 rounded-lg text-[11px] text-red-200 font-mono">
              ❌ Intro Render Error: {introError}
            </div>
          )}
        </div>

        {/* Right Side: Intro Video Player Preview */}
        <div className="w-full lg:w-72 aspect-video bg-black rounded-xl border border-amber-500/20 overflow-hidden flex flex-col justify-center items-center relative shrink-0">
          {introResult?.mediaUrl ? (
            <video
              src={introResult.mediaUrl}
              controls
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <div className="p-4 text-center space-y-2">
              <span className="text-3xl opacity-40">🎬</span>
              <p className="text-[11px] text-gray-400">
                Preview Intro MP4 akan muncul di sini setelah dirender.
              </p>
              <button
                type="button"
                onClick={handleRenderIntro}
                disabled={isRenderingIntro}
                className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold rounded-lg transition-all"
              >
                Render Intro Sekarang
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top Banner: Full Movie Recap Render Controls */}
      <div className="bg-gradient-to-r from-purple-950/80 via-gray-900 to-indigo-950/80 border border-purple-800/40 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 mt-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold text-lg shrink-0">
            🎬
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex flex-wrap items-center gap-2">
              Render Full Movie Recap (All {chunks.length} Parts)
              {settings.introEnabled && (
                <span className="px-2 py-0.5 bg-amber-950/80 text-amber-300 text-[10px] font-mono rounded-full border border-amber-500/30 flex items-center gap-1">
                  <span>🎬</span> Intro Title: {settings.introTitleText || 'ACTIVE'}
                </span>
              )}
              <span className="px-2 py-0.5 bg-purple-600/30 text-purple-300 text-[10px] font-mono rounded-full border border-purple-500/30">
                VO {settings.narrationVolume}x + BGM {settings.bgmVolume}
              </span>
            </h3>
            <p className="text-[11px] text-gray-400">
              Concatenate all video parts into one master movie recap with Thomas Newman mystery BGM.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowLogsTerminal(!showLogsTerminal)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-900 border border-gray-700 text-gray-300 hover:text-white flex items-center gap-1.5"
          >
            <span>🖥️</span>
            <span>{showLogsTerminal ? 'Sembunyikan Terminal' : 'Live Log Terminal'}</span>
          </button>
          <button
            onClick={handleRenderFullMovie}
            disabled={isFullRendering || chunks.length === 0}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 ${
              isFullRendering
                ? 'bg-purple-800 text-purple-200 cursor-not-allowed animate-pulse'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
            }`}
          >
            <span>{isFullRendering ? '⌛' : '🍿'}</span>
            <span>{isFullRendering ? 'Rendering Full Movie...' : 'Render Full Movie Recap'}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar Component (Fixed Bug: normalized 0-100%) */}
      {(isFullRendering || renderingPart !== null) && (
        <div className="bg-gray-950 p-4 rounded-2xl border border-purple-900/60 mt-3 space-y-2.5 shrink-0 shadow-inner">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-purple-400 font-bold flex items-center gap-2">
              <span className="animate-spin">⚡</span>
              {isFullRendering ? 'Full Movie Concat Pipeline Progress' : `Part #${renderingPart} FFmpeg Render Progress`}
            </span>
            <span className="text-purple-300 font-bold font-mono text-sm">
              {getNormalizedPct(renderProgress)}%
            </span>
          </div>
          <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden border border-purple-950">
            <div
              className="bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-400 h-full transition-all duration-300 shadow-lg shadow-purple-500/50"
              style={{ width: `${Math.max(3, getNormalizedPct(renderProgress))}%` }}
            />
          </div>
          <div className="p-2 bg-gray-900/90 rounded-lg border border-gray-800 text-[11px] font-mono text-gray-300 leading-relaxed truncate">
            <span className="text-purple-400 font-bold me-2">[FFmpeg LOG]</span>
            {renderProgress?.message || fullRenderProgress || 'Initializing FFmpeg process...'}
          </div>
        </div>
      )}

      {/* Live Render Sequence & Terminal Console Log Panel */}
      {showLogsTerminal && (
        <div className="bg-gray-950 border border-gray-800 p-4 rounded-2xl shadow-2xl mt-3 space-y-3 shrink-0">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800/80">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                🖥️ Live Render Terminal & Sequence Log
              </span>
              <span className="text-[10px] text-gray-500 font-mono">({renderLogs.length} events logged)</span>
            </div>

            {/* Sequence Stage Tracker */}
            <div className="hidden lg:flex items-center gap-1 text-[10px] font-mono font-bold">
              <span className={`px-2 py-0.5 rounded ${renderStageStep >= 1 ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-gray-900 text-gray-600'}`}>1. Pre-flight</span>
              <span className="text-gray-700">➔</span>
              <span className={`px-2 py-0.5 rounded ${renderStageStep >= 2 ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-gray-900 text-gray-600'}`}>2. Intro</span>
              <span className="text-gray-700">➔</span>
              <span className={`px-2 py-0.5 rounded ${renderStageStep >= 3 ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'bg-gray-900 text-gray-600'}`}>3. Parts Render</span>
              <span className="text-gray-700">➔</span>
              <span className={`px-2 py-0.5 rounded ${renderStageStep >= 4 ? 'bg-blue-950 text-blue-300 border border-blue-800' : 'bg-gray-900 text-gray-600'}`}>4. Concat Master</span>
              <span className="text-gray-700">➔</span>
              <span className={`px-2 py-0.5 rounded ${renderStageStep >= 5 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-gray-900 text-gray-600'}`}>5. Done</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const text = renderLogs.map(l => `[${l.timestamp}] ${l.message}`).join('\n');
                  navigator.clipboard.writeText(text);
                  showToast('📋 Log berhasil disalin ke clipboard!');
                }}
                className="px-2.5 py-1 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white text-[10px] font-mono rounded border border-gray-800"
              >
                📋 Copy Log
              </button>
              <button
                onClick={() => setRenderLogs([])}
                className="px-2.5 py-1 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white text-[10px] font-mono rounded border border-gray-800"
              >
                🧹 Clear Log
              </button>
            </div>
          </div>

          {/* Terminal Console Output */}
          <div
            ref={logContainerRef}
            className="h-32 overflow-y-auto bg-[#070a12] p-3 rounded-xl border border-gray-900 text-[11px] font-mono space-y-1 select-text scrollbar-thin scrollbar-thumb-gray-800"
          >
            {renderLogs.map((log) => {
              let colorClass = 'text-gray-300';
              if (log.level === 'step') colorClass = 'text-amber-400 font-bold';
              else if (log.level === 'success') colorClass = 'text-emerald-400 font-bold';
              else if (log.level === 'error') colorClass = 'text-red-400 font-bold';
              else if (log.level === 'warn') colorClass = 'text-amber-300';

              return (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-gray-600 text-[10px] shrink-0 font-mono select-none">[{log.timestamp}]</span>
                  <span className={colorClass}>{log.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fullRenderError && (
        <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400 mt-2 font-mono shrink-0">
          ⚠️ {fullRenderError}
        </div>
      )}

      {/* Full Movie Result Player */}
      {fullRenderResult?.filePath && (
        <div className="bg-gray-900/90 border border-emerald-800/40 p-4 rounded-2xl shadow-2xl space-y-3 mt-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
              <span>🎉</span> Master Video Ready: {fullRenderResult.fileName}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">{fullRenderResult.filePath}</span>
          </div>
          <video
            src={`media://content-auto/${encodeURIComponent(fullRenderResult.filePath)}`}
            controls
            className="w-full max-h-64 rounded-xl bg-black object-contain border border-gray-800"
          />
        </div>
      )}

      {/* Main Grid Workspace with Side Parts List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-3">
        {/* SIDE COLUMN: Vertical Parts Selector (Col 2) */}
        <div className="lg:col-span-2 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800 shrink-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Parts ({chunks.length})
            </span>
            <span className="text-[10px] text-purple-400 font-mono font-bold">Render</span>
          </div>

          {chunks.length > 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
              {chunks.map((chunk) => {
                const isRendered = !!renderedOutputs[chunk.part];
                const isActive = activePart === chunk.part;
                return (
                  <button
                    key={chunk.part}
                    onClick={() => setActivePart(chunk.part)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-between border ${
                      isActive
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                        : isRendered
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/50'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <span>Part #{chunk.part}</span>
                    <span className="text-xs">{isRendered ? '✓' : '○'}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-amber-400 p-2 text-center">
              Belum ada part.
            </div>
          )}
        </div>

        {/* CENTER PANEL: Render Execution & Specs (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🚀</span> Part #{activePart} Render Controls
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                FFmpeg 16:9 movie recap renderer engine.
              </p>
            </div>
          </div>

          {/* Readiness Checks */}
          <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-2 text-xs">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block">Render Prerequisites:</span>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">10-Min Video Chunk:</span>
              <span className={currentChunk ? 'text-emerald-400 font-bold' : 'text-gray-600'}>{currentChunk ? '✓ Ready' : '○ Missing'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Voiceover Audio File:</span>
              <span className={currentAudio ? 'text-emerald-400 font-bold' : 'text-gray-600'}>{currentAudio ? '✓ Ready' : '○ Missing'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Video Cuts Mapping:</span>
              <span className={currentMapping ? 'text-emerald-400 font-bold' : 'text-gray-600'}>{currentMapping ? '✓ Ready' : '○ Missing'}</span>
            </div>
          </div>

          <button
            onClick={() => handleRenderPart(activePart)}
            disabled={!isPartReady || renderingPart === activePart}
            className={`w-full py-3 rounded-xl text-xs font-bold shadow-xl transition-all flex items-center justify-center gap-2 ${
              !isPartReady || renderingPart === activePart
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
            }`}
          >
            <span>{renderingPart === activePart ? '⏳' : '⚡'}</span>
            <span>{renderingPart === activePart ? `Rendering Part #${activePart}...` : `Start Render Part #${activePart}`}</span>
          </button>

          {/* Render Progress Monitor */}
          {renderingPart === activePart && renderProgress && (
            <div className="bg-gray-950 p-4 rounded-xl border border-purple-900/50 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-purple-400 font-bold">Stage: {renderProgress.stage}</span>
                <span className="text-gray-300 font-mono">{renderProgress.progress}%</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
                <div className="bg-purple-500 h-full transition-all duration-300" style={{ width: `${renderProgress.progress}%` }} />
              </div>
              <p className="text-[11px] text-gray-400 font-mono truncate">{renderProgress.message}</p>
            </div>
          )}

          {currentError && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400 font-mono">
              {currentError}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Part Video Preview & Export Hub (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📹</span> Part #{activePart} Render Output
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Rendered 16:9 movie recap part output player.
              </p>
            </div>
          </div>

          <div className="flex-1 bg-black rounded-xl overflow-hidden flex items-center justify-center border border-gray-800 min-h-0 relative">
            {currentRenderPath ? (
              <video
                key={currentRenderPath}
                src={`media://content-auto/${encodeURIComponent(currentRenderPath)}`}
                controls
                className="w-full h-full object-contain max-h-[380px]"
              />
            ) : (
              <div className="text-center text-xs text-gray-500 p-8 space-y-2">
                <div className="w-12 h-12 bg-gray-900 text-gray-600 rounded-xl flex items-center justify-center text-xl mx-auto">
                  🎬
                </div>
                <h4 className="font-bold text-gray-400">No Rendered Output for Part #{activePart}</h4>
                <p className="text-[11px] text-gray-500">Click "Start Render Part #{activePart}" to generate video.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlurfilmRenderStep;
