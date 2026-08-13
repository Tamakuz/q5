# Shorts Daily AI Keyword Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-powered YouTube Shorts keyword generator with a 14-day anti-duplicate cooldown tracker for US market longform video sourcing across 4 sub-niches.

**Architecture:** A TypeScript backend service (`lib/shorts-keywords.ts`) manages `data/shorts-keywords-history.json`, integrates with Gemini AI for daily keyword generation, and exposes data both to a CLI tool (`scripts/generate-shorts-keywords.ts`) and the React Dashboard UI (`dashboard/src/components/shorts/ShortsSourceStep.tsx`).

**Tech Stack:** TypeScript, React (Vite/Tailwind), Google GenAI (`@google/genai` or Gemini REST/SDK), Node.js.

## Global Constraints
- Target market: United States (English search terms).
- Daily output quota: 4 keywords (1 per sub-niche: Mass Food Production, Industrial Manufacturing, Master Crafting, Woodworking/Resin).
- Cooldown period: Exactly 14 days (14 * 86400 * 1000 ms).
- Data storage file: `data/shorts-keywords-history.json`.

---

### Task 1: Create Data Storage & Keyword Manager Service

**Files:**
- Create: `data/shorts-keywords-history.json`
- Create: `lib/shorts-keywords.ts`

**Interfaces:**
- Produces: `getHistory()`, `getActiveKeywords(cooldownDays?: number)`, `saveKeywords(keywords: KeywordItem[])`, `generateDailyKeywords()`

- [ ] **Step 1: Create initial `data/shorts-keywords-history.json`**

```json
{
  "cooldown_days": 14,
  "history": []
}
```

- [ ] **Step 2: Create `lib/shorts-keywords.ts` service module**

```typescript
import fs from 'fs';
import path from 'path';

export interface KeywordItem {
  id: string;
  keyword: string;
  sub_niche: string;
  youtube_search_url: string;
  target_market: string;
  used_at: string;
  expires_at: string;
}

export interface KeywordsHistoryData {
  cooldown_days: number;
  history: KeywordItem[];
}

const DATA_FILE = path.resolve(process.cwd(), 'data/shorts-keywords-history.json');

export function loadKeywordsHistory(): KeywordsHistoryData {
  if (!fs.existsSync(DATA_FILE)) {
    const defaultData: KeywordsHistoryData = { cooldown_days: 14, history: [] };
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

export function saveKeywordsHistory(data: KeywordsHistoryData): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function getActiveKeywords(cooldownDays = 14): KeywordItem[] {
  const data = loadKeywordsHistory();
  const now = new Date();
  return data.history.filter((item) => {
    const expires = new Date(item.expires_at);
    return expires > now;
  });
}

export function addKeywordsToHistory(newItems: Omit<KeywordItem, 'id' | 'used_at' | 'expires_at'>[]): KeywordItem[] {
  const data = loadKeywordsHistory();
  const now = new Date();
  const expires = new Date(now.getTime() + (data.cooldown_days || 14) * 24 * 60 * 60 * 1000);

  const created: KeywordItem[] = newItems.map((item, idx) => ({
    ...item,
    id: `kw_${now.getTime()}_${idx}`,
    used_at: now.toISOString(),
    expires_at: expires.toISOString(),
  }));

  data.history.unshift(...created);
  saveKeywordsHistory(data);
  return created;
}
```

- [ ] **Step 3: Test loading and saving keyword history**

Run: `npx tsx -e "import { loadKeywordsHistory } from './lib/shorts-keywords'; console.log(loadKeywordsHistory());"`
Expected: `{ cooldown_days: 14, history: [] }`

- [ ] **Step 4: Commit**

```bash
git add data/shorts-keywords-history.json lib/shorts-keywords.ts
git commit -m "feat(shorts): add keyword history tracker and service"
```

---

### Task 2: Implement Gemini AI Integration & CLI Command

**Files:**
- Create: `scripts/generate-shorts-keywords.ts`
- Modify: `package.json:scripts`

**Interfaces:**
- Consumes: `loadKeywordsHistory()`, `getActiveKeywords()`, `addKeywordsToHistory()` from `lib/shorts-keywords.ts`

- [ ] **Step 1: Write `scripts/generate-shorts-keywords.ts`**

