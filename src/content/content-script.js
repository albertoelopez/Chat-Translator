/**
 * Content Script
 * Coordinates chat detection, message interception, and overlay injection
 */

import { MESSAGE_TYPES } from '../shared/constants.js';
import { detectPlatformFromURL, debounce } from '../shared/utils.js';
import GenericChatAdapter from './platform-adapters/generic-adapter.js';
import logger from '../shared/logger.js';

class ContentScript {
  constructor() {
    this.adapter = null;
    this.observer = null;
    this.overlayIframe = null;
    this.chatLanguage = null;
    this.nativeLanguage = null;
    this.enabled = false;
    this.settings = null;
  }

  /**
   * Initialize content script
   */
  async initialize() {
    try {
      logger.info('Content script initializing...');

      // Load settings
      await this.loadSettings();

      // Check if enabled
      if (!this.enabled) {
        logger.info('Extension disabled, skipping initialization');
        return;
      }

      // Detect platform and create adapter
      this.createAdapter();

      // Detect chat language
      await this.detectChatLanguage();

      // Inject overlay
      this.injectOverlay();

      // Start observing messages
      this.startObservingMessages();

      // Listen for messages from background and overlay
      this.setupMessageListeners();

      logger.info('Content script initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize content script:', error);
    }
  }

