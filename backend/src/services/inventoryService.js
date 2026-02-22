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
import { getLocationModel } from '../models/company/Location.js';
import { getSupplierModel } from '../models/company/Supplier.js';
import { logger } from '../utils/logger.js';
import CapacityValidator from './capacityValidator.js';

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
    const Branch = getLocationModel(companyDB);

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
 * @param {Object} inventoryItemData - Inventory item data (global properties)
 * @param {Array} branchConfigs - Array of branch configurations
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID for audit
 * @param {Array|null} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Created inventory item with branch configs and auto-assignment results
 */
// Alias for backward compatibility - delegates to createInventoryItemWithLocations
export const createInventoryItemWithBranches = async (inventoryItemData, branchConfigs, companyId, userId, userBranchIds = null) => {
  // Convert branchConfigs to locationConfigs
  const locationConfigs = branchConfigs.map(config => ({
    ...config,
    locationId: config.branchId || config.locationId
  }));
  
  return createInventoryItemWithLocations(inventoryItemData, locationConfigs, companyId, userId, userBranchIds);
};

/**
 * Create inventory item with location configurations
 * @param {Object} inventoryItemData - Inventory item data (global properties)
 * @param {Array} locationConfigs - Array of location configurations
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID for audit
 * @param {Array|null} userLocationIds - User's accessible location IDs (null for super admin)
 * @returns {Promise<Object>} Created inventory item with location configs and auto-assignment results
 */
