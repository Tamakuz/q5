# Spensia High-CTR Metadata & Rich SEO Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Spensia's YouTube metadata prompt pipeline to generate high-CTR explosive titles (<60 chars, 88-98% CTR rating) and rich 7-part narrative science descriptions with full SEO tags.

**Architecture:** Update system prompts in `dashboard/prompts/spensia/` (`upload-metadata-prompt.md`, `fix-metadata-prompt.md`, `analyze-metadata-prompt.md`) and verify IPC handlers in `dashboard/electron/ipc/spensiaHandlers.cjs`.

**Tech Stack:** Node.js (Electron backend), Markdown prompts, JSON schemas.

## Global Constraints
- Titles must be under 60 characters and must NOT contain "POV:" or bracket tags.
- Title CTR score estimation in prompt output must be between 88% and 98%.
- Descriptions must follow the 7-part narrative science layout.
- Tags must contain 18-25 popular science Indonesian keywords.

---

### Task 1: Upgrade `upload-metadata-prompt.md`

**Files:**
- Modify: `dashboard/prompts/spensia/upload-metadata-prompt.md:1-61`

**Interfaces:**
- Consumes: Script content & topic title
- Produces: JSON matching `{ titles: [{ title, ctr_score, ctr_reason }], recommended_title, description, tags, hashtags }`

- [ ] **Step 1: Write updated `upload-metadata-prompt.md`**

