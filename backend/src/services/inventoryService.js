/**
 * Inventory Service
 * Business logic for inventory management operations
 */

import { getCompanyDB } from '../config/database.js';
import { getInventoryItemModel } from '../models/company/InventoryItem.js';
import { getGRNModel } from '../models/company/GRN.js';
import { getStockAdjustmentModel } from '../models/company/StockAdjustment.js';
import { getStockTransferModel } from '../models/company/StockTransfer.js';
import { getCategoryModel } from '../models/company/Category.js';
import { getBranchModel } from '../models/company/Branch.js';
import { getSupplierModel } from '../models/company/Supplier.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new inventory item
 * @param {Object} itemData - Inventory item data
 * @param {string} companyId - Company ID
 * @param {Array<string>} userBranchIds - User's accessible branch IDs
 * @param {string} userRole - User's role (company_admin, company_super_admin_primary, company_super_admin_secondary)
 * @returns {Promise<Object>} Created inventory item
 */
export const createInventoryItem = async (itemData, companyId, userBranchIds, userRole) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);
    const Category = getCategoryModel(companyDB);
    const Branch = getBranchModel(companyDB);

    // Validate required fields
    const requiredFields = ['name', 'type', 'unit', 'minimumStock', 'branchIds', 'category'];
    const missingFields = requiredFields.filter(field => !itemData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate branchIds is an array with at least one element
    if (!Array.isArray(itemData.branchIds) || itemData.branchIds.length === 0) {
      throw new Error('At least one branch must be selected');
    }

    // For company admins, validate that all branchIds are in userBranchIds
    if (userRole === 'company_admin') {
      const invalidBranches = itemData.branchIds.filter(
        branchId => !userBranchIds.includes(branchId.toString())
      );
      
      if (invalidBranches.length > 0) {
        throw new Error('You do not have access to one or more selected branches');
      }
    }

    // Validate that all branch IDs exist
    const branches = await Branch.find({ 
      _id: { $in: itemData.branchIds },
      isActive: true 
    });
    
    if (branches.length !== itemData.branchIds.length) {
      throw new Error('Invalid branch ID detected');
    }

    // Validate that category ObjectId references an existing Category document
    const category = await Category.findById(itemData.category);
    if (!category) {
      throw new Error('Selected category does not exist');
    }

    // If subcategory is provided, validate it exists and belongs to the category
    if (itemData.subcategory) {
      const subcategory = await Category.findById(itemData.subcategory);
      if (!subcategory) {
        throw new Error('Selected subcategory does not exist');
      }
      
      // Verify subcategory belongs to the selected category
      if (!subcategory.parent || subcategory.parent.toString() !== itemData.category.toString()) {
        throw new Error('Subcategory does not belong to the selected category');
      }
    }

    // Validate negative values
    const numericFields = ['currentStock', 'minimumStock', 'maximumStock', 'reorderPoint', 'costPrice'];
    for (const field of numericFields) {
      if (itemData[field] !== undefined && itemData[field] < 0) {
        throw new Error(`${field} cannot be negative`);
      }
    }

    // Validate stock ranges and logical relationships
    const initialStock = itemData.initialStock !== undefined ? itemData.initialStock : itemData.currentStock;
    const minStock = itemData.minimumStock;
    const maxStock = itemData.maximumStock;
    const reorderPoint = itemData.reorderPoint;

    // Maximum stock must be greater than minimum stock
    if (maxStock !== undefined && maxStock > 0 && maxStock < minStock) {
      throw new Error('Maximum stock must be greater than or equal to minimum stock');
    }

    // Reorder point should be between minimum and maximum stock
    if (reorderPoint !== undefined && reorderPoint > 0) {
      if (reorderPoint < minStock) {
        throw new Error('Reorder point should be greater than or equal to minimum stock');
      }
      if (maxStock !== undefined && maxStock > 0 && reorderPoint > maxStock) {
        throw new Error('Reorder point should be less than or equal to maximum stock');
      }
    }

    // Initial stock validation (for new items)
    if (initialStock !== undefined && maxStock !== undefined && maxStock > 0 && initialStock > maxStock) {
      throw new Error('Initial stock cannot exceed maximum stock');
    }

    // Validate expiry date is not in the past
    if (itemData.expiryDate) {
      const expiryDate = new Date(itemData.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (expiryDate < today) {
        throw new Error('Expiry date cannot be in the past');
      }
    }

    // Check unique SKU/barcode
    if (itemData.sku) {
      const existingSku = await InventoryItem.findOne({ sku: itemData.sku, isActive: true });
      if (existingSku) {
        throw new Error('SKU already exists');
      }
    }

    if (itemData.barcode) {
      const existingBarcode = await InventoryItem.findOne({ barcode: itemData.barcode, isActive: true });
      if (existingBarcode) {
        throw new Error('Barcode already exists');
      }
    }

    // Set initial stock if provided, otherwise default to 0
    if (itemData.initialStock !== undefined) {
      itemData.currentStock = itemData.initialStock;
      delete itemData.initialStock;
    } else if (itemData.currentStock === undefined) {
      itemData.currentStock = 0;
    }

    // Create inventory item with branchIds array
    const inventoryItem = new InventoryItem({
      ...itemData,
      branchIds: itemData.branchIds,
      category: itemData.category,
      subcategory: itemData.subcategory || null,
      isActive: true
    });

    await inventoryItem.save();

    logger.info(`Inventory item created: ${inventoryItem._id} for company: ${companyId}`);

    return inventoryItem;
  } catch (error) {
    logger.error('Error creating inventory item:', error);
    throw error;
  }
};

/**
 * Create inventory item with branch configurations
 * @param {Object} inventoryItemData - Inventory item data
 * @param {Array} branchConfigs - Array of branch configurations
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Created inventory item with branch configs
 */
