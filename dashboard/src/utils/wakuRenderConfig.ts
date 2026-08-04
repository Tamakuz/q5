// dashboard/src/utils/wakuRenderConfig.ts
import { z } from 'zod';
import { WAKU_CAPTION_COLORS } from './wakuTheme';

// ─── Watermark Text Configuration ─────────────────────

export const WatermarkTextConfigSchema = z.object({
    enabled: z.boolean().default(true),
    text: z.string().default('Waku'),
    fontFamily: z.string().default('Montserrat'),
    fontSize: z.number().min(8).max(120).default(42),
    colorHex: z.string().default('#FFFFFF'),
    opacity: z.number().min(0).max(1).default(0.8),
    position: z.enum([
        'top-left',
        'top-center',
        'top-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
    ]).default('bottom-center'),
    offsetX: z.number().default(0),
    offsetY: z.number().default(80),
});

export type WatermarkTextConfig = z.infer<typeof WatermarkTextConfigSchema>;

// ─── Caption Configuration ────────────────────────────

export const CaptionConfigSchema = z.object({
    enabled: z.boolean().default(true),
    fontName: z.string().default('Montserrat'),
    fontSize: z.number().default(48),
    activeColorHex: z.string().default(WAKU_CAPTION_COLORS.activeColorHex),
    inactiveColorHex: z.string().default(WAKU_CAPTION_COLORS.inactiveColorHex),
    outlineColorHex: z.string().default(WAKU_CAPTION_COLORS.outlineColorHex),
    outlineWidth: z.number().default(3),
    shadowDistance: z.number().default(2),
    positionY: z.number().default(160),
    positionX: z.number().default(40),
    alignment: z.number().min(1).max(9).default(2),
    displayMode: z.enum(['single-word', 'phrase', 'sentence']).default('sentence'),
    timeOffsetSec: z.number().default(0.0),
});

export type CaptionConfig = z.infer<typeof CaptionConfigSchema>;

// ─── Voice Over (VO) Configuration ───────────────────

export const VoiceOverConfigSchema = z.object({
    enabled: z.boolean().default(true),
    volume: z.number().min(0).max(2).default(1.0),
});

export type VoiceOverConfig = z.infer<typeof VoiceOverConfigSchema>;

// ─── BGM Configuration ────────────────────────────────

export const BgmConfigSchema = z.object({
    enabled: z.boolean().default(true),
    path: z.string().default("assets/'Hiraeth' [Emotional Classical CC-BY] - Scott Buckley.mp3"),
    volume: z.number().min(0).max(1).default(0.15),
    fadeInSec: z.number().min(0).default(1.0),
    fadeOutSec: z.number().min(0).default(2.0),
});

export type BgmConfig = z.infer<typeof BgmConfigSchema>;

// ─── Vignette Configuration ───────────────────────────

export const VignetteConfigSchema = z.object({
    enabled: z.boolean().default(true),
    intensity: z.number().min(0).max(1).default(0.75),
    colorHex: z.string().default('#000000'),
});

export type VignetteConfig = z.infer<typeof VignetteConfigSchema>;

// ─── Aggregate Waku Render Config ──────────────────

export const WakuRenderConfigSchema = z.object({
    voiceOver: VoiceOverConfigSchema.default({}),
    watermark: WatermarkTextConfigSchema.default({}),
    caption: CaptionConfigSchema.default({}),
    bgm: BgmConfigSchema.default({}),
    vignette: VignetteConfigSchema.default({}),
    resolution: z.object({
        width: z.number().default(1920),
        height: z.number().default(1080),
    }).default({}),
    fps: z.number().default(30),
    outputQuality: z.enum(['fast', 'balanced', 'high']).default('balanced'),
});

export type WakuRenderConfig = z.infer<typeof WakuRenderConfigSchema>;

// ─── Default Config ───────────────────────────────────

export function getDefaultWakuRenderConfig(): WakuRenderConfig {
    return WakuRenderConfigSchema.parse({});
}

// ─── Config Validation Helper ─────────────────────────

export function validateWakuRenderConfig(raw: unknown): {
    isValid: boolean;
    config: WakuRenderConfig | null;
    errors: string[];
} {
    const result = WakuRenderConfigSchema.safeParse(raw);
    if (result.success) {
        return { isValid: true, config: result.data, errors: [] };
    }
    return {
        isValid: false,
        config: null,
        errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
}