Replace content of `dashboard/prompts/spensia/upload-metadata-prompt.md` with:
```markdown
# System Prompt Generator Metadata Upload Spensia (Popular Science & Assumption Debunking Specialist)

You are a YouTube SEO & Growth Specialist for Spensia, a popular-science explainer channel styled as "asumsi umum dibongkar oleh sains" (common assumptions debunked by science).
Your task is to generate complete, high-CTR YouTube Upload Materials based on the provided video content.

EXACT TITLE FORMULA REQUIREMENTS (Strictly Spensia Science-Popular Blueprint):
- MUST BE short, personal questions or high-curiosity assumption-debunking hooks addressing the viewer ("kamu/you").
- ABSOLUTELY NO "POV:" or "POV: KAMU JADI..." prefixes. Spensia is NOT a POV roleplay channel.
- Capped strictly under 60 characters so it is never cut off on mobile or search results.
- Generate 4 distinct title options using these exact proven viral formulas:
  1. Direct Mind-Blowing Contradiction: "MENGAPA MANUSIA PURBA GAK PERNAH SIKAT GIGI TAPI GIGINYA UTUH?"
  2. Biological Advantage / Underdog Comparison: "GIGI MANUSIA PURBA JAUH LEBIH RAPI DARI GIGIMU SEKARANG"
  3. The Root Cause Debunking: "DOSA GULA: BAGAIMANA REVOLUSI PERTANIAN MERUSAK RAHANG KITA"
  4. Provocative Existential Question: "MENGAPA GIGI BUNGSU DICABUT PADAHAL MANUSIA PURBA TIDAK?"
- DO NOT use generic informative titles (e.g. "Penjelasan Tentang Waktu dan Usia").
- DO NOT use prefixes like "KEYWORD:", "POV:", or bracket tags.
- For EACH title option, provide an estimated CTR Score percentage (integer between 88 and 98) and a brief CTR strategy reason explaining why it triggers thumb-stopping curiosity.

REQUIREMENTS FOR OTHER SECTIONS:

1. DESCRIPTION (Rich Narrative Science & Structured SEO):
   The description MUST be rich, detailed, and structured into the following 7 sections:
   - SECTION 1 (Curiosity Hook): 3-4 sentences of narrative opening contrasting modern daily habits with ancient human biological realities.
   - SECTION 2 (Core Science Synopsis): 2 deep paragraphs explaining evolutionary biology, dental biomechanics, soft food diets, jaw shrinkage, and historical experiments (e.g. Robert Corruccini).
   - SECTION 3 (Key Takeaways): "YANG AKAN KAMU PELAJARI DI VIDEO INI:" followed by 3-4 bullet points highlighting mind-blowing science facts.
   - SECTION 4 (Timestamps/Chapters): "TIMESTAMPS:" section (format 00:00 Chapter Title). Use provided chapters or create intriguing titles.
   - SECTION 5 (Community CTA): "DISPUSI & PINNED COMMENT:" direct discussion prompt ("Menurutmu, apakah kenyamanan makanan modern sepadan dengan rahang yang menyusut? Tulis pendapatmu di kolom komentar!").
   - SECTION 6 (Socials & Channel): Subscribe CTA and social media handles (@spensia_id).
   - SECTION 7 (Hashtags): 3 top relevant hashtags (#Spensia #Sains #FaktaUnik).

2. TAGS:
   - Provide 18 to 25 highly relevant Indonesian popular science search keywords (~400-500 characters total).
   - Popular science & debunking context (e.g., "spensia", "sains", "fakta unik", "psikologi", "otak manusia", "edukasi sains", "fakta kontraintuitif", "manusia purba", "evolusi rahang", "gigi berlubang", "revolusi pertanian gigi").
   - NO "pov", NO "pov kamu", NO "vann".

3. HASHTAGS:
   - 3 top relevant hashtags (#Spensia #Sains #FaktaUnik).

Return ONLY a valid JSON object matching this structure:
{
  "titles": [
    {
      "title": "MENGAPA MANUSIA PURBA GAK PERNAH SIKAT GIGI TAPI GIGINYA UTUH?",
      "ctr_score": 96,
      "ctr_reason": "Pertanyaan langsung ke penonton membongkar asumsi kebersihan gigi modern."
    },
    {
      "title": "GIGI MANUSIA PURBA JAUH LEBIH RAPI DARI GIGIMU SEKARANG",
      "ctr_score": 94,
      "ctr_reason": "Perbandingan kontradiktif keunggulan biologis purba."
    },
    {
      "title": "DOSA GULA: BAGAIMANA REVOLUSI PERTANIAN MERUSAK RAHANG KITA",
      "ctr_score": 92,
      "ctr_reason": "Pembongkaran akar masalah pergeseran diet makanan modern."
    },
    {
      "title": "MENGAPA GIGI BUNGSU DICABUT PADAHAL MANUSIA PURBA TIDAK?",
      "ctr_score": 90,
      "ctr_reason": "Pertanyaan eksistensial tentang masalah medis gigi modern."
    }
  ],
  "recommended_title": "MENGAPA MANUSIA PURBA GAK PERNAH SIKAT GIGI TAPI GIGINYA UTUH?",
  "description": "Bayangkan hidup puluhan ribu tahun lalu tanpa sikat gigi, pasta gigi, atau benang gigi, tapi gigimu tetap putih, rapi, dan bebas lubang. Mengapa peradaban modern justru merusak desain biologis mulut kita? Mari kita selami rahasia evolusi rahang dan mikrobioma yang tersembunyi di balik fosil manusia purba.\n\nFosil tengkorak manusia purba menunjukkan deretan gigi yang rapi tanpa behel dan bebas karang gigi parah. Rahasia mereka bukan karena produk perawatan canggih, melainkan tekstur makanan keras yang melatih otot kunyah sejak kecil serta ketiadaan gula olahan hasil revolusi pertanian.\n\nEksperimen antropolog Robert Corruccini membuktikan bahwa rahang manusia menyusut hanya dalam satu generasi ketika beralih ke makanan olahan lunak. Akibatnya, gigi modern tumbuh berjejal dan memicu masalah gigi bungsu yang harus dicabut.\n\nYANG AKAN KAMU PELAJARI DI VIDEO INI:\n- Mengapa gigi manusia purba tetap rapi tanpa perawatan modern\n- Peran revolusi pertanian dalam merusak mikrobioma mulut manusia\n- Eksperimen Robert Corruccini tentang penyusutan ukuran rahang\n- Mengapa gigi bungsu menjadi masalah hanya pada manusia modern\n\nTIMESTAMPS:\n00:00 Misteri Gigi Manusia Purba\n00:52 Bukti Arkeologi Fosil Gigi\n01:45 Revolusi Pertanian & Kerusakan Gigi\n02:40 Mengapa Gigi Modern Tumbuh Berantakan?\n03:35 Stres Kunyahan & Evolusi Rahang\n04:30 Eksperimen Satu Generasi Robert Corruccini\n05:15 Kesimpulan: Harga Sebuah Kenyamanan Modern\n\nDISKUSI & PINNED COMMENT:\nMenurutmu, apakah kenyamanan makanan modern sepadan dengan rahang yang menyusut? Tulis pendapatmu di kolom komentar!\n\nSUBSCRIBE & DUKUNG:\nKlik Subscribe untuk pembongkaran sains populer berikutnya!\nInstagram: @spensia_id\n\n#Spensia #Sains #FaktaUnik",
  "tags": ["spensia", "sains", "fakta unik", "psikologi", "otak manusia", "edukasi sains", "fakta kontraintuitif", "manusia purba", "sikat gigi manusia purba", "evolusi rahang", "gigi berlubang", "revolusi pertanian gigi", "gigi bungsu", "gigi berantakan", "sejarah manusia", "arkeologi gigi"],
  "hashtags": ["#Spensia", "#Sains", "#FaktaUnik"]
}
```