export const createInventoryItemWithBranches = async (inventoryItemData, branchConfigs, companyId, userId, userBranchIds = null) => {
  // Get company database connection first
  const companyDB = getCompanyDB(companyId);
  
  // Check if transactions are supported (replica set or mongos)
  const supportsTransactions = companyDB.client?.topology?.description?.type !== 'Single';
  
  let session = null;
  if (supportsTransactions) {
    session = await companyDB.startSession();
    session.startTransaction();
  }

  try {
    const InventoryItem = getInventoryItemModel(companyDB);
    const { getInventoryItemBranchModel } = await import('../models/company/InventoryItemBranch.js');
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);
    const Category = getCategoryModel(companyDB);
    const Branch = getBranchModel(companyDB);

    // Validate required fields
    const requiredFields = ['name', 'type', 'unit', 'category'];
    const missingFields = requiredFields.filter(field => !inventoryItemData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate branch configs
    if (!branchConfigs || !Array.isArray(branchConfigs) || branchConfigs.length === 0) {
      throw new Error('At least one branch configuration is required');
    }

    // Extract branch IDs from configs
    const branchIds = branchConfigs.map(config => config.branchId);

    // Validate branch access
    if (userBranchIds !== null) {
      const invalidBranches = branchIds.filter(
        branchId => !userBranchIds.includes(branchId.toString())
      );
      
      if (invalidBranches.length > 0) {
        throw new Error(`No access to branch: ${invalidBranches[0]}`);
      }
    }

    // Validate that all branch IDs exist
    const branchQuery = Branch.find({ 
      _id: { $in: branchIds },
      isActive: true 
    });
    if (session) branchQuery.session(session);
    const branches = await branchQuery;
    
    if (branches.length !== branchIds.length) {
      throw new Error('Invalid branch ID detected');
    }

    // Validate category exists
    const categoryQuery = Category.findById(inventoryItemData.category);
    if (session) categoryQuery.session(session);
    const category = await categoryQuery;
    
    if (!category) {
      throw new Error('Selected category does not exist');
    }

    // If subcategory is provided, validate it
    if (inventoryItemData.subcategory) {
      const subcategoryQuery = Category.findById(inventoryItemData.subcategory);
      if (session) subcategoryQuery.session(session);
      const subcategory = await subcategoryQuery;
      
      if (!subcategory) {
        throw new Error('Selected subcategory does not exist');
      }
      
      if (!subcategory.parent || subcategory.parent.toString() !== inventoryItemData.category.toString()) {
        throw new Error('Subcategory does not belong to the selected category');
      }
    }

    // Check unique SKU/barcode if provided
    if (inventoryItemData.sku) {
      const existingSkuQuery = InventoryItem.findOne({ sku: inventoryItemData.sku, isActive: true });
      if (session) existingSkuQuery.session(session);
      const existingSku = await existingSkuQuery;
      
      if (existingSku) {
        throw new Error('SKU already exists');
      }
    }

    if (inventoryItemData.barcode) {
      const existingBarcodeQuery = InventoryItem.findOne({ barcode: inventoryItemData.barcode, isActive: true });
      if (session) existingBarcodeQuery.session(session);
      const existingBarcode = await existingBarcodeQuery;
      
      if (existingBarcode) {
        throw new Error('Barcode already exists');
      }
    }

    // Auto-assign category and subcategory to branches if needed
    const categoryId = inventoryItemData.category;
    const subcategoryId = inventoryItemData.subcategory;

    logger.info(`Auto-assigning inventory category ${categoryId} to branches: ${branchIds.join(', ')}`);

    const CategoryBranchValidationService = (await import('./categoryBranchValidationService.js')).default;
    const validationService = new CategoryBranchValidationService(companyDB);
    
    const categoryIdsToAssign = [categoryId];
    const subcategoryIdsToAssign = subcategoryId ? [subcategoryId] : [];
    
    const assignmentResult = await validationService.assignCategoriesToBranches(
      branchIds,
      categoryIdsToAssign,
      subcategoryIdsToAssign,
      userId,
      'inventory_item_assignment',
      session
    );

    logger.info(`Category assignment result:`, assignmentResult);

    // Create inventory item (without branch-specific data)
    let inventoryItem;
    if (session) {
      const items = await InventoryItem.create(
        [{
          name: inventoryItemData.name,
          type: inventoryItemData.type,
          category: inventoryItemData.category,
          subcategory: inventoryItemData.subcategory || null,
          unit: inventoryItemData.unit,
          sku: inventoryItemData.sku,
          barcode: inventoryItemData.barcode,
          branchIds: branchIds, // Store branch IDs for backward compatibility
          currentStock: 0, // Will be managed per branch
          minimumStock: 0, // Will be managed per branch
          isActive: true
        }],
        { session }
      );
      inventoryItem = items[0];
    } else {
      inventoryItem = await InventoryItem.create({
        name: inventoryItemData.name,
        type: inventoryItemData.type,
        category: inventoryItemData.category,
        subcategory: inventoryItemData.subcategory || null,
        unit: inventoryItemData.unit,
        sku: inventoryItemData.sku,
        barcode: inventoryItemData.barcode,
        branchIds: branchIds,
        currentStock: 0,
        minimumStock: 0,
        isActive: true
      });
    }

    logger.info(`Inventory item created: ${inventoryItem._id} for company: ${companyId}`);

    // Create branch configurations
    const branchConfigDocs = branchConfigs.map(config => {
      const { branchId, ...configData } = config;
      
      return {
        inventoryItem: inventoryItem._id,
        branch: branchId,
        currentStock: configData.currentStock !== undefined ? configData.currentStock : 0,
        minimumStock: configData.minimumStock !== undefined ? configData.minimumStock : 0,
        maximumStock: configData.maximumStock,
        reorderPoint: configData.reorderPoint,
        costPrice: configData.costPrice,
        lastPurchasePrice: configData.lastPurchasePrice,
        lastPurchaseDate: configData.lastPurchaseDate,
        supplier: configData.supplier,
        storageLocation: configData.storageLocation,
        batchNumber: configData.batchNumber,
        expiryDate: configData.expiryDate,
        branchSKU: configData.branchSKU,
        branchBarcode: configData.branchBarcode,
        isActive: true,
        isAvailable: configData.isAvailable !== undefined ? configData.isAvailable : true,
        notes: configData.notes
      };
    });

    let createdBranchConfigs;
    if (session) {
      createdBranchConfigs = await InventoryItemBranch.create(branchConfigDocs, { session });
    } else {
      createdBranchConfigs = await InventoryItemBranch.create(branchConfigDocs);
    }

    logger.info(`Created ${createdBranchConfigs.length} branch configs for inventory item: ${inventoryItem._id}`);

    // Commit transaction if using transactions
    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    // Populate and return
    const populatedItem = await InventoryItem.findById(inventoryItem._id)
      .populate('category', 'name description color')
      .populate('subcategory', 'name description color')
      .lean();

    const populatedBranchConfigs = await InventoryItemBranch.find({
      _id: { $in: createdBranchConfigs.map(c => c._id) }
    })
      .populate('branch', 'name code')
      .populate('supplier', 'name contactPerson phone')
      .lean();

    return {
      inventoryItem: populatedItem,
      branchConfigs: populatedBranchConfigs,
      autoAssignments: assignmentResult // Return auto-assignment info
    };
  } catch (error) {
    // Rollback transaction if using transactions
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    
    logger.error('Error creating inventory item with branches:', error);
    throw error;
  }
};

