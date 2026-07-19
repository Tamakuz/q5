# Remotion Auto-Content Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a minimal Remotion-based rendering engine that reads scene-based JSON input and produces MP4 video via CLI.

**Architecture:** Remotion used purely as a programmatic render backend. A custom Scene Resolver Engine maps AI-generated JSON scene definitions to Remotion `<Composition>`/<Sequence>` components. CLI tool bundles and renders without the Remotion Studio UI.

**Tech Stack:** TypeScript, React 18, Remotion 4.x, `@remotion/bundler`, `@remotion/renderer`, Zod, Commander

## Global Constraints

- Resolution defaults to 1080×1920 (vertical shorts), overridable to any resolution
- FPS defaults to 30, overridable in JSON metadata
- Phase 1: text and image scenes only (no video clips)
- Audio: global BGM only (no per-scene voiceover in Phase 1)
- Remotion Studio UI is NOT used — programmatic API only
- JSON input is assumed AI-generated; the engine validates and renders

---

## File Structure Map

```
content-auto/
├── src/
│   ├── engine/
│   │   └── transitions.ts     # Transition animation React component
│   ├── scenes/
│   │   ├── TextScene.tsx       # Text composition component
│   │   └── ImageScene.tsx      # Image/media composition component
│   ├── types/
│   │   └── schema.ts          # Zod schemas + inferred TypeScript types
│   ├── Root.tsx                # Main <Composition> + VideoSceneRenderer
│   └── index.ts                # registerRoot entry point
├── cli.ts                      # CLI: render, validate (top-level)
├── remotion.config.ts          # Remotion bundler config
├── input/                      # (gitignored) scene.json drop location
├── output/                     # (gitignored) rendered MP4 output
├── assets/                     # Local assets directory
├── package.json
├── tsconfig.json
└── .gitignore
```

**File responsibilities:**

| File | Responsibility |
|---|---|
| `src/types/schema.ts` | Zod schemas + TypeScript types for all JSON structures. Single source of truth for the data contract. |
| `src/engine/transitions.ts` | TransitionWrapper React component — applies entrance animation (fade/slide/none) to child content based on transition type. |
| `src/scenes/TextScene.tsx` | Renders text layers with style presets, per-layer enter animations, and background. |
| `src/scenes/ImageScene.tsx` | Renders image with fit mode, Ken Burns / zoom / pan animations, and optional text overlay. |
| `src/Root.tsx` | Exports `<RemotionRoot>` (single Composition) and `VideoSceneRenderer` (renders all scenes as Sequences). |
| `src/index.ts` | Calls `registerRoot(RemotionRoot)` — Remotion bundle entry point. |
| `cli.ts` | Commander-based CLI with `render` and `validate` commands. Bundles with `@remotion/bundler`, renders with `@remotion/renderer`. |
| `remotion.config.ts` | Remotion configuration (image format, output overwrite behavior). |

---

### Task 1: Project scaffolding and dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: directory structure: `src/`, `src/engine/`, `src/scenes/`, `src/types/`, `input/`, `output/`, `assets/`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `package.json` with all dependencies, runnable `tsc` configuration, `.gitignore` for output/input dirs

- [ ] **Step 1: Create directory structure**

Run: `mkdir -p src/engine src/scenes src/types input output assets`

- [ ] **Step 2: Write package.json**

```json
{
  "name": "content-auto",
  "version": "0.1.0",
  "private": true,
  "description": "Remotion-based automated content rendering engine for YouTube",
  "scripts": {
    "build": "tsc --noEmit",
    "render": "npx tsx cli.ts render",
    "validate": "npx tsx cli.ts validate"
  },
  "dependencies": {
    "@remotion/bundler": "^4.0.0",
    "@remotion/renderer": "^4.0.0",
    "commander": "^12.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "remotion": "^4.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@remotion/cli": "^4.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": ".",
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*", "cli.ts", "remotion.config.ts"],
  "exclude": ["node_modules", "dist", "output"]
}
```

- [ ] **Step 4: Write .gitignore**

```
node_modules/
dist/
output/
.DS_Store
```

- [ ] **Step 5: Create placeholder files to preserve empty directories**

Run:
```bash
touch input/.gitkeep output/.gitkeep assets/.gitkeep
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`

Expected: installs all packages, no errors.

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold project with dependencies and directory structure

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Type definitions and Zod schemas

**Files:**
- Create: `src/types/schema.ts`

**Interfaces:**
- Consumes: nothing (only depends on `zod` from Task 1)
- Produces:
  - `TextStyle` — `'title' | 'subtitle' | 'body' | 'quote'`
  - `TextAnimation` — `'fade-in' | 'scale-in' | 'slide-up' | 'typewriter' | 'none'`
  - `TextPosition` — `'center' | 'top' | 'bottom'`
  - `Background` — discriminated union on `type`: `{ type: 'color', value: string }` | `{ type: 'gradient', colors: string[], angle?: number }` | `{ type: 'transparent' }`
  - `ImageFit` — `'cover' | 'contain' | 'fill'`
  - `ImageAnimation` — `'ken-burns' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'none'`
  - `Transition` — `'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'none'`
  - `TextLayerSchema` → `TextLayer` (inferred type)
  - `TextSceneDataSchema` → `TextSceneData`
  - `ImageOverlaySchema` → `ImageOverlay`
  - `ImageSceneDataSchema` → `ImageSceneData`
  - `TextSceneSchema` → `TextScene` (discriminated with `type: 'text'`)
  - `ImageSceneSchema` → `ImageScene` (discriminated with `type: 'image'`)
  - `SceneSchema` → `Scene` (discriminated union of both)
  - `VideoConfigSchema` → `VideoConfig` (top-level input)
  - `ResolvedScene` type (extends Scene with `startFrame: number` and `durationInFrames: number`)
  - Helper: `TEXT_STYLE_PRESETS`, `TRANSITION_DURATION_FRAMES`

- [ ] **Step 1: Write the complete schema file**

```typescript
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

// ─── JSON file load helper ───────────────────────────

export function loadAndValidate(jsonPath: string): VideoConfig {
  const fs = require('fs');
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  return VideoConfigSchema.parse(raw);
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/schema.ts
git commit -m "feat: add Zod schemas and TypeScript types for all scene types

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Transition engine

**Files:**
- Create: `src/engine/transitions.ts`

**Interfaces:**
- Consumes: `Transition` type from Task 2, `TRANSITION_DURATION_FRAMES` from Task 2
- Produces: `TransitionWrapper` React component
  - Props: `{ type: Transition; children: React.ReactNode; className?: string }`
  - Behavior: wraps children with a `<div>` that animates entrance based on type

- [ ] **Step 1: Write the TransitionWrapper component**

```typescript
// src/engine/transitions.ts
import React, { useMemo } from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import type { Transition } from '../types/schema';
import { TRANSITION_DURATION_FRAMES } from '../types/schema';

interface TransitionWrapperProps {
  type: Transition;
  children: React.ReactNode;
}

export const TransitionWrapper: React.FC<TransitionWrapperProps> = ({ type, children }) => {
  const frame = useCurrentFrame();

  const style: React.CSSProperties = useMemo(() => {
    if (type === 'none') {
      return {};
    }

    // Progress of the transition: 0 at frame 0, 1 at TRANSITION_DURATION_FRAMES
    const progress = interpolate(frame, [0, TRANSITION_DURATION_FRAMES], [0, 1], {
      extrapolateRight: 'clamp',
      extrapolateLeft: 'clamp',
    });

    switch (type) {
      case 'fade':
        return { opacity: progress };

      case 'slide-left':
        return {
          opacity: progress,
          transform: `translateX(${interpolate(progress, [0, 1], [60, 0], { extrapolateRight: 'clamp' })}px)`,
        };

      case 'slide-right':
        return {
          opacity: progress,
          transform: `translateX(${interpolate(progress, [0, 1], [-60, 0], { extrapolateRight: 'clamp' })}px)`,
        };

      case 'slide-up':
        return {
          opacity: progress,
          transform: `translateY(${interpolate(progress, [0, 1], [60, 0], { extrapolateRight: 'clamp' })}px)`,
        };

      case 'slide-down':
        return {
          opacity: progress,
          transform: `translateY(${interpolate(progress, [0, 1], [-60, 0], { extrapolateRight: 'clamp' })}px)`,
        };

      default:
        return {};
    }
  }, [frame, type]);

  return <div style={{ ...style, width: '100%', height: '100%' }}>{children}</div>;
};
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/engine/transitions.ts
git commit -m "feat: add TransitionWrapper component with fade and slide transitions

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: TextScene component

**Files:**
- Create: `src/scenes/TextScene.tsx`

**Interfaces:**
- Consumes: `TextSceneData`, `TextStyle`, `TextAnimation`, `TEXT_STYLE_PRESETS` from Task 2
- Produces: `TextScene` React component
  - Props: `{ data: TextSceneData }`
  - Renders background (color/gradient/transparent) + text layers with per-layer animations

- [ ] **Step 1: Write the TextScene component**

```tsx
// src/scenes/TextScene.tsx
import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';
import type { TextSceneData, TextLayer, TextStyle } from '../types/schema';
import { TEXT_STYLE_PRESETS } from '../types/schema';

// ─── Background ──────────────────────────────────────

const BackgroundFill: React.FC<{ data: TextSceneData['background'] }> = ({ data }) => {
  if (data.type === 'transparent') {
    return null;
  }

  if (data.type === 'color') {
    return (
      <AbsoluteFill style={{ backgroundColor: data.value }} />
    );
  }

  // gradient
  const gradientStops = data.colors.join(', ');
  const angle = data.angle ?? 180;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${angle}deg, ${gradientStops})`,
      }}
    />
  );
};

