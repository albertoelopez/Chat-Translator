/**
 * Translation Service
 * Handles Google Translate API integration with caching, retry logic, and error handling
 */

import { ERROR_CODES, API_ENDPOINTS, CIRCUIT_BREAKER } from '../shared/constants.js';
import { sanitizeText, sleep, getErrorMessage } from '../shared/utils.js';
import storageManager from './storage-manager.js';
import logger from '../shared/logger.js';

class TranslationError extends Error {
  constructor(message, code, retryable = false) {
    super(message);
    this.name = 'TranslationError';
    this.code = code;
    this.retryable = retryable;
  }
}

class TranslationService {
  constructor() {
    this.maxRetries = CIRCUIT_BREAKER.RETRY_ATTEMPTS;
    this.retryDelay = CIRCUIT_BREAKER.RETRY_DELAY_MS;
    this.circuitBreakerThreshold = CIRCUIT_BREAKER.THRESHOLD;
    this.circuitBreakerTimeout = CIRCUIT_BREAKER.TIMEOUT_MS;
    this.failureCount = 0;
    this.circuitOpen = false;
  }

  /**
   * Translate text from one language to another
   */
  async translate(text, fromLang, toLang) {
    // Circuit breaker check
    if (this.circuitOpen) {
      throw new TranslationError(
        'Service temporarily unavailable',
        ERROR_CODES.RATE_LIMIT,
        true
      );
    }

    try {
      // Sanitize input
      const cleanText = sanitizeText(text);
      if (!cleanText) {
        throw new TranslationError(
          'Empty text provided',
          ERROR_CODES.TRANSLATION_FAILED,
          false
        );
      }

      // Check cache first
      const cached = await storageManager.getCachedTranslation(
        cleanText,
        fromLang,
        toLang
      );
      if (cached) {
        logger.debug('Using cached translation');
        return {
          translatedText: cached,
          fromCache: true
        };
      }

      // Get API key
      const apiKey = await storageManager.getAPIKey();
      if (!apiKey) {
        throw new TranslationError(
          'API key not configured',
          ERROR_CODES.API_KEY_MISSING,
          false
        );
      }

      // Check quota before making request
      const quotaStatus = await storageManager.getQuotaStatus();
      if (quotaStatus && quotaStatus.used >= quotaStatus.max) {
        throw new TranslationError(
          'Daily quota exceeded',
          ERROR_CODES.QUOTA_EXCEEDED,
          false
        );
      }

      // Make API call with retry
      const translation = await this.translateWithRetry(
        cleanText,
        fromLang,
        toLang,
        apiKey
      );

      // Cache result
      await storageManager.setCachedTranslation(
        cleanText,
        fromLang,
        toLang,
        translation
      );

      // Track quota usage
      await storageManager.trackQuotaUsage(cleanText.length);

      // Reset failure count on success
      this.failureCount = 0;

      return {
        translatedText: translation,
        fromCache: false
      };
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text) {
    try {
      const cleanText = sanitizeText(text);
      if (!cleanText) {
        throw new TranslationError(
          'Empty text provided',
          ERROR_CODES.DETECTION_FAILED,
          false
        );
      }

      const apiKey = await storageManager.getAPIKey();
      if (!apiKey) {
        throw new TranslationError(
          'API key not configured',
          ERROR_CODES.API_KEY_MISSING,
          false
        );
      }

      const response = await fetch(API_ENDPOINTS.DETECT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: cleanText,
          key: apiKey
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw this.handleAPIError(response.status, errorData);
      }

      const data = await response.json();
      const detection = data.data.detections[0][0];

      return {
        language: detection.language,
        confidence: detection.confidence
      };
    } catch (error) {
      logger.error('Language detection failed:', error);
      throw error;
    }
  }

  /**
   * Translate with retry logic
   */
  async translateWithRetry(text, fromLang, toLang, apiKey, attempt = 1) {
    try {
      logger.debug(`Translation attempt ${attempt}/${this.maxRetries}`);

      const response = await fetch(API_ENDPOINTS.TRANSLATE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: text,
          source: fromLang,
          target: toLang,
          key: apiKey,
          format: 'text'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw this.handleAPIError(response.status, errorData);
      }

      const data = await response.json();

      if (!data.data || !data.data.translations || !data.data.translations[0]) {
        throw new TranslationError(
          'Invalid API response',
          ERROR_CODES.TRANSLATION_FAILED,
          true
        );
      }

      return data.data.translations[0].translatedText;
    } catch (error) {
      // Retry if error is retryable and attempts remain
      if (error.retryable && attempt < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        logger.warn(`Retrying in ${delay}ms...`);
        await sleep(delay);
        return this.translateWithRetry(text, fromLang, toLang, apiKey, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Handle API errors
   */
  handleAPIError(status, errorData) {
    const errorMessage = errorData?.error?.message || 'Unknown error';

    switch (status) {
      case 400:
        return new TranslationError(
          `Invalid request: ${errorMessage}`,
          ERROR_CODES.INVALID_LANGUAGE,
          false
        );

      case 401:
      case 403:
        return new TranslationError(
          'Invalid API key',
          ERROR_CODES.API_KEY_INVALID,
          false
        );

      case 429:
        return new TranslationError(
          'Rate limit exceeded',
          ERROR_CODES.RATE_LIMIT,
          true
        );

      case 500:
      case 502:
      case 503:
      case 504:
        return new TranslationError(
          'Google Translate service error',
          ERROR_CODES.NETWORK_ERROR,
          true
        );

      default:
        return new TranslationError(
          errorMessage,
          ERROR_CODES.TRANSLATION_FAILED,
          false
        );
    }
  }

  /**
   * Handle errors and implement circuit breaker
   */
  handleError(error) {
    this.failureCount++;

    // Circuit breaker
    if (this.failureCount >= this.circuitBreakerThreshold) {
      this.circuitOpen = true;
      logger.warn('Circuit breaker opened due to consecutive failures');

      setTimeout(() => {
        this.circuitOpen = false;
        this.failureCount = 0;
        logger.info('Circuit breaker closed');
      }, this.circuitBreakerTimeout);
    }

    // Log error
    logger.error('Translation error:', error.message);
  }

  /**
   * Get user-friendly error notification
   */
  getNotification(error) {
    return {
      message: getErrorMessage(error.code),
      code: error.code,
      retryable: error.retryable
    };
  }

  /**
   * Batch translate multiple texts
   */
  async batchTranslate(texts, fromLang, toLang) {
    const results = [];

    for (const text of texts) {
      try {
        const result = await this.translate(text, fromLang, toLang);
        results.push({
          original: text,
          translated: result.translatedText,
          success: true
        });
      } catch (error) {
        results.push({
          original: text,
          translated: text, // Fallback to original
          success: false,
          error: error.code
        });
      }
    }

    return results;
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      circuitOpen: this.circuitOpen,
      failureCount: this.failureCount
    };
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.circuitOpen = false;
    this.failureCount = 0;
    logger.info('Translation service reset');
  }
}

// Create singleton instance
const translationService = new TranslationService();

export { TranslationError };
export default translationService;