/**
 * Get inventory items with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admins)
 * @returns {Promise<Object>} Paginated inventory items
 */
export const getInventoryItems = async (companyId, filters = {}, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);
    const Category = getCategoryModel(companyDB); // Register Category model
    const Branch = getBranchModel(companyDB); // Register Branch model

    const {
      page = 1,
      limit = 10,
      search = '',
      type = '',
      category = '',
      lowStock = false,
      branchId = ''
    } = filters;

    // Build query
    const query = {
      isActive: true
    };

    // Branch filtering - same pattern as supplier service
    if (branchId && branchId !== 'all') {
      // Filter by specific branch
      query.branchIds = branchId;
    } else if (userBranchIds && userBranchIds.length > 0) {
      // For company_admin, only show items assigned to their branches
      query.branchIds = { $in: userBranchIds };
    }
    // If neither condition is met (super admin with no specific branch), return all items

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ];
    }

    // Type filter
    if (type) {
      query.type = type;
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Low stock filter - Note: This is now handled at branch level
    // This filter is deprecated and will be removed
    if (lowStock === true || lowStock === 'true') {
      // Skip this filter as stock is now per-branch
      logger.warn('Low stock filter on InventoryItem is deprecated. Use branch-specific queries instead.');
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query with population of category and subcategory
    const [items, total] = await Promise.all([
      InventoryItem.find(query)
        .populate('category', 'name type parent')
        .populate('subcategory', 'name type parent')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      InventoryItem.countDocuments(query)
    ]);

    return {
      items,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting inventory items:', error);
    throw error;
  }
};

/**
 * Get inventory item by ID with branch configurations
 * @param {string} itemId - Inventory item ID
 * @param {string} companyId - Company ID
 * @param {Array|null} userBranchIds - User's accessible branches (null for super admin)
 * @returns {Promise<Object>} Inventory item with branch configurations
 */
export const getInventoryItemById = async (itemId, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);
    const { getInventoryItemBranchModel } = await import('../models/company/InventoryItemBranch.js');
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);
    const Supplier = getSupplierModel(companyDB); // Register Supplier model

    const item = await InventoryItem.findById(itemId)
      .populate('category', 'name type parent')
      .populate('subcategory', 'name type parent')
      .lean();

    if (!item) {
      throw new Error('Inventory item not found');
    }

    // Fetch ALL branch configurations (don't filter by userBranchIds)
    // Users can see all branches but only edit their own
    const branchConfigs = await InventoryItemBranch.find({
      inventoryItem: itemId,
      isActive: true
    })
      .populate('branch', 'name code address')
      .populate('supplier', 'name contactPerson phone')
      .lean();

    // Return item with branch configurations
    return {
      ...item,
      branches: branchConfigs
    };
  } catch (error) {
    logger.error('Error getting inventory item by ID:', error);
    throw error;
  }
};

/**
 * Update inventory item
 * @param {string} itemId - Inventory item ID
 * @param {Object} updateData - Update data
 * @param {string} companyId - Company ID
 * @param {Array<string>} userBranchIds - User's accessible branch IDs
 * @param {string} userRole - User's role (company_admin, company_super_admin_primary, company_super_admin_secondary)
 * @returns {Promise<Object>} Updated inventory item
 */
