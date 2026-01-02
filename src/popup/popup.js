/**
 * Popup Script
 */

// Elements
const enabledToggle = document.getElementById('enabled-toggle');
const nativeLangEl = document.getElementById('native-lang');
const chatLangEl = document.getElementById('chat-lang');
const settingsBtn = document.getElementById('settings-btn');
const clearCacheBtn = document.getElementById('clear-cache-btn');

// Load current settings
loadSettings();

// Event listeners
enabledToggle.addEventListener('change', handleToggle);
settingsBtn.addEventListener('click', openSettings);
clearCacheBtn.addEventListener('click', clearCache);

// Load settings
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getSettings'
    });

    if (response.success) {
      const settings = response.settings;
      enabledToggle.checked = settings.enabled !== false;
      nativeLangEl.textContent = (settings.nativeLanguage || 'en').toUpperCase();
      chatLangEl.textContent = (settings.defaultChatLanguage || 'es').toUpperCase();
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

// Handle toggle
async function handleToggle() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getSettings'
    });

    if (response.success) {
      const settings = response.settings;
      settings.enabled = enabledToggle.checked;

      await chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings
      });
    }
  } catch (error) {
    console.error('Failed to toggle:', error);
    enabledToggle.checked = !enabledToggle.checked;
  }
}

// Open settings page
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// Clear cache
async function clearCache() {
  clearCacheBtn.disabled = true;
  clearCacheBtn.textContent = 'Clearing...';

  try {
    // Clear translation cache from storage
    await chrome.storage.local.set({ translationCache: {} });
    clearCacheBtn.textContent = 'Cleared!';

    setTimeout(() => {
      clearCacheBtn.textContent = 'Clear Cache';
      clearCacheBtn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to clear cache:', error);
    clearCacheBtn.textContent = 'Failed';
    clearCacheBtn.disabled = false;
  }
}
