import logger from './logger.js';

/**
 * Concurrency Control Utilities
 * Provides optimistic locking and retry logic with exponential backoff
 * for handling concurrent inventory operations safely
 */

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 200,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
  jitterFactor: 0.1 // 10% random jitter to prevent thundering herd
};

/**
 * Calculate delay with exponential backoff and jitter
 * @param {number} attemptNumber - Current attempt number (0-indexed)
 * @param {Object} config - Retry configuration
 * @returns {number} Delay in milliseconds
 */
const calculateBackoffDelay = (attemptNumber, config = DEFAULT_RETRY_CONFIG) => {
  const baseDelay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attemptNumber),
    config.maxDelayMs
  );
  
  // Add random jitter to prevent thundering herd
  const jitter = baseDelay * config.jitterFactor * (Math.random() * 2 - 1);
  
  return Math.floor(baseDelay + jitter);
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if error is a version conflict (optimistic locking failure)
 * @param {Error} error - Error to check
 * @returns {boolean} True if version conflict
 */
const isVersionConflictError = (error) => {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorName = error.name?.toLowerCase() || '';
  
  // Check for various version conflict indicators
  return (
    errorMessage.includes('version') ||
    errorMessage.includes('optimistic') ||
    errorMessage.includes('concurrent') ||
    errorName === 'versionerror' ||
    error.code === 'VERSION_CONFLICT'
  );
};

/**
 * Check if error is a deadlock error
 * @param {Error} error - Error to check
 * @returns {boolean} True if deadlock
 */
const isDeadlockError = (error) => {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || '';
  
  // MongoDB deadlock indicators
  return (
    errorMessage.includes('deadlock') ||
    errorMessage.includes('write conflict') ||
    error.code === 112 || // WriteConflict
    error.code === 'DEADLOCK'
  );
};

/**
 * Check if error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is retryable
 */
const isRetryableError = (error) => {
  return isVersionConflictError(error) || isDeadlockError(error);
};

/**
 * Execute operation with retry logic and exponential backoff
 * Automatically retries on version conflicts and deadlocks
 * 
 * @param {Function} operation - Async operation to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {number} options.initialDelayMs - Initial delay in milliseconds
 * @param {number} options.maxDelayMs - Maximum delay in milliseconds
 * @param {number} options.backoffMultiplier - Backoff multiplier
 * @param {string} options.operationName - Name for logging
 * @param {Function} options.onRetry - Callback on retry (receives attempt number and error)
 * @returns {Promise<any>} Result of operation
 * @throws {Error} If operation fails after all retries
 */
export const withRetry = async (operation, options = {}) => {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options };
  const operationName = config.operationName || 'operation';
  
  let lastError;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Execute the operation
      const result = await operation(attempt);
      
      // Log success if this was a retry
      if (attempt > 0) {
        logger.info(
          `${operationName} succeeded on attempt ${attempt + 1}/${config.maxRetries + 1}`
        );
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      if (!isRetryableError(error)) {
        // Not a retryable error, throw immediately
        logger.error(`${operationName} failed with non-retryable error:`, error);
        throw error;
      }
      
      // Check if we have retries left
      if (attempt >= config.maxRetries) {
        // No more retries, throw the error
        logger.error(
          `${operationName} failed after ${attempt + 1} attempts:`,
          error
        );
        throw new Error(
          `${operationName} failed after ${attempt + 1} attempts due to ` +
          `${isDeadlockError(error) ? 'deadlock' : 'version conflict'}. ` +
          `Original error: ${error.message}`
        );
      }
      
      // Calculate delay and wait
      const delay = calculateBackoffDelay(attempt, config);
      
      logger.warn(
        `${operationName} failed on attempt ${attempt + 1}/${config.maxRetries + 1} ` +
        `due to ${isDeadlockError(error) ? 'deadlock' : 'version conflict'}. ` +
        `Retrying in ${delay}ms...`
      );
      
      // Call onRetry callback if provided
      if (config.onRetry) {
        try {
          await config.onRetry(attempt, error);
        } catch (callbackError) {
          logger.error('Error in onRetry callback:', callbackError);
        }
      }
      
      await sleep(delay);
    }
  }
  
  // Should never reach here, but just in case
  throw lastError;
};

