// dashboard/electron/shared/promptLoader.cjs
const path = require('path');
const fs = require('fs');
const { PROMPTS_DIR } = require('./paths.cjs');

/**
 * Load a prompt file from the prompts directory tree.
 * Accepts either a simple filename (searches spensia/ then longform/ then shortform/)
 * or a relative path from the prompts directory (e.g. "spensia/analyze-metadata-prompt.md").
 */
function loadPrompt(promptFileName) {
  // If it already contains a subdirectory, resolve directly
  if (promptFileName.includes('/')) {
    const filePath = path.join(PROMPTS_DIR, promptFileName);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    throw new Error(`Prompt file not found: ${filePath}`);
  }

  // Search priority: vann → spensia → longform → shortform
  const searchDirs = ['vann', 'spensia', 'longform', 'shortform'];
  for (const dir of searchDirs) {
    const filePath = path.join(PROMPTS_DIR, dir, promptFileName);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  }

  throw new Error(`Prompt file not found: ${promptFileName} (searched in vann/, spensia/, longform/, shortform/)`);
}

module.exports = { loadPrompt };
