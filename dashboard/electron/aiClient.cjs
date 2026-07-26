// dashboard/electron/aiClient.cjs
/**
 * Modular AI Client Utility for 9router / OpenAI Compatible API
 */

const NINEROUTER_BASE_URL = process.env.AI_BASE_URL || 'https://9router.riztama.my.id/v1';
const NINEROUTER_API_KEY = process.env.AI_API_KEY || 'sk-6b3ac6ef8e3b70c9-eyxuxt-7adfd291';
const DEFAULT_MODEL = 'cx/gpt-5.5';

/**
 * Perform a Chat Completion request against 9router / OpenAI API
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
 * Perform a Streaming Chat Completion request against 9router / OpenAI API
 */
async function streamChatCompletion({
  prompt,
  systemPrompt,
  model = DEFAULT_MODEL,
  jsonMode = false,
  temperature = 0.7,
  onChunk,
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
    stream: true,
  };

  if (jsonMode) {
    reqBody.response_format = { type: 'json_object' };
  }

  console.log(`🤖 [AI Client Stream] Calling 9router SSE API (model: ${targetModel}, jsonMode: ${jsonMode})...`);

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
    throw new Error(`9router API Stream Error (${response.status}): ${errText}`);
  }

  let accumulatedText = '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;

      if (trimmed === 'data: [DONE]') {
        break;
      }

      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            accumulatedText += delta;
            if (typeof onChunk === 'function') {
              onChunk(delta, accumulatedText);
            }
          }
        } catch {
          // Ignore partial chunk parse error
        }
      }
    }
  }

  if (buffer.trim().startsWith('data: ') && buffer.trim() !== 'data: [DONE]') {
    const jsonStr = buffer.trim().slice(6);
    try {
      const parsed = JSON.parse(jsonStr);
      const delta = parsed.choices?.[0]?.delta?.content || '';
      if (delta) {
        accumulatedText += delta;
        if (typeof onChunk === 'function') {
          onChunk(delta, accumulatedText);
        }
      }
    } catch {}
  }

  let raw = accumulatedText.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  }

  return raw;
}

/**
 * Generate Spensia Topics using AI (with optional streaming onChunk)
 */
async function generateSpensiaTopics({ promptText, model = DEFAULT_MODEL, onChunk }) {
  const rawText = await streamChatCompletion({
    prompt: promptText,
    model,
    jsonMode: true,
    onChunk,
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

/**
 * Generate Spensia Script using AI (with optional streaming onChunk)
 */
async function generateSpensiaScript({ promptText, model = DEFAULT_MODEL, onChunk }) {
  const rawText = await streamChatCompletion({
    prompt: promptText,
    model,
    jsonMode: true,
    onChunk,
  });

  let parsed = null;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    console.warn('Could not parse Script JSON response directly from AI:', e);
  }

  return {
    rawText,
    scriptData: parsed || null,
  };
}

module.exports = {
  chatCompletion,
  streamChatCompletion,
  generateSpensiaTopics,
  generateSpensiaScript,
  generateYoutubeTitles,
  NINEROUTER_BASE_URL,
  DEFAULT_MODEL,
};
