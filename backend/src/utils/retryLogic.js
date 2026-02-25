/**
 * Retry Logic Utilities
 * Provides retry mechanisms with exponential backoff for handling transient failures
 * Requirements: 3.8
 */

import { ConflictError } from './errorResponses.js';

/**
 * Sleep for a specified duration
 * 
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry a function with exponential backoff
 * Useful for handling optimistic locking failures and transient database errors
 * 
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} [options.maxRetries=3] - Maximum number of retry attempts
 * @param {number} [options.initialDelay=100] - Initial delay in milliseconds
 * @param {number} [options.backoffMultiplier=2] - Multiplier for exponential backoff
 * @param {Function} [options.shouldRetry] - Function to determine if error should trigger retry
 * @param {Function} [options.onRetry] - Callback function called before each retry
 * @returns {Promise<any>} Result of the function
 * @throws {Error} Last error if all retries fail
 */
const retryWithExponentialBackoff = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 100,
    backoffMultiplier = 2,
    shouldRetry = null,
    onRetry = null
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Execute the function
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const shouldRetryError = shouldRetry ? shouldRetry(error) : isRetryableError(error);
      
      // If this is the last attempt or error is not retryable, throw
      if (attempt === maxRetries || !shouldRetryError) {
        throw error;
      }

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(error, attempt + 1, delay);
      }

      // Wait before retrying
      await sleep(delay);

      // Increase delay for next attempt (exponential backoff)
      delay *= backoffMultiplier;
    }
  }

  // This should never be reached, but just in case
  throw lastError;
};

/**
 * Determine if an error is retryable
 * By default, retries on version conflicts and certain database errors
 * 
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is retryable
 */
const isRetryableError = (error) => {
  // Retry on optimistic locking conflicts
  if (error instanceof ConflictError) {
    return true;
  }

  // Retry on MongoDB version errors
  if (error.name === 'VersionError') {
    return true;
  }

  // Retry on MongoDB write conflicts
  if (error.code === 11000 || error.code === 112) {
    return true;
  }

  // Retry on transient network errors
  if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
    return true;
  }

  return false;
};

/**
 * Retry optimistic locking operations
 * Specialized retry function for operations that use version-based optimistic locking
 * 
 * @param {Function} fn - Async function that performs the optimistic locking operation
 * @param {Object} options - Retry options
 * @param {number} [options.maxRetries=3] - Maximum number of retry attempts (default: 3)
 * @param {number} [options.initialDelay=100] - Initial delay in milliseconds (default: 100ms)
 * @param {Function} [options.onRetry] - Callback function called before each retry
 * @returns {Promise<any>} Result of the function
 * @throws {ConflictError} If all retries fail due to version conflicts
 * @throws {Error} If operation fails for other reasons
 * 
 * @example
 * const result = await retryOptimisticLocking(async () => {
 *   const doc = await Model.findById(id);
 *   doc.quantity += 10;
 *   doc.version += 1;
 *   return await doc.save();
 * });
 */
const retryOptimisticLocking = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 100,
    onRetry = null
  } = options;

  return retryWithExponentialBackoff(fn, {
    maxRetries,
    initialDelay,
    backoffMultiplier: 2,
    shouldRetry: (error) => {
      // Only retry on version conflicts
      return error instanceof ConflictError || 
             error.name === 'VersionError' ||
             (error.message && error.message.includes('version'));
    },
    onRetry: (error, attempt, delay) => {
      // Log retry attempt
      console.log(`Optimistic locking conflict detected. Retrying (attempt ${attempt}/${maxRetries}) after ${delay}ms...`);
      
      // Call custom onRetry callback if provided
      if (onRetry) {
        onRetry(error, attempt, delay);
      }
    }
  });
};

/**
 * Retry database transaction operations
 * Specialized retry function for database transactions that may fail due to transient errors
 * 
 * @param {Function} fn - Async function that performs the transaction
 * @param {Object} options - Retry options
 * @param {number} [options.maxRetries=3] - Maximum number of retry attempts
 * @param {number} [options.initialDelay=100] - Initial delay in milliseconds
 * @param {Function} [options.onRetry] - Callback function called before each retry
 * @returns {Promise<any>} Result of the transaction
 * @throws {Error} If all retries fail
 * 
 * @example
 * const result = await retryTransaction(async (session) => {
 *   await Model1.updateOne({ _id: id1 }, { $inc: { quantity: -10 } }, { session });
 *   await Model2.updateOne({ _id: id2 }, { $inc: { quantity: 10 } }, { session });
 *   return { success: true };
 * });
 */
const retryTransaction = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 100,
    onRetry = null
  } = options;

  return retryWithExponentialBackoff(fn, {
    maxRetries,
    initialDelay,
    backoffMultiplier: 2,
    shouldRetry: (error) => {
      // Retry on transient transaction errors
      return error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError');
    },
    onRetry: (error, attempt, delay) => {
      console.log(`Transaction failed with transient error. Retrying (attempt ${attempt}/${maxRetries}) after ${delay}ms...`);
      
      if (onRetry) {
        onRetry(error, attempt, delay);
      }
    }
  });
};

/**
 * Execute a function with a specific number of retries
 * Simple retry mechanism without exponential backoff
 * 
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delay - Fixed delay between retries in milliseconds
 * @returns {Promise<any>} Result of the function
 * @throws {Error} Last error if all retries fail
 */
const retryWithFixedDelay = async (fn, maxRetries = 3, delay = 100) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        throw error;
      }

      await sleep(delay);
    }
  }

  throw lastError;
};

/**
 * Wrap a function to automatically retry on failure
 * Returns a new function that will retry the original function
 * 
 * @param {Function} fn - Function to wrap
 * @param {Object} options - Retry options
 * @returns {Function} Wrapped function with retry logic
 * 
 * @example
 * const fetchWithRetry = withRetry(fetchData, { maxRetries: 3 });
 * const data = await fetchWithRetry(params);
 */
const withRetry = (fn, options = {}) => {
  return async (...args) => {
    return retryWithExponentialBackoff(() => fn(...args), options);
  };
};

export {
  retryWithExponentialBackoff,
  retryOptimisticLocking,
  retryTransaction,
  retryWithFixedDelay,
  withRetry,
  isRetryableError,
  sleep
};
