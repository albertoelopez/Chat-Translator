/**
 * Logger utility with log levels
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

class Logger {
  constructor(level = LOG_LEVELS.INFO) {
    this.level = level;
    this.prefix = '[RespondInLanguage]';
  }

  setLevel(level) {
    this.level = level;
  }

  debug(...args) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.debug(this.prefix, ...args);
    }
  }

  info(...args) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.info(this.prefix, ...args);
    }
  }

  warn(...args) {
    if (this.level <= LOG_LEVELS.WARN) {
      console.warn(this.prefix, ...args);
    }
  }

  error(...args) {
    if (this.level <= LOG_LEVELS.ERROR) {
      console.error(this.prefix, ...args);
    }
  }

  group(label) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.group(this.prefix, label);
    }
  }

  groupEnd() {
    if (this.level <= LOG_LEVELS.INFO) {
      console.groupEnd();
    }
  }

  table(data) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.table(data);
    }
  }

  time(label) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.time(this.prefix + ' ' + label);
    }
  }

  timeEnd(label) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.timeEnd(this.prefix + ' ' + label);
    }
  }
}

// Create singleton instance
const logger = new Logger();

// Export both the class and instance
export { Logger, LOG_LEVELS };
export default logger;
