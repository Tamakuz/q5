// playwright/config.ts
import path from 'path';

export const PLAYWRIGHT_DIR = path.resolve(__dirname);
export const USER_DATA_DIR = path.join(PLAYWRIGHT_DIR, 'user_data');

export const DEFAULT_AI_STUDIO_URL = 'https://aistudio.google.com/';

export const BROWSER_LAUNCH_OPTIONS = {
  headless: false,
  viewport: { width: 1920, height: 1080 }, // Desktop Landscape 16:9
  args: [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--start-maximized',
    '--window-size=1920,1080',
  ],
  ignoreDefaultArgs: ['--enable-automation'],
};
