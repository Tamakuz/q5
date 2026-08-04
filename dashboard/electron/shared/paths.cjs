// dashboard/electron/shared/paths.cjs
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const INPUT_ASSETS = path.join(PROJECT_ROOT, 'input', 'assets');
const TMP_DIR = path.join(PROJECT_ROOT, 'input', '.tmp');
const SPENSIA_INPUT_DIR = path.join(PROJECT_ROOT, 'input', 'spensia');
const SPENSIA_OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'spensia');
const SPENSIA_IMAGES_DIR = path.join(PROJECT_ROOT, 'input', 'spensia', 'images');
const SPENSIA_THUMBNAILS_DIR = path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnails');
const SPENSIA_AUDIO_DIR = path.join(PROJECT_ROOT, 'input', 'spensia', 'audio');
const VANN_INPUT_DIR = path.join(PROJECT_ROOT, 'input', 'vann');
const VANN_OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'vann');
const VANN_IMAGES_DIR = path.join(PROJECT_ROOT, 'input', 'vann', 'images');
const VANN_THUMBNAILS_DIR = path.join(PROJECT_ROOT, 'input', 'vann', 'thumbnails');
const VANN_AUDIO_DIR = path.join(PROJECT_ROOT, 'input', 'vann', 'audio');
const WAKU_INPUT_DIR = VANN_INPUT_DIR;
const WAKU_OUTPUT_DIR = VANN_OUTPUT_DIR;
const WAKU_IMAGES_DIR = VANN_IMAGES_DIR;
const WAKU_THUMBNAILS_DIR = VANN_THUMBNAILS_DIR;
const WAKU_AUDIO_DIR = VANN_AUDIO_DIR;
const ALURFILM_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm');
const ALURFILM_CHUNKS_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'chunks');
const ALURFILM_COMPRESS_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'compress');
const ALURFILM_AUDIO_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'audio');
const ALURFILM_TRANSCRIPTS_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'transcripts');
const ALURFILM_MAPPINGS_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'mappings');
const UGC_DIR = path.join(PROJECT_ROOT, 'input', 'ugc');
const UGC_PROFILES_DIR = path.join(PROJECT_ROOT, 'input', 'ugc', 'profiles');
const UGC_PRODUCTS_DIR = path.join(PROJECT_ROOT, 'input', 'ugc', 'products');
const UGC_OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'ugc');
const PROMPTS_DIR = path.join(PROJECT_ROOT, 'dashboard', 'prompts');
const tsxBinPath = path.join(PROJECT_ROOT, 'node_modules', '.bin', 'tsx');

// Ensure dirs exist
[
  INPUT_ASSETS,
  TMP_DIR,
  SPENSIA_INPUT_DIR,
  SPENSIA_OUTPUT_DIR,
  VANN_INPUT_DIR,
  VANN_OUTPUT_DIR,
  VANN_IMAGES_DIR,
  VANN_THUMBNAILS_DIR,
  VANN_AUDIO_DIR,
  ALURFILM_DIR,
  ALURFILM_CHUNKS_DIR,
  ALURFILM_COMPRESS_DIR,
  ALURFILM_AUDIO_DIR,
  ALURFILM_TRANSCRIPTS_DIR,
  ALURFILM_MAPPINGS_DIR,
  UGC_DIR,
  UGC_PROFILES_DIR,
  UGC_PRODUCTS_DIR,
  UGC_OUTPUT_DIR,
].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Generate or retrieve content ID for a given mode (waku/shortform/longform/spensia)
 */
function getOrGenerateContentId(mode = 'waku') {
  const isLongform = mode === 'longform';
  const isSpensia = mode === 'spensia';
  const isWaku = mode === 'waku' || mode === 'shortform';
  const mappingFile = isWaku
    ? path.join(PROJECT_ROOT, 'input', 'vann', 'vann_mapping.json')
    : isSpensia
      ? path.join(PROJECT_ROOT, 'input', 'spensia', 'spensia_mapping.json')
      : isLongform
        ? path.join(PROJECT_ROOT, 'input', 'longform_mapping.json')
        : path.join(PROJECT_ROOT, 'input', 'mapping.json');

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
  const prefix = isWaku ? 'WV-VANN' : isSpensia ? 'WV-SPENSIA' : isLongform ? 'WV-FILM' : 'WV';
  const newId = `${prefix}-${dateStr}-${randStr}`;

  try {
    let mapping = {
      settings: {
        fps: 30,
        format: isSpensia ? "16:9" : isLongform ? "16:9" : "9:16",
        fg_aspect: isSpensia ? "16:9" : isLongform ? "16:9" : "4:5",
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
  SPENSIA_INPUT_DIR,
  SPENSIA_OUTPUT_DIR,
  SPENSIA_IMAGES_DIR,
  SPENSIA_THUMBNAILS_DIR,
  SPENSIA_AUDIO_DIR,
  VANN_INPUT_DIR,
  VANN_OUTPUT_DIR,
  VANN_IMAGES_DIR,
  VANN_THUMBNAILS_DIR,
  VANN_AUDIO_DIR,
  WAKU_INPUT_DIR,
  WAKU_OUTPUT_DIR,
  WAKU_IMAGES_DIR,
  WAKU_THUMBNAILS_DIR,
  WAKU_AUDIO_DIR,
  ALURFILM_DIR,
  ALURFILM_CHUNKS_DIR,
  ALURFILM_COMPRESS_DIR,
  ALURFILM_AUDIO_DIR,
  ALURFILM_TRANSCRIPTS_DIR,
  ALURFILM_MAPPINGS_DIR,
  UGC_DIR,
  UGC_PROFILES_DIR,
  UGC_PRODUCTS_DIR,
  UGC_OUTPUT_DIR,
  PROMPTS_DIR,
  tsxBinPath,
  getOrGenerateContentId,
};
