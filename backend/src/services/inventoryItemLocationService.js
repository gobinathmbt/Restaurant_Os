/**
 * Inventory Item Location Service
 * Business logic for location-specific inventory item configuration operations
 * Replaces inventoryItemBranchService with location-based approach
 */

import { getCompanyDB } from '../config/database.js';
import { getInventoryItemModel } from '../models/company/InventoryItem.js';
import { getCategoryModel } from '../models/company/Category.js';
import { getInventoryItemLocationModel } from '../models/company/InventoryItemLocation.js';
import { getInventoryBatchLocationModel } from '../models/company/InventoryBatchLocation.js';
import { getLocationModel } from '../models/company/Location.js';
import { getSupplierModel } from '../models/company/Supplier.js';
import { logger } from '../utils/logger.js';

/**
 * Validate location access based on user role
 * @param {string} locationId - Location ID to validate
 * @param {Array} userLocationIds - User's accessible location IDs (null for super admin)
 * @returns {boolean} Whether user has access
 */
const validateLocationAccess = (locationId, userLocationIds) => {
  // Super admin has access to all locations
  if (userLocationIds === null || userLocationIds === undefined) {
    return true;
  }

  // Check if location is in user's accessible locations
  return userLocationIds.includes(locationId.toString());
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
  const { availableQuantity, minimumStock, maximumStock, reorderPoint } = stockData;

  // minimumStock, maximumStock, reorderPoint must be non-negative
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

  // reorderPoint should be between minimumStock and maximumStock
  if (reorderPoint !== undefined && minimumStock !== undefined && reorderPoint < minimumStock) {
    throw new Error('Reorder point must be greater than or equal to minimum stock');
  }
  if (reorderPoint !== undefined && maximumStock !== undefined && reorderPoint > maximumStock) {
    throw new Error('Reorder point cannot exceed maximum stock');
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
 * Get inventory items for a specific location (merged with global data)
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options (page, limit, search, type, category, subcategory, isActive)
 * @param {Array} userLocationIds - User's accessible location IDs (null for super admin)
 * @returns {Promise<Object>} Paginated inventory items with location config
 */
export const getInventoryItemsForLocation = async (locationId, companyId, filters = {}, userLocationIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    // Ensure models are registered on this connection
    getInventoryItemModel(companyDB);
    getCategoryModel(companyDB);

    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const Supplier = getSupplierModel(companyDB);

    // Validate location access
    if (!validateLocationAccess(locationId, userLocationIds)) {
      throw new Error('You do not have access to this location');
    }

    const {
      page = 1,
      limit = 10,
      search = '',
      type = '',
      category = '',
      subcategory = '',
      isActive = ''
    } = filters;

    // Build query for InventoryItemLocation
    const locationQuery = {
      locationId: locationId
    };

    // Active filter
    if (isActive === 'true') {
      locationQuery.isActive = true;
    } else if (isActive === 'false') {
      locationQuery.isActive = false;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Query InventoryItemLocation and populate InventoryItem
    let query = InventoryItemLocation.find(locationQuery)
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
    const locationConfigs = await query.lean();

    // Filter by inventory item properties (search, type, category, subcategory)
    let filteredConfigs = locationConfigs;

    // Apply search filter on inventory item properties
    if (search) {
      const searchLower = search.toLowerCase();
      filteredConfigs = filteredConfigs.filter(config => {
        if (!config.inventoryItem) return false;
        
        const nameMatch = config.inventoryItem.name?.toLowerCase().includes(searchLower);
        const skuMatch = config.inventoryItem.sku?.toLowerCase().includes(searchLower);
        const barcodeMatch = config.inventoryItem.barcode?.toLowerCase().includes(searchLower);
        
        return nameMatch || skuMatch || barcodeMatch;
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

    // Merge global properties with location-specific config
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
        
        // Location-specific properties from InventoryItemLocation
        locationConfig: {
          _id: config._id,
          availableQuantity: config.availableQuantity,
          reservedQuantity: config.reservedQuantity,
          inTransitQuantity: config.inTransitQuantity,
          totalQuantity: config.availableQuantity + config.reservedQuantity + config.inTransitQuantity,
          minimumStock: config.minimumStock,
          maximumStock: config.maximumStock,
          reorderPoint: config.reorderPoint,
          costingMethod: config.costingMethod,
          standardCost: config.standardCost,
          lastPurchasePrice: config.lastPurchasePrice,
          lastPurchaseDate: config.lastPurchaseDate,
          supplier: config.supplier,
          storageLocation: config.storageLocation,
          negativeInventoryFlags: config.negativeInventoryFlags,
          isActive: config.isActive,
          isLowStock: config.availableQuantity <= config.minimumStock,
          stockPercentage: config.maximumStock ? (config.availableQuantity / config.maximumStock) * 100 : null,
          version: config.version
        },
        
        isActive: config.inventoryItem.isActive && config.isActive,
        createdAt: config.inventoryItem.createdAt,
        updatedAt: config.inventoryItem.updatedAt
      };
    }).filter(item => item !== null);

    // Sort by name
    mergedInventoryItems.sort((a, b) => a.name.localeCompare(b.name));

    // Get total count for pagination
    const total = await InventoryItemLocation.countDocuments(locationQuery);

    return {
      items: mergedInventoryItems,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting inventory items for location:', error);
    throw error;
  }
};

/**
 * Get a single InventoryItemLocation by item ID and location ID with batch information
 * @param {string} itemId - Inventory item ID
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @param {Array} userLocationIds - User's accessible location IDs (null for super admin)
 * @returns {Promise<Object>} InventoryItemLocation document with batch info
 */
export const getInventoryItemLocationById = async (itemId, locationId, companyId, userLocationIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    // Validate location access
    if (!validateLocationAccess(locationId, userLocationIds)) {
      throw new Error('You do not have access to this location');
    }

    const locationConfig = await InventoryItemLocation.findOne({
      inventoryItem: itemId,
      locationId: locationId
    })
      .populate({
        path: 'inventoryItem',
        populate: [
          { path: 'category', select: 'name description color icon' },
          { path: 'subcategory', select: 'name description color icon' }
        ]
      })
      .populate({ path: 'supplier', select: 'name contactPerson phone email' })
      .populate({ path: 'locationId', select: 'name code type' })
      .lean();

    if (!locationConfig) {
      throw new Error('Inventory item location config not found');
    }

    // Get batch information if FIFO costing method
    let batches = [];
    if (locationConfig.costingMethod === 'FIFO') {
      batches = await InventoryBatchLocation.find({
        inventoryItem: itemId,
        locationId: locationId,
        isActive: true,
        status: 'active'
      })
        .sort({ createdAt: 1 }) // FIFO order
        .lean();
    }

    return {
      inventoryItem: locationConfig.inventoryItem,
      locationConfig: {
        _id: locationConfig._id,
        locationId: locationConfig.locationId,
        availableQuantity: locationConfig.availableQuantity,
        reservedQuantity: locationConfig.reservedQuantity,
        inTransitQuantity: locationConfig.inTransitQuantity,
        totalQuantity: locationConfig.availableQuantity + locationConfig.reservedQuantity + locationConfig.inTransitQuantity,
        minimumStock: locationConfig.minimumStock,
        maximumStock: locationConfig.maximumStock,
        reorderPoint: locationConfig.reorderPoint,
        costingMethod: locationConfig.costingMethod,
        standardCost: locationConfig.standardCost,
        lastPurchasePrice: locationConfig.lastPurchasePrice,
        lastPurchaseDate: locationConfig.lastPurchaseDate,
        supplier: locationConfig.supplier,
        storageLocation: locationConfig.storageLocation,
        negativeInventoryFlags: locationConfig.negativeInventoryFlags,
        isActive: locationConfig.isActive,
        isLowStock: locationConfig.availableQuantity <= locationConfig.minimumStock,
        version: locationConfig.version
      },
      batches
    };
  } catch (error) {
    logger.error('Error getting inventory item location by id:', error);
    throw error;
  }
};

/**
 * Create location configuration for an inventory item
 * @param {string} itemId - Inventory item ID
 * @param {string} locationId - Location ID
 * @param {Object} configData - Configuration data
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID for audit
 * @param {Array} userLocationIds - User's accessible location IDs (null for super admin)
 * @returns {Promise<Object>} Created location config
 */
export const createLocationConfig = async (itemId, locationId, configData, companyId, userId, userLocationIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const Location = getLocationModel(companyDB);

    // Validate location access
    if (!validateLocationAccess(locationId, userLocationIds)) {
      throw new Error('You do not have access to this location');
    }

    // Validate inventory item exists
    const inventoryItem = await InventoryItem.findById(itemId)
      .populate('category')
      .populate('subcategory');
    
    if (!inventoryItem) {
      throw new Error('Inventory item not found');
    }

    // Validate location exists
    const location = await Location.findById(locationId);
    if (!location) {
      throw new Error('Location not found');
    }

    // Check if config already exists
    const existingConfig = await InventoryItemLocation.findOne({
      inventoryItem: itemId,
      locationId: locationId
    });

    if (existingConfig) {
      throw new Error('Location configuration already exists for this item');
    }

    // Validate prices if provided
    if (configData.standardCost !== undefined) {
      validatePrice(configData.standardCost);
    }
    if (configData.lastPurchasePrice !== undefined) {
      validatePrice(configData.lastPurchasePrice);
    }

    // Validate stock values
    validateStockValues(configData);

    // Create new location config
    const locationConfig = new InventoryItemLocation({
      inventoryItem: itemId,
      locationId: locationId,
      availableQuantity: configData.availableQuantity !== undefined ? configData.availableQuantity : 0,
      reservedQuantity: 0,
      inTransitQuantity: 0,
      minimumStock: configData.minimumStock !== undefined ? configData.minimumStock : 0,
      maximumStock: configData.maximumStock,
      reorderPoint: configData.reorderPoint,
      costingMethod: configData.costingMethod || 'FIFO',
      standardCost: configData.standardCost,
      lastPurchasePrice: configData.lastPurchasePrice,
      lastPurchaseDate: configData.lastPurchaseDate,
      supplier: configData.supplier,
      storageLocation: configData.storageLocation,
      isActive: true,
      version: 0
    });

    await locationConfig.save();

    // Auto-assign category and subcategory to location if needed
    if (inventoryItem.category || inventoryItem.subcategory) {
      try {
        const CategoryBranchValidationService = (await import('./categoryBranchValidationService.js')).default;
        const validationService = new CategoryBranchValidationService(companyDB);
        
        const categoryIds = inventoryItem.category ? [inventoryItem.category._id.toString()] : [];
        const subcategoryIds = inventoryItem.subcategory ? [inventoryItem.subcategory._id.toString()] : [];
        
        await validationService.assignCategoriesToBranches(
          [locationId],
          categoryIds,
          subcategoryIds,
          userId || 'system',
          'inventory_item_location_create',
          null
        );
        
        logger.info(`Auto-assigned categories to location ${locationId} for item ${itemId}`);
      } catch (error) {
        logger.warn('Failed to auto-assign categories to location:', error);
      }
    }

    logger.info(`Location config created for inventory item: ${itemId}, location: ${locationId}, company: ${companyId}`);

    // Populate and return
    const populatedConfig = await InventoryItemLocation.findById(locationConfig._id)
      .populate('inventoryItem')
      .populate('locationId')
      .populate('supplier')
      .lean();

    return populatedConfig;
  } catch (error) {
    logger.error('Error creating location config:', error);
    throw error;
  }
};

/**
 * Update location configuration with optimistic locking
 * @param {string} itemId - Inventory item ID
 * @param {string} locationId - Location ID
 * @param {Object} updateData - Update data
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID for audit
 * @param {Array} userLocationIds - User's accessible location IDs (null for super admin)
 * @returns {Promise<Object>} Updated location config
 */
export const updateLocationConfig = async (itemId, locationId, updateData, companyId, userId, userLocationIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    // Validate location access
    if (!validateLocationAccess(locationId, userLocationIds)) {
      throw new Error('You do not have access to this location');
    }

    // Find existing config
    const locationConfig = await InventoryItemLocation.findOne({
      inventoryItem: itemId,
      locationId: locationId
    });

    if (!locationConfig) {
      throw new Error('Location configuration not found');
    }

    // Optimistic locking check
    if (updateData.version !== undefined && locationConfig.version !== updateData.version) {
      throw new Error('Configuration has been modified by another user. Please refresh and try again.');
    }

    // Validate prices if provided
    if (updateData.standardCost !== undefined) {
      validatePrice(updateData.standardCost);
    }
    if (updateData.lastPurchasePrice !== undefined) {
      validatePrice(updateData.lastPurchasePrice);
    }

    // Validate stock values if provided
    validateStockValues(updateData);

    // Update fields (excluding quantities which are managed by stock movement service)
    const allowedUpdates = [
      'minimumStock',
      'maximumStock',
      'reorderPoint',
      'costingMethod',
      'standardCost',
      'lastPurchasePrice',
      'lastPurchaseDate',
      'supplier',
      'storageLocation',
      'isActive'
    ];

    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        locationConfig[field] = updateData[field];
      }
    });

    // Increment version for optimistic locking
    locationConfig.version += 1;

    await locationConfig.save();

    logger.info(`Location config updated for inventory item: ${itemId}, location: ${locationId}, company: ${companyId}`);

    // Populate and return
    const populatedConfig = await InventoryItemLocation.findById(locationConfig._id)
      .populate('inventoryItem')
      .populate('locationId')
      .populate('supplier')
      .lean();

    return populatedConfig;
  } catch (error) {
    logger.error('Error updating location config:', error);
    throw error;
  }
};

