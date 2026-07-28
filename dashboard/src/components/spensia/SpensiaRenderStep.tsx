// dashboard/src/components/spensia/SpensiaRenderStep.tsx
import React, { useState, useEffect, useCallback } from 'react';
import type {
    SpensiaRenderConfig,
    SpensiaTimelineStructure,
    SpensiaRenderResult,
    WatermarkTextConfig,
    CaptionConfig,
    BgmConfig,
    VignetteConfig,
    RenderProgress,
} from '../../electron-api';
import { getDefaultSpensiaRenderConfig } from '../../utils/spensiaRenderConfig';

const api = window.electronAPI;

const POSITION_OPTIONS = [
    { value: 'top-left', label: '↖ Kiri Atas' },
    { value: 'top-center', label: '↑ Tengah Atas' },
    { value: 'top-right', label: '↗ Kanan Atas' },
    { value: 'bottom-left', label: '↙ Kiri Bawah' },
    { value: 'bottom-center', label: '↓ Tengah Bawah' },
    { value: 'bottom-right', label: '↘ Kanan Bawah' },
] as const;

const DISPLAY_MODE_OPTIONS = [
    { value: 'single-word', label: 'Single Word Pop-up' },
    { value: 'phrase', label: '2-3 Word Phrase' },
] as const;

const QUALITY_OPTIONS = [
    { value: 'fast', label: '⚡ Fast (Ultrafast)' },
    { value: 'balanced', label: '⚖️ Balanced' },
    { value: 'high', label: '🏆 High Quality' },
] as const;

// ─── Preview Canvas ───────────────────────────────────
// Scale factor: preview is 480×270, real canvas is 1920×1080 → 0.25x

const PREVIEW_SCALE = 0.25; // 480/1920 = 270/1080

const scale = (v: number) => Math.round(v * PREVIEW_SCALE);

