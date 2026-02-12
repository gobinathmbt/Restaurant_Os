/**
 * Menu Item Branch Controller
 * HTTP request handlers for branch-specific menu item configuration endpoints
 */

import * as menuItemBranchService from '../services/menuItemBranchService.js';
import * as menuItemService from '../services/menuItemService.js';
import { logger } from '../utils/logger.js';

/**
 * Create branch configuration for menu item
 * POST /api/menu/items/:menuItemId/branches/:branchId
 */
export const createBranchConfig = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { menuItemId, branchId } = req.params;
    const configData = req.body;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Create branch configuration
    const branchConfig = await menuItemBranchService.createBranchConfig(
      menuItemId,
      branchId,
      configData,
      companyId,
      userBranchIds
    );

    logger.info('Branch config created via API', { 
      menuItemId,
      branchId,
      companyId, 
      userId 
    });

    res.status(201).json({
      success: true,
      message: 'Branch configuration created successfully',
      data: { branchConfig }
    });
  } catch (error) {
    logger.error('Create branch config error', error);
    
    // Handle authorization errors (403)
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Handle not found errors (404)
    if (error.message === 'Menu item not found' || error.message === 'Branch not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    // Handle validation errors (400)
    if (error.message.includes('cannot be negative') ||
        error.message.includes('cannot have more than') ||
        error.message.includes('must be a positive integer') ||
        error.message.includes('must be between') ||
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
 * Get branch configuration for menu item
 * GET /api/menu/items/:menuItemId/branches/:branchId
 */
export const getBranchConfig = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { menuItemId, branchId } = req.params;

    // Get branch configuration
    const branchConfig = await menuItemBranchService.getBranchConfig(
      menuItemId,
      branchId,
      companyId
    );

    res.json({
      success: true,
      data: { branchConfig }
    });
  } catch (error) {
    logger.error('Get branch config error', error);
    
    if (error.message === 'Branch configuration not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Update branch configuration
 * PUT /api/menu/items/:menuItemId/branches/:branchId
 */
export const updateBranchConfig = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { menuItemId, branchId } = req.params;
    const updateData = req.body;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Update branch configuration
    const branchConfig = await menuItemBranchService.updateBranchConfig(
      menuItemId,
      branchId,
      updateData,
      companyId,
      userBranchIds
    );

    logger.info('Branch config updated via API', { 
      menuItemId,
      branchId,
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Branch configuration updated successfully',
      data: { branchConfig }
    });
  } catch (error) {
    logger.error('Update branch config error', error);
    
    // Handle authorization errors (403)
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Handle not found errors (404)
    if (error.message === 'Branch configuration not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    // Handle validation errors (400)
    if (error.message.includes('cannot be negative') ||
        error.message.includes('cannot have more than') ||
        error.message.includes('must be a positive integer') ||
        error.message.includes('must be between')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Delete branch configuration (remove item from branch)
 * DELETE /api/menu/items/:menuItemId/branches/:branchId
 */
export const deleteBranchConfig = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { menuItemId, branchId } = req.params;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Delete branch configuration
    await menuItemBranchService.deleteBranchConfig(
      menuItemId,
      branchId,
      companyId,
      userBranchIds
    );

    logger.info('Branch config deleted via API', { 
      menuItemId,
      branchId,
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Branch configuration deleted successfully'
    });
  } catch (error) {
    logger.error('Delete branch config error', error);
    
    // Handle authorization errors (403)
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Handle not found errors (404)
    if (error.message === 'Branch configuration not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get menu items for a specific branch (merged with global data)
 * GET /api/menu/branches/:branchId/items
 */
export const getMenuItemsForBranch = async (req, res, next) => {
  try {
    const { companyId, role, branchIds } = req.user;
    const { branchId } = req.params;
    const filters = req.query;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Get menu items for branch
    const result = await menuItemBranchService.getMenuItemsForBranch(
      branchId,
      companyId,
      filters,
      userBranchIds
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get menu items for branch error', error);
    
    // Handle authorization errors (403)
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Create menu item with branch assignments
 * POST /api/menu/items/with-branches
 */
export const createMenuItemWithBranches = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { menuItemData, branchConfigs } = req.body;

    // Validate request body
    if (!menuItemData) {
      return res.status(400).json({
        success: false,
        message: 'Menu item data is required'
      });
    }

    if (!branchConfigs || !Array.isArray(branchConfigs) || branchConfigs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one branch configuration is required'
      });
    }

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Create menu item with branches
    const result = await menuItemService.createMenuItemWithBranches(
      menuItemData,
      branchConfigs,
      companyId,
      userId,
      userBranchIds
    );

    logger.info('Menu item created with branches', {
      menuItemId: result.menuItem._id,
      branchCount: branchConfigs.length,
      companyId,
      userId
    });

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: result
    });
  } catch (error) {
    logger.error('Create menu item with branches error', error);

    // Handle authorization errors (403)
    if (error.message.includes('No access to branch')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Handle validation errors (400)
    if (error.message.includes('required') ||
        error.message.includes('invalid') ||
        error.message.includes('cannot') ||
        error.message.includes('must be') ||
        error.message.includes('exceed') ||
        error.message.includes('does not exist')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Bulk update branch configurations for a menu item
 * PUT /api/menu/items/:menuItemId/branches
 */
export const bulkUpdateBranchConfigs = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { menuItemId } = req.params;
    const { branchConfigs } = req.body;

    // Validate request body
    if (!branchConfigs || !Array.isArray(branchConfigs) || branchConfigs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Branch configurations array is required'
      });
    }

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Bulk update branch configurations
    const updatedConfigs = await menuItemBranchService.bulkUpdateBranchConfigs(
      menuItemId,
      branchConfigs,
      companyId,
      userBranchIds
    );

    logger.info('Branch configs bulk updated via API', {
      menuItemId,
      branchCount: updatedConfigs.length,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Branch configurations updated successfully',
      data: { branchConfigs: updatedConfigs }
    });
  } catch (error) {
    logger.error('Bulk update branch configs error', error);

    // Handle authorization errors (403)
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Handle not found errors (404)
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    // Handle validation errors (400)
    if (error.message.includes('cannot be negative') ||
        error.message.includes('cannot have more than') ||
        error.message.includes('must be a positive integer') ||
        error.message.includes('must be between')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Update modifiers for a menu item branch
 * PUT /api/menu/menu-item-branches/:id/modifiers
 */
export const updateModifiers = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { id } = req.params;
    const { modifiers } = req.body;

    // Validate request body
    if (!modifiers || !Array.isArray(modifiers)) {
      return res.status(400).json({
        success: false,
        message: 'Modifiers array is required'
      });
    }

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Update modifiers
    const menuItemBranch = await menuItemBranchService.updateModifiers(
      companyId,
      id,
      modifiers,
      userBranchIds
    );

    logger.info('Modifiers updated via API', {
      menuItemBranchId: id,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Modifiers updated successfully',
      data: { menuItemBranch }
    });
  } catch (error) {
    logger.error('Update modifiers error', error);

    // Handle authorization errors (403)
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Handle not found errors (404)
    if (error.message === 'MenuItemBranch not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    // Handle validation errors (400)
    if (error.message.includes('Modifier') ||
        error.message.includes('modifier') ||
        error.message.includes('option') ||
        error.message.includes('name is required') ||
        error.message.includes('must have') ||
        error.message.includes('must be') ||
        error.message.includes('price')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Delete a modifier from a menu item branch
 * DELETE /api/menu/menu-item-branches/:id/modifiers/:index
 */
export const deleteModifier = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { id, index } = req.params;

    // Validate index
    const modifierIndex = parseInt(index, 10);
    if (isNaN(modifierIndex) || modifierIndex < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid modifier index'
      });
    }

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Delete modifier
    const menuItemBranch = await menuItemBranchService.deleteModifier(
      companyId,
      id,
      modifierIndex,
      userBranchIds
    );

    logger.info('Modifier deleted via API', {
      menuItemBranchId: id,
      modifierIndex,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Modifier deleted successfully',
      data: { menuItemBranch }
    });
  } catch (error) {
    logger.error('Delete modifier error', error);

    // Handle authorization errors (403)
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Handle not found errors (404)
    if (error.message === 'MenuItemBranch not found' ||
        error.message.includes('Modifier not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    // Handle validation errors (400)
    if (error.message.includes('Invalid') || error.message.includes('index')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Add menu items as add-ons to a menu item branch
 * POST /api/menu/menu-item-branches/:id/add-ons
 */
export const addAddOns = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { id } = req.params;
    const { addOnIds } = req.body;

    // Validate request body
    if (!addOnIds || !Array.isArray(addOnIds) || addOnIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Add-on IDs array is required and must not be empty'
      });
    }

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Add add-ons
    const menuItemBranch = await menuItemBranchService.addAddOns(
      companyId,
      id,
      addOnIds,
      userBranchIds
    );

    logger.info('Add-ons added via API', {
      menuItemBranchId: id,
      addOnCount: addOnIds.length,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Add-ons added successfully',
      data: { menuItemBranch }
    });
  } catch (error) {
    logger.error('Add add-ons error', error);

    // Handle authorization errors (403)
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Handle not found errors (404)
    if (error.message === 'MenuItemBranch not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    // Handle validation errors (400)
    if (error.message.includes('not found') ||
        error.message.includes('inactive') ||
        error.message.includes('not available') ||
        error.message.includes('cannot reference itself') ||
        error.message.includes('One or more')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Remove an add-on from a menu item branch
 * DELETE /api/menu/menu-item-branches/:id/add-ons/:addOnId
 */
export const removeAddOn = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { id, addOnId } = req.params;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Remove add-on
    await menuItemBranchService.removeAddOn(
      companyId,
      id,
      addOnId,
      userBranchIds
    );

    logger.info('Add-on removed via API', {
      menuItemBranchId: id,
      addOnId,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Add-on removed successfully'
    });
  } catch (error) {
    logger.error('Remove add-on error', error);

    // Handle authorization errors (403)
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Handle not found errors (404)
    if (error.message === 'MenuItemBranch not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get available menu items for add-ons (excludes self)
 * GET /api/menu/menu-item-branches/:id/available-add-ons
 */
export const getAvailableAddOns = async (req, res, next) => {
  try {
    const { companyId, role, branchIds } = req.user;
    const { id } = req.params;
    const { branchId, search } = req.query;

    // Validate required query parameters
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required as a query parameter'
      });
    }

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Get available add-ons
    const availableAddOns = await menuItemBranchService.getAvailableAddOns(
      companyId,
      id,
      branchId,
      search || '',
      userBranchIds
    );

    res.json({
      success: true,
      data: availableAddOns
    });
  } catch (error) {
    logger.error('Get available add-ons error', error);

    // Handle authorization errors (403)
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Handle not found errors (404)
    if (error.message === 'MenuItemBranch not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};
