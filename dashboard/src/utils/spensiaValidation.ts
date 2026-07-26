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