const PreviewCanvas: React.FC<{
    config: SpensiaRenderConfig;
    sampleImageUrl: string | null;
}> = ({ config, sampleImageUrl }) => {
    const wm = config.watermark;
    const vig = config.vignette;
    const cap = config.caption;

    const getPosStyle = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            position: 'absolute',
            color: wm.colorHex,
            fontSize: `${scale(wm.fontSize)}px`,
            fontFamily: `${wm.fontFamily}, sans-serif`,
            fontWeight: 700,
            opacity: wm.opacity,
            textShadow: `${scale(2)}px ${scale(2)}px ${scale(4)}px rgba(0,0,0,0.5)`,
            whiteSpace: 'nowrap',
        };

        const m = scale(40);
        const ox = scale(wm.offsetX);
        const oy = scale(wm.offsetY);

        switch (wm.position) {
            case 'top-left': return { ...base, top: m + oy, left: m + ox };
            case 'top-center': return { ...base, top: m + oy, left: '50%', transform: `translateX(-50%) translateX(${ox}px)` };
            case 'top-right': return { ...base, top: m + oy, right: m - ox };
            case 'bottom-left': return { ...base, bottom: m + oy, left: m + ox };
            case 'bottom-center': return { ...base, bottom: m + oy, left: '50%', transform: `translateX(-50%) translateX(${ox}px)` };
            case 'bottom-right': return { ...base, bottom: m + oy, right: m - ox };
            default: return { ...base, bottom: m + oy, left: '50%', transform: `translateX(-50%)` };
        }
    };

    const vignetteStyle: React.CSSProperties = vig.enabled
        ? {
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at center, transparent 50%, ${vig.colorHex}${Math.round(vig.intensity * 100).toString(16).padStart(2, '0')} 100%)`,
            pointerEvents: 'none',
        }
        : {};

    return (
        <div className="relative mx-auto overflow-hidden border-2 border-gray-700 shadow-2xl"
            style={{ width: '480px', height: '270px', aspectRatio: '16/9' }}
        >
            {/* Background image */}
            {sampleImageUrl ? (
                <img src={sampleImageUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                    <div className="text-center text-gray-600">
                        <div className="text-4xl mb-2">🖼️</div>
                        <p className="text-xs">No preview image</p>
                    </div>
                </div>
            )}

            {/* Vignette overlay */}
            <div style={vignetteStyle} />

            {/* Watermark text overlay */}
            {wm.enabled && (
                <div style={getPosStyle()}>{wm.text}</div>
            )}

            {/* Caption sample preview */}
            {cap.enabled && (
                <div
                    className="absolute left-1/2 text-center pointer-events-none"
                    style={{
                        bottom: `${scale(cap.positionY)}px`,
                        transform: 'translateX(-50%)',
                        fontFamily: `${cap.fontName}, sans-serif`,
                        fontWeight: 700,
                    }}
                >
                    <span
                        style={{
                            fontSize: `${scale(cap.fontSize)}px`,
                            color: cap.activeColorHex,
                            textShadow: `${scale(cap.outlineWidth)}px ${scale(cap.outlineWidth)}px 0 ${cap.outlineColorHex}, -${scale(cap.outlineWidth)}px -${scale(cap.outlineWidth)}px 0 ${cap.outlineColorHex}, ${scale(cap.outlineWidth)}px -${scale(cap.outlineWidth)}px 0 ${cap.outlineColorHex}, -${scale(cap.outlineWidth)}px ${scale(cap.outlineWidth)}px 0 ${cap.outlineColorHex}, ${scale(cap.shadowDistance)}px ${scale(cap.shadowDistance)}px 0 rgba(0,0,0,0.5)`,
                        }}
                    >
                        {cap.displayMode === 'single-word' ? 'Contoh' : 'Contoh Caption'}
                    </span>
                </div>
            )}
        </div>
    );
};

// ─── Config Panel Components ──────────────────────────

const ConfigSection: React.FC<{ title: string; icon: string; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="bg-gray-900/80 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 bg-gray-950/50 flex items-center gap-2">
            <span className="text-sm">{icon}</span>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">{title}</h3>
        </div>
        <div className="p-4 space-y-3">{children}</div>
    </div>
);

const ToggleRow: React.FC<{ label: string; enabled: boolean; onChange: (v: boolean) => void }> = ({ label, enabled, onChange }) => (
    <div className="flex items-center justify-between">
        <span className="text-xs text-gray-300">{label}</span>
        <button
            onClick={() => onChange(!enabled)}
            className={`w-10 h-5 rounded-full transition-all relative ${enabled ? 'bg-emerald-500' : 'bg-gray-700'}`}
        >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${enabled ? 'left-5' : 'left-0.5'}`} />
        </button>
    </div>
);

const SliderRow: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
    suffix?: string;
}> = ({ label, value, min, max, step, onChange, suffix = '' }) => (
    <div className="space-y-1">
        <div className="flex justify-between text-xs">
            <span className="text-gray-400">{label}</span>
            <span className="text-emerald-400 font-mono font-bold">{value}{suffix}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
        />
    </div>
);

const ColorInput: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{label}</span>
        <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg border border-gray-600" style={{ backgroundColor: value }} />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-20 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-gray-200 text-center"
                maxLength={7}
            />
        </div>
    </div>
);

