# Alur Film Script Narration Enhancer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "✨ Enhance Narasi" button in Flow 2 (Alurfilm Script Generator) that uses 9router and `ag/gemini-3-flash-agent` to optimize recap scripts for natural AI TTS voiceovers without changing story content.

**Architecture:** A prompt file `enhance-voiceover-prompt.md` defines the 10 TTS optimization rules. An IPC handler `alurfilm:enhance-script` calls `aiClient.chatCompletion` with `ag/gemini-3-flash-agent`, updates `naskah_voiceover.script_text` and `word_count`, saves the analysis JSON file, and updates the React state in `AlurfilmAnalyzeStep.tsx`.

**Tech Stack:** React, TypeScript, Electron IPC, 9router API / OpenAI-compatible AI client.

## Global Constraints

- Model: `ag/gemini-3-flash-agent` via 9router API.
- Output: Improved raw narration text without explanations or markdown bullet commentary.
- Preservation: Do not alter story, chronology, facts, names, or dialogue meaning.

---

### Task 1: Create Voice-over Enhancement Prompt File

**Files:**
- Create: `dashboard/prompts/longform/enhance-voiceover-prompt.md`

**Interfaces:**
- Consumes: User prompt 10 rules.
- Produces: System prompt markdown file for `loadPrompt('longform/enhance-voiceover-prompt.md')`.

- [ ] **Step 1: Create prompt file with system instructions and rules**

Write the prompt template to `dashboard/prompts/longform/enhance-voiceover-prompt.md`:

```markdown
Kamu adalah editor alur film profesional yang ahli dalam optimasi naskah voice-over AI (seperti Gemini TTS).

TUGAS UTAMA:
Optimalkan naskah narasi alur film di bawah ini agar terdengar alami, mengalir deras, dan berirama seperti pencerita YouTube profesional saat dibacakan oleh AI TTS.

ATURAN STRICT (JANGAN DILANGGAR):
1. DILARANG MENGUBAH: jalan cerita, kronologi adegan, fakta, nama tokoh/lokasi, atau makna dialog.
2. GABUNGKAN KALIMAT: Sentensial terputus yang tergolong dalam satu tindakan/kejadian yang sama wajib digabungkan. (Contoh: "Peter membuka pintu. Ia melihat mayat. Ia berteriak." -> "Peter membuka pintu dan seketika melihat sesosok mayat hingga membuatnya langsung berteriak.")
3. VARIASI PANJANG KALIMAT: Campurkan kalimat pendek (8-12 kata untuk efek dramatis), sedang (15-30 kata rata-rata), dan panjang (30-40 kata untuk aksi beruntun).
4. TANPA OVERUSE TITIK: Gunakan kata hubung alami seperti: dan, hingga, sementara, lalu, namun, meski begitu, bahkan, sehingga, karena, setelah itu, di saat yang sama.
5. IRAMA KOMA: Gunakan tanda koma untuk jeda bernapas alami.
6. PARAGRAF RELEVAN: Buat paragraf baru HANYA jika terjadi perpindahan adegan, lokasi, atau pergeseran emosi besar.
7. RITME SINEMATIK: Aksi berjalan cepat, emosi/ketegangan sedikit melambat.
8. GAYA PENCERITA YOUTUBE: Terdengar seperti bercerita secara langsung dan seru.
9. DILARANG GUNAKAN BULLET POINTS / DAFTAR: Wajib berupa teks narasi utuh.
10. OUTPUT HANYA TEKS NARASI HASIL OPTIMASI: Dilarang menyertakan penjelasan, pengantar, kesimpulan, atau komentar apa pun.
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/prompts/longform/enhance-voiceover-prompt.md
git commit -m "feat(alurfilm): add voiceover enhancement prompt template"
```

---

### Task 2: Implement Electron IPC Backend Handler for Enhancing Script

**Files:**
- Modify: `dashboard/electron/ipc/alurfilmHandlers.cjs`
- Modify: `dashboard/electron/preload.cjs`
- Modify: `dashboard/src/electron-api.ts`

**Interfaces:**
- Consumes: `contentId: string`, `partNum: number`
- Produces: `enhanceAlurfilmScript(contentId, partNum)` returning updated `AlurfilmAnalysisResult`

- [ ] **Step 1: Add `alurfilm:enhance-script` handler in `alurfilmHandlers.cjs`**

In `dashboard/electron/ipc/alurfilmHandlers.cjs`, register `alurfilm:enhance-script`:

