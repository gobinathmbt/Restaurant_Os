/**
 * Logger utility with configurable log levels
 * Supports LOG_LEVEL environment variable: debug, info, warn, error
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.info;

/**
 * Format timestamp for log messages
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Format log message with timestamp and level
 */
function formatMessage(level, message, data) {
  const timestamp = getTimestamp();
  const dataStr = data && Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
}

/**
 * Log message if current log level allows it
 */
function log(level, message, data = {}) {
  if (LOG_LEVELS[level] >= currentLogLevel) {
    const formattedMessage = formatMessage(level, message, data);
    
    switch (level) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'debug':
      case 'info':
      default:
        console.log(formattedMessage);
        break;
    }
  }
}

export const logger = {
  /**
   * Log informational message
   */
  info: (message, data = {}) => {
    log('info', message, data);
  },

  /**
   * Log error message
   */
  error: (message, data = {}) => {
    log('error', message, data);
  },

  /**
   * Log warning message
   */
  warn: (message, data = {}) => {
    log('warn', message, data);
  },

  /**
   * Log debug message
   */
  debug: (message, data = {}) => {
    log('debug', message, data);
  },
};
