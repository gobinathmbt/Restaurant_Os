/**
 * Inventory Item Branch Service
 * Business logic for branch-specific inventory item configuration operations
 */

import { getCompanyDB } from '../config/database.js';
import { getInventoryItemModel } from '../models/company/InventoryItem.js';
import { getInventoryItemBranchModel } from '../models/company/InventoryItemBranch.js';
import { getBranchModel } from '../models/company/Branch.js';
import { logger } from '../utils/logger.js';

/**
 * Validate branch access based on user role
 * @param {string} branchId - Branch ID to validate
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {boolean} Whether user has access
 */
const validateBranchAccess = (branchId, userBranchIds) => {
  // Super admin has access to all branches
  if (userBranchIds === null || userBranchIds === undefined) {
    return true;
  }

  // Check if branch is in user's accessible branches
  return userBranchIds.includes(branchId.toString());
};

/**
 * Validate stock values
 * @param {number} value - Stock value to validate
 * @throws {Error} If value is invalid
 */
const validateStockValue = (value) => {
  if (value !== undefined && value !== null) {
    if (value < 0) {
      throw new Error('Stock value cannot be negative');
    }
  }
};

/**
 * Validate price
 * @param {number} price - Price to validate
 * @throws {Error} If price is invalid
 */
const validatePrice = (price) => {
  if (price !== undefined && price !== null) {
    if (price < 0) {
      throw new Error('Price cannot be negative');
    }
    
    // Check for max 2 decimal places
    const priceStr = price.toString();
    if (priceStr.includes('.')) {
      const decimalPlaces = priceStr.split('.')[1].length;
      if (decimalPlaces > 2) {
        throw new Error('Price cannot have more than 2 decimal places');
      }
    }
  }
};

/**
 * Create branch configuration for inventory item
 * @param {string} inventoryItemId - Inventory item ID
 * @param {string} branchId - Branch ID
 * @param {Object} configData - Branch configuration data
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Created branch config
 */
export const createBranchConfig = async (inventoryItemId, branchId, configData, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);
    const Branch = getBranchModel(companyDB);

    // Validate branch access
    if (!validateBranchAccess(branchId, userBranchIds)) {
      throw new Error('You do not have access to this branch');
    }

    // Validate inventory item exists
    const inventoryItem = await InventoryItem.findById(inventoryItemId);
    if (!inventoryItem) {
      throw new Error('Inventory item not found');
    }

    // Validate branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      throw new Error('Branch not found');
    }

    // Validate stock values
    validateStockValue(configData.currentStock);
    validateStockValue(configData.minimumStock);
    validateStockValue(configData.maximumStock);
    validateStockValue(configData.reorderPoint);

    // Validate prices
    validatePrice(configData.costPrice);
    validatePrice(configData.lastPurchasePrice);

    // Check if branch config already exists
    const existingConfig = await InventoryItemBranch.findOne({
      inventoryItem: inventoryItemId,
      branch: branchId
    });

    if (existingConfig) {
      throw new Error('Branch configuration already exists for this inventory item');
    }

    // Create branch configuration
    const branchConfig = new InventoryItemBranch({
      inventoryItem: inventoryItemId,
      branch: branchId,
      ...configData
    });

    await branchConfig.save();

    logger.info(`Inventory branch config created: ${inventoryItemId}, branch: ${branchId}, company: ${companyId}`);

    // Populate and return
    await branchConfig.populate('inventoryItem');
    await branchConfig.populate('branch');
    await branchConfig.populate('supplier');

    return branchConfig;
  } catch (error) {
    logger.error('Error creating inventory branch config:', error);
    throw error;
  }
};

/**
 * Get branch configuration for inventory item
 * @param {string} inventoryItemId - Inventory item ID
 * @param {string} branchId - Branch ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Branch configuration
 */
export const getBranchConfig = async (inventoryItemId, branchId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);

    const branchConfig = await InventoryItemBranch.findOne({
      inventoryItem: inventoryItemId,
      branch: branchId
    })
      .populate('inventoryItem')
      .populate('branch')
      .populate('supplier')
      .lean();

    if (!branchConfig) {
      throw new Error('Branch configuration not found');
    }

    return branchConfig;
  } catch (error) {
    logger.error('Error getting inventory branch config:', error);
    throw error;
  }
};

