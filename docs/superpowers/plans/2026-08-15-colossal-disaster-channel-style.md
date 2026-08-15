# Colossal Survival & Disaster Channel Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a modular Channel Style Preset (`colossal-survival-disaster`) for Alur Film channels featuring 2-color thumbnail text overlays (Yellow + Red), colossal scale paradox prompts, CTR title rules, and narrative tone guidance.

**Architecture:** A knowledge reference markdown document under `docs/knowledge/channel-styles/` paired with a TypeScript preset registry module under `lib/alurfilm/styles/` (`types.ts`, `colossal-disaster.ts`, `index.ts`), registered in `AGENTS.md`.

**Tech Stack:** TypeScript, Node.js, Vitest/Jest (for tests), Markdown.

## Global Constraints

- **Preset ID**: `colossal-survival-disaster`
- **Text Palette**: Yellow `#FFD700` (Prefix/Neutral), Red `#FF0000` (Action/Threat), Black Stroke `#000000`
- **Thumbnail Word Count**: 2–4 words max
- **Title Structure**: `[PREMIS ANCAMAN COLOSSAL / SURVIVAL EKSTREM] ‼️ Alur Cerita Film` (Max 100 characters)

---

### Task 1: Knowledge Reference Document

**Files:**
- Create: `docs/knowledge/channel-styles/colossal-survival-disaster.md`

**Interfaces:**
- Produces: Knowledge reference documentation for LLMs and human creators detailing thumbnail 2-color rules, AI prompt generation blocks, CTR title formula, and pre-upload checklist.

- [ ] **Step 1: Write knowledge reference document**

Create `docs/knowledge/channel-styles/colossal-survival-disaster.md` with full context, color codes, visual rules, scale paradox guidance, title formula, and thumbnail text guidelines based on the 5 reference images.

- [ ] **Step 2: Commit**

```bash
git add docs/knowledge/channel-styles/colossal-survival-disaster.md
git commit -m "docs: add Colossal Survival & Disaster channel style knowledge guide"
```

---

### Task 2: TypeScript Preset Module & Registry

**Files:**
- Create: `lib/alurfilm/styles/types.ts`
- Create: `lib/alurfilm/styles/colossal-disaster.ts`
- Create: `lib/alurfilm/styles/index.ts`
- Test: `tests/lib/alurfilm/styles.test.ts`

**Interfaces:**
- Produces: `ChannelStylePreset` interface, `colossalDisasterStyle` instance, `getChannelStyle(id: string)` and `listChannelStyles()`.

- [ ] **Step 1: Write failing test for style registry**

Create `tests/lib/alurfilm/styles.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getChannelStyle, listChannelStyles } from '../../lib/alurfilm/styles/index.js';

describe('Channel Style Registry', () => {
  it('should list available presets including colossal-survival-disaster', () => {
    const styles = listChannelStyles();
    expect(styles.some(s => s.id === 'colossal-survival-disaster')).toBe(true);
  });

  it('should retrieve colossal-survival-disaster style by id', () => {
    const style = getChannelStyle('colossal-survival-disaster');
    expect(style).toBeDefined();
    expect(style?.textOverlay.primaryColor).toBe('#FFD700');
    expect(style?.textOverlay.secondaryColor).toBe('#FF0000');
  });

  it('should format thumbnail text into 2-color split structure', () => {
    const style = getChannelStyle('colossal-survival-disaster');
    const formatted = style?.formatThumbnailText('DIA', 'MASIH HIDUP');
    expect(formatted?.part1).toBe('DIA');
    expect(formatted?.part2).toBe('MASIH HIDUP');
    expect(formatted?.color1).toBe('#FFD700');
    expect(formatted?.color2).toBe('#FF0000');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/lib/alurfilm/styles.test.ts`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement `types.ts`, `colossal-disaster.ts`, and `index.ts`**

