import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PlatformConfig from '../src/models/platform/PlatformConfig.js';
import { logger } from '../src/utils/logger.js';

dotenv.config();

/**
 * Seed script for PlatformConfig collection
 * This script populates the PlatformConfig collection with initial configuration values
 * It is idempotent - will not overwrite existing configurations
 */

const defaultConfigs = [
  {
    configKey: 'JWT_SECRET',
    configValue: process.env.JWT_SECRET || 'default_jwt_secret_change_me_in_production',
    description: 'Secret key for signing JWT tokens',
    category: 'auth',
    isSecret: true,
    isActive: true,
  },
  {
    configKey: 'JWT_EXPIRE',
    configValue: process.env.JWT_EXPIRE || '7d',
    description: 'JWT token expiration time (e.g., 7d, 24h, 60m)',
    category: 'auth',
    isSecret: false,
    isActive: true,
  },
  {
    configKey: 'GOOGLE_CLIENT_ID',
    configValue: process.env.GOOGLE_CLIENT_ID || '',
    description: 'Google OAuth 2.0 Client ID',
    category: 'auth',
    isSecret: false,
    isActive: true,
  },
  {
    configKey: 'GOOGLE_CLIENT_SECRET',
    configValue: process.env.GOOGLE_CLIENT_SECRET || '',
    description: 'Google OAuth 2.0 Client Secret',
    category: 'auth',
    isSecret: true,
    isActive: true,
  },
  {
    configKey: 'GOOGLE_CALLBACK_URL',
    configValue: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
    description: 'Google OAuth callback URL',
    category: 'auth',
    isSecret: false,
    isActive: true,
  },
];

const seedPlatformConfig = async () => {
  try {
    // Connect to platform database
    const PLATFORM_DB_URI = process.env.PLATFORM_DB_URI || 'mongodb://localhost:27017/ros_platform';
    
    logger.info('Connecting to platform database...');
    await mongoose.connect(PLATFORM_DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info('✅ Connected to platform database');

    let insertedCount = 0;
    let skippedCount = 0;

    // Insert each config if it doesn't exist
    for (const config of defaultConfigs) {
      const existingConfig = await PlatformConfig.findOne({ configKey: config.configKey });
      
      if (existingConfig) {
        logger.info(`⏭️  Skipping ${config.configKey} - already exists`);
        skippedCount++;
      } else {
        await PlatformConfig.create(config);
        logger.info(`✅ Inserted ${config.configKey}`);
        insertedCount++;
      }
    }

    logger.info('\n📊 Seed Summary:');
    logger.info(`   - Inserted: ${insertedCount} configurations`);
    logger.info(`   - Skipped: ${skippedCount} configurations (already exist)`);
    logger.info(`   - Total: ${defaultConfigs.length} configurations processed`);
    
    logger.info('\n✅ Platform configuration seeding completed successfully');
    
    // Close database connection
    await mongoose.connection.close();
    logger.info('Database connection closed');
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error seeding platform configuration:', error);
    process.exit(1);
  }
};

// Run the seed script
seedPlatformConfig();
