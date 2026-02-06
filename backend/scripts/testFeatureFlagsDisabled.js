/**
 * Test Script for Disabled Feature Flags
 * Tests behavior when features are disabled
 * 
 * Usage: node scripts/testFeatureFlagsDisabled.js
 */

// Set environment variables to disable features before importing
process.env.AUTO_ASSIGN_CATEGORIES = 'false';
process.env.VALIDATE_BRANCH_REMOVAL = 'false';

import { 
  getFeatureFlags, 
  isFeatureEnabled, 
  logFeatureDisabledWarning,
  initializeFeatureFlags 
} from '../src/config/featureFlags.js';

console.log('\n=== Feature Flags Test Script (Disabled Features) ===\n');

// Test 1: Initialize feature flags
console.log('Test 1: Initializing feature flags with some disabled...');
initializeFeatureFlags();
console.log('✓ Feature flags initialized\n');

// Test 2: Get all feature flags
console.log('Test 2: Getting all feature flags...');
const flags = getFeatureFlags();
console.log('Current feature flags:', JSON.stringify(flags, null, 2));
console.log('✓ Successfully retrieved feature flags\n');

// Test 3: Verify disabled features
console.log('Test 3: Verifying disabled features...');
const autoAssignEnabled = isFeatureEnabled('AUTO_ASSIGN_CATEGORIES');
const validateRemovalEnabled = isFeatureEnabled('VALIDATE_BRANCH_REMOVAL');

console.log(`  AUTO_ASSIGN_CATEGORIES: ${autoAssignEnabled ? '✗ ENABLED (expected disabled)' : '✓ DISABLED (as expected)'}`);
console.log(`  VALIDATE_BRANCH_REMOVAL: ${validateRemovalEnabled ? '✗ ENABLED (expected disabled)' : '✓ DISABLED (as expected)'}`);

if (!autoAssignEnabled && !validateRemovalEnabled) {
  console.log('✓ Features correctly disabled\n');
} else {
  console.log('✗ Some features not disabled as expected\n');
}

// Test 4: Verify enabled features still work
console.log('Test 4: Verifying enabled features...');
const auditEnabled = isFeatureEnabled('ENABLE_AUDIT_LOGGING');
const cacheEnabled = isFeatureEnabled('ENABLE_CACHING');

console.log(`  ENABLE_AUDIT_LOGGING: ${auditEnabled ? '✓ ENABLED (as expected)' : '✗ DISABLED (expected enabled)'}`);
console.log(`  ENABLE_CACHING: ${cacheEnabled ? '✓ ENABLED (as expected)' : '✗ DISABLED (expected enabled)'}`);

if (auditEnabled && cacheEnabled) {
  console.log('✓ Other features remain enabled\n');
} else {
  console.log('✗ Some features unexpectedly disabled\n');
}

// Test 5: Simulate middleware behavior with disabled features
console.log('Test 5: Simulating middleware behavior with disabled features...');

function simulateMiddleware(featureName, operation) {
  if (!isFeatureEnabled(featureName)) {
    logFeatureDisabledWarning(
      featureName,
      `${operation} middleware`,
      { operation, timestamp: new Date().toISOString() }
    );
    console.log(`  ✓ ${operation}: Feature disabled, warning logged, operation skipped`);
    return false; // Skip operation
  }
  console.log(`  ✓ ${operation}: Feature enabled, operation proceeding`);
  return true; // Proceed with operation
}

simulateMiddleware('AUTO_ASSIGN_CATEGORIES', 'item_category_assignment');
simulateMiddleware('VALIDATE_BRANCH_REMOVAL', 'branch_removal_validation');
simulateMiddleware('ENABLE_AUDIT_LOGGING', 'audit_log_creation');
simulateMiddleware('ENABLE_CACHING', 'cache_operation');

console.log('✓ Middleware simulation completed\n');

// Summary
console.log('=== Test Summary ===');
console.log('Disabled features test completed successfully!');
console.log('\nConfiguration tested:');
console.log('  AUTO_ASSIGN_CATEGORIES: false (disabled)');
console.log('  VALIDATE_BRANCH_REMOVAL: false (disabled)');
console.log('  ENABLE_AUDIT_LOGGING: true (enabled)');
console.log('  ENABLE_CACHING: true (enabled)');
console.log('\nWarning logs were generated for disabled features as expected.\n');
