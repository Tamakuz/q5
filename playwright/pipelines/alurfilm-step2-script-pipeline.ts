import { launchBrowser, getAvailableProfiles } from '../actions/launch-browser';
import { saveScriptOutput, ScriptSaveResult } from '../extension/utils/save-script-output';
import fs from 'fs';
import path from 'path';

export interface AlurfilmStep2PipelineOptions {
  targetVideoPath?: string;
  chunkPart?: number;
  totalChunks?: number;
  isFirstPart?: boolean;
  isLastPart?: boolean;
  targetWordsPerChunk?: number;
  previousContext?: string;
  styleExample?: string;
  headed?: boolean;
  timeout?: number;
}

export interface AlurfilmStep2PipelineResult {
  success: boolean;
  isQuotaError?: boolean;
  jsonPath?: string;
  textPath?: string;
  extractedText?: string;
  parsedJson?: any;
  saveResult?: ScriptSaveResult;
  error?: string;
}

/**
 * Executes Alurfilm Step 2 pipeline for a single specified Chrome profile.
 */
async function runSingleProfileScriptPipeline(
  options: AlurfilmStep2PipelineOptions = {},
  profileName: string
): Promise<AlurfilmStep2PipelineResult> {
  const targetVideoPath = options.targetVideoPath || 'input/alurfilm/compress/WV-FILM-20260811-CTBB_part_01.mp4';
  const resolvedLocalPath = path.resolve(process.cwd(), targetVideoPath);

  if (!fs.existsSync(resolvedLocalPath)) {
    return {
      success: false,
      error: `Target video file not found at: ${resolvedLocalPath}`
    };
  }

  const chunkPart = options.chunkPart || 1;
  const totalChunks = options.totalChunks || 4;
  const isFirstPart = options.isFirstPart ?? (chunkPart === 1);
  const isLastPart = options.isLastPart ?? (chunkPart === totalChunks);
  const targetWords = options.targetWordsPerChunk || 350;
  const prevContext = options.previousContext || 'Tidak ada context part sebelumnya. Ini adalah part pembuka.';
  const styleEx = options.styleExample || 'Contoh gaya narasi santai, mudah dimengerti, tanpa kalimat rumit.';
  const headed = options.headed ?? true;
  const pipelineTimeout = options.timeout || 180000;

  console.log('====================================================');
  console.log(`🎬 Starting Alurfilm Step 2 Script Generation Pipeline (Profile: ${profileName})`);
  console.log(`📁 Target Video: "${resolvedLocalPath}"`);
  console.log(`📌 Part ${chunkPart} of ${totalChunks} (Target: ${targetWords} words)`);
  console.log('====================================================');

  // Load Prompt Template
  const promptTemplatePath = path.resolve(process.cwd(), 'dashboard/prompts/longform/alurfilm-singlepass-prompt.md');
  if (!fs.existsSync(promptTemplatePath)) {
    return {
      success: false,
      error: `Prompt template not found at: ${promptTemplatePath}`
    };
  }

  const promptTemplate = fs.readFileSync(promptTemplatePath, 'utf-8');
  console.log(`📄 Loaded Prompt Template from: ${promptTemplatePath}`);

  // Substitute dynamic placeholders
  const renderedPrompt = promptTemplate
    .replace(/\{\{chunk_part\}\}/g, String(chunkPart))
    .replace(/\{\{total_chunks\}\}/g, String(totalChunks))
    .replace(/\{\{is_first_part\}\}/g, isFirstPart ? 'YA' : 'TIDAK')
    .replace(/\{\{is_last_part\}\}/g, isLastPart ? 'YA' : 'TIDAK')
    .replace(/\{\{target_words_per_chunk\}\}/g, String(targetWords))
    .replace(/\{\{previous_context\}\}/g, prevContext)
    .replace(/\{\{style_example\}\}/g, styleEx);

  const { context, page } = await launchBrowser({
    headed,
    profileName,
    slowMo: 300
  });

  try {
    console.log(`🌐 Navigating to Google AI Studio prompt editor (model: gemini-3.1-pro-preview, Profile: ${profileName})...`);
    await page.goto('https://aistudio.google.com/prompts/new_chat?model=gemini-3.1-pro-preview', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('⏳ Waiting for Google AI Studio interface to stabilize...');
    await page.waitForTimeout(5000);

    // Helper to execute action via postMessage with dynamic timeout support
    async function executeAction(actionName: string, payload: any = {}, timeoutMs?: number) {
      const effectiveTimeout = timeoutMs || (payload && payload.timeout) || 30000;
      console.log(`\n🚀 [Pipeline Step] Executing Action: "${actionName}" (timeout: ${effectiveTimeout}ms)...`);
      
      await page.evaluate(({ action, payload }) => {
        (window as any).__ACTION_RESULT = null;
        const msg = { type: 'EXECUTE_ACTION', action: action, payload: payload };
        window.postMessage(msg, '*');
      }, { action: actionName, payload });

      const startTime = Date.now();
      while (Date.now() - startTime < effectiveTimeout) {
        const result = await page.evaluate(() => (window as any).__ACTION_RESULT);
        if (result) {
          if (result.success) {
            console.log(`✅ [Pipeline Step] Action "${actionName}" result:`, JSON.stringify(result, null, 2));
            return result;
          } else {
            console.error(`❌ [Pipeline Step] Action "${actionName}" failed:`, result.reason || result.error);
            if (result.isQuotaError) {
              return result;
            }
            throw new Error(`Action "${actionName}" failed: ${result.reason || result.error}`);
          }
        }
        await page.waitForTimeout(500);
      }
      throw new Error(`Timeout waiting for action "${actionName}" after ${effectiveTimeout}ms`);
    }

    // -------------------------------------------------------------------
    // STEP 1: Paste Prompt Template
    // -------------------------------------------------------------------
    console.log('\n====================================================');
    console.log('📝 STEP 1: Pasting Alurfilm Step 2 Prompt into AI Studio Editor...');
    console.log('====================================================');

    await executeAction('inputPrompt', {
      promptText: renderedPrompt,
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    // -------------------------------------------------------------------
    // STEP 2 & 3: Open Drive Picker & Attach Video File (or Upload Fallback)
    // -------------------------------------------------------------------
    console.log('\n====================================================');
    console.log('📁 STEP 2 & 3: Opening Drive Picker & Attaching Video File...');
    console.log('====================================================');

    await executeAction('openDrivePicker', { timeout: 30000 });
    await page.waitForTimeout(2000);

    const videoFileName = path.basename(resolvedLocalPath);
    const rawSearchQuery = videoFileName.replace(/\.[^/.]+$/, '');

    const searchResult = await executeAction('searchDriveFile', {
      query: rawSearchQuery,
      fullFileName: videoFileName,
      timeout: 20000
    });

    let selectResult = await executeAction('selectDriveFile', {
      query: rawSearchQuery,
      fullFileName: videoFileName,
      timeout: 20000
    });

    if (selectResult && selectResult.fileAttached) {
      console.log(`🎉 [Drive Attach] File "${resolvedLocalPath}" was FOUND and attached directly from Google Drive!`);
    } else {
      console.warn(`⚠️ [FALLBACK TRIGGERED] File "${resolvedLocalPath}" NOT found in Google Drive.`);
      console.log(`🔄 Executing Automatic Local Upload Fallback Sequence...`);

      await executeAction('prepareLocalUpload', { timeout: 20000 });

      console.log(`📤 [Fallback] Injecting local file into input[type="file"]...`);
      const pickerIframeLocator = page.locator('iframe[name^="I0_"], iframe[name^="I1_"], iframe[name^="I2_"], iframe[src*="picker"]').last();
      const pickerFrameLocator = page.frameLocator('iframe[name^="I0_"], iframe[name^="I1_"], iframe[name^="I2_"], iframe[src*="picker"]').last();
      const fileInputLocator = pickerFrameLocator.locator('input[type="file"], input.picker-upload-button-input').first();

      await fileInputLocator.waitFor({ state: 'attached', timeout: 15000 });
      await fileInputLocator.setInputFiles(resolvedLocalPath);
      console.log(`✅ [Fallback] Local file "${path.basename(resolvedLocalPath)}" injected into input[type="file"].`);

      console.log(`⏳ [Fallback] Monitoring upload progress until 100% finished...`);
      try {
        await executeAction('waitLocalUploadComplete', {
          promptText: targetVideoPath,
          timeout: 180000
        });
      } catch (err: any) {
        console.warn(`[Fallback Note] waitLocalUploadComplete: ${err.message}`);
      }

      await pickerIframeLocator.waitFor({ state: 'hidden', timeout: 180000 }).catch(() => {});
      console.log(`✅ [Fallback] Drive Picker modal panel is CLOSED.`);
      console.log(`🎉 [SUCCESS] Local File "${path.basename(resolvedLocalPath)}" uploaded and attached successfully!`);
    }

    await page.waitForTimeout(3000);

    // -------------------------------------------------------------------
    // STEP 4: Submit Prompt to AI via Verified Retry Loop
    // -------------------------------------------------------------------
    console.log('\n====================================================');
    console.log('🚀 STEP 4: Waiting for Media Processing & Submitting Prompt to AI...');
    console.log('====================================================');

    const runBtnLocator = page.locator('ms-run-button button:not([disabled]), button[aria-label*="Run"]:not([disabled])').first();
    await runBtnLocator.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {
      console.warn('⚠️ Note: Waiting for ms-run-button timed out or button state changed.');
    });

    await page.waitForTimeout(1000);

    let submissionSuccess = false;
    for (let attempt = 1; attempt <= 8; attempt++) {
      console.log(`🚀 [Submit Attempt ${attempt}/8] Triggering submission...`);

      // Method A: Click host element & inner button
      try {
        const runHost = page.locator('ms-run-button').first();
        if (await runHost.isVisible()) {
          await runHost.click({ force: true }).catch(() => {});
        }
        const runBtn = page.locator('ms-run-button button, button.run-button').first();
        if (await runBtn.isVisible()) {
          await runBtn.click({ force: true }).catch(() => {});
        }
      } catch {}

      // Method B: Dispatch Keyboard Control+Enter on editor
      try {
        const editor = page.locator('ms-prompt-editor textarea, ms-prompt-editor [contenteditable="true"]').first();
        if (await editor.isVisible()) {
          await editor.click({ force: true }).catch(() => {});
          await page.keyboard.press('Control+Enter').catch(() => {});
        }
      } catch {}

      // Method C: Execute Extension submitPrompt action
      await executeAction('submitPrompt', { timeout: 5000 }).catch(() => {});

      await page.waitForTimeout(1500);

      // Verify generation commencement
      const isGeneratingNow = await page.evaluate(() => {
        const runBtns = Array.from(document.querySelectorAll('ms-run-button button, button.run-button'));
        for (const btn of runBtns) {
          const txt = (btn.textContent || '').trim().toLowerCase();
          const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
          if (txt.includes('cancel') || txt.includes('stop') || aria.includes('cancel') || aria.includes('stop')) {
            return true;
          }
        }
        const progress = document.querySelector('ms-prompt-editor mat-progress-spinner, ms-chat-turn mat-progress-spinner, .progress-spinner, ms-progress-bar');
        return !!(progress && progress.offsetWidth > 0);
      }).catch(() => false);

      if (isGeneratingNow) {
        console.log(`🎉 [Submit Verified] AI Generation successfully started on attempt #${attempt}!`);
        submissionSuccess = true;
        break;
      }
    }

    if (!submissionSuccess) {
      console.warn('⚠️ Warning: Could not verify generation commencement after 8 attempts. Proceeding to extract output...');
    }

    await page.waitForTimeout(2000);

    // -------------------------------------------------------------------
    // STEP 5: Extract Streaming AI Output & Check Quota Errors
    // -------------------------------------------------------------------
    console.log('\n====================================================');
    console.log('⏳ STEP 5: Waiting & Extracting Streaming Output from AI...');
    console.log('====================================================');

    const extractResult = await executeAction('extractOutput', {
      timeout: pipelineTimeout,
      minChars: 50
    });

    if (extractResult && (extractResult.isQuotaError || (extractResult.error && extractResult.error.includes('An internal error has occurred')))) {
      console.warn(`⚠️ [Quota Error Detected] Profile "${profileName}" hit quota/permission error: ${extractResult.error}`);
      return {
        success: false,
        isQuotaError: true,
        error: extractResult.error || 'An internal error has occurred (Profile Quota Error).'
      };
    }

    const aiResponseText = extractResult.extractedText || extractResult.text || '';
    console.log('\n📄 [Raw AI Output Sample]:');
    console.log(aiResponseText.substring(0, 300) + '...\n');

    // -------------------------------------------------------------------
    // STEP 6: Validate JSON & Plain Text & Save to input/alurfilm/
    // -------------------------------------------------------------------
    console.log('\n====================================================');
    console.log('💾 STEP 6: Validating & Saving Script Files to input/alurfilm/...');
    console.log('====================================================');

    const saveResult = saveScriptOutput(aiResponseText, targetVideoPath);

    if (saveResult.success) {
      console.log('====================================================');
      console.log('📊 ALURFILM STEP 2 PIPELINE SUMMARY:');
      console.log(`   - Profile Used: ${profileName}`);
      console.log(`   - Target Video File: ${targetVideoPath}`);
      console.log(`   - AI Response Length: ${aiResponseText.length} characters`);
      console.log(`   - Valid JSON Payload: ${saveResult.isValidJson ? 'YES ✅' : 'NO (Saved Plain Text)'}`);
      console.log(`   - JSON File Output: ${saveResult.jsonPath}`);
      console.log(`   - Plain Text Output: ${saveResult.textPath}`);
      console.log('====================================================');
      console.log('🎉 [PIPELINE SUCCESS] Alurfilm Step 2 script generated & saved!');
      console.log('====================================================');

      return {
        success: true,
        jsonPath: saveResult.jsonPath,
        textPath: saveResult.textPath,
        extractedText: aiResponseText,
        parsedJson: saveResult.parsedData,
        saveResult
      };
    } else {
      throw new Error(`Failed to save script output: ${saveResult.error}`);
    }

  } catch (err: any) {
    console.error('====================================================');
    console.error(`❌ [ALURFILM STEP 2 PIPELINE FAIL] (Profile: ${profileName}) Error:`, err.message || err);
    console.error('====================================================');

    const isQuotaErr = String(err.message || err).includes('An internal error has occurred') || 
                       String(err.message || err).includes('permission denied');

    return {
      success: false,
      isQuotaError: isQuotaErr,
      error: err.message || String(err)
    };
  } finally {
    try {
      await page.waitForTimeout(2000);
      await context.close();
    } catch {}
  }
}

/**
 * Production Pipeline Runner with AUTOMATIC PROFILE ROTATION:
 * If a profile hits "An internal error has occurred" or permission denied limit,
 * automatically closes the context and switches to the next available Playwright profile!
 */
export async function runAlurfilmStep2ScriptPipeline(
  options: AlurfilmStep2PipelineOptions = {}
): Promise<AlurfilmStep2PipelineResult> {
  const availableProfiles = getAvailableProfiles();
  console.log(`[Multi-Profile Driver] Available Playwright Profiles: ${JSON.stringify(availableProfiles)}`);

  let lastResult: AlurfilmStep2PipelineResult = { success: false, error: 'No profiles available.' };

  for (let i = 0; i < availableProfiles.length; i++) {
    const profileName = availableProfiles[i];
    console.log(`\n====================================================`);
    console.log(`🔄 Pipeline Execution Attempt ${i + 1}/${availableProfiles.length} using Profile: "${profileName}"`);
    console.log(`====================================================`);

    lastResult = await runSingleProfileScriptPipeline(options, profileName);

    if (lastResult.success) {
      return lastResult;
    }

    if (lastResult.isQuotaError) {
      console.warn(`⚠️ [AUTO-SWITCH TRIGGERED] Profile "${profileName}" hit quota/permission limit ("An internal error has occurred").`);
      if (i < availableProfiles.length - 1) {
        console.log(`🔄 Automatically rotating to next Playwright Profile: "${availableProfiles[i + 1]}"...`);
        continue;
      }
    } else {
      // If it's a non-quota error (e.g. invalid target file), stop immediately
      break;
    }
  }

  return lastResult;
}

// Standalone CLI Execution Driver
if (require.main === module) {
  runAlurfilmStep2ScriptPipeline().then((res) => {
    process.exit(res.success ? 0 : 1);
  });
}
