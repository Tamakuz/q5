// dashboard/src/components/waku/WakuRenderStep.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
    WakuRenderConfig,
    WakuTimelineStructure,
    WakuRenderResult,
    WatermarkTextConfig,
    CaptionConfig,
    BgmConfig,
    VignetteConfig,
    RenderProgress,
} from '../../electron-api';
import { getDefaultWakuRenderConfig, VoiceOverConfig } from '../../utils/vannRenderConfig';

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

// ─── Preview Canvas (Scale factor: preview container is max-w-4xl ~864×486, real canvas is 1920×1080 → 0.45x) ───

const PREVIEW_SCALE = 0.45; // 864/1920 = 486/1080

const scale = (v: number) => Math.round(v * PREVIEW_SCALE);

const PreviewCanvas: React.FC<{
    config: WakuRenderConfig;
    sampleImageUrl: string | null;
    sampleCaptionText?: string;
}> = ({ config, sampleImageUrl, sampleCaptionText }) => {
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

    const capEnabled = cap?.enabled !== false;
    const capColor = cap?.inactiveColorHex || '#CBD5E1';
    const capFontSize = Math.max(14, scale(cap?.fontSize || 48));
    const capBottom = scale(cap?.positionY || 160);
    const strokeWidth = Math.max(0.5, capFontSize * 0.045);

    const getCaptionStyle = (): React.CSSProperties => ({
        position: 'absolute',
        bottom: `${capBottom}px`,
        left: '4%',
        right: '4%',
        textAlign: 'center',
        color: capColor,
        fontSize: `${capFontSize}px`,
        fontFamily: `${cap?.fontName || 'Montserrat'}, sans-serif`,
        fontWeight: 800,
        lineHeight: 1.3,
        letterSpacing: '0.01em',
        textShadow: `0 2px 10px rgba(0,0,0,0.95), 0 0 5px rgba(0,0,0,0.85)`,
        WebkitTextStroke: `${strokeWidth.toFixed(1)}px ${cap?.outlineColorHex || '#000000'}`,
        pointerEvents: 'none',
        zIndex: 20,
    });

    return (
        <div
            className="relative w-full max-w-4xl aspect-video mx-auto overflow-hidden rounded-3xl border border-gray-700/80 shadow-2xl bg-black flex items-center justify-center"
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

            {/* Subtitle / Caption text overlay */}
            {capEnabled && (
                <div style={getCaptionStyle()}>
                    {sampleCaptionText ? (
                        <span>{sampleCaptionText}</span>
                    ) : (cap?.displayMode || 'sentence') === 'single-word' ? (
                        <span style={{ color: cap?.activeColorHex || '#22C55E' }}>PAGI</span>
                    ) : cap?.displayMode === 'phrase' ? (
                        <span>
                            Bayangkan kamu <span style={{ color: cap?.activeColorHex || '#22C55E' }}>terbangun</span> jam 2 pagi...
                        </span>
                    ) : (
                        <span>
                            "Bayangkan kamu terbangun di jam 2 pagi di tengah kegelapan..."
                        </span>
                    )}
                </div>
            )}

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
            className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${enabled ? 'bg-emerald-600 shadow-md shadow-emerald-950' : 'bg-gray-800'}`}
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
                        className="w-16 bg-gray-900 border border-emerald-800/60 text-emerald-300 font-mono font-bold text-xs text-center rounded-xl py-1 px-1.5 focus:border-emerald-500 focus:outline-none shadow-inner"
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
                className="w-full h-2.5 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-emerald-500 border border-gray-800 shadow-inner"
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
                className="w-24 bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-1 text-xs font-mono text-gray-200 text-center focus:border-emerald-500 focus:outline-none"
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
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 font-mono focus:border-emerald-500 focus:outline-none"
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
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 focus:border-emerald-500 focus:outline-none"
            />
            {suffix && <span className="text-xs text-gray-500 font-mono shrink-0">{suffix}</span>}
        </div>
    </div>
);

// ─── Main WakuRenderStep Component ─────────────────────

export interface BatchTopicItem {
    id: number;
    title: string;
    summary?: string;
    hasRendered?: boolean;
    isCurrentlyRendering?: boolean;
}

const WakuRenderStep: React.FC<{ onStepChange?: (step: string) => void }> = () => {
    const [batchTopics, setBatchTopics] = useState<BatchTopicItem[]>([]);
    const [activeTopicId, setActiveTopicId] = useState<number | null>(null);
    const [videoTitle, setVideoTitle] = useState<string>('');

    const [config, setConfig] = useState<WakuRenderConfig>(() => {
        const def = getDefaultWakuRenderConfig();
        return {
            ...def,
            caption: { ...def.caption, enabled: false }, // Explicitly disable caption by default
            vignette: { ...def.vignette, intensity: 0.75 }, // Darker vignette default
        };
    });

    const [timeline, setTimeline] = useState<WakuTimelineStructure | null>(null);
    const [sampleImageUrl, setSampleImageUrl] = useState<string | null>(null);
    const [bgms, setBgms] = useState<Array<{ name: string; path: string }>>([]);

    const [rendering, setRendering] = useState<boolean>(false);
    const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
    const [renderResult, setRenderResult] = useState<WakuRenderResult | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
    const [renderLogs, setRenderLogs] = useState<string[]>([]);
    const logConsoleRef = useRef<HTMLDivElement>(null);

    const [renderStartTime, setRenderStartTime] = useState<number | null>(null);
    const [elapsedSec, setElapsedSec] = useState<number>(0);

    // Real-time render timer & ETA countdown calculation
    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;
        if (rendering && renderStartTime) {
            timer = setInterval(() => {
                const now = Date.now();
                const diff = Math.max(0, Math.floor((now - renderStartTime) / 1000));
                setElapsedSec(diff);
            }, 1000);
        } else {
            setElapsedSec(0);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [rendering, renderStartTime]);

    const formatSecToMinSec = (totalSeconds: number): string => {
        const s = Math.max(0, Math.floor(totalSeconds));
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const getEstimatedTimeRemainingSec = (): number | null => {
        if (!rendering || !renderProgress || !renderProgress.progress || renderProgress.progress <= 0.05 || elapsedSec <= 2) {
            return null;
        }
        const pct = renderProgress.progress;
        const totalEstimated = elapsedSec / pct;
        const remaining = Math.max(0, Math.round(totalEstimated - elapsedSec));
        return remaining;
    };

    const addLog = useCallback((msg: string) => {
        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setRenderLogs((prev) => [...prev.slice(-300), `[${timeStr}] ${msg}`]);
        setTimeout(() => {
            if (logConsoleRef.current) {
                logConsoleRef.current.scrollTop = logConsoleRef.current.scrollHeight;
            }
        }, 50);
    }, []);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 4000);
    };

    // Load per-topic data (mapping timeline, preview image, existing render result)
    const loadTopicRenderData = async (topicId: number) => {
        if (!api?.readFromProject) return null;

        let parsedT: WakuTimelineStructure | null = null;

        // 1. Load timeline directly from vann_mapping_topic_X.json
        const genTimelineFn = api?.generateVannTimeline || api?.generateWakuTimeline;
        if (genTimelineFn) {
            try {
                const res = await genTimelineFn(topicId);
                if (res?.timeline) {
                    parsedT = res.timeline;
                    setTimeline(parsedT);

                    // Load sample preview image from first clip
                    const firstClip = parsedT?.video_clips?.[0];
                    if (firstClip?.image_url) {
                        setSampleImageUrl(firstClip.image_url);
                    } else if (firstClip?.image_path) {
                        setSampleImageUrl(`media://content-auto/${encodeURIComponent(firstClip.image_path)}`);
                    }
                }
            } catch (err) {
                console.error('Error loading vann mapping timeline:', err);
            }
        }

        if (!parsedT) {
            setTimeline(null);
            setSampleImageUrl(null);
        }

        // Fallback sample image check if timeline was missing preview
        if (!sampleImageUrl) {
            let genImgJson = await api.readFromProject(`input/vann/images/generated_images_topic_${topicId}.json`);
            if (!genImgJson && topicId === 1) {
                genImgJson = (await api.readFromProject('input/vann/images/generated_images.json')) || (await api.readFromProject('input/vann/generated_images.json'));
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
        if (api?.getWakuRenderResult) {
            const existing = await api.getWakuRenderResult(topicId);
            if (existing && existing.mediaUrl) {
                setRenderResult(existing);
                setRenderProgress({
                    stage: 'done',
                    progress: 1.0,
                    message: `🎉 Video Waku Topik #${topicId} (${existing.fileName}) Siap Diputar!`,
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
                    const savedJson = (await api.readFromProject('input/vann/renders/render_config.json')) || (await api.readFromProject('input/vann/render_config.json'));
                    if (savedJson) {
                        try {
                            const parsed = JSON.parse(savedJson);
                            setConfig((prev) => ({
                                ...prev,
                                ...parsed,
                                caption: { enabled: true, displayMode: 'sentence', inactiveColorHex: '#CBD5E1', fontSize: 48, positionY: 160, ...(parsed.caption || {}) },
                                vignette: { ...(parsed.vignette || {}), intensity: parsed.vignette?.intensity ?? 0.75 },
                            }));
                        } catch {}
                    }

                    // Load topics from Step 1
                    const savedTopicsJson = await api.readFromProject('input/vann/topics.json');
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
                                const renderRes = api?.getWakuRenderResult ? await api.getWakuRenderResult(top.id) : null;
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
                console.error('Error initializing Waku Render Step:', err);
            }
        })();

        const cleanup = api?.onRenderProgress?.((data) => {
            setRenderProgress(data);
            if (data.message) {
                addLog(data.message);
            }
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

    const saveConfigDebounced = useCallback((cfg: WakuRenderConfig) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            if (api?.saveToProject) {
                api.saveToProject('input/vann/renders/render_config.json', JSON.stringify(cfg, null, 2));
            }
        }, 400);
    }, []);

    // Helper updaters (instant UI state + debounced IPC save)
    const updateConfig = useCallback(<K extends keyof WakuRenderConfig>(key: K, value: WakuRenderConfig[K]) => {
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

    const updateCaption = useCallback((patch: Partial<CaptionConfig>) => {
        setConfig((prev) => {
            const updated = { ...prev, caption: { ...prev.caption, ...patch } };
            saveConfigDebounced(updated as any);
            return updated;
        });
    }, [saveConfigDebounced]);

    const handleSaveConfig = async () => {
        try {
            if (api?.saveToProject) {
                await api.saveToProject('input/vann/renders/render_config.json', JSON.stringify(config, null, 2));
                showToast('💾 Konfigurasi render berhasil disimpan!');
            }
        } catch (err: any) {
            showToast(`❌ Gagal menyimpan config: ${err?.message || err}`);
        }
    };

    const handleLoadDefault = () => {
        const def = getDefaultWakuRenderConfig();
        def.vignette.intensity = 0.75;
        setConfig(def);
        if (api?.saveToProject) {
            api.saveToProject('input/vann/renders/render_config.json', JSON.stringify(def, null, 2));
        }
        showToast('🔄 Konfigurasi dikembalikan ke default.');
    };

    // Single Topic Render Execution
    const handleStartRender = async () => {
        if (rendering) return;
        setRendering(true);
        setRenderStartTime(Date.now());
        setElapsedSec(0);
        setRenderResult(null);
        setRenderError(null);
        setRenderProgress({ progress: 0.05, stage: 'init', message: `Mempersiapkan render engine FFmpeg untuk Topik #${activeTopicId || 1}...` });
        setBatchTopics((prev) =>
            prev.map((t) => (t.id === (activeTopicId || 1) ? { ...t, isCurrentlyRendering: true } : t))
        );

        try {
            const renderFn = api?.renderVannVideo || api?.renderWakuVideo;
            if (!renderFn) {
                throw new Error('API renderVannVideo tidak tersedia.');
            }

            // Always persist latest full config (including captions & audio) to JSON before render
            if (api?.saveToProject) {
                await api.saveToProject('input/vann/renders/render_config.json', JSON.stringify(config, null, 2));
            }

            showToast(`🎬 Memulai proses render Vann Video Topik #${activeTopicId || 1}...`);
            const res = await renderFn(config, timeline as any, undefined, activeTopicId || undefined);

            if ('error' in res && res.error) {
                setRenderError(res.error);
                showToast(`❌ Render Gagal: ${res.error}`);
            } else {
                setRenderResult(res as WakuRenderResult);
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
        setRenderStartTime(Date.now());
        setElapsedSec(0);
        setRenderError(null);
        setBulkProgress({ current: 1, total: batchTopics.length });
        showToast(`🚀 Memulai Bulk Render untuk ${batchTopics.length} Topik...`);

        let successCount = 0;
        try {
            const renderFn = api?.renderVannVideo || api?.renderWakuVideo;
            if (!renderFn) {
                throw new Error('API renderVannVideo tidak tersedia.');
            }

            // Always persist latest full config (including captions & audio) to JSON before render
            if (api?.saveToProject) {
                await api.saveToProject('input/vann/renders/render_config.json', JSON.stringify(config, null, 2));
            }

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

                const res = await renderFn(config, topicTl as any, undefined, topic.id);
                
                const isSuccess = !('error' in res) || !res.error;
                if (isSuccess) {
                    successCount++;
                    setRenderResult(res as WakuRenderResult);
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
                <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl font-semibold text-xs flex items-center gap-2 border border-emerald-400/30 animate-bounce">
                    <span>{toast}</span>
                </div>
            )}

            {/* Header Banner */}
            <div className="bg-gradient-to-r from-emerald-950/90 via-emerald-950/80 to-gray-950 p-6 rounded-3xl border border-emerald-800/40 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                                ✨ Vann AI Workflow — Step 8
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
                                className="px-4 py-3 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-2xl text-xs font-black shadow-xl shadow-emerald-950/80 border border-emerald-300/40 transition-all flex items-center gap-2 disabled:opacity-50"
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
                            className="px-5 py-3 bg-gradient-to-r from-emerald-600 via-emerald-600 to-emerald-600 hover:from-emerald-500 hover:to-emerald-500 text-white rounded-2xl text-xs font-black shadow-xl shadow-emerald-950/80 border border-emerald-400/40 transition-all flex items-center gap-2 disabled:opacity-50"
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
                    <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-emerald-900/40 relative z-10">
                        {batchTopics.map((t) => {
                            const isActive = activeTopicId === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => handleSwitchTopic(t)}
                                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-2 max-w-xs ${
                                        isActive
                                            ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200 shadow-md ring-1 ring-emerald-500/40'
                                            : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
                                    }`}
                                >
                                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-900 border border-gray-800 text-emerald-300 shrink-0">
                                        #{t.id}
                                    </span>
                                    <span className="truncate">"{t.title}"</span>
                                    <span
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                            t.isCurrentlyRendering
                                                ? 'bg-emerald-900 text-emerald-200 border border-emerald-500 animate-pulse'
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

            {/* Main Studio Vertical Stacked Layout */}
            <div className="space-y-6 max-w-5xl mx-auto">
                {/* TOP: Large Live Preview Studio (Full Width) */}
                <div className="bg-gray-900/90 p-6 rounded-3xl border border-gray-800 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                        <h3 className="text-xs font-extrabold text-white flex items-center gap-2 uppercase tracking-wider">
                            <span>👁️</span> Live Canvas Preview (CSS Overlay)
                        </h3>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-800">
                            1920×1080 Full HD (16:9)
                        </span>
                    </div>

                    <div className="flex justify-center py-2">
                        <PreviewCanvas config={config} sampleImageUrl={sampleImageUrl} />
                    </div>
                </div>

                {/* 🖥️ Dedicated Render Progress & Real-Time Log Console Panel */}
                <div className="bg-gray-900/95 p-5 rounded-3xl border border-emerald-900/60 shadow-2xl space-y-3.5">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                {rendering ? (
                                    <>
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                                    </>
                                ) : (
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-900 border border-emerald-700" />
                                )}
                            </span>
                            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                                <span>🖥️</span> Status & Real-Time Console Log Render (FFmpeg Engine)
                            </h3>
                            {bulkProgress && (
                                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-mono animate-pulse">
                                    Batch: {bulkProgress.current} / {bulkProgress.total}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {rendering && (
                                <>
                                    <span className="text-xs font-mono font-bold text-gray-300 bg-gray-950 px-2.5 py-1 rounded-xl border border-gray-800 flex items-center gap-1.5 shadow-inner" title="Waktu Render Berjalan">
                                        <span>⏱️</span>
                                        <span>{formatSecToMinSec(elapsedSec)}</span>
                                    </span>

                                    {(() => {
                                        const remaining = getEstimatedTimeRemainingSec();
                                        return (
                                            <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded-xl border border-amber-800/80 flex items-center gap-1.5 shadow-inner animate-pulse" title="Estimasi Hitung Mundur Selesai">
                                                <span>⏳ Estimasi:</span>
                                                <span>{remaining !== null ? `~${formatSecToMinSec(remaining)}` : 'Menghitung...'}</span>
                                            </span>
                                        );
                                    })()}
                                </>
                            )}

                            <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950/90 px-3 py-1 rounded-xl border border-emerald-800/80 shadow-inner">
                                {renderProgress ? `${Math.round((renderProgress.progress || 0) * 100)}%` : '0%'}
                            </span>
                            <button
                                type="button"
                                onClick={() => setRenderLogs([])}
                                className="text-[10px] text-gray-400 hover:text-white bg-gray-950 border border-gray-800 px-2.5 py-1 rounded-xl transition-all"
                            >
                                🧹 Clear Log
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                        <div className="w-full bg-gray-950 rounded-full h-3.5 overflow-hidden border border-emerald-900/40 p-0.5 shadow-inner">
                            <div
                                className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(34,197,94,0.6)]"
                                style={{ width: `${Math.max(3, renderProgress ? Math.round((renderProgress.progress || 0) * 100) : 0)}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-gray-300 pt-0.5">
                            <span className="truncate pr-2 font-bold text-emerald-300">
                                {renderProgress?.message || (rendering ? 'Memproses video...' : 'Siap melakukan render video...')}
                            </span>
                            <span className="text-gray-500 shrink-0 font-bold">
                                {renderProgress ? `${Math.round((renderProgress.progress || 0) * 100)}%` : '0%'}
                            </span>
                        </div>
                    </div>

                    {/* Realtime Terminal Log Console Window */}
                    <div
                        ref={logConsoleRef}
                        className="bg-black/95 p-3.5 rounded-2xl border border-gray-800/90 text-[11px] h-44 overflow-y-auto font-mono space-y-1 text-gray-300 shadow-inner"
                    >
                        {renderLogs.length === 0 ? (
                            <div className="text-gray-600 italic flex items-center justify-center h-full text-center p-4">
                                ⏳ Belum ada log aktivitas render. Klik "Render Video" atau "Proses Bulk Render" untuk melihat log real-time di sini.
                            </div>
                        ) : (
                            renderLogs.map((log, idx) => (
                                <div
                                    key={idx}
                                    className={`truncate ${
                                        log.includes('❌') || log.includes('Gagal') || log.includes('Error')
                                            ? 'text-red-400 font-bold'
                                            : log.includes('🎉') || log.includes('Sukses') || log.includes('Selesai')
                                            ? 'text-emerald-300 font-bold'
                                            : log.includes('⚡') || log.includes('Encoding')
                                            ? 'text-amber-300 font-bold'
                                            : 'text-gray-300'
                                    }`}
                                >
                                    {log}
                                </div>
                            ))
                        )}
                    </div>
                </div>

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
                    <div className="bg-emerald-950/80 p-5 rounded-3xl border border-emerald-800/60 shadow-2xl space-y-2">
                        <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                            <span>❌</span> Gagal Melakukan Render Video
                        </h4>
                        <p className="text-[11px] text-emerald-200 font-mono whitespace-pre-wrap leading-relaxed">{renderError}</p>
                    </div>
                )}

                {/* BOTTOM: Configuration Panels Grid (2-Column Ergonomic Edit Stack) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                    {/* LEFT COLUMN: Caption, Vignette & Watermark */}
                    <div className="space-y-6">
                        {/* ─── 1. Subtitel & Caption Engine ─── */}
                        <ConfigSection title="💬 Subtitel & Caption Engine" icon="💬" subtitle="Tampilan teks transkrip narasi pada video 16:9">
                            <ToggleRow
                                label="Aktifkan Subtitel / Caption"
                                description="Tampilkan teks transkrip narasi otomatis pada video"
                                enabled={config.caption?.enabled !== false}
                                onChange={(v) => updateCaption({ enabled: v })}
                            />

                            {config.caption?.enabled !== false && (
                                <>
                                    <div className="space-y-1.5 bg-gray-950/60 p-3.5 rounded-2xl border border-gray-800/80">
                                        <span className="text-xs text-gray-200 font-bold">Mode Tampilan Subtitel</span>
                                        <p className="text-[10px] text-gray-400">Pilih pengelompokan format teks pada layar</p>
                                        <div className="grid grid-cols-3 gap-2 pt-1">
                                            {[
                                                { id: 'sentence', label: '📝 Kalimat (Sentence)', desc: 'Teks utuh per kalimat (Rekomendasi)' },
                                                { id: 'phrase', label: '💬 Frasa (3 Kata)', desc: 'Grup 3-4 kata per baris' },
                                                { id: 'single-word', label: '⚡ Kata (Single Word)', desc: 'Satu kata bergantian' },
                                            ].map((m) => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => updateCaption({ displayMode: m.id as any })}
                                                    className={`p-2.5 rounded-xl border text-left transition-all ${
                                                        (config.caption?.displayMode || 'sentence') === m.id
                                                            ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 shadow-md ring-1 ring-emerald-500/30'
                                                            : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                                                    }`}
                                                >
                                                    <div className="text-xs font-bold">{m.label}</div>
                                                    <div className="text-[10px] opacity-75 mt-0.5">{m.desc}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2 bg-gray-950/60 p-3.5 rounded-2xl border border-gray-800/80">
                                        <span className="text-xs text-gray-200 font-bold">Warna Subtitel & Preset Slate</span>
                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                            {[
                                                { label: 'Slate 300 (Rekomendasi)', color: '#CBD5E1' },
                                                { label: 'Slate 200', color: '#E2E8F0' },
                                                { label: 'White', color: '#FFFFFF' },
                                                { label: 'Emerald Accent', color: '#22C55E' },
                                            ].map((p) => (
                                                <button
                                                    key={p.color}
                                                    type="button"
                                                    onClick={() => updateCaption({ inactiveColorHex: p.color })}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                                                        (config.caption?.inactiveColorHex || '#CBD5E1').toUpperCase() === p.color.toUpperCase()
                                                            ? 'bg-gray-800 border-emerald-500 text-white ring-1 ring-emerald-500/50 shadow-md'
                                                            : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                                                    }`}
                                                >
                                                    <span className="w-3 h-3 rounded-full border border-gray-900 shadow-inner shrink-0" style={{ backgroundColor: p.color }} />
                                                    <span>{p.label}</span>
                                                </button>
                                            ))}
                                        </div>

                                        <ColorInput
                                            label="Pilih Warna Subtitel Custom (Hex)"
                                            value={config.caption?.inactiveColorHex || '#CBD5E1'}
                                            onChange={(v) => updateCaption({ inactiveColorHex: v })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <SliderRow
                                            label="Ukuran Font Subtitel"
                                            value={config.caption?.fontSize || 48}
                                            min={24}
                                            max={96}
                                            step={1}
                                            leftHint="Kecil (24px)"
                                            rightHint="Besar (96px)"
                                            onChange={(v) => updateCaption({ fontSize: v })}
                                            suffix="px"
                                        />
                                        <SliderRow
                                            label="Posisi Vertikal dari Bawah (Position Y)"
                                            value={config.caption?.positionY || 160}
                                            min={40}
                                            max={400}
                                            step={5}
                                            leftHint="Bawah (40px)"
                                            rightHint="Atas (400px)"
                                            onChange={(v) => updateCaption({ positionY: v })}
                                            suffix="px"
                                        />
                                    </div>
                                </>
                            )}
                        </ConfigSection>

                        {/* ─── 2. Vignette Darkening Panel ─── */}
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
                                            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${config.vignette.intensity === 0.50 ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'}`}
                                        >
                                            Sedang (50%)
                                        </button>
                                        <button
                                            onClick={() => updateVignette({ intensity: 0.75 })}
                                            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${config.vignette.intensity === 0.75 ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'}`}
                                        >
                                            🎬 Cinematic Dark (75%)
                                        </button>
                                        <button
                                            onClick={() => updateVignette({ intensity: 0.95 })}
                                            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${config.vignette.intensity === 0.95 ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'}`}
                                        >
                                            🌑 Extreme Dark (95%)
                                        </button>
                                    </div>
                                    <ColorInput label="Warna Vignette" value={config.vignette.colorHex} onChange={(v) => updateVignette({ colorHex: v })} />
                                </>
                            )}
                        </ConfigSection>

                        {/* ─── 3. Watermark & Branding Text ─── */}
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
                                            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 focus:border-emerald-500 focus:outline-none"
                                            maxLength={30}
                                            placeholder="Contoh: Waku Channel"
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
                    </div>

                    {/* RIGHT COLUMN: Audio VO, BGM, Export & Timeline Summary */}
                    <div className="space-y-6">
                        {/* ─── 4. Voice Over (VO) Audio Narasi ─── */}
                        <ConfigSection title="🎙️ Voice Over (VO) Audio Narasi" icon="🎙️" subtitle="Kontrol volume narasi suara manusia/TTS">
                            <ToggleRow
                                label="Aktifkan Narasi Voice Over"
                                description="Mematikan/mengaktifkan audio suara narator pada video hasil render"
                                enabled={config.voiceOver?.enabled ?? true}
                                onChange={(v) => updateVoiceOver({ enabled: v })}
                            />

                            {(config.voiceOver?.enabled ?? true) && (
                                <>
                                    <SliderRow
                                        label="Volume Audio Voice Over"
                                        description="Geser kanan untuk memperkerus narasi, geser kiri untuk memperkecil"
                                        value={config.voiceOver?.volume ?? 1.0}
                                        min={0}
                                        max={2}
                                        step={0.05}
                                        leftHint="🔇 Mute (0.0)"
                                        rightHint="🔊 Normal (1.0) ▶"
                                        onChange={(v) => updateVoiceOver({ volume: v })}
                                    />
                                    <div className="flex items-center gap-2 pt-1">
                                        <span className="text-xs text-gray-400 font-medium">Preset Volume:</span>
                                        <button
                                            onClick={() => updateVoiceOver({ volume: 0.5 })}
                                            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${config.voiceOver?.volume === 0.5 ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'}`}
                                        >
                                            Pelan (50%)
                                        </button>
                                        <button
                                            onClick={() => updateVoiceOver({ volume: 1.0 })}
                                            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${(config.voiceOver?.volume ?? 1.0) === 1.0 ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'}`}
                                        >
                                            🔊 Normal (100%)
                                        </button>
                                        <button
                                            onClick={() => updateVoiceOver({ volume: 1.5 })}
                                            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${config.voiceOver?.volume === 1.5 ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'}`}
                                        >
                                            📢 Loud (150%)
                                        </button>
                                        <button
                                            onClick={() => updateVoiceOver({ volume: 2.0 })}
                                            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${config.voiceOver?.volume === 2.0 ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'}`}
                                        >
                                            📢 Extra Loud (200%)
                                        </button>
                                    </div>
                                </>
                            )}
                        </ConfigSection>

                        {/* ─── 5. Background Music (BGM) ─── */}
                        <ConfigSection title="🎵 Background Music (BGM)" icon="🎵" subtitle="Audio latar musik Waku">
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
                                            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 font-mono focus:border-emerald-500 focus:outline-none"
                                        >
                                            <option value="assets/'Hiraeth' [Emotional Classical CC-BY] - Scott Buckley.mp3">Scott Buckley - Hiraeth (Default Waku Comfort BGM)</option>
                                            <option value="assets/Edge Of Unknown.mp3">Edge Of Unknown</option>
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

                        {/* ─── 6. Output & Quality Presets ─── */}
                        <ConfigSection title="⚙️ Parameter Ekspor Video" icon="⚙️" subtitle="Format 16:9 YouTube Longform">
                            <SelectRow
                                label="Kualitas & Kecepatan Enkoding"
                                value={config.outputQuality}
                                options={QUALITY_OPTIONS}
                                onChange={(v) => updateConfig('outputQuality', v as WakuRenderConfig['outputQuality'])}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="Resolusi Lebar (Width)" value={config.resolution.width} onChange={(v) => updateConfig('resolution', { ...config.resolution, width: v })} suffix="px" />
                                <NumberInput label="Resolusi Tinggi (Height)" value={config.resolution.height} onChange={(v) => updateConfig('resolution', { ...config.resolution, height: v })} suffix="px" />
                            </div>

                            <NumberInput label="Framerate Video (FPS)" value={config.fps} min={15} max={60} onChange={(v) => updateConfig('fps', v)} suffix="fps" />
                        </ConfigSection>

                        {/* ─── 7. Timeline Summary Card ─── */}
                        {timeline && (
                            <div className="bg-gray-900/90 p-5 rounded-3xl border border-gray-800 shadow-xl space-y-3">
                                <h3 className="text-xs font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 uppercase tracking-wider">
                                    <span>📊</span> Ringkasan Timeline Waku Ready Render
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Total Klip Visual:</span>
                                            <span className="text-emerald-400 font-bold">{timeline.video_clips?.length || 0} segmen</span>
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
                                            <span className="text-emerald-400 font-bold">16:9 Longform</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WakuRenderStep;