export const createInventoryItemWithLocations = async (inventoryItemData, locationConfigs, companyId, userId, userLocationIds = null) => {
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
    const { getInventoryItemLocationModel } = await import('../models/company/InventoryItemLocation.js');
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const Category = getCategoryModel(companyDB);
    const Location = getLocationModel(companyDB);
    const Supplier = getSupplierModel(companyDB);

    // Validate required fields
    const requiredFields = ['name', 'type', 'unit', 'category'];
    const missingFields = requiredFields.filter(field => !inventoryItemData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate location configs
    if (!locationConfigs || !Array.isArray(locationConfigs) || locationConfigs.length === 0) {
      throw new Error('At least one location configuration is required');
    }

    // Extract location IDs from configs
    const locationIds = locationConfigs.map(config => config.locationId);

    // Validate location access
    if (userLocationIds !== null) {
      const invalidLocations = locationIds.filter(
        locationId => !userLocationIds.includes(locationId.toString())
      );
      
      if (invalidLocations.length > 0) {
        throw new Error(`No access to location: ${invalidLocations[0]}`);
      }
    }

    // Validate that all location IDs exist
    const locationQuery = Location.find({ 
      _id: { $in: locationIds },
      isActive: true 
    });
    if (session) locationQuery.session(session);
    const locations = await locationQuery;
    
    if (locations.length !== locationIds.length) {
      throw new Error('Invalid location ID detected');
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

    // Auto-assign category and subcategory to locations
    const categoryId = inventoryItemData.category;
    const subcategoryId = inventoryItemData.subcategory;

    logger.info(`Auto-assigning inventory category ${categoryId} to locations: ${locationIds.join(', ')}`);

    const CategoryBranchValidationService = (await import('./categoryBranchValidationService.js')).default;
    const validationService = new CategoryBranchValidationService(companyDB);
    
    const categoryIdsToAssign = [categoryId];
    const subcategoryIdsToAssign = subcategoryId ? [subcategoryId] : [];
    
    const assignmentResult = await validationService.assignCategoriesToBranches(
      locationIds,
      categoryIdsToAssign,
      subcategoryIdsToAssign,
      userId,
      'inventory_item_assignment',
      session
    );

    logger.info(`Category assignment result:`, assignmentResult);

    // Auto-assign suppliers to locations (per location configuration)
    const supplierAssignments = [];
    for (const config of locationConfigs) {
      if (config.supplier) {
        // Validate supplier exists
        const supplierQuery = Supplier.findById(config.supplier);
        if (session) supplierQuery.session(session);
        const supplier = await supplierQuery;
        
        if (!supplier) {
          logger.warn(`Supplier ${config.supplier} not found, skipping auto-assignment for location ${config.locationId}`);
          continue;
        }

        // Check if supplier is already assigned to this location
        const supplierLocationIds = supplier.branchIds || [];
        if (!supplierLocationIds.includes(config.locationId.toString())) {
          // Add location to supplier's branchIds (field name kept for backward compatibility)
          supplier.branchIds = [...supplierLocationIds, config.locationId];
          if (session) {
            await supplier.save({ session });
          } else {
            await supplier.save();
          }
          
          supplierAssignments.push({
            supplierId: config.supplier,
            supplierName: supplier.name,
            locationId: config.locationId
          });
          
          logger.info(`Auto-assigned supplier ${supplier.name} to location ${config.locationId}`);
        }
      }
    }

    // Create inventory item (without location-specific data)
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
          description: inventoryItemData.description,
          branchIds: locationIds, // Store location IDs for backward compatibility
          currentStock: 0, // Will be managed per location
          minimumStock: 0, // Will be managed per location
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
        description: inventoryItemData.description,
        branchIds: locationIds,
        currentStock: 0,
        minimumStock: 0,
        isActive: true
      });
    }

    logger.info(`Inventory item created: ${inventoryItem._id} for company: ${companyId}`);

    // Create location configurations
    const locationConfigDocs = locationConfigs.map(config => {
      const { locationId, ...configData } = config;
      
      return {
        inventoryItem: inventoryItem._id,
        locationId: locationId,
        availableQuantity: configData.availableQuantity !== undefined ? configData.availableQuantity : 0,
        reservedQuantity: 0,
        inTransitQuantity: 0,
        minimumStock: configData.minimumStock !== undefined ? configData.minimumStock : 0,
        maximumStock: configData.maximumStock,
        reorderPoint: configData.reorderPoint,
        costingMethod: configData.costingMethod || 'FIFO',
        standardCost: configData.standardCost || configData.costPrice,
        lastPurchasePrice: configData.lastPurchasePrice,
        lastPurchaseDate: configData.lastPurchaseDate,
        supplier: configData.supplier,
        storageLocation: configData.storageLocation,
        isActive: true,
        version: 0
      };
    });

    let createdLocationConfigs;
    if (session) {
      createdLocationConfigs = await InventoryItemLocation.create(locationConfigDocs, { session });
    } else {
      createdLocationConfigs = await InventoryItemLocation.create(locationConfigDocs);
    }

    logger.info(`Created ${createdLocationConfigs.length} location configs for inventory item: ${inventoryItem._id}`);

    // Commit transaction if using transactions
    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    // Populate and return
    const populatedItem = await InventoryItem.findById(inventoryItem._id)
      .populate('category', 'name description color type parent')
      .populate('subcategory', 'name description color type parent')
      .lean();

    const populatedLocationConfigs = await InventoryItemLocation.find({
      _id: { $in: createdLocationConfigs.map(c => c._id) }
    })
      .populate('locationId', 'name code address')
      .populate('supplier', 'name contactPerson phone email')
      .lean();

    // Add supplier assignments to auto-assignment results
    const autoAssignments = {
      ...assignmentResult,
      assigned: {
        ...assignmentResult.assigned,
        suppliers: supplierAssignments
      }
    };

    return {
      inventoryItem: populatedItem,
      locationConfigs: populatedLocationConfigs,
      branchConfigs: populatedLocationConfigs, // Alias for backward compatibility
      autoAssignments // Return auto-assignment info including suppliers
    };
  } catch (error) {
    // Rollback transaction if using transactions
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    
    logger.error('Error creating inventory item with locations:', error);
    throw error;
  }
};

/**
 * Get inventory items with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options (page, limit, search, type, category, subcategory, locationId)
 * @param {Array|null} userLocationIds - User's accessible location IDs (null for super admins)
 * @returns {Promise<Object>} Paginated inventory items
 */