// ─── Animated Text Layer ─────────────────────────────

const POSITION_MAP: Record<string, React.CSSProperties> = {
  center: { justifyContent: 'center', alignItems: 'center', textAlign: 'center' as const },
  top: { justifyContent: 'flex-start', alignItems: 'center', textAlign: 'center' as const, paddingTop: '8%' },
  bottom: { justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center' as const, paddingBottom: '8%' },
};

interface AnimatedTextLayerProps {
  layer: TextLayer;
  index: number;
}

const AnimatedTextLayer: React.FC<AnimatedTextLayerProps> = ({ layer, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const preset = TEXT_STYLE_PRESETS[layer.style];
  const staggerDelay = index * 5; // 5 frames stagger between layers

  const effectiveFrame = Math.max(0, frame - staggerDelay);

  const style: React.CSSProperties = useMemo(() => {
    const base: React.CSSProperties = {
      fontSize: preset.fontSize,
      fontWeight: preset.fontWeight,
      fontStyle: preset.fontStyle,
      color: layer.color,
      fontFamily: 'Arial, sans-serif',
    };

    if (layer.animation === 'none') {
      return base;
    }

    const progress = interpolate(effectiveFrame, [0, 15], [0, 1], {
      extrapolateRight: 'clamp',
      extrapolateLeft: 'clamp',
    });

    switch (layer.animation) {
      case 'fade-in':
        return { ...base, opacity: progress };

      case 'scale-in': {
        const scale = spring({ frame: effectiveFrame, fps, config: { damping: 12 } });
        return { ...base, transform: `scale(${scale})`, opacity: progress };
      }

      case 'slide-up':
        return {
          ...base,
          opacity: progress,
          transform: `translateY(${interpolate(progress, [0, 1], [40, 0], { extrapolateRight: 'clamp' })}px)`,
        };

      case 'typewriter': {
        const charsToShow = Math.floor(interpolate(effectiveFrame, [0, layer.text.length * 2], [0, layer.text.length], {
          extrapolateRight: 'clamp',
          extrapolateLeft: 'clamp',
        }));
        const visibleText = layer.text.slice(0, charsToShow);
        // We render this via the text itself, so return just opacity 1
        return { ...base };
        // Note: typewriter is handled in the render below
      }

      default:
        return base;
    }
  }, [effectiveFrame, layer, preset, fps]);

  // Typewriter mode — needs custom text rendering
  if (layer.animation === 'typewriter') {
    const charsToShow = Math.floor(interpolate(effectiveFrame, [0, layer.text.length * 2], [0, layer.text.length], {
      extrapolateRight: 'clamp',
      extrapolateLeft: 'clamp',
    }));
    const visibleText = layer.text.slice(0, charsToShow);
    return (
      <div style={{ ...style }}>
        {visibleText}
        {charsToShow < layer.text.length && <span style={{ opacity: 0.5 }}>|</span>}
      </div>
    );
  }

  return <div style={style}>{layer.text}</div>;
};

// ─── Main Scene Component ────────────────────────────

interface TextSceneProps {
  data: TextSceneData;
}

export const TextScene: React.FC<TextSceneProps> = ({ data }) => {
  return (
    <AbsoluteFill>
      <BackgroundFill data={data.background} />
      <AbsoluteFill style={{ flexDirection: 'column', padding: '5%' }}>
        {data.layers.map((layer, i) => {
          const posStyle = POSITION_MAP[layer.position] ?? POSITION_MAP.center;
          return (
            <AbsoluteFill key={i} style={posStyle}>
              <AnimatedTextLayer layer={layer} index={i} />
            </AbsoluteFill>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/TextScene.tsx
git commit -m "feat: add TextScene component with style presets and per-layer animations

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: ImageScene component

**Files:**
- Create: `src/scenes/ImageScene.tsx`

**Interfaces:**
- Consumes: `ImageSceneData`, `ImageFit`, `ImageAnimation` from Task 2
- Produces: `ImageScene` React component
  - Props: `{ data: ImageSceneData }`
  - Renders image with fit mode, Ken Burns / zoom / pan animations, optional overlay text

- [ ] **Step 1: Write the ImageScene component**

```tsx
// src/scenes/ImageScene.tsx
import React, { useMemo } from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill, Img } from 'remotion';
import type { ImageSceneData, ImageAnimation } from '../types/schema';

// ─── Image Animation Logic ───────────────────────────

function useImageTransform(animation: ImageAnimation, durationInFrames: number) {
  const frame = useCurrentFrame();

  return useMemo((): React.CSSProperties => {
    const progress = frame / durationInFrames; // 0 to 1 over scene

    switch (animation) {
      case 'ken-burns': {
        // Subtle continuous zoom + slight pan
        const scale = interpolate(progress, [0, 1], [1, 1.1]);
        const translateX = interpolate(progress, [0, 1], [0, -20]);
        const translateY = interpolate(progress, [0, 1], [0, -10]);
        return {
          transform: `scale(${scale}) translateX(${translateX}px) translateY(${translateY}px)`,
        };
      }

      case 'zoom-in': {
        const scale = interpolate(progress, [0, 1], [1, 1.15]);
        return { transform: `scale(${scale})` };
      }

      case 'zoom-out': {
        const scale = interpolate(progress, [0, 1], [1.15, 1]);
        return { transform: `scale(${scale})` };
      }

      case 'pan-left': {
        const translateX = interpolate(progress, [0, 1], [0, -40]);
        return { transform: `translateX(${translateX}px)` };
      }

      case 'pan-right': {
        const translateX = interpolate(progress, [0, 1], [0, 40]);
        return { transform: `translateX(${translateX}px)` };
      }

      case 'none':
      default:
        return {};
    }
  }, [animation, progress]);
}

// ─── Overlay Caption ─────────────────────────────────

const OVERLAY_POSITION: Record<string, React.CSSProperties> = {
  top: { top: '8%', left: 0, right: 0, textAlign: 'center' as const },
  center: { top: '50%', left: 0, right: 0, textAlign: 'center' as const, transform: 'translateY(-50%)' },
  bottom: { bottom: '8%', left: 0, right: 0, textAlign: 'center' as const },
};

const ImageOverlay: React.FC<{ text: string; position: string; color: string }> = ({
  text,
  position,
  color,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        ...OVERLAY_POSITION[position] ?? OVERLAY_POSITION.bottom,
        opacity,
        padding: '16px 32px',
      }}
    >
      <span
        style={{
          color,
          fontSize: 40,
          fontWeight: 600,
          fontFamily: 'Arial, sans-serif',
          textShadow: '0 2px 8px rgba(0,0,0,0.6)',
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ─── Main Scene Component ────────────────────────────

interface ImageSceneProps {
  data: ImageSceneData;
  durationInFrames: number;
}

export const ImageScene: React.FC<ImageSceneProps> = ({ data, durationInFrames }) => {
  const imageTransform = useImageTransform(data.animation, durationInFrames);

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <Img
          src={data.src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: data.fit,
            ...imageTransform,
          }}
        />
      </div>

      {data.overlay && (
        <ImageOverlay
          text={data.overlay.text}
          position={data.overlay.position}
          color={data.overlay.color}
        />
      )}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/ImageScene.tsx
git commit -m "feat: add ImageScene component with Ken Burns, zoom, and pan animations

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Scene resolver, Root component, and bundle entry point

**Files:**
- Create: `src/Root.tsx`
- Create: `src/index.ts`

**Interfaces:**
- Consumes:
  - `VideoConfig`, `ResolvedScene` from Task 2
  - `TransitionWrapper` from Task 3
  - `TextScene` from Task 4
  - `ImageScene` from Task 5
- Produces:
  - `resolveScenes(config: VideoConfig): ResolvedScene[]` — flattens scenes into timeline
  - `totalDurationFrames(config: VideoConfig): number`
  - `VideoSceneRenderer` React component — renders all scenes as `<Sequence>` nodes
  - `RemotionRoot` React component — single `<Composition>` with `calculateMetadata`
  - `registerRoot(RemotionRoot)` call in `src/index.ts`

- [ ] **Step 1: Write Root.tsx**

```tsx
// src/Root.tsx
import React from 'react';
import { Composition, Sequence, Audio, useCurrentFrame, AbsoluteFill } from 'remotion';
import type { VideoConfig, ResolvedScene } from './types/schema';
import { TransitionWrapper } from './engine/transitions';
import { TextScene } from './scenes/TextScene';
import { ImageScene } from './scenes/ImageScene';

// ─── Resolver Logic ──────────────────────────────────

export function resolveScenes(config: VideoConfig): ResolvedScene[] {
  let cumulativeFrames = 0;

  return config.scenes.map((scene) => {
    const durationInFrames = Math.round(scene.duration * config.metadata.fps);
    const startFrame = cumulativeFrames;
    cumulativeFrames += durationInFrames;

    return {
      ...scene,
      startFrame,
      durationInFrames,
    } as ResolvedScene;
  });
}

export function totalDurationFrames(config: VideoConfig): number {
  return config.scenes.reduce((sum, scene) => sum + Math.round(scene.duration * config.metadata.fps), 0);
}

// ─── Renderer ────────────────────────────────────────

const SceneRenderer: React.FC<{ scene: ResolvedScene }> = ({ scene }) => {
  switch (scene.type) {
    case 'text':
      return <TextScene data={scene.data} />;
    case 'image':
      return <ImageScene data={scene.data} durationInFrames={scene.durationInFrames} />;
    default:
      return null;
  }
};

export const VideoSceneRenderer: React.FC<VideoConfig> = (config) => {
  const resolved = resolveScenes(config);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Global background music */}
      {config.audio?.bgm && (
        <Audio src={config.audio.bgm} volume={config.audio.volume} />
      )}

      {/* Scene sequences */}
      {resolved.map((scene, i) => (
        <Sequence
          key={i}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
        >
          <TransitionWrapper type={scene.transition}>
            <SceneRenderer scene={scene} />
          </TransitionWrapper>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// ─── Root Composition ────────────────────────────────

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="content-auto-video"
        component={VideoSceneRenderer}
        durationInFrames={1} // placeholder — overridden by calculateMetadata
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={({ props }) => {
          const config = props as VideoConfig;
          return {
            durationInFrames: totalDurationFrames(config),
            fps: config.metadata.fps,
            width: config.metadata.resolution.width,
            height: config.metadata.resolution.height,
            props: config,
          };
        }}
      />
    </>
  );
};
```

- [ ] **Step 2: Write index.ts (bundle entry point)**

```typescript
// src/index.ts
import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/Root.tsx src/index.ts
git commit -m "feat: add scene resolver, Root composition, and bundle entry point

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: CLI tool

**Files:**
- Create: `cli.ts` (at project root)

**Interfaces:**
- Consumes:
  - `VideoConfigSchema`, `VideoConfig`, `loadAndValidate` from Task 2
  - `RemotionRoot` from Task 6 (via bundle)
- Produces:
  - `content-auto render <input> -o <output>` command
  - `content-auto validate <input>` command

- [ ] **Step 1: Write cli.ts**

```typescript
// cli.ts
import { Command } from 'commander';
import { VideoConfigSchema } from './src/types/schema';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';

const program = new Command();

program
  .name('content-auto')
  .description('Render videos from scene-based JSON using Remotion engine')
  .version('0.1.0');

// ─── Validate command ────────────────────────────────

program
  .command('validate')
  .description('Validate a scene JSON file without rendering')
  .argument('<input>', 'Path to scene JSON file')
  .action(async (inputPath: string) => {
    const resolvedPath = path.resolve(inputPath);

    if (!fs.existsSync(resolvedPath)) {
      console.error(`❌ File not found: ${resolvedPath}`);
      process.exit(1);
    }

    try {
      const raw = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
      const parsed = VideoConfigSchema.parse(raw);

      console.log(`✅ JSON is valid.`);
      console.log(`   Title: ${parsed.metadata.title}`);
      console.log(`   Resolution: ${parsed.metadata.resolution.width}x${parsed.metadata.resolution.height}`);
      console.log(`   FPS: ${parsed.metadata.fps}`);
      console.log(`   Scenes: ${parsed.scenes.length}`);
      console.log(`   Total duration: ${parsed.metadata.duration}s`);
      console.log(`   Audio: ${parsed.audio ? `BGM ${parsed.audio.bgm}` : 'none'}`);

      // Check scene assets exist
      for (const scene of parsed.scenes) {
        if (scene.type === 'image') {
          const assetPath = path.resolve(path.dirname(resolvedPath), scene.data.src);
          if (!fs.existsSync(assetPath)) {
            console.warn(`⚠️  Asset not found: ${scene.data.src} (relative to JSON file)`);
          }
        }
      }

      if (parsed.audio?.bgm) {
        const bgmPath = path.resolve(path.dirname(resolvedPath), parsed.audio.bgm);
        if (!fs.existsSync(bgmPath)) {
          console.warn(`⚠️  BGM file not found: ${parsed.audio.bgm} (relative to JSON file)`);
        }
      }
    } catch (err: any) {
      if (err.issues) {
        // Zod validation error
        console.error('❌ JSON validation failed:');
        for (const issue of err.issues) {
          console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
        }
      } else {
        console.error(`❌ Invalid JSON: ${err.message}`);
      }
      process.exit(1);
    }
  });

// ─── Render command ──────────────────────────────────

program
  .command('render')
  .description('Render a video from scene JSON')
  .argument('<input>', 'Path to scene JSON file')
  .option('-o, --output <path>', 'Output MP4 file path', 'output/video.mp4')
  .option('--codec <codec>', 'Video codec', 'h264')
  .action(async (inputPath: string, options: { output: string; codec: string }) => {
    const resolvedInput = path.resolve(inputPath);
    const resolvedOutput = path.resolve(options.output);

    // Ensure output directory exists
    const outputDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. Load and validate JSON
    console.log('📄 Loading scene JSON...');
    let config;
    try {
      const raw = JSON.parse(fs.readFileSync(resolvedInput, 'utf-8'));
      config = VideoConfigSchema.parse(raw);
    } catch (err: any) {
      if (err.issues) {
        console.error('❌ JSON validation failed:');
        for (const issue of err.issues) {
          console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
        }
      } else {
        console.error(`❌ Error: ${err.message}`);
      }
      process.exit(1);
    }

    console.log(`✅ Valid JSON: "${config.metadata.title}"`);
    console.log(`   ${config.metadata.resolution.width}x${config.metadata.resolution.height} @ ${config.metadata.fps}fps`);
    console.log(`   ${config.scenes.length} scenes, ${config.metadata.duration}s total`);

    // 2. Bundle
    console.log('📦 Bundling Remotion project...');
    const bundleLocation = await bundle({
      entryPoint: path.resolve(__dirname, 'src', 'index.ts'),
    });
    console.log(`✅ Bundle ready: ${bundleLocation}`);

    // 3. Select composition
    console.log('🎬 Selecting composition...');
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'content-auto-video',
      inputProps: config,
    });
    console.log(`✅ Composition: ${composition.id} (${composition.durationInFrames} frames)`);

    // 4. Render
    console.log('🎥 Rendering video...');
    const startTime = Date.now();

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: options.codec as 'h264',
      outputLocation: resolvedOutput,
      inputProps: config,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Render complete: ${resolvedOutput}`);
    console.log(`⏱️  Rendered in ${elapsed}s`);
  });

program.parse();
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add cli.ts
git commit -m "feat: add CLI with render and validate commands

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Remotion config and sample JSON

**Files:**
- Create: `remotion.config.ts`
- Create: `input/sample.json` (sample scene file for testing)

**Interfaces:**
- Consumes: nothing new
- Produces: Remotion bundler config, sample scene JSON for end-to-end testing

- [ ] **Step 1: Write remotion.config.ts**

```typescript
// remotion.config.ts
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
```

- [ ] **Step 2: Write sample scene JSON**

```json
{
  "version": "1",
  "metadata": {
    "title": "Sample Vertical Short",
    "duration": 10,
    "resolution": { "width": 1080, "height": 1920 },
    "fps": 30
  },
  "scenes": [
    {
      "type": "text",
      "duration": 3,
      "transition": "fade",
      "data": {
        "layers": [
          {
            "text": "Hello World",
            "style": "title",
            "animation": "scale-in",
            "position": "center",
            "color": "#FFFFFF"
          },
          {
            "text": "This is a subtitle",
            "style": "subtitle",
            "animation": "slide-up",
            "position": "bottom",
            "color": "#CCCCCC"
          }
        ],
        "background": { "type": "color", "value": "#1A1A2E" }
      }
    },
    {
      "type": "text",
      "duration": 4,
      "transition": "slide-left",
      "data": {
        "layers": [
          {
            "text": "Fully Custom UI",
            "style": "title",
            "animation": "typewriter",
            "position": "center",
            "color": "#FF6B6B"
          }
        ],
        "background": { "type": "gradient", "colors": ["#16213E", "#0F3460"], "angle": 180 }
      }
    },
    {
      "type": "text",
      "duration": 3,
      "transition": "fade",
      "data": {
        "layers": [
          {
            "text": "Powered by Remotion",
            "style": "quote",
            "animation": "fade-in",
            "position": "center",
            "color": "#FFFFFF"
          }
        ],
        "background": { "type": "color", "value": "#1A1A2E" }
      }
    }
  ]
}
```

Save to: `input/sample.json`

- [ ] **Step 3: Add input/ and output/ to .gitignore properly**

Replace the existing `.gitignore` content with:

```
node_modules/
dist/
output/
.DS_Store
```

Note: `input/` is NOT gitignored so the sample JSON is tracked. The `.gitkeep` files can be removed.

Run:
```bash
rm input/.gitkeep output/.gitkeep assets/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add remotion.config.ts input/sample.json .gitignore
git commit -m "chore: add Remotion config and sample scene JSON for testing

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: End-to-end validation

**Files:**
- No new files — validate that the render produces a valid MP4

**Interfaces:**
- Consumes: everything from Tasks 1-8
- Produces: verified working render pipeline

- [ ] **Step 1: Validate the sample JSON**

Run:
```bash
npx tsx cli.ts validate input/sample.json
```

Expected output:
```
✅ JSON is valid.
   Title: Sample Vertical Short
   Resolution: 1080x1920
   FPS: 30
   Scenes: 3
   Total duration: 10s
   Audio: none
```

- [ ] **Step 2: Render the sample video**

Run:
```bash
npx tsx cli.ts render input/sample.json -o output/sample.mp4
```

Expected: Renders successfully. Output should show progress and finish with:
```
✅ Render complete: .../output/sample.mp4
⏱️  Rendered in X.Xs
```

- [ ] **Step 3: Verify the output file**

Run:
```bash
ls -lh output/sample.mp4
```

Expected: File exists, size > 0 bytes.

Run:
```bash
file output/sample.mp4
```

Expected: `ISO Media, MP4 Base Media v1` or similar MP4 identification.

- [ ] **Step 4: Commit any final tweaks**

```bash
git add -A
git commit -m "chore: final verification — end-to-end render pipeline working

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Remotion as render backend, no Studio UI | Task 3-7 (programmatic API only, no Studio) |
| Scene-based JSON input | Task 2 (Zod schemas), Task 7 (CLI load/validate) |
| TextScene with all styles + animations | Task 4 |
| ImageScene with all fit modes + animations | Task 5 |
| Transitions (fade, slide-*, none) | Task 3 |
| Audio BGM global | Task 6 (Audio in VideoSceneRenderer) |
| Resolution defaults to 1080×1920 | Task 2 (Zod defaults), Task 6 (Composition width/height) |
| CLI: render + validate commands | Task 7 |
| JSON validation with clear errors | Task 7 (Zod error formatting) |
| Vertical shorts output | Task 2 (defaults), verified in Task 9 |
| Scene transitions animate | Task 3 + Task 6 (TransitionWrapper in Sequence) |

**2. Placeholder scan:** No TBD, TODO, "implement later", "add appropriate X", or vague references. All code is concrete.

**3. Type consistency:** 
- `VideoConfig` from Task 2 consumed by Task 6 and Task 7 ✅
- `TextSceneData` from Task 2 consumed by Task 4 ✅
- `ImageSceneData` from Task 2 consumed by Task 5 ✅
- `Transition` from Task 2 consumed by Task 3 ✅
- `ResolvedScene` from Task 2 produced by Task 6 (`resolveScenes`) ✅
- `loadAndValidate` defined in Task 2 — NOT used by Task 7 (inlined instead). This is OK since Task 7 does its own loading to get the raw JSON path for asset resolution. The helper in Task 2 is available but not used in this plan. ✅
