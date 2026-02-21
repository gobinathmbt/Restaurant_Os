/**
 * Inventory Item Branch Service
 * Business logic for branch-specific inventory item configuration operations
 */

import { getCompanyDB } from '../config/database.js';
import { getInventoryItemModel } from '../models/company/InventoryItem.js';
import { getCategoryModel } from '../models/company/Category.js';
import { getInventoryItemBranchModel } from '../models/company/InventoryItemBranch.js';
import { getLocationModel } from '../models/company/Location.js';
import { getSupplierModel } from '../models/company/Supplier.js';
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
 * Validate price format
 * @param {number} price - Price to validate
 * @throws {Error} If price is invalid
 */
const validatePrice = (price) => {
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
};

/**
 * Validate stock values
 * @param {Object} stockData - Stock data to validate
 * @throws {Error} If stock values are invalid
 */
const validateStockValues = (stockData) => {
  const { currentStock, minimumStock, maximumStock, reorderPoint } = stockData;

  // All stock values must be non-negative
  if (currentStock !== undefined && currentStock < 0) {
    throw new Error('Current stock cannot be negative');
  }
  if (minimumStock !== undefined && minimumStock < 0) {
    throw new Error('Minimum stock cannot be negative');
  }
  if (maximumStock !== undefined && maximumStock < 0) {
    throw new Error('Maximum stock cannot be negative');
  }
  if (reorderPoint !== undefined && reorderPoint < 0) {
    throw new Error('Reorder point cannot be negative');
  }

  // maximumStock must be >= minimumStock
  if (maximumStock !== undefined && minimumStock !== undefined && maximumStock < minimumStock) {
    throw new Error('Maximum stock must be greater than or equal to minimum stock');
  }

  // currentStock should be <= maximumStock
  if (currentStock !== undefined && maximumStock !== undefined && currentStock > maximumStock) {
    throw new Error('Current stock cannot exceed maximum stock');
  }

  // reorderPoint should be between minimumStock and maximumStock
  if (reorderPoint !== undefined && minimumStock !== undefined && reorderPoint < minimumStock) {
    throw new Error('Reorder point must be greater than or equal to minimum stock');
  }
  if (reorderPoint !== undefined && maximumStock !== undefined && reorderPoint > maximumStock) {
    throw new Error('Reorder point cannot exceed maximum stock');
  }
};

/**
 * Validate expiry date
 * @param {Date} expiryDate - Expiry date to validate
 * @throws {Error} If expiry date is invalid
 */
const validateExpiryDate = (expiryDate) => {
  if (expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    
    if (expiry < today) {
      throw new Error('Expiry date cannot be in the past');
    }
  }
};

/**
 * Get inventory items for a specific branch (merged with global data)
 * @param {string} branchId - Branch ID
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options (page, limit, search, type, category, subcategory, isActive, isAvailable)
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Paginated inventory items with branch config
 */
