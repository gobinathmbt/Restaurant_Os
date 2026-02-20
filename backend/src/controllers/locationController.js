/**
 * Location Controller
 * Handles HTTP requests for location management operations
 * Supports branches, warehouses, central kitchens, and cloud kitchens
 */

import {
  createLocation,
  updateLocation,
  getLocation,
  listLocations,
  getLocationsByCapability,
  archiveLocation,
  restoreLocation
} from '../services/locationService.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new location
 * POST /api/locations
 * Only super admins can create locations
 */
export const createLocationHandler = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;

    // Check permissions - only super admins can create locations
    if (!['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can create locations'
      });
    }

    const location = await createLocation(req.body, companyId);

    logger.info(`Location created: ${location._id} by user: ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Location created successfully',
      data: { location }
    });
  } catch (error) {
    logger.error('Create location error:', error);
    
    // Handle specific error cases
    if (error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('Missing required fields')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('Invalid location type')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Get location by ID
 * GET /api/locations/:id
 */
export const getLocationHandler = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;
    const { includeArchived } = req.query;

    const location = await getLocation(
      id, 
      companyId, 
      includeArchived === 'true'
    );

    // For company admins and employees, check if they have access to this location
    // (This would require additional logic to check user-location assignments)
    // For now, we'll allow all authenticated users to view locations

    res.json({
      success: true,
      data: { location }
    });
  } catch (error) {
    logger.error('Get location error:', error);
    
    if (error.message === 'Location not found') {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }
    
    next(error);
  }
};

/**
 * Update location
 * PUT /api/locations/:id
 * Only super admins can update locations
 */
export const updateLocationHandler = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;

    // Check permissions - only super admins can update locations
    if (!['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can update locations'
      });
    }

    const location = await updateLocation(id, req.body, companyId);

    logger.info(`Location updated: ${id} by user: ${userId}`);

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: { location }
    });
  } catch (error) {
    logger.error('Update location error:', error);
    
    if (error.message === 'Location not found or inactive') {
      return res.status(404).json({
        success: false,
        message: 'Location not found or inactive'
      });
    }
    
    if (error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('Invalid location type')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Archive location (soft delete)
 * DELETE /api/locations/:id
 * Only super admins can archive locations
 */
export const archiveLocationHandler = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;

    // Check permissions - only super admins can archive locations
    if (!['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can archive locations'
      });
    }

    // TODO: Add dependency checks (inventory, transfers, etc.)
    // For now, we'll allow archiving

    const location = await archiveLocation(id, companyId);

    logger.info(`Location archived: ${id} by user: ${userId}`);

    res.json({
      success: true,
      message: 'Location archived successfully',
      data: { location }
    });
  } catch (error) {
    logger.error('Archive location error:', error);
    
    if (error.message === 'Location not found') {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }
    
    next(error);
  }
};

/**
 * List locations with filtering
 * GET /api/locations
 */
export const listLocationsHandler = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;

    // Extract query parameters
    const filters = {
      page: req.query.page || 1,
      limit: req.query.limit || 10,
      search: req.query.search || '',
      type: req.query.type || '',
      isActive: req.query.isActive || 'all',
      includeArchived: req.query.includeArchived === 'true',
      capability: req.query.capability || ''
    };

    // For company admins and employees, we might want to filter by their assigned locations
    // For now, we'll show all locations to all authenticated users

    const result = await listLocations(companyId, filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('List locations error:', error);
    next(error);
  }
};

/**
 * Get locations by capability
 * GET /api/locations/by-capability/:capability
 */
export const getLocationsByCapabilityHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { capability } = req.params;

    const locations = await getLocationsByCapability(capability, companyId);

    res.json({
      success: true,
      data: { locations }
    });
  } catch (error) {
    logger.error('Get locations by capability error:', error);
    
    if (error.message.includes('Invalid capability')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Restore archived location
 * POST /api/locations/:id/restore
 * Only super admins can restore locations
 */
export const restoreLocationHandler = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;

    // Check permissions - only super admins can restore locations
    if (!['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can restore locations'
      });
    }

    const location = await restoreLocation(id, companyId);

    logger.info(`Location restored: ${id} by user: ${userId}`);

    res.json({
      success: true,
      message: 'Location restored successfully',
      data: { location }
    });
  } catch (error) {
    logger.error('Restore location error:', error);
    
    if (error.message === 'Location not found') {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }
    
    next(error);
  }
};
