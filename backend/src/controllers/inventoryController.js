/**
 * Inventory Controller
 * HTTP request handlers for inventory management endpoints
 */

import * as inventoryService from '../services/inventoryService.js';
import CompanyUser from '../models/platform/CompanyUser.js';
import { logger } from '../utils/logger.js';

/**
 * Helper function to verify branch access for a user
 * @param {string} userId - User ID
 * @param {string} branchId - Branch ID to check
 * @param {string} role - User role
 * @param {string} companyId - Company ID
 * @returns {Promise<boolean>} True if user has access
 */
const verifyBranchAccess = async (userId, branchId, role, companyId) => {
  // Super admins have access to all branches
  if (role === 'company_super_admin_primary' || role === 'company_super_admin_secondary') {
    return true;
  }

  // For company_admin and employees, check their assigned branches
  const user = await CompanyUser.findById(userId).select('branchIds');
  
  if (!user || !user.branchIds || !user.branchIds.includes(branchId)) {
    return false;
  }

  return true;
};

/**
 * Create inventory item
 * POST /api/inventory/items
 */
export const createInventoryItem = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId, ...itemData } = req.body;

    // Validate branchId is provided
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Verify branch access
    const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this branch'
      });
    }

    // Create inventory item
    const item = await inventoryService.createInventoryItem(itemData, companyId, branchId);

    logger.info('Inventory item created via API', { 
      itemId: item._id, 
      companyId, 
      branchId, 
      userId 
    });

    res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      data: { item }
    });
  } catch (error) {
    logger.error('Create inventory item error', error);
    
    // Handle specific validation errors
    if (error.message.includes('Missing required fields') || 
        error.message.includes('cannot be negative') ||
        error.message.includes('Maximum stock cannot be less') ||
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
 * Get inventory items with filtering and pagination
 * GET /api/inventory/items
 */
export const getInventoryItems = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId, ...filters } = req.query;

    // Validate branchId is provided
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Verify branch access (skip verification for "all" if user is super admin)
    if (branchId !== 'all') {
      const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this branch'
        });
      }
    } else {
      // Only super admins can use "all"
      const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role);
      if (!isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can view all branches'
        });
      }
    }

    // Get inventory items
    const result = await inventoryService.getInventoryItems(companyId, branchId, filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get inventory items error', error);
    next(error);
  }
};

/**
 * Get inventory item by ID
 * GET /api/inventory/items/:id
 */
export const getInventoryItemById = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;

    // Get inventory item
    const item = await inventoryService.getInventoryItemById(id, companyId);

    // Verify branch access
    const hasAccess = await verifyBranchAccess(userId, item.branch.toString(), role, companyId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this branch'
      });
    }

    res.json({
      success: true,
      data: { item }
    });
  } catch (error) {
    logger.error('Get inventory item by ID error', error);
    
    if (error.message === 'Inventory item not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Update inventory item
 * PUT /api/inventory/items/:id
 */
export const updateInventoryItem = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;
    const updateData = req.body;

    // Get existing item to verify branch access
    const existingItem = await inventoryService.getInventoryItemById(id, companyId);

    // Verify branch access
    const hasAccess = await verifyBranchAccess(userId, existingItem.branch.toString(), role, companyId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this branch'
      });
    }

    // Update inventory item
    const item = await inventoryService.updateInventoryItem(id, updateData, companyId);

    logger.info('Inventory item updated via API', { 
      itemId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Inventory item updated successfully',
      data: { item }
    });
  } catch (error) {
    logger.error('Update inventory item error', error);
    
    if (error.message === 'Inventory item not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('cannot be negative') ||
        error.message.includes('Maximum stock cannot be less') ||
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
 * Delete inventory item (soft delete)
 * DELETE /api/inventory/items/:id
 */
export const deleteInventoryItem = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;

    // Get existing item to verify branch access
    const existingItem = await inventoryService.getInventoryItemById(id, companyId);

    // Verify branch access
    const hasAccess = await verifyBranchAccess(userId, existingItem.branch.toString(), role, companyId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this branch'
      });
    }

    // Delete inventory item
    await inventoryService.deleteInventoryItem(id, companyId);

    logger.info('Inventory item deleted via API', { 
      itemId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
  } catch (error) {
    logger.error('Delete inventory item error', error);
    
    if (error.message === 'Inventory item not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get low stock items
 * GET /api/inventory/items/low-stock
 */
export const getLowStockItems = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId } = req.query;

    // Validate branchId is provided
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Verify branch access (skip verification for "all" if user is super admin)
    if (branchId !== 'all') {
      const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this branch'
        });
      }
    } else {
      // Only super admins can use "all"
      const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role);
      if (!isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can view all branches'
        });
      }
    }

    // Get low stock items
    const items = await inventoryService.checkLowStock(companyId, branchId);

    res.json({
      success: true,
      data: { items, count: items.length }
    });
  } catch (error) {
    logger.error('Get low stock items error', error);
    next(error);
  }
};

