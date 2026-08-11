import { 
  openGeminiAction, 
  inputGeminiPromptAction, 
  smartAttachGeminiAssetAction,
  submitGeminiAndExtractAction,
  GEMINI_APP_URL 
} from './actions/gemini';
import { config } from './config';
import path from 'path';
import fs from 'fs';

async function testGeminiAppFlow() {
  console.log('====================================================');
  console.log(' 🚀 GOOGLE GEMINI WEB APP AUTOMATION (SMART ATTACH)');
  console.log('====================================================\n');

  try {
    const { page, context, isLoggedIn } = await openGeminiAction({
      headed: true,
      url: GEMINI_APP_URL,
      userDataDir: config.userDataDir,
    });

    if (!isLoggedIn) {
      console.log('\n📌 SILAKAN LOGIN GOOGLE DI BROWSER YANG TERBUKA JUGA.');
      return;
    }

    const arg = process.argv[2];

    if (arg === '--hello') {
      const helloPrompt = 'Halo Gemini! Tolong jawab dalam 1-2 kalimat singkat: Siapa kamu dan apa keahlianmu?';
      console.log(`\n--- [STEP 1] Testing inputGeminiPromptAction ---`);
      await inputGeminiPromptAction(page, helloPrompt);

      console.log('\n--- [STEP 2] Testing submitGeminiAndExtractAction ---');
      const response = await submitGeminiAndExtractAction(page);

      console.log('\n====================================================');
      console.log(' 📊 HASIL TEST AUTOMATION (GEMINI WEB APP):');
      console.log(`  - Input Prompt: SUCCESS`);
      console.log(`  - Submit & Run: SUCCESS`);
      console.log('----------------------------------------------------');
      console.log(' 🤖 GEMINI RESPONSE OUTPUT:');
      console.log(response.text);
      console.log('====================================================\n');
    } else {
      const targetArg = arg || 'WV-FILM-20260811-CTBB_part_04.mp4';
      const targetFileName = path.basename(targetArg);
      
      let localFilePath = path.isAbsolute(targetArg) ? targetArg : path.join(process.cwd(), targetArg);
      if (!fs.existsSync(localFilePath)) {
        localFilePath = path.join(process.cwd(), 'input', 'alurfilm', 'compress', targetFileName);
      }

      const samplePrompt = `Kamu adalah seorang "Master Scriptwriter & Storyteller Alur Film".
Tugasmu adalah menganalisis segmen video film ini dan menulis naskah voiceover recap.`;

      console.log('\n--- [STEP 1] Testing inputGeminiPromptAction ---');
      await inputGeminiPromptAction(page, samplePrompt);

      console.log(`\n--- [STEP 2] Testing smartAttachGeminiAssetAction (Drive Search: "${targetFileName}", Local Fallback: "${localFilePath}") ---`);
      const attachResult = await smartAttachGeminiAssetAction(page, {
        fileName: targetFileName,
        localFilePath: localFilePath,
      });

      console.log('\n--- [STEP 3] Testing submitGeminiAndExtractAction ---');
      const response = await submitGeminiAndExtractAction(page);

      console.log('\n====================================================');
      console.log(' 📊 HASIL TEST AUTOMATION (SMART ATTACH FLOW):');
      console.log(`  - Input Prompt:  SUCCESS`);
      console.log(`  - Smart Attach:  ${attachResult.success ? 'SUCCESS' : 'FAILED'} (Source: ${attachResult.source})`);
      console.log(`  - Target File:   ${targetFileName}`);
      console.log(`  - Submit & Run:  SUCCESS (${response.text.length} chars)`);
      console.log('====================================================\n');
    }

    console.log('💡 Browser tetap terbuka agar kamu bisa melihat hasilnya langsung di layar.');

    process.on('SIGINT', async () => {
      console.log('\nClosing browser session...');
      await context.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Gemini App Test failed with error:', error);
  }
}

testGeminiAppFlow();
