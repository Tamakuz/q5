import fs from 'fs';
import path from 'path';

export interface KeywordItem {
  id: string;
  keyword: string;
  sub_niche: string;
  youtube_search_url: string;
  target_market: string;
  used_at: string;
  expires_at: string;
}

export interface KeywordsHistoryData {
  cooldown_days: number;
  history: KeywordItem[];
}

const DATA_FILE = path.resolve(process.cwd(), 'input/shorts/keywords-history.json');

export function loadKeywordsHistory(): KeywordsHistoryData {
  if (!fs.existsSync(DATA_FILE)) {
    const defaultData: KeywordsHistoryData = { cooldown_days: 14, history: [] };
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading keywords history file:', err);
    return { cooldown_days: 14, history: [] };
  }
}

export function saveKeywordsHistory(data: KeywordsHistoryData): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function getActiveKeywords(cooldownDays = 14): KeywordItem[] {
  const data = loadKeywordsHistory();
  const now = new Date();
  return data.history.filter((item) => {
    const expires = new Date(item.expires_at);
    return expires > now;
  });
}

export function addKeywordsToHistory(newItems: Omit<KeywordItem, 'id' | 'used_at' | 'expires_at'>[]): KeywordItem[] {
  const data = loadKeywordsHistory();
  const now = new Date();
  const expires = new Date(now.getTime() + (data.cooldown_days || 14) * 24 * 60 * 60 * 1000);

  const created: KeywordItem[] = newItems.map((item, idx) => ({
    ...item,
    id: `kw_${now.getTime()}_${idx}`,
    used_at: now.toISOString(),
    expires_at: expires.toISOString(),
  }));

  data.history.unshift(...created);
  saveKeywordsHistory(data);
  return created;
}
