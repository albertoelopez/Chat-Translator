/**
 * Options Page Script
 */

// Elements
const apiKeyInput = document.getElementById('api-key');
const nativeLanguageSelect = document.getElementById('native-language');
const defaultChatLanguageSelect = document.getElementById('default-chat-language');
const autoDetectCheckbox = document.getElementById('auto-detect');
const showOriginalCheckbox = document.getElementById('show-original');
const themeSelect = document.getElementById('theme');
const saveBtn = document.getElementById('save-btn');
const testBtn = document.getElementById('test-btn');
const statusEl = document.getElementById('status');
const quotaEl = document.getElementById('quota');
const quotaFillEl = document.getElementById('quota-fill');
const quotaTextEl = document.getElementById('quota-text');

// Load settings on page load
loadSettings();
loadQuota();

// Event listeners
saveBtn.addEventListener('click', saveSettings);
testBtn.addEventListener('click', testAPIKey);

// Load settings
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getSettings'
    });

    if (response.success) {
      const settings = response.settings;

      nativeLanguageSelect.value = settings.nativeLanguage || 'en';
      defaultChatLanguageSelect.value = settings.defaultChatLanguage || 'es';
      autoDetectCheckbox.checked = settings.autoDetectChatLanguage !== false;
      showOriginalCheckbox.checked = settings.showOriginalText !== false;
      themeSelect.value = settings.theme || 'light';
    }

    // Load API key status (not the actual key for security)
    const keyResponse = await chrome.runtime.sendMessage({
      action: 'getAPIKey'
    });

    if (keyResponse.hasApiKey) {
      apiKeyInput.placeholder = '••••••••••••••••••••••••••';
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
    showStatus('Failed to load settings', 'error');
  }
}

// Save settings
async function saveSettings() {
  try {
    const settings = {
      nativeLanguage: nativeLanguageSelect.value,
      defaultChatLanguage: defaultChatLanguageSelect.value,
      autoDetectChatLanguage: autoDetectCheckbox.checked,
      showOriginalText: showOriginalCheckbox.checked,
      theme: themeSelect.value,
      enabled: true
    };

    const response = await chrome.runtime.sendMessage({
      action: 'updateSettings',
      settings
    });

    if (response.success) {
      // Save API key if provided
      if (apiKeyInput.value && apiKeyInput.value !== '••••••••••••••••••••••••••') {
        await saveAPIKey(apiKeyInput.value);
      }

      showStatus('Settings saved successfully!', 'success');
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus('Failed to save settings: ' + error.message, 'error');
  }
}

// Save API key
async function saveAPIKey(apiKey) {
  const response = await chrome.runtime.sendMessage({
    action: 'setAPIKey',
    apiKey
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to save API key');
  }
}

// Test API key
async function testAPIKey() {
  const apiKey = apiKeyInput.value;

  if (!apiKey || apiKey === '••••••••••••••••••••••••••') {
    showStatus('Please enter an API key to test', 'error');
    return;
  }

  testBtn.disabled = true;
  testBtn.textContent = 'Testing...';

  try {
    await saveAPIKey(apiKey);
    showStatus('API key is valid!', 'success');
    apiKeyInput.placeholder = '••••••••••••••••••••••••••';
    apiKeyInput.value = '';
  } catch (error) {
    showStatus('API key test failed: ' + error.message, 'error');
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = 'Test API Key';
  }
}

// Load quota information
async function loadQuota() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getQuota'
    });

    if (response.success && response.quota) {
      const { used, max, percentage } = response.quota;

      quotaEl.style.display = 'block';
      quotaFillEl.style.width = percentage + '%';
      quotaTextEl.textContent = `${used.toLocaleString()} / ${max.toLocaleString()} characters (${percentage.toFixed(1)}%)`;

      // Update styling based on usage
      quotaFillEl.classList.remove('warning', 'critical');
      if (percentage >= 90) {
        quotaFillEl.classList.add('critical');
      } else if (percentage >= 80) {
        quotaFillEl.classList.add('warning');
      }
    }
  } catch (error) {
    console.error('Failed to load quota:', error);
  }
}

// Show status message
function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = type;
  statusEl.style.display = 'block';

  if (type === 'success') {
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 5000);
  }
}

// Refresh quota every 30 seconds
setInterval(loadQuota, 30000);
