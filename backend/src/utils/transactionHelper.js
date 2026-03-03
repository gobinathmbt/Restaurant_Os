/**
 * Transaction Helper Utilities
 * 
 * Provides robust transaction handling for inventory adjustments and other
 * database operations that require atomicity. Includes comprehensive error
 * handling, session cleanup, and logging.
 * 
 * Requirements: 8.2
 */

import mongoose from 'mongoose';
import { logger } from './logger.js';
import { TransactionError } from './stockTransferExceptionErrors.js';

/**
 * Execute a function within a MongoDB transaction with automatic error handling
 * 
 * This helper:
 * - Starts a MongoDB session and transaction
 * - Executes the provided function with the session
 * - Commits the transaction on success
 * - Aborts the transaction on error
 * - Ensures session cleanup in finally block
 * - Logs transaction lifecycle events
 * - Provides detailed error context
 * 
 * @param {Function} transactionFn - Async function to execute within transaction
 *                                   Receives session as parameter
 * @param {Object} context - Context for logging (operation name, IDs, etc.)
 * @returns {Promise<any>} Result from transactionFn
 * @throws {TransactionError} If transaction fails
 * 
 * @example
 * const result = await executeTransaction(
 *   async (session) => {
 *     await Model1.updateOne({ _id: id }, { $set: { field: value } }, { session });
 *     await Model2.create([{ data }], { session });
 *     return { success: true };
 *   },
 *   { operation: 'inventory_adjustment', transferId: transfer._id }
 * );
 */
export const executeTransaction = async (transactionFn, context = {}) => {
  const session = await mongoose.startSession();
  
  try {
    // Log transaction start
    logger.debug('Starting transaction', {
      operation: context.operation || 'unknown',
      context
    });

    // Start transaction
    session.startTransaction();

    // Execute the transaction function
    const result = await transactionFn(session);

    // Commit transaction
    await session.commitTransaction();
    
    // Log successful commit
    logger.info('Transaction committed successfully', {
      operation: context.operation || 'unknown',
      context
    });

    return result;

  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    
    // Log transaction failure with full context
    logger.error('Transaction failed and aborted', {
      operation: context.operation || 'unknown',
      error: error.message,
      stack: error.stack,
      context
    });

    // Throw TransactionError with context
    throw new TransactionError(
      `Transaction failed: ${error.message}`,
      context.operation || 'unknown',
      {
        originalError: error.message,
        ...context
      }
    );

  } finally {
    // Always end session to free resources
    session.endSession();
    
    logger.debug('Transaction session ended', {
      operation: context.operation || 'unknown'
    });
  }
};

/**
 * Execute inventory adjustment with transaction and ledger entry
 * 
 * This is a specialized transaction helper for inventory operations that:
 * - Updates inventory quantity atomically
 * - Creates corresponding ledger entry
 * - Handles errors with full context
 * - Ensures data consistency
 * 
 * @param {Object} params - Adjustment parameters
 * @param {mongoose.Model} params.InventoryItem - InventoryItem model
 * @param {mongoose.Model} params.InventoryLedger - InventoryLedger model
 * @param {ObjectId} params.inventoryItemId - Inventory item ID
 * @param {ObjectId} params.locationId - Location ID
 * @param {number} params.delta - Quantity change (positive or negative)
 * @param {string} params.referenceType - Type of reference (e.g., 'stock_transfer')
 * @param {ObjectId} params.referenceId - Reference document ID
 * @param {string} params.reason - Reason for adjustment
 * @param {string} params.unit - Unit of measurement
 * @param {ObjectId} params.userId - User performing the adjustment
 * @param {ObjectId} params.companyId - Company ID
 * @param {Object} params.metadata - Additional metadata
 * @returns {Promise<Object>} Updated inventory item and ledger entry
 * 
 * @example
 * const result = await executeInventoryAdjustment({
 *   InventoryItem,
 *   InventoryLedger,
 *   inventoryItemId: item._id,
 *   locationId: location._id,
 *   delta: -10,
 *   referenceType: 'stock_transfer',
 *   referenceId: transfer._id,
 *   reason: 'exception_damage',
 *   unit: 'kg',
 *   userId: user._id,
 *   companyId: company._id,
 *   metadata: { exceptionId: exception._id }
 * });
 */