export const updateInventoryItem = async (itemId, updateData, companyId, userBranchIds, userRole) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);
    const Category = getCategoryModel(companyDB);
    const Branch = getBranchModel(companyDB);

    // Get existing item
    const existingItem = await InventoryItem.findById(itemId);
    if (!existingItem) {
      throw new Error('Inventory item not found');
    }

    // Validate user has access to at least one of the item's current branches
    if (userRole === 'company_admin') {
      const hasAccess = existingItem.branchIds.some(branchId => 
        userBranchIds.includes(branchId.toString())
      );
      
      if (!hasAccess) {
        throw new Error('You do not have access to this inventory item');
      }
    }

    // If branchIds being updated, validate new branch access
    if (updateData.branchIds) {
      // Validate branchIds is an array with at least one element
      if (!Array.isArray(updateData.branchIds) || updateData.branchIds.length === 0) {
        throw new Error('At least one branch must be selected');
      }

      // For company admins, handle branch updates more flexibly
      if (userRole === 'company_admin') {
        // Get existing branches the user doesn't have access to
        const existingInaccessibleBranches = existingItem.branchIds
          .map(id => id.toString())
          .filter(branchId => !userBranchIds.includes(branchId));
        
        // Get new branches the user wants to add/keep
        const newAccessibleBranches = updateData.branchIds.filter(
          branchId => userBranchIds.includes(branchId.toString())
        );
        
        // Check if user is trying to add branches they don't have access to
        const unauthorizedNewBranches = updateData.branchIds.filter(
          branchId => !userBranchIds.includes(branchId.toString()) && 
                     !existingInaccessibleBranches.includes(branchId.toString())
        );
        
        if (unauthorizedNewBranches.length > 0) {
          throw new Error('You do not have access to one or more selected branches');
        }
        
        // Merge: keep inaccessible branches + user's selected accessible branches
        // This allows branch managers to edit items without affecting branches they don't manage
        updateData.branchIds = [...existingInaccessibleBranches, ...newAccessibleBranches];
        
        // Ensure at least one branch remains
        if (updateData.branchIds.length === 0) {
          throw new Error('At least one branch must be selected');
        }
      }

      // Validate that all branch IDs exist
      const branches = await Branch.find({ 
        _id: { $in: updateData.branchIds },
        isActive: true 
      });
      
      if (branches.length !== updateData.branchIds.length) {
        throw new Error('Invalid branch ID detected');
      }
    }

    // If category being updated, validate category exists
    if (updateData.category) {
      const category = await Category.findById(updateData.category);
      if (!category) {
        throw new Error('Selected category does not exist');
      }
    }

    // If subcategory being updated, validate it belongs to category
    if (updateData.subcategory) {
      const subcategory = await Category.findById(updateData.subcategory);
      if (!subcategory) {
        throw new Error('Selected subcategory does not exist');
      }
      
      // Determine which category to validate against
      const categoryToValidate = updateData.category || existingItem.category;
      
      // Verify subcategory belongs to the selected category
      if (!subcategory.parent || subcategory.parent.toString() !== categoryToValidate.toString()) {
        throw new Error('Subcategory does not belong to the selected category');
      }
    }

    // Validate negative values
    const numericFields = ['currentStock', 'minimumStock', 'maximumStock', 'reorderPoint', 'costPrice'];
    for (const field of numericFields) {
      if (updateData[field] !== undefined && updateData[field] < 0) {
        throw new Error(`${field} cannot be negative`);
      }
    }

    // Validate stock ranges and logical relationships
    const newMinStock = updateData.minimumStock !== undefined ? updateData.minimumStock : existingItem.minimumStock;
    const newMaxStock = updateData.maximumStock !== undefined ? updateData.maximumStock : existingItem.maximumStock;
    const newReorderPoint = updateData.reorderPoint !== undefined ? updateData.reorderPoint : existingItem.reorderPoint;
    const newCurrentStock = updateData.currentStock !== undefined ? updateData.currentStock : existingItem.currentStock;
    
    // Maximum stock must be greater than minimum stock
    if (newMaxStock !== undefined && newMaxStock > 0 && newMaxStock < newMinStock) {
      throw new Error('Maximum stock must be greater than or equal to minimum stock');
    }

    // Reorder point should be between minimum and maximum stock
    if (newReorderPoint !== undefined && newReorderPoint > 0) {
      if (newReorderPoint < newMinStock) {
        throw new Error('Reorder point should be greater than or equal to minimum stock');
      }
      if (newMaxStock !== undefined && newMaxStock > 0 && newReorderPoint > newMaxStock) {
        throw new Error('Reorder point should be less than or equal to maximum stock');
      }
    }

    // Current stock validation (if being updated)
    if (updateData.currentStock !== undefined && newMaxStock !== undefined && newMaxStock > 0 && newCurrentStock > newMaxStock) {
      throw new Error('Current stock cannot exceed maximum stock');
    }

    // Validate expiry date is not in the past
    if (updateData.expiryDate) {
      const expiryDate = new Date(updateData.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (expiryDate < today) {
        throw new Error('Expiry date cannot be in the past');
      }
    }

    // Check unique SKU/barcode if being updated
    if (updateData.sku && updateData.sku !== existingItem.sku) {
      const existingSku = await InventoryItem.findOne({ 
        sku: updateData.sku, 
        isActive: true,
        _id: { $ne: itemId }
      });
      if (existingSku) {
        throw new Error('SKU already exists');
      }
    }

    if (updateData.barcode && updateData.barcode !== existingItem.barcode) {
      const existingBarcode = await InventoryItem.findOne({ 
        barcode: updateData.barcode, 
        isActive: true,
        _id: { $ne: itemId }
      });
      if (existingBarcode) {
        throw new Error('Barcode already exists');
      }
    }

    // Update item
    Object.assign(existingItem, updateData);
    await existingItem.save();

    logger.info(`Inventory item updated: ${itemId} for company: ${companyId}`);

    return existingItem;
  } catch (error) {
    logger.error('Error updating inventory item:', error);
    throw error;
  }
};

/**
 * Delete inventory item (soft delete)
 * @param {string} itemId - Inventory item ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Deleted inventory item
 */
