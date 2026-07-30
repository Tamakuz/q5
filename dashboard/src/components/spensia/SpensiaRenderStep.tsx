// dashboard/src/components/spensia/SpensiaRenderStep.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
    SpensiaRenderConfig,
    SpensiaTimelineStructure,
    SpensiaRenderResult,
    WatermarkTextConfig,
    BgmConfig,
    VignetteConfig,
    RenderProgress,
} from '../../electron-api';
import { getDefaultSpensiaRenderConfig, VoiceOverConfig } from '../../utils/spensiaRenderConfig';

const api = window.electronAPI;

const POSITION_OPTIONS = [
    { value: 'top-left', label: '↖ Kiri Atas' },
    { value: 'top-center', label: '↑ Tengah Atas' },
    { value: 'top-right', label: '↗ Kanan Atas' },
    { value: 'bottom-left', label: '↙ Kiri Bawah' },
    { value: 'bottom-center', label: '↓ Tengah Bawah' },
    { value: 'bottom-right', label: '↘ Kanan Bawah' },
] as const;

const QUALITY_OPTIONS = [
    { value: 'fast', label: '⚡ Fast (Ultrafast)' },
    { value: 'balanced', label: '⚖️ Balanced (Recommended)' },
    { value: 'high', label: '🏆 High Quality (Slow)' },
] as const;

// ─── Preview Canvas (Scale factor: preview is 480×270, real canvas is 1920×1080 → 0.25x) ───

const PREVIEW_SCALE = 0.25; // 480/1920 = 270/1080

const scale = (v: number) => Math.round(v * PREVIEW_SCALE);

