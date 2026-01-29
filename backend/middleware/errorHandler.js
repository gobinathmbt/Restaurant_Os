/**
 * Custom AppError class for application-specific errors
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
 * Error handler middleware
 * Catches all errors and formats them into consistent responses
 * Hides stack traces in production environment
 */
export const errorHandler = (err, req, res, next) => {
  // Default to 500 Internal Server Error if no status code is set
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  // Log error for debugging
  console.error('❌ Error:', {
    message: err.message,
    statusCode,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  
  // Build error response
  const errorResponse = {
    success: false,
    message,
  };
  
  // Include stack trace only in development environment
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  // Send error response
  res.status(statusCode).json(errorResponse);
};
