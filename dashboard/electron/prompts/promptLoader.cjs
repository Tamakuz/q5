// dashboard/electron/prompts/promptLoader.cjs
const path = require('path');
const fs = require('fs');

/**
 * Load system prompt file cleanly from prompts/ directory
 */
function loadPrompt(promptFileName) {
  const filePath = path.join(__dirname, promptFileName);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  throw new Error(`Prompt file not found: ${filePath}`);
}

module.exports = {
  loadPrompt,
};
