# Design Specification: Shorts Daily AI Keyword Generator & 14-Day Cooldown Hub

**Date:** 2026-08-13  
**Target Audience:** United States (US Market / English Sourcing Keywords)  
**Target Volume:** 4 Shorts / Day (1 per Sub-Niche)  
**Rule:** 14-Day Anti-Duplicate Keyword Cooldown  

---

## 1. Overview & Objective

Sistem **Step 1 Shorts Keyword Generator** dirancang untuk memfasilitasi pembuatan 4 video Shorts harian berniche **Pabrik, Industri & Crafting Process** yang bersumber dari video *longform* YouTube. 

Sistem ini mengintegrasikan **Gemini AI** untuk memproduksi keyword pencarian *high-CTR* berbasis audiens US, serta mengelola riwayat pencarian dalam file `data/shorts-keywords-history.json` untuk memastikan **0 duplikasi keyword dalam tenggat 14 hari**.

---

## 2. Architecture & Sub-Niches

 set harian mencakup 4 sub-niche utama:
1. **Mass Food Production** (misal: pabrik es krim, permen, roti massal)
2. **Industrial Manufacturing** (misal: penempaan velg, kelereng, pensil warna, mesin presisi)
3. **Master Crafting & Rare Processing** (misal: potong tuna raksasa, katana, keju raksasa, kayu sawmill)
4. **Woodworking & Resin Crafting** (misal: meja epoxy resin, seni ukir kayu, wood turning)

```text
[User / Dashboard UI]
        │
        ▼
[Read History] ──► Read data/shorts-keywords-history.json (Filter < 14 Days)
        │
        ▼
[Gemini AI Prompt Engine] ──► Inject Active History Blacklist + Request 4 US Keywords
        │
        ▼
[Output 4 Keywords] ──► Render Grid Card + Direct YouTube Search Links
        │
        ▼
[Save State] ──► Save active keywords with 14-day expiration timestamp
```

---

## 3. Data Schema (`data/shorts-keywords-history.json`)

```json
{
  "cooldown_days": 14,
  "history": [
    {
      "id": "kw_1723580000000_1",
      "keyword": "Automated pencil manufacturing process",
      "sub_niche": "Industrial Manufacturing",
      "youtube_search_url": "https://www.youtube.com/results?search_query=Automated+pencil+manufacturing+process",
      "target_market": "US",
      "used_at": "2026-08-13T22:50:00.000Z",
      "expires_at": "2026-08-27T22:50:00.000Z"
    }
  ]
}
```

---

## 4. UI Design Component (`ShortsSourceStep.tsx`)

Layout UI terdiri dari 4 bagian utama:
1. **Control Header**:
   - Indicator Badges: `Target: US Market 🇺🇸`, `Cooldown: 14 Days 🛡️`, `Quota: 4 Shorts/Day 📊`.
   - Button: `[✨ Generate 4 Daily Keywords (Gemini AI)]`.
2. **Sub-Niche Cards Grid (4 Cards)**:
   - Menampilkan keyword Bahasa Inggris per sub-niche.
   - Action buttons: `[🔍 Open YouTube Search]` (buka tab YouTube baru) dan `[📌 Select / Use Keyword]`.
3. **History & Cooldown Panel**:
   - Menampilkan tabel/list keyword 14 hari terakhir dan sisa hari kadaluarsa.
4. **Source Video & Clip Import**:
   - Text input untuk menempelkan URL YouTube longform hasil penelusuran.

---

## 5. Gemini AI Prompt Specification

```text
You are an expert YouTube Shorts Production Strategist for Factory & Crafting Niche targeting US audiences.
Generate exactly 4 high-converting, viral YouTube longform search keywords in English (1 for each sub-niche).

Sub-niches:
1. Mass Food Production
2. Industrial Manufacturing
3. Master Crafting & Rare Processing
4. Woodworking & Resin Crafting

Exclusion Rules (STRICT DO NOT USE - Used within last 14 days):
{ACTIVE_BLACKLIST_KEYWORDS}

Format: Return valid JSON array with fields: sub_niche, keyword, target_market, rationale.
```

---

## 6. Implementation Steps

1. **Backend / API Service (`lib/shorts-keywords.ts`)**:
   - Fungsi pembaca dan pembuat file `data/shorts-keywords-history.json`.
   - Generator prompt & integrasi Gemini API.
2. **Frontend UI Integration (`ShortsSourceStep.tsx`)**:
   - Update komponen React dengan header control, 4 cards grid, tombol YouTube link, dan history drawer.
3. **Verification**:
   - Uji pembuatan keyword baru, pastikan terurut 4 sub-niche, dan terverifikasi masuk ke tracker cooldown 14 hari.
