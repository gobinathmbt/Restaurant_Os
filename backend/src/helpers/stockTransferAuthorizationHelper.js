import CompanyUser from '../models/platform/CompanyUser.js';
import { logger } from '../utils/logger.js';

/**
 * Stock Transfer Authorization Helper
 * 
 * Provides authorization functions for stock transfer exception handling.
 * Includes caching for performance optimization at scale (5000+ branches).
 */

// Cache for super admins (5-minute TTL)
const superAdminCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cache for senior management (5-minute TTL)
const seniorManagementCache = new Map();

/**
 * Check if user is a destination admin for a transfer
 * 
 * @param {Object} user - User object from req.user
 * @param {Object} transfer - Stock transfer object with destinationLocation
 * @returns {boolean} True if user is admin of destination location
 */
export const isDestinationAdmin = (user, transfer) => {
  if (!user || !transfer || !transfer.destinationLocation) {
    logger.warn('isDestinationAdmin: Invalid parameters', {
      hasUser: !!user,
      hasTransfer: !!transfer,
      hasDestination: !!(transfer && transfer.destinationLocation)
    });
    return false;
  }

  // Extract destination location ID (handle both ObjectId and populated object)
  const destinationLocationId = transfer.destinationLocation._id 
    ? transfer.destinationLocation._id.toString() 
    : transfer.destinationLocation.toString();

  // Super admins have access to all locations
  if (isSuperAdmin(user)) {
    logger.debug('isDestinationAdmin: Super admin access granted', {
      userId: user.userId,
      destinationLocationId
    });
    return true;
  }

  // Check if user has access to destination location
  const branchIds = (user.branchIds || []).map(id => id.toString());
  const warehouseIds = (user.warehouseIds || []).map(id => id.toString());

  const hasAccess = branchIds.includes(destinationLocationId) || 
                    warehouseIds.includes(destinationLocationId);

  logger.debug('isDestinationAdmin: Access check', {
    userId: user.userId,
    destinationLocationId,
    hasAccess,
    branchIds,
    warehouseIds
  });

  return hasAccess;
};

/**
 * Check if user is a super admin
 * 
 * @param {Object} user - User object from req.user
 * @returns {boolean} True if user has super admin role
 */
export const isSuperAdmin = (user) => {
  if (!user || !user.role) {
    return false;
  }

  return user.role === 'company_super_admin_primary' || 
         user.role === 'company_super_admin_secondary';
};

/**
 * Check if user has access to a specific location
 * 
 * @param {Object} user - User object from req.user
 * @param {string} locationId - Location ID to check
 * @returns {boolean} True if user has access to location
 */
export const hasLocationAccess = (user, locationId) => {
  if (!user || !locationId) {
    return false;
  }

  // Super admins have access to all locations
  if (isSuperAdmin(user)) {
    return true;
  }

  // Convert locationId to string for comparison
  const locationIdStr = locationId.toString();

  // Check if locationId is in user's branchIds or warehouseIds
  const branchIds = (user.branchIds || []).map(id => id.toString());
  const warehouseIds = (user.warehouseIds || []).map(id => id.toString());

  return branchIds.includes(locationIdStr) || warehouseIds.includes(locationIdStr);
};

/**
 * Get all super admins for a company with 5-minute cache
 * 
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Array of super admin user objects
 */
export const getSuperAdmins = async (companyId) => {
  if (!companyId) {
    logger.warn('getSuperAdmins: No companyId provided');
    return [];
  }

  // Check cache first
  const cacheKey = `superadmins_${companyId}`;
  const cached = superAdminCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    logger.debug('getSuperAdmins: Returning cached result', {
      companyId,
      count: cached.data.length,
      age: Date.now() - cached.timestamp
    });
    return cached.data;
  }

  try {
    // Query database for super admins
    const superAdmins = await CompanyUser.find({
      companyId,
      role: {
        $in: ['company_super_admin_primary', 'company_super_admin_secondary']
      },
      isActive: true
    })
    .select('_id userId email firstName lastName role branchIds warehouseIds')
    .lean();

    logger.info('getSuperAdmins: Fetched from database', {
      companyId,
      count: superAdmins.length
    });

    // Update cache
    superAdminCache.set(cacheKey, {
      data: superAdmins,
      timestamp: Date.now()
    });

    return superAdmins;
  } catch (error) {
    logger.error('getSuperAdmins: Database query failed', {
      companyId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get senior management users for escalation notifications
 * Includes super admins and company admins with elevated privileges
 * 
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Array of senior management user objects
 */
export const getSeniorManagement = async (companyId) => {
  if (!companyId) {
    logger.warn('getSeniorManagement: No companyId provided');
    return [];
  }

  // Check cache first
  const cacheKey = `seniormanagement_${companyId}`;
  const cached = seniorManagementCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    logger.debug('getSeniorManagement: Returning cached result', {
      companyId,
      count: cached.data.length,
      age: Date.now() - cached.timestamp
    });
    return cached.data;
  }

  try {
    // Query database for senior management
    // Includes super admins and company admins (branch admins with elevated privileges)
    const seniorManagement = await CompanyUser.find({
      companyId,
      role: {
        $in: [
          'company_super_admin_primary',
          'company_super_admin_secondary',
          'company_admin' // Branch admins who may need escalation visibility
        ]
      },
      isActive: true
    })
    .select('_id userId email firstName lastName role branchIds warehouseIds')
    .lean();

    logger.info('getSeniorManagement: Fetched from database', {
      companyId,
      count: seniorManagement.length
    });

    // Update cache
    seniorManagementCache.set(cacheKey, {
      data: seniorManagement,
      timestamp: Date.now()
    });

    return seniorManagement;
  } catch (error) {
    logger.error('getSeniorManagement: Database query failed', {
      companyId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Clear authorization caches (useful for testing or after user role changes)
 * 
 * @param {string} companyId - Optional company ID to clear specific cache
 */
export const clearAuthorizationCache = (companyId = null) => {
  if (companyId) {
    superAdminCache.delete(`superadmins_${companyId}`);
    seniorManagementCache.delete(`seniormanagement_${companyId}`);
    logger.info('clearAuthorizationCache: Cleared cache for company', { companyId });
  } else {
    superAdminCache.clear();
    seniorManagementCache.clear();
    logger.info('clearAuthorizationCache: Cleared all caches');
  }
};

/**
 * Get cache statistics (useful for monitoring)
 * 
 * @returns {Object} Cache statistics
 */
export const getAuthorizationCacheStats = () => {
  return {
    superAdminCache: {
      size: superAdminCache.size,
      entries: Array.from(superAdminCache.keys())
    },
    seniorManagementCache: {
      size: seniorManagementCache.size,
      entries: Array.from(seniorManagementCache.keys())
    },
    ttlMs: CACHE_TTL_MS
  };
};
