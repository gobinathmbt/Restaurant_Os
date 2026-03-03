/**
 * Stock Transfer Exception Error Handler Middleware
 * 
 * Enhanced error handling middleware for stock transfer exception operations.
 * Integrates with custom error classes and provides structured error responses.
 * 
 * Requirements: 11.7
 */

import { logger } from '../utils/logger.js';
import { ENV } from '../config/env.js';
import {
  StockTransferExceptionError,
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  TransactionError,
  IdempotencyError,
  isOperationalError,
  formatErrorForLogging
} from '../utils/stockTransferExceptionErrors.js';

/**
 * Enhanced error handler for stock transfer exception operations
 * 
 * This middleware:
 * - Maps custom error classes to appropriate HTTP status codes
 * - Formats error responses with code, message, and additional context
 * - Logs errors with appropriate severity levels
 * - Handles notification failures gracefully (log but don't throw)
 * - Provides detailed error information in development mode
 * 
 * @param {Error} err - Error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export const stockTransferExceptionErrorHandler = (err, req, res, next) => {
  // Extract request context for logging
  const context = {
    path: req.path,
    method: req.method,
    userId: req.user?._id,
    companyId: req.user?.companyId,
    requestId: err.requestId || req.headers['x-request-id'],
    additionalContext: {
      transferId: req.params?.transferId,
      exceptionId: req.params?.exceptionId,
      idempotencyKey: req.headers['idempotency-key']
    }
  };

  // Determine if this is an operational error
  const operational = isOperationalError(err);

  // Log error with appropriate severity
  if (operational) {
    // Operational errors are expected and logged at warn level
    logger.warn('Operational error in stock transfer exception handling:', 
      formatErrorForLogging(err, context)
    );
  } else {
    // Unexpected errors are logged at error level with full stack trace
    logger.error('Unexpected error in stock transfer exception handling:', 
      formatErrorForLogging(err, context)
    );
  }

  // Determine status code
  let statusCode = 500;
  let errorResponse;

  // Handle custom error classes
  if (err instanceof StockTransferExceptionError) {
    statusCode = err.statusCode;
    errorResponse = err.toJSON();
  } 
  // Handle validation errors
  else if (err instanceof ValidationError) {
    statusCode = 400;
    errorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        field: err.field,
        value: err.value,
        ...err.details,
        requestId: err.requestId,
        timestamp: err.timestamp
      }
    };
  }
  // Handle authorization errors
  else if (err instanceof AuthorizationError) {
    statusCode = 403;
    errorResponse = {
      success: false,
      error: {
        code: 'AUTHORIZATION_ERROR',
        message: err.message,
        requiredRole: err.requiredRole,
        ...err.details,
        requestId: err.requestId,
        timestamp: err.timestamp
      }
    };
  }
  // Handle not found errors
  else if (err instanceof NotFoundError) {
    statusCode = 404;
    errorResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: err.message,
        resourceType: err.resourceType,
        resourceId: err.resourceId,
        ...err.details,
        requestId: err.requestId,
        timestamp: err.timestamp
      }
    };
  }
  // Handle conflict errors (including idempotency errors)
  else if (err instanceof ConflictError || err instanceof IdempotencyError) {
    statusCode = 409;
    errorResponse = {
      success: false,
      error: {
        code: 'CONFLICT',
        message: err.message,
        conflictType: err.conflictType,
        ...err.details,
        requestId: err.requestId,
        timestamp: err.timestamp
      }
    };
  }
  // Handle transaction errors
  else if (err instanceof TransactionError) {
    statusCode = 500;
    errorResponse = {
      success: false,
      error: {
        code: 'TRANSACTION_ERROR',
        message: err.message,
        operation: err.operation,
        ...err.details,
        requestId: err.requestId,
        timestamp: err.timestamp
      }
    };
  }
  // Handle mongoose validation errors
  else if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    const validationErrors = Object.keys(err.errors).map(key => ({
      field: key,
      message: err.errors[key].message,
      value: err.errors[key].value
    }));
    
    errorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: validationErrors,
        requestId: context.requestId,
        timestamp: new Date().toISOString()
      }
    };
  }
  // Handle mongoose cast errors
  else if (err.name === 'CastError') {
    statusCode = 400;
    errorResponse = {
      success: false,
      error: {
        code: 'INVALID_ID',
        message: `Invalid ${err.path}: ${err.value}`,
        field: err.path,
        value: err.value,
        requestId: context.requestId,
        timestamp: new Date().toISOString()
      }
    };
  }
  // Handle duplicate key errors
  else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0];
    errorResponse = {
      success: false,
      error: {
        code: 'DUPLICATE_KEY',
        message: `Duplicate value for ${field}`,
        field,
        requestId: context.requestId,
        timestamp: new Date().toISOString()
      }
    };
  }
  // Handle generic errors
  else {
    statusCode = err.statusCode || err.status || 500;
    errorResponse = {
      success: false,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred',
        requestId: context.requestId,
        timestamp: new Date().toISOString()
      }
    };
  }

  // Include stack trace and additional details in development mode
  if (ENV.NODE_ENV === 'development' || ENV.NODE_ENV === 'test') {
    errorResponse.error.stack = err.stack;
    errorResponse.error.context = context;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Notification error handler wrapper
 * 
 * Wraps notification operations to handle failures gracefully.
 * Logs notification failures but doesn't throw errors to prevent
 * primary operations from failing due to notification issues.
 * 
 * @param {Function} notificationFn - Async notification function
 * @param {Object} context - Context for logging (operation name, transfer ID, etc.)
 * @returns {Promise<boolean>} True if notification succeeded, false otherwise
 */
export const handleNotificationError = async (notificationFn, context = {}) => {
  try {
    await notificationFn();
    logger.info('Notification sent successfully', context);
    return true;
  } catch (error) {
    // Log notification failure but don't throw
    logger.warn('Notification failed (non-critical):', {
      error: error.message,
      stack: error.stack,
      context
    });
    return false;
  }
};

/**
 * Async handler wrapper for stock transfer exception routes
 * 
 * Wraps async route handlers to catch errors and pass them to error middleware.
 * Eliminates need for try-catch blocks in every async route.
 * 
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function with error handling
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Error response formatter for consistent API responses
 * 
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 * @returns {Object} Formatted error response
 */
export const formatErrorResponse = (statusCode, code, message, details = {}) => {
  return {
    statusCode,
    body: {
      success: false,
      error: {
        code,
        message,
        ...details,
        timestamp: new Date().toISOString()
      }
    }
  };
};

/**
 * Success response formatter for consistent API responses
 * 
 * @param {Object} data - Response data
 * @param {string} message - Success message (optional)
 * @returns {Object} Formatted success response
 */
export const formatSuccessResponse = (data, message = null) => {
  return {
    success: true,
    ...(message && { message }),
    data,
    timestamp: new Date().toISOString()
  };
};
