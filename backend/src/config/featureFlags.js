/**
 * Feature Flags Configuration
 * Centralized feature flag management for category-branch consistency system
 * 
 * Requirements: 10.4, 10.5
 */

import { logger } from '../utils/logger.js';

/**
 * Feature flags for category-branch consistency system
 * These can be controlled via environment variables
 */
const FEATURE_FLAGS = {
  /**
   * Enable/disable automatic category assignment
   * When disabled, categories won't be automatically assigned to branches
   * Default: true (enabled)
   */
  AUTO_ASSIGN_CATEGORIES: process.env.AUTO_ASSIGN_CATEGORIES !== 'false',

  /**
   * Enable/disable branch removal validation
   * When disabled, branch removal won't check for dependencies
   * Default: true (enabled)
   */
  VALIDATE_BRANCH_REMOVAL: process.env.VALIDATE_BRANCH_REMOVAL !== 'false',

  /**
   * Enable/disable audit logging for category-branch operations
   * When disabled, audit logs won't be created
   * Default: true (enabled)
   */
  ENABLE_AUDIT_LOGGING: process.env.ENABLE_AUDIT_LOGGING !== 'false',

  /**
   * Enable/disable caching for category-branch mappings
   * When disabled, all queries will hit the database
   * Default: true (enabled)
   */
  ENABLE_CACHING: process.env.ENABLE_CACHING !== 'false'
};

/**
 * Get the current state of all feature flags
 * @returns {Object} Current feature flag configuration
 */
export const getFeatureFlags = () => {
  return { ...FEATURE_FLAGS };
};

/**
 * Check if a specific feature flag is enabled
 * @param {string} flagName - Name of the feature flag
 * @returns {boolean} True if enabled, false otherwise
 */
export const isFeatureEnabled = (flagName) => {
  if (!(flagName in FEATURE_FLAGS)) {
    logger.warn(`Unknown feature flag: ${flagName}`);
    return false;
  }
  return FEATURE_FLAGS[flagName];
};

/**
 * Log warning when a feature is disabled
 * @param {string} featureName - Name of the feature
 * @param {string} context - Context where the feature was disabled
 * @param {Object} additionalInfo - Additional information to log
 */
export const logFeatureDisabledWarning = (featureName, context, additionalInfo = {}) => {
  logger.warn(`Feature disabled: ${featureName}`, {
    context,
    featureName,
    timestamp: new Date().toISOString(),
    ...additionalInfo
  });
};

/**
 * Initialize feature flags and log their current state
 * Should be called on application startup
 */
export const initializeFeatureFlags = () => {
  logger.info('Category-Branch Consistency Feature Flags:', {
    AUTO_ASSIGN_CATEGORIES: FEATURE_FLAGS.AUTO_ASSIGN_CATEGORIES,
    VALIDATE_BRANCH_REMOVAL: FEATURE_FLAGS.VALIDATE_BRANCH_REMOVAL,
    ENABLE_AUDIT_LOGGING: FEATURE_FLAGS.ENABLE_AUDIT_LOGGING,
    ENABLE_CACHING: FEATURE_FLAGS.ENABLE_CACHING
  });

  // Log warnings for disabled features
  if (!FEATURE_FLAGS.AUTO_ASSIGN_CATEGORIES) {
    logger.warn('AUTO_ASSIGN_CATEGORIES is disabled - categories will not be automatically assigned to branches');
  }

  if (!FEATURE_FLAGS.VALIDATE_BRANCH_REMOVAL) {
    logger.warn('VALIDATE_BRANCH_REMOVAL is disabled - branch removal validation is bypassed');
  }

  if (!FEATURE_FLAGS.ENABLE_AUDIT_LOGGING) {
    logger.warn('ENABLE_AUDIT_LOGGING is disabled - audit logs will not be created');
  }

  if (!FEATURE_FLAGS.ENABLE_CACHING) {
    logger.warn('ENABLE_CACHING is disabled - all queries will hit the database directly');
  }
};

export default FEATURE_FLAGS;