  /**
   * Load settings from background
   */
  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: MESSAGE_TYPES.GET_SETTINGS
      });

      if (response.success) {
        this.settings = response.settings;
        this.enabled = this.settings.enabled !== false;
        this.nativeLanguage = this.settings.nativeLanguage || 'en';
        logger.info('Settings loaded:', this.settings);
      }
    } catch (error) {
      logger.error('Failed to load settings:', error);
      this.enabled = false;
    }
  }

  /**
   * Create chat adapter based on platform
   */
  createAdapter() {
    const platform = detectPlatformFromURL(window.location.href);
    logger.info('Detected platform:', platform);

    // For now, always use generic adapter
    // In the future, can add platform-specific adapters here
    this.adapter = new GenericChatAdapter();
  }

  /**
   * Detect chat language
   */
  async detectChatLanguage() {
    try {
      // Get page info
      const pageInfo = {
        htmlLang: document.documentElement.lang,
        metaLanguage: document.querySelector('meta[http-equiv="content-language"]')?.content
      };

      // Get recent messages for context
      const messages = this.adapter.getAllMessages();

      const response = await chrome.runtime.sendMessage({
        action: MESSAGE_TYPES.DETECT_LANGUAGE,
        url: window.location.href,
        context: {
          messages: messages.slice(-20),
          pageInfo
        }
      });

      if (response.success) {
        this.chatLanguage = response.language;
        logger.info('Chat language detected:', this.chatLanguage, 'confidence:', response.confidence);

        // Notify overlay of detected language
        this.sendMessageToOverlay({
          action: 'languageDetected',
          language: this.chatLanguage,
          confidence: response.confidence
        });
      }
    } catch (error) {
      logger.error('Failed to detect language:', error);
      // Use default from settings
      this.chatLanguage = this.settings.defaultChatLanguage || 'es';
    }
  }

  /**
   * Inject overlay iframe
   */
  injectOverlay() {
    // Check if already injected
    if (document.getElementById('respond-in-language-overlay')) {
      return;
    }

    // Ensure overlay position and size have defaults
    const overlayPosition = this.settings.overlayPosition || { x: 100, y: 100 };
    const overlaySize = this.settings.overlaySize || { width: 400, height: 300 };

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'respond-in-language-overlay';
    iframe.src = chrome.runtime.getURL('overlay/overlay.html');

    // Style iframe
    iframe.style.cssText = `
      position: fixed;
      top: ${overlayPosition.y}px;
      left: ${overlayPosition.x}px;
      width: ${overlaySize.width}px;
      height: ${overlaySize.height}px;
      border: none;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border-radius: 8px;
      display: none;
    `;

    document.body.appendChild(iframe);
    this.overlayIframe = iframe;

    logger.info('Overlay injected');

    // Listen for overlay ready
    window.addEventListener('message', (event) => {
      if (event.data.action === 'overlayReady') {
        this.onOverlayReady();
      }
    });

    // Show overlay with keyboard shortcut (Alt+T)
    document.addEventListener('keydown', (event) => {
      if (event.altKey && event.key === 't') {
        this.toggleOverlay();
      }
    });
  }

  /**
   * Handle overlay ready
   */
  onOverlayReady() {
    logger.info('Overlay ready');

    // Send initial configuration
    this.sendMessageToOverlay({
      action: 'configure',
      nativeLanguage: this.nativeLanguage,
      chatLanguage: this.chatLanguage,
      settings: this.settings
    });
  }

  /**
   * Toggle overlay visibility
   */
  toggleOverlay() {
    if (!this.overlayIframe) {
      return;
    }

    if (this.overlayIframe.style.display === 'none') {
      this.overlayIframe.style.display = 'block';
      this.sendMessageToOverlay({ action: 'focus' });
    } else {
      this.overlayIframe.style.display = 'none';
    }
  }

  /**
   * Send message to overlay iframe
   */
  sendMessageToOverlay(message) {
    if (!this.overlayIframe || !this.overlayIframe.contentWindow) {
      return;
    }

    this.overlayIframe.contentWindow.postMessage(message, '*');
  }

  /**
   * Start observing new messages
   */
  startObservingMessages() {
    if (this.observer) {
      this.observer.disconnect();
    }

    // Debounce translation to avoid rapid-fire API calls
    const debouncedTranslate = debounce((messageData) => {
      this.handleNewMessage(messageData);
    }, 500);

    this.observer = this.adapter.observeNewMessages((messageData) => {
      // Ignore own messages
      if (messageData.isOwnMessage) {
        return;
      }

      debouncedTranslate(messageData);
    });

    logger.info('Message observation started');
  }

  /**
   * Handle new incoming message
   */
  async handleNewMessage(messageData) {
    try {
      logger.debug('New message received:', messageData.text.substring(0, 50));

      // Translate if not in native language
      if (this.chatLanguage !== this.nativeLanguage) {
        const response = await chrome.runtime.sendMessage({
          action: MESSAGE_TYPES.TRANSLATE_INCOMING,
          text: messageData.text,
          fromLang: this.chatLanguage,
          toLang: this.nativeLanguage,
          messageId: messageData.id
        });

        if (response.success) {
          // Show translation in overlay or inline
          this.displayTranslation(messageData, response.translatedText);
        }
      }
    } catch (error) {
      logger.error('Failed to handle new message:', error);
    }
  }

  /**
   * Display translation
   */
  displayTranslation(messageData, translatedText) {
    // For now, send to overlay
    this.sendMessageToOverlay({
      action: 'incomingTranslation',
      original: messageData.text,
      translated: translatedText,
      sender: messageData.sender,
      timestamp: messageData.timestamp
    });

    // TODO: Could also modify DOM to show inline
  }

  /**
   * Setup message listeners
   */
  setupMessageListeners() {
    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message)
        .then(sendResponse)
        .catch(error => {
          logger.error('Error handling message:', error);
          sendResponse({ success: false, error: error.message });
        });

      return true; // Async response
    });

    // Listen for messages from overlay
    window.addEventListener('message', (event) => {
      // Only accept messages from our overlay
      if (event.source !== this.overlayIframe?.contentWindow) {
        return;
      }

      this.handleOverlayMessage(event.data);
    });
  }

  /**
   * Handle messages from background
   */
  async handleBackgroundMessage(message) {
    const { action } = message;

    switch (action) {
      case MESSAGE_TYPES.SETTINGS_UPDATED:
        await this.handleSettingsUpdated(message.settings);
        return { success: true };

      case MESSAGE_TYPES.TOGGLE_OVERLAY:
        this.toggleOverlay();
        return { success: true };

      case MESSAGE_TYPES.SHOW_ERROR:
        this.showError(message);
        return { success: true };

      default:
        logger.warn('Unknown message from background:', action);
        return { success: false };
    }
  }

  /**
   * Handle messages from overlay
   */
  async handleOverlayMessage(message) {
    const { action } = message;

    switch (action) {
      case 'sendMessage':
        await this.handleSendMessage(message.text);
        break;

      case 'updatePosition':
        await this.handleUpdatePosition(message.position);
        break;

      case 'close':
        this.toggleOverlay();
        break;

      default:
        logger.warn('Unknown message from overlay:', action);
    }
  }

  /**
   * Handle send message from overlay
   */
  async handleSendMessage(text) {
    try {
      logger.info('Sending message:', text.substring(0, 50));

      // Translate from native to chat language
      const response = await chrome.runtime.sendMessage({
        action: MESSAGE_TYPES.TRANSLATE_OUTGOING,
        text,
        fromLang: this.nativeLanguage,
        toLang: this.chatLanguage
      });

      if (response.success) {
        // Insert translated text and send
        this.adapter.insertText(response.translatedText);

        // Small delay to ensure text is set
        await new Promise(resolve => setTimeout(resolve, 100));

        this.adapter.triggerSend();

        // Notify overlay of success
        this.sendMessageToOverlay({
          action: 'messageSent',
          success: true
        });

        // Clear overlay input
        this.sendMessageToOverlay({
          action: 'clearInput'
        });
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      logger.error('Failed to send message:', error);

      // Notify overlay of failure
      this.sendMessageToOverlay({
        action: 'messageSent',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle update position
   */
  async handleUpdatePosition(position) {
    if (this.overlayIframe) {
      this.overlayIframe.style.top = position.y + 'px';
      this.overlayIframe.style.left = position.x + 'px';

      // Save position to settings
      const settings = { ...this.settings };
      settings.overlayPosition = position;

      await chrome.runtime.sendMessage({
        action: MESSAGE_TYPES.UPDATE_SETTINGS,
        settings
      });
    }
  }

  /**
   * Handle settings updated
   */
  async handleSettingsUpdated(settings) {
    this.settings = settings;
    this.enabled = settings.enabled !== false;
    this.nativeLanguage = settings.nativeLanguage;

    // Update overlay configuration
    this.sendMessageToOverlay({
      action: 'configure',
      nativeLanguage: this.nativeLanguage,
      chatLanguage: this.chatLanguage,
      settings: this.settings
    });

    logger.info('Settings updated in content script');
  }

  /**
   * Show error
   */
  showError(message) {
    this.sendMessageToOverlay({
      action: 'showError',
      message: message.message,
      code: message.code
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const contentScript = new ContentScript();
    contentScript.initialize();
  });
} else {
  const contentScript = new ContentScript();
  contentScript.initialize();
}

logger.info('Content script loaded');
