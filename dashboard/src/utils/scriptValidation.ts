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
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    }
    try {
      data = JSON.parse(cleaned);
    } catch (err: any) {
      // Fallback: extract inner JSON between first '{' and last '}'
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          data = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
        } catch {}
      }

      if (!data) {
        return {
          isValid: false,
          issues: [
            {
              id: 'INVALID_JSON_SYNTAX',
              severity: 'error',
              field: 'root',
              message: `JSON Syntax Error: ${err.message}. Pastikan teks yang ditempel memiliki kurung kurawal pembuka { dan penutup } yang utuh.`,
            },
          ],
          errorCount: 1,
          warningCount: 0,
          normalizedData: null,
          summaryText: `JSON Format Error: ${err.message}. Pastikan teks memiliki kurung kurawal { ... } yang lengkap.`,
        };
      }
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
    // Normalize script_text to string
    if (typeof data.naskah_voiceover.script_text === 'object' && data.naskah_voiceover.script_text !== null) {
      data.naskah_voiceover.script_text = JSON.stringify(data.naskah_voiceover.script_text);
    }
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

    // Normalize macro_summary to string if it is an object
    if (data.naskah_voiceover.macro_summary !== undefined && typeof data.naskah_voiceover.macro_summary !== 'string') {
      if (typeof data.naskah_voiceover.macro_summary === 'object' && data.naskah_voiceover.macro_summary !== null) {
        const obj = data.naskah_voiceover.macro_summary;
        data.naskah_voiceover.macro_summary = obj.macro_summary || obj.summary || obj.text || JSON.stringify(obj);
      } else {
        data.naskah_voiceover.macro_summary = String(data.naskah_voiceover.macro_summary);
      }
    }

    if (!data.naskah_voiceover.macro_summary) {
      issues.push({
        id: 'MISSING_MACRO_SUMMARY',
        severity: 'warning',
        field: 'naskah_voiceover.macro_summary',
        message: 'Missing "macro_summary" field in "naskah_voiceover".',
      });
    }
  }

  // Validate and normalize character_registry
  if (data.character_registry !== undefined) {
    if (!Array.isArray(data.character_registry)) {
      issues.push({
        id: 'INVALID_CHARACTER_REGISTRY',
        severity: 'error',
        field: 'character_registry',
        message: '"character_registry" must be an array of characters.',
      });
    } else {
      data.character_registry = data.character_registry.map((c: any) => {
        if (!c || typeof c !== 'object') return { assigned_name: 'Unknown', visual_description: '' };
        return {
          assigned_name: typeof c.assigned_name === 'string' ? c.assigned_name : (c.assigned_name ? JSON.stringify(c.assigned_name) : 'Unknown'),
          visual_description: typeof c.visual_description === 'string' ? c.visual_description : (c.visual_description ? JSON.stringify(c.visual_description) : ''),
        };
      });
    }
  }

  // Validate and normalize timeline_edits
  if (data.timeline_edits !== undefined) {
    if (!Array.isArray(data.timeline_edits)) {
      issues.push({
        id: 'INVALID_TIMELINE_EDITS',
        severity: 'error',
        field: 'timeline_edits',
        message: '"timeline_edits" must be an array of scene items.',
      });
    } else {
      data.timeline_edits = data.timeline_edits.map((item: any, idx: number) => {
        if (!item || typeof item !== 'object') return { id: `scene_${idx}`, scene_label: 'Scene', narrative_focus: '' };
        return {
          id: item.id || `scene_${idx}`,
          start_time: typeof item.start_time === 'string' ? item.start_time : String(item.start_time || ''),
          end_time: typeof item.end_time === 'string' ? item.end_time : String(item.end_time || ''),
          scene_label: typeof item.scene_label === 'string' ? item.scene_label : (item.scene_label ? JSON.stringify(item.scene_label) : 'Scene'),
          narrative_focus: typeof item.narrative_focus === 'string' ? item.narrative_focus : (item.narrative_focus ? JSON.stringify(item.narrative_focus) : ''),
        };
      });
    }
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
