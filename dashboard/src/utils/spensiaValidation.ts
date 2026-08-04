// dashboard/src/utils/spensiaValidation.ts

export interface SpensiaTopicItem {
  id: number;
  title: string;
  summary: string;
  angles?: string[];
  selected_angle_index?: number;
  viral_score?: number;
  viral_reason?: string;
  ruthless_critique?: string;
  search_keyphrases?: string[];
  outlier_search_guide?: string;
  outlier_evidence?: {
    channel_name?: string;
    video_title?: string;
    views_count?: string;
    notes?: string;
  };
  selected?: boolean;
}

export interface SpensiaTopicsData {
  theme?: string;
  topics: SpensiaTopicItem[];
}

export interface SpensiaScriptSection {
  section_number: number;
  section_title: string;
  transition_phrase?: string;
  content: string;
}

export interface SpensiaScriptData {
  video_title: string;
  target_duration: string;
  estimated_word_count?: number;
  actual_word_count?: number;
  hook?: {
    imaginative_scenario?: string;
    surprising_detail?: string;
    philosophical_closing?: string;
  };
  sections: SpensiaScriptSection[];
  closing_reflection?: string;
  full_script: string;
}

export interface SpensiaValidationIssue {
  id: string;
  severity: 'error' | 'warning';
  field: string;
  message: string;
}

export interface SpensiaTopicsValidationReport {
  isValid: boolean;
  issues: SpensiaValidationIssue[];
  errorCount: number;
  warningCount: number;
  normalizedData: SpensiaTopicsData | null;
  summaryText: string;
}

export interface SpensiaScriptValidationReport {
  isValid: boolean;
  issues: SpensiaValidationIssue[];
  errorCount: number;
  warningCount: number;
  normalizedData: SpensiaScriptData | null;
  summaryText: string;
}

/**
 * Clean and extract valid JSON substring from raw AI response text
 */
export function extractCleanJsonString(raw: string): string {
  let cleaned = raw.trim();

  // 1. Strip markdown code fences if present
  if (cleaned.includes('```')) {
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      cleaned = codeBlockMatch[1].trim();
    } else {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/g, '').trim();
    }
  }

  // 2. Extract strictly from first '{' or '[' to last '}' or ']'
  const firstBrace = cleaned.search(/[\{\[]/);
  if (firstBrace !== -1) {
    const lastBraceObj = cleaned.lastIndexOf('}');
    const lastBraceArr = cleaned.lastIndexOf(']');
    const lastBrace = Math.max(lastBraceObj, lastBraceArr);
    if (lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1).trim();
    }
  }

  return cleaned;
}

/**
 * Perform strict JSON validation and normalization for Spensia Topics output
 */