export const getInventoryItems = async (companyId, filters = {}, userLocationIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);
    const { getInventoryItemLocationModel } = await import('../models/company/InventoryItemLocation.js');
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const Category = getCategoryModel(companyDB);
    const Location = getLocationModel(companyDB);

    const {
      page = 1,
      limit = 10,
      search = '',
      type = '',
      category = '',
      subcategory = '',
      locationId = '',
      branchId = '' // Backward compatibility alias for locationId
    } = filters;

    // Use locationId or branchId (backward compatibility)
    const effectiveLocationId = locationId || branchId;

    // Build base query for InventoryItem
    const itemQuery = {
      // Removed isActive filter - show all items (active and inactive)
    };

    // Search filter - search by name, SKU, or barcode
    if (search) {
      itemQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ];
    }

    // Type filter
    if (type) {
      itemQuery.type = type;
    }

    // Category filter
    if (category) {
      itemQuery.category = category;
    }

    // Subcategory filter
    if (subcategory) {
      itemQuery.subcategory = subcategory;
    }

    // Location filtering logic - query InventoryItemLocation to find relevant items
    let itemIdsFromLocations = null;
    
    if (effectiveLocationId === 'all') {
      // Super admin viewing all items - no location filter needed
      if (userLocationIds !== null) {
        // Company admins cannot use 'all' - filter by their locations
        const locationItems = await InventoryItemLocation.find({
          locationId: { $in: userLocationIds }
        }).distinct('inventoryItem');
        itemIdsFromLocations = locationItems;
      }
      // Super admin with 'all' - no location filter, show everything
    } else if (effectiveLocationId) {
      // Specific location selected - find items assigned to that location
      const locationItems = await InventoryItemLocation.find({
        locationId: effectiveLocationId
      }).distinct('inventoryItem');
      itemIdsFromLocations = locationItems;
    } else if (userLocationIds !== null && userLocationIds.length > 0) {
      // Company admin with no specific location - show items from their locations
      const locationItems = await InventoryItemLocation.find({
        locationId: { $in: userLocationIds}
      }).distinct('inventoryItem');
      itemIdsFromLocations = locationItems;
    }
    // Super admin with no locationId specified - show all items

    // Apply location filter to item query if needed
    if (itemIdsFromLocations !== null) {
      itemQuery._id = { $in: itemIdsFromLocations };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query with population of category and subcategory
    const [items, total] = await Promise.all([
      InventoryItem.find(itemQuery)
        .populate('category', 'name description color type parent')
        .populate('subcategory', 'name description color type parent')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      InventoryItem.countDocuments(itemQuery)
    ]);

    // For each item, fetch location count and location details
    const itemsWithLocations = await Promise.all(
      items.map(async (item) => {
        const locationConfigs = await InventoryItemLocation.find({
          inventoryItem: item._id
        })
          .populate('locationId', 'name code')
          .select('locationId')
          .lean();

        return {
          ...item,
          locations: locationConfigs,
          locationCount: locationConfigs.length,
          // Backward compatibility aliases
          branches: locationConfigs,
          branchCount: locationConfigs.length
        };
      })
    );

    return {
      items: itemsWithLocations,
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
 * Get inventory item by ID with ALL branch configurations
 * @param {string} itemId - Inventory item ID
 * @param {string} companyId - Company ID
 * @param {Array|null} userBranchIds - User's accessible branches (null for super admin) - NOT USED for filtering
 * @returns {Promise<Object>} Inventory item with ALL branch configurations
 */
export const getInventoryItemById = async (itemId, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);
    const { getInventoryItemLocationModel } = await import('../models/company/InventoryItemLocation.js');
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const Supplier = getSupplierModel(companyDB); // Register Supplier model
    const Location = getLocationModel(companyDB); // Register Location model
    const Category = getCategoryModel(companyDB); // Register Category model

    // Fetch inventory item with category and subcategory populated
    const item = await InventoryItem.findById(itemId)
      .populate('category', 'name description color type parent')
      .populate('subcategory', 'name description color type parent')
      .lean();

    if (!item) {
      throw new Error('Inventory item not found');
    }

    // Fetch ALL location configurations (migrated from branch configs)
    // Users can see all locations but only edit their own (handled in frontend/controller)
    const locationConfigs = await InventoryItemLocation.find({
      inventoryItem: itemId
      // Removed isActive filter - show all location configs
    })
      .populate('locationId', 'name code address city state pincode')
      .populate('supplier', 'name contactPerson phone email')
      .lean();

    // Return item with locations array (and branches alias for backward compatibility)
    return {
      ...item,
      locations: locationConfigs,
      branches: locationConfigs // Backward compatibility alias
    };
  } catch (error) {
    logger.error('Error getting inventory item by ID:', error);
    throw error;
  }
};