/**
 * Update branch configuration
 * @param {string} inventoryItemId - Inventory item ID
 * @param {string} branchId - Branch ID
 * @param {Object} updateData - Update data
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Updated branch config
 */
export const updateBranchConfig = async (inventoryItemId, branchId, updateData, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);

    // Validate branch access
    if (!validateBranchAccess(branchId, userBranchIds)) {
      throw new Error('You do not have access to this branch');
    }

    // Get existing branch config
    const branchConfig = await InventoryItemBranch.findOne({
      inventoryItem: inventoryItemId,
      branch: branchId
    });

    if (!branchConfig) {
      throw new Error('Branch configuration not found');
    }

    // Validate stock values if being updated
    validateStockValue(updateData.currentStock);
    validateStockValue(updateData.minimumStock);
    validateStockValue(updateData.maximumStock);
    validateStockValue(updateData.reorderPoint);

    // Validate prices if being updated
    validatePrice(updateData.costPrice);
    validatePrice(updateData.lastPurchasePrice);

    // Update branch config
    Object.assign(branchConfig, updateData);
    await branchConfig.save();

    logger.info(`Inventory branch config updated: ${inventoryItemId}, branch: ${branchId}, company: ${companyId}`);

    // Populate and return
    await branchConfig.populate('inventoryItem');
    await branchConfig.populate('branch');
    await branchConfig.populate('supplier');

    return branchConfig;
  } catch (error) {
    logger.error('Error updating inventory branch config:', error);
    throw error;
  }
};

/**
 * Delete branch configuration (remove item from branch)
 * @param {string} inventoryItemId - Inventory item ID
 * @param {string} branchId - Branch ID
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Deleted branch config
 */
export const deleteBranchConfig = async (inventoryItemId, branchId, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);

    // Validate branch access
    if (!validateBranchAccess(branchId, userBranchIds)) {
      throw new Error('You do not have access to this branch');
    }

    // Find and delete branch config
    const branchConfig = await InventoryItemBranch.findOneAndDelete({
      inventoryItem: inventoryItemId,
      branch: branchId
    });

    if (!branchConfig) {
      throw new Error('Branch configuration not found');
    }

    logger.info(`Inventory branch config deleted: ${inventoryItemId}, branch: ${branchId}, company: ${companyId}`);

    return branchConfig;
  } catch (error) {
    logger.error('Error deleting inventory branch config:', error);
    throw error;
  }
};

/**
 * Bulk update branch configurations for an inventory item
 * @param {string} inventoryItemId - Inventory item ID
 * @param {Array} branchConfigs - Array of { branchId, ...config }
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Array>} Updated branch configs
 */
export const bulkUpdateBranchConfigs = async (inventoryItemId, branchConfigs, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);
    const Branch = getBranchModel(companyDB);

    // Validate inventory item exists
    const inventoryItem = await InventoryItem.findById(inventoryItemId);
    if (!inventoryItem) {
      throw new Error('Inventory item not found');
    }

    const updatedConfigs = [];

    // Process each branch config
    for (const config of branchConfigs) {
      const { branchId, ...updateData } = config;

      // Validate branch access
      if (!validateBranchAccess(branchId, userBranchIds)) {
        throw new Error(`You do not have access to branch: ${branchId}`);
      }

      // Validate branch exists
      const branch = await Branch.findById(branchId);
      if (!branch) {
        throw new Error(`Branch not found: ${branchId}`);
      }

      // Validate stock values
      validateStockValue(updateData.currentStock);
      validateStockValue(updateData.minimumStock);
      validateStockValue(updateData.maximumStock);
      validateStockValue(updateData.reorderPoint);

      // Validate prices
      validatePrice(updateData.costPrice);
      validatePrice(updateData.lastPurchasePrice);

      // Find existing config or create new one
      let branchConfig = await InventoryItemBranch.findOne({
        inventoryItem: inventoryItemId,
        branch: branchId
      });

      if (branchConfig) {
        // Update existing config
        Object.assign(branchConfig, updateData);
        await branchConfig.save();
      } else {
        // Create new config
        branchConfig = new InventoryItemBranch({
          inventoryItem: inventoryItemId,
          branch: branchId,
          currentStock: updateData.currentStock !== undefined ? updateData.currentStock : 0,
          minimumStock: updateData.minimumStock !== undefined ? updateData.minimumStock : 0,
          maximumStock: updateData.maximumStock,
          reorderPoint: updateData.reorderPoint,
          costPrice: updateData.costPrice,
          lastPurchasePrice: updateData.lastPurchasePrice,
          lastPurchaseDate: updateData.lastPurchaseDate,
          supplier: updateData.supplier,
          storageLocation: updateData.storageLocation,
          batchNumber: updateData.batchNumber,
          expiryDate: updateData.expiryDate,
          branchSKU: updateData.branchSKU,
          branchBarcode: updateData.branchBarcode,
          isActive: true,
          isAvailable: updateData.isAvailable !== undefined ? updateData.isAvailable : true,
          notes: updateData.notes
        });
        await branchConfig.save();
      }

      updatedConfigs.push(branchConfig);
    }

    logger.info(`Bulk updated ${updatedConfigs.length} inventory branch configs for item ${inventoryItemId}`);

    // Populate and return
    const populatedConfigs = await InventoryItemBranch.find({
      _id: { $in: updatedConfigs.map(c => c._id) }
    })
      .populate('inventoryItem')
      .populate('branch')
      .populate('supplier')
      .lean();

    return populatedConfigs;
  } catch (error) {
    logger.error('Error bulk updating inventory branch configs:', error);
    throw error;
  }
};

