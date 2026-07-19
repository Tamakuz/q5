// src/types/schema.ts
import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────

export const TextStyleEnum = z.enum(['title', 'subtitle', 'body', 'quote']);
export type TextStyle = z.infer<typeof TextStyleEnum>;

export const TextAnimationEnum = z.enum(['fade-in', 'scale-in', 'slide-up', 'typewriter', 'none']);
export type TextAnimation = z.infer<typeof TextAnimationEnum>;

export const TextPositionEnum = z.enum(['center', 'top', 'bottom']);
export type TextPosition = z.infer<typeof TextPositionEnum>;

export const BackgroundSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('color'), value: z.string() }),
  z.object({ type: z.literal('gradient'), colors: z.array(z.string()), angle: z.number().optional() }),
  z.object({ type: z.literal('transparent') }),
]);
export type Background = z.infer<typeof BackgroundSchema>;

export const ImageFitEnum = z.enum(['cover', 'contain', 'fill']);
export type ImageFit = z.infer<typeof ImageFitEnum>;

export const ImageAnimationEnum = z.enum(['ken-burns', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'none']);
export type ImageAnimation = z.infer<typeof ImageAnimationEnum>;

export const TransitionEnum = z.enum(['fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'none']);
export type Transition = z.infer<typeof TransitionEnum>;

// ─── Text Scene Schemas ──────────────────────────────

export const TextLayerSchema = z.object({
  text: z.string(),
  style: TextStyleEnum,
  animation: TextAnimationEnum.default('fade-in'),
  position: TextPositionEnum.default('center'),
  color: z.string().default('#FFFFFF'),
});
export type TextLayer = z.infer<typeof TextLayerSchema>;

export const TextSceneDataSchema = z.object({
  layers: z.array(TextLayerSchema).min(1),
  background: BackgroundSchema.default({ type: 'color', value: '#1A1A2E' }),
});
export type TextSceneData = z.infer<typeof TextSceneDataSchema>;

export const TextSceneSchema = z.object({
  type: z.literal('text'),
  duration: z.number().positive(),
  transition: TransitionEnum.default('fade'),
  data: TextSceneDataSchema,
});
export type TextScene = z.infer<typeof TextSceneSchema>;

// ─── Image Scene Schemas ─────────────────────────────

export const ImageOverlaySchema = z.object({
  text: z.string(),
  position: TextPositionEnum.default('bottom'),
  color: z.string().default('#FFFFFF'),
});
export type ImageOverlay = z.infer<typeof ImageOverlaySchema>;

export const ImageSceneDataSchema = z.object({
  src: z.string(),
  fit: ImageFitEnum.default('cover'),
  animation: ImageAnimationEnum.default('ken-burns'),
  overlay: ImageOverlaySchema.optional(),
});
export type ImageSceneData = z.infer<typeof ImageSceneDataSchema>;

export const ImageSceneSchema = z.object({
  type: z.literal('image'),
  duration: z.number().positive(),
  transition: TransitionEnum.default('fade'),
  data: ImageSceneDataSchema,
});
export type ImageScene = z.infer<typeof ImageSceneSchema>;

// ─── Video Config (top-level) ────────────────────────

export const SceneSchema = z.discriminatedUnion('type', [TextSceneSchema, ImageSceneSchema]);
export type Scene = z.infer<typeof SceneSchema>;

export const VideoConfigSchema = z.object({
  version: z.literal('1'),
  metadata: z.object({
    title: z.string(),
    duration: z.number().positive(),
    resolution: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }).default({ width: 1080, height: 1920 }),
    fps: z.number().int().positive().default(30),
  }),
  audio: z.object({
    bgm: z.string(),
    volume: z.number().min(0).max(1).default(0.3),
  }).optional(),
  scenes: z.array(SceneSchema).min(1),
});
export type VideoConfig = z.infer<typeof VideoConfigSchema>;

// ─── Resolved scene (post-engine processing) ─────────

export interface ResolvedScene extends Scene {
  startFrame: number;
  durationInFrames: number;
}

// ─── Constants ───────────────────────────────────────

export const TEXT_STYLE_PRESETS: Record<TextStyle, { fontSize: number; fontWeight: number; fontStyle?: string }> = {
  title: { fontSize: 80, fontWeight: 700 },
  subtitle: { fontSize: 48, fontWeight: 600 },
  body: { fontSize: 36, fontWeight: 400 },
  quote: { fontSize: 40, fontWeight: 400, fontStyle: 'italic' },
};

export const TRANSITION_DURATION_FRAMES = 15; // 0.5s at 30fps
