/**
 * Inventory Item Branch Controller
 * HTTP request handlers for branch-specific inventory item configuration endpoints
 */

import * as inventoryItemBranchService from '../services/inventoryItemBranchService.js';
import * as inventoryService from '../services/inventoryService.js';
import { logger } from '../utils/logger.js';

/**
 * Create branch configuration for inventory item
 * POST /api/inventory/items/:inventoryItemId/branches/:branchId
 */
export const createBranchConfig = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { inventoryItemId, branchId } = req.params;
    const configData = req.body;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null
      : branchIds;

    // Create branch configuration
    const branchConfig = await inventoryItemBranchService.createBranchConfig(
      inventoryItemId,
      branchId,
      configData,
      companyId,
      userBranchIds
    );

    logger.info('Inventory branch config created via API', { 
      inventoryItemId,
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
    logger.error('Create inventory branch config error', error);
    
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Inventory item not found' || error.message === 'Branch not found') {
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
 * Get branch configuration for inventory item
 * GET /api/inventory/items/:inventoryItemId/branches/:branchId
 */
export const getBranchConfig = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { inventoryItemId, branchId } = req.params;

    const branchConfig = await inventoryItemBranchService.getBranchConfig(
      inventoryItemId,
      branchId,
      companyId
    );

    res.json({
      success: true,
      data: { branchConfig }
    });
  } catch (error) {
    logger.error('Get inventory branch config error', error);
    
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
 * PUT /api/inventory/items/:inventoryItemId/branches/:branchId
 */
export const updateBranchConfig = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { inventoryItemId, branchId } = req.params;
    const updateData = req.body;

    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null
      : branchIds;

    const branchConfig = await inventoryItemBranchService.updateBranchConfig(
      inventoryItemId,
      branchId,
      updateData,
      companyId,
      userBranchIds
    );

    logger.info('Inventory branch config updated via API', { 
      inventoryItemId,
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
    logger.error('Update inventory branch config error', error);
    
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Branch configuration not found') {
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

/**
 * Delete branch configuration
 * DELETE /api/inventory/items/:inventoryItemId/branches/:branchId
 */
export const deleteBranchConfig = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { inventoryItemId, branchId } = req.params;

    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null
      : branchIds;

    await inventoryItemBranchService.deleteBranchConfig(
      inventoryItemId,
      branchId,
      companyId,
      userBranchIds
    );

    logger.info('Inventory branch config deleted via API', { 
      inventoryItemId,
      branchId,
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Branch configuration deleted successfully'
    });
  } catch (error) {
    logger.error('Delete inventory branch config error', error);
    
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

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
 * Bulk update branch configurations for an inventory item
 * PUT /api/inventory/items/:inventoryItemId/branches
 */
export const bulkUpdateBranchConfigs = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { inventoryItemId } = req.params;
    const { branchConfigs } = req.body;

    if (!branchConfigs || !Array.isArray(branchConfigs) || branchConfigs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Branch configurations array is required'
      });
    }

    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null
      : branchIds;

    const updatedConfigs = await inventoryItemBranchService.bulkUpdateBranchConfigs(
      inventoryItemId,
      branchConfigs,
      companyId,
      userBranchIds
    );

    logger.info('Inventory branch configs bulk updated via API', {
      inventoryItemId,
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
    logger.error('Bulk update inventory branch configs error', error);

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

/**
 * Get inventory items for a specific branch
 * GET /api/inventory/branches/:branchId/items
 */
export const getInventoryItemsForBranch = async (req, res, next) => {
  try {
    const { companyId, role, branchIds } = req.user;
    const { branchId } = req.params;
    const filters = req.query;

    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null
      : branchIds;

    const result = await inventoryItemBranchService.getInventoryItemsForBranch(
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
    logger.error('Get inventory items for branch error', error);
    
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
 * Get a single InventoryItemBranch by its ID
 * GET /api/inventory/branches/:branchId/items/:branchItemId
 */
export const getInventoryItemBranchById = async (req, res, next) => {
  try {
    const { companyId, role, branchIds } = req.user;
    const { branchId, branchItemId } = req.params;

    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null
      : branchIds;

    const branchConfig = await inventoryItemBranchService.getInventoryItemBranchById(
      branchItemId,
      branchId,
      companyId,
      userBranchIds
    );

    res.json({ success: true, data: { item: branchConfig } });
  } catch (error) {
    logger.error('Get inventory item branch by id error', error);
    if (error.message.includes('do not have access')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('does not belong')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Get multiple InventoryItemBranch documents by IDs for a branch
 * POST /api/inventory/branches/:branchId/items/batch
 */
export const getInventoryItemBranchesByIds = async (req, res, next) => {
  try {
    const { companyId, role, branchIds } = req.user;
    const { branchId } = req.params;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'ids array is required' });
    }

    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null
      : branchIds;

    const items = await inventoryItemBranchService.getInventoryItemBranchesByIds(
      ids,
      branchId,
      companyId,
      userBranchIds
    );

    res.json({ success: true, data: { items } });
  } catch (error) {
    logger.error('Get inventory item branches by ids error', error);
    if (error.message.includes('do not have access')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Create inventory item with branch assignments
 * POST /api/inventory/items/with-branches
 */
export const createInventoryItemWithBranches = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { inventoryItemData, branchConfigs } = req.body;

    if (!inventoryItemData) {
      return res.status(400).json({
        success: false,
        message: 'Inventory item data is required'
      });
    }

    if (!branchConfigs || !Array.isArray(branchConfigs) || branchConfigs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one branch configuration is required'
      });
    }

    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null
      : branchIds;

    const result = await inventoryService.createInventoryItemWithBranches(
      inventoryItemData,
      branchConfigs,
      companyId,
      userId,
      userBranchIds
    );

    logger.info('Inventory item created with branches', {
      inventoryItemId: result.inventoryItem._id,
      branchCount: branchConfigs.length,
      companyId,
      userId
    });

    // Check if auto-assignments were made
    if (result.autoAssignments && Object.keys(result.autoAssignments).length > 0) {
      return res.status(201).json({
        success: true,
        message: 'Inventory item created successfully',
        data: {
          inventoryItem: result.inventoryItem,
          branchConfigs: result.branchConfigs,
          autoAssignments: result.autoAssignments
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      data: {
        inventoryItem: result.inventoryItem,
        branchConfigs: result.branchConfigs
      }
    });
  } catch (error) {
    logger.error('Create inventory item with branches error', error);

    if (error.message.includes('No access to branch')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('required') ||
        error.message.includes('invalid') ||
        error.message.includes('cannot') ||
        error.message.includes('must be') ||
        error.message.includes('does not exist')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};