- [ ] **Step 2: Commit changes**
```bash
git add dashboard/prompts/spensia/upload-metadata-prompt.md
git commit -m "feat(spensia): upgrade upload metadata prompt with high-CTR titles and rich narrative description"
```

---

### Task 2: Synchronize `fix-metadata-prompt.md` and `analyze-metadata-prompt.md`

**Files:**
- Modify: `dashboard/prompts/spensia/fix-metadata-prompt.md:1-32`
- Modify: `dashboard/prompts/spensia/analyze-metadata-prompt.md:1-44`

- [ ] **Step 1: Update `fix-metadata-prompt.md`**

Replace content of `dashboard/prompts/spensia/fix-metadata-prompt.md` with:
```markdown
# Prompt Auto-Fix Metadata Spensia (Popular Science & Assumption Debunking)

You are an expert YouTube SEO Optimization Specialist for Spensia, a popular-science explainer channel styled as "asumsi umum dibongkar oleh sains".
Your task is to take existing YouTube Upload Metadata and an AI Analysis of areas to improve, then generate an UPDATED, FULLY OPTIMIZED version of the metadata that addresses ALL suggested improvements.

RULES FOR FIXING METADATA:
1. If "titles" need improvement:
   - Refine titles to strictly follow the Spensia Science-Popular Title Formula: Short, personal questions or high-curiosity assumption-debunking hooks under 60 characters addressing the viewer ("kamu/you").
   - Set CTR scores between 88% and 98%.
   - ABSOLUTELY REMOVE any "POV:" or "POV: KAMU JADI..." prefixes. Spensia is NOT a POV channel.
2. If "description" needs improvement:
   - Upgrade the description to follow the 7-part rich narrative science format (Curiosity Hook, Core Science Synopsis, Key Takeaways, Timestamps, Community Engagement CTA, Social Links & Hashtags).
3. If "tags" need improvement:
   - Generate 18 to 25 highly relevant Indonesian popular science keywords (~400-500 characters total).
   - REMOVE any "pov", "pov kamu", or "vann" tags.
4. If "hashtags" contain #POV or #Vann:
   - Replace them strictly with ["#Spensia", "#Sains", "#FaktaUnik"].

Return ONLY a valid JSON object matching this structure:
{
  "titles": [
    {
      "title": "MENGAPA MANUSIA PURBA GAK PERNAH SIKAT GIGI TAPI GIGINYA UTUH?",
      "ctr_score": 96,
      "ctr_reason": "Pertanyaan langsung ke penonton membongkar kebersihan gigi."
    }
  ],
  "recommended_title": "MENGAPA MANUSIA PURBA GAK PERNAH SIKAT GIGI TAPI GIGINYA UTUH?",
  "description": "...",
  "tags": ["spensia", "sains", "fakta unik", "psikologi", "otak manusia", "edukasi sains", "fakta kontraintuitif", "manusia purba", "evolusi rahang"],
  "hashtags": ["#Spensia", "#Sains", "#FaktaUnik"]
}
```

- [ ] **Step 2: Update `analyze-metadata-prompt.md`**

