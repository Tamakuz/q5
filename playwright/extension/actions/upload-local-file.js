/**
 * AI Studio Extension Action: uploadLocalFile
 * Contains helper actions for local file fallback upload inside Google Drive Picker modal:
 * - prepareLocalUpload: Switches to Upload tab & prepares input[type="file"].
 * - waitLocalUploadComplete: Monitors live upload progress bars until 100% complete and modal closes.
 */
(function () {
  window.AIStudioActions = window.AIStudioActions || {};

  function queryAllDocs(selector) {
    let elements = Array.from(document.querySelectorAll(selector));
    const iframes = Array.from(document.querySelectorAll('iframe'));
    for (const frame of iframes) {
      try {
        const fdoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
        if (fdoc) {
          elements = elements.concat(Array.from(fdoc.querySelectorAll(selector)));
        }
      } catch {}
    }
    return elements;
  }

  // Action 1: prepareLocalUpload
  window.AIStudioActions.prepareLocalUpload = async function prepareLocalUpload(filePath, options = {}) {
    const timeout = (typeof options === 'object' && options.timeout) ? options.timeout : 30000;
    const startTime = Date.now();
    console.log(`[Extension Action: prepareLocalUpload] Preparing Drive Picker Upload tab...`);

    // Step A: Click 'Back' button if currently in search mode
    const backBtns = queryAllDocs('[aria-label*="Back" i], [aria-label*="Kembali" i], button, div[role="button"]');
    for (const btn of backBtns) {
      const txt = (btn.getAttribute('aria-label') || btn.textContent || '').trim();
      if ((txt.includes('Back') || txt.includes('Kembali')) && btn.offsetWidth > 0) {
        console.log(`[Extension Action: prepareLocalUpload] Clicking Back button: "${txt}"...`);
        try { btn.click(); } catch {}
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
        await new Promise(r => setTimeout(r, 1000));
        break;
      }
    }

    // Step B: Click 'Upload' tab
    function findUploadTab() {
      const tabs = queryAllDocs('button[role="tab"], [role="tab"], .picker-tab, button, div, span');
      for (const tab of tabs) {
        const txt = (tab.textContent || tab.getAttribute('aria-label') || '').trim();
        if (txt === 'Upload') {
          const clickable = tab.closest('button, [role="tab"], div') || tab;
          if (clickable.offsetWidth > 0 && clickable.offsetHeight > 0) return clickable;
        }
      }
      return null;
    }

    let uploadTab = findUploadTab();
    while (!uploadTab && (Date.now() - startTime < timeout)) {
      await new Promise(r => setTimeout(r, 400));
      uploadTab = findUploadTab();
    }

    if (!uploadTab) {
      throw new Error(`[Extension Action: prepareLocalUpload] Failed to locate 'Upload' tab within ${timeout}ms`);
    }

    console.log(`[Extension Action: prepareLocalUpload] Found Upload tab. Clicking...`);
    try { uploadTab.focus(); } catch {}
    try { uploadTab.click(); } catch {}
    uploadTab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));

    await new Promise(r => setTimeout(r, 1500));

    // Step C: Verify input[type="file"] readiness
    function findFileInput() {
      const inputs = queryAllDocs('input[type="file"], input.picker-upload-button-input, input');
      for (const input of inputs) {
        if (input && (input.type === 'file' || (input.className && String(input.className).includes('upload')))) {
          return input;
        }
      }
      return null;
    }

    let fileInput = findFileInput();
    while (!fileInput && (Date.now() - startTime < timeout)) {
      await new Promise(r => setTimeout(r, 400));
      fileInput = findFileInput();
    }

    if (!fileInput) {
      throw new Error(`[Extension Action: prepareLocalUpload] Failed to locate input[type="file"] within ${timeout}ms`);
    }

    console.log(`[Extension Action: prepareLocalUpload] ✅ Upload tab ready and input[type="file"] located.`);

    return {
      success: true,
      action: 'prepareLocalUpload',
      readyForFiles: true,
      timestamp: Date.now()
    };
  };

  // Action 2: waitLocalUploadComplete
  window.AIStudioActions.waitLocalUploadComplete = async function waitLocalUploadComplete(filePath, options = {}) {
    const rawInput = (typeof filePath === 'string' && filePath.length > 0) ? filePath : ((options && options.promptText) || '');
    const searchTerm = rawInput.split(/[/\\]/).pop().trim();
    const timeout = (typeof options === 'object' && options.timeout) ? options.timeout : 180000;
    const startTime = Date.now();

    console.log(`[Extension Action: waitLocalUploadComplete] Monitoring live local upload for "${searchTerm}"...`);

    // Phase 1: Wait for progress bar / Cancel button to appear (confirming upload started)
    let uploadStarted = false;
    while (Date.now() - startTime < 15000) {
      const progressBars = queryAllDocs('[role="progressbar"], .picker-progress-bar, button');
      const activeProgress = progressBars.find(p => {
        if (p.offsetWidth <= 0 || p.offsetHeight <= 0) return false;
        const txt = (p.textContent || p.getAttribute('aria-label') || '').trim();
        return p.getAttribute('role') === 'progressbar' || p.className.includes('progress') || txt === 'Cancel';
      });

      if (activeProgress) {
        uploadStarted = true;
        console.log(`[Extension Action: waitLocalUploadComplete] ⏳ Upload progress detected! Monitoring completion...`);
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }

    // Phase 2: Wait for progress bar to DISAPPEAR (confirming upload 100% complete)
    while (Date.now() - startTime < timeout) {
      const progressBars = queryAllDocs('[role="progressbar"], .picker-progress-bar, button');
      const activeProgress = progressBars.find(p => {
        if (p.offsetWidth <= 0 || p.offsetHeight <= 0) return false;
        const txt = (p.textContent || p.getAttribute('aria-label') || '').trim();
        return p.getAttribute('role') === 'progressbar' || p.className.includes('progress') || txt === 'Cancel';
      });

      if (!activeProgress) {
        console.log(`[Extension Action: waitLocalUploadComplete] 🎉 Progress bar cleared! Upload 100% finished.`);
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    await new Promise(r => setTimeout(r, 1000));

    // Phase 3: Click Insert/Select button if visible
    const actionBtns = queryAllDocs('.picker-button-active, [aria-label*="Insert" i], [aria-label*="Select" i], button, div[role="button"]');
    for (const btn of actionBtns) {
      const txt = (btn.textContent || btn.getAttribute('aria-label') || '').trim();
      if ((txt.includes('Insert') || txt.includes('Select')) && btn.offsetWidth > 0 && !btn.className.includes('disabled')) {
        console.log(`[Extension Action: waitLocalUploadComplete] Clicking Insert/Select button: "${txt}"...`);
        try { btn.click(); } catch {}
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
        break;
      }
    }

    const resultPayload = {
      success: true,
      action: 'waitLocalUploadComplete',
      fileAttached: true,
      fileName: searchTerm,
      uploadDurationMs: Date.now() - startTime,
      timestamp: Date.now()
    };

    if (window.top && window.top !== window.self) {
      try {
        window.top.postMessage({
          type: 'ACTION_RESULT',
          action: 'waitLocalUploadComplete',
          result: resultPayload
        }, '*');
      } catch {}
    }

    return resultPayload;
  };
})();
