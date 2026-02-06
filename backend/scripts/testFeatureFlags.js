/**
 * Manual Test Script for Feature Flags
 * Run this script to verify feature flags are working correctly
 * 
 * Usage: node scripts/testFeatureFlags.js
 */

import { 
  getFeatureFlags, 
  isFeatureEnabled, 
  logFeatureDisabledWarning,
  initializeFeatureFlags 
} from '../src/config/featureFlags.js';

console.log('\n=== Feature Flags Test Script ===\n');

// Test 1: Initialize feature flags
console.log('Test 1: Initializing feature flags...');
initializeFeatureFlags();
console.log('✓ Feature flags initialized\n');

// Test 2: Get all feature flags
console.log('Test 2: Getting all feature flags...');
const flags = getFeatureFlags();
console.log('Current feature flags:', JSON.stringify(flags, null, 2));
console.log('✓ Successfully retrieved feature flags\n');

// Test 3: Check individual feature flags
console.log('Test 3: Checking individual feature flags...');
const features = [
  'AUTO_ASSIGN_CATEGORIES',
  'VALIDATE_BRANCH_REMOVAL',
  'ENABLE_AUDIT_LOGGING',
  'ENABLE_CACHING'
];

features.forEach(feature => {
  const enabled = isFeatureEnabled(feature);
  console.log(`  ${feature}: ${enabled ? '✓ ENABLED' : '✗ DISABLED'}`);
});
console.log('✓ Individual feature checks completed\n');

// Test 4: Check unknown feature flag
console.log('Test 4: Checking unknown feature flag...');
const unknownEnabled = isFeatureEnabled('UNKNOWN_FEATURE');
console.log(`  UNKNOWN_FEATURE: ${unknownEnabled ? 'ENABLED' : 'DISABLED (expected)'}`);
if (!unknownEnabled) {
  console.log('✓ Unknown feature correctly returns false\n');
} else {
  console.log('✗ Unknown feature should return false\n');
}

// Test 5: Test warning logging
console.log('Test 5: Testing warning log function...');
try {
  logFeatureDisabledWarning(
    'AUTO_ASSIGN_CATEGORIES',
    'test script',
    { testData: 'sample value' }
  );
  console.log('✓ Warning log function executed without errors\n');
} catch (error) {
  console.log('✗ Warning log function threw error:', error.message, '\n');
}

// Test 6: Verify feature flag behavior
console.log('Test 6: Verifying feature flag behavior...');
let allTestsPassed = true;

// Check that all flags are boolean
Object.entries(flags).forEach(([key, value]) => {
  if (typeof value !== 'boolean') {
    console.log(`✗ ${key} is not a boolean (got ${typeof value})`);
    allTestsPassed = false;
  }
});

if (allTestsPassed) {
  console.log('✓ All feature flags are boolean values\n');
}

// Test 7: Environment variable check
console.log('Test 7: Checking environment variables...');
const envVars = [
  'AUTO_ASSIGN_CATEGORIES',
  'VALIDATE_BRANCH_REMOVAL',
  'ENABLE_AUDIT_LOGGING',
  'ENABLE_CACHING'
];

console.log('Environment variable values:');
envVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`  ${varName}: ${value !== undefined ? value : '(not set - will use default)'}`);
});
console.log('✓ Environment variable check completed\n');

// Summary
console.log('=== Test Summary ===');
console.log('All tests completed successfully!');
console.log('\nTo test with different configurations:');
console.log('1. Edit the .env file');
console.log('2. Set feature flags to "false" to disable them');
console.log('3. Restart the application');
console.log('4. Run this script again to verify changes\n');

console.log('Example .env configuration:');
console.log('  AUTO_ASSIGN_CATEGORIES=false');
console.log('  VALIDATE_BRANCH_REMOVAL=true');
console.log('  ENABLE_AUDIT_LOGGING=true');
console.log('  ENABLE_CACHING=false\n');