/**
 * Update inventory item (global properties only)
 * @param {string} itemId - Inventory item ID
 * @param {Object} updateData - Update data (global properties)
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID for audit
 * @param {Array|null} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Updated inventory item with auto-assignment results
 */
export const updateInventoryItem = async (itemId, updateData, companyId, userId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);
    const Category = getCategoryModel(companyDB);
    const { getInventoryItemLocationModel } = await import('../models/company/InventoryItemLocation.js');
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    // Get existing item
    const existingItem = await InventoryItem.findById(itemId);
    if (!existingItem) {
      throw new Error('Inventory item not found');
    }

    // Validate user has access to at least one location where item exists
    if (userBranchIds !== null) {
      // Get locations where this item exists
      const itemLocations = await InventoryItemLocation.find({ 
        inventoryItem: itemId
        // Removed isActive filter - check all locations
      }).select('locationId');
      
      const itemLocationIds = itemLocations.map(il => il.locationId.toString());
      
      const hasAccess = itemLocationIds.some(locationId => 
        userBranchIds.includes(locationId)
      );
      
      if (!hasAccess) {
        throw new Error('You do not have access to this inventory item');
      }
    }

    // Validate name length if being updated
    if (updateData.name && updateData.name.length > 200) {
      throw new Error('Inventory item name cannot exceed 200 characters');
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

    // Initialize auto-assignment results
    let autoAssignments = {
      assigned: {
        categories: [],
        subcategories: []
      },
      alreadyAssigned: {
        categories: [],
        subcategories: []
      }
    };

    // If category is changing, auto-assign new category to all locations where this item exists
    if (updateData.category && updateData.category !== existingItem.category.toString()) {
      logger.info(`Inventory item ${itemId} category changing from ${existingItem.category} to ${updateData.category}`);
      
      // Get all locations where this inventory item is assigned
      const locationAssignments = await InventoryItemLocation.find({
        inventoryItem: itemId
        // Removed isActive filter - check all locations
      }).select('locationId').lean();
      
      logger.info(`Inventory item has ${locationAssignments.length} location assignment(s)`);
      
      if (locationAssignments.length > 0) {
        const locationIds = locationAssignments.map(a => a.locationId.toString());
        logger.info(`Auto-assigning new category ${updateData.category} to locations: ${locationIds.join(', ')}`);
        
        // Auto-assign new category to these locations
        const CategoryBranchValidationService = (await import('./categoryBranchValidationService.js')).default;
        const validationService = new CategoryBranchValidationService(companyDB);
        
        const categoryAssignmentResult = await validationService.assignCategoriesToBranches(
          locationIds,
          [updateData.category],
          [], // No subcategory yet
          userId,
          'inventory_item_category_update',
          null // no session for simple updates
        );
        
        logger.info(`Category assignment result:`, categoryAssignmentResult);
        autoAssignments = categoryAssignmentResult;
      } else {
        logger.info(`⚠️  Inventory item ${itemId} has no location assignments yet. Category will be auto-assigned when locations are added.`);
      }
    }

    // If subcategory is changing, auto-assign new subcategory to all locations where this item exists
    if (updateData.subcategory && updateData.subcategory !== existingItem.subcategory?.toString()) {
      logger.info(`Inventory item ${itemId} subcategory changing from ${existingItem.subcategory} to ${updateData.subcategory}`);
      
      // Get all locations where this inventory item is assigned
      const locationAssignments = await InventoryItemLocation.find({
        inventoryItem: itemId
        // Removed isActive filter - check all locations
      }).select('locationId').lean();
      
      if (locationAssignments.length > 0) {
        const locationIds = locationAssignments.map(a => a.locationId.toString());
        logger.info(`Auto-assigning new subcategory ${updateData.subcategory} to locations: ${locationIds.join(', ')}`);
        
        // Auto-assign new subcategory to these locations
        const CategoryBranchValidationService = (await import('./categoryBranchValidationService.js')).default;
        const validationService = new CategoryBranchValidationService(companyDB);
        
        const subcategoryAssignmentResult = await validationService.assignCategoriesToBranches(
          locationIds,
          [], // Category already assigned
          [updateData.subcategory],
          userId,
          'inventory_item_subcategory_update',
          null // no session for simple updates
        );
        
        logger.info(`Subcategory assignment result:`, subcategoryAssignmentResult);
        
        // Merge subcategory results into autoAssignments
        autoAssignments.assigned.subcategories = subcategoryAssignmentResult.assigned.subcategories || [];
        autoAssignments.alreadyAssigned.subcategories = subcategoryAssignmentResult.alreadyAssigned.subcategories || [];
      }
    }

    // Update global properties (preserve location configurations)
    Object.assign(existingItem, updateData);
    await existingItem.save();

    logger.info(`Inventory item updated: ${itemId} for company: ${companyId}`);

    // Return updated item with auto-assignment results
    return {
      inventoryItem: existingItem,
      autoAssignments
    };
  } catch (error) {
    logger.error('Error updating inventory item:', error);
    throw error;
  }
};