/**
 * Get expiring items
 * GET /api/inventory/items/expiring
 */
export const getExpiringItems = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId, daysAhead } = req.query;

    // Validate branchId is provided
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Verify branch access (skip verification for "all" if user is super admin)
    if (branchId !== 'all') {
      const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this branch'
        });
      }
    } else {
      // Only super admins can use "all"
      const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role);
      if (!isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can view all branches'
        });
      }
    }

    // Get expiring items
    const items = await inventoryService.checkExpiringItems(
      companyId, 
      branchId, 
      daysAhead ? parseInt(daysAhead) : 7
    );

    res.json({
      success: true,
      data: { items, count: items.length }
    });
  } catch (error) {
    logger.error('Get expiring items error', error);
    next(error);
  }
};

/**
 * Get inventory categories
 * GET /api/inventory/items/categories
 */
export const getInventoryCategories = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId } = req.query;

    // Validate branchId is provided
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Verify branch access (skip verification for "all" if user is super admin)
    if (branchId !== 'all') {
      const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this branch'
        });
      }
    } else {
      // Only super admins can use "all"
      const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role);
      if (!isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can view all branches'
        });
      }
    }

    // Get categories
    const categories = await inventoryService.getInventoryCategories(companyId, branchId);

    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    logger.error('Get inventory categories error', error);
    next(error);
  }
};

/**
 * Create GRN
 * POST /api/inventory/grn
 */
export const createGRN = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId, ...grnData } = req.body;

    // Validate branchId is provided
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Verify branch access
    const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this branch'
      });
    }

    // Create GRN
    const grn = await inventoryService.createGRN(grnData, companyId, branchId, userId);

    logger.info('GRN created via API', { 
      grnId: grn._id, 
      grnNumber: grn.grnNumber,
      companyId, 
      branchId, 
      userId 
    });

    res.status(201).json({
      success: true,
      message: 'GRN created successfully',
      data: { grn }
    });
  } catch (error) {
    logger.error('Create GRN error', error);
    
    if (error.message.includes('must have at least one line item') ||
        error.message.includes('must have inventoryItem') ||
        error.message.includes('Quantity must be positive')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get GRNs with filtering and pagination
 * GET /api/inventory/grn
 */
export const getGRNs = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId, ...filters } = req.query;

    // Validate branchId is provided
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Verify branch access
    const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this branch'
      });
    }

    // Get GRNs
    const result = await inventoryService.getGRNs(companyId, branchId, filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get GRNs error', error);
    next(error);
  }
};

/**
 * Get GRN by ID
 * GET /api/inventory/grn/:id
 */
export const getGRNById = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;

    // Get GRN
    const grn = await inventoryService.getGRNById(id, companyId);

    // Verify branch access
    const hasAccess = await verifyBranchAccess(userId, grn.branch.toString(), role, companyId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this branch'
      });
    }

    res.json({
      success: true,
      data: { grn }
    });
  } catch (error) {
    logger.error('Get GRN by ID error', error);
    
    if (error.message === 'GRN not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Create stock adjustment
 * POST /api/inventory/adjustments
 */
export const createStockAdjustment = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId, ...adjustmentData } = req.body;

    // Validate branchId is provided
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Verify branch access
    const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this branch'
      });
    }

    // Create stock adjustment
    const adjustment = await inventoryService.createStockAdjustment(
      adjustmentData, 
      companyId, 
      branchId, 
      userId
    );

    logger.info('Stock adjustment created via API', { 
      adjustmentId: adjustment._id, 
      adjustmentNumber: adjustment.adjustmentNumber,
      companyId, 
      branchId, 
      userId 
    });

    res.status(201).json({
      success: true,
      message: 'Stock adjustment created successfully',
      data: { adjustment }
    });
  } catch (error) {
    logger.error('Create stock adjustment error', error);
    
    if (error.message.includes('Missing required fields') ||
        error.message.includes('Invalid adjustment type') ||
        error.message.includes('Invalid reason') ||
        error.message.includes('Insufficient stock') ||
        error.message.includes('does not belong to this branch')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Inventory item not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get stock adjustments with filtering and pagination
 * GET /api/inventory/adjustments
 */
export const getStockAdjustments = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId, ...filters } = req.query;

    // Validate branchId is provided
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Verify branch access
    const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this branch'
      });
    }

    // Get stock adjustments
    const result = await inventoryService.getStockAdjustments(companyId, branchId, filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get stock adjustments error', error);
    next(error);
  }
};

/**
 * Get stock adjustment by ID
 * GET /api/inventory/adjustments/:id
 */
