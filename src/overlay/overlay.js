/**
 * Overlay UI Script
 * Handles user interactions, drag functionality, and communication
 */

// State
let nativeLanguage = 'en';
let chatLanguage = 'es';
let settings = null;
let isDragging = false;
let isResizing = false;
let dragOffset = { x: 0, y: 0 };
let translations = [];

// Elements
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const charCurrent = document.getElementById('char-current');
const charMax = document.getElementById('char-max');
const nativeLangEl = document.getElementById('native-lang');
const chatLangEl = document.getElementById('chat-lang');
const statusEl = document.getElementById('status');
const translationsList = document.getElementById('translations-list');
const translationsEl = document.getElementById('translations');
const header = document.getElementById('header');
const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');
const resizeHandle = document.getElementById('resize-handle');

// Initialize
function initialize() {
  console.log('[Overlay] Initializing...');

  setupEventListeners();
  setupDragFunctionality();
  setupResizeFunctionality();

  // Notify parent that overlay is ready
  window.parent.postMessage({ action: 'overlayReady' }, '*');

  console.log('[Overlay] Ready');
}

// Setup event listeners
function setupEventListeners() {
  // Input events
  messageInput.addEventListener('input', handleInput);
  messageInput.addEventListener('keydown', handleKeyDown);

  // Button events
  sendBtn.addEventListener('click', handleSend);
  minimizeBtn.addEventListener('click', handleMinimize);
  closeBtn.addEventListener('click', handleClose);

  // Listen for messages from parent (content script)
  window.addEventListener('message', handleParentMessage);
}

// Handle input changes
function handleInput() {
  const text = messageInput.value;
  const length = text.length;

  charCurrent.textContent = length;

  // Update character count styling
  const charCount = document.getElementById('char-count');
  charCount.classList.remove('warning', 'error');

  if (length > 4500) {
    charCount.classList.add('error');
  } else if (length > 4000) {
    charCount.classList.add('warning');
  }

  // Enable/disable send button
  sendBtn.disabled = length === 0 || length > 5000;
}

// Handle keyboard shortcuts
function handleKeyDown(event) {
  // Ctrl+Enter to send
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    if (!sendBtn.disabled) {
      handleSend();
    }
  }

  // Escape to close
  if (event.key === 'Escape') {
    handleClose();
  }
}

// Handle send button click
async function handleSend() {
  const text = messageInput.value.trim();

  if (!text) {
    return;
  }

  console.log('[Overlay] Sending message:', text.substring(0, 50));

  // Disable input and button
  messageInput.disabled = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');

  // Send to parent (content script)
  window.parent.postMessage({
    action: 'sendMessage',
    text
  }, '*');

  showStatus('Translating and sending...', 'info');
}

// Handle minimize
function handleMinimize() {
  handleClose();
}

// Handle close
function handleClose() {
  window.parent.postMessage({
    action: 'close'
  }, '*');
}

// Setup drag functionality
function setupDragFunctionality() {
  header.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDrag);
}

function startDrag(event) {
  if (event.target.closest('.control-btn')) {
    return; // Don't drag if clicking control buttons
  }

  isDragging = true;
  dragOffset = {
    x: event.clientX,
    y: event.clientY
  };

  header.style.cursor = 'grabbing';
}

function drag(event) {
  if (!isDragging) return;

  const deltaX = event.clientX - dragOffset.x;
  const deltaY = event.clientY - dragOffset.y;

  window.parent.postMessage({
    action: 'updatePosition',
    delta: { x: deltaX, y: deltaY }
  }, '*');

  dragOffset = {
    x: event.clientX,
    y: event.clientY
  };
}

function stopDrag() {
  if (isDragging) {
    isDragging = false;
    header.style.cursor = 'move';
  }
}

// Setup resize functionality
function setupResizeFunctionality() {
  resizeHandle.addEventListener('mousedown', startResize);
  document.addEventListener('mousemove', resize);
  document.addEventListener('mouseup', stopResize);
}

function startResize(event) {
  isResizing = true;
  event.stopPropagation();
}

function resize(event) {
  if (!isResizing) return;

  const width = event.clientX;
  const height = event.clientY;

  if (width > 300 && height > 200) {
    window.parent.postMessage({
      action: 'updateSize',
      size: { width, height }
    }, '*');
  }
}

function stopResize() {
  isResizing = false;
}

// Handle messages from parent (content script)
function handleParentMessage(event) {
  const { action, data } = event.data;

  switch (action) {
    case 'configure':
      handleConfigure(event.data);
      break;

    case 'languageDetected':
      handleLanguageDetected(event.data);
      break;

    case 'messageSent':
      handleMessageSent(event.data);
      break;

    case 'clearInput':
      clearInput();
      break;

    case 'incomingTranslation':
      handleIncomingTranslation(event.data);
      break;

    case 'showError':
      showStatus(event.data.message, 'error');
      break;

    case 'focus':
      messageInput.focus();
      break;

    default:
      console.log('[Overlay] Unknown message:', action);
  }
}

// Handle configuration
function handleConfigure(data) {
  console.log('[Overlay] Configured:', data);

  nativeLanguage = data.nativeLanguage || 'en';
  chatLanguage = data.chatLanguage || 'es';
  settings = data.settings;

  updateLanguageIndicator();

  // Apply theme
  if (settings?.theme === 'dark') {
    document.body.classList.add('dark-theme');
  }
}

// Handle language detected
function handleLanguageDetected(data) {
  chatLanguage = data.language;
  updateLanguageIndicator();

  if (data.confidence < 0.8) {
    showStatus(`Chat language detected as ${chatLanguage.toUpperCase()} (low confidence)`, 'info');
  }
}

// Handle message sent callback
function handleMessageSent(data) {
  messageInput.disabled = false;
  sendBtn.disabled = false;
  sendBtn.classList.remove('loading');

  if (data.success) {
    showStatus('Message sent successfully!', 'success');
  } else {
    showStatus(`Failed to send: ${data.error}`, 'error');
  }
}

// Clear input
function clearInput() {
  messageInput.value = '';
  handleInput();
  messageInput.focus();
}

// Handle incoming translation
function handleIncomingTranslation(data) {
  console.log('[Overlay] Incoming translation:', data);

  translations.unshift({
    original: data.original,
    translated: data.translated,
    sender: data.sender,
    timestamp: data.timestamp
  });

  // Keep only last 10
  if (translations.length > 10) {
    translations = translations.slice(0, 10);
  }

  updateTranslationsList();

  // Show translations section
  translationsEl.classList.remove('hidden');
}

// Update translations list
function updateTranslationsList() {
  translationsList.innerHTML = '';

  translations.forEach(translation => {
    const item = document.createElement('div');
    item.className = 'translation-item';

    item.innerHTML = `
      <div class="translation-original">${escapeHtml(translation.original)}</div>
      <div class="translation-text">${escapeHtml(translation.translated)}</div>
      <div class="translation-meta">
        <span>${translation.sender}</span>
        <span>${formatTime(translation.timestamp)}</span>
      </div>
    `;

    translationsList.appendChild(item);
  });
}

// Update language indicator
function updateLanguageIndicator() {
  nativeLangEl.textContent = nativeLanguage.toUpperCase();
  chatLangEl.textContent = chatLanguage.toUpperCase();
}

// Show status message
function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = type;

  // Auto-hide success messages
  if (type === 'success') {
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3000);
  }
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Focus input when overlay becomes visible
window.addEventListener('focus', () => {
  messageInput.focus();
});