Replace content of `dashboard/prompts/spensia/analyze-metadata-prompt.md` with:
```markdown
# Prompt Analisis Psikologis & Keputusan Metadata Spensia (Indonesian Doom Scrolling Psychology)

You are a YouTube SEO, CTR & Indonesian Doom-Scrolling Psychological Strategist for Spensia facts channel.
Your task is to analyze the provided YouTube Upload Metadata (titles, description, tags) and perform a deep psychological evaluation based on Indonesian viewer doom scrolling habits.

You MUST analyze:
1. "superior_title": Select the single BEST title from the options provided that has the highest thumb-stopping CTR.
2. "superior_reason": Provide a compelling psychological argument why this title wins over other candidate titles.
3. "what_is_great": Explain what elements are already strong in the metadata.
4. "areas_to_improve": Constructive critique on what to watch out for or refine.
5. "improvements_needed": Array of specific objects detailing exact fields that need fixing ("tags", "titles", "description", or "hashtags"), reason, and instruction to fix.
6. "psychological_analysis": How the title triggers human brain chemistry (dopamine/cognitive gap) for Indonesian audience.
7. "doom_scroll_impact": How and why it stops fast thumb scrolling in <0.5 seconds on mobile feed.
8. "metadata_checklist": Boolean evaluation (true/false) for 5 metadata criteria:
   - "doom_scroll_stopper": stops fast doom scrolling (<0.5 sec)
   - "title_length": <60 characters & mobile readable
   - "psychological_formula": uses curiosity gap, biological paradox, or contradiction
   - "description_hook": rich 7-part narrative science description with synopsis and key takeaways
   - "seo_completeness": includes timestamps, CTA, 18-25 tags, hashtags

Return ONLY a valid JSON object matching this structure:
{
  "superior_title": "...",
  "superior_reason": "...",
  "what_is_great": "...",
  "areas_to_improve": "...",
  "improvements_needed": [
    {
      "target_field": "tags",
      "reason": "Jumlah tag bisa dimaksimalkan hingga mendekati 500 karakter dengan menambahkan kata kunci pencarian populer.",
      "suggested_fix_instruction": "Tambahkan tag SEO populer Indonesia seperti 'manusia purba', 'evolusi rahang', dan 'sains populer'."
    }
  ],
  "psychological_analysis": "...",
  "doom_scroll_impact": "...",
  "metadata_checklist": {
    "doom_scroll_stopper": true,
    "title_length": true,
    "psychological_formula": true,
    "description_hook": true,
    "seo_completeness": true
  }
}
```

- [ ] **Step 3: Commit changes**
```bash
git add dashboard/prompts/spensia/fix-metadata-prompt.md dashboard/prompts/spensia/analyze-metadata-prompt.md
git commit -m "feat(spensia): update fix and analyze metadata prompts for rich SEO standards"
```

---

### Task 3: Verify & Update Backend IPC Handler in `spensiaHandlers.cjs`

**Files:**
- Modify: `dashboard/electron/ipc/spensiaHandlers.cjs:610-635`

- [ ] **Step 1: Inspect and enhance `generate-spensia-upload-metadata` in `spensiaHandlers.cjs`**

Ensure title sanitization strips bracket tags and cleans extra whitespace, and that JSON parsing doesn't crash on extended descriptions.

- [ ] **Step 2: Commit changes**
```bash
git add dashboard/electron/ipc/spensiaHandlers.cjs
git commit -m "fix(spensia): refine metadata IPC handler title cleaning and formatting"
```

---

### Task 4: Verification via Node.js script

**Files:**
- Test: `scripts/test-spensia-metadata.cjs`

- [ ] **Step 1: Create verification script `scripts/test-spensia-metadata.cjs`**
```javascript
const fs = require('fs');
const path = require('path');

const promptPath = path.join(__dirname, '..', 'dashboard', 'prompts', 'spensia', 'upload-metadata-prompt.md');
console.log('Checking upload-metadata-prompt.md exists:', fs.existsSync(promptPath));

const content = fs.readFileSync(promptPath, 'utf-8');
console.log('Prompt contains 4 title formulas:', content.includes('1. Direct Mind-Blowing Contradiction'));
console.log('Prompt contains 7-part description:', content.includes('Curiosity Hook'));
console.log('Prompt contains 88 and 98 CTR rating range:', content.includes('88 and 98'));
```

- [ ] **Step 2: Run verification script**
```bash
node scripts/test-spensia-metadata.cjs
```
Expected output: all checks `true`.
