/**
 * Content Script Loader
 * Wrapper to load ES6 module content script
 */

(async () => {
  try {
    // Dynamically import the ES6 module
    await import(chrome.runtime.getURL('content/content-script.js'));
  } catch (error) {
    console.error('[RespondInLanguage] Failed to load content script:', error);
  }
})();