export function validateSpensiaTopics(rawInput: any): SpensiaTopicsValidationReport {
  const issues: SpensiaValidationIssue[] = [];
  let data: any = rawInput;

  // 1. Handle JSON syntax parsing if string
  if (typeof rawInput === 'string') {
    const cleaned = extractCleanJsonString(rawInput);
    try {
      data = JSON.parse(cleaned);
    } catch (err: any) {
      return {
        isValid: false,
        issues: [
          {
            id: 'INVALID_JSON_SYNTAX',
            severity: 'error',
            field: 'root',
            message: `JSON Syntax Error: ${err.message}`,
          },
        ],
        errorCount: 1,
        warningCount: 0,
        normalizedData: null,
        summaryText: `JSON Format Error: ${err.message}`,
      };
    }
  }

  // 2. Validate Root Structure
  if (!data) {
    return {
      isValid: false,
      issues: [
        {
          id: 'EMPTY_INPUT',
          severity: 'error',
          field: 'root',
          message: 'Input JSON is empty or null.',
        },
      ],
      errorCount: 1,
      warningCount: 0,
      normalizedData: null,
      summaryText: 'Input JSON is empty.',
    };
  }

  let topicsArray: any[] = [];
  let themeStr: string | undefined = undefined;

  if (Array.isArray(data)) {
    topicsArray = data;
    issues.push({
      id: 'ROOT_IS_ARRAY',
      severity: 'warning',
      field: 'root',
      message: 'JSON output is a direct array instead of an object with "topics" array.',
    });
  } else if (typeof data === 'object') {
    themeStr = typeof data.theme === 'string' ? data.theme : undefined;
    if (Array.isArray(data.topics)) {
      topicsArray = data.topics;
    } else {
      issues.push({
        id: 'MISSING_TOPICS_ARRAY',
        severity: 'error',
        field: 'topics',
        message: 'Missing "topics" array in JSON response.',
      });
    }
  } else {
    return {
      isValid: false,
      issues: [
        {
          id: 'INVALID_ROOT_TYPE',
          severity: 'error',
          field: 'root',
          message: 'JSON response must be an Object or Array.',
        },
      ],
      errorCount: 1,
      warningCount: 0,
      normalizedData: null,
      summaryText: 'Root JSON is not an object or array.',
    };
  }

  // 3. Strict Validation of Each Topic Item
  const normalizedTopics: SpensiaTopicItem[] = [];

  if (topicsArray.length === 0) {
    issues.push({
      id: 'EMPTY_TOPICS_LIST',
      severity: 'error',
      field: 'topics',
      message: '"topics" array is empty.',
    });
  }

  topicsArray.forEach((item, index) => {
    const itemPath = `topics[${index}]`;

    if (!item || typeof item !== 'object') {
      issues.push({
        id: 'INVALID_TOPIC_ITEM',
        severity: 'error',
        field: itemPath,
        message: `Topic item #${index + 1} is not a valid object.`,
      });
      return;
    }

    // Angles & Title validation / normalization
    let anglesVal: string[] = [];
    if (Array.isArray(item.angles) && item.angles.length > 0) {
      anglesVal = item.angles.map((a: any) => String(a).replace(/^["“']|["”']$/g, '').trim());
    }

    const titleVal = item.title || item.judul || (anglesVal.length > 0 ? anglesVal[0] : '');
    if (!anglesVal.length && titleVal) {
      anglesVal = [String(titleVal).replace(/^["“']|["”']$/g, '').trim()];
    }

    if (typeof titleVal !== 'string' || !titleVal.trim()) {
      issues.push({
        id: 'MISSING_TOPIC_TITLE',
        severity: 'error',
        field: `${itemPath}.title`,
        message: `Topic item #${index + 1} is missing a valid "title" string.`,
      });
    } else {
      const cleanTitle = String(titleVal).replace(/^["“']|["”']$/g, '').trim();
      if (!cleanTitle.includes('?')) {
        issues.push({
          id: 'TITLE_NOT_QUESTION',
          severity: 'warning',
          field: `${itemPath}.title`,
          message: `Topic #${index + 1} title ("${cleanTitle}") is not in question format ('?').`,
        });
      }
    }

    // Summary validation
    const summaryVal = item.summary || item.ringkasan;
    if (typeof summaryVal !== 'string' || !summaryVal.trim()) {
      issues.push({
        id: 'MISSING_TOPIC_SUMMARY',
        severity: 'error',
        field: `${itemPath}.summary`,
        message: `Topic item #${index + 1} is missing a valid "summary" string.`,
      });
    }

    // ID validation / normalization
    const itemId = Number(item.id) || index + 1;
    const viralScore = Number(item.viral_score || item.viral_rating || item.score) || 75;
    const viralReason = item.viral_reason || item.alasan_viral || undefined;

    const ruthlessCritique = item.ruthless_critique || item.critique || item.bedah_kritis || undefined;
    const searchKeyphrases = Array.isArray(item.search_keyphrases)
      ? item.search_keyphrases.map((k: any) => String(k).trim())
      : Array.isArray(item.keyphrases)
      ? item.keyphrases.map((k: any) => String(k).trim())
      : undefined;
    const outlierSearchGuide = item.outlier_search_guide || item.panduan_outlier || undefined;

    normalizedTopics.push({
      id: itemId,
      title: String(titleVal || `Topik #${index + 1}`).replace(/^["“']|["”']$/g, '').trim(),
      summary: String(summaryVal || 'Ringkasan tidak tersedia.').trim(),
      angles: anglesVal,
      selected_angle_index: 0,
      viral_score: Math.min(100, Math.max(30, viralScore)),
      viral_reason: typeof viralReason === 'string' ? viralReason.trim() : undefined,
      ruthless_critique: typeof ruthlessCritique === 'string' ? ruthlessCritique.trim() : undefined,
      search_keyphrases: searchKeyphrases,
      outlier_search_guide: typeof outlierSearchGuide === 'string' ? outlierSearchGuide.trim() : undefined,
      outlier_evidence: item.outlier_evidence || undefined,
    });
  });

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const isValid = errors.length === 0 && normalizedTopics.length > 0;

  return {
    isValid,
    issues,
    errorCount: errors.length,
    warningCount: warnings.length,
    normalizedData: isValid ? { theme: themeStr, topics: normalizedTopics } : null,
    summaryText: isValid
      ? `Valid Spensia Topics JSON (${normalizedTopics.length} Topik)`
      : `Strict Validation Failed: ${errors.map((e) => e.message).join('; ')}`,
  };
}

/**
 * Perform strict JSON validation and normalization for Spensia Script Generator output
 */
export function validateSpensiaScript(rawInput: any, targetWordCount?: number): SpensiaScriptValidationReport {
  const issues: SpensiaValidationIssue[] = [];
  let data: any = rawInput;

  if (typeof rawInput === 'string') {
    const cleaned = extractCleanJsonString(rawInput);
    try {
      data = JSON.parse(cleaned);
    } catch (err: any) {
      return {
        isValid: false,
        issues: [{ id: 'INVALID_JSON_SYNTAX', severity: 'error', field: 'root', message: `JSON Error: ${err.message}` }],
        errorCount: 1,
        warningCount: 0,
        normalizedData: null,
        summaryText: `JSON Error: ${err.message}`,
      };
    }
  }

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      issues: [{ id: 'INVALID_ROOT', severity: 'error', field: 'root', message: 'Script output must be a valid JSON Object.' }],
      errorCount: 1,
      warningCount: 0,
      normalizedData: null,
      summaryText: 'Root is not an object.',
    };
  }

  // Validate full_script or construct it from sections
  let fullScriptStr = typeof data.full_script === 'string' ? data.full_script.trim() : '';

  const sectionsList: SpensiaScriptSection[] = [];
  if (Array.isArray(data.sections)) {
    data.sections.forEach((sec: any, idx: number) => {
      if (sec && typeof sec === 'object') {
        const secContent = typeof sec.content === 'string' ? sec.content.trim() : '';
        sectionsList.push({
          section_number: Number(sec.section_number) || idx + 1,
          section_title: String(sec.section_title || `Segmen ${idx + 1}`).trim(),
          transition_phrase: typeof sec.transition_phrase === 'string' ? sec.transition_phrase.trim() : undefined,
          content: secContent,
        });
      }
    });
  }

  if (!fullScriptStr && sectionsList.length > 0) {
    fullScriptStr = sectionsList.map((s) => s.content).join('\n\n');
  }

  if (!fullScriptStr) {
    issues.push({
      id: 'MISSING_FULL_SCRIPT',
      severity: 'error',
      field: 'full_script',
      message: 'Missing or empty "full_script" in JSON output.',
    });
  }

  const words = fullScriptStr ? fullScriptStr.split(/\s+/).filter(Boolean).length : 0;
  if (words < 100) {
    issues.push({
      id: 'SHORT_SCRIPT_WARNING',
      severity: 'warning',
      field: 'full_script',
      message: `Naskah relatif pendek (${words} kata).`,
    });
  } else if (targetWordCount && targetWordCount > 0) {
    const maxAllowed = Math.round(targetWordCount * 1.15);
    const minAllowed = Math.round(targetWordCount * 0.85);
    if (words > maxAllowed) {
      issues.push({
        id: 'OVERLONG_SCRIPT_WARNING',
        severity: 'warning',
        field: 'full_script',
        message: `Naskah (${words} kata) melebihi target pilihan (${targetWordCount} kata). Batas maksimal ideal: ${maxAllowed} kata.`,
      });
    } else if (words < minAllowed) {
      issues.push({
        id: 'UNDERSIZED_SCRIPT_WARNING',
        severity: 'warning',
        field: 'full_script',
        message: `Naskah (${words} kata) kurang dari target pilihan (${targetWordCount} kata). Batas minimal ideal: ${minAllowed} kata.`,
      });
    }
  }

  const normalized: SpensiaScriptData = {
    video_title: String(data.video_title || 'Judul Video Spensia').trim(),
    target_duration: String(data.target_duration || '10 menit').trim(),
    estimated_word_count: Number(data.estimated_word_count) || 1500,
    actual_word_count: words,
    hook: data.hook && typeof data.hook === 'object' ? data.hook : undefined,
    sections: sectionsList,
    closing_reflection: typeof data.closing_reflection === 'string' ? data.closing_reflection.trim() : undefined,
    full_script: fullScriptStr,
  };

  const errors = issues.filter((i) => i.severity === 'error');
  const isValid = errors.length === 0 && fullScriptStr.length > 0;

  return {
    isValid,
    issues,
    errorCount: errors.length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    normalizedData: isValid ? normalized : null,
    summaryText: isValid
      ? `Valid Spensia Script (${words} Kata)`
      : `Script Validation Failed: ${errors.map((e) => e.message).join('; ')}`,
  };
}

export interface SpensiaSegmentItem {
  segment_id: number;
  text: string;
}

export interface SpensiaBreakdownData {
  total_segments: number;
  segments: SpensiaSegmentItem[];
}

export interface SpensiaBreakdownValidationReport {
  isValid: boolean;
  issues: SpensiaValidationIssue[];
  errorCount: number;
  warningCount: number;
  normalizedData: SpensiaBreakdownData | null;
  summaryText: string;
}

/**
 * Perform strict JSON / Text validation and normalization for Spensia Scene Splitter output
 */
export function validateSpensiaBreakdown(rawInput: any): SpensiaBreakdownValidationReport {
  const issues: SpensiaValidationIssue[] = [];
  const segmentsList: SpensiaSegmentItem[] = [];

  let textContent = typeof rawInput === 'string' ? rawInput.trim() : '';

  // 1. Try parsing JSON first
  if (typeof rawInput === 'object' && rawInput !== null) {
    const list = Array.isArray(rawInput) ? rawInput : Array.isArray(rawInput.segments) ? rawInput.segments : null;
    if (list) {
      list.forEach((item: any, idx: number) => {
        const segText = item.text || item.content || item.quote;
        if (typeof segText === 'string' && segText.trim()) {
          segmentsList.push({
            segment_id: Number(item.segment_id || item.id) || idx + 1,
            text: segText.replace(/^["“']|["”']$/g, '').trim(),
          });
        }
      });
    }
  } else if (textContent) {
    if (textContent.startsWith('```')) {
      textContent = textContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    }

    try {
      const parsed = JSON.parse(textContent);
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.segments) ? parsed.segments : null;
      if (list) {
        list.forEach((item: any, idx: number) => {
          const segText = item.text || item.content || item.quote;
          if (typeof segText === 'string' && segText.trim()) {
            segmentsList.push({
              segment_id: Number(item.segment_id || item.id) || idx + 1,
              text: segText.replace(/^["“']|["”']$/g, '').trim(),
            });
          }
        });
      }
    } catch {
      // Fallback: Parse Markdown line-by-line format "Segmen X: "..." or "1. "...""
      const lines = textContent.split('\n');
      let idCounter = 1;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const match = trimmed.match(/(?:Segmen\s*\d+:|\d+[\.\)]\s*)?\s*["“]?([^"\n\r”]+)["“]?/i);
        if (match && match[1]) {
          const clean = match[1].replace(/^Segmen\s*\d+:\s*/i, '').replace(/^["“']|["”']$/g, '').trim();
          if (clean.length > 3) {
            segmentsList.push({
              segment_id: idCounter++,
              text: clean,
            });
          }
        }
      }
    }
  }

  if (segmentsList.length === 0) {
    issues.push({
      id: 'EMPTY_SEGMENTS',
      severity: 'error',
      field: 'segments',
      message: 'Tidak ada segmen pemotongan adegan yang berhasil di-parse.',
    });
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const isValid = errors.length === 0 && segmentsList.length > 0;

  return {
    isValid,
    issues,
    errorCount: errors.length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    normalizedData: isValid ? { total_segments: segmentsList.length, segments: segmentsList } : null,
    summaryText: isValid
      ? `Valid Scene Breakdown (${segmentsList.length} Segmen Adegan)`
      : `Breakdown Validation Failed: ${errors.map((e) => e.message).join('; ')}`,
  };
}

export interface SpensiaImagePromptItem {
  segment_id: number;
  segment_quote: string;
  prompt: string;
}

export interface SpensiaImagePromptsData {
  total_prompts: number;
  image_prompts: SpensiaImagePromptItem[];
}

export interface SpensiaImagePromptsValidationReport {
  isValid: boolean;
  issues: SpensiaValidationIssue[];
  errorCount: number;
  warningCount: number;
  normalizedData: SpensiaImagePromptsData | null;
  summaryText: string;
}

/**
 * Perform strict JSON / Text validation and normalization for Spensia Image Prompt Generator output
 */
export function validateSpensiaImagePrompts(rawInput: any): SpensiaImagePromptsValidationReport {
  const issues: SpensiaValidationIssue[] = [];
  const promptsList: SpensiaImagePromptItem[] = [];

  let textContent = typeof rawInput === 'string' ? rawInput.trim() : '';

  // 1. Try parsing JSON
  if (typeof rawInput === 'object' && rawInput !== null) {
    const list = Array.isArray(rawInput) ? rawInput : Array.isArray(rawInput.image_prompts) ? rawInput.image_prompts : null;
    if (list) {
      list.forEach((item: any, idx: number) => {
        const pText = item.prompt || item.image_prompt || item.text;
        if (typeof pText === 'string' && pText.trim()) {
          promptsList.push({
            segment_id: Number(item.segment_id || item.id) || idx + 1,
            segment_quote: String(item.segment_quote || item.quote || `Segmen #${idx + 1}`).trim(),
            prompt: pText.trim(),
          });
        }
      });
    }
  } else if (textContent) {
    if (textContent.startsWith('```')) {
      textContent = textContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    }

    try {
      const parsed = JSON.parse(textContent);
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.image_prompts) ? parsed.image_prompts : null;
      if (list) {
        list.forEach((item: any, idx: number) => {
          const pText = item.prompt || item.image_prompt || item.text;
          if (typeof pText === 'string' && pText.trim()) {
            promptsList.push({
              segment_id: Number(item.segment_id || item.id) || idx + 1,
              segment_quote: String(item.segment_quote || item.quote || `Segmen #${idx + 1}`).trim(),
              prompt: pText.trim(),
            });
          }
        });
      }
    } catch {
      // Fallback text parser for Markdown "Segmen X: "..." \n Prompt: ..."
      const blocks = textContent.split(/(?=Segmen\s*\d+:)/gi);
      let idCounter = 1;
      for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;

        const quoteMatch = trimmed.match(/Segmen\s*(\d+):\s*["“]?([^"\n\r”]+)["“]?/i);
        const promptMatch = trimmed.match(/Prompt:\s*([\s\S]+)/i);

        if (promptMatch && promptMatch[1]) {
          const segId = quoteMatch ? Number(quoteMatch[1]) : idCounter++;
          const segQuote = quoteMatch && quoteMatch[2] ? quoteMatch[2].trim() : `Segmen #${segId}`;
          const promptContent = promptMatch[1].trim();

          promptsList.push({
            segment_id: segId,
            segment_quote: segQuote,
            prompt: promptContent,
          });
        }
      }
    }
  }

  if (promptsList.length === 0) {
    issues.push({
      id: 'EMPTY_IMAGE_PROMPTS',
      severity: 'error',
      field: 'image_prompts',
      message: 'Tidak ada image prompt yang berhasil di-parse.',
    });
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const isValid = errors.length === 0 && promptsList.length > 0;

  return {
    isValid,
    issues,
    errorCount: errors.length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    normalizedData: isValid ? { total_prompts: promptsList.length, image_prompts: promptsList } : null,
    summaryText: isValid
      ? `Valid Image Prompts (${promptsList.length} Prompt Gambar)`
      : `Image Prompt Validation Failed: ${errors.map((e) => e.message).join('; ')}`,
  };
}

export interface SpensiaWordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface SpensiaChunkTimestamp {
  chunk_id: number;
  text: string;
  start: number;
  end: number;
  words: SpensiaWordTimestamp[];
}

export interface SpensiaSegmentTimestamp {
  segment_id: number;
  quote: string;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
}

export interface SpensiaSentenceTimestamp {
  sentence_id: number;
  text: string;
  start: number;
  end: number;
  words: SpensiaWordTimestamp[];
}

export interface SpensiaTranscriptData {
  transcript_full: string;
  sentences?: SpensiaSentenceTimestamp[];
  segments?: SpensiaSegmentTimestamp[];
  chunks?: SpensiaChunkTimestamp[];
  words: SpensiaWordTimestamp[];
}

export interface SpensiaTranscriptValidationReport {
  isValid: boolean;
  issues: SpensiaValidationIssue[];
  errorCount: number;
  warningCount: number;
  normalizedData: SpensiaTranscriptData | null;
  summaryText: string;
}

/**
 * Validate and normalize Hierarchical Sentence-Level, Chunk-Level & Word-Level Audio Transcript output from AI/Faster-Whisper
 */
export function validateSpensiaWordTranscript(rawInput: any): SpensiaTranscriptValidationReport {
  const issues: SpensiaValidationIssue[] = [];
  const sentencesList: SpensiaSentenceTimestamp[] = [];
  const wordsList: SpensiaWordTimestamp[] = [];
  const chunksList: SpensiaChunkTimestamp[] = [];
  const segmentsList: SpensiaSegmentTimestamp[] = [];
  const fullTexts: string[] = [];

  const parseSec = (val: any, defaultVal: number = 0): number => {
    if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/[^0-9.]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? defaultVal : num;
    }
    return defaultVal;
  };

  // Helper to extract and parse all valid JSON objects/arrays from input (even if multiple blocks exist)
  const extractDataObjects = (input: any): any[] => {
    if (typeof input !== 'string') {
      return Array.isArray(input) ? input : [input];
    }

    const objects: any[] = [];
    let cleaned = input.trim();

    // Remove markdown code fences if present
    cleaned = cleaned.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();

    // 1. Try parsing whole string as single JSON
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
      return [parsed];
    } catch {}

    // 2. Fallback: Extract all JSON object blocks { ... } using regex / bracket matching
    const jsonMatches = cleaned.match(/\{[\s\S]*?\}(?=\s*\{|\s*$)/g) || [];
    for (const match of jsonMatches) {
      try {
        const obj = JSON.parse(match.trim());
        objects.push(obj);
      } catch {}
    }

    if (objects.length > 0) return objects;

    // 3. Fallback: Plain text fallback
    return [{ transcript_full: cleaned }];
  };

  const dataObjects = extractDataObjects(rawInput);

  dataObjects.forEach((dataObj) => {
    if (!dataObj || typeof dataObj !== 'object') return;

    if (dataObj.transcript_full) {
      fullTexts.push(String(dataObj.transcript_full).trim());
    }

    // 1. Process Sentences if present (top-level sentences array or transcript array)
    const rawSentences = Array.isArray(dataObj.sentences)
      ? dataObj.sentences
      : (Array.isArray(dataObj.transcript) ? dataObj.transcript : null);

    if (rawSentences && rawSentences.length > 0) {
      rawSentences.forEach((s: any, idx: number) => {
        if (!s || typeof s !== 'object') return;
        const sentId = Number(s.sentence_id || s.id) || idx + 1;
        const sentText = String(s.text || s.sentence || s.quote || '').trim();
        const sStart = parseSec(s.start !== undefined ? s.start : (s.start_seconds !== undefined ? s.start_seconds : s.start_sec), 0);
        const sEnd = parseSec(s.end !== undefined ? s.end : (s.end_seconds !== undefined ? s.end_seconds : s.end_sec), sStart + 2.0);

        const sentWords: SpensiaWordTimestamp[] = [];
        const rawWords = Array.isArray(s.words) ? s.words : [];

        rawWords.forEach((w: any) => {
          if (typeof w.word === 'string' && w.word.trim()) {
            const wStart = parseSec(w.start, sStart);
            const wEnd = parseSec(w.end, wStart + 0.3);
            const wordObj: SpensiaWordTimestamp = {
              word: w.word.trim(),
              start: wStart,
              end: wEnd > wStart ? wEnd : wStart + 0.3,
            };
            sentWords.push(wordObj);
            wordsList.push(wordObj);
          }
        });

        if (sentText) {
          sentencesList.push({
            sentence_id: sentId,
            text: sentText,
            start: sStart,
            end: sEnd > sStart ? sEnd : sStart + 1.0,
            words: sentWords,
          });
        }
      });
    }

    // 2. Process Chunks if present
    const cList = Array.isArray(dataObj.chunks)
      ? dataObj.chunks
      : Array.isArray(dataObj.phrases)
      ? dataObj.phrases
      : null;

    if (cList && cList.length > 0) {
      cList.forEach((c: any) => {
        if (!c || typeof c !== 'object') return;
        const chunkWords: SpensiaWordTimestamp[] = [];
        const rawChunkWords = Array.isArray(c.words) ? c.words : [];

        rawChunkWords.forEach((w: any) => {
          if (typeof w.word === 'string' && w.word.trim()) {
            const sSec = parseSec(w.start, 0);
            const eSec = parseSec(w.end, sSec + 0.3);
            const wordObj: SpensiaWordTimestamp = {
              word: w.word.trim(),
              start: sSec,
              end: eSec > sSec ? eSec : sSec + 0.3,
            };
            chunkWords.push(wordObj);
            if (!rawSentences) wordsList.push(wordObj);
          }
        });

        const chunkStart = parseSec(c.start, chunkWords.length > 0 ? chunkWords[0].start : 0);
        const chunkEnd = parseSec(
          c.end,
          chunkWords.length > 0 ? chunkWords[chunkWords.length - 1].end : chunkStart + 1.0
        );
        const chunkText = String(c.text || chunkWords.map((w) => w.word).join(' ')).trim();

        chunksList.push({
          chunk_id: chunksList.length + 1,
          text: chunkText,
          start: chunkStart,
          end: chunkEnd > chunkStart ? chunkEnd : chunkStart + 0.5,
          words: chunkWords,
        });
      });
    }

    // 3. Process standalone words if top-level "words" array exists
    const wList = Array.isArray(dataObj.words) ? dataObj.words : null;
    if (wList && !rawSentences && cList === null) {
      wList.forEach((w: any) => {
        if (typeof w.word === 'string' && w.word.trim()) {
          const sSec = parseSec(w.start, 0);
          const eSec = parseSec(w.end, sSec + 0.3);
          wordsList.push({
            word: w.word.trim(),
            start: sSec,
            end: eSec > sSec ? eSec : sSec + 0.3,
          });
        }
      });
    }

    // 4. Process Segments if top-level "segments" array exists
    const segs = Array.isArray(dataObj.segments) ? dataObj.segments : null;
    if (segs && segs.length > 0) {
      segs.forEach((s: any, idx: number) => {
        if (!s || typeof s !== 'object') return;
        const segId = Number(s.segment_id || s.id) || idx + 1;
        const sStart = parseSec(s.start_sec !== undefined ? s.start_sec : s.start, 0);
        const sEnd = parseSec(s.end_sec !== undefined ? s.end_sec : s.end, sStart + 3.0);
        const quoteStr = String(s.quote || s.text || s.segment_quote || `Segmen #${segId}`).trim();

        segmentsList.push({
          segment_id: segId,
          quote: quoteStr,
          start_sec: sStart,
          end_sec: sEnd > sStart ? sEnd : sStart + 3.0,
          duration_sec: Math.max(0.1, Number(((sEnd > sStart ? sEnd : sStart + 3.0) - sStart).toFixed(2))),
        });
      });
    }
  });

  // Re-index sentence_id sequentially
  sentencesList.forEach((s, idx) => {
    s.sentence_id = idx + 1;
  });

  // Re-index chunk_id sequentially
  chunksList.forEach((c, idx) => {
    c.chunk_id = idx + 1;
  });

  // Fallback 1: If sentences are empty but words exist, auto-group words into sentences
  if (sentencesList.length === 0 && wordsList.length > 0) {
    let currentGroup: SpensiaWordTimestamp[] = [];
    wordsList.forEach((w, idx) => {
      currentGroup.push(w);
      const isEndPunct = /[.!?…]$/.test(w.word);
      const nextWord = wordsList[idx + 1];
      const hasPause = nextWord ? (nextWord.start - w.end) > 0.6 : true;

      if (isEndPunct || hasPause || currentGroup.length >= 15) {
        const sStart = currentGroup[0].start;
        const sEnd = currentGroup[currentGroup.length - 1].end;
        sentencesList.push({
          sentence_id: sentencesList.length + 1,
          text: currentGroup.map((gw) => gw.word).join(' '),
          start: sStart,
          end: sEnd,
          words: [...currentGroup],
        });
        currentGroup = [];
      }
    });
    if (currentGroup.length > 0) {
      const sStart = currentGroup[0].start;
      const sEnd = currentGroup[currentGroup.length - 1].end;
      sentencesList.push({
        sentence_id: sentencesList.length + 1,
        text: currentGroup.map((gw) => gw.word).join(' '),
        start: sStart,
        end: sEnd,
        words: [...currentGroup],
      });
    }
  }

  // Fallback 2: If chunks are empty but words exist, auto-generate 3-word chunks
  if (chunksList.length === 0 && wordsList.length > 0) {
    const CHUNK_SIZE = 3;
    for (let i = 0; i < wordsList.length; i += CHUNK_SIZE) {
      const group = wordsList.slice(i, i + CHUNK_SIZE);
      const cStart = group[0].start;
      const cEnd = group[group.length - 1].end;
      chunksList.push({
        chunk_id: chunksList.length + 1,
        text: group.map((w) => w.word).join(' '),
        start: cStart,
        end: cEnd,
        words: group,
      });
    }
  }

  let transcriptFull = fullTexts.join(' ').trim();
  if (!transcriptFull && sentencesList.length > 0) {
    transcriptFull = sentencesList.map((s) => s.text).join(' ');
  } else if (!transcriptFull && wordsList.length > 0) {
    transcriptFull = wordsList.map((w) => w.word).join(' ');
  } else if (!transcriptFull && segmentsList.length > 0) {
    transcriptFull = segmentsList.map((s) => s.quote).join(' ');
  }

  if (wordsList.length === 0 && sentencesList.length === 0 && segmentsList.length === 0 && !transcriptFull) {
    issues.push({
      id: 'EMPTY_TRANSCRIPT',
      severity: 'error',
      field: 'words',
      message: 'Tidak ada kalimat, kata, atau segmen transkrip audio yang berhasil di-parse.',
    });
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const isValid = errors.length === 0;

  return {
    isValid,
    issues,
    errorCount: errors.length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    normalizedData: isValid
      ? {
          transcript_full: transcriptFull,
          sentences: sentencesList.length > 0 ? sentencesList : undefined,
          segments: segmentsList.length > 0 ? segmentsList : undefined,
          chunks: chunksList,
          words: wordsList,
        }
      : null,
    summaryText: isValid
      ? sentencesList.length > 0
        ? `Valid Sentence Transcript (${sentencesList.length} Kalimat / ${wordsList.length} Kata)`
        : segmentsList.length > 0
        ? `Valid Audio Mapping (${segmentsList.length} Segmen Adegan)`
        : `Valid Transcript (${chunksList.length} Chunks / ${wordsList.length} Kata)`
      : `Transcript Validation Failed: ${errors.map((e) => e.message).join('; ')}`,
  };
}



