// dashboard/src/utils/scriptValidation.ts

export interface AlurfilmAnalysisData {
  chunk_part?: number;
  total_chunks?: number;
  naskah_voiceover?: {
    word_count?: number;
    script_text: string;
    macro_summary?: string;
  };
  character_registry?: Array<{
    visual_description: string;
    assigned_name: string;
  }>;
  timeline_edits?: Array<{
    id: string;
    start_time?: string;
    end_time?: string;
    scene_label?: string;
    narrative_focus?: string;
  }>;
  status?: string;
}

export interface ScriptValidationIssue {
  id: string;
  severity: 'error' | 'warning';
  field: string;
  message: string;
}

export interface ScriptValidationReport {
  isValid: boolean;
  issues: ScriptValidationIssue[];
  errorCount: number;
  warningCount: number;
  normalizedData: AlurfilmAnalysisData | null;
  summaryText: string;
}

/**
 * Robustly validates and normalizes Alur Film Script Analysis JSON input
 */
export function validateScriptAnalysis(
  rawInput: any,
  fallbackPartNum: number = 1
): ScriptValidationReport {
  const issues: ScriptValidationIssue[] = [];

  let data: any = rawInput;

  // Handle raw string or markdown json string
  if (typeof rawInput === 'string') {
    let cleaned = rawInput.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
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

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      isValid: false,
      issues: [
        {
          id: 'INVALID_ROOT_TYPE',
          severity: 'error',
          field: 'root',
          message: 'Script Analysis output must be a valid JSON Object.',
        },
      ],
      errorCount: 1,
      warningCount: 0,
      normalizedData: null,
      summaryText: 'Root JSON is not an object.',
    };
  }

  // Validate naskah_voiceover
  if (!data.naskah_voiceover || typeof data.naskah_voiceover !== 'object') {
    issues.push({
      id: 'MISSING_NASKAH_VOICEOVER',
      severity: 'error',
      field: 'naskah_voiceover',
      message: 'Missing "naskah_voiceover" object in JSON output.',
    });
  } else {
    const scriptText = data.naskah_voiceover.script_text;
    if (typeof scriptText !== 'string' || !scriptText.trim()) {
      issues.push({
        id: 'EMPTY_SCRIPT_TEXT',
        severity: 'error',
        field: 'naskah_voiceover.script_text',
        message: 'Missing or empty "script_text" in "naskah_voiceover".',
      });
    } else {
      const words = scriptText.trim().split(/\s+/).filter(Boolean);
      if (words.length < 30) {
        issues.push({
          id: 'SHORT_SCRIPT_TEXT',
          severity: 'warning',
          field: 'naskah_voiceover.script_text',
          message: `Script narration is unusually short (${words.length} words). Target is ~500 words per chunk.`,
        });
      }
      // Auto-correct or update word_count
      data.naskah_voiceover.word_count = words.length;
    }

    if (!data.naskah_voiceover.macro_summary || typeof data.naskah_voiceover.macro_summary !== 'string') {
      issues.push({
        id: 'MISSING_MACRO_SUMMARY',
        severity: 'warning',
        field: 'naskah_voiceover.macro_summary',
        message: 'Missing "macro_summary" field in "naskah_voiceover".',
      });
    }
  }

  // Validate character_registry
  if (data.character_registry !== undefined && !Array.isArray(data.character_registry)) {
    issues.push({
      id: 'INVALID_CHARACTER_REGISTRY',
      severity: 'error',
      field: 'character_registry',
      message: '"character_registry" must be an array of characters.',
    });
  }

  // Validate timeline_edits
  if (data.timeline_edits !== undefined && !Array.isArray(data.timeline_edits)) {
    issues.push({
      id: 'INVALID_TIMELINE_EDITS',
      severity: 'error',
      field: 'timeline_edits',
      message: '"timeline_edits" must be an array of scene items.',
    });
  }

  // Normalize defaults
  const parsedPart = Number(data.chunk_part);
  data.chunk_part = !isNaN(parsedPart) ? parsedPart : fallbackPartNum;
  data.status = data.status || 'done';

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const isValid = errors.length === 0;

  return {
    isValid,
    issues,
    errorCount: errors.length,
    warningCount: warnings.length,
    normalizedData: isValid ? data : null,
    summaryText: isValid
      ? `Valid Script JSON (${data.naskah_voiceover?.word_count || 0} Kata)`
      : `Validation Failed: ${errors.map((e) => e.message).join(', ')}`,
  };
}
