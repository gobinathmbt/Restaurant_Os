import { logger } from '../utils/logger.js';

/**
 * Request logger middleware
 * Logs all incoming HTTP requests with method, path, status code, and response time
 */
export const requestLogger = (req, res, next) => {
  // Record start time
  const startTime = Date.now();
  
  // Store original res.json to intercept response
  const originalJson = res.json.bind(res);
  
  // Override res.json to capture when response is sent
  res.json = function(body) {
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Log request details
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
    });
    
    // Call original json method
    return originalJson(body);
  };
  
  next();
};
