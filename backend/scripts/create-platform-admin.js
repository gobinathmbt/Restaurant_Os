import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import PlatformAdmin from '../src/models/platform/PlatformAdmin.js';
import { ENV } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';

/**
 * Script to create a Platform Admin
 * Usage: node scripts/create-platform-admin.js
 */

async function createPlatformAdmin() {
  try {
    // Connect to database
    await mongoose.connect(ENV.MONGODB_URI);
    logger.info('Connected to database');

    // Admin details - CHANGE THESE VALUES
    const adminData = {
      name: 'Platform Admin',
      email: 'admin@restaurantos.com',
      password: 'Admin@123', // Change this to a secure password
      platformAdminPrimary: true, // Set to false for secondary admins
      permissions: [
        'manage_companies',
        'manage_subscriptions',
        'manage_platform_config',
        'view_analytics',
        'manage_admins',
      ],
    };

    // Check if admin already exists
    const existingAdmin = await PlatformAdmin.findOne({ email: adminData.email });
    if (existingAdmin) {
      logger.error(`Admin with email ${adminData.email} already exists`);
      process.exit(1);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminData.password, salt);

    // Create admin
    const admin = await PlatformAdmin.create({
      name: adminData.name,
      email: adminData.email,
      password: hashedPassword,
      platformAdminPrimary: adminData.platformAdminPrimary,
      permissions: adminData.permissions,
      isActive: true,
    });

    logger.info('Platform admin created successfully!');
    console.log('\n=================================');
    console.log('Platform Admin Created');
    console.log('=================================');
    console.log('Name:', admin.name);
    console.log('Email:', admin.email);
    console.log('Primary Admin:', admin.platformAdminPrimary);
    console.log('Permissions:', admin.permissions);
    console.log('=================================\n');
    console.log('⚠️  IMPORTANT: Change the default password after first login!');
    console.log('=================================\n');

    process.exit(0);
  } catch (error) {
    logger.error('Error creating platform admin:', error);
    process.exit(1);
  }
}

// Run the script
createPlatformAdmin();
