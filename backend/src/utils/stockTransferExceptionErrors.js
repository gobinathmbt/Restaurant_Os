/**
 * Stock Transfer Exception Handling - Custom Error Classes
 * 
 * Provides specialized error classes for the stock transfer exception handling workflow.
 * These errors integrate with the global error handler middleware and provide
 * structured error responses with appropriate HTTP status codes.
 * 
 * Requirements: 11.7
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Base class for stock transfer exception errors
 * Extends the standard Error class with additional properties for HTTP responses
 */
class StockTransferExceptionError extends Error {
  constructor(message, statusCode, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.requestId = uuidv4();
    this.timestamp = new Date().toISOString();
    this.isOperational = true; // Indicates this is an expected operational error
    
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON format for API responses
   * @returns {Object} Formatted error response
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...this.details,
        requestId: this.requestId,
        timestamp: this.timestamp
      }
    };
  }
}

/**
 * ValidationError - HTTP 400 Bad Request
 * 
 * Used when input validation fails for exception operations.
 * Includes field-level validation details.
 * 
 * @example
 * throw new ValidationError('Invalid exception quantity', 'quantity', -5);
 * 
 * @example
 * throw new ValidationError('Financial integrity violation', 'exceptions', null, {
 *   sentQuantity: 100,
 *   totalExceptions: 150,
 *   violation: 'Exception quantities exceed sent quantity'
 * });
 */
class ValidationError extends StockTransferExceptionError {
  constructor(message, field = null, value = null, additionalDetails = {}) {
    super(message, 400, 'VALIDATION_ERROR', {
      ...(field && { field }),
      ...(value !== null && value !== undefined && { value }),
      ...additionalDetails
    });
    this.field = field;
    this.value = value;
  }
}

/**
 * AuthorizationError - HTTP 403 Forbidden
 * 
 * Used when a user lacks the required role or permissions to perform an action.
 * Includes information about the required role.
 * 
 * @example
 * throw new AuthorizationError('Only super admins can resolve exceptions', 'super_admin');
 * 
 * @example
 * throw new AuthorizationError('Only destination admins can report exceptions', 'destination_admin', {
 *   userId: user._id,
 *   locationId: transfer.destinationLocation
 * });
 */
class AuthorizationError extends StockTransferExceptionError {
  constructor(message, requiredRole = null, additionalDetails = {}) {
    super(message, 403, 'AUTHORIZATION_ERROR', {
      ...(requiredRole && { requiredRole }),
      ...additionalDetails
    });
    this.requiredRole = requiredRole;
  }
}

/**
 * NotFoundError - HTTP 404 Not Found
 * 
 * Used when a requested resource (transfer, exception, etc.) does not exist.
 * Includes resource type and ID for debugging.
 * 
 * @example
 * throw new NotFoundError('Stock transfer not found', 'StockTransfer', transferId);
 * 
 * @example
 * throw new NotFoundError('Exception not found', 'Exception', exceptionId, {
 *   transferId: transfer._id
 * });
 */
class NotFoundError extends StockTransferExceptionError {
  constructor(message, resourceType = null, resourceId = null, additionalDetails = {}) {
    super(message, 404, 'NOT_FOUND', {
      ...(resourceType && { resourceType }),
      ...(resourceId && { resourceId }),
      ...additionalDetails
    });
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * ConflictError - HTTP 409 Conflict
 * 
 * Used when a resource state conflict occurs (e.g., exception already resolved,
 * transfer not at correct stage, concurrent modification detected).
 * Includes conflict type for specific error handling.
 * 
 * @example
 * throw new ConflictError('Exception already resolved', 'already_resolved', {
 *   exceptionId: exception._id,
 *   resolvedAt: exception.resolvedAt,
 *   resolvedBy: exception.resolvedBy
 * });
 * 
 * @example
 * throw new ConflictError('Transfer not at GOODS_RECEIVED_CONFIRMED stage', 'invalid_stage', {
 *   currentStage: transfer.currentStage,
 *   requiredStage: 'GOODS_RECEIVED_CONFIRMED'
 * });
 * 
 * @example
 * throw new ConflictError('Idempotency key already processed', 'duplicate_request', {
 *   idempotencyKey: key,
 *   originalResponse: cachedResponse
 * });
 */
class ConflictError extends StockTransferExceptionError {
  constructor(message, conflictType = null, additionalDetails = {}) {
    super(message, 409, 'CONFLICT', {
      ...(conflictType && { conflictType }),
      ...additionalDetails
    });
    this.conflictType = conflictType;
  }
}

/**
 * TransactionError - HTTP 500 Internal Server Error
 * 
 * Used when database transaction operations fail during inventory adjustments.
 * Includes transaction context for debugging and recovery.
 * 
 * @example
 * throw new TransactionError('Failed to apply inventory adjustments', 'inventory_update', {
 *   transferId: transfer._id,
 *   itemsProcessed: 3,
 *   totalItems: 5,
 *   failedItem: item._id
 * });
 */
class TransactionError extends StockTransferExceptionError {
  constructor(message, operation = null, additionalDetails = {}) {
    super(message, 500, 'TRANSACTION_ERROR', {
      ...(operation && { operation }),
      ...additionalDetails
    });
    this.operation = operation;
  }
}

/**
 * IdempotencyError - HTTP 409 Conflict
 * 
 * Used when idempotency key conflicts are detected.
 * 
 * @example
 * throw new IdempotencyError('Request already processed', idempotencyKey, cachedResponse);
 */
class IdempotencyError extends ConflictError {
  constructor(message, idempotencyKey = null, cachedResponse = null) {
    super(message, 'idempotency_conflict', {
      ...(idempotencyKey && { idempotencyKey }),
      ...(cachedResponse && { cachedResponse })
    });
  }
}

/**
 * Helper function to check if an error is an operational error
 * (i.e., an expected error that should be handled gracefully)
 * 
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is operational
 */
export const isOperationalError = (error) => {
  if (error instanceof StockTransferExceptionError) {
    return error.isOperational;
  }
  return error.isOperational === true;
};

/**
 * Helper function to format error for logging
 * 
 * @param {Error} error - Error to format
 * @param {Object} context - Additional context (request info, user info, etc.)
 * @returns {Object} Formatted error object for logging
 */
export const formatErrorForLogging = (error, context = {}) => {
  return {
    name: error.name,
    message: error.message,
    code: error.code || 'UNKNOWN_ERROR',
    statusCode: error.statusCode || 500,
    stack: error.stack,
    details: error.details || {},
    requestId: error.requestId || context.requestId,
    timestamp: error.timestamp || new Date().toISOString(),
    context: {
      path: context.path,
      method: context.method,
      userId: context.userId,
      companyId: context.companyId,
      ...context.additionalContext
    }
  };
};

// Export all error classes
export {
  StockTransferExceptionError,
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  TransactionError,
  IdempotencyError
};