export const getStockAdjustmentById = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;

    // Get stock adjustment
    const adjustment = await inventoryService.getStockAdjustmentById(id, companyId);

    // Verify branch access
    const hasAccess = await verifyBranchAccess(userId, adjustment.branch.toString(), role, companyId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this branch'
      });
    }

    res.json({
      success: true,
      data: { adjustment }
    });
  } catch (error) {
    logger.error('Get stock adjustment by ID error', error);
    
    if (error.message === 'Stock adjustment not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Create stock transfer
 * POST /api/inventory/transfers
 */
export const createStockTransfer = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const transferData = req.body;

    // Validate required fields
    if (!transferData.fromBranch || !transferData.toBranch) {
      return res.status(400).json({
        success: false,
        message: 'From branch and to branch are required'
      });
    }

    // Verify access to both branches
    const hasFromAccess = await verifyBranchAccess(userId, transferData.fromBranch, role, companyId);
    const hasToAccess = await verifyBranchAccess(userId, transferData.toBranch, role, companyId);

    if (!hasFromAccess || !hasToAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to one or both branches'
      });
    }

    // Create stock transfer
    const transfer = await inventoryService.createStockTransfer(transferData, companyId, userId);

    logger.info('Stock transfer created via API', { 
      transferId: transfer._id, 
      transferNumber: transfer.transferNumber,
      companyId, 
      userId 
    });

    res.status(201).json({
      success: true,
      message: 'Stock transfer created successfully',
      data: { transfer }
    });
  } catch (error) {
    logger.error('Create stock transfer error', error);
    
    if (error.message.includes('Missing required fields') ||
        error.message.includes('must be different') ||
        error.message.includes('must have inventoryItem') ||
        error.message.includes('Quantity must be positive')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get stock transfers with filtering and pagination
 * GET /api/inventory/transfers
 */
export const getStockTransfers = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId, ...filters } = req.query;

    // If branchId is provided, verify access
    if (branchId) {
      const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this branch'
        });
      }
    }

    // Get stock transfers
    const result = await inventoryService.getStockTransfers(companyId, branchId, filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get stock transfers error', error);
    next(error);
  }
};

/**
 * Get stock transfer by ID
 * GET /api/inventory/transfers/:id
 */
export const getStockTransferById = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;

    // Get stock transfer
    const transfer = await inventoryService.getStockTransferById(id, companyId);

    // Verify access to at least one of the branches
    const hasFromAccess = await verifyBranchAccess(userId, transfer.fromBranch._id.toString(), role, companyId);
    const hasToAccess = await verifyBranchAccess(userId, transfer.toBranch._id.toString(), role, companyId);

    if (!hasFromAccess && !hasToAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this transfer'
      });
    }

    res.json({
      success: true,
      data: { transfer }
    });
  } catch (error) {
    logger.error('Get stock transfer by ID error', error);
    
    if (error.message === 'Stock transfer not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Approve stock transfer
 * PUT /api/inventory/transfers/:id/approve
 */
export const approveStockTransfer = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;

    // Get transfer to verify access
    const existingTransfer = await inventoryService.getStockTransferById(id, companyId);

    // Verify access to both branches
    const hasFromAccess = await verifyBranchAccess(userId, existingTransfer.fromBranch._id.toString(), role, companyId);
    const hasToAccess = await verifyBranchAccess(userId, existingTransfer.toBranch._id.toString(), role, companyId);

    if (!hasFromAccess || !hasToAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to approve this transfer'
      });
    }

    // Approve stock transfer
    const transfer = await inventoryService.approveStockTransfer(id, companyId, userId);

    logger.info('Stock transfer approved via API', { 
      transferId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Stock transfer approved successfully',
      data: { transfer }
    });
  } catch (error) {
    logger.error('Approve stock transfer error', error);
    
    if (error.message === 'Stock transfer not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot approve transfer') ||
        error.message.includes('Insufficient stock')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Reject stock transfer
 * PUT /api/inventory/transfers/:id/reject
 */
export const rejectStockTransfer = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;
    const { reason } = req.body;

    // Validate rejection reason
    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    // Get transfer to verify access
    const existingTransfer = await inventoryService.getStockTransferById(id, companyId);

    // Verify access to at least one of the branches
    const hasFromAccess = await verifyBranchAccess(userId, existingTransfer.fromBranch._id.toString(), role, companyId);
    const hasToAccess = await verifyBranchAccess(userId, existingTransfer.toBranch._id.toString(), role, companyId);

    if (!hasFromAccess && !hasToAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to reject this transfer'
      });
    }

    // Reject stock transfer
    const transfer = await inventoryService.rejectStockTransfer(id, companyId, userId, reason);

    logger.info('Stock transfer rejected via API', { 
      transferId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Stock transfer rejected successfully',
      data: { transfer }
    });
  } catch (error) {
    logger.error('Reject stock transfer error', error);
    
    if (error.message === 'Stock transfer not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot reject transfer') ||
        error.message.includes('Rejection reason is required')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};