export const deleteInventoryItem = async (itemId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);

    const item = await InventoryItem.findByIdAndUpdate(
      itemId,
      { isActive: false },
      { new: true }
    );

    if (!item) {
      throw new Error('Inventory item not found');
    }

    logger.info(`Inventory item soft deleted: ${itemId} for company: ${companyId}`);

    return item;
  } catch (error) {
    logger.error('Error deleting inventory item:', error);
    throw error;
  }
};

/**
 * Check low stock items
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID (can be "all" for super admins)
 * @param {Array<string>} userBranchIds - User's accessible branch IDs
 * @param {string} userRole - User's role
 * @returns {Promise<Array>} Low stock items
 */
export const checkLowStock = async (companyId, branchId, userBranchIds = [], userRole = '') => {
  try {
    const companyDB = getCompanyDB(companyId);
    const { getInventoryItemBranchModel } = await import('../models/company/InventoryItemBranch.js');
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);
    
    // Register all models needed for populate
    const InventoryItem = getInventoryItemModel(companyDB);
    const Branch = getBranchModel(companyDB);
    const Category = getCategoryModel(companyDB);
    const Supplier = getSupplierModel(companyDB);

    const query = {
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    };

    // Branch filter based on user role
    if (userRole === 'company_admin') {
      // Company admins see items from their assigned branches
      query.branch = { $in: userBranchIds };
    } else if (branchId && branchId !== 'all') {
      // Super admins can filter by specific branch
      query.branch = branchId;
    }
    // If branchId is "all" and user is super admin, no branch filter (see all)

    const branchItems = await InventoryItemBranch.find(query)
      .populate({
        path: 'inventoryItem',
        select: 'name type unit sku barcode category subcategory',
        populate: [
          { path: 'category', select: 'name type' },
          { path: 'subcategory', select: 'name type' }
        ]
      })
      .populate('branch', 'name code')
      .populate('supplier', 'name contactPerson phone')
      .sort({ currentStock: 1 })
      .lean();

    return branchItems;
  } catch (error) {
    logger.error('Error checking low stock:', error);
    throw error;
  }
};

/**
 * Check expiring items
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID (can be "all" for super admins)
 * @param {number} daysAhead - Days ahead to check (default: 7)
 * @param {Array<string>} userBranchIds - User's accessible branch IDs
 * @param {string} userRole - User's role
 * @returns {Promise<Array>} Expiring items
 */
export const checkExpiringItems = async (companyId, branchId, daysAhead = 7, userBranchIds = [], userRole = '') => {
  try {
    const companyDB = getCompanyDB(companyId);
    const { getInventoryItemBranchModel } = await import('../models/company/InventoryItemBranch.js');
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);
    
    // Register all models needed for populate
    const InventoryItem = getInventoryItemModel(companyDB);
    const Branch = getBranchModel(companyDB);
    const Category = getCategoryModel(companyDB);
    const Supplier = getSupplierModel(companyDB);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const query = {
      isActive: true,
      expiryDate: {
        $gte: today,
        $lte: futureDate
      }
    };

    // Branch filter based on user role
    if (userRole === 'company_admin') {
      // Company admins see items from their assigned branches
      query.branch = { $in: userBranchIds };
    } else if (branchId && branchId !== 'all') {
      // Super admins can filter by specific branch
      query.branch = branchId;
    }
    // If branchId is "all" and user is super admin, no branch filter (see all)

    const branchItems = await InventoryItemBranch.find(query)
      .populate({
        path: 'inventoryItem',
        select: 'name type unit sku barcode category subcategory',
        populate: [
          { path: 'category', select: 'name type' },
          { path: 'subcategory', select: 'name type parent' }
        ]
      })
      .populate('branch', 'name code')
      .populate('supplier', 'name contactPerson phone')
      .sort({ expiryDate: 1 })
      .lean();

    return branchItems;
  } catch (error) {
    logger.error('Error checking expiring items:', error);
    throw error;
  }
};

/**
 * Get distinct inventory categories
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @param {Array<string>} userBranchIds - User's accessible branch IDs
 * @param {string} userRole - User's role
 * @returns {Promise<Array>} List of categories
 */
export const getInventoryCategories = async (companyId, branchId, userBranchIds = [], userRole = '') => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);

    const query = {
      isActive: true
    };

    // Branch filter based on user role
    if (userRole === 'company_admin') {
      // Company admins see items from their assigned branches
      query.branchIds = { $in: userBranchIds };
    } else if (branchId && branchId !== 'all') {
      // Super admins can filter by specific branch
      query.branchIds = { $in: [branchId] };
    }
    // If branchId is "all" and user is super admin, no branch filter (see all)

    const categories = await InventoryItem.distinct('category', query);

    return categories.sort();
  } catch (error) {
    logger.error('Error getting inventory categories:', error);
    throw error;
  }
};

/**
 * Helper function to check if an item is expiring soon
 * @param {Date} expiryDate - Expiry date
 * @returns {boolean} True if expiring within 7 days
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
 * Generate unique GRN number
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @returns {Promise<string>} Generated GRN number
 */
