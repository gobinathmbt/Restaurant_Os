/**
 * Environment Configuration with Database Fallback
 * Priority: PlatformConfig DB > Environment Variables > Defaults
 * 
 * This module loads configuration from the PlatformConfig database collection
 * and falls back to environment variables if the database is unavailable.
 */

import { logger } from '../utils/logger.js';

// Cache for platform configuration
let configCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Load configuration from PlatformConfig database
 * Falls back to environment variables if database is not available
 * @returns {Promise<Object|null>} Configuration map or null if unavailable
 */
export const loadPlatformConfig = async () => {
  try {
    // Return cached config if still valid
    if (configCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL)) {
      logger.debug('Using cached platform configuration');
      return configCache;
    }

    // Dynamically import PlatformConfig model
    // This allows the module to be loaded before models are defined
    let PlatformConfig;
    try {
      const module = await import('../models/platform/PlatformConfig.js');
      PlatformConfig = module.default;
    } catch (importError) {
      logger.warn('PlatformConfig model not available yet, using environment variables');
      return null;
    }

    // Load all active configs from database
    const configs = await PlatformConfig.find({ isActive: true });
    
    if (!configs || configs.length === 0) {
      logger.warn('No active configurations found in PlatformConfig collection');
      return null;
    }

    const configMap = {};
    configs.forEach(config => {
      configMap[config.configKey] = config.configValue;
    });

    // Cache the configuration
    configCache = configMap;
    cacheTimestamp = Date.now();

    logger.info(`Loaded ${configs.length} configuration(s) from PlatformConfig database`);
    return configMap;

  } catch (error) {
    logger.warn('Failed to load platform config from database, using environment variables:', error.message);
    return null;
  }
};

/**
 * Get configuration value with fallback chain
 * Priority: PlatformConfig DB > Environment Variable > Default Value
 * @param {string} key - Configuration key in database
 * @param {string|null} envKey - Environment variable name (optional)
 * @param {*} defaultValue - Default value if not found (optional)
 * @returns {Promise<*>} Configuration value
 */
export const getConfig = async (key, envKey = null, defaultValue = null) => {
  // Try platform config first
  const platformConfig = await loadPlatformConfig();
  
  if (platformConfig && platformConfig[key] !== undefined) {
    logger.debug(`Using database config for: ${key}`);
    return platformConfig[key];
  }
  
  // Fall back to environment variable
  if (envKey && process.env[envKey]) {
    logger.debug(`Using environment variable for: ${key} (${envKey})`);
    return process.env[envKey];
  }
  
  // Return default value
  if (defaultValue !== null) {
    logger.debug(`Using default value for: ${key}`);
  }
  return defaultValue;
};

/**
 * Clear configuration cache
 * Useful for forcing a reload of configuration
 */
export const clearConfigCache = () => {
  configCache = null;
  cacheTimestamp = null;
  logger.info('Configuration cache cleared');
};

/**
 * Environment configuration object
 * These values are loaded at startup and can be refreshed
 */
export const ENV = {
  // Server configuration (from environment only)
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database URIs (from environment only)
  PLATFORM_DB_URI: process.env.PLATFORM_DB_URI,
  COMPANY_DB_BASE_URI: process.env.COMPANY_DB_BASE_URI,
  
  // Frontend URL (from environment only)
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  // These will be loaded from PlatformConfig database at runtime
  // Fallback to environment variables if database is unavailable
  JWT_SECRET: null,
  JWT_EXPIRE: null,
  GOOGLE_CLIENT_ID: null,
  GOOGLE_CLIENT_SECRET: null,
  GOOGLE_CALLBACK_URL: null,
  
  // Additional configuration that can be added
  RAZORPAY_KEY_ID: null,
  RAZORPAY_KEY_SECRET: null,
  SMTP_HOST: null,
  SMTP_PORT: null,
  SMTP_USER: null,
  SMTP_PASS: null,
  AWS_S3_BUCKET: null,
  AWS_ACCESS_KEY_ID: null,
  AWS_SECRET_ACCESS_KEY: null,
};

/**
 * Initialize runtime configuration from database
 * Call this after database connection is established
 * @returns {Promise<void>}
 */
export const initializeConfig = async () => {
  try {
    logger.info('Initializing platform configuration...');

    // Load authentication configuration
    ENV.JWT_SECRET = await getConfig('JWT_SECRET', 'JWT_SECRET', 'default_jwt_secret_change_me_in_production');
    ENV.JWT_EXPIRE = await getConfig('JWT_EXPIRE', 'JWT_EXPIRE', '7d');
    ENV.GOOGLE_CLIENT_ID = await getConfig('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID');
    ENV.GOOGLE_CLIENT_SECRET = await getConfig('GOOGLE_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET');
    ENV.GOOGLE_CALLBACK_URL = await getConfig('GOOGLE_CALLBACK_URL', 'GOOGLE_CALLBACK_URL', 'http://localhost:5000/api/auth/google/callback');
    
    // Load payment configuration
    ENV.RAZORPAY_KEY_ID = await getConfig('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_ID');
    ENV.RAZORPAY_KEY_SECRET = await getConfig('RAZORPAY_KEY_SECRET', 'RAZORPAY_KEY_SECRET');
    
    // Load email configuration
    ENV.SMTP_HOST = await getConfig('SMTP_HOST', 'SMTP_HOST');
    ENV.SMTP_PORT = await getConfig('SMTP_PORT', 'SMTP_PORT', 587);
    ENV.SMTP_USER = await getConfig('SMTP_USER', 'SMTP_USER');
    ENV.SMTP_PASS = await getConfig('SMTP_PASS', 'SMTP_PASS');
    
    // Load storage configuration
    ENV.AWS_S3_BUCKET = await getConfig('AWS_S3_BUCKET', 'AWS_S3_BUCKET');
    ENV.AWS_ACCESS_KEY_ID = await getConfig('AWS_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID');
    ENV.AWS_SECRET_ACCESS_KEY = await getConfig('AWS_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY');
    
    logger.info('Platform configuration loaded successfully');
    
    // Log configuration sources (without exposing secrets)
    logger.debug('Configuration loaded:', {
      JWT_SECRET: ENV.JWT_SECRET ? '***' : 'not set',
      JWT_EXPIRE: ENV.JWT_EXPIRE,
      GOOGLE_CLIENT_ID: ENV.GOOGLE_CLIENT_ID ? '***' : 'not set',
      RAZORPAY_KEY_ID: ENV.RAZORPAY_KEY_ID ? '***' : 'not set',
      SMTP_HOST: ENV.SMTP_HOST || 'not set',
    });

  } catch (error) {
    logger.error('Failed to initialize platform configuration:', error);
    throw error;
  }
};

/**
 * Validate required configuration
 * Ensures critical configuration values are set
 * @param {string[]} requiredKeys - Array of required configuration keys
 * @throws {Error} If required configuration is missing
 */
export const validateConfig = (requiredKeys = []) => {
  const missing = [];
  
  for (const key of requiredKeys) {
    if (!ENV[key]) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    const errorMsg = `Missing required configuration: ${missing.join(', ')}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  logger.info('Configuration validation passed');
};
