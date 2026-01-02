// Error codes
export const ERROR_CODES = {
  API_KEY_MISSING: 'API_KEY_MISSING',
  API_KEY_INVALID: 'API_KEY_INVALID',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  INVALID_LANGUAGE: 'INVALID_LANGUAGE',
  TRANSLATION_FAILED: 'TRANSLATION_FAILED',
  DOM_INJECTION_FAILED: 'DOM_INJECTION_FAILED',
  DETECTION_FAILED: 'DETECTION_FAILED'
};

// Storage keys
export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  API_CONFIG: 'api',
  SITE_CONFIGS: 'siteConfigs',
  TRANSLATION_CACHE: 'translationCache',
  DETECTION_HISTORY: 'detectionHistory'
};

// Default settings
export const DEFAULT_SETTINGS = {
  nativeLanguage: 'en',
  autoDetectChatLanguage: true,
  defaultChatLanguage: 'es',
  showOriginalText: true,
  enableSoundNotification: false,
  overlayPosition: { x: 100, y: 100 },
  overlaySize: { width: 400, height: 300 },
  theme: 'light',
  enabled: true
};

// Default API configuration
export const DEFAULT_API_CONFIG = {
  googleTranslateKey: '',
  encryptionSalt: '',
  dailyQuotaUsed: 0,
  quotaResetDate: new Date().toISOString().split('T')[0],
  maxDailyQuota: 500000
};

// Translation cache settings
export const CACHE_SETTINGS = {
  MAX_ENTRIES: 1000,
  TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
  EVICTION_COUNT: 200 // Evict 200 oldest when max reached
};

// Circuit breaker settings
export const CIRCUIT_BREAKER = {
  THRESHOLD: 5, // failures before opening
  TIMEOUT_MS: 60000, // 1 minute
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000
};

// Message types
export const MESSAGE_TYPES = {
  TRANSLATE_OUTGOING: 'translateOutgoing',
  TRANSLATE_INCOMING: 'translateIncoming',
  DETECT_LANGUAGE: 'detectLanguage',
  UPDATE_SETTINGS: 'updateSettings',
  GET_SETTINGS: 'getSettings',
  GET_API_KEY: 'getAPIKey',
  SET_API_KEY: 'setAPIKey',
  SHOW_ERROR: 'showError',
  SHOW_SUCCESS: 'showSuccess',
  INSERT_MESSAGE: 'insertMessage',
  SETTINGS_UPDATED: 'settingsUpdated',
  TOGGLE_OVERLAY: 'toggleOverlay',
  GET_QUOTA: 'getQuota'
};

// Supported platforms (for specific adapters)
export const PLATFORMS = {
  WHATSAPP: 'whatsapp',
  MESSENGER: 'messenger',
  TELEGRAM: 'telegram',
  SLACK: 'slack',
  GENERIC: 'generic'
};

// API endpoints
export const API_ENDPOINTS = {
  TRANSLATE: 'https://translation.googleapis.com/language/translate/v2',
  DETECT: 'https://translation.googleapis.com/language/translate/v2/detect'
};

// Input constraints
export const INPUT_CONSTRAINTS = {
  MAX_LENGTH: 5000,
  DEBOUNCE_MS: 500
};

// Language codes (commonly used)
export const LANGUAGE_CODES = {
  ENGLISH: 'en',
  SPANISH: 'es',
  FRENCH: 'fr',
  GERMAN: 'de',
  ITALIAN: 'it',
  PORTUGUESE: 'pt',
  RUSSIAN: 'ru',
  JAPANESE: 'ja',
  KOREAN: 'ko',
  CHINESE_SIMPLIFIED: 'zh-CN',
  CHINESE_TRADITIONAL: 'zh-TW',
  ARABIC: 'ar',
  HINDI: 'hi'
};