const PreviewCanvas: React.FC<{
    config: SpensiaRenderConfig;
    sampleImageUrl: string | null;
}> = ({ config, sampleImageUrl }) => {
    const wm = config.watermark;
    const vig = config.vignette;

    const getPosStyle = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            position: 'absolute',
            color: wm.colorHex,
            fontSize: `${scale(wm.fontSize)}px`,
            fontFamily: `${wm.fontFamily}, sans-serif`,
            fontWeight: 700,
            opacity: wm.opacity,
            textShadow: `${scale(2)}px ${scale(2)}px ${scale(4)}px rgba(0,0,0,0.6)`,
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

    // Darker cinematic vignette CSS gradient overlay
    const intensity = vig.intensity ?? 0.75;
    const vignetteStyle: React.CSSProperties = vig.enabled
        ? {
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at center, transparent 15%, rgba(0,0,0,${(intensity * 0.75).toFixed(2)}) 60%, rgba(0,0,0,${(intensity * 0.98).toFixed(2)}) 100%)`,
            pointerEvents: 'none',
        }
        : {};

    return (
        <div
            className="relative w-full max-w-xl aspect-video mx-auto overflow-hidden rounded-2xl border border-gray-700/80 shadow-2xl bg-black flex items-center justify-center"
            style={{ aspectRatio: '16/9' }}
        >
            {/* Background image */}
            {sampleImageUrl ? (
                <img src={sampleImageUrl} alt="Preview 16:9 YouTube Aspect Ratio" className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full bg-gray-950 flex items-center justify-center">
                    <div className="text-center text-gray-500 space-y-1">
                        <div className="text-4xl">📺</div>
                        <p className="text-xs font-mono font-bold text-gray-400">YouTube 16:9 Widescreen (1920×1080)</p>
                    </div>
                </div>
            )}

            {/* Dark Vignette overlay */}
            <div style={vignetteStyle} />

            {/* Watermark text overlay */}
            {wm.enabled && (
                <div style={getPosStyle()}>{wm.text}</div>
            )}
        </div>
    );
};

// ─── Config Panel Sub-Components ──────────────────────────

const ConfigSection: React.FC<{ title: string; icon: string; children: React.ReactNode; subtitle?: string }> = ({ title, icon, children, subtitle }) => (
    <div className="bg-gray-900/90 rounded-3xl border border-gray-800 shadow-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-800 bg-gray-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="text-base">{icon}</span>
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">{title}</h3>
            </div>
            {subtitle && <span className="text-[10px] text-gray-500 font-mono">{subtitle}</span>}
        </div>
        <div className="p-5 space-y-4">{children}</div>
    </div>
);

const ToggleRow: React.FC<{ label: string; enabled: boolean; onChange: (v: boolean) => void; description?: string }> = ({ label, enabled, onChange, description }) => (
    <div className="flex items-center justify-between gap-3">
        <div>
            <span className="text-xs font-bold text-gray-200">{label}</span>
            {description && <p className="text-[11px] text-gray-400">{description}</p>}
        </div>
        <button
            onClick={() => onChange(!enabled)}
            className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${enabled ? 'bg-rose-600 shadow-md shadow-rose-950' : 'bg-gray-800'}`}
        >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${enabled ? 'left-6' : 'left-1'}`} />
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
    description?: string;
    leftHint?: string;
    rightHint?: string;
}> = ({ label, value, min, max, step, onChange, suffix = '', description, leftHint, rightHint }) => {
    const [localVal, setLocalVal] = useState<number>(value);

    useEffect(() => {
        setLocalVal(value);
    }, [value]);

    const handleValueChange = (newVal: number) => {
        const clamped = Math.min(max, Math.max(min, isNaN(newVal) ? min : newVal));
        setLocalVal(clamped);
        onChange(clamped);
    };

    return (
        <div className="space-y-2 bg-gray-950/60 p-3.5 rounded-2xl border border-gray-800/80 shadow-inner">
            <div className="flex justify-between items-center text-xs gap-2">
                <div className="flex-1 min-w-0">
                    <span className="text-gray-200 font-bold tracking-tight">{label}</span>
                    {description && <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{description}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={Number(localVal.toFixed(step < 0.1 ? 2 : 0))}
                        onChange={(e) => handleValueChange(parseFloat(e.target.value))}
                        className="w-16 bg-gray-900 border border-rose-800/60 text-rose-300 font-mono font-bold text-xs text-center rounded-xl py-1 px-1.5 focus:border-rose-500 focus:outline-none shadow-inner"
                    />
                    {suffix && <span className="text-[11px] font-mono text-gray-400 font-bold">{suffix}</span>}
                </div>
            </div>

            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={localVal}
                onChange={(e) => handleValueChange(parseFloat(e.target.value))}
                className="w-full h-2.5 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-rose-500 border border-gray-800 shadow-inner"
            />

            <div className="flex justify-between items-center text-[10px] font-semibold text-gray-400 pt-0.5">
                <span>◀ {leftHint || `Kiri: Kecil/Meredup (${min}${suffix})`}</span>
                <span>{rightHint || `Kanan: Besar/Memperkeras (${max}${suffix})`} ▶</span>
            </div>
        </div>
    );
};

const ColorInput: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 font-medium">{label}</span>
        <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl border border-gray-700 shadow-inner" style={{ backgroundColor: value }} />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-24 bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-1 text-xs font-mono text-gray-200 text-center focus:border-rose-500 focus:outline-none"
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
        <span className="text-xs text-gray-400 font-medium">{label}</span>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 font-mono focus:border-rose-500 focus:outline-none"
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
);

const NumberInput: React.FC<{
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (v: number) => void;
    suffix?: string;
}> = ({ label, value, min, max, step = 1, onChange, suffix = '' }) => (
    <div className="space-y-1">
        <span className="text-xs text-gray-400 font-medium">{label}</span>
        <div className="flex items-center gap-1">
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 focus:border-rose-500 focus:outline-none"
            />
            {suffix && <span className="text-xs text-gray-500 font-mono shrink-0">{suffix}</span>}
        </div>
    </div>
);

// ─── Main SpensiaRenderStep Component ─────────────────────

export interface BatchTopicItem {
    id: number;
    title: string;
    summary?: string;
    hasRendered?: boolean;
    isCurrentlyRendering?: boolean;
}

const SpensiaRenderStep: React.FC<{ onStepChange?: (step: string) => void }> = () => {
    const [batchTopics, setBatchTopics] = useState<BatchTopicItem[]>([]);
    const [activeTopicId, setActiveTopicId] = useState<number | null>(null);
    const [videoTitle, setVideoTitle] = useState<string>('');

    const [config, setConfig] = useState<SpensiaRenderConfig>(() => {
        const def = getDefaultSpensiaRenderConfig();
        return {
            ...def,
            caption: { ...def.caption, enabled: false }, // Explicitly disable caption by default
            vignette: { ...def.vignette, intensity: 0.75 }, // Darker vignette default
        };
    });

    const [timeline, setTimeline] = useState<SpensiaTimelineStructure | null>(null);
    const [sampleImageUrl, setSampleImageUrl] = useState<string | null>(null);
    const [bgms, setBgms] = useState<Array<{ name: string; path: string }>>([]);

    const [rendering, setRendering] = useState<boolean>(false);
    const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
    const [renderResult, setRenderResult] = useState<SpensiaRenderResult | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 4000);
    };

    // Load per-topic data (timeline, preview image, existing render result)
    const loadTopicRenderData = async (topicId: number) => {
        if (!api?.readFromProject) return null;

        let parsedT: SpensiaTimelineStructure | null = null;

        // 1. Load timeline data for this topic
        let timelineJson = await api.readFromProject(`input/spensia/timelines/timeline_topic_${topicId}.json`);
        if (!timelineJson) {
            timelineJson = await api.readFromProject(`input/spensia/spensia_timeline_topic_${topicId}.json`);
        }
        if (!timelineJson && topicId === 1) {
            timelineJson = await api.readFromProject('input/spensia/spensia_timeline.json');
        }

        if (timelineJson) {
            try {
                parsedT = JSON.parse(timelineJson);
                setTimeline(parsedT);

                // Load sample preview image from first clip
                const firstClip = parsedT?.video_clips?.[0];
                if (firstClip?.image_url) {
                    setSampleImageUrl(firstClip.image_url);
                } else if (firstClip?.image_path) {
                    setSampleImageUrl(`media://content-auto/${encodeURIComponent(firstClip.image_path)}`);
                }
            } catch {}
        } else {
            setTimeline(null);
            setSampleImageUrl(null);
        }

        // Fallback sample image check if timeline was missing preview
        if (!sampleImageUrl) {
            let genImgJson = await api.readFromProject(`input/spensia/images/generated_images_topic_${topicId}.json`);
            if (!genImgJson && topicId === 1) {
                genImgJson = await api.readFromProject('input/spensia/generated_images.json');
            }
            if (genImgJson) {
                try {
                    const parsedG = JSON.parse(genImgJson);
                    const firstItem = Array.isArray(parsedG) ? parsedG[0] : parsedG.images?.[0];
                    if (firstItem?.url) {
                        setSampleImageUrl(firstItem.url);
                    } else if (firstItem?.filePath) {
                        setSampleImageUrl(`media://content-auto/${encodeURIComponent(firstItem.filePath)}`);
                    }
                } catch {}
            }
        }

        // 2. Check existing render result for topic
        if (api?.getSpensiaRenderResult) {
            const existing = await api.getSpensiaRenderResult(topicId);
            if (existing && existing.mediaUrl) {
                setRenderResult(existing);
                setRenderProgress({
                    stage: 'done',
                    progress: 1.0,
                    message: `🎉 Video Spensia Topik #${topicId} (${existing.fileName}) Siap Diputar!`,
                });
            } else {
                setRenderResult(null);
                setRenderProgress(null);
            }
        }

        return parsedT;
    };

    // Load initial data on mount
    useEffect(() => {
        (async () => {
            try {
                if (api?.readFromProject) {
                    // Load saved config if exists
                    const savedJson = await api.readFromProject('input/spensia/render_config.json');
                    if (savedJson) {
                        try {
                            const parsed = JSON.parse(savedJson);
                            setConfig((prev) => ({
                                ...prev,
                                ...parsed,
                                caption: { ...(parsed.caption || {}), enabled: false },
                                vignette: { ...(parsed.vignette || {}), intensity: parsed.vignette?.intensity ?? 0.75 },
                            }));
                        } catch {}
                    }

                    // Load topics from Step 1
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

                    // Check per-topic rendered MP4 files
                    const checkedTopics = await Promise.all(
                        loadedTopics.map(async (top) => {
                            try {
                                const renderRes = api?.getSpensiaRenderResult ? await api.getSpensiaRenderResult(top.id) : null;
                                return { ...top, hasRendered: Boolean(renderRes && renderRes.mediaUrl) };
                            } catch {
                                return top;
                            }
                        })
                    );

                    setBatchTopics(checkedTopics);
                    const targetId = selectedId || checkedTopics[0]?.id || 1;
                    setActiveTopicId(targetId);
                    const activeTop = checkedTopics.find((t) => t.id === targetId) || checkedTopics[0];
                    if (activeTop) setVideoTitle(activeTop.title);

                    await loadTopicRenderData(targetId);
                }
            } catch (err) {
                console.error('Error initializing Spensia Render Step:', err);
            }
        })();

        const cleanup = api?.onRenderProgress?.((data) => {
            setRenderProgress(data);
            if (data.stage === 'done') {
                setRendering(false);
            } else if (data.stage === 'error') {
                setRendering(false);
                setRenderError(data.message);
            }
        });

        return () => {
            if (cleanup) cleanup();
        };
    }, []);

    const handleSwitchTopic = async (topic: BatchTopicItem) => {
        setActiveTopicId(topic.id);
        setVideoTitle(topic.title);
        await loadTopicRenderData(topic.id);
    };

    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

    const saveConfigDebounced = useCallback((cfg: SpensiaRenderConfig) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            if (api?.saveToProject) {
                api.saveToProject('input/spensia/render_config.json', JSON.stringify(cfg, null, 2));
            }
        }, 400);
    }, []);

    // Helper updaters (instant UI state + debounced IPC save)
    const updateConfig = useCallback(<K extends keyof SpensiaRenderConfig>(key: K, value: SpensiaRenderConfig[K]) => {
        setConfig((prev) => {
            const updated = { ...prev, [key]: value };
            saveConfigDebounced(updated);
            return updated;
        });
    }, [saveConfigDebounced]);

    const updateVoiceOver = useCallback((patch: Partial<VoiceOverConfig>) => {
        setConfig((prev) => {
            const updated = { ...prev, voiceOver: { ...(prev.voiceOver || { enabled: true, volume: 1.0 }), ...patch } };
            saveConfigDebounced(updated as any);
            return updated;
        });
    }, [saveConfigDebounced]);

    const updateWatermark = useCallback((patch: Partial<WatermarkTextConfig>) => {
        setConfig((prev) => {
            const updated = { ...prev, watermark: { ...prev.watermark, ...patch } };
            saveConfigDebounced(updated);
            return updated;
        });
    }, [saveConfigDebounced]);

    const updateBgm = useCallback((patch: Partial<BgmConfig>) => {
        setConfig((prev) => {
            const updated = { ...prev, bgm: { ...prev.bgm, ...patch } };
            saveConfigDebounced(updated);
            return updated;
        });
    }, [saveConfigDebounced]);

    const updateVignette = useCallback((patch: Partial<VignetteConfig>) => {
        setConfig((prev) => {
            const updated = { ...prev, vignette: { ...prev.vignette, ...patch } };
            saveConfigDebounced(updated);
            return updated;
        });
    }, [saveConfigDebounced]);

    const handleSaveConfig = async () => {
        try {
            if (api?.saveToProject) {
                await api.saveToProject('input/spensia/render_config.json', JSON.stringify(config, null, 2));
                showToast('💾 Konfigurasi render berhasil disimpan!');
            }
        } catch (err: any) {
            showToast(`❌ Gagal menyimpan config: ${err?.message || err}`);
        }
    };

    const handleLoadDefault = () => {
        const def = getDefaultSpensiaRenderConfig();
        def.caption.enabled = false;
        def.vignette.intensity = 0.75;
        setConfig(def);
        showToast('🔄 Konfigurasi dikembalikan ke default.');
    };

    // Single Topic Render Execution
    const handleStartRender = async () => {
        if (rendering) return;
        setRendering(true);
        setRenderResult(null);
        setRenderError(null);
        setRenderProgress({ progress: 0.05, stage: 'init', message: `Mempersiapkan render engine FFmpeg untuk Topik #${activeTopicId || 1}...` });
        setBatchTopics((prev) =>
            prev.map((t) => (t.id === (activeTopicId || 1) ? { ...t, isCurrentlyRendering: true } : t))
        );

        try {
            if (!api?.renderSpensiaVideo) {
                throw new Error('API renderSpensiaVideo tidak tersedia.');
            }

            // Always enforce caption disabled
            const activeConfig = {
                ...config,
                caption: { ...config.caption, enabled: false },
            };

            showToast(`🎬 Memulai proses render Spensia Video Topik #${activeTopicId || 1}...`);
            const res = await api.renderSpensiaVideo(activeConfig, timeline as any, undefined, activeTopicId || undefined);

            if ('error' in res && res.error) {
                setRenderError(res.error);
                showToast(`❌ Render Gagal: ${res.error}`);
            } else {
                setRenderResult(res as SpensiaRenderResult);
                setBatchTopics((prev) =>
                    prev.map((t) => (t.id === (activeTopicId || 1) ? { ...t, hasRendered: true } : t))
                );
                showToast(`✨ Render Video Topik #${activeTopicId || 1} Berhasil Selesai!`);
            }
        } catch (err: any) {
            const msg = err?.message || String(err);
            setRenderError(msg);
            showToast(`❌ Render Error: ${msg}`);
        } finally {
            setBatchTopics((prev) =>
                prev.map((t) => (t.id === (activeTopicId || 1) ? { ...t, isCurrentlyRendering: false } : t))
            );
            setRendering(false);
        }
    };

    // Bulk Render Execution for ALL Topics
    const handleRenderAllTopics = async () => {
        if (rendering) return;
        if (batchTopics.length === 0) {
            await handleStartRender();
            return;
        }

        setRendering(true);
        setRenderError(null);
        setBulkProgress({ current: 1, total: batchTopics.length });
        showToast(`🚀 Memulai Bulk Render untuk ${batchTopics.length} Topik...`);

        let successCount = 0;
        try {
            if (!api?.renderSpensiaVideo) {
                throw new Error('API renderSpensiaVideo tidak tersedia.');
            }

            const activeConfig = {
                ...config,
                caption: { ...config.caption, enabled: false },
            };

            let index = 0;
            for (const topic of batchTopics) {
                setBulkProgress({ current: index + 1, total: batchTopics.length });
                setBatchTopics((prev) =>
                    prev.map((t) => (t.id === topic.id ? { ...t, isCurrentlyRendering: true } : { ...t, isCurrentlyRendering: false }))
                );
                
                // Visual update: Switch current active tab to currently rendering topic
                setActiveTopicId(topic.id);
                setVideoTitle(topic.title);
                setRenderResult(null);

                showToast(`🎬 Memproses Render Topik #${topic.id} ("${topic.title}")...`);
                const topicTl = await loadTopicRenderData(topic.id);
                if (!topicTl) {
                    showToast(`⚠️ Timeline Topik #${topic.id} belum ada, melewati topik ini...`);
                    setBatchTopics((prev) =>
                        prev.map((t) => (t.id === topic.id ? { ...t, isCurrentlyRendering: false } : t))
                    );
                    index++;
                    continue;
                }

                const res = await api.renderSpensiaVideo(activeConfig, topicTl as any, undefined, topic.id);
                
                const isSuccess = !('error' in res) || !res.error;
                if (isSuccess) {
                    successCount++;
                    setRenderResult(res as SpensiaRenderResult);
                } else {
                    setRenderError((res as any).error || 'Gagal me-render video');
                }

                setBatchTopics((prev) =>
                    prev.map((t) => (t.id === topic.id ? { ...t, isCurrentlyRendering: false, hasRendered: isSuccess } : t))
                );
                index++;
            }

            showToast(`🎉 Bulk Render Selesai! ${successCount} / ${batchTopics.length} video topik berhasil dirender!`);
        } catch (err: any) {
            const msg = err?.message || String(err);
            setRenderError(msg);
            showToast(`❌ Bulk Render Error: ${msg}`);
        } finally {
            setBulkProgress(null);
            setBatchTopics((prev) =>
                prev.map((t) => ({ ...t, isCurrentlyRendering: false }))
            );
            setRendering(false);
            if (activeTopicId) {
                await loadTopicRenderData(activeTopicId);
            }
        }
    };

    const formatDuration = (sec?: number) => {
        if (!sec || isNaN(sec)) return '--:--';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-in fade-in duration-300">
            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-5 right-5 z-50 bg-rose-600 text-white px-4 py-3 rounded-2xl shadow-2xl font-semibold text-xs flex items-center gap-2 border border-rose-400/30 animate-bounce">
                    <span>{toast}</span>
                </div>
            )}

            {/* Header Banner */}
            <div className="bg-gradient-to-r from-rose-950/90 via-purple-950/80 to-gray-950 p-6 rounded-3xl border border-rose-800/40 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                                ✨ Spensia AI Workflow — Step 8
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-gray-900 text-gray-300 border border-gray-800 text-[10px] font-mono font-bold">
                                🖥️ 16:9 1080p Longform
                            </span>
                        </div>
                        <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                            <span>🎬</span> Render Studio FFmpeg Video Engine
                        </h1>
                        <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
                            Konfigurasi rendering video 16:9 (1920×1080) — vignette hitam cinematic gelap, watermark logo, BGM audio, dan ekspor MP4 resolusi tinggi.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                        {batchTopics.length > 1 && (
                            <button
                                onClick={handleRenderAllTopics}
                                disabled={rendering}
                                className="px-4 py-3 bg-gradient-to-r from-amber-500 via-rose-600 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white rounded-2xl text-xs font-black shadow-xl shadow-amber-950/80 border border-amber-300/40 transition-all flex items-center gap-2 disabled:opacity-50"
                                title="Render seluruh video topik sekaligus secara otomatis"
                            >
                                {rendering ? (
                                    <>
                                        <span className="animate-spin">⏳</span>
                                        <span>Proses Bulk Render...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>🚀</span>
                                        <span>Render All Topics ({batchTopics.length})</span>
                                    </>
                                )}
                            </button>
                        )}

                        <button
                            onClick={handleStartRender}
                            disabled={rendering}
                            className="px-5 py-3 bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white rounded-2xl text-xs font-black shadow-xl shadow-rose-950/80 border border-rose-400/40 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {rendering ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    <span>Rendering Video...</span>
                                </>
                            ) : (
                                <>
                                    <span>🎬</span>
                                    <span>Render Topic #{activeTopicId || 1}</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleSaveConfig}
                            className="px-3.5 py-3 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded-2xl text-xs font-bold border border-gray-800 transition-all flex items-center gap-1"
                            title="Simpan Konfigurasi"
                        >
                            <span>💾</span>
                        </button>

                        <button
                            onClick={handleLoadDefault}
                            className="px-3.5 py-3 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded-2xl text-xs font-bold border border-gray-800 transition-all flex items-center gap-1"
                            title="Load Default Config"
                        >
                            <span>🔄</span>
                        </button>
                    </div>
                </div>

                {/* Top Topic Selector Bar */}
                {batchTopics.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-rose-900/40 relative z-10">
                        {batchTopics.map((t) => {
                            const isActive = activeTopicId === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => handleSwitchTopic(t)}
                                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-2 max-w-xs ${
                                        isActive
                                            ? 'bg-rose-950/90 border-rose-500 text-rose-200 shadow-md ring-1 ring-rose-500/40'
                                            : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
                                    }`}
                                >
                                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-900 border border-gray-800 text-rose-300 shrink-0">
                                        #{t.id}
                                    </span>
                                    <span className="truncate">"{t.title}"</span>
                                    <span
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                            t.isCurrentlyRendering
                                                ? 'bg-rose-900 text-rose-200 border border-rose-500 animate-pulse'
                                                : t.hasRendered
                                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                                : 'bg-gray-900 text-gray-500 border border-gray-800'
                                        }`}
                                    >
                                        {t.isCurrentlyRendering ? '🔄 Rendering...' : t.hasRendered ? '✓ Rendered' : '⏳ Ready'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Main Studio Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT: Live Preview Studio + Render Output (col-span-5) */}
                <div className="lg:col-span-5 space-y-6">
                    {/* Live Preview Card */}
                    <div className="bg-gray-900/90 p-5 rounded-3xl border border-gray-800 shadow-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-xs font-extrabold text-white flex items-center gap-2 uppercase tracking-wider">
                                <span>👁️</span> Live Canvas Preview (CSS Overlay)
                            </h3>
                            <span className="text-[10px] text-rose-400 font-mono font-bold bg-rose-950 px-2 py-0.5 rounded-full border border-rose-800">
                                1920×1080 Full HD
                            </span>
                        </div>

                        <div className="flex justify-center py-1">
                            <PreviewCanvas config={config} sampleImageUrl={sampleImageUrl} />
                        </div>
                    </div>

                    {/* Active Render Progress Bar */}
                    {rendering && renderProgress && (() => {
                        const stageLabels: Record<string, string> = {
                            init: '🚀 Inisialisasi Engine',
                            clips: '🖼️ Pre-Rendering Segmen Visual',
                            overlay: '🔗 Concat & Audio/Visual Composite',
                            final: '⚡ Encoding Ekspor MP4 1080p',
                            done: '🎉 Render Selesai',
                            error: '❌ Error Render',
                        };
                        const currentStageText = stageLabels[renderProgress.stage] || renderProgress.stage;
                        const pctValue = Math.round((renderProgress.progress || 0) * 100);

                        return (
                            <div className="bg-gray-900/95 p-5 rounded-3xl border border-rose-600/50 shadow-2xl space-y-3.5 animate-in fade-in duration-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-rose-300 flex items-center gap-2 tracking-wide">
                                        <span className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                                        </span>
                                        {currentStageText}
                                        {bulkProgress && (
                                            <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full font-mono animate-pulse">
                                                Batch: {bulkProgress.current} / {bulkProgress.total}
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-xs font-mono font-black text-rose-300 bg-rose-950/80 px-3 py-1 rounded-xl border border-rose-700/60 shadow-inner">
                                        {pctValue}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-950 rounded-full h-3.5 overflow-hidden border border-rose-900/40 p-0.5 shadow-inner">
                                    <div
                                        className="bg-gradient-to-r from-rose-600 via-pink-500 to-amber-400 h-full rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(244,63,94,0.6)]"
                                        style={{ width: `${Math.max(5, pctValue)}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-[11px] font-mono text-gray-300 pt-0.5">
                                    <span className="truncate pr-2 font-medium">{renderProgress.message || 'Memproses video...'}</span>
                                    <span className="text-gray-500 shrink-0 font-bold">{pctValue}%</span>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Render Completed Result Card */}
                    {renderResult && (
                        <div className="bg-emerald-950/80 p-5 rounded-3xl border border-emerald-700/60 shadow-2xl space-y-3 animate-in slide-in-from-bottom-4 duration-300">
                            <div className="flex items-center justify-between border-b border-emerald-800/80 pb-3">
                                <div className="flex items-center gap-2">
                                    <span className="p-1 bg-emerald-900 text-emerald-300 rounded-lg text-xs">🎉</span>
                                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                                        Render Video Sukses Dituntaskan!
                                    </h3>
                                </div>
                                <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-900 px-2 py-0.5 rounded-full">
                                    1080p MP4
                                </span>
                            </div>

                            <p className="text-xs text-emerald-200 font-mono truncate">{renderResult.fileName}</p>

                            {renderResult.mediaUrl && (
                                <video src={renderResult.mediaUrl} controls className="w-full rounded-2xl max-h-64 bg-black border border-emerald-800 shadow-inner" />
                            )}
                        </div>
                    )}

                    {/* Render Error Card */}
                    {renderError && (
                        <div className="bg-rose-950/80 p-5 rounded-3xl border border-rose-800/60 shadow-2xl space-y-2">
                            <h4 className="text-xs font-bold text-rose-300 flex items-center gap-2">
                                <span>❌</span> Gagal Melakukan Render Video
                            </h4>
                            <p className="text-[11px] text-rose-200 font-mono whitespace-pre-wrap leading-relaxed">{renderError}</p>
                        </div>
                    )}
                </div>

                {/* RIGHT: Configuration Panels (col-span-7) */}
                <div className="lg:col-span-7 space-y-5 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
                    {/* ─── 1. Vignette Darkening Panel ─── */}
                    <ConfigSection title="🌑 Vignette Darkening (Efek Gelap Tepian)" icon="🌑" subtitle="Meningkatkan fokus adegan visual">
                        <ToggleRow
                            label="Aktifkan Efek Vignette Gelap"
                            description="Memberikan efek shadow melingkar gelap di pinggir frame video."
                            enabled={config.vignette.enabled}
                            onChange={(v) => updateVignette({ enabled: v })}
                        />

                        {config.vignette.enabled && (
                            <>
                                <SliderRow
                                    label="Tingkat Kegelapan Vignette (Intensity)"
                                    description="Geser kanan untuk bayangan pekat gelap cinematic, geser kiri untuk bayangan samar terang"
                                    value={config.vignette.intensity}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    leftHint="Meredup/Terang (0.0)"
                                    rightHint="Pekat Gelap (1.0)"
                                    onChange={(v) => updateVignette({ intensity: v })}
                                />
                                <div className="flex items-center gap-2 pt-1">
                                    <span className="text-xs text-gray-400 font-medium">Preset Intensitas:</span>
                                    <button
                                        onClick={() => updateVignette({ intensity: 0.50 })}
                                        className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${config.vignette.intensity === 0.50 ? 'bg-rose-600 text-white border-rose-400' : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'}`}
                                    >
                                        Sedang (50%)
                                    </button>
                                    <button
                                        onClick={() => updateVignette({ intensity: 0.75 })}
                                        className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${config.vignette.intensity === 0.75 ? 'bg-rose-600 text-white border-rose-400' : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'}`}
                                    >
                                        🎬 Cinematic Dark (75%)
                                    </button>
                                    <button
                                        onClick={() => updateVignette({ intensity: 0.95 })}
                                        className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${config.vignette.intensity === 0.95 ? 'bg-rose-600 text-white border-rose-400' : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'}`}
                                    >
                                        🌑 Extreme Dark (95%)
                                    </button>
                                </div>
                                <ColorInput label="Warna Vignette" value={config.vignette.colorHex} onChange={(v) => updateVignette({ colorHex: v })} />
                            </>
                        )}
                    </ConfigSection>

                    {/* ─── 2. Watermark & Branding Text ─── */}
                    <ConfigSection title="📐 Watermark & Logo Text" icon="📐" subtitle="Branding teks pada video">
                        <ToggleRow
                            label="Aktifkan Watermark Teks"
                            description="Menampilkan teks logo branding pada sudut video"
                            enabled={config.watermark.enabled}
                            onChange={(v) => updateWatermark({ enabled: v })}
                        />

                        {config.watermark.enabled && (
                            <>
                                <div className="space-y-1">
                                    <span className="text-xs text-gray-400 font-medium">Teks Watermark / Nama Channel</span>
                                    <input
                                        type="text"
                                        value={config.watermark.text}
                                        onChange={(e) => updateWatermark({ text: e.target.value })}
                                        className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 focus:border-rose-500 focus:outline-none"
                                        maxLength={30}
                                        placeholder="Contoh: Spensia Channel"
                                    />
                                </div>

                                <SelectRow
                                    label="Posisi Watermark pada Video"
                                    value={config.watermark.position}
                                    options={POSITION_OPTIONS}
                                    onChange={(v) => updateWatermark({ position: v as WatermarkTextConfig['position'] })}
                                />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <SliderRow
                                        label="Ukuran Font"
                                        value={config.watermark.fontSize}
                                        min={8}
                                        max={120}
                                        step={1}
                                        leftHint="Kecil (8px)"
                                        rightHint="Besar (120px)"
                                        onChange={(v) => updateWatermark({ fontSize: v })}
                                        suffix="px"
                                    />
                                    <SliderRow
                                        label="Transparansi (Opacity)"
                                        value={config.watermark.opacity}
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        leftHint="Transparansi (0.0)"
                                        rightHint="Jelas/Solid (1.0)"
                                        onChange={(v) => updateWatermark({ opacity: v })}
                                    />
                                </div>

                                <ColorInput label="Warna Teks Watermark" value={config.watermark.colorHex} onChange={(v) => updateWatermark({ colorHex: v })} />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <SliderRow
                                        label="Geser Horisontal (Offset X)"
                                        value={config.watermark.offsetX}
                                        min={-200}
                                        max={200}
                                        step={1}
                                        leftHint="Geser Kiri (-200px)"
                                        rightHint="Geser Kanan (+200px)"
                                        onChange={(v) => updateWatermark({ offsetX: v })}
                                        suffix="px"
                                    />
                                    <SliderRow
                                        label="Geser Vertikal (Offset Y)"
                                        value={config.watermark.offsetY}
                                        min={-200}
                                        max={200}
                                        step={1}
                                        leftHint="Geser Atas (-200px)"
                                        rightHint="Geser Bawah (+200px)"
                                        onChange={(v) => updateWatermark({ offsetY: v })}
                                        suffix="px"
                                    />
                                </div>
                            </>
                        )}
                    </ConfigSection>

                    {/* ─── 3. Voice Over (VO) Audio Narasi ─── */}
                    <ConfigSection title="🎙️ Voice Over (VO) Audio Narasi" icon="🎙️" subtitle="Kontrol volume narasi suara manusia/TTS">
                        <ToggleRow
                            label="Aktifkan Audio Voice Over (Narasi)"
                            description="Menggabungkan audio narasi pengisi suara ke dalam video"
                            enabled={config.voiceOver?.enabled ?? true}
                            onChange={(v) => updateVoiceOver({ enabled: v })}
                        />

                        {(config.voiceOver?.enabled ?? true) && (
                            <>
                                <SliderRow
                                    label="Volume Voice Over (Narasi Suara)"
                                    description="Mengatur kekerasan suara narator (Default: 1.0 / 100%. Geser kanan untuk memperkeras hingga 200%)"
                                    value={config.voiceOver?.volume ?? 1.0}
                                    min={0}
                                    max={2}
                                    step={0.05}
                                    leftHint="🔈 Meredup / Senyap (0.0)"
                                    rightHint="🔊 Memperkeras Narasi (2.0) ▶"
                                    onChange={(v) => updateVoiceOver({ volume: v })}
                                />

                                <div className="flex items-center gap-2 pt-1 flex-wrap">
                                    <span className="text-xs text-gray-400 font-medium">Preset Volume VO:</span>
                                    <button
                                        onClick={() => updateVoiceOver({ volume: 0.50 })}
                                        className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${config.voiceOver?.volume === 0.50 ? 'bg-rose-600 text-white border-rose-400' : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'}`}
                                    >
                                        Pelan (50%)
                                    </button>
                                    <button
                                        onClick={() => updateVoiceOver({ volume: 1.0 })}
                                        className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${(config.voiceOver?.volume ?? 1.0) === 1.0 ? 'bg-rose-600 text-white border-rose-400' : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'}`}
                                    >
                                        🎙️ Normal (100%)
                                    </button>
                                    <button
                                        onClick={() => updateVoiceOver({ volume: 1.50 })}
                                        className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${config.voiceOver?.volume === 1.50 ? 'bg-rose-600 text-white border-rose-400' : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'}`}
                                    >
                                        ⚡ Boosted (150%)
                                    </button>
                                    <button
                                        onClick={() => updateVoiceOver({ volume: 2.0 })}
                                        className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${config.voiceOver?.volume === 2.0 ? 'bg-rose-600 text-white border-rose-400' : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'}`}
                                    >
                                        📢 Extra Loud (200%)
                                    </button>
                                </div>
                            </>
                        )}
                    </ConfigSection>

                    {/* ─── 4. Background Music (BGM) ─── */}
                    <ConfigSection title="🎵 Background Music (BGM)" icon="🎵" subtitle="Audio latar musik Spensia">
                        <ToggleRow
                            label="Aktifkan Musik Latar (BGM)"
                            description="Menggabungkan audio musik latar dengan narasi voice over"
                            enabled={config.bgm.enabled}
                            onChange={(v) => updateBgm({ enabled: v })}
                        />

                        {config.bgm.enabled && (
                            <>
                                <div className="space-y-1">
                                    <span className="text-xs text-gray-400 font-medium">Pilih File Musik (BGM)</span>
                                    <select
                                        value={config.bgm.path}
                                        onChange={(e) => updateBgm({ path: e.target.value })}
                                        className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 font-mono focus:border-rose-500 focus:outline-none"
                                    >
                                        <option value="assets/Edge Of Unknown.mp3">Edge Of Unknown (Default Spensia BGM)</option>
                                        {bgms.map((bgm) => (
                                            <option key={bgm.path} value={`assets/${bgm.name}`}>{bgm.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <SliderRow
                                    label="Volume Musik Latar (BGM Audio)"
                                    description="Geser kanan untuk memperkeras BGM, geser kiri untuk meredupkan/memperkecil BGM (Rekomendasi: 10% - 20%)"
                                    value={config.bgm.volume}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    leftHint="🔈 Meredup / Senyap (0.0)"
                                    rightHint="🔊 Memperkeras Musik (1.0) ▶"
                                    onChange={(v) => updateBgm({ volume: v })}
                                />

                                <div className="grid grid-cols-2 gap-4">
                                    <NumberInput label="Fade In Audio" value={config.bgm.fadeInSec} min={0} max={10} onChange={(v) => updateBgm({ fadeInSec: v })} suffix="detik" />
                                    <NumberInput label="Fade Out Audio" value={config.bgm.fadeOutSec} min={0} max={10} onChange={(v) => updateBgm({ fadeOutSec: v })} suffix="detik" />
                                </div>
                            </>
                        )}
                    </ConfigSection>

                    {/* ─── 4. Output & Quality Presets ─── */}
                    <ConfigSection title="⚙️ Parameter Ekspor Video" icon="⚙️" subtitle="Format 16:9 YouTube Longform">
                        <SelectRow
                            label="Kualitas & Kecepatan Enkoding"
                            value={config.outputQuality}
                            options={QUALITY_OPTIONS}
                            onChange={(v) => updateConfig('outputQuality', v as SpensiaRenderConfig['outputQuality'])}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <NumberInput label="Resolusi Lebar (Width)" value={config.resolution.width} onChange={(v) => updateConfig('resolution', { ...config.resolution, width: v })} suffix="px" />
                            <NumberInput label="Resolusi Tinggi (Height)" value={config.resolution.height} onChange={(v) => updateConfig('resolution', { ...config.resolution, height: v })} suffix="px" />
                        </div>

                        <NumberInput label="Framerate Video (FPS)" value={config.fps} min={15} max={60} onChange={(v) => updateConfig('fps', v)} suffix="fps" />
                    </ConfigSection>

                    {/* ─── 5. Timeline Summary Card ─── */}
                    {timeline && (
                        <div className="bg-gray-900/90 p-5 rounded-3xl border border-gray-800 shadow-xl space-y-3">
                            <h3 className="text-xs font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 uppercase tracking-wider">
                                <span>📊</span> Ringkasan Timeline Spensia Ready Render
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Total Klip Visual:</span>
                                        <span className="text-rose-400 font-bold">{timeline.video_clips?.length || 0} segmen</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Durasi Video Final:</span>
                                        <span className="text-white font-bold">{formatDuration(timeline.total_duration_sec)}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Track Audio VO:</span>
                                        <span className="text-emerald-400 font-bold">{timeline.audio_tracks?.length || 1} track</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Aspect Ratio:</span>
                                        <span className="text-teal-400 font-bold">16:9 Longform</span>
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