export const generateGRNNumber = async (companyId, branchId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `GRN-${year}${month}`;

    // Find the last GRN number for this month and branch
    const lastGRN = await GRN.findOne({
      branch: branchId,
      grnNumber: { $regex: `^${prefix}` }
    })
      .sort({ grnNumber: -1 })
      .lean();

    let sequence = 1;
    if (lastGRN) {
      const lastSequence = parseInt(lastGRN.grnNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    const grnNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;

    return grnNumber;
  } catch (error) {
    logger.error('Error generating GRN number:', error);
    throw error;
  }
};

/**
 * Create a new GRN and update inventory
 * @param {Object} grnData - GRN data
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Created GRN
 */
export const createGRN = async (grnData, companyId, branchId, userId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB);

    // Validate line items
    if (!grnData.items || grnData.items.length === 0) {
      throw new Error('GRN must have at least one line item');
    }

    // Validate each line item
    for (const item of grnData.items) {
      if (!item.inventoryItem || !item.quantity || !item.unitPrice) {
        throw new Error('Each line item must have inventoryItem, quantity, and unitPrice');
      }
      if (item.quantity <= 0 || item.unitPrice < 0) {
        throw new Error('Quantity must be positive and unit price cannot be negative');
      }
    }

    // Generate GRN number
    const grnNumber = await generateGRNNumber(companyId, branchId);

    // Calculate line item totals
    const items = grnData.items.map(item => ({
      ...item,
      totalPrice: item.quantity * item.unitPrice
    }));

    // Create GRN (totalAmount will be calculated by pre-save hook)
    const grn = new GRN({
      grnNumber,
      branch: branchId,
      supplier: grnData.supplierId || grnData.supplier,
      purchaseOrder: grnData.purchaseOrder,
      items,
      receivedBy: userId,
      receivedDate: grnData.receivedDate || new Date(),
      status: grnData.status || 'received',
      notes: grnData.notes,
      invoiceNumber: grnData.invoiceNumber,
      invoiceDate: grnData.invoiceDate
    });

    await grn.save();

    // Update inventory for each line item
    for (const item of items) {
      const inventoryItem = await InventoryItem.findById(item.inventoryItem);
      
      if (!inventoryItem) {
        logger.warn(`Inventory item not found: ${item.inventoryItem}`);
        continue;
      }

      // Increase stock
      inventoryItem.currentStock += item.quantity;

      // Update cost price and purchase metadata
      inventoryItem.costPrice = item.unitPrice;
      inventoryItem.lastPurchaseDate = grn.receivedDate;
      inventoryItem.lastPurchasePrice = item.unitPrice;

      // Update batch number if provided
      if (item.batchNumber) {
        inventoryItem.batchNumber = item.batchNumber;
      }

      // Update expiry date if provided
      if (item.expiryDate) {
        inventoryItem.expiryDate = item.expiryDate;
      }

      await inventoryItem.save();
    }

    logger.info(`GRN created: ${grn._id} (${grnNumber}) for company: ${companyId}`);

    return grn;
  } catch (error) {
    logger.error('Error creating GRN:', error);
    throw error;
  }
};

/**
 * Get GRNs with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated GRNs
 */
export const getGRNs = async (companyId, branchId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);
    const Supplier = getSupplierModel(companyDB); // Register Supplier model

    const {
      page = 1,
      limit = 10,
      supplier = '',
      status = '',
      startDate = '',
      endDate = ''
    } = filters;

    // Build query
    const query = {};

    // Branch filter - only add if not "all"
    if (branchId && branchId !== 'all') {
      query.branch = branchId;
    }

    // Supplier filter
    if (supplier) {
      query.supplier = supplier;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      query.receivedDate = {};
      if (startDate) {
        query.receivedDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.receivedDate.$lte = end;
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [grns, total] = await Promise.all([
      GRN.find(query)
        .populate('supplier', 'name contactPerson phone email')
        .populate('receivedBy', 'name email')
        .sort({ receivedDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      GRN.countDocuments(query)
    ]);

    return {
      grns,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting GRNs:', error);
    throw error;
  }
};

/**
 * Get GRN by ID
 * @param {string} grnId - GRN ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} GRN
 */
export const getGRNById = async (grnId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);
    const Supplier = getSupplierModel(companyDB); // Register Supplier model

    const grn = await GRN.findById(grnId)
      .populate('supplier', 'name contactPerson phone email address gstNumber')
      .populate('receivedBy', 'name email')
      .populate('items.inventoryItem', 'name type unit sku')
      .lean();

    if (!grn) {
      throw new Error('GRN not found');
    }

    return grn;
  } catch (error) {
    logger.error('Error getting GRN by ID:', error);
    throw error;
  }
};

/**
 * Generate unique adjustment number
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @returns {Promise<string>} Generated adjustment number
 */
export const generateAdjustmentNumber = async (companyId, branchId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `ADJ-${year}${month}`;

    // Find the last adjustment number for this month and branch
    const lastAdjustment = await StockAdjustment.findOne({
      branch: branchId,
      adjustmentNumber: { $regex: `^${prefix}` }
    })
      .sort({ adjustmentNumber: -1 })
      .lean();

    let sequence = 1;
    if (lastAdjustment) {
      const lastSequence = parseInt(lastAdjustment.adjustmentNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    const adjustmentNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;

    return adjustmentNumber;
  } catch (error) {
    logger.error('Error generating adjustment number:', error);
    throw error;
  }
};

/**
 * Create a stock adjustment and update inventory
 * @param {Object} adjustmentData - Stock adjustment data
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Created stock adjustment
 */
export const createStockAdjustment = async (adjustmentData, companyId, branchId, userId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB);

    // Validate required fields
    if (!adjustmentData.inventoryItemId || !adjustmentData.adjustmentType || !adjustmentData.quantity || !adjustmentData.reason) {
      throw new Error('Missing required fields: inventoryItemId, adjustmentType, quantity, and reason are required');
    }

    // Validate adjustment type
    const validTypes = ['increase', 'decrease', 'correction'];
    if (!validTypes.includes(adjustmentData.adjustmentType)) {
      throw new Error('Invalid adjustment type. Must be: increase, decrease, or correction');
    }

    // Validate reason
    const validReasons = ['damaged', 'expired', 'theft', 'wastage', 'count_correction', 'other'];
    if (!validReasons.includes(adjustmentData.reason)) {
      throw new Error('Invalid reason');
    }

    // Get inventory item
    const inventoryItem = await InventoryItem.findById(adjustmentData.inventoryItemId);
    if (!inventoryItem) {
      throw new Error('Inventory item not found');
    }

    // Verify item belongs to the branch
    if (inventoryItem.branch.toString() !== branchId) {
      throw new Error('Inventory item does not belong to this branch');
    }

    const previousStock = inventoryItem.currentStock;
    let newStock;

    // Calculate new stock based on adjustment type
    switch (adjustmentData.adjustmentType) {
      case 'increase':
        newStock = previousStock + adjustmentData.quantity;
        break;
      case 'decrease':
        newStock = previousStock - adjustmentData.quantity;
        if (newStock < 0) {
          throw new Error('Insufficient stock. Adjustment would result in negative stock');
        }
        break;
      case 'correction':
        newStock = adjustmentData.quantity;
        break;
      default:
        throw new Error('Invalid adjustment type');
    }

    // Generate adjustment number
    const adjustmentNumber = await generateAdjustmentNumber(companyId, branchId);

    // Create stock adjustment
    const adjustment = new StockAdjustment({
      adjustmentNumber,
      branch: branchId,
      inventoryItem: adjustmentData.inventoryItemId,
      adjustmentType: adjustmentData.adjustmentType,
      quantity: adjustmentData.quantity,
      previousStock,
      newStock,
      reason: adjustmentData.reason,
      notes: adjustmentData.notes,
      adjustedBy: userId,
      adjustmentDate: adjustmentData.adjustmentDate || new Date()
    });

    await adjustment.save();

    // Update inventory item stock
    inventoryItem.currentStock = newStock;
    await inventoryItem.save();

    logger.info(`Stock adjustment created: ${adjustment._id} (${adjustmentNumber}) for company: ${companyId}`);

    return adjustment;
  } catch (error) {
    logger.error('Error creating stock adjustment:', error);
    throw error;
  }
};

