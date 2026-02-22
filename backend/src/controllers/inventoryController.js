/**
 * Inventory Controller
 * HTTP request handlers for inventory management endpoints
 */

import * as inventoryService from '../services/inventoryService.js';
import CompanyUser from '../models/platform/CompanyUser.js';
import { logger } from '../utils/logger.js';
import { formatSuccessWithAssignments } from '../utils/errorResponses.js';
import { getCompanyDB } from '../config/database.js';
import { getStockAdjustmentModel } from '../models/company/StockAdjustment.js';
import notificationService from '../services/notificationService.js';

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
    const { companyId, userId, role, branchIds: userBranchIds } = req.user;
    const requestBody = req.body;

    // Get user's branch/location IDs if not already in req.user (for company admins)
    let effectiveBranchIds = userBranchIds;
    if (!effectiveBranchIds && role === 'company_admin') {
      const user = await CompanyUser.findById(userId).select('branchIds');
      effectiveBranchIds = user?.branchIds?.map(id => id.toString()) || [];
    }

    // Detect payload format: new format has inventoryItemData + branchConfigs/locationConfigs
    const isNewFormat = requestBody.inventoryItemData && (requestBody.branchConfigs || requestBody.locationConfigs);

    if (isNewFormat) {
      // New format: { inventoryItemData, branchConfigs/locationConfigs }
      const { inventoryItemData, branchConfigs, locationConfigs } = requestBody;
      const configs = locationConfigs || branchConfigs;

      logger.info('Creating inventory item with location configs', { 
        companyId, 
        itemName: inventoryItemData.name,
        locationCount: configs?.length,
        userId 
      });

      // Super admins have access to all locations (pass null to skip access check)
      const userLocationIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
        ? null
        : effectiveBranchIds || [];

      // Use the new service method that handles location configs
      const result = await inventoryService.createInventoryItemWithLocations(
        inventoryItemData,
        configs,
        companyId,
        userId,
        userLocationIds
      );

      // Return response with location configs
      return res.status(201).json({
        success: true,
        message: 'Inventory item created successfully with location configurations',
        data: {
          item: result.inventoryItem,
          locationConfigs: result.locationConfigs,
          autoAssignments: result.autoAssignments
        }
      });
    } else {
      // Old format: flat structure with branchIds array
      const itemData = requestBody;

      logger.info('Creating inventory item (legacy format)', { 
        companyId, 
        branchIds: itemData.branchIds,
        userId 
      });

      // Create inventory item with user's branch access and role
      const item = await inventoryService.createInventoryItem(
        itemData, 
        companyId, 
        effectiveBranchIds || [], 
        role
      );

      logger.info('Inventory item created via API', { 
        itemId: item._id, 
        companyId, 
        branchIds: itemData.branchIds,
        userId 
      });

      // Check if auto-assignments were made by middleware
      if (req.autoAssignments && Object.keys(req.autoAssignments).length > 0) {
        // Return success response with auto-assignment details
        const response = formatSuccessWithAssignments({
          data: item,
          autoAssignments: req.autoAssignments,
          entityType: 'item',
          operation: 'created'
        });
        
        return res.status(201).json(response);
      }

      // Return standard success response
      return res.status(201).json({
        success: true,
        message: 'Inventory item created successfully',
        data: { item }
      });
    }
  } catch (error) {
    logger.error('Create inventory item error', error);
    
    // Handle specific validation errors
    if (error.message.includes('Missing required fields') || 
        error.message.includes('cannot be negative') ||
        error.message.includes('Maximum stock') ||
        error.message.includes('Reorder point') ||
        error.message.includes('Initial stock') ||
        error.message.includes('Current stock') ||
        error.message.includes('Expiry date') ||
        error.message.includes('already exists') ||
        error.message.includes('At least one branch must be selected') ||
        error.message.includes('At least one location') ||
        error.message.includes('You do not have access') ||
        error.message.includes('No access to location') ||
        error.message.includes('Invalid branch ID detected') ||
        error.message.includes('Invalid location ID detected') ||
        error.message.includes('Selected category does not exist') ||
        error.message.includes('Selected subcategory does not exist') ||
        error.message.includes('Subcategory does not belong to the selected category')) {
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
    const { companyId, userId, role, branchIds: userBranchIds } = req.user;
    const filters = req.query;

    // Get user's branch IDs if not already in req.user (for company admins)
    let effectiveBranchIds = userBranchIds;
    if (!effectiveBranchIds && role === 'company_admin') {
      const user = await CompanyUser.findById(userId).select('branchIds');
      effectiveBranchIds = user?.branchIds || [];
    }

    // Determine user's accessible branches
    const accessibleBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : effectiveBranchIds; // Company admins only have access to their assigned branches

    // Get inventory items with user's branch access
    const result = await inventoryService.getInventoryItems(
      companyId, 
      filters,
      accessibleBranchIds
    );

    // Transform location configs to match old branch format for frontend compatibility
    if (result.items && Array.isArray(result.items)) {
      result.items = result.items.map((item) => {
        if (item.branches && Array.isArray(item.branches)) {
          item.branches = item.branches.map((config) => ({
            ...config,
            branch: config.locationId, // Map locationId to branch for backward compatibility
            _id: config._id || config.locationId?._id
          }));
        }
        return item;
      });
    }

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
 * Get inventory item by ID with branch configurations
 * GET /api/inventory/items/:id
 */
export const getInventoryItemById = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds: userBranchIds } = req.user;
    const { id } = req.params;

    // Determine user's accessible branches
    const effectiveUserBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : userBranchIds; // Company admins only have access to their assigned branches

    // Get inventory item with ALL branch configurations
    const item = await inventoryService.getInventoryItemById(id, companyId, effectiveUserBranchIds);

    // Transform location configs to match old branch format for frontend compatibility
    if (item.branches && Array.isArray(item.branches)) {
      item.branches = item.branches.map((config) => ({
        ...config,
        branch: config.locationId, // Map locationId to branch for backward compatibility
        currentStock: config.availableQuantity, // Map availableQuantity to currentStock
        minimumStock: config.minimumStock,
        maximumStock: config.maximumStock,
        reorderPoint: config.reorderPoint,
        costingMethod: config.costingMethod,
        lastPurchasePrice: config.lastPurchasePrice,
        supplier: config.supplier
      }));
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
    const { companyId, userId, role, branchIds: userBranchIds } = req.user;
    const { id } = req.params;
    const updateData = req.body;

    // Determine effective branch IDs based on role
    let effectiveBranchIds = null; // Default for super admins
    
    if (role === 'company_admin') {
      // Company admins have restricted branch access
      effectiveBranchIds = userBranchIds;
      if (!effectiveBranchIds) {
        const user = await CompanyUser.findById(userId).select('branchIds');
        effectiveBranchIds = user?.branchIds?.map(id => id.toString()) || [];
      }
    }
    // Super admins (company_super_admin_primary, company_super_admin_secondary) get null

    // Update inventory item with correct parameter order
    const item = await inventoryService.updateInventoryItem(
      id, 
      updateData, 
      companyId, 
      userId,
      effectiveBranchIds
    );

    logger.info('Inventory item updated via API', { 
      itemId: id, 
      companyId, 
      userId 
    });

    // Check if auto-assignments were made by middleware
    if (req.autoAssignments && Object.keys(req.autoAssignments).length > 0) {
      // Return success response with auto-assignment details
      const response = formatSuccessWithAssignments({
        data: item,
        autoAssignments: req.autoAssignments,
        entityType: 'item',
        operation: 'updated'
      });
      
      return res.json(response);
    }

    // Return standard success response
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
        error.message.includes('Maximum stock') ||
        error.message.includes('Reorder point') ||
        error.message.includes('Initial stock') ||
        error.message.includes('Current stock') ||
        error.message.includes('Expiry date') ||
        error.message.includes('already exists') ||
        error.message.includes('At least one branch must be selected') ||
        error.message.includes('You do not have access') ||
        error.message.includes('Invalid branch ID detected') ||
        error.message.includes('Selected category does not exist') ||
        error.message.includes('Selected subcategory does not exist') ||
        error.message.includes('Subcategory does not belong to the selected category')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'You do not have access to this inventory item') {
      return res.status(403).json({
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
    const { companyId, userId, role, branchIds: userBranchIds } = req.user;
    const { id } = req.params;

    // Get existing item to verify branch access
    const existingItem = await inventoryService.getInventoryItemById(id, companyId);

    // Get user's branch IDs if not already in req.user (for company admins)
    let effectiveBranchIds = userBranchIds;
    if (!effectiveBranchIds && role === 'company_admin') {
      const user = await CompanyUser.findById(userId).select('branchIds');
      effectiveBranchIds = user?.branchIds?.map(id => id.toString()) || [];
    }

    // Verify branch access - check if user has access to any of item's branches
    // Super admins have access to all branches
    const isSuperAdmin = role === 'company_super_admin_primary' || role === 'company_super_admin_secondary';
    
    if (!isSuperAdmin) {
      // For company admins, check if they have access to at least one of the item's branches
      const hasAccess = existingItem.branchIds.some(branchId => 
        effectiveBranchIds.includes(branchId.toString())
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this inventory item'
        });
      }
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
    const { companyId, userId, role, branchIds: userBranchIds } = req.user;
    let { branchId } = req.query;

    // Get user's branch IDs if not already in req.user (for company admins)
    let effectiveBranchIds = userBranchIds;
    if (!effectiveBranchIds && role === 'company_admin') {
      const user = await CompanyUser.findById(userId).select('branchIds');
      effectiveBranchIds = user?.branchIds || [];
    }

    // For company admins, if no branchId specified or "all", use their assigned branches
    if (role === 'company_admin') {
      if (!branchId || branchId === 'all') {
        branchId = 'all'; // Will be handled by service layer with effectiveBranchIds
      } else {
        // Verify they have access to the specific branch
        const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'You do not have access to this branch'
          });
        }
      }
    } else {
      // For super admins, validate branchId is provided
      if (!branchId) {
        return res.status(400).json({
          success: false,
          message: 'Branch ID is required'
        });
      }

      // Verify branch access for specific branch
      if (branchId !== 'all') {
        const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'You do not have access to this branch'
          });
        }
      }
    }

    // Get low stock items - pass user's branchIds and role for service layer
    const items = await inventoryService.checkLowStock(companyId, branchId, effectiveBranchIds || [], role);

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
    const { companyId, userId, role, branchIds: userBranchIds } = req.user;
    let { branchId, daysAhead } = req.query;

    // Get user's branch IDs if not already in req.user (for company admins)
    let effectiveBranchIds = userBranchIds;
    if (!effectiveBranchIds && role === 'company_admin') {
      const user = await CompanyUser.findById(userId).select('branchIds');
      effectiveBranchIds = user?.branchIds || [];
    }

    // For company admins, if no branchId specified or "all", use their assigned branches
    if (role === 'company_admin') {
      if (!branchId || branchId === 'all') {
        branchId = 'all'; // Will be handled by service layer with effectiveBranchIds
      } else {
        // Verify they have access to the specific branch
        const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'You do not have access to this branch'
          });
        }
      }
    } else {
      // For super admins, validate branchId is provided
      if (!branchId) {
        return res.status(400).json({
          success: false,
          message: 'Branch ID is required'
        });
      }

      // Verify branch access for specific branch
      if (branchId !== 'all') {
        const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'You do not have access to this branch'
          });
        }
      }
    }

    // Get expiring items - pass user's branchIds and role
    const items = await inventoryService.checkExpiringItems(
      companyId, 
      branchId, 
      daysAhead ? parseInt(daysAhead) : 7,
      effectiveBranchIds || [],
      role
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
    const { companyId, userId, role, branchIds: userBranchIds } = req.user;
    let { branchId } = req.query;

    // Get user's branch IDs if not already in req.user (for company admins)
    let effectiveBranchIds = userBranchIds;
    if (!effectiveBranchIds && role === 'company_admin') {
      const user = await CompanyUser.findById(userId).select('branchIds');
      effectiveBranchIds = user?.branchIds || [];
    }

    // For company admins, if no branchId specified or "all", use their assigned branches
    if (role === 'company_admin') {
      if (!branchId || branchId === 'all') {
        branchId = 'all'; // Will be handled by service layer with effectiveBranchIds
      } else {
        // Verify they have access to the specific branch
        const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'You do not have access to this branch'
          });
        }
      }
    } else {
      // For super admins, validate branchId is provided
      if (!branchId) {
        return res.status(400).json({
          success: false,
          message: 'Branch ID is required'
        });
      }

      // Verify branch access for specific branch
      if (branchId !== 'all') {
        const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'You do not have access to this branch'
          });
        }
      }
    }

    // Get categories - pass user's branchIds and role to service function
    const categories = await inventoryService.getInventoryCategories(
      companyId, 
      branchId, 
      effectiveBranchIds || [], 
      role
    );

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
    
    // Handle capacity validation errors with detailed information
    if (error.message === 'Capacity validation failed' && error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        message: 'One or more items exceed maximum stock capacity',
        errors: error.details
      });
    }
    
    // Handle validation errors
    if (error.message.includes('Supplier is required') ||
        error.message.includes('Supplier not found') ||
        error.message.includes('Supplier is not active') ||
        error.message.includes('Supplier is not associated with the selected branch') ||
        error.message.includes('must have at least one line item') ||
        error.message.includes('must have inventoryItem') ||
        error.message.includes('Quantity must be positive') ||
        error.message.includes('Unit price must be non-negative') ||
        error.message.includes('is not available for this branch')) {
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
    const { companyId, userId, role, branchIds: userBranchIds } = req.user;
    const { branchId, ...filters } = req.query;

    // Validate branchId is provided
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Determine effective branchId based on role and request
    let effectiveBranchId = branchId;

    // Check if user is Super Admin
    const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role);

    if (branchId === 'all') {
      if (isSuperAdmin) {
        // Super Admin can view all branches - pass "all" to service
        effectiveBranchId = 'all';
      } else {
        // Company Admin requesting "all" - get their assigned branches
        let effectiveBranchIds = userBranchIds;
        if (!effectiveBranchIds) {
          const user = await CompanyUser.findById(userId).select('branchIds');
          effectiveBranchIds = user?.branchIds || [];
        }
        
        if (effectiveBranchIds.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'You do not have access to any branches'
          });
        }
        
        // Pass array of branch IDs to service
        effectiveBranchId = effectiveBranchIds;
      }
    } else {
      // Specific branch requested - verify access
      const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this branch'
        });
      }
      effectiveBranchId = branchId;
    }

    // Get GRNs with effective branch filter
    const result = await inventoryService.getGRNs(companyId, effectiveBranchId, filters);

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
 * Get GRN details by ID with complete populated references
 * GET /api/inventory/grn/:branchId/:grnId
 */
