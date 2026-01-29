/**
 * Logger Utility
 * Provides logging methods with emoji indicators for different log levels
 * Supports conditional debug logging based on NODE_ENV
 */

export const logger = {
  /**
   * Log informational messages
   * @param {string} message - The message to log
   * @param {object} data - Optional data to log
   */
  info: (message, data = {}) => {
    console.log(`ℹ️  [INFO] ${message}`, Object.keys(data).length > 0 ? data : '');
  },

  /**
   * Log error messages
   * @param {string} message - The error message to log
   * @param {Error|object} error - Optional error object or data
   */
  error: (message, error = {}) => {
    console.error(`❌ [ERROR] ${message}`, error);
  },

  /**
   * Log warning messages
   * @param {string} message - The warning message to log
   * @param {object} data - Optional data to log
   */
  warn: (message, data = {}) => {
    console.warn(`⚠️  [WARN] ${message}`, Object.keys(data).length > 0 ? data : '');
  },

  /**
   * Log debug messages (only in development mode)
   * @param {string} message - The debug message to log
   * @param {object} data - Optional data to log
   */
  debug: (message, data = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🐛 [DEBUG] ${message}`, Object.keys(data).length > 0 ? data : '');
    }
  },
};