/**
 * Delete location configuration (soft delete)
 * @param {string} itemId - Inventory item ID
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @param {Array} userLocationIds - User's accessible location IDs (null for super admin)
 * @returns {Promise<Object>} Deleted location config
 */
export const deleteLocationConfig = async (itemId, locationId, companyId, userLocationIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    // Validate location access
    if (!validateLocationAccess(locationId, userLocationIds)) {
      throw new Error('You do not have access to this location');
    }

    // Find location config
    const locationConfig = await InventoryItemLocation.findOne({
      inventoryItem: itemId,
      locationId: locationId
    });

    if (!locationConfig) {
      throw new Error('Location configuration not found');
    }

    // Check if there's any stock - prevent deletion if stock exists
    if (locationConfig.availableQuantity !== 0 || locationConfig.reservedQuantity !== 0 || locationConfig.inTransitQuantity !== 0) {
      throw new Error('Cannot delete location configuration with existing stock. Please adjust stock to zero first.');
    }

    // Soft delete
    locationConfig.isActive = false;
    locationConfig.version += 1;
    await locationConfig.save();

    logger.info(`Location config soft deleted for inventory item: ${itemId}, location: ${locationId}, company: ${companyId}`);

    return locationConfig;
  } catch (error) {
    logger.error('Error deleting location config:', error);
    throw error;
  }
};