export const executeInventoryAdjustment = async ({
  InventoryItem,
  InventoryLedger,
  inventoryItemId,
  locationId,
  delta,
  referenceType,
  referenceId,
  reason,
  unit,
  userId,
  companyId,
  metadata = {}
}) => {
  return executeTransaction(
    async (session) => {
      // 1. Update inventory quantity
      const inventoryItem = await InventoryItem.findOneAndUpdate(
        { _id: inventoryItemId, location: locationId },
        { $inc: { quantity: delta } },
        { new: true, session }
      );

      if (!inventoryItem) {
        throw new Error(`Inventory item not found: ${inventoryItemId} at location ${locationId}`);
      }

      // 2. Create ledger entry
      const ledgerEntry = await InventoryLedger.create([{
        companyId,
        locationId,
        inventoryItemId,
        referenceType,
        referenceId,
        delta,
        balanceAfter: inventoryItem.quantity,
        unit,
        reason,
        metadata,
        createdBy: userId
      }], { session });

      logger.debug('Inventory adjustment completed', {
        inventoryItemId,
        locationId,
        delta,
        balanceAfter: inventoryItem.quantity,
        reason
      });

      return {
        inventoryItem,
        ledgerEntry: ledgerEntry[0]
      };
    },
    {
      operation: 'inventory_adjustment',
      inventoryItemId,
      locationId,
      delta,
      reason,
      referenceType,
      referenceId
    }
  );
};

/**
 * Execute batch inventory adjustments with transaction
 * 
 * Processes multiple inventory adjustments atomically within a single transaction.
 * If any adjustment fails, all changes are rolled back.
 * 
 * @param {Object} params - Batch adjustment parameters
 * @param {mongoose.Model} params.InventoryItem - InventoryItem model
 * @param {mongoose.Model} params.InventoryLedger - InventoryLedger model
 * @param {Array<Object>} params.adjustments - Array of adjustment objects
 * @param {ObjectId} params.userId - User performing the adjustments
 * @param {ObjectId} params.companyId - Company ID
 * @returns {Promise<Object>} Results with updated items and ledger entries
 * 
 * @example
 * const results = await executeBatchInventoryAdjustments({
 *   InventoryItem,
 *   InventoryLedger,
 *   adjustments: [
 *     {
 *       inventoryItemId: item1._id,
 *       locationId: location._id,
 *       delta: -10,
 *       referenceType: 'stock_transfer',
 *       referenceId: transfer._id,
 *       reason: 'exception_damage',
 *       unit: 'kg',
 *       metadata: { exceptionId: exception1._id }
 *     },
 *     {
 *       inventoryItemId: item2._id,
 *       locationId: location._id,
 *       delta: 5,
 *       referenceType: 'stock_transfer',
 *       referenceId: transfer._id,
 *       reason: 'transfer_received',
 *       unit: 'pcs',
 *       metadata: {}
 *     }
 *   ],
 *   userId: user._id,
 *   companyId: company._id
 * });
 */
