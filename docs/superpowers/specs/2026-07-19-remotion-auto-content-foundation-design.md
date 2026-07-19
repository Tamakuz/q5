# Remotion Auto-Content Foundation — Design Spec

**Date:** 2026-07-19
**Status:** Draft
**Goal:** Set up a minimal Remotion-based rendering engine foundation for automated YouTube content generation, driven by scene-based JSON input.

---

## 1. Overview

This project uses **Remotion purely as a render backend** (not as a full framework with its Studio UI). A custom engine sits between AI-generated scene JSON and Remotion's renderer, mapping scene definitions to React compositions and producing MP4 output via a CLI.

### 1.1 Target output

- **Phase 1 (current):** Vertical shorts (1080×1920, 30fps, ≤ 60s)
- **Phase 2 (future):** Long-form horizontal (1920×1080, configurable duration)

### 1.2 High-level architecture

```
scene.json + assets/  →  Scene Resolver Engine  →  Remotion Renderer  →  video.mp4
                              (custom)                (@remotion/renderer)
```

Three main components:
1. **JSON Input** — scene-based JSON (AI-generated), referencing local or remote assets
2. **Scene Resolver Engine** — custom layer that reads JSON, maps each scene to Remotion `<Composition>` instances, applies animations, audio, and transitions
3. **Remotion Renderer** — called programmatically via `@remotion/renderer`; no Studio UI involved

---

## 2. Project Structure

```
content-auto/
├── src/
│   ├── engine/
│   │   ├── resolver.ts        # JSON → compositions mapper
│   │   └── transitions.ts     # Transition logic between scenes
│   ├── scenes/
│   │   ├── TextScene.tsx       # Text-only compositions
│   │   └── ImageScene.tsx      # Image/media compositions
│   ├── types/
│   │   └── schema.ts          # Zod schemas + TypeScript types
│   ├── Root.tsx               # Main <Composition> wrapper for rendering
│   ├── index.ts               # Entry point for Remotion bundle
│   └── cli.ts                 # CLI: render, validate
├── assets/                    # Default local asset directory
├── input/                     # Place scene.json files here
├── output/                    # Rendered .mp4 videos land here
├── package.json
├── tsconfig.json
└── remotion.config.ts         # Remotion configuration
```

---

## 3. JSON Schema

### 3.1 Top-level structure

```json
{
  "version": "1",
  "metadata": {
    "title": "Video Title",
    "duration": 60,
    "resolution": { "width": 1080, "height": 1920 },
    "fps": 30
  },
  "audio": {
    "bgm": "./assets/music.mp3",
    "volume": 0.3
  },
  "scenes": [
    { "type": "text", "duration": 5, "transition": "fade", "data": { ... } },
    { "type": "image", "duration": 8, "transition": "slide-left", "data": { ... } }
  ]
}
```

### 3.2 Design decisions

| Decision | Rationale |
|---|---|
| Resolution defaults to 1080×1920 | Optimized for vertical shorts; overridable for long-form |
| Each scene has a `type` field | Custom engine resolves type → React component mapping |
| `transition` defined at scene level | Controls entrance animation from previous scene |
| `data` is a flexible per-type object | Each scene type defines its own data shape; validated by Zod discriminated union |
| Audio is global at the video level | Single BGM track across the entire video; voiceover per scene added later |
| Duration per scene in seconds | Total video duration = sum of all scene durations |

### 3.3 Scene types

#### TextScene

```json
{
  "type": "text",
  "duration": 5,
  "transition": "fade",
  "data": {
    "layers": [
      {
        "text": "Hello World",
        "style": "title",
        "animation": "scale-in",
        "position": "center",
        "color": "#FFFFFF"
      }
    ],
    "background": { "type": "color", "value": "#1A1A2E" }
  }
}
```

**Fields:**
- `style`: `title` | `subtitle` | `body` | `quote` (maps to font size + weight presets)
- `animation`: `fade-in` | `scale-in` | `slide-up` | `typewriter` | `none`
- `position`: `center` | `top` | `bottom` | custom `{x, y}` %
- `background.type`: `color` | `gradient` | `transparent`