```typescript
import { GoogleGenAI } from '@google/genai';
import { getActiveKeywords, addKeywordsToHistory, KeywordItem } from '../lib/shorts-keywords';

const SUB_NICHES = [
  'Mass Food Production',
  'Industrial Manufacturing',
  'Master Crafting & Rare Processing',
  'Woodworking & Resin Crafting',
];

export async function generateKeywordsWithAI(): Promise<Omit<KeywordItem, 'id' | 'used_at' | 'expires_at'>[]> {
  const activeKeywords = getActiveKeywords(14);
  const blacklist = activeKeywords.map((k) => k.keyword);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not found in env, using fallback curated terms.');
    return SUB_NICHES.map((subNiche) => {
      const kw = `Automated ${subNiche.toLowerCase()} process US`;
      return {
        keyword: kw,
        sub_niche: subNiche,
        youtube_search_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(kw)}`,
        target_market: 'US',
      };
    });
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
You are a YouTube Shorts Sourcing Strategist for US audiences.
Generate 4 search keywords for longform footage sourcing, exactly 1 keyword for each sub-niche:
1. Mass Food Production
2. Industrial Manufacturing
3. Master Crafting & Rare Processing
4. Woodworking & Resin Crafting

Rules:
- Keywords must be in English targeting US viral YouTube videos.
- DO NOT use these active blacklisted keywords used within the last 14 days:
${JSON.stringify(blacklist, null, 2)}

Return ONLY valid JSON array with 4 objects:
[
  { "sub_niche": "Mass Food Production", "keyword": "..." },
  { "sub_niche": "Industrial Manufacturing", "keyword": "..." },
  { "sub_niche": "Master Crafting & Rare Processing", "keyword": "..." },
  { "sub_niche": "Woodworking & Resin Crafting", "keyword": "..." }
]
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  const text = response.text || '[]';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse JSON response from Gemini AI');
  }

  const items = JSON.parse(jsonMatch[0]);
  return items.map((item: { sub_niche: string; keyword: string }) => ({
    keyword: item.keyword,
    sub_niche: item.sub_niche,
    youtube_search_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(item.keyword)}`,
    target_market: 'US',
  }));
}

async function main() {
  console.log('🚀 Generating 4 Daily Shorts Keywords for US Market...');
  const newKeywords = await generateKeywordsWithAI();
  const saved = addKeywordsToHistory(newKeywords);

  console.log('\n✅ 4 Daily Keywords Generated & Saved to Cooldown Tracker:\n');
  saved.forEach((item, index) => {
    console.log(`[${index + 1}] ${item.sub_niche}`);
    console.log(`    Keyword: "${item.keyword}"`);
    console.log(`    Search: ${item.youtube_search_url}\n`);
  });
}

if (require.main === module) {
  main().catch(console.error);
}
```

- [ ] **Step 2: Add npm script to `package.json`**

Add `"keywords:shorts": "tsx scripts/generate-shorts-keywords.ts"` to `package.json`.

- [ ] **Step 3: Run script to verify CLI generation**

Run: `npm run keywords:shorts`
Expected: Output 4 keywords categorized into 4 sub-niches with YouTube URLs and saved into `data/shorts-keywords-history.json`.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-shorts-keywords.ts package.json
git commit -m "feat(shorts): add CLI command for AI keyword generator"
```

---

### Task 3: Upgrade Dashboard UI (`ShortsSourceStep.tsx`)

**Files:**
- Modify: `dashboard/src/components/shorts/ShortsSourceStep.tsx`

- [ ] **Step 1: Update `ShortsSourceStep.tsx` with AI Keyword Generator & Cooldown UI**

Replace `ShortsSourceStep.tsx` content with full interactive component:
- Header control panel with badges (`US Market 🇺🇸`, `14-Day Cooldown 🛡️`, `4 Shorts/Day 📊`).
- "Generate 4 Daily Keywords (Gemini AI)" trigger button.
- 4 Sub-Niche Cards Grid with YouTube Search buttons (`window.open`).
- Active Cooldown History table showing active locked keywords and days left.
- Video Link Import input & preview.

- [ ] **Step 2: Verify UI in Vite dev server**

Check running dev server or verify component renders without errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/shorts/ShortsSourceStep.tsx
git commit -m "feat(dashboard): integrate AI Shorts keyword generator and cooldown hub in Step 1"
```
