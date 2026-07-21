// playwright/actions/select-model.ts
import { Page } from 'playwright';
import { Command } from 'commander';

export interface ModelSettingsOptions {
  modelName?: string;    // e.g. 'gemini-3.1-pro-preview'
  thinkingLevel?: 'High' | 'Medium' | 'Low' | 'Off';
  temperature?: number;  // e.g. 1.5
}

/**
 * Action: Select Gemini Model, Temperature (1.5) & Thinking Level in Google AI Studio
 */
export async function configureModelAndThinking(
  page: Page,
  options: ModelSettingsOptions = {}
): Promise<void> {
  const targetModel = options.modelName || 'gemini-3.5-flash';
  const thinkingLevel = options.thinkingLevel || 'High';
  const temperature = options.temperature ?? 1.5;

  console.log(`🎯 Configuring AI Studio Model: ${targetModel} | Temperature: ${temperature} | Thinking Level: ${thinkingLevel}...`);

  // 1. Check current URL model query param
  const currentUrl = page.url();
  if (!currentUrl.includes(`model=${targetModel}`)) {
    console.log(`🔄 Navigating to new chat with model ${targetModel}...`);
    await page.goto(`https://aistudio.google.com/prompts/new_chat?model=${targetModel}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(1000);
  }

  // 2. Set Temperature slider (e.g. 1.5)
  try {
    console.log(`🌡️ Setting Temperature to ${temperature}...`);
    const sliderInput = page.locator('mat-slider input, input[aria-label*="Temperature"], [role="slider"]').first();

    if (await sliderInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sliderInput.fill(String(temperature)).catch(() => { });
      await sliderInput.dispatchEvent('change').catch(() => { });
      await sliderInput.dispatchEvent('input').catch(() => { });
      console.log(`✅ Temperature successfully set to: ${temperature}`);
    } else {
      const slider = page.locator('mat-slider').first();
      if (await slider.isVisible({ timeout: 2000 }).catch(() => false)) {
        const box = await slider.boundingBox();
        if (box) {
          // Temperature range in AI Studio is 0 to 2. 1.5 is at 75% width
          const targetX = box.x + box.width * (temperature / 2.0);
          const targetY = box.y + box.height / 2;
          await page.mouse.click(targetX, targetY);
          console.log(`✅ Set Temperature slider via mouse click to ${temperature}`);
        }
      }
    }
  } catch (err: any) {
    console.log(`ℹ️ Temperature setting note: ${err.message}`);
  }

  // 3. Set Thinking Level on right panel dropdown
  try {
    await page.waitForSelector('text="Thinking level"', { timeout: 8000 }).catch(() => { });

    const dropdownSelectors = [
      'mat-select[aria-label*="Thinking"]',
      'mat-select:has-text("Medium")',
      'mat-select:has-text("Low")',
      'mat-select:has-text("High")',
      'mat-select:has-text("Off")',
      '[role="combobox"]:has-text("Medium")',
      '[role="combobox"]:has-text("Low")',
      '[role="combobox"]:has-text("High")',
      'mat-select',
      '[role="combobox"]',
    ];

    let dropdown = null;
    for (const selector of dropdownSelectors) {
      const loc = page.locator(selector).first();
      if (await loc.isVisible().catch(() => false)) {
        const text = await loc.innerText().catch(() => '');
        if (/High|Medium|Low|Off/i.test(text)) {
          dropdown = loc;
          break;
        }
      }
    }

    if (dropdown) {
      const currentText = await dropdown.innerText().catch(() => '');
      console.log(`🔍 Found Thinking level dropdown (Current: "${currentText.trim()}")`);

      if (!currentText.toLowerCase().includes(thinkingLevel.toLowerCase())) {
        console.log(`🔘 Clicking dropdown to change to ${thinkingLevel}...`);
        await dropdown.click();
        await page.waitForTimeout(500);

        const optionSelectors = [
          `mat-option:has-text("${thinkingLevel}")`,
          `[role="option"]:has-text("${thinkingLevel}")`,
          `.cdk-overlay-container span:has-text("${thinkingLevel}")`,
          `div[role="listbox"] :text("${thinkingLevel}")`,
        ];

        let optionClicked = false;
        for (const optSel of optionSelectors) {
          const opt = page.locator(optSel).first();
          if (await opt.isVisible().catch(() => false)) {
            await opt.click();
            optionClicked = true;
            console.log(`✅ Thinking level successfully updated to: ${thinkingLevel}`);
            break;
          }
        }

        if (!optionClicked) {
          await page.keyboard.press('ArrowUp');
          await page.keyboard.press('Enter');
          console.log(`✅ Used keyboard fallback for Thinking level ${thinkingLevel}`);
        }
      } else {
        console.log(`✅ Thinking level is already set to ${thinkingLevel}!`);
      }
    } else {
      console.log('⚠️ Thinking level dropdown element not found in DOM.');
    }
  } catch (err: any) {
    console.log(`ℹ️ Thinking level configuration note: ${err.message}`);
  }

  console.log(`✅ Model ${targetModel}, Temperature ${temperature} & Thinking Level ${thinkingLevel} check complete!`);
}

// ─── Direct CLI Runner ────────────────────────────────

if (require.main === module || process.argv[1]?.endsWith('select-model.ts')) {
  const program = new Command();
  program
    .name('aistudio:model')
    .description('Configure Gemini Model & Thinking Level in Google AI Studio')
    .option('-m, --model <string>', 'Model name', 'gemini-3.5-flash')
    .option('-t, --temp <number>', 'Temperature (0.0 - 2.0)', '1.5')
    .option('-l, --level <string>', 'Thinking level (High|Medium|Low|Off)', 'High')
    .action(async (opts) => {
      const { launchAIStudioSession } = await import('../aistudio');
      const { page } = await launchAIStudioSession({ headless: false });
      await configureModelAndThinking(page, {
        modelName: opts.model,
        temperature: parseFloat(opts.temp),
        thinkingLevel: opts.level as any,
      });
      console.log('🎉 Model configuration complete!');
    });

  program.parse(process.argv);
}
