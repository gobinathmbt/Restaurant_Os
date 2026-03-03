/**
 * Stock Transfer Exception Error Handling - Usage Examples
 * 
 * This file demonstrates how to use the custom error classes and
 * transaction helpers in the stock transfer exception handling workflow.
 */

import {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  TransactionError,
  IdempotencyError
} from './stockTransferExceptionErrors.js';

import {
  executeTransaction,
  executeInventoryAdjustment,
  executeBatchInventoryAdjustments,
  retryTransaction,
  validateTransactionPrerequisites
} from './transactionHelper.js';

import { handleNotificationError } from '../middlewares/stockTransferExceptionErrorHandler.js';

// ============================================================================
// EXAMPLE 1: Validation Error in Exception Recording
// ============================================================================

/**
 * Example: Validate exception data before recording
 */
async function recordExceptionExample(transferId, exceptionData, user) {
  // Validate exception quantity
  if (exceptionData.quantity <= 0) {
    throw new ValidationError(
      'Exception quantity must be positive',
      'quantity',
      exceptionData.quantity
    );
  }

  // Validate financial integrity
  const t