// dashboard/electron/aiClient.cjs
/**
 * Modular AI Client Utility for 9router / OpenAI Compatible API
 */

const NINEROUTER_BASE_URL = process.env.AI_BASE_URL || 'https://9router.riztama.my.id/v1';
const NINEROUTER_API_KEY = process.env.AI_API_KEY || 'sk-6b3ac6ef8e3b70c9-eyxuxt-7adfd291';
const DEFAULT_MODEL = 'cx/gpt-5.5';

/**
 * Perform a Chat Completion request against 9router / OpenAI API
 *
 * @param {Object} options
 * @param {string} options.prompt - The main user prompt text
 * @param {string} [options.systemPrompt] - Optional system prompt
 * @param {string} [options.model] - Model name (defaults to 'cx/gpt-5.5')
 * @param {boolean} [options.jsonMode] - Whether to enforce response_format json_object
 * @param {number} [options.temperature] - Optional temperature
 * @returns {Promise<string>} The raw text response content from the AI
 */
async function chatCompletion({
  prompt,
  systemPrompt,
  model = DEFAULT_MODEL,
  jsonMode = false,
  temperature = 0.7,
}) {
  const targetModel = model || DEFAULT_MODEL;
  const messages = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: prompt });

  const reqBody = {
    model: targetModel,
    messages,
    temperature,
  };

  if (jsonMode) {
    reqBody.response_format = { type: 'json_object' };
  }

  console.log(`🤖 [AI Client] Calling 9router API (model: ${targetModel}, jsonMode: ${jsonMode})...`);

  const response = await fetch(`${NINEROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NINEROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reqBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`9router API Error (${response.status}): ${errText}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content returned from AI API response.');
  }

  let raw = content.trim();

  // Strip code fences if present
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  }

  return raw;
}

/**
 * Generate Spensia Topics using AI
 */
async function generateSpensiaTopics({ promptText, model = DEFAULT_MODEL }) {
  const rawText = await chatCompletion({
    prompt: promptText,
    model,
    jsonMode: true,
  });

  let parsed = null;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    console.warn('Could not parse JSON response directly from AI:', e);
  }

  return {
    rawText,
    topics: parsed?.topics || null,
    theme: parsed?.theme || null,
  };
}

/**
 * Generate YouTube Titles using AI (JSON Mode)
 */
async function generateYoutubeTitles({ fullPrompt, model = DEFAULT_MODEL }) {
  const rawText = await chatCompletion({
    prompt: fullPrompt,
    model,
    jsonMode: true,
  });
  return JSON.parse(rawText);
}

module.exports = {
  chatCompletion,
  generateSpensiaTopics,
  generateYoutubeTitles,
  NINEROUTER_BASE_URL,
  DEFAULT_MODEL,
};