/**
 * Bulk update location configurations for an inventory item
 * @param {string} itemId - Inventory item ID
 * @param {Array} locationConfigs - Array of { locationId, ...config }
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID for audit
 * @param {Array} userLocationIds - User's accessible location IDs (null for super admin)
 * @returns {Promise<Object>} Updated location configs with auto-assignment results
 */
export const bulkUpdateLocationConfigs = async (itemId, locationConfigs, companyId, userId, userLocationIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const Location = getLocationModel(companyDB);

    // Validate inventory item exists
    const inventoryItem = await InventoryItem.findById(itemId)
      .populate('category')
      .populate('subcategory');
    
    if (!inventoryItem) {
      throw new Error('Inventory item not found');
    }

    const updatedConfigs = [];
    const newLocationIds = []; // Track newly added locations

    // Process each location config
    for (const config of locationConfigs) {
      const { locationId, ...updateData } = config;

      // Validate location access
      if (!validateLocationAccess(locationId, userLocationIds)) {
        throw new Error(`You do not have access to location: ${locationId}`);
      }

      // Validate location exists
      const location = await Location.findById(locationId);
      if (!location) {
        throw new Error(`Location not found: ${locationId}`);
      }

      // Validate prices if provided
      if (updateData.standardCost !== undefined) {
        validatePrice(updateData.standardCost);
      }
      if (updateData.lastPurchasePrice !== undefined) {
        validatePrice(updateData.lastPurchasePrice);
      }

      // Validate stock values if provided
      validateStockValues(updateData);

      // Find existing config or create new one
      let locationConfig = await InventoryItemLocation.findOne({
        inventoryItem: itemId,
        locationId: locationId
      });

      if (locationConfig) {
        // Update existing config
        const allowedUpdates = [
          'minimumStock',
          'maximumStock',
          'reorderPoint',
          'costingMethod',
          'standardCost',
          'lastPurchasePrice',
          'lastPurchaseDate',
          'supplier',
          'storageLocation',
          'isActive'
        ];

        allowedUpdates.forEach(field => {
          if (updateData[field] !== undefined) {
            locationConfig[field] = updateData[field];
          }
        });

        locationConfig.version += 1;
        await locationConfig.save();
      } else {
        // Create new config - track this as a new location assignment
        newLocationIds.push(locationId);
        
        locationConfig = new InventoryItemLocation({
          inventoryItem: itemId,
          locationId: locationId,
          availableQuantity: updateData.availableQuantity !== undefined ? updateData.availableQuantity : 0,
          reservedQuantity: 0,
          inTransitQuantity: 0,
          minimumStock: updateData.minimumStock !== undefined ? updateData.minimumStock : 0,
          maximumStock: updateData.maximumStock,
          reorderPoint: updateData.reorderPoint,
          costingMethod: updateData.costingMethod || 'FIFO',
          standardCost: updateData.standardCost,
          lastPurchasePrice: updateData.lastPurchasePrice,
          lastPurchaseDate: updateData.lastPurchaseDate,
          supplier: updateData.supplier,
          storageLocation: updateData.storageLocation,
          isActive: true,
          version: 0
        });
        await locationConfig.save();
      }

      updatedConfigs.push(locationConfig);
    }

    // Auto-assign category and subcategory to newly added locations
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

    if (newLocationIds.length > 0) {
      logger.info(`Auto-assigning category/subcategory to new locations: ${newLocationIds.join(', ')}`);
      
      try {
        const CategoryBranchValidationService = (await import('./categoryBranchValidationService.js')).default;
        const validationService = new CategoryBranchValidationService(companyDB);
        
        const categoryIds = inventoryItem.category ? [inventoryItem.category._id.toString()] : [];
        const subcategoryIds = inventoryItem.subcategory ? [inventoryItem.subcategory._id.toString()] : [];
        
        const assignmentResult = await validationService.assignCategoriesToBranches(
          newLocationIds,
          categoryIds,
          subcategoryIds,
          userId || 'system',
          'inventory_item_location_bulk_update',
          null
        );
        
        autoAssignments.assigned.categories = assignmentResult.assigned.categories;
        autoAssignments.assigned.subcategories = assignmentResult.assigned.subcategories;
        autoAssignments.alreadyAssigned.categories = assignmentResult.alreadyAssigned.categories;
        autoAssignments.alreadyAssigned.subcategories = assignmentResult.alreadyAssigned.subcategories;
        
        logger.info(`Category/subcategory assignment result:`, assignmentResult);
      } catch (error) {
        logger.warn('Failed to auto-assign categories to locations:', error);
      }
    }

    // Auto-assign suppliers to locations where specified
    const Supplier = getSupplierModel(companyDB);
    for (const config of locationConfigs) {
      if (config.supplier) {
        const supplier = await Supplier.findById(config.supplier);
        if (supplier) {
          const supplierLocationIds = supplier.branchIds.map(id => id.toString());
          if (!supplierLocationIds.includes(config.locationId.toString())) {
            supplier.branchIds.push(config.locationId);
            await supplier.save();
            
            autoAssignments.assigned.suppliers.push({
              supplierId: supplier._id.toString(),
              supplierName: supplier.name,
              locationIds: [config.locationId]
            });
            
            logger.info(`Auto-assigned supplier ${supplier._id} to location ${config.locationId}`);
          } else {
            autoAssignments.alreadyAssigned.suppliers.push({
              supplierId: supplier._id.toString(),
              supplierName: supplier.name
            });
          }
        }
      }
    }

    logger.info(`Bulk updated ${updatedConfigs.length} location configs for inventory item ${itemId} in company: ${companyId}`);

    // Populate and return
    const populatedConfigs = await InventoryItemLocation.find({
      _id: { $in: updatedConfigs.map(c => c._id) }
    })
      .populate('inventoryItem')
      .populate('locationId')
      .populate('supplier')
      .lean();

    return {
      locationConfigs: populatedConfigs,
      autoAssignments
    };
  } catch (error) {
    logger.error('Error bulk updating location configs:', error);
    throw error;
  }
};
