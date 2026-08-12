/**
 * AI Studio Chrome Extension Content Script Router
 * Listens for window.postMessage events and dispatches actions to window.AIStudioActions.
 * Handles frame forwarding and cross-frame result syncing for Drive Picker iframe actions.
 */
(function () {
  console.log('[Extension Router] Injected content.js into page context ("world": "MAIN"). Host:', location.hostname);

  function getActivePickerIframe() {
    const iframes = Array.from(document.querySelectorAll('iframe[src*="picker"], iframe[name^="I0_"], iframe[name^="I1_"], iframe[name^="I2_"]'));
    for (let i = iframes.length - 1; i >= 0; i--) {
      const frame = iframes[i];
      if (frame.offsetWidth > 0 || frame.offsetHeight > 0 || frame.getClientRects().length > 0) {
        return frame;
      }
    }
    return iframes[iframes.length - 1] || null;
  }

  window.addEventListener('message', async (event) => {
    if (!event.data || typeof event.data !== 'object') return;

    // Synchronize ACTION_RESULT from child iframe to top frame window
    if (event.data.type === 'ACTION_RESULT' && event.data.result) {
      if (window.self === window.top) {
        console.log('[Extension Router] Top frame received ACTION_RESULT from child frame:', event.data.result);
        window.__ACTION_RESULT = event.data.result;
      }
      return;
    }

    if (event.data.type !== 'EXECUTE_ACTION') return;

    const { action, payload, requestId } = event.data;

    // Drive Picker iframe actions MUST ONLY execute inside Drive Picker iframe!
    const pickerActions = ['searchDriveFile', 'selectDriveFile', 'prepareLocalUpload', 'waitLocalUploadComplete'];
    if (pickerActions.includes(action)) {
      if (window.self === window.top) {
        const pickerIframe = getActivePickerIframe();
        if (pickerIframe && pickerIframe.contentWindow) {
          console.log(`[Extension Router] Forwarding action "${action}" to active Drive Picker iframe context (${pickerIframe.name || 'picker'})...`);
          try {
            pickerIframe.contentWindow.postMessage(event.data, '*');
          } catch (err) {
            console.error('[Extension Router] Error forwarding to picker iframe:', err);
          }
        } else {
          console.error(`[Extension Router] Cannot execute "${action}" in top window - Drive Picker iframe not found!`);
          window.__ACTION_RESULT = {
            success: false,
            action,
            error: `[Extension Action: ${action}] Drive Picker iframe not found in DOM`,
            timestamp: Date.now()
          };
        }
        return; // CRITICAL: Stop top window from executing picker actions!
      }
    }

    console.log(`[Extension Router] Executing action: "${action}" in frame:`, location.href.substring(0, 70));

    window.__ACTION_RESULT = null;

    try {
      if (!window.AIStudioActions || typeof window.AIStudioActions[action] !== 'function') {
        throw new Error(`Extension Action "${action}" is not registered on window.AIStudioActions in frame ${location.hostname}`);
      }

      const promptArg = (payload && typeof payload === 'object') ? (payload.promptText || '') : (payload || '');
      const optionsArg = (payload && typeof payload === 'object') ? payload : {};
      const result = await window.AIStudioActions[action](promptArg, optionsArg);
      
      window.__ACTION_RESULT = result;

      // Broadcast result to top frame as well
      if (window.top && window.top !== window.self) {
        window.top.postMessage({
          type: 'ACTION_RESULT',
          action,
          requestId,
          result
        }, '*');
      }

      console.log(`[Extension Router] Action "${action}" completed successfully in frame ${location.hostname}:`, result);
    } catch (err) {
      const errorResult = {
        success: false,
        action,
        requestId,
        error: err.message || String(err),
        timestamp: Date.now()
      };
      window.__ACTION_RESULT = errorResult;

      if (window.top && window.top !== window.self) {
        window.top.postMessage({
          type: 'ACTION_RESULT',
          action,
          requestId,
          result: errorResult
        }, '*');
      }

      console.error(`[Extension Router] Action "${action}" failed in frame ${location.hostname}:`, err);
    }
  });
})();
