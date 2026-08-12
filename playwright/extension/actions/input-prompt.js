/**
 * AI Studio Extension Action: inputPrompt
 * Inputs prompt text into Google AI Studio editor DOM and dispatches native events.
 */
(function () {
  window.AIStudioActions = window.AIStudioActions || {};

  window.AIStudioActions.inputPrompt = async function inputPrompt(promptText, options = {}) {
    const timeout = options.timeout || 10000;
    const startTime = Date.now();
    console.log(`[Extension Action: inputPrompt] Starting prompt insertion (${promptText ? promptText.length : 0} chars)...`);

    const selectors = [
      'ms-prompt-editor [contenteditable="true"]',
      'ms-prompt-editor textarea',
      'textarea[placeholder*="prompt" i]',
      'div[contenteditable="true"]',
      'textarea',
      '[role="textbox"]'
    ];

    function findEditor() {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
          return el;
        }
      }
      // Fallback: search any visible contenteditable or textarea
      const anyEditable = document.querySelector('[contenteditable="true"], textarea');
      if (anyEditable && anyEditable.offsetWidth > 0 && anyEditable.offsetHeight > 0) {
        return anyEditable;
      }
      return null;
    }

    let editor = findEditor();

    // Poll until editor is visible or timeout reached
    while (!editor && (Date.now() - startTime < timeout)) {
      await new Promise(resolve => setTimeout(resolve, 300));
      editor = findEditor();
    }

    if (!editor) {
      const errMsg = `[Extension Action: inputPrompt] Failed to locate prompt editor within ${timeout}ms`;
      console.error(errMsg);
      throw new Error(errMsg);
    }

    console.log(`[Extension Action: inputPrompt] Found editor element:`, editor.tagName, editor.className);

    // Focus editor element
    editor.focus();
    editor.dispatchEvent(new Event('focus', { bubbles: true, composed: true }));

    // Clear if requested
    if (options.clearFirst) {
      if ('value' in editor) {
        editor.value = '';
      } else {
        editor.innerText = '';
        editor.textContent = '';
      }
      editor.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }

    // Set value and trigger reactivity
    if ('value' in editor && typeof editor.value === 'string') {
      editor.value = promptText;
    } else {
      editor.innerText = promptText;
    }

    // Dispatch input, change, keydown, blur events for Angular/Lit form control bindings
    editor.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, composed: true }));
    editor.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true, composed: true }));
    editor.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));

    console.log(`[Extension Action: inputPrompt] ✅ Prompt successfully set in editor.`);

    return {
      success: true,
      action: 'inputPrompt',
      textLength: promptText ? promptText.length : 0,
      timestamp: Date.now()
    };
  };
})();