export const getGRNDetails = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId, grnId } = req.params;

    // Validate branchId and grnId are provided
    if (!branchId || !grnId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID and GRN ID are required'
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

    // Get GRN details
    const grn = await inventoryService.getGRNDetails(grnId, companyId, branchId);

    res.json({
      success: true,
      data: { grn }
    });
  } catch (error) {
    logger.error('Get GRN details error', error);
    
    if (error.message === 'GRN not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'GRN does not belong to the specified branch') {
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

    // Send notifications asynchronously after response
    setImmediate(async () => {
      try {
        const companyDB = getCompanyDB(companyId);
        const StockAdjustment = getStockAdjustmentModel(companyDB);

        // Populate adjustment with branch, inventoryItem, adjustedBy details
        const populatedAdjustment = await StockAdjustment.findById(adjustment._id)
          .populate('branch', 'name code')
          .populate('inventoryItem', 'name')
          .lean();

        if (!populatedAdjustment) {
          logger.error('Stock adjustment not found for notification:', adjustment._id);
          return;
        }

        // Manually populate adjustedBy from CompanyUser (platform DB)
        const adjustedByUser = await CompanyUser.findById(userId).select('name email').lean();
        if (!adjustedByUser) {
          logger.error('Adjusted by user not found for notification:', userId);
          return;
        }

        populatedAdjustment.adjustedBy = {
          _id: adjustedByUser._id,
          name: adjustedByUser.name,
          email: adjustedByUser.email
        };

        // Validate required fields before sending notification
        if (!populatedAdjustment.branch || !populatedAdjustment.branch.name) {
          logger.error('Branch information missing for notification:', populatedAdjustment);
          return;
        }

        if (!populatedAdjustment.inventoryItem || !populatedAdjustment.inventoryItem.name) {
          logger.error('Inventory item information missing for notification:', populatedAdjustment);
          return;
        }

        // Call notification service
        await notificationService.notifyStockAdjustmentCreation(companyId, populatedAdjustment);
        logger.info(`Notifications sent for stock adjustment ${adjustment.adjustmentNumber}`);
      } catch (notificationError) {
        logger.error('Error sending stock adjustment notifications:', notificationError);
        // Don't fail the adjustment creation if notifications fail
      }
    });
  } catch (error) {
    logger.error('Create stock adjustment error', error);
    
    if (error.message.includes('Missing required fields') ||
        error.message.includes('Invalid adjustment type') ||
        error.message.includes('Invalid reason') ||
        error.message.includes('Insufficient stock') ||
        error.message.includes('does not belong to this branch') ||
        error.message.includes('exceed maximum stock capacity')) {
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
    const { companyId, userId, role, branchIds: userBranchIds } = req.user;
    const { branchId, ...filters } = req.query;

    // Validate branchId is provided
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Determine effective branchId based on role and request
    let effectiveBranchId = branchId;

    // Check if user is Super Admin
    const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role);

    if (branchId === 'all') {
      if (isSuperAdmin) {
        // Super Admin can view all branches - pass "all" to service
        effectiveBranchId = 'all';
      } else {
        // Company Admin requesting "all" - get their assigned branches
        let effectiveBranchIds = userBranchIds;
        if (!effectiveBranchIds) {
          const user = await CompanyUser.findById(userId).select('branchIds');
          effectiveBranchIds = user?.branchIds || [];
        }
        
        if (effectiveBranchIds.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'You do not have access to any branches'
          });
        }
        
        // Pass array of branch IDs to service
        effectiveBranchId = effectiveBranchIds;
      }
    } else {
      // Specific branch requested - verify access
      const hasAccess = await verifyBranchAccess(userId, branchId, role, companyId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this branch'
        });
      }
      effectiveBranchId = branchId;
    }

    // Get stock adjustments with effective branch filter
    const result = await inventoryService.getStockAdjustments(companyId, effectiveBranchId, filters);

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
 * Get stock adjustment details
 * GET /api/inventory/adjustments/:branchId/:adjustmentId
 */
