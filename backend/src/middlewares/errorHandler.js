/**
 * Error Handler Middleware
 * Centralized error handling for Express application
 * Formats error responses and logs errors appropriately
 */

import { logger } from '../utils/logger.js';

/**
 * Global error handler middleware
 * Must be registered after all routes
 * 
 * @param {Error} err - Error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export const errorHandler = (err, req, res, next) => {
  // Log the error with full details
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Determine status code (default to 500 if not set)
  const statusCode = err.statusCode || err.status || 500;

  // Prepare error response
  const errorResponse = {
    success: false,
    message: err.message || 'Internal Server Error',
  };

  // Include stack trace only in development environment
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.error = err;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Custom error class for application errors
 * Allows setting custom status codes and messages
 */
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async handler wrapper to catch errors in async route handlers
 * Eliminates need for try-catch blocks in every async route
 * 
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function with error handling
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
