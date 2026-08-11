import { 
  openGeminiAction, 
  inputGeminiPromptAction, 
  smartAttachGeminiAssetAction,
  submitGeminiAndExtractAction,
  GEMINI_APP_URL 
} from '../actions/gemini/index.ts';
import { config } from '../config.ts';
import path from 'path';

export interface GeminiScriptPipelineOptions {
  partNum: number;
  totalChunks: number;
  promptText: string;
  videoFileName: string;
  videoFilePath: string;
  onProgress?: (data: { percent: number; step: string; message: string }) => void;
  onLog?: (data: { level: 'info' | 'warn' | 'error'; message: string }) => void;
}

export interface GeminiScriptPipelineResult {
  success: boolean;
  partNum: number;
  rawText: string;
  extractedJson?: any;
  source?: string;
  error?: string;
}

/**
 * Pipeline: Automates Gemini Web App Script Generation for Alur Film Step 2:
 * 1. Open Gemini Web App session (15%)
 * 2. Paste prompt text into ProseMirror editor (30%)
 * 3. Smart Asset Ingestion: Search Drive without extension -> Local fallback without OS file manager dialog (60%)
 * 4. Submit & Intercept Network Stream / DOM Extraction (85%)
 * 5. Extract & parse JSON output (100%)
 */
export async function runGeminiScriptPipeline(
  options: GeminiScriptPipelineOptions
): Promise<GeminiScriptPipelineResult> {
  const { partNum, totalChunks, promptText, videoFileName, videoFilePath, onProgress, onLog } = options;

  const emitProgress = (percent: number, step: string, message: string) => {
    console.log(`[Gemini Pipeline] (${percent}%) [${step}] ${message}`);
    if (onProgress) onProgress({ percent, step, message });
  };

  const emitLog = (level: 'info' | 'warn' | 'error', message: string) => {
    console.log(`[Gemini Pipeline Log] [${level.toUpperCase()}] ${message}`);
    if (onLog) onLog({ level, message });
  };

  emitLog('info', `🚀 Starting Gemini Web App Script Generator Pipeline for Part #${partNum}/${totalChunks}...`);
  emitProgress(5, 'init', `Initializing Gemini Web App session for Part #${partNum}...`);

  try {
    // Step 1: Open Gemini Web App session
    emitProgress(15, 'open_browser', `Opening persistent Gemini browser context...`);
    emitLog('info', `Navigating to ${GEMINI_APP_URL}...`);

    const { page, context, isLoggedIn } = await openGeminiAction({
      headed: true,
      url: GEMINI_APP_URL,
      userDataDir: config.userDataDir,
    });

    if (!isLoggedIn) {
      const err = `Gemini Web App session is not logged in. Please log into Google in the open browser.`;
      emitLog('error', err);
      return { success: false, partNum, rawText: '', error: err };
    }

    emitLog('info', `✅ Gemini Web App session active & logged in.`);

    // Step 2: Paste prompt text
    emitProgress(30, 'input_prompt', `Inputting prompt text (${promptText.length} chars)...`);
    emitLog('info', `Pasting prompt text into Gemini editor for Part #${partNum}...`);
    await inputGeminiPromptAction(page, promptText);
    emitLog('info', `✅ Prompt text successfully inserted.`);

    // Step 3: 2-Category Smart Asset Ingestion
    emitProgress(50, 'attach_asset', `Searching Google Drive for "${videoFileName}"...`);
    emitLog('info', `Searching Drive without extension for "${videoFileName}" with local fallback...`);

    const attachResult = await smartAttachGeminiAssetAction(page, {
      fileName: videoFileName,
      localFilePath: videoFilePath,
    });

    if (attachResult.source === 'google_drive') {
      emitLog('info', `✅ Asset attached directly from Google Drive!`);
    } else {
      emitLog('info', `✅ Drive returned NOT FOUND. Local file uploaded automatically via DOM input (No OS file picker popup).`);
    }

    emitProgress(70, 'submit_prompt', `Submitting prompt & listening to Network Response Stream...`);
    emitLog('info', `Triggering Send button & monitoring StreamGenerate RPC network stream...`);

    // Step 4: Submit & Extract (Network Interception + DOM Fallback)
    const extractResult = await submitGeminiAndExtractAction(page);

    if (!extractResult.text || extractResult.text.length === 0) {
      const err = `Gemini response returned empty output.`;
      emitLog('error', err);
      return { success: false, partNum, rawText: '', error: err };
    }

    emitLog('info', `✅ Response extracted successfully via ${extractResult.source} (${extractResult.text.length} chars).`);

    // Step 5: Clean & Parse JSON
    emitProgress(90, 'parse_json', `Cleaning & parsing JSON output...`);
    let rawText = extractResult.text.trim();
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    let parsedJson = null;
    try {
      parsedJson = JSON.parse(rawText);
      emitLog('info', `✅ Valid JSON syntax confirmed! Macro summary: "${parsedJson.naskah_voiceover?.macro_summary || 'N/A'}"`);
    } catch (parseErr: any) {
      emitLog('warn', `⚠️ Raw output contains non-JSON markdown wrapper. Preserving raw text output.`);
    }

    emitProgress(100, 'complete', `Script Generation completed for Part #${partNum}!`);
    emitLog('info', `🎉 Script Generator Pipeline for Part #${partNum} finished successfully.`);

    return {
      success: true,
      partNum,
      rawText: extractResult.text,
      extractedJson: parsedJson,
      source: attachResult.source,
    };

  } catch (err: any) {
    const errorMsg = err.message || String(err);
    emitLog('error', `❌ Pipeline error: ${errorMsg}`);
    return {
      success: false,
      partNum,
      rawText: '',
      error: errorMsg,
    };
  }
}