const SelectRow: React.FC<{
    label: string;
    value: string;
    options: readonly { value: string; label: string }[];
    onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
    <div className="space-y-1">
        <span className="text-xs text-gray-400">{label}</span>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 font-mono"
        >
            {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    </div>
);

const NumberInput: React.FC<{
    label: string;
    value: number;
    min?: number;
    max?: number;
    onChange: (v: number) => void;
    suffix?: string;
}> = ({ label, value, min, max, onChange, suffix }) => (
    <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{label}</span>
        <div className="flex items-center gap-1">
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                className="w-16 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-gray-200 text-center"
            />
            {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
        </div>
    </div>
);

// ─── Main Component ───────────────────────────────────

const SpensiaRenderStep: React.FC = () => {
    const [config, setConfig] = useState<SpensiaRenderConfig>(getDefaultSpensiaRenderConfig());
    const [timeline, setTimeline] = useState<SpensiaTimelineStructure | null>(null);
    const [sampleImageUrl, setSampleImageUrl] = useState<string | null>(null);
    const [bgms, setBgms] = useState<Array<{ name: string; path: string; url: string }>>([]);

    const [rendering, setRendering] = useState(false);
    const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
    const [renderResult, setRenderResult] = useState<SpensiaRenderResult | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3500);
    };

    const [generatingTimeline, setGeneratingTimeline] = useState(false);

    // ─── Load initial data ─────────────────────────────

    const loadData = useCallback(async () => {
        try {
            // Load saved render config
            const savedConfig = await api.readFromProject('input/spensia/spensia_render_config.json');
            if (savedConfig) {
                try {
                    const parsed = JSON.parse(savedConfig);
                    setConfig((prev) => ({ ...prev, ...parsed }));
                } catch { }
            }

            let foundImage: string | null = null;

            // Load timeline data
            const timelineData = await api.readFromProject('input/spensia/spensia_timeline.json');
            if (timelineData) {
                try {
                    const tl = JSON.parse(timelineData);
                    setTimeline(tl);

                    const firstClip = tl?.video_clips?.[0];
                    if (firstClip?.image_url) {
                        foundImage = firstClip.image_url;
                    } else if (firstClip?.image_path) {
                        foundImage = `media://content-auto/${encodeURIComponent(firstClip.image_path)}`;
                    }
                } catch { }
            }

            // Fallback: try loading segment_1.png directly
            if (!foundImage) {
                const seg1Path = 'input/spensia/images/segment_1.png';
                const exists = await api.readFromProject(seg1Path);
                if (exists !== null && exists !== undefined) {
                    foundImage = `media://content-auto/${encodeURIComponent(seg1Path)}`;
                }
            }

            if (foundImage) setSampleImageUrl(foundImage);

            // Load project assets for BGM list
            const assets = await api.listProjectAssets();
            setBgms(assets?.bgms || []);
        } catch (err) {
            console.error('Error loading Spensia render data:', err);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // ─── Generate Timeline ──────────────────────────────

    const handleGenerateTimeline = async () => {
        setGeneratingTimeline(true);
        try {
            const res = await api.generateSpensiaTimeline();
            if (res.error) {
                showToast(`⚠️ ${res.error}`);
            } else if (res.timeline) {
                setTimeline(res.timeline);
                // Preview from first clip
                const firstClip = res.timeline.video_clips?.[0];
                if (firstClip?.image_url) {
                    setSampleImageUrl(firstClip.image_url);
                } else if (firstClip?.image_path) {
                    setSampleImageUrl(`media://content-auto/${encodeURIComponent(firstClip.image_path)}`);
                }
                showToast('✅ Timeline generated successfully!');
            }
        } catch (err: any) {
            showToast(`⚠️ ${err.message}`);
        }
        setGeneratingTimeline(false);
    };

    // ─── Set as Default Config ──────────────────────────

    const handleSetDefault = async () => {
        try {
            const json = JSON.stringify(config, null, 2);
            await api.saveToProject('input/spensia/spensia_render_default.json', json);
            localStorage.setItem('spensia_render_default_config', json);
            showToast('💾 Config disimpan sebagai default!');
        } catch (err: any) {
            showToast(`⚠️ ${err.message}`);
        }
    };

    // ─── Load Default Config ────────────────────────────

    const handleLoadDefault = async () => {
        try {
            const saved = localStorage.getItem('spensia_render_default_config');
            if (saved) {
                setConfig((prev) => ({ ...prev, ...JSON.parse(saved) }));
                showToast('📂 Default config loaded!');
            } else {
                const data = await api.readFromProject('input/spensia/spensia_render_default.json');
                if (data) {
                    setConfig((prev) => ({ ...prev, ...JSON.parse(data) }));
                    showToast('📂 Default config loaded!');
                } else {
                    showToast('⚠️ Belum ada default config tersimpan.');
                }
            }
        } catch {
            showToast('⚠️ Gagal load default config.');
        }
    };

    // ─── Auto-save config ──────────────────────────────

    const saveConfig = useCallback(async (updatedConfig: SpensiaRenderConfig) => {
        try {
            const json = JSON.stringify(updatedConfig, null, 2);
            localStorage.setItem('spensia_render_config', json);
            if (api.saveToProject) {
                await api.saveToProject('input/spensia/spensia_render_config.json', json);
            }
        } catch (err) {
            console.error('Error saving render config:', err);
        }
    }, []);

    const updateConfig = useCallback(
        <K extends keyof SpensiaRenderConfig>(key: K, value: SpensiaRenderConfig[K]) => {
            setConfig((prev) => {
                const updated = { ...prev, [key]: value };
                saveConfig(updated);
                return updated;
            });
        },
        [saveConfig]
    );

    const updateWatermark = useCallback(
        (patch: Partial<WatermarkTextConfig>) => {
            setConfig((prev) => {
                const updated = { ...prev, watermark: { ...prev.watermark, ...patch } };
                saveConfig(updated);
                return updated;
            });
        },
        [saveConfig]
    );

    const updateCaption = useCallback(
        (patch: Partial<CaptionConfig>) => {
            setConfig((prev) => {
                const updated = { ...prev, caption: { ...prev.caption, ...patch } };
                saveConfig(updated);
                return updated;
            });
        },
        [saveConfig]
    );

    const updateBgm = useCallback(
        (patch: Partial<BgmConfig>) => {
            setConfig((prev) => {
                const updated = { ...prev, bgm: { ...prev.bgm, ...patch } };
                saveConfig(updated);
                return updated;
            });
        },
        [saveConfig]
    );

    const updateVignette = useCallback(
        (patch: Partial<VignetteConfig>) => {
            setConfig((prev) => {
                const updated = { ...prev, vignette: { ...prev.vignette, ...patch } };
                saveConfig(updated);
                return updated;
            });
        },
        [saveConfig]
    );

    // ─── Render Action ─────────────────────────────────

    const handleRender = async () => {
        if (!timeline) {
            showToast('⚠️ Tidak ada timeline data. Generate timeline dulu di step sebelumnya.');
            return;
        }

        if (!timeline.video_clips || timeline.video_clips.length === 0) {
            showToast('⚠️ Timeline tidak memiliki video clips.');
            return;
        }

        setRendering(true);
        setRenderError(null);
        setRenderResult(null);

        try {
            const res = await api.renderSpensiaVideo(config, timeline);
            if ('error' in res && res.error) {
                setRenderError(res.error as string);
                showToast('❌ Render gagal!');
            } else {
                setRenderResult(res as SpensiaRenderResult);
                showToast('🎉 Render Spensia selesai!');
            }
        } catch (err: any) {
            setRenderError(err?.message || 'Unknown render error');
            showToast('❌ Render gagal!');
        }
        setRendering(false);
    };

    // ─── Render Progress Listener ──────────────────────

    useEffect(() => {
        const cleanup = api.onRenderProgress((data) => {
            setRenderProgress(data);
            if (data.stage === 'done' || data.stage === 'error') {
                setRendering(false);
            }
        });
        return cleanup;
    }, []);

    // ─── Generate Preview Frame ────────────────────────

    const handleGeneratePreview = async () => {
        if (!sampleImageUrl && timeline?.video_clips[0]?.image_path) {
            const imgPath = timeline.video_clips[0].image_path;
            try {
                const res = await api.renderSpensiaPreviewFrame(config, imgPath);
                if (res.url) {
                    setSampleImageUrl(res.url);
                    showToast('🖼️ Preview frame generated!');
                } else if (res.error) {
                    showToast(`⚠️ Preview error: ${res.error}`);
                }
            } catch (err: any) {
                showToast(`⚠️ Preview error: ${err.message}`);
            }
        } else if (timeline?.video_clips[0]?.image_path) {
            try {
                const imgPath = timeline.video_clips[0].image_path;
                const res = await api.renderSpensiaPreviewFrame(config, imgPath);
                if (res.url) {
                    setSampleImageUrl(res.url);
                    showToast('🖼️ Preview frame generated!');
                } else if (res.error) {
                    showToast(`⚠️ Preview error: ${res.error}`);
                }
            } catch (err: any) {
                showToast(`⚠️ Preview error: ${err.message}`);
            }
        } else {
            showToast('⚠️ Tidak ada sample image untuk preview.');
        }
    };

    // ─── Timeline Summary ──────────────────────────────

    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    const part1Clips = timeline?.video_clips.filter((c) => c.part_id === 1) || [];
    const part2Clips = timeline?.video_clips.filter((c) => c.part_id === 2) || [];
    const part1Dur = part1Clips.reduce((s, c) => s + c.duration_sec, 0);
    const part2Dur = part2Clips.reduce((s, c) => s + c.duration_sec, 0);

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-16 animate-in fade-in duration-300">
            {/* Toast */}
            {toast && (
                <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-2xl font-semibold text-xs flex items-center gap-2 border border-emerald-400/30 animate-bounce">
                    <span>{toast}</span>
                </div>
            )}

            {/* Header */}
            <div className="bg-gradient-to-r from-rose-950/90 via-gray-900 to-gray-950 p-6 rounded-3xl border border-rose-800/40 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                                🎬 Spensia AI Workflow — Step 7
                            </span>
                        </div>
                        <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                            <span>🎬</span> Spensia Render Studio (16:9)
                        </h1>
                        <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
                            Konfigurasi final rendering untuk video 16:9 (1920×1080) YouTube longform — watermark teks, caption, BGM, dan vignette.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {!timeline && (
                            <button
                                onClick={handleGenerateTimeline}
                                disabled={generatingTimeline}
                                className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <span>{generatingTimeline ? '⏳' : '📊'}</span>
                                <span>{generatingTimeline ? 'Generating...' : 'Generate Timeline'}</span>
                            </button>
                        )}
                        <button
                            onClick={handleRender}
                            disabled={rendering || !timeline}
                            className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span>{rendering ? '⏳' : '🚀'}</span>
                            <span>{rendering ? 'Rendering...' : 'Render Spensia Video'}</span>
                        </button>
                        <button
                            onClick={handleGeneratePreview}
                            className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold border border-gray-700 flex items-center gap-1.5"
                        >
                            <span>🖼️</span>
                            <span>Generate Preview</span>
                        </button>
                        <div className="flex items-center gap-1 ml-1">
                            <button
                                onClick={handleSetDefault}
                                className="px-2.5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold border border-gray-700 flex items-center gap-1"
                                title="Simpan config sebagai default"
                            >
                                <span>💾</span>
                            </button>
                            <button
                                onClick={handleLoadDefault}
                                className="px-2.5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold border border-gray-700 flex items-center gap-1"
                                title="Load default config"
                            >
                                <span>📂</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* LEFT: Preview + Render Status (col-span-5) */}
                <div className="lg:col-span-5 space-y-5">
                    {/* Preview Canvas */}
                    <div className="bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-xl">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
                            <h3 className="text-xs font-bold text-white flex items-center gap-2">
                                <span>👁️</span> Live Preview (CSS Overlay)
                            </h3>
                            <span className="text-[10px] text-gray-500 font-mono">1920×1080</span>
                        </div>
                        <div className="flex justify-center">
                            <PreviewCanvas config={config} sampleImageUrl={sampleImageUrl} />
                        </div>
                    </div>

                    {/* Render Progress */}
                    {rendering && renderProgress && (
                        <div className="bg-gray-900/80 p-5 rounded-3xl border border-rose-800/40 shadow-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-rose-400 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                    Stage: {renderProgress.stage}
                                </span>
                                <span className="text-xs font-mono text-gray-300">{Math.round(renderProgress.progress * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-rose-500 to-pink-500 h-full transition-all duration-500"
                                    style={{ width: `${renderProgress.progress * 100}%` }}
                                />
                            </div>
                            <p className="text-[11px] text-gray-400 font-mono truncate">{renderProgress.message}</p>
                        </div>
                    )}

                    {/* Render Result */}
                    {renderResult && (
                        <div className="bg-emerald-950/60 p-5 rounded-3xl border border-emerald-800/50 shadow-xl space-y-3">
                            <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                                <span>✅</span> Render Complete
                            </h3>
                            <p className="text-xs text-emerald-300 font-mono truncate">{renderResult.fileName}</p>
                            {renderResult.mediaUrl && (
                                <video src={renderResult.mediaUrl} controls className="w-full rounded-xl max-h-60 bg-black" />
                            )}
                        </div>
                    )}

                    {renderError && (
                        <div className="bg-red-950/60 p-5 rounded-3xl border border-red-800/50 shadow-xl">
                            <p className="text-xs text-red-400 font-mono whitespace-pre-wrap">{renderError}</p>
                        </div>
                    )}
                </div>

                {/* RIGHT: Config Panels (col-span-7) */}
                <div className="lg:col-span-7 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
                    {/* ─── Watermark Panel ─── */}
                    <ConfigSection title="📐 Watermark Text" icon="📐">
                        <ToggleRow label="Enable Watermark" enabled={config.watermark.enabled} onChange={(v) => updateWatermark({ enabled: v })} />
                        {config.watermark.enabled && (
                            <>
                                <div className="space-y-1">
                                    <span className="text-xs text-gray-400">Text</span>
                                    <input
                                        type="text"
                                        value={config.watermark.text}
                                        onChange={(e) => updateWatermark({ text: e.target.value })}
                                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono text-gray-200"
                                        maxLength={30}
                                    />
                                </div>
                                <SelectRow label="Position" value={config.watermark.position} options={POSITION_OPTIONS} onChange={(v) => updateWatermark({ position: v as WatermarkTextConfig['position'] })} />
                                <div className="grid grid-cols-2 gap-3">
                                    <SliderRow label="Font Size" value={config.watermark.fontSize} min={8} max={120} step={1} onChange={(v) => updateWatermark({ fontSize: v })} suffix="px" />
                                    <SliderRow label="Opacity" value={config.watermark.opacity} min={0} max={1} step={0.05} onChange={(v) => updateWatermark({ opacity: v })} />
                                </div>
                                <ColorInput label="Color" value={config.watermark.colorHex} onChange={(v) => updateWatermark({ colorHex: v })} />
                                <div className="grid grid-cols-2 gap-3">
                                    <SliderRow label="Offset X" value={config.watermark.offsetX} min={-200} max={200} step={1} onChange={(v) => updateWatermark({ offsetX: v })} suffix="px" />
                                    <SliderRow label="Offset Y" value={config.watermark.offsetY} min={-200} max={200} step={1} onChange={(v) => updateWatermark({ offsetY: v })} suffix="px" />
                                </div>
                            </>
                        )}
                    </ConfigSection>

                    {/* ─── Caption Panel ─── */}
                    <ConfigSection title="📝 Caption (ASS Subtitle)" icon="📝">
                        <ToggleRow label="Enable Caption" enabled={config.caption.enabled} onChange={(v) => updateCaption({ enabled: v })} />
                        {config.caption.enabled && (
                            <>
                                <SelectRow label="Display Mode" value={config.caption.displayMode} options={DISPLAY_MODE_OPTIONS} onChange={(v) => updateCaption({ displayMode: v as CaptionConfig['displayMode'] })} />
                                <SliderRow label="Font Size" value={config.caption.fontSize} min={20} max={100} step={2} onChange={(v) => updateCaption({ fontSize: v })} suffix="px" />
                                <SliderRow label="Position Y (from bottom)" value={config.caption.positionY} min={20} max={400} step={10} onChange={(v) => updateCaption({ positionY: v })} suffix="px" />
                                <ColorInput label="Active Word Color" value={config.caption.activeColorHex} onChange={(v) => updateCaption({ activeColorHex: v })} />
                                <ColorInput label="Inactive Word Color" value={config.caption.inactiveColorHex} onChange={(v) => updateCaption({ inactiveColorHex: v })} />
                                <ColorInput label="Outline Color" value={config.caption.outlineColorHex} onChange={(v) => updateCaption({ outlineColorHex: v })} />
                                <div className="grid grid-cols-2 gap-3">
                                    <SliderRow label="Outline Width" value={config.caption.outlineWidth} min={0} max={8} step={0.5} onChange={(v) => updateCaption({ outlineWidth: v })} suffix="px" />
                                    <SliderRow label="Shadow Distance" value={config.caption.shadowDistance} min={0} max={6} step={0.5} onChange={(v) => updateCaption({ shadowDistance: v })} suffix="px" />
                                </div>
                            </>
                        )}
                    </ConfigSection>

                    {/* ─── BGM Panel ─── */}
                    <ConfigSection title="🎵 Background Music" icon="🎵">
                        <ToggleRow label="Enable BGM" enabled={config.bgm.enabled} onChange={(v) => updateBgm({ enabled: v })} />
                        {config.bgm.enabled && (
                            <>
                                <div className="space-y-1">
                                    <span className="text-xs text-gray-400">BGM File</span>
                                    <select
                                        value={config.bgm.path}
                                        onChange={(e) => updateBgm({ path: e.target.value })}
                                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 font-mono"
                                    >
                                        <option value="assets/Edge Of Unknown.mp3">Edge Of Unknown (default)</option>
                                        {bgms.map((bgm) => (
                                            <option key={bgm.path} value={`assets/${bgm.name}`}>{bgm.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <SliderRow label="Volume" value={config.bgm.volume} min={0} max={1} step={0.05} onChange={(v) => updateBgm({ volume: v })} />
                                <div className="grid grid-cols-2 gap-3">
                                    <NumberInput label="Fade In" value={config.bgm.fadeInSec} min={0} max={10} onChange={(v) => updateBgm({ fadeInSec: v })} suffix="s" />
                                    <NumberInput label="Fade Out" value={config.bgm.fadeOutSec} min={0} max={10} onChange={(v) => updateBgm({ fadeOutSec: v })} suffix="s" />
                                </div>
                            </>
                        )}
                    </ConfigSection>

                    {/* ─── Vignette Panel ─── */}
                    <ConfigSection title="🌑 Vignette" icon="🌑">
                        <ToggleRow label="Enable Vignette" enabled={config.vignette.enabled} onChange={(v) => updateVignette({ enabled: v })} />
                        {config.vignette.enabled && (
                            <>
                                <SliderRow label="Intensity" value={config.vignette.intensity} min={0} max={1} step={0.05} onChange={(v) => updateVignette({ intensity: v })} />
                                <ColorInput label="Color" value={config.vignette.colorHex} onChange={(v) => updateVignette({ colorHex: v })} />
                            </>
                        )}
                    </ConfigSection>

                    {/* ─── Output Settings ─── */}
                    <ConfigSection title="⚙️ Output Settings" icon="⚙️">
                        <SelectRow label="Render Quality" value={config.outputQuality} options={QUALITY_OPTIONS} onChange={(v) => updateConfig('outputQuality', v as SpensiaRenderConfig['outputQuality'])} />
                        <div className="grid grid-cols-2 gap-3">
                            <NumberInput label="Width" value={config.resolution.width} onChange={(v) => updateConfig('resolution', { ...config.resolution, width: v })} suffix="px" />
                            <NumberInput label="Height" value={config.resolution.height} onChange={(v) => updateConfig('resolution', { ...config.resolution, height: v })} suffix="px" />
                        </div>
                        <NumberInput label="FPS" value={config.fps} min={15} max={60} onChange={(v) => updateConfig('fps', v)} />
                    </ConfigSection>

                    {/* ─── Timeline Summary ─── */}
                    {timeline && (
                        <div className="bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-xl">
                            <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-4 pb-3 border-b border-gray-800">
                                <span>📊</span> Timeline Summary
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Part 1:</span>
                                        <span className="text-emerald-400 font-mono font-bold">
                                            {part1Clips.length} segments · {formatDuration(part1Dur)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Part 2:</span>
                                        <span className="text-emerald-400 font-mono font-bold">
                                            {part2Clips.length} segments · {formatDuration(part2Dur)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-t border-gray-800 pt-2">
                                        <span className="text-gray-400">Total Duration:</span>
                                        <span className="text-white font-mono font-bold">{formatDuration(timeline.total_duration_sec)}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Total Clips:</span>
                                        <span className="text-white font-mono font-bold">{timeline.video_clips.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Total Captions:</span>
                                        <span className="text-white font-mono font-bold">{timeline.captions.length} words</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Audio Tracks:</span>
                                        <span className="text-white font-mono font-bold">{timeline.audio_tracks.length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SpensiaRenderStep;
