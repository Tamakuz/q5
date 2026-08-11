import { openAIStudioAction, AI_STUDIO_NEW_CHAT_URL } from './actions/aistudio';
import { config } from './config';
import path from 'path';

async function testAIStudioFlow() {
  console.log('====================================================');
  console.log(' 🚀 GOOGLE AI STUDIO AUTOMATION (PURE EXTENSION DOM)');
  console.log('====================================================\n');

  try {
    // 1. Open AI Studio with persistent profile & Chrome Extension loaded
    const { page, context, isLoggedIn } = await openAIStudioAction({
      headed: true,
      url: AI_STUDIO_NEW_CHAT_URL,
      userDataDir: config.userDataDir,
      useCDP: false, // Ensure persistent context with loaded extension
    });

    if (!isLoggedIn) {
      console.log('\n📌 SILAKAN LOGIN GOOGLE DI BROWSER YANG TERBUKA JUGA.');
      return;
    }

    const arg = process.argv[2];
    let driveFileName = '';
    let promptText = '';

    if (arg === '--hello' || !arg) {
      promptText = 'Halo Gemini! Tolong jelaskan dalam 2 kalimat: Apa 3 keunggulan utama dari model AI Gemini?';
    } else {
      promptText = `Kamu adalah seorang "Master Scriptwriter & Storyteller Alur Film".
Tugasmu adalah menganalisis segmen video film ini dan menulis naskah voiceover recap.`;
      driveFileName = arg === '--upload' ? 'WV-FILM-20260811-CTBB_part_01' : arg;
    }

    console.log(`\n--- Dispatching EXECUTE_AI_STUDIO_JOB to Chrome Extension ---`);
    console.log(`  - Target File: "${driveFileName}"`);
    console.log(`  - Prompt:      "${promptText.substring(0, 60)}..."`);

    await page.evaluate(async ({ driveFileName, promptText }) => {
      // Wait up to 10s for extension content script to initialize
      let attempts = 0;
      while (!((window as any).AIStudioPipelines && (window as any).AIStudioPipelines.runAIStudioPipeline) && attempts < 20) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
      }

      window.postMessage({
        type: 'EXECUTE_AI_STUDIO_JOB',
        driveFileName,
        prompt: promptText,
        timeoutMs: 90000
      }, '*');
    }, { driveFileName, promptText });

    console.log('\n⏳ Waiting for Extension to finish execution...');
    const startTime = Date.now();
    let result: any = null;

    while (Date.now() - startTime < 120000) {
      await new Promise(r => setTimeout(r, 1000));
      if (page.isClosed()) break;

      result = await page.evaluate(() => (window as any).__AI_STUDIO_JOB_RESULT).catch(() => null);
      if (result && (result.success || result.error)) break;
    }

    console.log('\n====================================================');
    console.log(' 📊 HASIL TEST AUTOMATION (PURE EXTENSION):');
    if (result) {
      console.log(`  - Extension Execution: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (result.success) {
        console.log('----------------------------------------------------');
        console.log(' 🤖 GEMINI RESPONSE OUTPUT:');
        console.log(result.text);
      } else {
        console.log(`  - Error: ${result.error || 'Unknown error'}`);
      }
    } else {
      console.log('  - Extension Execution: FAILED (Timeout / Browser Closed)');
    }
    console.log('====================================================\n');

    console.log('💡 Browser tetap terbuka agar kamu bisa melihat hasilnya langsung di layar.');

    process.on('SIGINT', async () => {
      console.log('\nClosing browser session...');
      await context.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

testAIStudioFlow();
