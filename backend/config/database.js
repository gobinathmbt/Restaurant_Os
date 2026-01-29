/**
 * Database connection utilities for multi-tenant architecture
 * - Platform Database: Stores company registry, subscriptions, platform settings
 * - Company Databases: Each company gets a dedicated database
 */

import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

// Cache for company database connections
const companyConnections = new Map();

// Platform database connection (default mongoose connection)
let platformConnection = null;

/**
 * Connect to the Platform Database
 * This is the main database storing all platform metadata
 */
export async function connectPlatformDB() {
  try {
    const uri = process.env.PLATFORM_DB_URI;
    
    if (!uri) {
      throw new Error('PLATFORM_DB_URI environment variable is not set');
    }

    platformConnection = await mongoose.connect(uri);
    
    logger.info('Platform Database connected successfully', {
      host: platformConnection.connection.host,
      name: platformConnection.connection.name,
    });

    return platformConnection;
  } catch (error) {
    logger.error('Platform Database connection failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Get or create a connection to a Company Database
 * Implements connection caching for efficiency
 * 
 * @param {string} companyId - The unique company identifier
 * @returns {mongoose.Connection} The company database connection
 */
export function getCompanyDB(companyId) {
  try {
    if (!companyId) {
      throw new Error('companyId is required');
    }

    // Return cached connection if exists
    if (companyConnections.has(companyId)) {
      const cachedConnection = companyConnections.get(companyId);
      
      // Check if connection is still valid
      if (cachedConnection.readyState === 1) {
        logger.debug('Using cached company database connection', { companyId });
        return cachedConnection;
      } else {
        // Remove stale connection
        companyConnections.delete(companyId);
      }
    }

    // Create new connection
    const baseUri = process.env.COMPANY_DB_BASE_URI;
    
    if (!baseUri) {
      throw new Error('COMPANY_DB_BASE_URI environment variable is not set');
    }

    const dbName = `company_${companyId}`;
    const uri = baseUri.replace('<dbname>', dbName);

    const connection = mongoose.createConnection(uri);

    // Handle connection events
    connection.on('connected', () => {
      logger.info('Company database connected', { companyId, dbName });
    });

    connection.on('error', (error) => {
      logger.error('Company database connection error', {
        companyId,
        error: error.message,
      });
    });

    connection.on('disconnected', () => {
      logger.warn('Company database disconnected', { companyId });
      companyConnections.delete(companyId);
    });

    // Cache the connection
    companyConnections.set(companyId, connection);

    logger.debug('Created new company database connection', { companyId, dbName });

    return connection;
  } catch (error) {
    logger.error('Failed to get company database connection', {
      companyId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Close all database connections gracefully
 * Should be called during application shutdown
 */
export async function closeAllConnections() {
  try {
    const closePromises = [];

    // Close platform connection
    if (platformConnection && platformConnection.connection.readyState === 1) {
      logger.info('Closing platform database connection');
      closePromises.push(mongoose.connection.close());
    }

    // Close all company connections
    for (const [companyId, connection] of companyConnections.entries()) {
      if (connection.readyState === 1) {
        logger.info('Closing company database connection', { companyId });
        closePromises.push(connection.close());
      }
    }

    await Promise.all(closePromises);

    // Clear the cache
    companyConnections.clear();

    logger.info('All database connections closed successfully');
  } catch (error) {
    logger.error('Error closing database connections', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Get the count of active company connections (for monitoring)
 */
export function getActiveConnectionCount() {
  return companyConnections.size;
}
