/**
 * Language Detector
 * Detects chat language using multiple strategies
 */

import { isValidLanguageCode } from '../shared/utils.js';
import translationService from './translation-service.js';
import storageManager from './storage-manager.js';
import logger from '../shared/logger.js';

class LanguageDetector {
  constructor() {
    this.confidenceThreshold = 0.8;
  }

  /**
   * Detect language using multiple strategies
   */
  async detectChatLanguage(context) {
    const strategies = [
      () => this.detectByMessageHistory(context.messages),
      () => this.detectByPageMetadata(context.pageInfo),
      () => this.detectByURL(context.url)
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result && result.confidence >= this.confidenceThreshold) {
          logger.info('Language detected:', result);
          return result;
        }
      } catch (error) {
        logger.warn('Detection strategy failed:', error);
        continue;
      }
    }

    // No high-confidence detection, return best guess or null
    logger.warn('Could not detect language with high confidence');
    return null;
  }

  /**
   * Strategy 1: Detect by analyzing message history
   */
  async detectByMessageHistory(messages) {
    if (!messages || messages.length === 0) {
      return null;
    }

    try {
      // Take last 10-20 messages
      const recentMessages = messages.slice(-20);

      // Filter out very short messages
      const meaningfulMessages = recentMessages.filter(msg =>
        msg.text && msg.text.length > 10
      );

      if (meaningfulMessages.length === 0) {
        return null;
      }

      // Detect language for each message
      const detections = [];
      for (const msg of meaningfulMessages.slice(0, 10)) { // Limit to 10 to save API calls
        try {
          const detection = await translationService.detectLanguage(msg.text);
          detections.push(detection);
        } catch (error) {
          logger.debug('Failed to detect language for message:', error);
        }
      }

      if (detections.length === 0) {
        return null;
      }

      // Find most common language
      const languageFrequency = {};
      let totalConfidence = 0;

      detections.forEach(detection => {
        if (!languageFrequency[detection.language]) {
          languageFrequency[detection.language] = {
            count: 0,
            confidence: 0
          };
        }
        languageFrequency[detection.language].count++;
        languageFrequency[detection.language].confidence += detection.confidence;
        totalConfidence += detection.confidence;
      });

      // Get most frequent language
      let mostFrequent = null;
      let maxCount = 0;

      Object.entries(languageFrequency).forEach(([lang, data]) => {
        if (data.count > maxCount) {
          maxCount = data.count;
          mostFrequent = {
            language: lang,
            confidence: data.confidence / data.count, // Average confidence
            frequency: data.count / detections.length
          };
        }
      });

      if (!mostFrequent) {
        return null;
      }

      // Calculate final confidence based on frequency and detection confidence
      const finalConfidence = (mostFrequent.confidence + mostFrequent.frequency) / 2;

      return {
        language: mostFrequent.language,
        confidence: finalConfidence,
        method: 'messageHistory'
      };
    } catch (error) {
      logger.error('Message history detection failed:', error);
      return null;
    }
  }

  /**
   * Strategy 2: Detect by page metadata
   */
  async detectByPageMetadata(pageInfo) {
    if (!pageInfo) {
      return null;
    }

    try {
      // Check HTML lang attribute
      if (pageInfo.htmlLang && isValidLanguageCode(pageInfo.htmlLang)) {
        return {
          language: pageInfo.htmlLang,
          confidence: 0.7,
          method: 'pageMetadata'
        };
      }

      // Check meta content-language
      if (pageInfo.metaLanguage && isValidLanguageCode(pageInfo.metaLanguage)) {
        return {
          language: pageInfo.metaLanguage,
          confidence: 0.7,
          method: 'pageMetadata'
        };
      }

      return null;
    } catch (error) {
      logger.error('Page metadata detection failed:', error);
      return null;
    }
  }

  /**
   * Strategy 3: Detect by URL pattern
   */
  async detectByURL(url) {
    if (!url) {
      return null;
    }

    try {
      // Check for language codes in URL
      const patterns = [
        /[?&]lang=([a-z]{2})/i,
        /[?&]language=([a-z]{2})/i,
        /\/([a-z]{2})[-_]([A-Z]{2})\//,
        /\/([a-z]{2})\//
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1] && isValidLanguageCode(match[1])) {
          return {
            language: match[1],
            confidence: 0.6,
            method: 'urlPattern'
          };
        }
      }

      // Platform-specific detection
      const platformLang = await this.detectByPlatform(url);
      if (platformLang) {
        return platformLang;
      }

      return null;
    } catch (error) {
      logger.error('URL pattern detection failed:', error);
      return null;
    }
  }

  /**
   * Platform-specific language detection
   */
  async detectByPlatform(url) {
    const domain = new URL(url).hostname;

    // WhatsApp Web - can infer from phone number region
    if (domain.includes('whatsapp.com')) {
      // Would need phone number to detect, not always available
      return null;
    }

    // Telegram - check for language in path
    if (domain.includes('telegram.org')) {
      const match = url.match(/\?setln=([a-z]{2})/i);
      if (match && match[1]) {
        return {
          language: match[1],
          confidence: 0.75,
          method: 'platform-telegram'
        };
      }
    }

    // Messenger/Facebook - check locale
    if (domain.includes('messenger.com') || domain.includes('facebook.com')) {
      const match = url.match(/locale=([a-z]{2}_[A-Z]{2})/i);
      if (match && match[1]) {
        const lang = match[1].split('_')[0];
        return {
          language: lang,
          confidence: 0.75,
          method: 'platform-facebook'
        };
      }
    }

    return null;
  }

  /**
   * Detect language from a single text sample
   */
  async detectFromText(text) {
    try {
      const detection = await translationService.detectLanguage(text);
      return {
        language: detection.language,
        confidence: detection.confidence,
        method: 'singleText'
      };
    } catch (error) {
      logger.error('Single text detection failed:', error);
      return null;
    }
  }

  /**
   * Save detection result for site
   */
  async saveDetectionForSite(url, detection) {
    try {
      const siteConfig = await storageManager.getSiteConfig(url) || {};
      siteConfig.chatLanguage = detection.language;
      siteConfig.lastDetected = new Date().toISOString();
      siteConfig.detectionConfidence = detection.confidence;
      siteConfig.detectionMethod = detection.method;

      await storageManager.setSiteConfig(url, siteConfig);
      logger.info('Saved language detection for site:', url);
    } catch (error) {
      logger.error('Failed to save detection:', error);
    }
  }

  /**
   * Get previously detected language for site
   */
  async getSavedLanguageForSite(url) {
    try {
      const siteConfig = await storageManager.getSiteConfig(url);
      if (siteConfig && siteConfig.chatLanguage) {
        return {
          language: siteConfig.chatLanguage,
          confidence: siteConfig.detectionConfidence || 0.9,
          method: 'saved',
          savedAt: siteConfig.lastDetected
        };
      }
      return null;
    } catch (error) {
      logger.error('Failed to get saved language:', error);
      return null;
    }
  }

  /**
   * Get language with fallback to settings
   */
  async getLanguageWithFallback(url, context) {
    // Try saved first
    const saved = await this.getSavedLanguageForSite(url);
    if (saved) {
      logger.info('Using saved language:', saved.language);
      return saved;
    }

    // Try detection
    const detected = await this.detectChatLanguage(context);
    if (detected && detected.confidence >= this.confidenceThreshold) {
      // Save for future use
      await this.saveDetectionForSite(url, detected);
      return detected;
    }

    // Fallback to default from settings
    const settings = await storageManager.getSettings();
    return {
      language: settings.defaultChatLanguage || 'es',
      confidence: 0.5,
      method: 'fallback'
    };
  }
}

// Create singleton instance
const languageDetector = new LanguageDetector();

export default languageDetector;