/**
 * Delete inventory item (hard delete - permanently removes from database)
 * @param {string} itemId - Inventory item ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Deleted inventory item
 */
export const deleteInventoryItem = async (itemId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);
    const { getInventoryItemLocationModel } = await import('../models/company/InventoryItemLocation.js');
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    // First, delete all location configurations for this item
    await InventoryItemLocation.deleteMany({ inventoryItem: itemId });

    // Then, permanently delete the inventory item
    const item = await InventoryItem.findByIdAndDelete(itemId);

    if (!item) {
      throw new Error('Inventory item not found');
    }

    logger.info(`Inventory item permanently deleted: ${itemId} for company: ${companyId}`);

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
    const { getInventoryItemLocationModel } = await import('../models/company/InventoryItemLocation.js');
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    
    // Register all models needed for populate
    const InventoryItem = getInventoryItemModel(companyDB);
    const Location = getLocationModel(companyDB);
    const Category = getCategoryModel(companyDB);
    const Supplier = getSupplierModel(companyDB);

    const query = {
      isActive: true,
      $expr: { $lte: ['$availableQuantity', '$minimumStock'] }
    };

    // Location filter based on user role
    if (userRole === 'company_admin') {
      // Company admins see items from their assigned locations
      query.locationId = { $in: userBranchIds };
    } else if (branchId && branchId !== 'all') {
      // Super admins can filter by specific location
      query.locationId = branchId;
    }
    // If branchId is "all" and user is super admin, no location filter (see all)

    const locationItems = await InventoryItemLocation.find(query)
      .populate({
        path: 'inventoryItem',
        select: 'name type unit sku barcode category subcategory',
        populate: [
          { path: 'category', select: 'name type' },
          { path: 'subcategory', select: 'name type' }
        ]
      })
      .populate('locationId', 'name code')
      .populate('supplier', 'name contactPerson phone')
      .sort({ availableQuantity: 1 })
      .lean();

    return locationItems;
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
    const { getInventoryBatchLocationModel } = await import('../models/company/InventoryBatchLocation.js');
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);
    
    // Register all models needed for populate
    const InventoryItem = getInventoryItemModel(companyDB);
    const Location = getLocationModel(companyDB);
    const Category = getCategoryModel(companyDB);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const query = {
      isActive: true,
      status: 'active',
      expiryDate: {
        $gte: today,
        $lte: futureDate
      }
    };

    // Location filter based on user role
    if (userRole === 'company_admin') {
      // Company admins see items from their assigned locations
      query.locationId = { $in: userBranchIds };
    } else if (branchId && branchId !== 'all') {
      // Super admins can filter by specific location
      query.locationId = branchId;
    }
    // If branchId is "all" and user is super admin, no location filter (see all)

    const batchItems = await InventoryBatchLocation.find(query)
      .populate({
        path: 'inventoryItem',
        select: 'name type unit sku barcode category subcategory',
        populate: [
          { path: 'category', select: 'name type' },
          { path: 'subcategory', select: 'name type parent' }
        ]
      })
      .populate('locationId', 'name code')
      .sort({ expiryDate: 1 })
      .lean();

    return batchItems;
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
 * Get GRNs with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {string|Array<string>} branchId - Branch ID, "all", or array of branch IDs
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

    // Branch filter logic
    if (branchId === 'all') {
      // Super Admin viewing all branches - no branch filter
      // query.branch is not set, so all GRNs are returned
    } else if (Array.isArray(branchId)) {
      // Company Admin with array of branch IDs
      query.branch = { $in: branchId };
    } else if (branchId) {
      // Specific branch ID
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
        .sort({ receivedDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      GRN.countDocuments(query)
    ]);

    // Manually populate receivedBy from platform database
    const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
    const userIds = [...new Set(grns.map(grn => grn.receivedBy?.toString()).filter(Boolean))];
    
    if (userIds.length > 0) {
      const users = await CompanyUser.find({ _id: { $in: userIds } }).select('name email').lean();
      const userMap = new Map(users.map(user => [user._id.toString(), user]));
      
      // Attach user data to GRNs
      grns.forEach(grn => {
        if (grn.receivedBy) {
          const user = userMap.get(grn.receivedBy.toString());
          if (user) {
            grn.receivedBy = {
              _id: user._id,
              name: user.name,
              email: user.email
            };
          }
        }
      });
    }

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
    const InventoryItem = getInventoryItemModel(companyDB); // Register InventoryItem model

    const grn = await GRN.findById(grnId)
      .populate('supplier', 'name contactPerson phone email address gstNumber')
      .populate('items.inventoryItem', 'name type unit sku')
      .lean();

    if (!grn) {
      throw new Error('GRN not found');
    }

    // Manually populate receivedBy from platform database
    if (grn.receivedBy) {
      const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
      const user = await CompanyUser.findById(grn.receivedBy).select('name email').lean();
      if (user) {
        grn.receivedBy = {
          _id: user._id,
          name: user.name,
          email: user.email
        };
      }
    }

    return grn;
  } catch (error) {
    logger.error('Error getting GRN by ID:', error);
    throw error;
  }
};