/**
 * Get stock adjustments with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated stock adjustments
 */
export const getStockAdjustments = async (companyId, branchId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);

    const {
      page = 1,
      limit = 10,
      startDate = '',
      endDate = '',
      type = '',
      reason = ''
    } = filters;

    // Build query
    const query = {};

    // Branch filter - only add if not "all"
    if (branchId && branchId !== 'all') {
      query.branch = branchId;
    }

    // Date range filter
    if (startDate || endDate) {
      query.adjustmentDate = {};
      if (startDate) {
        query.adjustmentDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.adjustmentDate.$lte = end;
      }
    }

    // Type filter
    if (type) {
      query.adjustmentType = type;
    }

    // Reason filter
    if (reason) {
      query.reason = reason;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [adjustments, total] = await Promise.all([
      StockAdjustment.find(query)
        .populate('inventoryItem', 'name type unit sku')
        .populate('adjustedBy', 'name email')
        .sort({ adjustmentDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockAdjustment.countDocuments(query)
    ]);

    return {
      adjustments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting stock adjustments:', error);
    throw error;
  }
};

/**
 * Get stock adjustment by ID
 * @param {string} adjustmentId - Stock adjustment ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Stock adjustment
 */
export const getStockAdjustmentById = async (adjustmentId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);

    const adjustment = await StockAdjustment.findById(adjustmentId)
      .populate('inventoryItem', 'name type unit sku currentStock minimumStock')
      .populate('adjustedBy', 'name email')
      .populate('approvedBy', 'name email')
      .lean();

    if (!adjustment) {
      throw new Error('Stock adjustment not found');
    }

    return adjustment;
  } catch (error) {
    logger.error('Error getting stock adjustment by ID:', error);
    throw error;
  }
};

/**
 * Generate unique transfer number
 * @param {string} companyId - Company ID
 * @returns {Promise<string>} Generated transfer number
 */
export const generateTransferNumber = async (companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `TRF-${year}${month}`;

    // Find the last transfer number for this month
    const lastTransfer = await StockTransfer.findOne({
      transferNumber: { $regex: `^${prefix}` }
    })
      .sort({ transferNumber: -1 })
      .lean();

    let sequence = 1;
    if (lastTransfer) {
      const lastSequence = parseInt(lastTransfer.transferNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    const transferNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;

    return transferNumber;
  } catch (error) {
    logger.error('Error generating transfer number:', error);
    throw error;
  }
};

/**
 * Create a stock transfer request
 * @param {Object} transferData - Stock transfer data
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Created stock transfer
 */
export const createStockTransfer = async (transferData, companyId, userId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    // Validate required fields
    if (!transferData.fromBranch || !transferData.toBranch || !transferData.items || transferData.items.length === 0) {
      throw new Error('Missing required fields: fromBranch, toBranch, and items are required');
    }

    // Validate branches are different
    if (transferData.fromBranch === transferData.toBranch) {
      throw new Error('From branch and to branch must be different');
    }

    // Validate each line item
    for (const item of transferData.items) {
      if (!item.inventoryItem || !item.quantity || !item.unit) {
        throw new Error('Each line item must have inventoryItem, quantity, and unit');
      }
      if (item.quantity <= 0) {
        throw new Error('Quantity must be positive');
      }
    }

    // Generate transfer number
    const transferNumber = await generateTransferNumber(companyId);

    // Create stock transfer
    const transfer = new StockTransfer({
      transferNumber,
      fromBranch: transferData.fromBranch,
      toBranch: transferData.toBranch,
      items: transferData.items,
      requestedBy: userId,
      requestDate: transferData.requestDate || new Date(),
      status: 'pending',
      notes: transferData.notes
    });

    await transfer.save();

    logger.info(`Stock transfer created: ${transfer._id} (${transferNumber}) for company: ${companyId}`);

    return transfer;
  } catch (error) {
    logger.error('Error creating stock transfer:', error);
    throw error;
  }
};

