/**
 * Idempotency Service
 * Provides idempotency key caching for network reliability
 * Uses MongoDB for persistent storage with 5-minute TTL and in-memory cache for performance
 */

import { logger } from '../utils/logger.js';
import { getIdempotencyRecordModel } from '../models/company/IdempotencyRecord.js';

// In-memory cache for fast lookups (5-minute TTL)
const memoryCache = new Map();

/**
 * Check if idempotency key has been processed and store if not
 * @param {string} key - Idempotency key
 * @param {Object} companyDB - Company database connection
 * @param {string} userId - User ID for audit trail
 * @param {string} operationType - Type of operation (default: 'OTHER')
 * @returns {Promise<boolean>} True if key already exists (duplicate request)
 */
export const checkAndStore = async (key, companyDB, userId = null, operationType = 'OTHER') => {
  try {
    if (!key || !companyDB) return false;
    
    const cacheKey = `idempotency:${key}`;
    
    // Check memory cache first for performance
    if (memoryCache.has(cacheKey)) {
      const entry = memoryCache.get(cacheKey);
      if (entry.expiresAt > Date.now()) {
        logger.debug(`Idempotency key found in memory cache: ${key}`);
        return true;
      } else {
        // Expired, remove it
        memoryCache.delete(cacheKey);
      }
    }
    
    // Check MongoDB
    try {
      const IdempotencyRecord = getIdempotencyRecordModel(companyDB);
      
      const existingRecord = await IdempotencyRecord.findOne({ 
        idempotencyKey: key 
      });
      
      if (existingRecord) {
        logger.debug(`Idempotency key found in MongoDB: ${key}`);
        
        // Cache in memory for faster subsequent lookups
        memoryCache.set(cacheKey, {
          timestamp: Date.now(),
          expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
        });
        
        return true;
      }
      
      // Key doesn't exist, create new record
      await IdempotencyRecord.create({
        idempotencyKey: key,
        operationType,
        status: 'processing',
        requestedBy: userId,
        requestDate: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes TTL
      });
      
      // Cache in memory
      memoryCache.set(cacheKey, {
        timestamp: Date.now(),
        expiresAt: Date.now() + (5 * 60 * 1000)
      });
      
      logger.debug(`Idempotency key stored in MongoDB: ${key}`);
      return false;
      
    } catch (dbError) {
      // Handle duplicate key error (race condition)
      if (dbError.code === 11000) {
        logger.debug(`Idempotency key already exists (race condition): ${key}`);
        return true;
      }
      
      logger.error('MongoDB operation failed:', dbError);
      // On error, allow the request to proceed
      return false;
    }
    
  } catch (error) {
    logger.error('Error checking idempotency key:', error);
    // On error, allow the request to proceed
    return false;
  }
};

/**
 * Check if idempotency key was already processed
 * @param {string} key - Idempotency key
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<boolean>} True if key exists
 */
export const isProcessed = async (key, companyDB) => {
  try {
    if (!key || !companyDB) return false;
    
    const cacheKey = `idempotency:${key}`;
    
    // Check memory cache first
    if (memoryCache.has(cacheKey)) {
      const entry = memoryCache.get(cacheKey);
      if (entry.expiresAt > Date.now()) {
        return true;
      } else {
        memoryCache.delete(cacheKey);
      }
    }
    
    // Check MongoDB
    try {
      const IdempotencyRecord = getIdempotencyRecordModel(companyDB);
      const record = await IdempotencyRecord.findOne({ idempotencyKey: key });
      return !!record;
      
    } catch (dbError) {
      logger.error('MongoDB operation failed:', dbError);
      return false;
    }
    
  } catch (error) {
    logger.error('Error checking if idempotency key is processed:', error);
    return false;
  }
};

/**
 * Store response for idempotency key
 * @param {string} key - Idempotency key
 * @param {*} response - Response to cache
 * @param {Object} companyDB - Company database connection
 * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
 * @returns {Promise<void>}
 */
export const set = async (key, response, companyDB, ttl = 300) => {
  try {
    if (!key || !companyDB) return;
    
    const cacheKey = `idempotency:${key}`;
    
    // Update MongoDB record
    try {
      const IdempotencyRecord = getIdempotencyRecordModel(companyDB);
      
      await IdempotencyRecord.findOneAndUpdate(
        { idempotencyKey: key },
        {
          responseData: response,
          status: 'completed',
          completedDate: new Date(),
          expiresAt: new Date(Date.now() + ttl * 1000)
        },
        { upsert: false }
      );
      
      logger.debug(`Idempotency response cached in MongoDB for key: ${key}`);
      
    } catch (dbError) {
      logger.error('MongoDB operation failed:', dbError);
    }
    
    // Cache in memory for faster access
    memoryCache.set(cacheKey, {
      response,
      timestamp: Date.now(),
      expiresAt: Date.now() + (ttl * 1000)
    });
    
    logger.debug(`Idempotency response cached in memory for key: ${key}`);
    
  } catch (error) {
    logger.error('Error storing idempotency response:', error);
  }
};

/**
 * Get cached response for idempotency key
 * @param {string} key - Idempotency key
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<*>} Cached response or null
 */
export const get = async (key, companyDB) => {
  try {
    if (!key || !companyDB) return null;
    
    const cacheKey = `idempotency:${key}`;
    
    // Check memory cache first for performance
    if (memoryCache.has(cacheKey)) {
      const entry = memoryCache.get(cacheKey);
      if (entry.expiresAt > Date.now()) {
        logger.debug(`Idempotency response retrieved from memory cache: ${key}`);
        return entry.response;
      } else {
        memoryCache.delete(cacheKey);
      }
    }
    
    // Check MongoDB
    try {
      const IdempotencyRecord = getIdempotencyRecordModel(companyDB);
      const record = await IdempotencyRecord.findOne({ idempotencyKey: key });
      
      if (record && record.responseData) {
        logger.debug(`Idempotency response retrieved from MongoDB: ${key}`);
        
        // Cache in memory for faster subsequent access
        memoryCache.set(cacheKey, {
          response: record.responseData,
          timestamp: Date.now(),
          expiresAt: Date.now() + (5 * 60 * 1000)
        });
        
        return record.responseData;
      }
      
    } catch (dbError) {
      logger.error('MongoDB operation failed:', dbError);
    }
    
    return null;
    
  } catch (error) {
    logger.error('Error getting idempotency response:', error);
    return null;
  }
};

/**
 * Clean up expired entries (run periodically)
 * Only cleans memory cache - MongoDB TTL index handles database cleanup automatically
 */
export const cleanup = () => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug(`Cleaned up ${cleaned} expired idempotency entries from memory cache`);
  }
};

// Run cleanup every minute
setInterval(cleanup, 60 * 1000);

export default {
  checkAndStore,
  isProcessed,
  set,
  get,
  cleanup
};
