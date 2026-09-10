// dashboard/electron/shared/paths.cjs
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const INPUT_ASSETS = path.join(PROJECT_ROOT, 'input', 'assets');
const TMP_DIR = path.join(PROJECT_ROOT, 'input', '.tmp');
const ALURFILM_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm');
const ALURFILM_CHUNKS_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'chunks');
const ALURFILM_COMPRESS_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'compress');
const ALURFILM_AUDIO_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'audio');
const ALURFILM_TRANSCRIPTS_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'transcripts');
const ALURFILM_MAPPINGS_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'mappings');
const SHORTS_INPUT_DIR = path.join(PROJECT_ROOT, 'input', 'shorts');
const SHORTS_OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'shorts');
const PROMPTS_DIR = path.join(PROJECT_ROOT, 'dashboard', 'prompts');
const tsxBinPath = path.join(PROJECT_ROOT, 'node_modules', '.bin', 'tsx');

// Ensure dirs exist
[
  INPUT_ASSETS,
  TMP_DIR,
  ALURFILM_DIR,
  ALURFILM_CHUNKS_DIR,
  ALURFILM_COMPRESS_DIR,
  ALURFILM_AUDIO_DIR,
  ALURFILM_TRANSCRIPTS_DIR,
  ALURFILM_MAPPINGS_DIR,
  SHORTS_INPUT_DIR,
  SHORTS_OUTPUT_DIR,
].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Generate or retrieve content ID for Alur Film longform mode or Shorts
 */
function getOrGenerateContentId(mode = 'longform') {
  if (mode === 'shorts') {
    return 'WV-SHORTS-DRAFT';
  }
  const mappingFile = path.join(PROJECT_ROOT, 'input', 'longform_mapping.json');

  const dir = path.dirname(mappingFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  try {
    if (fs.existsSync(mappingFile)) {
      const data = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
      if (data.settings?.content_id) {
        return data.settings.content_id;
      }
    }
  } catch { }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  const newId = `WV-FILM-${dateStr}-${randStr}`;

  try {
    let mapping = {
      settings: {
        fps: 30,
        format: "16:9",
        fg_aspect: "16:9",
        bgm: "random",
        content_id: newId
      },
      timeline: []
    };
    if (fs.existsSync(mappingFile)) {
      mapping = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
    }
    mapping.settings = mapping.settings || {};
    mapping.settings.content_id = newId;
    fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2), 'utf-8');
  } catch { }

  return newId;
}

module.exports = {
  PROJECT_ROOT,
  INPUT_ASSETS,
  TMP_DIR,
  ALURFILM_DIR,
  ALURFILM_CHUNKS_DIR,
  ALURFILM_COMPRESS_DIR,
  ALURFILM_AUDIO_DIR,
  ALURFILM_TRANSCRIPTS_DIR,
  ALURFILM_MAPPINGS_DIR,
  SHORTS_INPUT_DIR,
  SHORTS_OUTPUT_DIR,
  PROMPTS_DIR,
  tsxBinPath,
  getOrGenerateContentId,
};
