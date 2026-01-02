/**
 * Background Service Worker
 * Central message routing hub for the extension
 */

import { MESSAGE_TYPES, ERROR_CODES } from '../shared/constants.js';
import { getErrorMessage } from '../shared/utils.js';
import storageManager from './storage-manager.js';
import translationService from './translation-service.js';
import languageDetector from './language-detector.js';
import logger from '../shared/logger.js';

// Initialize storage manager on install
chrome.runtime.onInstalled.addListener(async () => {
  logger.info('Extension installed/updated');
  await storageManager.initialize();
});

// Handle messages from content scripts, popup, and options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => {
      logger.error('Message handling error:', error);
      sendResponse({
        success: false,
        error: error.message,
        code: error.code || ERROR_CODES.TRANSLATION_FAILED
      });
    });

  // Return true to indicate async response
  return true;
});

/**
 * Main message handler
 */
async function handleMessage(message, sender) {
  const { action } = message;

  logger.debug('Received message:', action);

  switch (action) {
    case MESSAGE_TYPES.TRANSLATE_OUTGOING:
      return await handleTranslateOutgoing(message);

    case MESSAGE_TYPES.TRANSLATE_INCOMING:
      return await handleTranslateIncoming(message);

    case MESSAGE_TYPES.DETECT_LANGUAGE:
      return await handleDetectLanguage(message);

    case MESSAGE_TYPES.GET_SETTINGS:
      return await handleGetSettings();

    case MESSAGE_TYPES.UPDATE_SETTINGS:
      return await handleUpdateSettings(message);

    case MESSAGE_TYPES.GET_API_KEY:
      return await handleGetAPIKey();

    case MESSAGE_TYPES.SET_API_KEY:
      return await handleSetAPIKey(message);

    case MESSAGE_TYPES.GET_QUOTA:
      return await handleGetQuota();

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Handle outgoing message translation (native -> chat language)
 */
async function handleTranslateOutgoing(message) {
  const { text, fromLang, toLang } = message;

  try {
    const result = await translationService.translate(text, fromLang, toLang);

    return {
      success: true,
      translatedText: result.translatedText,
      originalText: text,
      fromCache: result.fromCache
    };
  } catch (error) {
    logger.error('Outgoing translation failed:', error);

    // Send error notification to user
    await notifyError(error);

    return {
      success: false,
      translatedText: text, // Fallback to original
      originalText: text,
      error: error.message,
      code: error.code
    };
  }
}

/**
 * Handle incoming message translation (chat language -> native)
 */
async function handleTranslateIncoming(message) {
  const { text, fromLang, toLang, messageId } = message;

  try {
    const result = await translationService.translate(text, fromLang, toLang);

    return {
      success: true,
      translatedText: result.translatedText,
      originalText: text,
      messageId,
      fromCache: result.fromCache
    };
  } catch (error) {
    logger.error('Incoming translation failed:', error);

    return {
      success: false,
      translatedText: text, // Fallback to original
      originalText: text,
      messageId,
      error: error.message,
      code: error.code
    };
  }
}

/**
 * Handle language detection
 */
async function handleDetectLanguage(message) {
  const { url, context } = message;

  try {
    const detection = await languageDetector.getLanguageWithFallback(url, context);

    return {
      success: true,
      language: detection.language,
      confidence: detection.confidence,
      method: detection.method
    };
  } catch (error) {
    logger.error('Language detection failed:', error);

    // Fallback to default from settings
    const settings = await storageManager.getSettings();

    return {
      success: false,
      language: settings.defaultChatLanguage || 'es',
      confidence: 0.5,
      method: 'fallback',
      error: error.message
    };
  }
}

/**
 * Handle get settings
 */
async function handleGetSettings() {
  try {
    const settings = await storageManager.getSettings();

    return {
      success: true,
      settings
    };
  } catch (error) {
    logger.error('Failed to get settings:', error);
    throw error;
  }
}

/**
 * Handle update settings
 */
async function handleUpdateSettings(message) {
  const { settings } = message;

  try {
    await storageManager.setSettings(settings);

    return {
      success: true
    };
  } catch (error) {
    logger.error('Failed to update settings:', error);
    throw error;
  }
}

/**
 * Handle get API key
 */
async function handleGetAPIKey() {
  try {
    const apiKey = await storageManager.getAPIKey();

    return {
      success: true,
      hasApiKey: !!apiKey
    };
  } catch (error) {
    logger.error('Failed to get API key:', error);
    throw error;
  }
}

/**
 * Handle set API key
 */
async function handleSetAPIKey(message) {
  const { apiKey } = message;

  try {
    await storageManager.setAPIKey(apiKey);

    // Test API key with a simple translation
    await translationService.translate('Hello', 'en', 'es');

    return {
      success: true
    };
  } catch (error) {
    logger.error('Failed to set API key:', error);

    if (error.code === ERROR_CODES.API_KEY_INVALID) {
      return {
        success: false,
        error: 'Invalid API key. Please check and try again.',
        code: error.code
      };
    }

    throw error;
  }
}

/**
 * Handle get quota status
 */
async function handleGetQuota() {
  try {
    const quotaStatus = await storageManager.getQuotaStatus();

    return {
      success: true,
      quota: quotaStatus
    };
  } catch (error) {
    logger.error('Failed to get quota:', error);
    throw error;
  }
}

/**
 * Send error notification to active tab
 */
async function notifyError(error) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      await chrome.tabs.sendMessage(tabs[0].id, {
        action: MESSAGE_TYPES.SHOW_ERROR,
        message: getErrorMessage(error.code),
        code: error.code,
        retryable: error.retryable
      });
    }
  } catch (e) {
    // Ignore if content script not ready
    logger.debug('Could not send error notification to tab');
  }
}

/**
 * Broadcast message to all tabs
 */
async function broadcastToAllTabs(message) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, message);
      } catch (e) {
        // Ignore tabs without content script
      }
    }
  } catch (error) {
    logger.error('Failed to broadcast message:', error);
  }
}

/**
 * Handle settings changes
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.settings) {
    logger.info('Settings changed, broadcasting update');
    broadcastToAllTabs({
      action: MESSAGE_TYPES.SETTINGS_UPDATED,
      settings: changes.settings.newValue
    });
  }
});

logger.info('Service worker initialized');
