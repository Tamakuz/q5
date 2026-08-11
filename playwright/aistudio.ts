import { 
  openAIStudioAction, 
  inputPromptAction, 
  warmupAIStudioSessionAction,
  attachDriveFileAction,
  uploadLocalFileAction,
  submitAndExtractAction,
  AI_STUDIO_NEW_CHAT_URL 
} from './actions/aistudio';
import { config } from './config';
import path from 'path';

async function testAIStudioFlow() {
  console.log('====================================================');
  console.log(' 🚀 GOOGLE AI STUDIO AUTOMATION (WARMUP + MAIN PROMPT)');
  console.log('====================================================\n');

  try {
    // 1. Open AI Studio with persistent profile
    const { page, context, isLoggedIn } = await openAIStudioAction({
      headed: true,
      url: AI_STUDIO_NEW_CHAT_URL,
      userDataDir: config.userDataDir,
    });

    if (!isLoggedIn) {
      console.log('\n📌 SILAKAN LOGIN GOOGLE DI BROWSER YANG TERBUKA JUGA.');
      return;
    }

    // 2. Step Warmup Session: Kirim Message 1 (Ping/Test) untuk Inisialisasi Sesi Google
    console.log('\n--- [STEP 1] Warmup Session (Kirim Message 1: Ping/Test) ---');
    await warmupAIStudioSessionAction(page);

    const arg = process.argv[2];

    // 3. Step Main Prompt: Kirim Message 2 (Prompt Asli)
    if (arg === '--hello' || !arg) {
      const mainPrompt = 'Halo Gemini! Tolong jelaskan dalam 2 kalimat: Apa 3 keunggulan utama dari model AI Gemini?';

      console.log(`\n--- [STEP 2] Main Prompt (Kirim Message 2: Prompt Asli) ---`);
      await inputPromptAction(page, mainPrompt);

      console.log('\n--- [STEP 3] Submit & Extract Output ---');
      const response = await submitAndExtractAction(page, { promptText: mainPrompt });

      console.log('\n====================================================');
      console.log(' 📊 HASIL TEST AUTOMATION (WARMUP + MAIN PROMPT):');
      console.log(`  - Warmup Session (Message 1): SUCCESS`);
      console.log(`  - Main Prompt (Message 2):   SUCCESS`);
      console.log('----------------------------------------------------');
      console.log(' 🤖 GEMINI RESPONSE OUTPUT:');
      console.log(response.text);
      console.log('====================================================\n');
    } else {
      // File mode with Warmup
      const mainPrompt = `Kamu adalah seorang "Master Scriptwriter & Storyteller Alur Film".
Tugasmu adalah menganalisis segmen video film ini dan menulis naskah voiceover recap.`;

      console.log('\n--- [STEP 2] Main Prompt (Kirim Message 2 + File Attachment) ---');
      await inputPromptAction(page, mainPrompt);

      let driveResult = { success: false, fileName: '' };
      let uploadResult = { success: false, filePath: '' };

      if (arg === '--upload' || arg.endsWith('.mp4')) {
        const localFile = arg === '--upload' 
          ? path.join(process.cwd(), 'input', 'alurfilm', 'compress', 'WV-FILM-20260811-CTBB_part_01.mp4')
          : arg;

        console.log(`\n--- [STEP 2B] Upload Local File ("${localFile}") ---`);
        uploadResult = await uploadLocalFileAction(page, localFile);
      } else {
        console.log(`\n--- [STEP 2B] Attach Drive File ("${arg}") ---`);
        driveResult = await attachDriveFileAction(page, arg);
      }

      console.log('\n--- [STEP 3] Submit & Extract Output ---');
      const response = await submitAndExtractAction(page, { promptText: mainPrompt });

      console.log('\n====================================================');
      console.log(' 📊 HASIL TEST AUTOMATION:');
      console.log(`  - Warmup Session (Message 1): SUCCESS`);
      console.log(`  - Main Prompt (Message 2):   SUCCESS`);
      if (arg === '--upload' || arg.endsWith('.mp4')) {
        console.log(`  - Upload Local File:         ${uploadResult.success ? 'SUCCESS' : 'FAILED'}`);
      } else {
        console.log(`  - Attach Drive File:          ${driveResult.success ? 'SUCCESS' : 'NOT FOUND'}`);
      }
      console.log(`  - Submit & Extract Response:  SUCCESS (${response.text.length} chars)`);
      console.log('====================================================\n');
    }

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