Create `lib/alurfilm/styles/types.ts`:
```ts
export interface TextOverlayConfig {
  primaryColor: string;    // Gold Yellow #FFD700
  secondaryColor: string;  // Red #FF0000
  strokeColor: string;     // Black #000000
  fontFamily: string;      // Impact, Montserrat ExtraBold, Bebas Neue
  strokeWidth: number;
  maxWords: number;
}

export interface ThumbnailPromptConfig {
  scaleParadoxRule: string;
  threatTypes: string[];
  visualPromptTemplate: string;
}

export interface TitleRulesConfig {
  suffix: string; // ‼️ Alur Cerita Film
  maxChars: number; // 100
}

export interface ChannelStylePreset {
  id: string;
  name: string;
  description: string;
  textOverlay: TextOverlayConfig;
  promptConfig: ThumbnailPromptConfig;
  titleRules: TitleRulesConfig;
  formatThumbnailText: (part1: string, part2: string) => {
    part1: string;
    part2: string;
    color1: string;
    color2: string;
    strokeColor: string;
  };
}
```

Create `lib/alurfilm/styles/colossal-disaster.ts`:
```ts
import { ChannelStylePreset } from './types.js';

export const colossalDisasterStyle: ChannelStylePreset = {
  id: 'colossal-survival-disaster',
  name: 'Colossal Survival & Disaster',
  description: 'Style alur film sci-fi disaster & anomali raksasa dengan teks thumbnail 2-warna (Kuning-Merah) dan prompt visual skala kolosal.',
  textOverlay: {
    primaryColor: '#FFD700',
    secondaryColor: '#FF0000',
    strokeColor: '#000000',
    fontFamily: 'Impact, Montserrat ExtraBold, Bebas Neue, sans-serif',
    strokeWidth: 10,
    maxWords: 4,
  },
  promptConfig: {
    scaleParadoxRule: 'Siluet manusia kecil di 1/3 frame bawah menghadap ancaman/anomali raksasa di latar tengah/belakang.',
    threatTypes: [
      'Giant ancient stone statues / titan awakening in cliff',
      'Massive ocean tsunami wall crashing into city avenue',
      'Crashed airliner in desert sand dune fissure',
      'Tall slender colossal monstrosities in flooded sea city',
    ],
    visualPromptTemplate: 'Cinematic 8k film poster, colossal scale paradox, small human survivors in lower foreground viewing [COLOSSAL_THREAT] in [ENVIRONMENT], volumetric fog, gritty textures, dramatic high-contrast lighting, 16:9 ratio --ar 16:9',
  },
  titleRules: {
    suffix: '‼️ Alur Cerita Film',
    maxChars: 100,
  },
  formatThumbnailText: (part1: string, part2: string) => ({
    part1: part1.toUpperCase(),
    part2: part2.toUpperCase(),
    color1: '#FFD700',
    color2: '#FF0000',
    strokeColor: '#000000',
  }),
};
```

Create `lib/alurfilm/styles/index.ts`:
```ts
import { ChannelStylePreset } from './types.js';
import { colossalDisasterStyle } from './colossal-disaster.js';

const stylesRegistry: Record<string, ChannelStylePreset> = {
  [colossalDisasterStyle.id]: colossalDisasterStyle,
};

export function getChannelStyle(id: string): ChannelStylePreset | undefined {
  return stylesRegistry[id];
}

export function listChannelStyles(): ChannelStylePreset[] {
  return Object.values(stylesRegistry);
}

export { colossalDisasterStyle };
export * from './types.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/alurfilm/styles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/alurfilm/styles/ tests/lib/alurfilm/styles.test.ts
git commit -m "feat(alurfilm): add Colossal Survival & Disaster channel style preset module"
```

---

### Task 3: Knowledge Rule Registration in `AGENTS.md`

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update `AGENTS.md` Knowledge References**

Add `- **Colossal Survival & Disaster Channel Style**: Refer to [colossal-survival-disaster.md](file:///home/jovan/project/content-auto/docs/knowledge/channel-styles/colossal-survival-disaster.md) for 2-color thumbnail text overlays (Yellow/Red), scale paradox visual prompts, CTR title rules, and narrative tone.` under `## Knowledge References`.

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: register colossal survival channel style in AGENTS.md"
```