Future: `animation` per text character/word (staggered reveal).

#### ImageScene

```json
{
  "type": "image",
  "duration": 8,
  "transition": "slide-left",
  "data": {
    "src": "./assets/photo.jpg",
    "fit": "cover",
    "animation": "ken-burns",
    "overlay": {
      "text": "Optional caption",
      "position": "bottom"
    }
  }
}
```

**Fields:**
- `src`: local path or remote URL
- `fit`: `cover` | `contain` | `fill`
- `animation`: `ken-burns` | `zoom-in` | `zoom-out` | `pan-left` | `pan-right` | `none`
- `overlay`: optional text caption overlay

Future: video clips as media source (`type: "video"`).

#### Audio behavior (global)

```json
{
  "audio": {
    "bgm": "./assets/music.mp3",
    "volume": 0.3
  }
}
```

Applied across the full video duration. Future: per-scene voiceover that auto-adjusts scene duration to audio length.

---

## 4. Scene Resolver Engine

### 4.1 Responsibility

The resolver:
1. Reads and validates JSON input (Zod schema)
2. Flattens scenes into a timeline (cumulative start frames)
3. Generates `<Sequence>` components for each scene
4. Wraps everything in a single `<Composition>`
5. Returns the composition ready for Remotion bundler

### 4.2 Transitions

Defined in `src/engine/transitions.ts`:
- `fade` — opacity 0→1 over 0.3s
- `slide-left` / `slide-right` / `slide-up` / `slide-down` — translate + fade
- `none` — instant cut

Transition duration is a constant (default 15 frames / 0.5s). A transition belongs to the *incoming* scene (its entrance animation).

### 4.3 Performance considerations

- `<OffthreadVideo>` for video assets (GPU-decoded, non-blocking main thread)
- `<Img>` from Remotion for images (handles caching and off-main-thread decoding)
- Audio uses `<Audio>` with `--codec=mp3` render flag

---

## 5. CLI

### 5.1 Commands

```bash
# Render a video
npx content-auto render input/scene.json -o output/video.mp4

# Validate JSON without rendering
npx content-auto validate input/scene.json

# Optional flags
# --resolution=1080x1920  (override JSON resolution)
# --fps=30                (override JSON fps)
# --codec=h264            (h264 | h265 | vp8 | vp9)
```

### 5.2 Render flow (CLI)

1. Parse arguments (commander)
2. Validate JSON with Zod
3. Resolve asset paths (relative to JSON file location)
4. Bundle with `@remotion/bundler`
5. Render with `@remotion/renderer`
6. Write MP4 to output path

### 5.3 Dependencies

| Package | Purpose |
|---|---|
| `@remotion/bundler` | Bundle React compositions into a renderable bundle |
| `@remotion/renderer` | Render compositions to MP4 programmatically |
| `@remotion/cli` | (dev only) for `npx remotion` commands |
| `react` + `react-dom` | Composition components |
| `remotion` | Core Remotion APIs (`<Composition>`, `<Sequence>`, `<Img>`, `<Audio>`, etc.) |
| `zod` | JSON schema validation |
| `commander` | CLI argument parsing |
| `typescript` + `ts-node` / `tsx` | Dev and CLI execution |

---

## 6. Out of Scope (Phase 1)

- Remotion Studio UI (intentionally excluded — we use only the programmatic API)
- AI JSON generation (JSON is assumed to be provided by an external AI service)
- Plugin system for scene types (will be added when scene type count exceeds ~10)
- Voiceover audio per scene (global BGM only for now)
- Remote asset downloading / caching
- Video clips as media sources (image + audio only)
- Caption/subtitle rendering
- Progress bar / status API (CLI gives console output only)

---

## 7. Success Criteria

- [ ] `content-auto render scene.json` produces a playable MP4
- [ ] Supports TextScene and ImageScene with all defined animation + transition types
- [ ] JSON validation catches malformed input with clear error messages
- [ ] Resolution correctly defaults to 1080×1920 vertical
- [ ] BGM audio plays across full video
- [ ] Scene transitions animate as defined
