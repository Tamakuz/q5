// dashboard/src/utils/spensiaValidation.ts

export interface SpensiaTopicItem {
  id: number;
  title: string;
  summary: string;
  viral_score?: number;
  viral_reason?: string;
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
 * Perform strict JSON validation and normalization for Spensia Topics output
 */
export function validateSpensiaTopics(rawInput: any): SpensiaTopicsValidationReport {
  const issues: SpensiaValidationIssue[] = [];
  let data: any = rawInput;

  // 1. Handle JSON syntax parsing if string
  if (typeof rawInput === 'string') {
    let cleaned = rawInput.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    }
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

    // Title validation
    const titleVal = item.title || item.judul;
    if (typeof titleVal !== 'string' || !titleVal.trim()) {
      issues.push({
        id: 'MISSING_TOPIC_TITLE',
        severity: 'error',
        field: `${itemPath}.title`,
        message: `Topic item #${index + 1} is missing a valid "title" string.`,
      });
    } else {
      const cleanTitle = titleVal.replace(/^["“']|["”']$/g, '').trim();
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
    const viralScore = Number(item.viral_score || item.viral_rating || item.score) || 90;
    const viralReason = item.viral_reason || item.alasan_viral || undefined;

    normalizedTopics.push({
      id: itemId,
      title: String(titleVal || `Topik #${index + 1}`).replace(/^["“']|["”']$/g, '').trim(),
      summary: String(summaryVal || 'Ringkasan tidak tersedia.').trim(),
      viral_score: Math.min(100, Math.max(50, viralScore)),
      viral_reason: typeof viralReason === 'string' ? viralReason.trim() : undefined,
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
export function validateSpensiaScript(rawInput: any): SpensiaScriptValidationReport {
  const issues: SpensiaValidationIssue[] = [];
  let data: any = rawInput;

  if (typeof rawInput === 'string') {
    let cleaned = rawInput.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    }
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

export interface SpensiaTranscriptData {
  transcript_full: string;
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
 * Validate and normalize Word-Level Audio Transcript output from AI
 */
export function validateSpensiaWordTranscript(rawInput: any): SpensiaTranscriptValidationReport {
  const issues: SpensiaValidationIssue[] = [];
  const wordsList: SpensiaWordTimestamp[] = [];
  let transcriptFull = '';

  let textContent = typeof rawInput === 'string' ? rawInput.trim() : '';

  const parseSec = (val: any, defaultVal: number = 0): number => {
    if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/[^0-9.]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? defaultVal : num;
    }
    return defaultVal;
  };

  if (typeof rawInput === 'object' && rawInput !== null) {
    transcriptFull = String(rawInput.transcript_full || rawInput.text || '').trim();
    const wList = Array.isArray(rawInput.words) ? rawInput.words : null;
    if (wList) {
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
  } else if (textContent) {
    if (textContent.startsWith('```')) {
      textContent = textContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    }

    try {
      const parsed = JSON.parse(textContent);
      transcriptFull = String(parsed.transcript_full || parsed.text || '').trim();
      const wList = Array.isArray(parsed.words) ? parsed.words : null;
      if (wList) {
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
    } catch {
      // Fallback parser if plain text
      transcriptFull = textContent;
    }
  }

  if (wordsList.length === 0 && !transcriptFull) {
    issues.push({
      id: 'EMPTY_TRANSCRIPT',
      severity: 'error',
      field: 'words',
      message: 'Tidak ada kata transkrip audio yang berhasil di-parse.',
    });
  }

  if (!transcriptFull && wordsList.length > 0) {
    transcriptFull = wordsList.map((w) => w.word).join(' ');
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const isValid = errors.length === 0;

  return {
    isValid,
    issues,
    errorCount: errors.length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    normalizedData: isValid ? { transcript_full: transcriptFull, words: wordsList } : null,
    summaryText: isValid
      ? `Valid Word Transcript (${wordsList.length} Kata)`
      : `Transcript Validation Failed: ${errors.map((e) => e.message).join('; ')}`,
  };
}