/**
 * Get GRN details by ID with complete populated references
 * @param {string} grnId - GRN ID
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID for access validation
 * @returns {Promise<Object>} Complete GRN details
 */
export const getGRNDetails = async (grnId, companyId, branchId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);
    const Branch = getLocationModel(companyDB); // Register Location model
    const Supplier = getSupplierModel(companyDB); // Register Supplier model
    const InventoryItem = getInventoryItemModel(companyDB); // Register InventoryItem model

    const grn = await GRN.findById(grnId)
      .populate('branch', 'name code address city state pincode')
      .populate('supplier', 'name contactPerson phone email address city state pincode gstNumber')
      .populate('items.inventoryItem', 'name type unit sku')
      .lean();

    if (!grn) {
      throw new Error('GRN not found');
    }

    // Verify branch matches
    if (grn.branch._id.toString() !== branchId) {
      throw new Error('GRN does not belong to the specified branch');
    }

    // Manually populate receivedBy from platform database
    if (grn.receivedBy) {
      const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
      const user = await CompanyUser.findById(grn.receivedBy).select('name email').lean();
      if (user) {
        grn.receivedBy = {
          _id: user._id,
          name: user.name,
          email: user.email
        };
      }
    }

    return grn;
  } catch (error) {
    logger.error('Error getting GRN details:', error);
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
    const InventoryItem = getInventoryItemModel(companyDB);

    const {
      page = 1,
      limit = 10,
      startDate = '',
      endDate = '',
      type = '',
      reason = '',
      search = ''
    } = filters;

    // Build query
    const query = {};

    // Branch filter logic
    if (branchId === 'all') {
      // Super Admin viewing all branches - no branch filter
      // query.branch is not set, so all adjustments are returned
    } else if (Array.isArray(branchId)) {
      // Company Admin with array of branch IDs
      query.branch = { $in: branchId };
    } else if (branchId) {
      // Specific branch ID
      query.branch = branchId;
    }

    // Search filter (adjustmentNumber or item name)
    if (search) {
      // Find inventory items matching the search term
      const matchingItems = await InventoryItem.find({
        name: { $regex: search, $options: 'i' }
      }).select('_id').lean();
      
      const matchingItemIds = matchingItems.map(item => item._id);
      
      // Build $or query for adjustmentNumber or inventoryItem
      query.$or = [
        { adjustmentNumber: { $regex: search, $options: 'i' } },
        { inventoryItem: { $in: matchingItemIds } }
      ];
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

    // Calculate pagination: skip = (page - 1) × limit
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const [adjustments, total] = await Promise.all([
      StockAdjustment.find(query)
        .populate('branch', 'name code address city state pincode')
        .populate('inventoryItem', 'name type unit sku')
        .sort({ adjustmentDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockAdjustment.countDocuments(query)
    ]);

    // Manually populate adjustedBy from platform database
    const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
    const userIds = [...new Set(adjustments.map(adj => adj.adjustedBy?.toString()).filter(Boolean))];
    
    if (userIds.length > 0) {
      const users = await CompanyUser.find({ _id: { $in: userIds } }).select('name email').lean();
      const userMap = new Map(users.map(user => [user._id.toString(), user]));
      
      // Attach user data to adjustments
      adjustments.forEach(adj => {
        if (adj.adjustedBy) {
          const user = userMap.get(adj.adjustedBy.toString());
          if (user) {
            adj.adjustedBy = {
              _id: user._id,
              name: user.name,
              email: user.email
            };
          }
        }
      });
    }

    // Calculate total pages: Math.ceil(total / limit)
    const totalPages = Math.ceil(total / limit);

    return {
      adjustments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: totalPages
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

/**
 * Get suppliers for a specific branch
 * @param {string} branchId - Branch ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Array of suppliers associated with the branch
 */
export const getSuppliersForBranch = async (branchId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Supplier = getSupplierModel(companyDB);

    // Query suppliers that have the branch in their branchIds array
    const suppliers = await Supplier.find({
      branchIds: branchId,
      isActive: true
    })
      .select('name contactPerson phone email')
      .sort({ name: 1 })
      .lean();

    logger.info(`Found ${suppliers.length} suppliers for branch: ${branchId}`);

    return suppliers;
  } catch (error) {
    logger.error('Error getting suppliers for branch:', error);
    throw error;
  }
};

/**
 * Get inventory items for a specific branch (wrapper for GRN usage)
 * @param {string} branchId - Branch ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Array of inventory items available at the branch
 */
export const getInventoryItemsForBranch = async (branchId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const { getInventoryItemLocationModel } = await import('../models/company/InventoryItemLocation.js');
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    // Query InventoryItemLocation to get items for this location (branchId is actually locationId)
    const locationItems = await InventoryItemLocation.find({
      locationId: branchId,
      isActive: true
    })
      .populate('inventoryItem', 'name type unit sku barcode')
      .select('inventoryItem availableQuantity minimumStock maximumStock')
      .sort({ 'inventoryItem.name': 1 })
      .lean();

    // Transform to include inventory item details at top level
    const items = locationItems.map(item => ({
      _id: item.inventoryItem._id,
      name: item.inventoryItem.name,
      type: item.inventoryItem.type,
      unit: item.inventoryItem.unit,
      sku: item.inventoryItem.sku,
      barcode: item.inventoryItem.barcode,
      currentStock: item.availableQuantity, // Map availableQuantity to currentStock for backward compatibility
      minimumStock: item.minimumStock,
      maximumStock: item.maximumStock,
      branchItemId: item._id, // Backward compatibility
      locationItemId: item._id
    }));

    logger.info(`Found ${items.length} inventory items for location: ${branchId}`);

    return items;
  } catch (error) {
    logger.error('Error getting inventory items for location:', error);
    throw error;
  }
};

/**
 * Resend GRN in-app notifications
 * @param {string} grnId - GRN ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>}
 */
export const resendGRNInAppNotifications = async (grnId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB); // Register InventoryItem model

    // Get GRN with populated details
    const grn = await GRN.findById(grnId)
      .populate('locationId', 'name code address')
      .populate('branch', 'name code address')
      .populate('supplier', 'name contactPerson phone email')
      .populate('items.inventoryItem', 'name')
      .lean();

    if (!grn) {
      throw new Error('GRN not found');
    }

    // Manually populate receivedBy from platform database
    if (grn.receivedBy) {
      const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
      const user = await CompanyUser.findById(grn.receivedBy).select('name email').lean();
      if (user) {
        grn.receivedBy = {
          _id: user._id,
          name: user.name,
          email: user.email
        };
      }
    }

    // Import and call notification service
    const notificationService = (await import('./notificationService.js')).default;
    
    // Send in-app notifications
    const result = await notificationService.notifyGRNCreationInApp(companyId, grn);
    
    logger.info(`GRN in-app notifications resent successfully for ${grn.grnNumber}`);
    
    return result;
  } catch (error) {
    logger.error('Error resending GRN in-app notifications:', error);
    throw error;
  }
};

/**
 * Resend GRN email notifications
 * @param {string} grnId - GRN ID
 * @param {string} companyId - Company ID
 * @param {boolean} includeSupplier - Whether to send email to supplier
 * @returns {Promise<Object>}
 */
export const resendGRNEmailNotifications = async (grnId, companyId, includeSupplier = false) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB); // Register InventoryItem model

    // Get GRN with populated details
    const grn = await GRN.findById(grnId)
      .populate('locationId', 'name code address')
      .populate('branch', 'name code address')
      .populate('supplier', 'name contactPerson phone email')
      .populate('items.inventoryItem', 'name')
      .lean();

    if (!grn) {
      throw new Error('GRN not found');
    }

    // Manually populate receivedBy from platform database
    if (grn.receivedBy) {
      const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
      const user = await CompanyUser.findById(grn.receivedBy).select('name email').lean();
      if (user) {
        grn.receivedBy = {
          _id: user._id,
          name: user.name,
          email: user.email
        };
      }
    }

    // Import and call notification service
    const notificationService = (await import('./notificationService.js')).default;
    
    // Send email notifications
    const result = await notificationService.notifyGRNCreationEmail(companyId, grn, includeSupplier);
    
    logger.info(`GRN email notifications resent successfully for ${grn.grnNumber}`);
    
    return result;
  } catch (error) {
    logger.error('Error resending GRN email notifications:', error);
    throw error;
  }
};


