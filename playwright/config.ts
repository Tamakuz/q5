import path from 'path';

export interface PlaywrightConfig {
  baseUrl: string;
  flowUrl: string;
  defaultProjectId: string;
  userDataDir: string;
  storageStatePath: string;
  defaultTimeout: number;
  viewport: { width: number; height: number };
}

const PROJECT_ROOT = path.resolve(__dirname, '..');

export const config: PlaywrightConfig = {
  baseUrl: process.env.GOOGLE_LABS_URL || 'https://labs.google/',
  flowUrl: process.env.GOOGLE_FLOW_URL || 'https://labs.google/fx/id/tools/flow',
  defaultProjectId: process.env.GOOGLE_FLOW_PROJECT_ID || '10ab715a-31e2-48d3-8e56-840e8af6c062',
  userDataDir: path.join(PROJECT_ROOT, 'playwright', 'user_data', 'user_1'),
  storageStatePath: path.join(PROJECT_ROOT, 'playwright', 'storage', 'state.json'),
  defaultTimeout: 120000, // 120 seconds (2 minutes)
  viewport: { width: 1280, height: 800 },
};

export const getStorageStatePath = () => config.storageStatePath;
export const getUserDataDir = () => config.userDataDir;