/**
 * Approve a stock transfer and execute the transfer
 * @param {string} transferId - Stock transfer ID
 * @param {string} companyId - Company ID
 * @param {string} approverId - Approver user ID
 * @returns {Promise<Object>} Approved stock transfer
 */
export const approveStockTransfer = async (transferId, companyId, approverId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB);

    // Get transfer
    const transfer = await StockTransfer.findById(transferId);
    if (!transfer) {
      throw new Error('Stock transfer not found');
    }

    // Verify status is pending
    if (transfer.status !== 'pending') {
      throw new Error(`Cannot approve transfer with status: ${transfer.status}`);
    }

    // Validate sufficient stock in from branch for all items
    for (const item of transfer.items) {
      const inventoryItem = await InventoryItem.findOne({
        _id: item.inventoryItem,
        branch: transfer.fromBranch
      });

      if (!inventoryItem) {
        throw new Error(`Inventory item not found in from branch: ${item.inventoryItem}`);
      }

      if (inventoryItem.currentStock < item.quantity) {
        throw new Error(`Insufficient stock for item: ${inventoryItem.name}. Available: ${inventoryItem.currentStock}, Required: ${item.quantity}`);
      }
    }

    // Execute transfer: decrease from branch, increase to branch
    for (const item of transfer.items) {
      // Decrease stock in from branch
      const fromItem = await InventoryItem.findOne({
        _id: item.inventoryItem,
        branch: transfer.fromBranch
      });

      if (fromItem) {
        fromItem.currentStock -= item.quantity;
        await fromItem.save();
      }

      // Increase stock in to branch (or create if doesn't exist)
      let toItem = await InventoryItem.findOne({
        _id: item.inventoryItem,
        branch: transfer.toBranch
      });

      if (toItem) {
        toItem.currentStock += item.quantity;
        await toItem.save();
      } else {
        // If item doesn't exist in to branch, create it
        const sourceItem = await InventoryItem.findById(item.inventoryItem);
        if (sourceItem) {
          const newItem = new InventoryItem({
            name: sourceItem.name,
            type: sourceItem.type,
            category: sourceItem.category,
            unit: sourceItem.unit,
            currentStock: item.quantity,
            minimumStock: sourceItem.minimumStock,
            maximumStock: sourceItem.maximumStock,
            reorderPoint: sourceItem.reorderPoint,
            costPrice: sourceItem.costPrice,
            branch: transfer.toBranch,
            supplier: sourceItem.supplier,
            sku: null, // Don't copy unique fields
            barcode: null,
            isActive: true
          });
          await newItem.save();
        }
      }
    }

    // Update transfer status
    transfer.status = 'completed';
    transfer.approvedBy = approverId;
    transfer.approvedDate = new Date();
    transfer.completedDate = new Date();
    await transfer.save();

    logger.info(`Stock transfer approved: ${transferId} for company: ${companyId}`);

    return transfer;
  } catch (error) {
    logger.error('Error approving stock transfer:', error);
    throw error;
  }
};

/**
 * Reject a stock transfer
 * @param {string} transferId - Stock transfer ID
 * @param {string} companyId - Company ID
 * @param {string} rejectorId - Rejector user ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} Rejected stock transfer
 */
export const rejectStockTransfer = async (transferId, companyId, rejectorId, reason) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    // Get transfer
    const transfer = await StockTransfer.findById(transferId);
    if (!transfer) {
      throw new Error('Stock transfer not found');
    }

    // Verify status is pending
    if (transfer.status !== 'pending') {
      throw new Error(`Cannot reject transfer with status: ${transfer.status}`);
    }

    // Validate rejection reason
    if (!reason || reason.trim() === '') {
      throw new Error('Rejection reason is required');
    }

    // Update transfer status
    transfer.status = 'rejected';
    transfer.rejectedBy = rejectorId;
    transfer.rejectedDate = new Date();
    transfer.rejectionReason = reason;
    await transfer.save();

    logger.info(`Stock transfer rejected: ${transferId} for company: ${companyId}`);

    return transfer;
  } catch (error) {
    logger.error('Error rejecting stock transfer:', error);
    throw error;
  }
};

/**
 * Get stock transfers with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID (optional - returns transfers where branch is from or to)
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated stock transfers
 */
export const getStockTransfers = async (companyId, branchId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    const {
      page = 1,
      limit = 10,
      status = ''
    } = filters;

    // Build query
    const query = {};

    // Branch filter - return transfers where branch is from or to
    // Skip if branchId is "all"
    if (branchId && branchId !== 'all') {
      query.$or = [
        { fromBranch: branchId },
        { toBranch: branchId }
      ];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [transfers, total] = await Promise.all([
      StockTransfer.find(query)
        .populate('fromBranch', 'name address')
        .populate('toBranch', 'name address')
        .populate('requestedBy', 'name email')
        .populate('approvedBy', 'name email')
        .populate('rejectedBy', 'name email')
        .populate('items.inventoryItem', 'name type unit sku')
        .sort({ requestDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockTransfer.countDocuments(query)
    ]);

    return {
      transfers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting stock transfers:', error);
    throw error;
  }
};

/**
 * Get stock transfer by ID
 * @param {string} transferId - Stock transfer ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Stock transfer
 */
export const getStockTransferById = async (transferId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    const transfer = await StockTransfer.findById(transferId)
      .populate('fromBranch', 'name address city state')
      .populate('toBranch', 'name address city state')
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .populate('items.inventoryItem', 'name type unit sku currentStock')
      .lean();

    if (!transfer) {
      throw new Error('Stock transfer not found');
    }

    return transfer;
  } catch (error) {
    logger.error('Error getting stock transfer by ID:', error);
    throw error;
  }
};
