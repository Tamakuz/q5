import fs from 'fs';
import path from 'path';

export interface ScriptSaveResult {
  success: boolean;
  jsonPath?: string;
  textPath?: string;
  isValidJson: boolean;
  parsedData?: any;
  error?: string;
}

/**
 * Validates AI-generated response text (plain text narration & JSON structure)
 * STRICT RULE: If the output is missing valid JSON or missing mandatory `naskah_voiceover` structure,
 * DO NOT SAVE ANY FILES TO DISK, and return an explicit error payload.
 */
export function saveScriptOutput(responseText: string, videoFilePath: string): ScriptSaveResult {
  if (!responseText || typeof responseText !== 'string' || responseText.trim().length === 0) {
    return {
      success: false,
      isValidJson: false,
      error: 'Empty response text received from AI.'
    };
  }

  const rawFileName = path.basename(videoFilePath);
  const cleanBasename = rawFileName.replace(/\.[^/.]+$/, '');
  const outputDir = path.resolve(process.cwd(), 'input/alurfilm');

  // Extract JSON payload from code blocks or raw JSON string
  let parsedJson: any = null;
  let isValidJson = false;

  const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonCandidate = jsonBlockMatch ? jsonBlockMatch[1] : responseText;

  try {
    const startIdx = jsonCandidate.indexOf('{');
    const endIdx = jsonCandidate.lastIndexOf('}');
    
    if (startIdx !== -1 && endIdx > startIdx) {
      const jsonString = jsonCandidate.substring(startIdx, endIdx + 1);
      parsedJson = JSON.parse(jsonString);
      
      // Strict structural validation
      const scriptText = parsedJson?.naskah_voiceover?.script_text || parsedJson?.narration || '';
      const isTemplatePlaceholder = scriptText.includes('[Teks naskah voiceover recap') ||
                                    scriptText.includes('Judul Adegan Singkat & Jelas') ||
                                    scriptText.includes('Nama Karakter Utama');

      const hasVoiceover = parsedJson && typeof parsedJson === 'object' && typeof scriptText === 'string' && scriptText.trim().length > 0;

      if (hasVoiceover && !isTemplatePlaceholder) {
        isValidJson = true;
      }
    }
  } catch (err: any) {
    console.warn('[Script Saver] Syntax error parsing JSON candidate:', err.message);
  }

  // STRICT RULE: If missing mandatory naskah_voiceover JSON structure, DO NOT SAVE ANY FILES!
  if (!isValidJson || !parsedJson) {
    const errMsg = 'Script Analysis Error: Missing mandatory "naskah_voiceover" object in JSON output. File was not saved.';
    console.error(`[Script Saver] ❌ ${errMsg}`);
    return {
      success: false,
      isValidJson: false,
      error: errMsg
    };
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jsonPath = path.join(outputDir, `${cleanBasename}_script.json`);
  const textPath = path.join(outputDir, `${cleanBasename}_script.txt`);

  try {
    fs.writeFileSync(jsonPath, JSON.stringify(parsedJson, null, 2), 'utf-8');
    fs.writeFileSync(textPath, responseText, 'utf-8');

    console.log(`[Script Saver] ✅ Saved valid JSON script to: ${jsonPath}`);
    console.log(`[Script Saver] ✅ Saved Plain Text narration to: ${textPath}`);

    return {
      success: true,
      jsonPath,
      textPath,
      isValidJson: true,
      parsedData: parsedJson
    };
  } catch (err: any) {
    return {
      success: false,
      isValidJson: true,
      error: `Failed to save output files to disk: ${err.message}`
    };
  }
}
