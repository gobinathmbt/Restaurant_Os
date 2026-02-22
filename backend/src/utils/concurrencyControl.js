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
 * Transfer serialization lock manager
 * Ensures transfers between the same two locations are processed serially
 * to prevent deadlocks from concurrent operations
 */
class TransferLockManager {
  constructor() {
    // Map of location pair keys to promise queues
    this.locks = new Map();
  }

  /**
   * Generate a unique key for a location pair
   * Always sorts locations to ensure consistent key regardless of direction
   * @param {string} locationId1 - First location ID
   * @param {string} locationId2 - Second location ID
   * @returns {string} Unique key for the location pair
   */
  _getLocationPairKey(locationId1, locationId2) {
    const sorted = sortLocationsForLocking([locationId1, locationId2]);
    return `${sorted[0]}_${sorted[1]}`;
  }

  /**
   * Acquire lock for a location pair
   * Returns a promise that resolves when the lock is acquired
   * @param {string} locationId1 - First location ID
   * @param {string} locationId2 - Second location ID
   * @returns {Promise<Function>} Release function to call when done
   */
  async acquireLock(locationId1, locationId2) {
    const key = this._getLocationPairKey(locationId1, locationId2);
    
    // Get or create the lock queue for this location pair
    let lockQueue = this.locks.get(key);
    
    if (!lockQueue) {
      lockQueue = {
        queue: [],
        locked: false
      };
      this.locks.set(key, lockQueue);
    }

    // Create a promise that will be resolved when this operation can proceed
    const lockPromise = new Promise((resolve) => {
      lockQueue.queue.push(resolve);
    });

    // If not currently locked, grant the lock immediately
    if (!lockQueue.locked) {
      lockQueue.locked = true;
      const resolve = lockQueue.queue.shift();
      resolve();
    }

    // Wait for the lock to be granted
    await lockPromise;

    // Return a release function
    return () => this._releaseLock(key);
  }

  /**
   * Release lock for a location pair
   * Grants the lock to the next waiting operation if any
   * @param {string} key - Location pair key
   * @private
   */
  _releaseLock(key) {
    const lockQueue = this.locks.get(key);
    
    if (!lockQueue) {
      return;
    }

    // If there are more operations waiting, grant the lock to the next one
    if (lockQueue.queue.length > 0) {
      const resolve = lockQueue.queue.shift();
      resolve();
    } else {
      // No more operations waiting, unlock and clean up
      lockQueue.locked = false;
      
      // Clean up empty lock queues to prevent memory leaks
      if (lockQueue.queue.length === 0) {
        this.locks.delete(key);
      }
    }
  }

  /**
   * Get the number of active locks (for monitoring/debugging)
   * @returns {number} Number of active locks
   */
  getActiveLockCount() {
    return this.locks.size;
  }

  /**
   * Get the number of waiting operations for a location pair (for monitoring/debugging)
   * @param {string} locationId1 - First location ID
   * @param {string} locationId2 - Second location ID
   * @returns {number} Number of waiting operations
   */
  getWaitingCount(locationId1, locationId2) {
    const key = this._getLocationPairKey(locationId1, locationId2);
    const lockQueue = this.locks.get(key);
    return lockQueue ? lockQueue.queue.length : 0;
  }
}

// Global singleton instance
const transferLockManager = new TransferLockManager();

/**
 * Execute transfer operation with serialization for same location pairs
 * Ensures transfers between the same two locations are processed serially
 * to prevent deadlocks from concurrent operations
 * 
 * @param {string} fromLocationId - Source location ID
 * @param {string} toLocationId - Destination location ID
 * @param {Function} operation - Async operation to execute
 * @param {Object} options - Options
 * @param {string} options.operationName - Name for logging
 * @returns {Promise<any>} Result of operation
 */
export const withTransferSerialization = async (
  fromLocationId,
  toLocationId,
  operation,
  options = {}
) => {
  const operationName = options.operationName || 'Transfer operation';
  
  // Acquire lock for this location pair
  const releaseLock = await transferLockManager.acquireLock(
    fromLocationId,
    toLocationId
  );
  
  try {
    logger.debug(
      `${operationName}: Lock acquired for locations ${fromLocationId} <-> ${toLocationId}`
    );
    
    // Execute the operation
    const result = await operation();
    
    return result;
  } finally {
    // Always release the lock, even if operation fails
    releaseLock();
    
    logger.debug(
      `${operationName}: Lock released for locations ${fromLocationId} <-> ${toLocationId}`
    );
  }
};

/**
 * Get transfer lock manager statistics (for monitoring)
 * @returns {Object} Lock manager statistics
 */
export const getTransferLockStats = () => {
  return {
    activeLocks: transferLockManager.getActiveLockCount()
  };
};

/**
 * Execute operation with transaction and retry logic
 * Combines transaction management with retry logic for concurrent operations
 * Falls back to non-transactional execution if replica set is not available (development mode)
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
        // Try to start transaction
        try {
          await session.startTransaction();
          
          const result = await operation(session, attemptNumber);
          
          await session.commitTransaction();
          
          return result;
        } catch (transactionError) {
          // If transaction is not supported (standalone MongoDB), execute without transaction
          if (transactionError.code === 20 || transactionError.codeName === 'IllegalOperation') {
            logger.warn(`Transactions not supported (standalone MongoDB), executing without transaction: ${options.operationName || 'Operation'}`);
            
            // Abort any pending transaction
            try {
              await session.abortTransaction();
            } catch (abortError) {
              // Ignore abort errors
            }
            
            // Execute operation without transaction (pass null as session)
            const result = await operation(null, attemptNumber);
            return result;
          }
          
          // For other errors, abort and rethrow
          await session.abortTransaction();
          throw transactionError;
        }
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
  withTransferSerialization,
  getTransferLockStats,
  isVersionConflictError,
  isDeadlockError,
  isRetryableError
};