export const getStockAdjustmentDetails = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId, adjustmentId } = req.params;

    // Validate branchId and adjustmentId are provided
    if (!branchId || !adjustmentId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID and Adjustment ID are required'
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

    // Get stock adjustment details
    const adjustment = await inventoryService.getStockAdjustmentDetails(adjustmentId, companyId, branchId);

    logger.info('Stock adjustment details retrieved via API', { 
      adjustmentId, 
      companyId, 
      branchId, 
      userId 
    });

    res.json({
      success: true,
      data: { adjustment }
    });
  } catch (error) {
    logger.error('Get stock adjustment details error', error);
    
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
 * Resend stock adjustment in-app notifications
 * POST /api/inventory/adjustments/:branchId/:adjustmentId/resend-inapp-notifications
 */
export const resendStockAdjustmentInAppNotifications = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId, adjustmentId } = req.params;

    // Validate branchId and adjustmentId are provided
    if (!branchId || !adjustmentId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID and Adjustment ID are required'
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

    // Resend in-app notifications
    const result = await inventoryService.resendStockAdjustmentInAppNotifications(adjustmentId, companyId);

    logger.info('Stock adjustment in-app notifications resent via API', { 
      adjustmentId, 
      companyId, 
      branchId, 
      userId 
    });

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    logger.error('Resend stock adjustment in-app notifications error', error);
    
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

    // If branchId is provided, verify access (skip verification for "all" if user is super admin)
    if (branchId) {
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

/**
 * Get suppliers for a specific branch
 * GET /api/inventory/branches/:branchId/suppliers
 */
export const getSuppliersForBranch = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId } = req.params;

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

    // Get suppliers for branch
    const suppliers = await inventoryService.getSuppliersForBranch(branchId, companyId);

    res.json({
      success: true,
      data: { suppliers }
    });
  } catch (error) {
    logger.error('Get suppliers for branch error', error);
    next(error);
  }
};