export const getInventoryItemsForBranch = async (branchId, companyId, filters = {}, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    // Ensure InventoryItem and Category models are registered on this connection
    getInventoryItemModel(companyDB);
    getCategoryModel(companyDB);

    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);
    const Supplier = getSupplierModel(companyDB); // Register Supplier model

    // Validate branch access
    if (!validateBranchAccess(branchId, userBranchIds)) {
      throw new Error('You do not have access to this branch');
    }

    const {
      page = 1,
      limit = 10,
      search = '',
      type = '',
      category = '',
      subcategory = '',
      isActive = '',
      isAvailable = ''
    } = filters;

    // Build query for InventoryItemBranch
    const branchQuery = {
      branch: branchId
      // Removed isActive filter - show all items (active and inactive)
    };

    // Availability filter
    if (isAvailable === 'true') {
      branchQuery.isAvailable = true;
    } else if (isAvailable === 'false') {
      branchQuery.isAvailable = false;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Query InventoryItemBranch and populate InventoryItem
    let query = InventoryItemBranch.find(branchQuery)
      .populate({
        path: 'inventoryItem',
        populate: [
          {
            path: 'category',
            select: 'name description color icon'
          },
          {
            path: 'subcategory',
            select: 'name description color icon'
          }
        ]
      })
      .populate({
        path: 'supplier',
        select: 'name contactPerson phone email'
      })
      .skip(skip)
      .limit(parseInt(limit));

    // Execute query
    const branchConfigs = await query.lean();

    // Filter by inventory item properties (search, type, category, subcategory)
    let filteredConfigs = branchConfigs;

    // Apply search filter on inventory item properties
    if (search) {
      const searchLower = search.toLowerCase();
      filteredConfigs = filteredConfigs.filter(config => {
        if (!config.inventoryItem) return false;
        
        const nameMatch = config.inventoryItem.name?.toLowerCase().includes(searchLower);
        const skuMatch = config.inventoryItem.sku?.toLowerCase().includes(searchLower);
        const barcodeMatch = config.inventoryItem.barcode?.toLowerCase().includes(searchLower);
        const branchSkuMatch = config.branchSKU?.toLowerCase().includes(searchLower);
        const branchBarcodeMatch = config.branchBarcode?.toLowerCase().includes(searchLower);
        
        return nameMatch || skuMatch || barcodeMatch || branchSkuMatch || branchBarcodeMatch;
      });
    }

    // Apply type filter
    if (type) {
      filteredConfigs = filteredConfigs.filter(config => {
        return config.inventoryItem?.type === type;
      });
    }

    // Apply category filter
    if (category) {
      filteredConfigs = filteredConfigs.filter(config => {
        return config.inventoryItem?.category?._id?.toString() === category;
      });
    }

    // Apply subcategory filter
    if (subcategory) {
      filteredConfigs = filteredConfigs.filter(config => {
        return config.inventoryItem?.subcategory?._id?.toString() === subcategory;
      });
    }

    // Apply active filter on inventory item
    if (isActive !== '') {
      const activeValue = isActive === 'true';
      filteredConfigs = filteredConfigs.filter(config => {
        return config.inventoryItem?.isActive === activeValue;
      });
    }

    // Merge global properties with branch-specific config
    const mergedInventoryItems = filteredConfigs.map(config => {
      if (!config.inventoryItem) return null;

      return {
        // Global properties from InventoryItem
        _id: config.inventoryItem._id,
        name: config.inventoryItem.name,
        type: config.inventoryItem.type,
        category: config.inventoryItem.category,
        subcategory: config.inventoryItem.subcategory,
        unit: config.inventoryItem.unit,
        sku: config.inventoryItem.sku,
        barcode: config.inventoryItem.barcode,
        description: config.inventoryItem.description,
        
        // Branch-specific properties from InventoryItemBranch
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
          isAvailable: config.isAvailable,
          notes: config.notes,
          isActive: config.isActive,
          isLowStock: config.currentStock <= config.minimumStock,
          isExpiringSoon: config.expiryDate ? isExpiringSoon(config.expiryDate) : false,
          stockPercentage: config.maximumStock ? (config.currentStock / config.maximumStock) * 100 : null
        },
        
        isActive: config.inventoryItem.isActive && config.isActive,
        createdAt: config.inventoryItem.createdAt,
        updatedAt: config.inventoryItem.updatedAt
      };
    }).filter(item => item !== null);

    // Sort by name
    mergedInventoryItems.sort((a, b) => a.name.localeCompare(b.name));

    // Get total count for pagination
    const total = await InventoryItemBranch.countDocuments(branchQuery);

    return {
      items: mergedInventoryItems, // Changed from inventoryItems to items
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

/**
 * Get a single InventoryItemBranch (branch-specific inventory item) by its ID
 * @param {string} branchItemId - InventoryItemBranch document ID
 * @param {string} branchId - Branch ID (for validation)
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} InventoryItemBranch document populated
 */
export const getInventoryItemBranchById = async (branchItemId, branchId, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB);

    // Validate access if needed
    if (userBranchIds !== null && userBranchIds !== undefined) {
      if (!userBranchIds.includes(branchId)) {
        throw new Error('You do not have access to this branch');
      }
    }

    const branchConfig = await InventoryItemBranch.findById(branchItemId)
      .populate({
        path: 'inventoryItem',
        populate: [
          { path: 'category', select: 'name description color icon' },
          { path: 'subcategory', select: 'name description color icon' }
        ]
      })
      .populate({ path: 'supplier', select: 'name contactPerson phone email' })
      .lean();

    if (!branchConfig) {
      throw new Error('Inventory item branch config not found');
    }

    // Ensure it belongs to the requested branch
    if (branchConfig.branch && branchConfig.branch.toString() !== branchId.toString()) {
      throw new Error('Inventory item does not belong to the requested branch');
    }

    return branchConfig;
  } catch (error) {
    logger.error('Error getting inventory item branch by id:', error);
    throw error;
  }
};