/**
 * Update document with optimistic locking
 * Automatically handles version field and retries on conflicts
 * 
 * @param {Object} model - Mongoose model
 * @param {Object} filter - Query filter
 * @param {Object} update - Update operations
 * @param {Object} options - Update options
 * @param {Object} session - MongoDB session for transactions
 * @returns {Promise<Object>} Updated document
 * @throws {Error} If document not found or version conflict after retries
 */
export const updateWithOptimisticLock = async (
  model,
  filter,
  update,
  options = {},
  session = null
) => {
  return withRetry(
    async () => {
      // Find the document first to get current version
      const findOptions = session ? { session } : {};
      const doc = await model.findOne(filter, null, findOptions);
      
      if (!doc) {
        throw new Error(`Document not found with filter: ${JSON.stringify(filter)}`);
      }
      
      const currentVersion = doc.version || 0;
      
      // Add version check to filter
      const versionedFilter = {
        ...filter,
        version: currentVersion
      };
      
      // Increment version in update
      const versionedUpdate = {
        ...update,
        $inc: {
          ...(update.$inc || {}),
          version: 1
        }
      };
      
      // Perform update with version check
      const updateOptions = {
        ...options,
        new: true, // Return updated document
        ...(session ? { session } : {})
      };
      
      const updatedDoc = await model.findOneAndUpdate(
        versionedFilter,
        versionedUpdate,
        updateOptions
      );
      
      if (!updatedDoc) {
        // Document was modified by another process
        const error = new Error(
          `Optimistic locking failure: Document was modified by another process`
        );
        error.code = 'VERSION_CONFLICT';
        throw error;
      }
      
      return updatedDoc;
    },
    {
      operationName: `Update ${model.modelName}`,
      maxRetries: 3
    }
  );
};

/**
 * Execute multiple updates with optimistic locking in order
 * Useful for operations that need to update multiple documents atomically
 * 
 * @param {Array<Object>} updates - Array of update operations
 * @param {Object} updates[].model - Mongoose model
 * @param {Object} updates[].filter - Query filter
 * @param {Object} updates[].update - Update operations
 * @param {Object} updates[].options - Update options
 * @param {Object} session - MongoDB session for transactions
 * @returns {Promise<Array<Object>>} Array of updated documents
 */
export const updateMultipleWithOptimisticLock = async (updates, session = null) => {
  return withRetry(
    async () => {
      const results = [];
      
      for (const { model, filter, update, options = {} } of updates) {
        const result = await updateWithOptimisticLock(
          model,
          filter,
          update,
          options,
          session
        );
        results.push(result);
      }
      
      return results;
    },
    {
      operationName: 'Multiple updates with optimistic locking',
      maxRetries: 3
    }
  );
};

/**
 * Acquire locks in deterministic order to prevent deadlocks
 * Sorts location IDs before acquiring locks
 * 
 * @param {Array<string>} locationIds - Array of location IDs
 * @returns {Array<string>} Sorted location IDs
 */
export const sortLocationsForLocking = (locationIds) => {
  if (!Array.isArray(locationIds)) {
    throw new Error('locationIds must be an array');
  }
  
  // Convert to strings and sort lexicographically
  return locationIds
    .map(id => id.toString())
    .sort((a, b) => a.localeCompare(b));
};

/**
 * Execute operation with transaction and retry logic
 * Combines transaction management with retry logic for concurrent operations
 * 
 * @param {Object} companyDB - Company database connection
 * @param {Function} operation - Async operation to execute (receives session)
 * @param {Object} options - Options
 * @param {string} options.operationName - Name for logging
 * @param {number} options.maxRetries - Maximum retries
 * @returns {Promise<any>} Result of operation
 */
export const withTransactionAndRetry = async (companyDB, operation, options = {}) => {
  return withRetry(
    async (attemptNumber) => {
      const session = await companyDB.startSession();
      
      try {
        await session.startTransaction();
        
        const result = await operation(session, attemptNumber);
        
        await session.commitTransaction();
        
        return result;
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    },
    {
      operationName: options.operationName || 'Transaction',
      maxRetries: options.maxRetries || 3,
      onRetry: options.onRetry
    }
  );
};

export default {
  withRetry,
  updateWithOptimisticLock,
  updateMultipleWithOptimisticLock,
  sortLocationsForLocking,
  withTransactionAndRetry,
  isVersionConflictError,
  isDeadlockError,
  isRetryableError
};
