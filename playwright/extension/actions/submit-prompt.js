/**
 * AI Studio Extension Action: submitPrompt
 * Waits for media processing completion & active Run button, and submits the prompt
 * STRICTLY via direct mouse click on ms-run-button (NO keyboard shortcuts).
 */
(function () {
  window.AIStudioActions = window.AIStudioActions || {};

  window.AIStudioActions.submitPrompt = async function submitPrompt(dummyText, options = {}) {
    const timeout = (typeof options === 'object' && options.timeout) ? options.timeout : 60000;
    const startTime = Date.now();
    console.log(`[Extension Action: submitPrompt] Waiting for media processing & active Run button...`);

    // Strictly target the main Run button inside ms-run-button container
    const runSelectors = [
      'ms-run-button button',
      'button.run-button',
      '[data-test-id*="run-button" i]'
    ];

    function isRunButtonEnabled(btn) {
      if (!btn) return false;
      const isDisabled = btn.disabled || 
                         btn.getAttribute('aria-disabled') === 'true' || 
                         btn.classList.contains('disabled') || 
                         btn.hasAttribute('disabled');
      const isVisible = btn.offsetWidth > 0 && btn.offsetHeight > 0;
      return !isDisabled && isVisible;
    }

    function findMainRunButton() {
      for (const sel of runSelectors) {
        const btn = document.querySelector(sel);
        if (btn) return btn;
      }
      return null;
    }

    // Wait until media processing finishes and main Run button becomes active
    let runBtn = findMainRunButton();
    while ((!runBtn || !isRunButtonEnabled(runBtn)) && (Date.now() - startTime < timeout)) {
      await new Promise(resolve => setTimeout(resolve, 500));
      runBtn = findMainRunButton();
    }

    if (!runBtn || !isRunButtonEnabled(runBtn)) {
      const errMsg = `[Extension Action: submitPrompt] Timed out waiting for Run button to become active (${timeout}ms)`;
      console.error(errMsg);
      throw new Error(errMsg);
    }

    console.log(`[Extension Action: submitPrompt] ✅ Main Run button found. Clicking directly via mouse click...`);

    // Direct Mouse Click Sequence on the active Run button
    try {
      runBtn.scrollIntoView({ block: 'center' });
      runBtn.focus();

      const mouseOpts = { bubbles: true, cancelable: true, composed: true, view: window };
      runBtn.dispatchEvent(new MouseEvent('pointerdown', mouseOpts));
      runBtn.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
      runBtn.dispatchEvent(new MouseEvent('pointerup', mouseOpts));
      runBtn.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
      runBtn.click();
      runBtn.dispatchEvent(new MouseEvent('click', mouseOpts));

      console.log(`[Extension Action: submitPrompt] ✅ Direct Run button click executed successfully.`);
    } catch (e) {
      console.warn(`[Extension Action: submitPrompt] Note dispatching runBtn click:`, e.message);
    }

    return {
      success: true,
      action: 'submitPrompt',
      submittedVia: 'DirectButtonClick',
      timestamp: Date.now()
    };
  };
})();