/**
 * Get inventory items for a specific branch (for GRN creation)
 * GET /api/inventory/branches/:branchId/inventory-items
 */
export const getInventoryItemsForBranch = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId } = req.params;

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

    // Get inventory items for branch
    const items = await inventoryService.getInventoryItemsForBranch(branchId, companyId);

    res.json({
      success: true,
      data: { items }
    });
  } catch (error) {
    logger.error('Get inventory items for branch error', error);
    next(error);
  }
};

/**
 * Resend GRN in-app notifications
 * POST /api/inventory/grn/:branchId/:grnId/resend-inapp-notifications
 */
export const resendGRNInAppNotifications = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId, grnId } = req.params;

    // Validate branchId and grnId are provided
    if (!branchId || !grnId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID and GRN ID are required'
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

    // Resend in-app notifications
    const result = await inventoryService.resendGRNInAppNotifications(grnId, companyId);

    logger.info('GRN in-app notifications resent via API', { 
      grnId, 
      companyId, 
      branchId, 
      userId 
    });

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    logger.error('Resend GRN in-app notifications error', error);
    
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
 * Resend GRN email notifications
 * POST /api/inventory/grn/:branchId/:grnId/resend-email-notifications
 */
export const resendGRNEmailNotifications = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { branchId, grnId } = req.params;
    const { includeSupplier = false } = req.body;

    // Validate branchId and grnId are provided
    if (!branchId || !grnId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID and GRN ID are required'
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

    // Resend email notifications
    const result = await inventoryService.resendGRNEmailNotifications(grnId, companyId, includeSupplier);

    logger.info('GRN email notifications resent via API', { 
      grnId, 
      companyId, 
      branchId, 
      userId,
      includeSupplier 
    });

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    logger.error('Resend GRN email notifications error', error);
    
    if (error.message === 'GRN not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Failed to generate PDF receipt') {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};
