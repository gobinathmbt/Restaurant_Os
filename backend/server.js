/**
 * Restaurant Operating System (ROS) - Backend Server
 * Main entry point for the Express application
 * 
 * This server:
 * 1. Connects to the platform database
 * 2. Loads configuration from PlatformConfig collection
 * 3. Sets up routes and middleware
 * 4. Handles graceful shutdown
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { connectPlatformDB, setupGracefulShutdown } from './src/config/database.js';
import { initializeConfig, setupConfigRefresh, ENV } from './src/config/env.js';
import { errorHandler } from './src/middlewares/errorHandler.js';
import { logger } from './src/utils/logger.js';
import authRoutes from './src/routes/authRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import branchRoutes from './src/routes/branchRoutes.js';
import locationRoutes from './src/routes/locationRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import platformConfigRoutes from './src/routes/platformConfigRoutes.js';
import inventoryRoutes from './src/routes/inventory.js';
import recipeRoutes from './src/routes/recipes.js';
import supplierRoutes from './src/routes/suppliers.js';
import categoryRoutes from './src/routes/categories.js';
import menuRoutes from './src/routes/menuRoutes.js';
import stockTransferRoutes from './src/routes/stockTransferRoutes.js';
import stockAdjustmentRoutes from './src/routes/stockAdjustmentRoutes.js';
import grnRoutes from './src/routes/grnRoutes.js';
import reportingRoutes from './src/routes/reportingRoutes.js';
import socketManager from './src/config/socket.js';

// Load environment variables from .env file
dotenv.config();

// Create Express application
const app = express();
const server = http.createServer(app);

// Configure middleware
app.use(cors({
  origin: ENV.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Start the server
 * Initializes database connection, loads configuration, and starts listening
 */
const startServer = async () => {
  try {
    logger.info('Starting Restaurant Operating System Backend...');

    // Step 1: Connect to Platform Database
    logger.info('Step 1: Connecting to Platform Database...');
    await connectPlatformDB();

    // Step 2: Initialize configuration from PlatformConfig collection
    logger.info('Step 2: Loading platform configuration...');
    await initializeConfig();

    // Step 2.5: Setup automatic configuration refresh every 5 minutes
    setupConfigRefresh();

    // Step 3: Initialize Socket.IO
    logger.info('Step 3: Initializing Socket.IO...');
    socketManager.initialize(server);

    // Step 4: Setup routes
    logger.info('Step 4: Setting up routes...');
    app.use('/api/auth', authRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/branches', branchRoutes);
    app.use('/api/locations', locationRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/platform-config', platformConfigRoutes);
    app.use('/api/inventory', inventoryRoutes);
    app.use('/api/recipes', recipeRoutes);
    app.use('/api/suppliers', supplierRoutes);
    app.use('/api/categories', categoryRoutes);
    app.use('/api/menu', menuRoutes);
    app.use('/api/transfers', stockTransferRoutes);
    app.use('/api/adjustments', stockAdjustmentRoutes);
    app.use('/api/grn', grnRoutes);
    app.use('/api/reports', reportingRoutes);

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({
        success: true,
        status: 'OK',
        message: 'ROS Backend is running',
        timestamp: new Date().toISOString(),
        environment: ENV.NODE_ENV,
      });
    });

    // Root endpoint
    app.get('/', (req, res) => {
      res.status(200).json({
        success: true,
        message: 'Welcome to Restaurant Operating System API',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          auth: '/api/auth',
        },
      });
    });

    // 404 handler for undefined routes
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.path,
      });
    });

    // Error handler middleware (must be last)
    app.use(errorHandler);

    // Step 5: Start server
    server.listen(ENV.PORT, () => {
      logger.info(`Server running on port ${ENV.PORT}`);
      logger.info(`Environment: ${ENV.NODE_ENV}`);
      logger.info(`Health check: http://localhost:${ENV.PORT}/health`);
      logger.info('Restaurant Operating System Backend is ready! 🚀');
    });

    // Setup graceful shutdown handlers
    setupGracefulShutdown();

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
