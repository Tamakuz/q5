/**
 * AI Studio Extension Action: extractOutput
 * Monitors generation state in Google AI Studio until completion and extracts clean output text,
 * STRICTLY EXCLUDING thinking blocks, AGGREGATING MULTIPLE CHUNKS into a single continuous text,
 * and IGNORES temporary "Error querying Drive." banners if output/thinking is present or streaming.
 */
(function () {
  window.AIStudioActions = window.AIStudioActions || {};

  window.AIStudioActions.extractOutput = async function extractOutput(dummyText, options = {}) {
    const timeout = (typeof options === 'object' && options.timeout) ? options.timeout : 180000;
    const minStablePolls = (typeof options === 'object' && options.minStablePolls) ? options.minStablePolls : 3;
    const startTime = Date.now();
    console.log(`[Extension Action: extractOutput] Monitoring streaming generation & aggregating multi-chunk output...`);

    function isGenerating() {
      // 1. Check Run/Cancel button inside ms-run-button
      const runButtons = Array.from(document.querySelectorAll('ms-run-button button, button.run-button'));
      for (const btn of runButtons) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        if ((txt.includes('cancel') || txt.includes('stop') || aria.includes('cancel') || aria.includes('stop')) && btn.offsetWidth > 0 && btn.offsetHeight > 0) {
          return true;
        }
      }

      // 2. Check spinners or streaming progress indicators in prompt/chat area
      const progress = document.querySelector('ms-prompt-editor mat-progress-spinner, ms-chat-turn mat-progress-spinner, .progress-spinner, ms-progress-bar');
      if (progress && progress.offsetWidth > 0 && progress.offsetHeight > 0) {
        return true;
      }

      return false;
    }

    function isThoughtNode(el) {
      if (!el || !(el instanceof HTMLElement)) return false;
      const thoughtSelector = [
        'ms-thought-chunk',
        'ms-chat-turn-thought',
        '.thought-chunk',
        '.thinking-content',
        '.thinking-container',
        '[data-test-id*="thought" i]',
        '[data-test-id*="thinking" i]',
        'mat-expansion-panel'
      ].join(', ');
      
      return !!el.closest(thoughtSelector);
    }

    function extractCleanTextFromElement(element) {
      if (!element) return '';
      const clone = element.cloneNode(true);

      // Strip all thought/thinking nodes from the cloned DOM sub-tree
      const thoughtNodes = clone.querySelectorAll([
        'ms-thought-chunk',
        'ms-chat-turn-thought',
        '.thought-chunk',
        '.thinking-content',
        '.thinking-container',
        'div[class*="thought" i]',
        'div[class*="thinking" i]',
        '[data-test-id*="thought" i]',
        '[data-test-id*="thinking" i]',
        'mat-expansion-panel'
      ].join(', '));

      thoughtNodes.forEach(node => node.remove());

      let text = (clone.textContent || '').trim();

      // Clean up common AI Studio header / UI metadata artifacts
      text = text.replace(/^more_vert\s*/i, '')
                 .replace(/^Model\s*\d+:\d+\s*(?:AM|PM)?(?:\s*Thinking\s*[\d.]+s)?/i, '')
                 .replace(/^Thinking\s*[\d.]+s\s*/i, '')
                 .trim();

      return text;
    }

    function checkForQuotaError(hasExtractedText = false, generating = false) {
      // RULE: If output text is present OR AI is actively generating/thinking, IGNORE non-fatal toast errors (e.g. "Error querying Drive.")
      if (hasExtractedText || generating) {
        return false;
      }

      const pageBodyText = (document.body.innerText || document.body.textContent || '').toLowerCase();
      
      // Explicitly ignore "Error querying Drive." if not accompanied by internal error
      if (pageBodyText.includes('error querying drive') && !pageBodyText.includes('an internal error has occurred')) {
        return false;
      }

      return pageBodyText.includes('an internal error has occurred') ||
             pageBodyText.includes('permission denied') ||
             (pageBodyText.includes('failed to generate content') && pageBodyText.includes('try again'));
    }

    function extractCleanText() {
      // Find the active model turn (last ms-chat-turn or model-turn element)
      const turns = Array.from(document.querySelectorAll('ms-chat-turn, div.model-turn'));
      const activeTurn = turns.length > 0 ? turns[turns.length - 1] : null;
      const rootContainer = activeTurn || document;

      // Primary: Collect ALL ms-text-chunk, div.markdown, or [data-test-id="text-chunk"] elements in order
      const markdowns = Array.from(rootContainer.querySelectorAll('ms-text-chunk, div.markdown, [data-test-id="text-chunk"]'));
      
      const validChunks = [];
      for (let i = 0; i < markdowns.length; i++) {
        const mdEl = markdowns[i];
        if (isThoughtNode(mdEl)) continue; // Skip thought blocks entirely!

        const text = extractCleanTextFromElement(mdEl);
        if (text.length > 0 && !text.includes('An internal error')) {
          validChunks.push(text);
        }
      }

      if (validChunks.length > 0) {
        return validChunks.join('\n\n');
      }

      // Fallback: If no individual text chunks found, extract directly from active turn
      if (activeTurn) {
        const text = extractCleanTextFromElement(activeTurn);
        if (text.length > 0 && !text.startsWith('User') && !text.includes('An internal error')) {
          return text;
        }
      }

      return '';
    }

    // Wait 1.5 seconds for generation to commence after Run button click
    await new Promise(r => setTimeout(r, 1500));

    let lastText = '';
    let stableCount = 0;
    let finalExtractedText = '';

    while (Date.now() - startTime < timeout) {
      const generating = isGenerating();
      const currentText = extractCleanText();

      // Check for profile quota / permission error ONLY if no text extracted & not generating
      if (checkForQuotaError(currentText.length > 0, generating)) {
        const errMsg = 'An internal error has occurred (Permission denied / Profile Quota Error).';
        console.error(`[Extension Action: extractOutput] ❌ ${errMsg}`);
        return {
          success: false,
          isQuotaError: true,
          action: 'extractOutput',
          error: errMsg,
          timestamp: Date.now()
        };
      }

      if (currentText.length > 0) {
        if (currentText === lastText) {
          stableCount++;
        } else {
          stableCount = 0;
          lastText = currentText;
        }
      }

      // Log progress streaming length
      if (currentText.length !== finalExtractedText.length) {
        console.log(`[Extension Action: extractOutput] Aggregated streaming response length: ${currentText.length} chars...`);
        finalExtractedText = currentText;
      }

      // Complete ONLY when generation indicator is clear AND text length is stable across minStablePolls
      if (!generating && currentText.length > 0 && stableCount >= minStablePolls) {
        finalExtractedText = currentText;
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Final check for quota error before returning (only if no text extracted)
    if (!finalExtractedText && checkForQuotaError(false, false)) {
      const errMsg = 'An internal error has occurred (Permission denied / Profile Quota Error).';
      console.error(`[Extension Action: extractOutput] ❌ ${errMsg}`);
      return {
        success: false,
        isQuotaError: true,
        action: 'extractOutput',
        error: errMsg,
        timestamp: Date.now()
      };
    }

    if (!finalExtractedText) {
      console.warn(`[Extension Action: extractOutput] Warning: extracted response text is empty after waiting ${Math.round((Date.now() - startTime) / 1000)}s.`);
    } else {
      console.log(`[Extension Action: extractOutput] ✅ Successfully aggregated & extracted full response text (${finalExtractedText.length} chars, stabilized for ${stableCount}s).`);
    }

    return {
      success: true,
      action: 'extractOutput',
      text: finalExtractedText,
      extractedText: finalExtractedText,
      length: finalExtractedText.length,
      timestamp: Date.now()
    };
  };
})();
