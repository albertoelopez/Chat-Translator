/**
 * Storage Manager
 * Handles Chrome storage operations, API key encryption, and caching
 */

import { STORAGE_KEYS, DEFAULT_SETTINGS, DEFAULT_API_CONFIG, CACHE_SETTINGS } from '../shared/constants.js';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  arrayBufferToHex,
  generateCacheKey,
  generateSalt,
  isExpired
} from '../shared/utils.js';
import logger from '../shared/logger.js';

class StorageManager {
  constructor() {
    this.cache = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize default settings if not exists
      const settings = await this.getSettings();
      if (!settings || Object.keys(settings).length === 0) {
        await this.setSettings(DEFAULT_SETTINGS);
      }

      // Initialize default API config if not exists
      const apiConfig = await this.getAPIConfig();
      if (!apiConfig || Object.keys(apiConfig).length === 0) {
        await this.setAPIConfig(DEFAULT_API_CONFIG);
      }

      this.initialized = true;
      logger.info('StorageManager initialized');
    } catch (error) {
      logger.error('Failed to initialize StorageManager:', error);
      throw error;
    }
  }

  // Settings operations
  async getSettings() {
    try {
      if (this.cache.has(STORAGE_KEYS.SETTINGS)) {
        return this.cache.get(STORAGE_KEYS.SETTINGS);
      }

      const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      const settings = result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;

      this.cache.set(STORAGE_KEYS.SETTINGS, settings);
      return settings;
    } catch (error) {
      logger.error('Failed to get settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  async setSettings(settings) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
      this.cache.set(STORAGE_KEYS.SETTINGS, settings);

      // Broadcast settings update
      try {
        await chrome.runtime.sendMessage({
          action: 'settingsUpdated',
          settings
        });
      } catch (e) {
        // Ignore if no listeners
      }

      logger.info('Settings updated:', settings);
    } catch (error) {
      logger.error('Failed to set settings:', error);
      throw error;
    }
  }

  async updateSetting(key, value) {
    const settings = await this.getSettings();
    settings[key] = value;
    await this.setSettings(settings);
  }

  // API configuration operations
  async getAPIConfig() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.API_CONFIG);
      return result[STORAGE_KEYS.API_CONFIG] || DEFAULT_API_CONFIG;
    } catch (error) {
      logger.error('Failed to get API config:', error);
      return DEFAULT_API_CONFIG;
    }
  }

  async setAPIConfig(config) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.API_CONFIG]: config });
      logger.info('API config updated');
    } catch (error) {
      logger.error('Failed to set API config:', error);
      throw error;
    }
  }

  // API Key encryption/decryption
  async getAPIKey() {
    try {
      const config = await this.getAPIConfig();

      if (!config.googleTranslateKey || !config.googleTranslateKey.encrypted) {
        return null;
      }

      // Decrypt API key
      const decrypted = await this.decryptAPIKey(
        config.googleTranslateKey,
        config.encryptionSalt
      );

      return decrypted;
    } catch (error) {
      logger.error('Failed to get API key:', error);
      return null;
    }
  }

  async setAPIKey(apiKey) {
    try {
      // Generate salt and encrypt
      const salt = generateSalt(16);
      const encrypted = await this.encryptAPIKey(apiKey, salt);

      const config = await this.getAPIConfig();
      config.googleTranslateKey = encrypted;
      config.encryptionSalt = salt;

      await this.setAPIConfig(config);
      logger.info('API key encrypted and stored');
    } catch (error) {
      logger.error('Failed to set API key:', error);
      throw error;
    }
  }

  async encryptAPIKey(apiKey, salt) {
    try {
      const encoder = new TextEncoder();

      // Derive encryption key from browser instance + salt
      const browserKey = await this.getBrowserInstanceKey();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(browserKey + salt),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );

      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode(salt),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      // Generate IV
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        derivedKey,
        encoder.encode(apiKey)
      );

      return {
        encrypted: arrayBufferToBase64(encrypted),
        iv: arrayBufferToBase64(iv)
      };
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw error;
    }
  }

  async decryptAPIKey(encryptedData, salt) {
    try {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      // Derive decryption key
      const browserKey = await this.getBrowserInstanceKey();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(browserKey + salt),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );

      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode(salt),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: base64ToArrayBuffer(encryptedData.iv)
        },
        derivedKey,
        base64ToArrayBuffer(encryptedData.encrypted)
      );

      return decoder.decode(decrypted);
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw error;
    }
  }

  async getBrowserInstanceKey() {
    // Use chrome.runtime.id as part of key derivation
    const instanceId = chrome.runtime.id;
    const machineId = await this.getMachineIdentifier();
    return `${instanceId}-${machineId}`;
  }

  async getMachineIdentifier() {
    // Create stable identifier from browser fingerprint
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('fingerprint', 2, 2);
      const dataURL = canvas.toDataURL();

      const encoder = new TextEncoder();
      const data = encoder.encode(dataURL);
      const hash = await crypto.subtle.digest('SHA-256', data);

      return arrayBufferToHex(hash);
    } catch (error) {
      // Fallback to random ID stored in storage
      let id = await chrome.storage.local.get('machineId');
      if (!id.machineId) {
        id.machineId = generateSalt(32);
        await chrome.storage.local.set({ machineId: id.machineId });
      }
      return id.machineId;
    }
  }

  // Translation cache operations
  async getCachedTranslation(text, fromLang, toLang) {
    try {
      const key = generateCacheKey(text, fromLang, toLang);
      const result = await chrome.storage.local.get(STORAGE_KEYS.TRANSLATION_CACHE);
      const cache = result[STORAGE_KEYS.TRANSLATION_CACHE] || {};

      const cached = cache[key];
      if (!cached) return null;

      // Check if expired
      if (isExpired(cached.timestamp, CACHE_SETTINGS.TTL_MS)) {
        return null;
      }

      logger.debug('Cache hit for:', text.substring(0, 50));
      return cached.translation;
    } catch (error) {
      logger.error('Failed to get cached translation:', error);
      return null;
    }
  }

  async setCachedTranslation(text, fromLang, toLang, translation) {
    try {
      const key = generateCacheKey(text, fromLang, toLang);
      const result = await chrome.storage.local.get(STORAGE_KEYS.TRANSLATION_CACHE);
      let cache = result[STORAGE_KEYS.TRANSLATION_CACHE] || {};

      // Add new entry
      cache[key] = {
        translation,
        timestamp: Date.now(),
        hits: (cache[key]?.hits || 0) + 1
      };

      // Implement LRU eviction if cache too large
      const cacheSize = Object.keys(cache).length;
      if (cacheSize > CACHE_SETTINGS.MAX_ENTRIES) {
        cache = this.evictOldestCacheEntries(cache, CACHE_SETTINGS.EVICTION_COUNT);
      }

      await chrome.storage.local.set({ [STORAGE_KEYS.TRANSLATION_CACHE]: cache });
      logger.debug('Translation cached');
    } catch (error) {
      logger.error('Failed to cache translation:', error);
    }
  }

  evictOldestCacheEntries(cache, count) {
    // Sort by timestamp and remove oldest entries
    const entries = Object.entries(cache);
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest 'count' entries
    const toKeep = entries.slice(count);

    return Object.fromEntries(toKeep);
  }

  async clearCache() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.TRANSLATION_CACHE]: {} });
      logger.info('Translation cache cleared');
    } catch (error) {
      logger.error('Failed to clear cache:', error);
    }
  }

  // Quota tracking
  async trackQuotaUsage(characterCount) {
    try {
      const config = await this.getAPIConfig();
      const today = new Date().toISOString().split('T')[0];

      // Reset quota if new day
      if (config.quotaResetDate !== today) {
        config.dailyQuotaUsed = 0;
        config.quotaResetDate = today;
      }

      // Update quota
      config.dailyQuotaUsed += characterCount;
      await this.setAPIConfig(config);

      return {
        used: config.dailyQuotaUsed,
        max: config.maxDailyQuota,
        percentage: (config.dailyQuotaUsed / config.maxDailyQuota) * 100
      };
    } catch (error) {
      logger.error('Failed to track quota:', error);
      return null;
    }
  }

  async getQuotaStatus() {
    try {
      const config = await this.getAPIConfig();
      const today = new Date().toISOString().split('T')[0];

      // Reset if new day
      if (config.quotaResetDate !== today) {
        return {
          used: 0,
          max: config.maxDailyQuota,
          percentage: 0
        };
      }

      return {
        used: config.dailyQuotaUsed,
        max: config.maxDailyQuota,
        percentage: (config.dailyQuotaUsed / config.maxDailyQuota) * 100
      };
    } catch (error) {
      logger.error('Failed to get quota status:', error);
      return null;
    }
  }

  // Site-specific configurations
  async getSiteConfig(url) {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SITE_CONFIGS);
      const configs = result[STORAGE_KEYS.SITE_CONFIGS] || {};
      return configs[url] || null;
    } catch (error) {
      logger.error('Failed to get site config:', error);
      return null;
    }
  }

  async setSiteConfig(url, config) {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SITE_CONFIGS);
      const configs = result[STORAGE_KEYS.SITE_CONFIGS] || {};
      configs[url] = config;
      await chrome.storage.local.set({ [STORAGE_KEYS.SITE_CONFIGS]: configs });
      logger.info('Site config updated for:', url);
    } catch (error) {
      logger.error('Failed to set site config:', error);
      throw error;
    }
  }
}

// Create singleton instance
const storageManager = new StorageManager();

export default storageManager;
