const { launchBrowser } = require('../playwright/actions/launch-browser.ts');
const path = require('path');
const fs = require('fs');

/**
 * Node.js AI Studio Automation Script
 * Uses Playwright Persistent Context & Extension Router for 100% reliable execution.
 * Usage: npx tsx scripts/test-agent-browser-aistudio.js [profile_name] [prompt_text]
 */

(async () => {
  const profileName = process.argv[2] || 'user_1';
  const promptText = process.argv[3] || 'Halo Gemini, salam dari Node.js Playwright script!';
  const url = 'https://aistudio.google.com/prompts/new_chat?model=gemini-3.1-pro-preview';

  console.log('========================================================');
  console.log('🚀 AI Studio Node.js Automation Runner');
  console.log(`Profile: ${profileName}`);
  console.log(`Prompt: ${promptText}`);
  console.log('========================================================');

  try {
    console.log(`🌐 1. Launching Chrome Browser (Profile: ${profileName})...`);
    const { context, page } = await launchBrowser({
      headed: true,
      profileName: profileName
    });

    console.log(`🌐 2. Opening Google AI Studio...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('⏳ 3. Waiting for Extension to initialize on AI Studio page...');
    for (let i = 0; i < 20; i++) {
      const ready = await page.evaluate(() => typeof (window).AIStudioActions !== 'undefined');
      if (ready) {
        console.log('✅ Chrome Extension is READY on page!');
        break;
      }
      await page.waitForTimeout(500);
    }

    console.log('📝 4. Inputting prompt text into editor...');
    await page.evaluate(({ promptText }) => {
      if ((window).AIStudioActions && (window).AIStudioActions.inputPrompt) {
        return (window).AIStudioActions.inputPrompt(promptText);
      }
    }, { promptText });

    await page.waitForTimeout(1000);

    console.log('🔘 5. Submitting prompt...');
    await page.evaluate(() => {
      if ((window).AIStudioActions && (window).AIStudioActions.submitPrompt) {
        return (window).AIStudioActions.submitPrompt('', { timeout: 60000 });
      }
    });

    console.log('⏳ 6. Monitoring streaming response...');
    await page.waitForTimeout(5000);

    console.log('📄 7. Extracting response text:');
    console.log('--------------------------------------------------------');
    const responseText = await page.evaluate(() => {
      const turns = Array.from(document.querySelectorAll('ms-chat-turn'));
      return turns.map(t => t.innerText).join('\n---\n');
    });

    console.log(responseText || '(No response text returned)');
    console.log('--------------------------------------------------------');

    console.log('✅ Automation script completed successfully!');
  } catch (err) {
    console.error('❌ Script execution error:', err.message || err);
    process.exit(1);
  }
})();
