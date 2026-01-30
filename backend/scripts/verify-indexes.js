import mongoose from 'mongoose';
import { ENV } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';
import Company from '../src/models/platform/Company.js';
import CompanyUser from '../src/models/platform/CompanyUser.js';
import PlatformAdmin from '../src/models/platform/PlatformAdmin.js';
import PlatformConfig from '../src/models/platform/PlatformConfig.js';
import RefreshToken from '../src/models/platform/RefreshToken.js';

/**
 * Script to verify all database indexes are created correctly
 * Usage: node scripts/verify-indexes.js
 */

const EXPECTED_INDEXES = {
  companies: 9,
  companyusers: 11,
  platformadmins: 8,
  platformconfigs: 7,
  refreshtokens: 8,
};

async function verifyIndexes() {
  try {
    // Connect to database
    await mongoose.connect(ENV.MONGODB_URI);
    logger.info('Connected to database');

    console.log('\n=================================');
    console.log('Database Index Verification');
    console.log('=================================\n');

    let allPassed = true;

    // Check Company indexes
    const companyIndexes = await Company.collection.getIndexes();
    const companyCount = Object.keys(companyIndexes).length;
    const companyPassed = companyCount === EXPECTED_INDEXES.companies;
    
    console.log(`📊 Company Model:`);
    console.log(`   Expected: ${EXPECTED_INDEXES.companies} indexes`);
    console.log(`   Found: ${companyCount} indexes`);
    console.log(`   Status: ${companyPassed ? '✅ PASS' : '❌ FAIL'}`);
    if (!companyPassed) {
      console.log('   Indexes:', Object.keys(companyIndexes));
      allPassed = false;
    }
    console.log();

    // Check CompanyUser indexes
    const companyUserIndexes = await CompanyUser.collection.getIndexes();
    const companyUserCount = Object.keys(companyUserIndexes).length;
    const companyUserPassed = companyUserCount === EXPECTED_INDEXES.companyusers;
    
    console.log(`👥 CompanyUser Model:`);
    console.log(`   Expected: ${EXPECTED_INDEXES.companyusers} indexes`);
    console.log(`   Found: ${companyUserCount} indexes`);
    console.log(`   Status: ${companyUserPassed ? '✅ PASS' : '❌ FAIL'}`);
    if (!companyUserPassed) {
      console.log('   Indexes:', Object.keys(companyUserIndexes));
      allPassed = false;
    }
    console.log();

    // Check PlatformAdmin indexes
    const platformAdminIndexes = await PlatformAdmin.collection.getIndexes();
    const platformAdminCount = Object.keys(platformAdminIndexes).length;
    const platformAdminPassed = platformAdminCount === EXPECTED_INDEXES.platformadmins;
    
    console.log(`🔐 PlatformAdmin Model:`);
    console.log(`   Expected: ${EXPECTED_INDEXES.platformadmins} indexes`);
    console.log(`   Found: ${platformAdminCount} indexes`);
    console.log(`   Status: ${platformAdminPassed ? '✅ PASS' : '❌ FAIL'}`);
    if (!platformAdminPassed) {
      console.log('   Indexes:', Object.keys(platformAdminIndexes));
      allPassed = false;
    }
    console.log();

    // Check PlatformConfig indexes
    const platformConfigIndexes = await PlatformConfig.collection.getIndexes();
    const platformConfigCount = Object.keys(platformConfigIndexes).length;
    const platformConfigPassed = platformConfigCount === EXPECTED_INDEXES.platformconfigs;
    
    console.log(`⚙️  PlatformConfig Model:`);
    console.log(`   Expected: ${EXPECTED_INDEXES.platformconfigs} indexes`);
    console.log(`   Found: ${platformConfigCount} indexes`);
    console.log(`   Status: ${platformConfigPassed ? '✅ PASS' : '❌ FAIL'}`);
    if (!platformConfigPassed) {
      console.log('   Indexes:', Object.keys(platformConfigIndexes));
      allPassed = false;
    }
    console.log();

    // Check RefreshToken indexes
    const refreshTokenIndexes = await RefreshToken.collection.getIndexes();
    const refreshTokenCount = Object.keys(refreshTokenIndexes).length;
    const refreshTokenPassed = refreshTokenCount === EXPECTED_INDEXES.refreshtokens;
    
    console.log(`🔑 RefreshToken Model:`);
    console.log(`   Expected: ${EXPECTED_INDEXES.refreshtokens} indexes`);
    console.log(`   Found: ${refreshTokenCount} indexes`);
    console.log(`   Status: ${refreshTokenPassed ? '✅ PASS' : '❌ FAIL'}`);
    if (!refreshTokenPassed) {
      console.log('   Indexes:', Object.keys(refreshTokenIndexes));
      allPassed = false;
    }
    console.log();

    // Summary
    console.log('=================================');
    if (allPassed) {
      console.log('✅ All indexes verified successfully!');
      console.log('=================================\n');
      
      // Show detailed index information
      console.log('📋 Detailed Index Information:\n');
      
      console.log('Company Indexes:');
      Object.keys(companyIndexes).forEach(name => {
        console.log(`  - ${name}`);
      });
      console.log();
      
      console.log('CompanyUser Indexes:');
      Object.keys(companyUserIndexes).forEach(name => {
        console.log(`  - ${name}`);
      });
      console.log();
      
      console.log('PlatformAdmin Indexes:');
      Object.keys(platformAdminIndexes).forEach(name => {
        console.log(`  - ${name}`);
      });
      console.log();
      
      console.log('PlatformConfig Indexes:');
      Object.keys(platformConfigIndexes).forEach(name => {
        console.log(`  - ${name}`);
      });
      console.log();
      
      console.log('RefreshToken Indexes:');
      Object.keys(refreshTokenIndexes).forEach(name => {
        console.log(`  - ${name}`);
      });
      console.log();
      
      // Check for TTL index
      const ttlIndex = refreshTokenIndexes['expiresAt_1'];
      if (ttlIndex && ttlIndex.expireAfterSeconds) {
        console.log('⏰ TTL Index Configuration:');
        console.log(`   Field: expiresAt`);
        console.log(`   Expires After: ${ttlIndex.expireAfterSeconds} seconds (${ttlIndex.expireAfterSeconds / 86400} days)`);
        console.log('   Status: ✅ Active\n');
      }
      
      process.exit(0);
    } else {
      console.log('❌ Some indexes are missing or incorrect!');
      console.log('=================================\n');
      console.log('💡 To fix:');
      console.log('   1. Restart the application to create indexes');
      console.log('   2. Or manually create indexes using MongoDB shell');
      console.log('   3. Check model files for index definitions\n');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Error verifying indexes:', error);
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
verifyIndexes();