/**
 * Resend stock adjustment in-app notifications
 * @param {string} adjustmentId - Stock adjustment ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>}
 */
export const resendStockAdjustmentInAppNotifications = async (adjustmentId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);

    // Get stock adjustment with populated details
    const adjustment = await StockAdjustment.findById(adjustmentId)
      .populate('branch', 'name code')
      .populate('inventoryItem', 'name')
      .lean();

    if (!adjustment) {
      throw new Error('Stock adjustment not found');
    }

    // Manually populate adjustedBy from platform database
    if (adjustment.adjustedBy) {
      const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
      const user = await CompanyUser.findById(adjustment.adjustedBy).select('name email').lean();
      if (user) {
        adjustment.adjustedBy = {
          _id: user._id,
          name: user.name,
          email: user.email
        };
      }
    }

    // Import and call notification service
    const notificationService = (await import('./notificationService.js')).default;
    
    // Send in-app notifications
    const result = await notificationService.notifyStockAdjustmentCreation(companyId, adjustment);
    
    logger.info(`Stock adjustment in-app notifications resent successfully for ${adjustment.adjustmentNumber}`);
    
    return result;
  } catch (error) {
    logger.error('Error resending stock adjustment in-app notifications:', error);
    throw error;
  }
};

/**
 * Get stock adjustment details by ID
 * @param {string} adjustmentId - Stock adjustment ID
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @returns {Promise<Object>}
 */
export const getStockAdjustmentDetails = async (adjustmentId, companyId, branchId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);

    // Get stock adjustment with populated details
    const adjustment = await StockAdjustment.findOne({
      _id: adjustmentId,
      branch: branchId
    })
      .populate('branch', 'name code address')
      .populate('inventoryItem', 'name unit type sku')
      .lean();

    if (!adjustment) {
      throw new Error('Stock adjustment not found');
    }

    // Manually populate adjustedBy from platform database
    if (adjustment.adjustedBy) {
      const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
      const user = await CompanyUser.findById(adjustment.adjustedBy).select('name email').lean();
      if (user) {
        adjustment.adjustedBy = {
          _id: user._id,
          name: user.name,
          email: user.email
        };
      }
    }

    return adjustment;
  } catch (error) {
    logger.error('Error getting stock adjustment details:', error);
    throw error;
  }
};

// ============================================================================
// Location-Based GRN Operations (New Architecture)
// ============================================================================

// Re-export location-based GRN functions from grnService
export {
  createGRNWithBatches,
  getGRNsByLocation,
  getGRNsBySupplier,
  verifyGRN,
  cancelGRN
} from './grnService.js';