```javascript
ipcMain.handle('alurfilm:enhance-script', async (_event, { contentId, partNum }) => {
  if (!contentId || !partNum) throw new Error('contentId and partNum are required');

  const filePath = path.join(p.ALURFILM_DIR, contentId, `analysis_part_${partNum}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File analysis Part #${partNum} tidak ditemukan.`);
  }

  const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const currentScript = fileData?.naskah_voiceover?.script_text;
  if (!currentScript || !currentScript.trim()) {
    throw new Error(`Naskah Part #${partNum} kosong atau belum diimport.`);
  }

  let systemPrompt = '';
  if (typeof loadPrompt === 'function') {
    systemPrompt = loadPrompt('longform/enhance-voiceover-prompt.md');
  }

  const enhancedTextRaw = await aiClient.chatCompletion({
    prompt: currentScript,
    systemPrompt: systemPrompt || undefined,
    model: 'ag/gemini-3-flash-agent',
    temperature: 0.5,
  });

  const cleanEnhancedText = enhancedTextRaw.trim();
  const wordCount = cleanEnhancedText.split(/\s+/).filter(Boolean).length;

  fileData.naskah_voiceover = fileData.naskah_voiceover || {};
  fileData.naskah_voiceover.script_text = cleanEnhancedText;
  fileData.naskah_voiceover.word_count = wordCount;
  fileData.updatedAt = new Date().toISOString();

  fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf8');

  return {
    part: partNum,
    filePath,
    data: fileData,
  };
});
```

- [ ] **Step 2: Expose IPC method in `preload.cjs`**

In `dashboard/electron/preload.cjs`, add `enhanceAlurfilmScript`:

```javascript
enhanceAlurfilmScript: (contentId, partNum) => ipcRenderer.invoke('alurfilm:enhance-script', { contentId, partNum }),
```

- [ ] **Step 3: Update `ElectronAPI` interface in `electron-api.ts`**

In `dashboard/src/electron-api.ts`, add to `ElectronAPI` type definition:

```typescript
enhanceAlurfilmScript?: (contentId: string, partNum: number) => Promise<AlurfilmAnalysisResult>;
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/electron/ipc/alurfilmHandlers.cjs dashboard/electron/preload.cjs dashboard/src/electron-api.ts
git commit -m "feat(alurfilm): add alurfilm:enhance-script IPC handler and preload bridge"
```

---

### Task 3: Integrate "✨ Enhance Narasi" Button into `AlurfilmAnalyzeStep.tsx`

**Files:**
- Modify: `dashboard/src/components/longform/AlurfilmAnalyzeStep.tsx`

**Interfaces:**
- Consumes: `window.electronAPI.enhanceAlurfilmScript`
- Produces: UI state updates for enhanced script text & word count.

- [ ] **Step 1: Add state and enhance button handler in `AlurfilmAnalyzeStep.tsx`**

Add `isEnhancing` state:

```typescript
const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
```

Add `handleEnhanceScript` method:

```typescript
const handleEnhanceScript = async () => {
  if (!contentId || !activePart || !currentAnalysis?.naskah_voiceover?.script_text) return;

  setIsEnhancing(true);
  setError(null);
  try {
    if (api.enhanceAlurfilmScript) {
      const res = await api.enhanceAlurfilmScript(contentId, activePart);
      setAnalyses((prev) => ({ ...prev, [activePart]: res }));
      showToast(`✨ Narasi Part #${activePart} berhasil di-enhance untuk AI Voice-Over (${res.data?.naskah_voiceover?.word_count} Kata)!`);
    }
  } catch (err: any) {
    setError(`Failed to enhance script: ${err.message}`);
  } finally {
    setIsEnhancing(false);
  }
};
```

- [ ] **Step 2: Add "✨ Enhance Narasi" button in Script tab header**

In `AlurfilmAnalyzeStep.tsx`, inside the **Script tab** header action row (near line 360 where the **📋 Copy** button is):

```tsx
<div className="flex items-center gap-2">
  <button
    onClick={handleEnhanceScript}
    disabled={isEnhancing || !currentAnalysis?.naskah_voiceover?.script_text}
    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-md ${
      isEnhancing
        ? 'bg-purple-800 text-purple-200 cursor-not-allowed animate-pulse'
        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/20'
    }`}
  >
    <span>{isEnhancing ? '⌛' : '✨'}</span>
    {isEnhancing ? 'Enhancing Narasi (ag/gemini)...' : 'Enhance Narasi'}
  </button>

  <button
    onClick={() => {
      const text = currentAnalysis.naskah_voiceover?.script_text || '';
      if (api.copyToClipboard) {
        api.copyToClipboard(text);
        showToast(`📋 Copied Naskah Part #${activePart}!`);
      }
    }}
    className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-medium transition-all flex items-center gap-1 shrink-0"
  >
    📋 Copy
  </button>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/longform/AlurfilmAnalyzeStep.tsx
git commit -m "feat(alurfilm): integrate Enhance Narasi button in AlurfilmAnalyzeStep UI"
```

---

### Task 4: Verification and Smoke Testing

**Files:**
- Read/Verify: UI and API behavior.

- [ ] **Step 1: Verify build and TypeScript compilation**

Run: `npm run build -w dashboard` (or check dev server error log).

- [ ] **Step 2: Verify feature workflow**

1. Launch app with dev server running.
2. Select Flow 2 (Alur Film).
3. Import script JSON for Part 1.
4. Click **✨ Enhance Narasi**.
5. Observe loading indicator, response completion, toast notification, and updated script text.