/**
 * Get multiple InventoryItemBranch documents by their IDs for a branch
 * @param {Array<string>} branchItemIds - Array of InventoryItemBranch document IDs
 * @param {string} branchId - Branch ID
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Array>} Array of InventoryItemBranch documents populated
 */
export const getInventoryItemBranchesByIds = async (branchItemIds, branchId, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB);

    // Validate access if needed
    if (userBranchIds !== null && userBranchIds !== undefined) {
      if (!userBranchIds.includes(branchId)) {
        throw new Error('You do not have access to this branch');
      }
    }

    const docs = await InventoryItemBranch.find({
      _id: { $in: branchItemIds },
      branch: branchId
    })
      .populate({
        path: 'inventoryItem',
        populate: [
          { path: 'category', select: 'name description color icon' },
          { path: 'subcategory', select: 'name description color icon' }
        ]
      })
      .populate({ path: 'supplier', select: 'name contactPerson phone email' })
      .lean();

    return docs;
  } catch (error) {
    logger.error('Error getting inventory item branches by ids:', error);
    throw error;
  }
};

/**
 * Check if expiry date is within 7 days
 * @param {Date} expiryDate - Expiry date to check
 * @returns {boolean} Whether expiring soon
 */
const isExpiringSoon = (expiryDate) => {
  if (!expiryDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  return expiry >= today && expiry <= sevenDaysFromNow;
};

/**
 * Bulk update branch configurations for an inventory item
 * @param {string} itemId - Inventory item ID
 * @param {Array} branchConfigs - Array of { branchId, ...config }
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID for audit
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Updated branch configs with auto-assignment results
 */
export const bulkUpdateBranchConfigs = async (itemId, branchConfigs, companyId, userId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);
    const Branch = getLocationModel(companyDB);

    // Validate inventory item exists
    const inventoryItem = await InventoryItem.findById(itemId)
      .populate('category')
      .populate('subcategory');
    
    if (!inventoryItem) {
      throw new Error('Inventory item not found');
    }

    const updatedConfigs = [];
    const newBranchIds = []; // Track newly added branches

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

      // Validate prices if provided
      if (updateData.costPrice !== undefined) {
        validatePrice(updateData.costPrice);
      }
      if (updateData.lastPurchasePrice !== undefined) {
        validatePrice(updateData.lastPurchasePrice);
      }

      // Validate stock values if provided
      validateStockValues(updateData);

      // Validate expiry date if provided
      if (updateData.expiryDate !== undefined) {
        validateExpiryDate(updateData.expiryDate);
      }

      // Find existing config or create new one
      let branchConfig = await InventoryItemBranch.findOne({
        inventoryItem: itemId,
        branch: branchId
      });

      if (branchConfig) {
        // Update existing config
        Object.assign(branchConfig, updateData);
        await branchConfig.save();
      } else {
        // Create new config - track this as a new branch assignment
        newBranchIds.push(branchId);
        
        branchConfig = new InventoryItemBranch({
          inventoryItem: itemId,
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
          isAvailable: updateData.isAvailable !== undefined ? updateData.isAvailable : true,
          notes: updateData.notes,
          isActive: true
        });
        await branchConfig.save();
      }

      updatedConfigs.push(branchConfig);
    }

    // Auto-assign category and subcategory to newly added branches
    const autoAssignments = {
      assigned: {
        categories: [],
        subcategories: [],
        suppliers: []
      },
      alreadyAssigned: {
        categories: [],
        subcategories: [],
        suppliers: []
      }
    };

    if (newBranchIds.length > 0) {
      logger.info(`Auto-assigning category/subcategory to new branches: ${newBranchIds.join(', ')}`);
      
      const CategoryBranchValidationService = (await import('./categoryBranchValidationService.js')).default;
      const validationService = new CategoryBranchValidationService(companyDB);
      
      // Prepare category and subcategory IDs
      const categoryIds = inventoryItem.category ? [inventoryItem.category._id.toString()] : [];
      const subcategoryIds = inventoryItem.subcategory ? [inventoryItem.subcategory._id.toString()] : [];
      
      // Auto-assign categories and subcategories
      const assignmentResult = await validationService.assignCategoriesToBranches(
        newBranchIds,
        categoryIds,
        subcategoryIds,
        userId || 'system',
        'inventory_item_branch_update',
        null // no session
      );
      
      autoAssignments.assigned.categories = assignmentResult.assigned.categories;
      autoAssignments.assigned.subcategories = assignmentResult.assigned.subcategories;
      autoAssignments.alreadyAssigned.categories = assignmentResult.alreadyAssigned.categories;
      autoAssignments.alreadyAssigned.subcategories = assignmentResult.alreadyAssigned.subcategories;
      
      logger.info(`Category/subcategory assignment result:`, assignmentResult);
    }

    // Auto-assign suppliers to branches where specified
    const Supplier = getSupplierModel(companyDB);
    for (const config of branchConfigs) {
      if (config.supplier) {
        const supplier = await Supplier.findById(config.supplier);
        if (supplier) {
          const supplierBranchIds = supplier.branchIds.map(id => id.toString());
          if (!supplierBranchIds.includes(config.branchId.toString())) {
            supplier.branchIds.push(config.branchId);
            await supplier.save();
            
            autoAssignments.assigned.suppliers.push({
              supplierId: supplier._id.toString(),
              supplierName: supplier.name,
              branchIds: [config.branchId]
            });
            
            logger.info(`Auto-assigned supplier ${supplier._id} to branch ${config.branchId}`);
          } else {
            autoAssignments.alreadyAssigned.suppliers.push({
              supplierId: supplier._id.toString(),
              supplierName: supplier.name
            });
          }
        }
      }
    }

    logger.info(`Bulk updated ${updatedConfigs.length} branch configs for inventory item ${itemId} in company: ${companyId}`);

    // Populate and return
    const populatedConfigs = await InventoryItemBranch.find({
      _id: { $in: updatedConfigs.map(c => c._id) }
    })
      .populate('inventoryItem')
      .populate('branch')
      .populate('supplier')
      .lean();

    return {
      branchConfigs: populatedConfigs,
      autoAssignments
    };
  } catch (error) {
    logger.error('Error bulk updating branch configs:', error);
    throw error;
  }
};

/**
 * Delete branch configuration (remove item from branch)
 * @param {string} itemId - Inventory item ID
 * @param {string} branchId - Branch ID
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Deleted branch config
 */
export const deleteBranchConfig = async (itemId, branchId, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);

    // Validate branch access
    if (!validateBranchAccess(branchId, userBranchIds)) {
      throw new Error('You do not have access to this branch');
    }

    // Find and delete branch config
    const branchConfig = await InventoryItemBranch.findOneAndDelete({
      inventoryItem: itemId,
      branch: branchId
    });

    if (!branchConfig) {
      throw new Error('Branch configuration not found');
    }

    logger.info(`Branch config deleted for inventory item: ${itemId}, branch: ${branchId}, company: ${companyId}`);

    return branchConfig;
  } catch (error) {
    logger.error('Error deleting branch config:', error);
    throw error;
  }
};

