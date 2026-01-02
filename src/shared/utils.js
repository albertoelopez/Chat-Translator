/**
 * Utility functions for the extension
 */

// Hash function for cache keys
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

// Generate translation cache key
export function generateCacheKey(text, fromLang, toLang) {
  return hashString(`${text}|${fromLang}|${toLang}`);
}

// ArrayBuffer to Base64
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ArrayBuffer to Hex
export function arrayBufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Validate API key format
export function validateAPIKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  // Google Cloud API keys format: AIza[0-9A-Za-z-_]{35}
  const pattern = /^AIza[0-9A-Za-z\-_]{35}$/;
  return pattern.test(apiKey);
}

// Sanitize text input (service worker compatible - no DOM access)
export function sanitizeText(text, maxLength = 5000) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove HTML tags using regex
  let sanitized = text.replace(/<[^>]*>/g, '');

  // Decode common HTML entities
  sanitized = sanitized
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Trim and limit length
  return sanitized.trim().substring(0, maxLength);
}

// Debounce function
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Sleep/delay function
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get current timestamp
export function getCurrentTimestamp() {
  return Date.now();
}

// Check if timestamp is expired
export function isExpired(timestamp, ttl) {
  return (Date.now() - timestamp) > ttl;
}

// Get domain from URL
export function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return '';
  }
}

// Detect platform from URL
export function detectPlatformFromURL(url) {
  const domain = getDomain(url);

  if (domain.includes('whatsapp.com')) {
    return 'whatsapp';
  } else if (domain.includes('messenger.com') || domain.includes('facebook.com')) {
    return 'messenger';
  } else if (domain.includes('telegram.org') || domain.includes('web.telegram.org')) {
    return 'telegram';
  } else if (domain.includes('slack.com')) {
    return 'slack';
  }

  return 'generic';
}

// Generate unique ID
export function generateUniqueId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Deep clone object
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Merge objects
export function mergeObjects(target, source) {
  return { ...target, ...source };
}

// Get user-friendly error message
export function getErrorMessage(errorCode) {
  const messages = {
    'API_KEY_MISSING': 'Please configure your Google Translate API key in settings.',
    'API_KEY_INVALID': 'Your API key is invalid. Please check your settings.',
    'QUOTA_EXCEEDED': 'Daily translation quota exceeded. Resets tomorrow.',
    'NETWORK_ERROR': 'Network error. Please check your connection and try again.',
    'RATE_LIMIT': 'Too many requests. Please wait a moment and try again.',
    'INVALID_LANGUAGE': 'Invalid language detected. Please select languages manually.',
    'TRANSLATION_FAILED': 'Translation failed. Please try again.',
    'DOM_INJECTION_FAILED': 'Could not insert message. This chat platform may not be supported.',
    'DETECTION_FAILED': 'Language detection failed. Please set chat language manually.'
  };

  return messages[errorCode] || 'An error occurred. Please try again.';
}

// Format quota display
export function formatQuota(used, max) {
  const percentage = (used / max * 100).toFixed(1);
  const usedFormatted = formatNumber(used);
  const maxFormatted = formatNumber(max);

  return {
    percentage,
    display: `${usedFormatted} / ${maxFormatted} characters`,
    isWarning: percentage >= 80,
    isCritical: percentage >= 90
  };
}

// Format number with commas
export function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Check if element is visible
export function isElementVisible(element) {
  if (!element) return false;

  const style = window.getComputedStyle(element);
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0';
}

// Get element text content
export function getTextContent(element) {
  if (!element) return '';

  // For contenteditable elements
  if (element.isContentEditable) {
    return element.textContent || element.innerText || '';
  }

  // For input/textarea
  return element.value || element.textContent || element.innerText || '';
}

// Set element text content
export function setTextContent(element, text) {
  if (!element) return;

  if (element.isContentEditable) {
    element.textContent = text;
  } else {
    element.value = text;
  }
}

// Trigger input events for React/Angular
export function triggerInputEvents(element) {
  if (!element) return;

  const events = [
    new Event('input', { bubbles: true }),
    new Event('change', { bubbles: true }),
    new KeyboardEvent('keydown', { bubbles: true }),
    new KeyboardEvent('keyup', { bubbles: true })
  ];

  events.forEach(event => element.dispatchEvent(event));
}

// Generate random salt
export function generateSalt(length = 16) {
  return arrayBufferToHex(crypto.getRandomValues(new Uint8Array(length)));
}

// Validate language code
export function isValidLanguageCode(code) {
  // ISO 639-1 (2-letter) or with country code (e.g., zh-CN)
  const pattern = /^[a-z]{2}(-[A-Z]{2})?$/;
  return pattern.test(code);
}

export default {
  hashString,
  generateCacheKey,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  arrayBufferToHex,
  validateAPIKey,
  sanitizeText,
  debounce,
  sleep,
  getCurrentTimestamp,
  isExpired,
  getDomain,
  detectPlatformFromURL,
  generateUniqueId,
  deepClone,
  mergeObjects,
  getErrorMessage,
  formatQuota,
  formatNumber,
  isElementVisible,
  getTextContent,
  setTextContent,
  triggerInputEvents,
  generateSalt,
  isValidLanguageCode
};
