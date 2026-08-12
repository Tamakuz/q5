/**
 * AI Studio Extension Action: searchDriveFile
 * Runs directly inside Google Drive Picker iframe (docs.google.com/picker) or main page.
 * Inputs search query into <input role="combobox" placeholder="Search in Drive or paste URL">,
 * dispatches Enter & Search button click, waits for search results to load, and detects file presence or empty state across all frames.
 */
(function () {
  window.AIStudioActions = window.AIStudioActions || {};

  window.AIStudioActions.searchDriveFile = async function searchDriveFile(filePathOrName, options = {}) {
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
      throw new Error('[Extension Action: searchDriveFile] File name or path argument is required.');
    }

    const searchTerm = rawInput.split(/[/\\]/).pop().trim();
    const cleanBasename = searchTerm.replace(/\.[^/.]+$/, '');
    const timeout = (typeof options === 'object' && options.timeout) ? options.timeout : 30000;
    const startTime = Date.now();

    console.log(`[Extension Action: searchDriveFile] Searching Drive Picker for: "${searchTerm}" (clean: "${cleanBasename}")...`);

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

    // Try clearing previous search query if clear/back button exists
    const resetBtns = queryAllDocs('[aria-label*="Clear search" i], [aria-label*="Clear" i], .picker-search-clear');
    for (const btn of resetBtns) {
      try { if (btn.offsetWidth > 0 || btn.offsetHeight > 0) btn.click(); } catch {}
    }

    function locateSearchInput() {
      const selectors = [
        'input[role="combobox"]',
        'input.Ax4B8',
        'input[aria-label*="Search" i]',
        'input[placeholder*="Search" i]',
        'input[type="text"]',
        'input'
      ];
      for (const sel of selectors) {
        const els = queryAllDocs(sel);
        for (const el of els) {
          if (el) return el;
        }
      }
      return null;
    }

    let searchInput = locateSearchInput();

    while (!searchInput && (Date.now() - startTime < timeout)) {
      await new Promise(r => setTimeout(r, 500));
      searchInput = locateSearchInput();
    }

    if (!searchInput) {
      const errMsg = `[Extension Action: searchDriveFile] Failed to locate 'Search in Drive' input within ${timeout}ms`;
      console.error(errMsg);
      throw new Error(errMsg);
    }

    const targetDoc = searchInput.ownerDocument || document;
    console.log(`[Extension Action: searchDriveFile] Found Search input element:`, searchInput.tagName, searchInput.className);

    // Focus & clear search box completely
    try { searchInput.focus(); } catch {}
    try { searchInput.click(); } catch {}
    try { searchInput.select(); } catch {}
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

    await new Promise(r => setTimeout(r, 300));

    // Input search query
    const queryToType = cleanBasename || searchTerm;
    searchInput.value = queryToType;
    searchInput.dispatchEvent(new InputEvent('input', { data: queryToType, inputType: 'insertText', bubbles: true, composed: true }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    await new Promise(r => setTimeout(r, 400));

    // Dispatch Enter key events on input and parent elements
    ['keydown', 'keypress', 'keyup'].forEach(type => {
      const ev = new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, charCode: 13, bubbles: true, cancelable: true, composed: true });
      searchInput.dispatchEvent(ev);
      if (searchInput.parentElement) {
        searchInput.parentElement.dispatchEvent(ev);
      }
    });

    // Click Search icon button if available
    const searchBtns = queryAllDocs('.picker-search-button, [role="button"][aria-label*="Search" i], button[aria-label*="Search" i]');
    const searchBtn = searchBtns.find(b => b.offsetWidth > 0 || b.offsetHeight > 0);
    if (searchBtn) {
      console.log(`[Extension Action: searchDriveFile] Clicking Search icon button...`);
      try { searchBtn.click(); } catch {}
      searchBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    }

    console.log(`[Extension Action: searchDriveFile] Submitted search query "${queryToType}". Monitoring search results across frames...`);

    await new Promise(r => setTimeout(r, 2000));

    // Step: Detect search results (File FOUND vs NOT FOUND) across frames
    const searchStart = Date.now();
    let fileFound = false;
    let emptyStateDetected = false;
    let foundElementLabel = '';
    let foundElementId = '';

    const searchTargetLower = searchTerm.toLowerCase();
    const cleanTargetLower = cleanBasename.toLowerCase();

    while (Date.now() - searchStart < 12000) {
      await new Promise(r => setTimeout(r, 600));

      const itemSelectors = [
        '[role="option"].picker-grid-item',
        '.picker-grid-item-title',
        '.picker-grid-item-text',
        '.picker-dataview-row',
        '[role="option"]'
      ];

      for (const sel of itemSelectors) {
        const els = queryAllDocs(sel);
        for (const el of els) {
          if (el === searchInput || el === searchBtn) continue;
          const label = (el.getAttribute('aria-label') || el.textContent || '').trim();
          const labelLower = label.toLowerCase();

          if (cleanTargetLower && (labelLower.includes(cleanTargetLower) || labelLower.includes(searchTargetLower))) {
            fileFound = true;
            foundElementLabel = label;
            foundElementId = el.id || (el.parentElement ? el.parentElement.id : '');
            break;
          }
        }
        if (fileFound) break;
      }

      if (fileFound) break;

      // Check empty state
      const emptyNodes = queryAllDocs('.mQY6Zc, .picker-empty-message');
      let bodyText = document.body ? document.body.innerText : '';
      const iframes = Array.from(document.querySelectorAll('iframe'));
      for (const frame of iframes) {
        try {
          const fdoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
          if (fdoc && fdoc.body) bodyText += ' ' + fdoc.body.innerText;
        } catch {}
      }
      
      if (emptyNodes.length > 0 || bodyText.includes('No matching items found') || bodyText.includes('No matching results') || bodyText.includes('Try another search')) {
        emptyStateDetected = true;
        break;
      }
    }

    if (fileFound) {
      console.log(`[Extension Action: searchDriveFile] ✅ File FOUND in Drive search results: "${foundElementLabel}" (ID: ${foundElementId})`);
    } else {
      console.warn(`[Extension Action: searchDriveFile] ⚠️ File NOT FOUND in Drive search results (Empty state: ${emptyStateDetected}).`);
    }

    return {
      success: true,
      action: 'searchDriveFile',
      query: queryToType,
      fullFileName: searchTerm,
      fileFound: fileFound,
      emptyState: emptyStateDetected,
      foundElementLabel: foundElementLabel,
      foundElementId: foundElementId,
      timestamp: Date.now()
    };
  };
})();
