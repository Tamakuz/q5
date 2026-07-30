import path from 'path';

export interface PlaywrightConfig {
  baseUrl: string;
  flowUrl: string;
  userDataDir: string;
  storageStatePath: string;
  defaultTimeout: number;
  viewport: { width: number; height: number };
}

const PROJECT_ROOT = path.resolve(__dirname, '..');

export const config: PlaywrightConfig = {
  baseUrl: process.env.GOOGLE_LABS_URL || 'https://labs.google/',
  flowUrl: process.env.GOOGLE_FLOW_URL || 'https://labs.google/fx/id/tools/flow',
  userDataDir: path.join(PROJECT_ROOT, 'playwright', 'user_data'),
  storageStatePath: path.join(PROJECT_ROOT, 'playwright', 'storage', 'state.json'),
  defaultTimeout: 120000, // 120 seconds (2 minutes)
  viewport: { width: 1280, height: 800 },
};

export const getStorageStatePath = () => config.storageStatePath;
export const getUserDataDir = () => config.userDataDir;
