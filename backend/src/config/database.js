/**
 * Database Configuration
 * Manages connections to platform database and company-specific databases
 */

import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { ENV } from './env.js';
// Pre-register common company models on new connections to avoid MissingSchemaError
import { getLocationModel } from '../models/company/Location.js';
import { getSupplierModel } from '../models/company/Supplier.js';
import { getCategoryModel } from '../models/company/Category.js';
import { getInventoryItemModel } from '../models/company/InventoryItem.js';
import { getGRNModel } from '../models/company/GRN.js';
import { getStockAdjustmentModel } from '../models/company/StockAdjustment.js';
import { getStockTransferModel } from '../models/company/StockTransfer.js';
import { getStockRequestModel } from '../models/company/StockRequest.js';
import { getStockBackorderModel } from '../models/company/StockBackorder.js';

// Store company database connections for reuse
const companyConnections = new Map();

/**
 * Connect to the Platform Database
 * This database stores company registry, subscriptions, and platform metadata
 * @returns {Promise<void>}
 */
export const connectPlatformDB = async () => {
  try {
    const platformDbUri = ENV.PLATFORM_DB_URI;
    
    if (!platformDbUri) {
      throw new Error('PLATFORM_DB_URI environment variable is not defined');
    }

    const conn = await mongoose.connect(platformDbUri, {
      maxPoolSize: 10, // Connection pooling
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`Platform Database Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('Platform Database connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Platform Database disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('Platform Database reconnected');
    });

  } catch (error) {
    logger.error('Failed to connect to Platform Database:', error);
    throw error;
  }
};

/**
 * Get or create a connection to a company-specific database
 * Each company has its own dedicated database for operational data
 * @param {string} companyId - The unique company identifier
 * @returns {mongoose.Connection} Company database connection
 */
export const getCompanyDB = (companyId) => {
  try {
    // Return existing connection if available
    if (companyConnections.has(companyId)) {
      const existingConnection = companyConnections.get(companyId);
      
      // Check if connection is still valid
      if (existingConnection.readyState === 1) {
        logger.debug(`Reusing existing connection for company: ${companyId}`);
        return existingConnection;
      } else {
        // Remove stale connection
        companyConnections.delete(companyId);
      }
    }

    // Create new connection
    const companyDbBaseUri = ENV.COMPANY_DB_BASE_URI;
    
    if (!companyDbBaseUri) {
      throw new Error('COMPANY_DB_BASE_URI environment variable is not defined');
    }

    const dbName = `company_${companyId}`;
    const companyDbUri = companyDbBaseUri.replace('<dbname>', dbName);

    logger.info(`Creating new database connection for company: ${companyId}`);

    const companyConnection = mongoose.createConnection(companyDbUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    // Handle connection events
    companyConnection.on('connected', () => {
      logger.info(`Company database connected: ${dbName}`);
    });

    companyConnection.on('error', (err) => {
      logger.error(`Company database error for ${companyId}:`, err);
    });

    companyConnection.on('disconnected', () => {
      logger.warn(`Company database disconnected: ${dbName}`);
      companyConnections.delete(companyId);
    });

    // Store connection for reuse
    // Register core company models on this connection immediately to ensure
    // populate() calls find the correct model schema on the connection.
    try {
      getLocationModel(companyConnection);
      getSupplierModel(companyConnection);
      getCategoryModel(companyConnection);
      getInventoryItemModel(companyConnection);
      getGRNModel(companyConnection);
      getStockAdjustmentModel(companyConnection);
      getStockTransferModel(companyConnection);
      getStockRequestModel(companyConnection);
      getStockBackorderModel(companyConnection);
    } catch (regErr) {
      logger.warn('One or more company models failed to register on connection:', regErr);
    }

    companyConnections.set(companyId, companyConnection);

    return companyConnection;

  } catch (error) {
    logger.error(`Failed to connect to company database for ${companyId}:`, error);
    throw error;
  }
};

/**
 * Close all database connections gracefully
 * Should be called during application shutdown
 * @returns {Promise<void>}
 */
export const closeAllConnections = async () => {
  try {
    logger.info('Closing all database connections...');

    // Close platform database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logger.info('Platform database connection closed');
    }

    // Close all company database connections
    const closePromises = [];
    for (const [companyId, connection] of companyConnections.entries()) {
      if (connection.readyState === 1) {
        closePromises.push(
          connection.close().then(() => {
            logger.info(`Company database connection closed: ${companyId}`);
          })
        );
      }
    }

    await Promise.all(closePromises);
    companyConnections.clear();

    logger.info('All database connections closed successfully');

  } catch (error) {
    logger.error('Error closing database connections:', error);
    throw error;
  }
};

/**
 * Setup graceful shutdown handlers
 * Ensures database connections are closed properly on application exit
 */
export const setupGracefulShutdown = () => {
  const shutdown = async (signal) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    
    try {
      await closeAllConnections();
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Handle different termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('UNHANDLED_REJECTION');
  });
};
