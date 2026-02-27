import { logger } from '../utils/logger.js';

/**
 * Location-Based Access Control Middleware
 * Validates that users have access to specific locations based on their role and assigned locations
 * 
 * Super Admins (company_super_admin_primary, company_super_admin_secondary):
 *   - Have access to ALL locations (empty branchIds/warehouseIds = all access)
 * 
 * Other roles (company_admin, warehouse_admin, employee):
 *   - Have access ONLY to locations in their branchIds or warehouseIds arrays
 * 
 * Usage:
 *   - Apply after authenticate middleware
 *   - Expects locationId in req.params, req.body, or req.query
 *   - Can specify custom location field name via options
 */

/**
 * Check if user is a Super Admin
 * @param {string} role - User role
 * @returns {boolean} True if user is Super Admin
 */
const isSuperAdmin = (role) => {
  return role === 'company_super_admin_primary' || role === 'company_super_admin_secondary';
};

/**
 * Validate Location Access Middleware
 * Checks if user has access to the specified location
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.locationField - Field name containing locationId (default: 'locationId')
 * @param {string} options.source - Where to look for locationId: 'params', 'body', 'query', or 'any' (default: 'any')
 * @param {string} options.errorMessage - Custom error message (optional)
 * @returns {Function} Express middleware function
 */
export const validateLocationAccess = (options = {}) => {
  const {
    locationField = 'locationId',
    source = 'any',
    errorMessage = null
  } = options;

  return (req, res, next) => {
    try {
      // Check if user is authenticated (should be set by authenticate middleware)
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Extract locationId from request based on source
      let locationId;
      
      if (source === 'params' || source === 'any') {
        locationId = req.params[locationField];
      }
      
      if (!locationId && (source === 'body' || source === 'any')) {
        locationId = req.body[locationField];
      }
      
      if (!locationId && (source === 'query' || source === 'any')) {
        locationId = req.query[locationField];
      }

      // If no locationId found, return error
      if (!locationId) {
        logger.warn('Location access validation failed: No locationId provided', {
          userId: req.user.userId,
          locationField,
          source
        });

        return res.status(400).json({
          success: false,
          message: `Location identifier (${locationField}) is required`
        });
      }

      // Super Admins have access to ALL locations
      if (isSuperAdmin(req.user.role)) {
        logger.debug('Location access granted: Super Admin', {
          userId: req.user.userId,
          role: req.user.role,
          locationId
        });
        return next();
      }

      // For non-Super Admins, check if locationId is in their branchIds or warehouseIds
      const branchIds = req.user.branchIds || [];
      const warehouseIds = req.user.warehouseIds || [];

      const hasAccess = branchIds.includes(locationId) || warehouseIds.includes(locationId);

      if (!hasAccess) {
        logger.warn('Location access denied', {
          userId: req.user.userId,
          role: req.user.role,
          locationId,
          branchIds,
          warehouseIds
        });

        return res.status(403).json({
          success: false,
          message: errorMessage || 'Access denied. You do not have permission to access this location.'
        });
      }

      logger.debug('Location access granted', {
        userId: req.user.userId,
        role: req.user.role,
        locationId
      });

      next();
    } catch (error) {
      logger.error('Location access validation error', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to validate location access'
      });
    }
  };
};

/**
 * Validate Multiple Locations Access Middleware
 * Checks if user has access to multiple locations (e.g., destinationLocation and sourceLocation)
 * 
 * @param {Object} options - Configuration options
 * @param {string[]} options.locationFields - Array of field names containing locationIds
 * @param {string} options.source - Where to look for locationIds: 'params', 'body', 'query', or 'any' (default: 'any')
 * @returns {Function} Express middleware function
 */
export const validateMultipleLocationsAccess = (options = {}) => {
  const {
    locationFields = ['destinationLocation', 'sourceLocation'],
    source = 'any'
  } = options;

  return (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Super Admins have access to ALL locations
      if (isSuperAdmin(req.user.role)) {
        logger.debug('Multiple locations access granted: Super Admin', {
          userId: req.user.userId,
          role: req.user.role
        });
        return next();
      }

      // Extract all locationIds
      const locationIds = [];
      const missingFields = [];

      for (const field of locationFields) {
        let locationId;

        if (source === 'params' || source === 'any') {
          locationId = req.params[field];
        }

        if (!locationId && (source === 'body' || source === 'any')) {
          locationId = req.body[field];
        }

        if (!locationId && (source === 'query' || source === 'any')) {
          locationId = req.query[field];
        }

        if (!locationId) {
          missingFields.push(field);
        } else {
          locationIds.push({ field, locationId });
        }
      }

      // If any required location is missing, return error
      if (missingFields.length > 0) {
        logger.warn('Multiple locations access validation failed: Missing locationIds', {
          userId: req.user.userId,
          missingFields
        });

        return res.status(400).json({
          success: false,
          message: `Location identifiers required: ${missingFields.join(', ')}`
        });
      }

      // Check access for each location
      const branchIds = req.user.branchIds || [];
      const warehouseIds = req.user.warehouseIds || [];
      const deniedLocations = [];

      for (const { field, locationId } of locationIds) {
        const hasAccess = branchIds.includes(locationId) || warehouseIds.includes(locationId);
        
        if (!hasAccess) {
          deniedLocations.push(field);
        }
      }

      if (deniedLocations.length > 0) {
        logger.warn('Multiple locations access denied', {
          userId: req.user.userId,
          role: req.user.role,
          deniedLocations,
          branchIds,
          warehouseIds
        });

        return res.status(403).json({
          success: false,
          message: `Access denied. You do not have permission to access the following locations: ${deniedLocations.join(', ')}`
        });
      }

      logger.debug('Multiple locations access granted', {
        userId: req.user.userId,
        role: req.user.role,
        locationFields
      });

      next();
    } catch (error) {
      logger.error('Multiple locations access validation error', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to validate location access'
      });
    }
  };
};

/**
 * Helper function to check if user has access to a specific location
 * Can be used in service layer or other middleware
 * 
 * @param {Object} user - User object from req.user
 * @param {string} locationId - Location ID to check
 * @returns {boolean} True if user has access
 */
export const hasLocationAccess = (user, locationId) => {
  if (!user || !locationId) {
    return false;
  }

  // Super Admins have access to all locations
  if (isSuperAdmin(user.role)) {
    return true;
  }

  // Check if locationId is in user's branchIds or warehouseIds
  const branchIds = user.branchIds || [];
  const warehouseIds = user.warehouseIds || [];

  return branchIds.includes(locationId) || warehouseIds.includes(locationId);
};

/**
 * Get all accessible location IDs for a user
 * Returns all location IDs if Super Admin, otherwise returns branchIds + warehouseIds
 * 
 * @param {Object} user - User object from req.user
 * @returns {Object} { isUnrestricted: boolean, locationIds: string[] }
 */
export const getAccessibleLocations = (user) => {
  if (!user) {
    return { isUnrestricted: false, locationIds: [] };
  }

  // Super Admins have unrestricted access
  if (isSuperAdmin(user.role)) {
    return { isUnrestricted: true, locationIds: [] };
  }

  // Combine branchIds and warehouseIds
  const branchIds = user.branchIds || [];
  const warehouseIds = user.warehouseIds || [];
  const locationIds = [...new Set([...branchIds, ...warehouseIds])]; // Remove duplicates

  return { isUnrestricted: false, locationIds };
};