export const executeBatchInventoryAdjustments = async ({
  InventoryItem,
  InventoryLedger,
  adjustments,
  userId,
  companyId
}) => {
  return executeTransaction(
    async (session) => {
      const results = {
        inventoryItems: [],
        ledgerEntries: [],
        itemsProcessed: 0,
        totalItems: adjustments.length
      };

      for (const adjustment of adjustments) {
        try {
          // Update inventory quantity
          const inventoryItem = await InventoryItem.findOneAndUpdate(
            { _id: adjustment.inventoryItemId, location: adjustment.locationId },
            { $inc: { quantity: adjustment.delta } },
            { new: true, session }
          );

          if (!inventoryItem) {
            throw new Error(
              `Inventory item not found: ${adjustment.inventoryItemId} at location ${adjustment.locationId}`
            );
          }

          // Create ledger entry
          const ledgerEntry = await InventoryLedger.create([{
            companyId,
            locationId: adjustment.locationId,
            inventoryItemId: adjustment.inventoryItemId,
            referenceType: adjustment.referenceType,
            referenceId: adjustment.referenceId,
            delta: adjustment.delta,
            balanceAfter: inventoryItem.quantity,
            unit: adjustment.unit,
            reason: adjustment.reason,
            metadata: adjustment.metadata || {},
            createdBy: userId
          }], { session });

          results.inventoryItems.push(inventoryItem);
          results.ledgerEntries.push(ledgerEntry[0]);
          results.itemsProcessed++;

          logger.debug('Batch adjustment item processed', {
            inventoryItemId: adjustment.inventoryItemId,
            delta: adjustment.delta,
            balanceAfter: inventoryItem.quantity,
            progress: `${results.itemsProcessed}/${results.totalItems}`
          });

        } catch (error) {
          // Log which item failed
          logger.error('Batch adjustment item failed', {
            inventoryItemId: adjustment.inventoryItemId,
            locationId: adjustment.locationId,
            itemsProcessed: results.itemsProcessed,
            totalItems: results.totalItems,
            error: error.message
          });
          
          // Re-throw to abort transaction
          throw error;
        }
      }

      logger.info('Batch inventory adjustments completed', {
        itemsProcessed: results.itemsProcessed,
        totalItems: results.totalItems,
        ledgerEntriesCreated: results.ledgerEntries.length
      });

      return results;
    },
    {
      operation: 'batch_inventory_adjustment',
      totalAdjustments: adjustments.length,
      referenceType: adjustments[0]?.referenceType,
      referenceId: adjustments[0]?.referenceId
    }
  );
};

/**
 * Retry transaction with exponential backoff
 * 
 * Retries a transaction operation with exponential backoff in case of
 * transient errors (e.g., write conflicts, network issues).
 * 
 * @param {Function} transactionFn - Transaction function to retry
 * @param {Object} context - Context for logging
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} initialDelay - Initial delay in ms (default: 100)
 * @returns {Promise<any>} Result from transaction
 */
export const retryTransaction = async (
  transactionFn,
  context = {},
  maxRetries = 3,
  initialDelay = 100
) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await executeTransaction(transactionFn, {
        ...context,
        attempt,
        maxRetries
      });
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = 
        error.message.includes('WriteConflict') ||
        error.message.includes('TransientTransactionError') ||
        error.code === 112; // WriteConflict error code

      if (!isRetryable || attempt === maxRetries) {
        logger.error('Transaction retry exhausted or non-retryable error', {
          attempt,
          maxRetries,
          error: error.message,
          context
        });
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt - 1);
      
      logger.warn('Transaction failed, retrying', {
        attempt,
        maxRetries,
        delay,
        error: error.message,
        context
      });

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Validate transaction prerequisites
 * 
 * Checks that all required conditions are met before starting a transaction.
 * Throws descriptive errors if validation fails.
 * 
 * @param {Object} prerequisites - Prerequisites to validate
 * @throws {Error} If any prerequisite is not met
 */
export const validateTransactionPrerequisites = (prerequisites) => {
  const { models, ids, conditions } = prerequisites;

  // Validate models are provided
  if (models) {
    for (const [name, model] of Object.entries(models)) {
      if (!model) {
        throw new Error(`Required model not provided: ${name}`);
      }
    }
  }

  // Validate IDs are provided
  if (ids) {
    for (const [name, id] of Object.entries(ids)) {
      if (!id) {
        throw new Error(`Required ID not provided: ${name}`);
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid ObjectId for ${name}: ${id}`);
      }
    }
  }

  // Validate custom conditions
  if (conditions) {
    for (const [name, condition] of Object.entries(conditions)) {
      if (!condition) {
        throw new Error(`Prerequisite condition not met: ${name}`);
      }
    }
  }
};
