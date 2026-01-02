/**
 * Generic Chat Adapter
 * Universal fallback adapter that works on any chat platform through heuristic detection
 */

import { isElementVisible, getTextContent, setTextContent, triggerInputEvents, generateUniqueId } from '../../shared/utils.js';
import logger from '../../shared/logger.js';

class GenericChatAdapter {
  constructor() {
    this.inputElement = null;
    this.sendButton = null;
    this.messageContainer = null;
    this.detectElements();
  }

  /**
   * Detect chat elements using heuristics
   */
  detectElements() {
    logger.info('Detecting chat elements with generic adapter');

    this.inputElement = this.findLikelyInput();
    this.sendButton = this.findLikelySendButton();
    this.messageContainer = this.findLikelyMessageContainer();

    logger.info('Generic adapter elements:', {
      hasInput: !!this.inputElement,
      hasSendButton: !!this.sendButton,
      hasMessageContainer: !!this.messageContainer
    });
  }

  /**
   * Find likely input element
   */
  findLikelyInput() {
    // Collect candidates
    const candidates = [
      ...document.querySelectorAll('[contenteditable="true"]'),
      ...document.querySelectorAll('textarea'),
      ...document.querySelectorAll('input[type="text"]'),
      ...document.querySelectorAll('[role="textbox"]')
    ];

    if (candidates.length === 0) {
      logger.warn('No input candidates found');
      return null;
    }

    // Score each candidate
    const scored = candidates.map(element => ({
      element,
      score: this.scoreInputElement(element)
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    logger.debug('Input candidates:', scored.map(s => ({
      tag: s.element.tagName,
      score: s.score
    })));

    return scored[0].score > 0 ? scored[0].element : null;
  }

  /**
   * Score input element based on chat-like characteristics
   */
  scoreInputElement(element) {
    let score = 0;

    // Must be visible
    if (!isElementVisible(element)) {
      return 0;
    }

    // Position score (prefer bottom of page)
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const distanceFromBottom = windowHeight - rect.bottom;

    if (distanceFromBottom < 200) {
      score += 30; // Near bottom
    } else if (distanceFromBottom < 400) {
      score += 15; // Somewhat near bottom
    }

    // Size score (chat inputs are usually wide)
    if (rect.width > 200) {
      score += 20;
    }
    if (rect.width > 400) {
      score += 10;
    }

    // Placeholder score
    const placeholder = element.placeholder || element.getAttribute('aria-label') || '';
    const chatKeywords = ['message', 'type', 'write', 'chat', 'send', 'reply', 'say', 'enter'];

    if (chatKeywords.some(keyword => placeholder.toLowerCase().includes(keyword))) {
      score += 25;
    }

    // ContentEditable preferred for modern chat apps
    if (element.isContentEditable) {
      score += 15;
    }

    // Role attribute
    if (element.getAttribute('role') === 'textbox') {
      score += 10;
    }

    // Single line vs multiline
    if (element.tagName === 'TEXTAREA' || element.isContentEditable) {
      score += 5; // Chats often use multiline
    }

    return score;
  }

  /**
   * Find likely send button
   */
  findLikelySendButton() {
    if (!this.inputElement) {
      return null;
    }

    // Look for buttons near the input
    const inputRect = this.inputElement.getBoundingClientRect();
    const buttons = document.querySelectorAll('button, [role="button"], [type="submit"]');

    const candidates = [];

    buttons.forEach(button => {
      if (!isElementVisible(button)) {
        return;
      }

      const buttonRect = button.getBoundingClientRect();

      // Check proximity to input
      const distance = Math.sqrt(
        Math.pow(buttonRect.left - inputRect.right, 2) +
        Math.pow(buttonRect.top - inputRect.top, 2)
      );

      if (distance < 150) { // Within 150px
        candidates.push({
          element: button,
          distance
        });
      }
    });

    if (candidates.length === 0) {
      logger.warn('No send button found');
      return null;
    }

    // Sort by distance
    candidates.sort((a, b) => a.distance - b.distance);

    // Additional scoring based on content
    const scored = candidates.map(candidate => ({
      element: candidate.element,
      score: this.scoreSendButton(candidate.element) - candidate.distance / 10
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored[0].element;
  }

  /**
   * Score send button
   */
  scoreSendButton(button) {
    let score = 0;

    const text = button.textContent?.toLowerCase() || '';
    const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
    const title = button.getAttribute('title')?.toLowerCase() || '';

    const sendKeywords = ['send', 'submit', 'post', 'reply'];

    if (sendKeywords.some(keyword =>
      text.includes(keyword) || ariaLabel.includes(keyword) || title.includes(keyword)
    )) {
      score += 50;
    }

    // Check for send icon (SVG, icon classes)
    if (button.querySelector('svg') || button.querySelector('[class*="icon"]')) {
      score += 20;
    }

    return score;
  }

  /**
   * Find likely message container
   */
  findLikelyMessageContainer() {
    // Look for scrollable containers with multiple children
    const candidates = document.querySelectorAll('[class*="message"], [class*="chat"], [class*="conversation"], [role="log"]');

    const scored = [];

    candidates.forEach(container => {
      if (!isElementVisible(container)) {
        return;
      }

      let score = 0;

      // Scrollable
      const style = window.getComputedStyle(container);
      if (style.overflowY === 'scroll' || style.overflowY === 'auto') {
        score += 30;
      }

      // Has multiple children
      const childCount = container.children.length;
      if (childCount > 5) {
        score += 20;
      }
      if (childCount > 10) {
        score += 10;
      }

      // Size (chat containers are usually tall)
      const rect = container.getBoundingClientRect();
      if (rect.height > 300) {
        score += 20;
      }

      // Class/role hints
      const className = container.className?.toLowerCase() || '';
      const role = container.getAttribute('role')?.toLowerCase() || '';

      if (className.includes('message') || className.includes('chat') || role === 'log') {
        score += 25;
      }

      scored.push({ element: container, score });
    });

    if (scored.length === 0) {
      logger.warn('No message container found');
      return document.body; // Fallback to body
    }

    scored.sort((a, b) => b.score - a.score);

    return scored[0].element;
  }

  /**
   * Get input element
   */
  getInputElement() {
    if (!this.inputElement) {
      this.inputElement = this.findLikelyInput();
    }
    return this.inputElement;
  }

  /**
   * Get send button
   */
  getSendButton() {
    if (!this.sendButton) {
      this.sendButton = this.findLikelySendButton();
    }
    return this.sendButton;
  }

  /**
   * Get message container
   */
  getMessageContainer() {
    if (!this.messageContainer) {
      this.messageContainer = this.findLikelyMessageContainer();
    }
    return this.messageContainer;
  }

  /**
   * Insert text into input
   */
  insertText(text) {
    const input = this.getInputElement();

    if (!input) {
      logger.error('No input element found');
      throw new Error('Could not find input element');
    }

    setTextContent(input, text);
    triggerInputEvents(input);

    logger.info('Text inserted into input');
  }

  /**
   * Trigger send action
   */
  triggerSend() {
    const sendButton = this.getSendButton();

    if (sendButton) {
      logger.info('Clicking send button');
      sendButton.click();
      return;
    }

    // Fallback to Enter key
    logger.info('No send button, trying Enter key');
    const input = this.getInputElement();
    if (input) {
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      }));

      input.dispatchEvent(new KeyboardEvent('keypress', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      }));
    }
  }

  /**
   * Observe new messages
   */
  observeNewMessages(callback) {
    const container = this.getMessageContainer();

    if (!container) {
      logger.error('No message container found for observation');
      return null;
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (this.isMessageNode(node)) {
              const messageData = this.extractMessageData(node);
              if (messageData) {
                callback(messageData);
              }
            }
          }
        });
      });
    });

    observer.observe(container, {
      childList: true,
      subtree: true
    });

    logger.info('Message observer started');

    return observer;
  }

  /**
   * Check if node is a message
   */
  isMessageNode(node) {
    if (!node || !node.textContent) {
      return false;
    }

    // Check if has substantial text content
    const text = node.textContent.trim();
    if (text.length < 1) {
      return false;
    }

    // Check for message-like characteristics
    const className = node.className?.toLowerCase() || '';
    const role = node.getAttribute('role')?.toLowerCase() || '';

    // Common message indicators
    if (className.includes('message') ||
        className.includes('chat') ||
        role === 'article' ||
        role === 'listitem') {
      return true;
    }

    // Has text and is in a list-like structure
    if (node.tagName === 'DIV' || node.tagName === 'LI') {
      return true;
    }

    return false;
  }

  /**
   * Extract message data from DOM node
   */
  extractMessageData(messageElement) {
    try {
      const id = generateUniqueId();
      const text = this.extractText(messageElement);
      const sender = this.extractSender(messageElement);
      const timestamp = this.extractTimestamp(messageElement);
      const isOwn = this.isOwnMessage(messageElement);

      return {
        id,
        text,
        sender,
        timestamp,
        element: messageElement,
        isOwnMessage: isOwn
      };
    } catch (error) {
      logger.error('Failed to extract message data:', error);
      return null;
    }
  }

  /**
   * Extract text from message element
   */
  extractText(element) {
    // Try to find text-specific container
    const textContainers = element.querySelectorAll('[class*="text"], [class*="content"], [class*="body"]');

    if (textContainers.length > 0) {
      return textContainers[0].textContent.trim();
    }

    // Fallback to all text
    return element.textContent.trim();
  }

  /**
   * Extract sender from message element
   */
  extractSender(element) {
    // Look for sender/author elements
    const senderElements = element.querySelectorAll('[class*="sender"], [class*="author"], [class*="name"], [class*="user"]');

    if (senderElements.length > 0) {
      return senderElements[0].textContent.trim();
    }

    return 'Unknown';
  }

  /**
   * Extract timestamp from message element
   */
  extractTimestamp(element) {
    // Look for time elements
    const timeElements = element.querySelectorAll('time, [class*="time"], [class*="date"]');

    if (timeElements.length > 0) {
      const datetime = timeElements[0].getAttribute('datetime');
      if (datetime) {
        return new Date(datetime).getTime();
      }

      return Date.now();
    }

    return Date.now();
  }

  /**
   * Check if message is from current user
   */
  isOwnMessage(element) {
    const className = element.className?.toLowerCase() || '';

    // Common patterns for own messages
    const ownPatterns = ['own', 'self', 'me', 'outgoing', 'sent', 'right'];

    return ownPatterns.some(pattern => className.includes(pattern));
  }

  /**
   * Get all current messages
   */
  getAllMessages() {
    const container = this.getMessageContainer();
    if (!container) {
      return [];
    }

    const potentialMessages = container.querySelectorAll('[class*="message"], [role="article"], [role="listitem"]');

    return Array.from(potentialMessages)
      .map(element => this.extractMessageData(element))
      .filter(data => data && data.text);
  }

  /**
   * Re-detect elements (useful after DOM changes)
   */
  refresh() {
    this.detectElements();
  }
}

export default GenericChatAdapter;
