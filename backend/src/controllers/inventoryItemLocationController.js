/**
 * Inventory Item Location Controller
 * HTTP request handlers for location-specific inventory item configuration endpoints
 * Replaces inventoryItemBranchController with location-based approach
 */

import * as inventoryItemLocationService from '../services/inventoryItemLocationService.js';
import { logger } from '../utils/logger.js';

/**
 * Get inventory items for a specific location
 * GET /api/inventory/locations/:locationId/items
 * Note: Read-only access - no location permission check needed for viewing
 */
export const getInventoryItemsForLocation = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { locationId } = req.params;
    const filters = req.query;

    // No location access check - allow read access for all users in the company
    const result = await inventoryItemLocationService.getInventoryItemsForLocation(
      locationId,
      companyId,
      filters,
      null // Pass null to skip location access validation for read operations
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get inventory items for location error', error);
    next(error);
  }
};

/**
 * Get a single inventory item at a location by item ID
 * GET /api/inventory/locations/:locationId/items/:itemId
 * Note: Read-only access - no location permission check needed for viewing
 */
export const getInventoryItemLocationById = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { locationId, itemId } = req.params;

    // No location access check - allow read access for all users in the company
    const result = await inventoryItemLocationService.getInventoryItemLocationById(
      itemId,
      locationId,
      companyId,
      null // Pass null to skip location access validation for read operations
    );

    res.json({ 
      success: true, 
      data: result
    });
  } catch (error) {
    logger.error('Get inventory item location by id error', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ 
        success: false, 
        message: error.message 
      });
    }
    next(error);
  }
};

/**
 * Create location configuration for inventory item
 * POST /api/inventory/locations/:locationId/items/:itemId/config
 */
export const createLocationConfig = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { locationId, itemId } = req.params;
    const configData = req.body;

    // Determine user's accessible locations (using branchIds as locationIds)
    const userLocationIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null
      : branchIds;

    // Create location configuration
    const locationConfig = await inventoryItemLocationService.createLocationConfig(
      itemId,
      locationId,
      configData,
      companyId,
      userId,
      userLocationIds
    );

    logger.info('Inventory location config created via API', { 
      itemId,
      locationId,
      companyId, 
      userId 
    });

    res.status(201).json({
      success: true,
      message: 'Location configuration created successfully',
      data: { locationConfig }
    });
  } catch (error) {
    logger.error('Create inventory location config error', error);
    
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Inventory item not found' || error.message === 'Location not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('cannot be negative') ||
        error.message.includes('cannot have more than') ||
        error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Update location configuration
 * PUT /api/inventory/locations/:locationId/items/:itemId/config
 */
export const updateLocationConfig = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { locationId, itemId } = req.params;
    const updateData = req.body;

    const userLocationIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null
      : branchIds;

    const locationConfig = await inventoryItemLocationService.updateLocationConfig(
      itemId,
      locationId,
      updateData,
      companyId,
      userId,
      userLocationIds
    );

    logger.info('Inventory location config updated via API', { 
      itemId,
      locationId,
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Location configuration updated successfully',
      data: { locationConfig }
    });
  } catch (error) {
    logger.error('Update inventory location config error', error);
    
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Location configuration not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('modified by another user')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('cannot be negative') ||
        error.message.includes('cannot have more than')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Delete location configuration
 * DELETE /api/inventory/locations/:locationId/items/:itemId/config
 */
export const deleteLocationConfig = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { locationId, itemId } = req.params;

    const userLocationIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null
      : branchIds;

    await inventoryItemLocationService.deleteLocationConfig(
      itemId,
      locationId,
      companyId,
      userLocationIds
    );

    logger.info('Inventory location config deleted via API', { 
      itemId,
      locationId,
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Location configuration deleted successfully'
    });
  } catch (error) {
    logger.error('Delete inventory location config error', error);
    
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Location configuration not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot delete')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Bulk update location configurations for an inventory item
 * POST /api/inventory/items/:itemId/locations/bulk
 */
export const bulkUpdateLocationConfigs = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { itemId } = req.params;
    const { locationConfigs } = req.body;

    if (!locationConfigs || !Array.isArray(locationConfigs) || locationConfigs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Location configurations array is required'
      });
    }

    const userLocationIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null
      : branchIds;

    const result = await inventoryItemLocationService.bulkUpdateLocationConfigs(
      itemId,
      locationConfigs,
      companyId,
      userId,
      userLocationIds
    );

    logger.info('Inventory location configs bulk updated via API', {
      itemId,
      locationCount: result.locationConfigs.length,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Location configurations updated successfully',
      data: result
    });
  } catch (error) {
    logger.error('Bulk update inventory location configs error', error);

    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('cannot be negative') ||
        error.message.includes('cannot have more than')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};