/**
 * Get inventory items for a specific branch
 * @param {string} branchId - Branch ID
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Paginated inventory items with branch config
 */
export const getInventoryItemsForBranch = async (branchId, companyId, filters = {}, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);

    // Validate branch access
    if (!validateBranchAccess(branchId, userBranchIds)) {
      throw new Error('You do not have access to this branch');
    }

    const {
      page = 1,
      limit = 10,
      search = '',
      type = '',
      isActive = ''
    } = filters;

    // Build query
    const branchQuery = {
      branch: branchId
    };

    // Active/Inactive filter
    if (isActive === 'true') {
      branchQuery.isActive = true;
    } else if (isActive === 'false') {
      branchQuery.isActive = false;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Query InventoryItemBranch and populate InventoryItem
    const branchConfigs = await InventoryItemBranch.find(branchQuery)
      .populate({
        path: 'inventoryItem',
        populate: {
          path: 'category subcategory',
          select: 'name description color'
        }
      })
      .populate('branch', 'name code')
      .populate('supplier', 'name contactPerson phone')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Filter by search and type
    let filteredConfigs = branchConfigs;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredConfigs = filteredConfigs.filter(config => {
        if (!config.inventoryItem) return false;
        return config.inventoryItem.name?.toLowerCase().includes(searchLower);
      });
    }

    if (type) {
      filteredConfigs = filteredConfigs.filter(config => {
        return config.inventoryItem?.type === type;
      });
    }

    // Merge data
    const mergedItems = filteredConfigs.map(config => {
      if (!config.inventoryItem) return null;

      return {
        _id: config.inventoryItem._id,
        name: config.inventoryItem.name,
        type: config.inventoryItem.type,
        category: config.inventoryItem.category,
        subcategory: config.inventoryItem.subcategory,
        unit: config.inventoryItem.unit,
        
        // Branch-specific data
        branchConfig: {
          _id: config._id,
          currentStock: config.currentStock,
          minimumStock: config.minimumStock,
          maximumStock: config.maximumStock,
          reorderPoint: config.reorderPoint,
          costPrice: config.costPrice,
          lastPurchasePrice: config.lastPurchasePrice,
          lastPurchaseDate: config.lastPurchaseDate,
          supplier: config.supplier,
          storageLocation: config.storageLocation,
          batchNumber: config.batchNumber,
          expiryDate: config.expiryDate,
          branchSKU: config.branchSKU,
          branchBarcode: config.branchBarcode,
          isActive: config.isActive,
          isAvailable: config.isAvailable,
          isLowStock: config.isLowStock,
          isExpiringSoon: config.isExpiringSoon,
          notes: config.notes
        },
        
        isActive: config.inventoryItem.isActive && config.isActive,
        createdAt: config.inventoryItem.createdAt,
        updatedAt: config.inventoryItem.updatedAt
      };
    }).filter(item => item !== null);

    const total = await InventoryItemBranch.countDocuments(branchQuery);

    return {
      inventoryItems: mergedItems,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting inventory items for branch:', error);
    throw error;
  }
};
