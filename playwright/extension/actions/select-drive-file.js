/**
 * AI Studio Extension Action: selectDriveFile
 * Selects/double-clicks the found file item inside Google Drive Picker modal iframe to attach it to AI Studio chat,
 * or returns fileAttached: false if file is not found.
 */
(function () {
  window.AIStudioActions = window.AIStudioActions || {};

  window.AIStudioActions.selectDriveFile = async function selectDriveFile(filePathOrName, options = {}) {
    let rawInput = '';
    if (typeof filePathOrName === 'string' && filePathOrName.trim().length > 0) {
      rawInput = filePathOrName;
    } else if (typeof filePathOrName === 'object' && filePathOrName !== null) {
      rawInput = filePathOrName.query || filePathOrName.fileName || filePathOrName.fullFileName || filePathOrName.promptText || filePathOrName.targetVideoPath || '';
      options = filePathOrName;
    }

    if (!rawInput && options && typeof options === 'object') {
      rawInput = options.query || options.fileName || options.fullFileName || options.promptText || options.targetVideoPath || '';
    }

    if (!rawInput) {
      throw new Error('[Extension Action: selectDriveFile] File name or path argument is required.');
    }

    const searchTerm = rawInput.split(/[/\\]/).pop().trim();
    const cleanBasename = searchTerm.replace(/\.[^/.]+$/, '');
    const timeout = (typeof options === 'object' && options.timeout) ? options.timeout : 20000;
    const startTime = Date.now();

    console.log(`[Extension Action: selectDriveFile] Target selection file: "${searchTerm}" (clean: "${cleanBasename}")...`);

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

    // Search for matching file item in DOM
    const itemSelectors = [
      '[role="option"].picker-grid-item',
      '.picker-grid-item-title',
      '.picker-grid-item-text',
      '.picker-dataview-row',
      '[role="option"]'
    ];

    const cleanTargetLower = cleanBasename.toLowerCase();
    const searchTargetLower = searchTerm.toLowerCase();

    function findMatchingFileItem() {
      for (const sel of itemSelectors) {
        const els = queryAllDocs(sel);
        for (const el of els) {
          const label = (el.getAttribute('aria-label') || el.textContent || '').trim();
          const labelLower = label.toLowerCase();
          if (cleanTargetLower && (labelLower.includes(cleanTargetLower) || labelLower.includes(searchTargetLower))) {
            return { element: el, label };
          }
        }
      }
      return null;
    }

    let match = findMatchingFileItem();

    while (!match && (Date.now() - startTime < 4000)) {
      await new Promise(r => setTimeout(r, 400));
      match = findMatchingFileItem();
    }

    // IF FILE IS NOT FOUND -> Return fileAttached: false for local upload fallback
    if (!match) {
      console.warn(`[Extension Action: selectDriveFile] ⚠️ File "${searchTerm}" NOT FOUND in Drive Picker. Returning fileAttached: false for fallback.`);
      return {
        success: true,
        action: 'selectDriveFile',
        fileAttached: false,
        reason: 'FILE_NOT_FOUND',
        fileName: searchTerm,
        timestamp: Date.now()
      };
    }

    const { element, label } = match;
    console.log(`[Extension Action: selectDriveFile] ✅ File item FOUND: "${label}". Dispatching click & dblclick...`);

    const targetEl = element.closest('[role="option"], .picker-grid-item, .picker-dataview-row') || element;

    // Single click sequence
    try { targetEl.focus(); } catch {}
    targetEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true }));
    targetEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, composed: true }));
    targetEl.click();
    targetEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));

    await new Promise(r => setTimeout(r, 200));

    // Double click sequence to insert directly
    targetEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, composed: true }));

    await new Promise(r => setTimeout(r, 400));

    // Fallback: Click "Select" or "Insert" button if present and active
    const selectBtns = queryAllDocs('.picker-button-active, [aria-label*="Select" i], [aria-label*="Insert" i], button, div[role="button"]');
    for (const btn of selectBtns) {
      const txt = (btn.textContent || btn.getAttribute('aria-label') || '').trim();
      if ((txt.includes('Select') || txt.includes('Insert')) && btn.offsetWidth > 0 && !btn.className.includes('disabled')) {
        console.log(`[Extension Action: selectDriveFile] Clicking Select/Insert button: "${txt}"...`);
        try { btn.click(); } catch {}
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
        break;
      }
    }

    // Wait for picker modal iframe to close / disappear
    const closeStart = Date.now();
    while (Date.now() - closeStart < 10000) {
      await new Promise(r => setTimeout(r, 500));
      const iframe = document.querySelector('iframe[src*="picker"], iframe[name^="I0_"]');
      if (!iframe || iframe.offsetWidth === 0) {
        console.log(`[Extension Action: selectDriveFile] Drive Picker iframe closed successfully.`);
        break;
      }
    }

    return {
      success: true,
      action: 'selectDriveFile',
      fileAttached: true,
      fileName: label,
      timestamp: Date.now()
    };
  };
})();
