/**
 * AI Studio Extension Action: openDrivePicker
 * Opens the Add Media (+) menu in Google AI Studio, selects the "Drive" option,
 * and STRICTLY waits until the Google Drive Picker modal iframe is open in the DOM and ready.
 */
(function () {
  window.AIStudioActions = window.AIStudioActions || {};

  window.AIStudioActions.openDrivePicker = async function openDrivePicker(dummyText, options = {}) {
    const timeout = (typeof options === 'object' && options.timeout) ? options.timeout : 30000;
    const startTime = Date.now();
    console.log(`[Extension Action: openDrivePicker] Starting Drive Picker modal open sequence...`);

    const addMediaSelectors = [
      '[data-test-id="add-media-button"]',
      'button[aria-label*="add" i]',
      'button[aria-label*="insert" i]',
      'button[aria-label*="media" i]',
      'button[aria-label*="file" i]'
    ];

    function findAddMediaButton() {
      for (const sel of addMediaSelectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return el;
      }
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const b of buttons) {
        const label = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
        if ((label.includes('add') || label.includes('insert') || label.includes('media')) && b.offsetWidth > 0) {
          return b;
        }
      }
      return null;
    }

    let addBtn = findAddMediaButton();
    while (!addBtn && (Date.now() - startTime < timeout)) {
      await new Promise(r => setTimeout(r, 400));
      addBtn = findAddMediaButton();
    }

    if (!addBtn) {
      throw new Error(`[Extension Action: openDrivePicker] Failed to locate Add Media (+) button within ${timeout}ms`);
    }

    // Single clean click on Add Media (+)
    const targetBtn = addBtn.closest('button, [role="button"]') || addBtn;
    targetBtn.click();

    // Step 2: Wait for Drive menu item
    await new Promise(r => setTimeout(r, 600));

    function findDriveMenuItem() {
      const allMenuItems = Array.from(document.querySelectorAll('button, [role="menuitem"], mat-option, .mat-mdc-menu-item, a, span, div'));
      for (const item of allMenuItems) {
        const text = (item.textContent || '').trim();
        if (text === 'Drive' || text.includes('Google Drive')) {
          const clickable = item.closest('button, [role="menuitem"], mat-option, .mat-mdc-menu-item, a') || item;
          if (clickable.offsetWidth > 0 && clickable.offsetHeight > 0) {
            return clickable;
          }
        }
      }
      return null;
    }

    let driveItem = findDriveMenuItem();
    const driveWaitStart = Date.now();
    while (!driveItem && (Date.now() - driveWaitStart < 8000)) {
      await new Promise(r => setTimeout(r, 300));
      driveItem = findDriveMenuItem();
    }

    if (!driveItem) {
      throw new Error('[Extension Action: openDrivePicker] "Drive" option menu item not visible in popover menu.');
    }

    // Click Drive menu item
    driveItem.click();

    // Step 3: Strictly verify Google Drive Picker iframe appears in DOM
    const iframeWaitStart = Date.now();
    function checkDriveIframe() {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      for (const iframe of iframes) {
        const src = iframe.getAttribute('src') || '';
        const name = iframe.getAttribute('name') || '';
        if (src.includes('picker') || src.includes('docs.google.com') || name.startsWith('I0_')) {
          return iframe;
        }
      }
      return null;
    }

    let pickerIframe = checkDriveIframe();
    while (!pickerIframe && (Date.now() - iframeWaitStart < 15000)) {
      await new Promise(r => setTimeout(r, 400));
      pickerIframe = checkDriveIframe();
    }

    if (!pickerIframe) {
      throw new Error('[Extension Action: openDrivePicker] Drive Picker iframe did NOT appear in DOM within timeout.');
    }

    console.log(`[Extension Action: openDrivePicker] Drive Picker iframe found. Allowing iframe document to stabilize...`);

    // Give the Google Drive Picker iframe 2 seconds to complete document loading & extension injection
    await new Promise(r => setTimeout(r, 2000));

    console.log(`[Extension Action: openDrivePicker] ✅ Drive Picker modal sequence completed successfully!`);

    return {
      success: true,
      action: 'openDrivePicker',
      iframeFound: true,
      timestamp: Date.now()
    };
  };
})();
