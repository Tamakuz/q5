# Design Spec: Colossal Survival & Disaster Channel Style Preset

## 1. Goal & Context
Define and implement a reusable channel style preset (`colossal-survival-disaster`) in `content-auto` inspired by high-CTR YouTube Alur Film channels featuring colossal sci-fi anomalies, giant titan awakenings, post-apocalyptic disasters, and extreme human survival.

## 2. Channel Style DNA & Reference Analysis
From reference thumbnail analysis, this channel style consists of three main pillars:
1. **Thumbnail Text Styling**:
   - Split 2-color text banner: Part 1 Yellow (`#FFD700`/`0xFFD700`), Part 2 Red (`#FF0000`/`0xFF0000`).
   - Font: Heavy extra-bold sans-serif (Impact / Montserrat Black / Bebas Neue).
   - Effects: Thick solid black stroke (8-12px) + dark drop shadow.
   - Text content: 2–4 words max (e.g. `DIA MASIH HIDUP`, `TEMBOK AIR`, `TAK ADA JALAN PULANG`, `PATUNG INI TERNYATA HIDUP`, `MEREKA DATANG`).
   - Position: Top-center aligned.
2. **Visual Imagery & Scale Paradox**:
   - Frame layout: Human silhouetted survivors/explorers in lower 1/3 foreground (often back-view looking outward).
   - Midground/Background: Colossal threat/anomaly (giant ancient statues carved in cliffs, skyscraper-tall ocean tsunami wall, crashed airliner in desert fissure, tall slender monstrosities in flooded city).
   - Atmosphere: Gritty 8K cinematic poster texture, volumetric mist/smoke/sand dust, dramatic contrast (cyan-teal, desert gold, or stormy overcast).
3. **Title & Narrative Formula**:
   - Title structure: `[PREMIS ANCAMAN COLOSSAL / SURVIVAL EKSTREM] ‼️ Alur Cerita Film` (Max 100 chars).
   - Narrative tone: Suspenseful, high-stakes, primal survival curiosity gap.

## 3. Architecture & File Structure

```text
content-auto/
├── docs/
│   └── knowledge/
│       └── channel-styles/
│           └── colossal-survival-disaster.md  <-- Detailed Knowledge Guide
├── lib/
│   └── alurfilm/
│       └── styles/
│           ├── types.ts                        <-- Interface ChannelStylePreset
│           ├── colossal-disaster.ts            <-- Preset Definition
│           └── index.ts                        <-- Preset Registry & Export Engine
└── AGENTS.md                                   <-- AGENTS Rule Knowledge Registration
```

### Component Details

#### A. Knowledge Reference (`docs/knowledge/channel-styles/colossal-survival-disaster.md`)
Contains full guidelines for AI prompt generation, color matrices, title formulas, visual prompt blocks, and pre-upload checklist for this channel style.

#### B. TypeScript Preset Registry (`lib/alurfilm/styles/`)
- `types.ts`: Defines `ChannelStylePreset` interface including `id`, `name`, `textOverlay`, `promptTemplate`, `titleRules`, and helper formatting functions.
- `colossal-disaster.ts`: Exports `colossalDisasterStyle` instance.
- `index.ts`: Central registry exporting `getChannelStyle(id)`, `listChannelStyles()`, and default preset.

#### C. Rule Integration (`AGENTS.md`)
Appends reference to `channel-styles/colossal-survival-disaster.md` under Knowledge References.

## 4. Verification Plan
- Unit tests for `lib/alurfilm/styles/` verifying preset lookup, prompt builder formatting, and text style parameters.
- TypeScript compiler verification (`npx tsc --noEmit`).
