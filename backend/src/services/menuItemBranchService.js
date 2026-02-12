/**
 * Menu Item Branch Service
 * Business logic for branch-specific menu item configuration operations
 */

import { getCompanyDB } from '../config/database.js';
import { getMenuItemModel } from '../models/company/MenuItem.js';
import { getMenuItemBranchModel } from '../models/company/MenuItemBranch.js';
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
 * Validate preparation time
 * @param {number} preparationTime - Preparation time in minutes
 * @throws {Error} If preparation time is invalid
 */
const validatePreparationTime = (preparationTime) => {
  if (preparationTime !== undefined && preparationTime !== null) {
    if (!Number.isInteger(preparationTime) || preparationTime < 0) {
      throw new Error('Preparation time must be a positive integer');
    }
  }
};

/**
 * Validate tax rate
 * @param {number} taxRate - Tax rate percentage
 * @throws {Error} If tax rate is invalid
 */
const validateTaxRate = (taxRate) => {
  if (taxRate !== undefined && taxRate !== null) {
    if (taxRate < 0 || taxRate > 100) {
      throw new Error('Tax rate must be between 0 and 100');
    }
  }
};

/**
 * Validate modifier structure
 * @param {Array} modifiers - Array of modifiers to validate
 * @throws {Error} If modifier structure is invalid
 */
const validateModifiers = (modifiers) => {
  if (!Array.isArray(modifiers)) {
    throw new Error('Modifiers must be an array');
  }

  for (const modifier of modifiers) {
    if (!modifier.name || typeof modifier.name !== 'string' || modifier.name.trim() === '') {
      throw new Error('Each modifier must have a non-empty name');
    }

    if (!Array.isArray(modifier.options) || modifier.options.length === 0) {
      throw new Error('Each modifier must have at least one option');
    }

    for (const option of modifier.options) {
      if (!option.name || typeof option.name !== 'string' || option.name.trim() === '') {
        throw new Error('Each modifier option must have a non-empty name');
      }

      if (typeof option.price !== 'number' || option.price < 0) {
        throw new Error('Each modifier option must have a valid non-negative price');
      }
    }
  }
};

/**
 * Create branch configuration for menu item
 * @param {string} menuItemId - Menu item ID
 * @param {string} branchId - Branch ID
 * @param {Object} configData - Branch configuration data
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Created branch config
 */
export const createBranchConfig = async (menuItemId, branchId, configData, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItem = getMenuItemModel(companyDB);
    const MenuItemBranch = getMenuItemBranchModel(companyDB);
    const Branch = getBranchModel(companyDB);

    // Validate branch access
    if (!validateBranchAccess(branchId, userBranchIds)) {
      throw new Error('You do not have access to this branch');
    }

    // Validate menu item exists
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    // Validate branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      throw new Error('Branch not found');
    }

    // Validate price
    if (configData.price !== undefined) {
      validatePrice(configData.price);
    }

    // Validate preparation time
    if (configData.preparationTime !== undefined) {
      validatePreparationTime(configData.preparationTime);
    }

    // Validate tax rate
    if (configData.taxRateOverride !== undefined) {
      validateTaxRate(configData.taxRateOverride);
    }

    // Validate time-based pricing prices
    if (configData.timeBasedPricing && Array.isArray(configData.timeBasedPricing)) {
      configData.timeBasedPricing.forEach(pricing => {
        if (pricing.price !== undefined) {
          validatePrice(pricing.price);
        }
      });
    }

    // Check if branch config already exists
    const existingConfig = await MenuItemBranch.findOne({
      menuItem: menuItemId,
      branch: branchId
    });

    if (existingConfig) {
      throw new Error('Branch configuration already exists for this menu item');
    }

    // Create branch configuration
    const branchConfig = new MenuItemBranch({
      menuItem: menuItemId,
      branch: branchId,
      ...configData
    });

    await branchConfig.save();

    logger.info(`Branch config created for menu item: ${menuItemId}, branch: ${branchId}, company: ${companyId}`);

    // Populate and return
    await branchConfig.populate('menuItem');
    await branchConfig.populate('branch');

    return branchConfig;
  } catch (error) {
    logger.error('Error creating branch config:', error);
    throw error;
  }
};

/**
 * Get branch configuration for menu item
 * @param {string} menuItemId - Menu item ID
 * @param {string} branchId - Branch ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Branch configuration
 */
export const getBranchConfig = async (menuItemId, branchId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItemBranch = getMenuItemBranchModel(companyDB);

    const branchConfig = await MenuItemBranch.findOne({
      menuItem: menuItemId,
      branch: branchId
    })
      .populate('menuItem')
      .populate('branch')
      .lean();

    if (!branchConfig) {
      throw new Error('Branch configuration not found');
    }

    return branchConfig;
  } catch (error) {
    logger.error('Error getting branch config:', error);
    throw error;
  }
};

/**
 * Update branch configuration
 * @param {string} menuItemId - Menu item ID
 * @param {string} branchId - Branch ID
 * @param {Object} updateData - Update data
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Updated branch config
 */
export const updateBranchConfig = async (menuItemId, branchId, updateData, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItemBranch = getMenuItemBranchModel(companyDB);

    // Validate branch access
    if (!validateBranchAccess(branchId, userBranchIds)) {
      throw new Error('You do not have access to this branch');
    }

    // Get existing branch config
    const branchConfig = await MenuItemBranch.findOne({
      menuItem: menuItemId,
      branch: branchId
    });

    if (!branchConfig) {
      throw new Error('Branch configuration not found');
    }

    // Validate price if being updated
    if (updateData.price !== undefined) {
      validatePrice(updateData.price);
    }

    // Validate preparation time if being updated
    if (updateData.preparationTime !== undefined) {
      validatePreparationTime(updateData.preparationTime);
    }

    // Validate tax rate if being updated
    if (updateData.taxRateOverride !== undefined) {
      validateTaxRate(updateData.taxRateOverride);
    }

    // Validate time-based pricing prices if being updated
    if (updateData.timeBasedPricing && Array.isArray(updateData.timeBasedPricing)) {
      updateData.timeBasedPricing.forEach(pricing => {
        if (pricing.price !== undefined) {
          validatePrice(pricing.price);
        }
      });
    }

    // Update branch config
    Object.assign(branchConfig, updateData);
    await branchConfig.save();

    logger.info(`Branch config updated for menu item: ${menuItemId}, branch: ${branchId}, company: ${companyId}`);

    // Populate and return
    await branchConfig.populate('menuItem');
    await branchConfig.populate('branch');

    return branchConfig;
  } catch (error) {
    logger.error('Error updating branch config:', error);
    throw error;
  }
};

/**
 * Update modifiers for a menu item branch
 * @param {string} companyId - Company ID
 * @param {string} menuItemBranchId - MenuItemBranch ID
 * @param {Array} modifiers - Array of modifiers with options
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Updated MenuItemBranch
 */
export const updateModifiers = async (companyId, menuItemBranchId, modifiers, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItemBranch = getMenuItemBranchModel(companyDB);

    // Validate modifier structure
    validateModifiers(modifiers);

    // Find the MenuItemBranch
    const menuItemBranch = await MenuItemBranch.findById(menuItemBranchId);

    if (!menuItemBranch) {
      throw new Error('MenuItemBranch not found');
    }

    // Validate branch access
    if (!validateBranchAccess(menuItemBranch.branch.toString(), userBranchIds)) {
      throw new Error('You do not have access to this branch');
    }

    // Update modifiers
    menuItemBranch.modifiers = modifiers;
    await menuItemBranch.save();

    logger.info(`Modifiers updated for MenuItemBranch: ${menuItemBranchId}, company: ${companyId}`);

    // Populate and return
    await menuItemBranch.populate('menuItem');
    await menuItemBranch.populate('branch');

    return menuItemBranch;
  } catch (error) {
    logger.error('Error updating modifiers:', error);
    throw error;
  }
};

/**
 * Delete branch configuration (remove item from branch)
 * @param {string} menuItemId - Menu item ID
 * @param {string} branchId - Branch ID
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Deleted branch config
 */
export const deleteBranchConfig = async (menuItemId, branchId, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItemBranch = getMenuItemBranchModel(companyDB);

    // Validate branch access
    if (!validateBranchAccess(branchId, userBranchIds)) {
      throw new Error('You do not have access to this branch');
    }

    // Find and delete branch config
    const branchConfig = await MenuItemBranch.findOneAndDelete({
      menuItem: menuItemId,
      branch: branchId
    });

    if (!branchConfig) {
      throw new Error('Branch configuration not found');
    }

    logger.info(`Branch config deleted for menu item: ${menuItemId}, branch: ${branchId}, company: ${companyId}`);

    return branchConfig;
  } catch (error) {
    logger.error('Error deleting branch config:', error);
    throw error;
  }
};

/**
 * Get menu items for a specific branch (merged with global data)
 * @param {string} branchId - Branch ID
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options (page, limit, search, categoryId, isActive, isAvailable)
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Paginated menu items with branch config
 */
export const getMenuItemsForBranch = async (branchId, companyId, filters = {}, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItemBranch = getMenuItemBranchModel(companyDB);

    // Validate branch access
    if (!validateBranchAccess(branchId, userBranchIds)) {
      throw new Error('You do not have access to this branch');
    }

    const {
      page = 1,
      limit = 10,
      search = '',
      categoryId = '',
      isActive = '',
      isAvailable = ''
    } = filters;

    // Build query for MenuItemBranch
    const branchQuery = {
      branch: branchId
    };

    // Active/Inactive filter for branch config
    if (isActive === 'true') {
      branchQuery.isActive = true;
    } else if (isActive === 'false') {
      branchQuery.isActive = false;
    }

    // Availability filter
    if (isAvailable === 'true') {
      branchQuery.isAvailable = true;
      branchQuery.outOfStock = false;
    } else if (isAvailable === 'false') {
      branchQuery.$or = [
        { isAvailable: false },
        { outOfStock: true }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Query MenuItemBranch and populate MenuItem
    let query = MenuItemBranch.find(branchQuery)
      .populate({
        path: 'menuItem',
        populate: {
          path: 'category',
          select: 'name description color icon'
        }
      })
      .skip(skip)
      .limit(parseInt(limit));

    // Execute query
    const branchConfigs = await query.lean();

    // Filter by menu item properties (search, category)
    let filteredConfigs = branchConfigs;

    // Apply search filter on menu item properties
    if (search) {
      const searchLower = search.toLowerCase();
      filteredConfigs = filteredConfigs.filter(config => {
        if (!config.menuItem) return false;
        
        const nameMatch = config.menuItem.name?.toLowerCase().includes(searchLower);
        const descMatch = config.menuItem.description?.toLowerCase().includes(searchLower);
        const tagsMatch = config.menuItem.tags?.some(tag => tag.toLowerCase().includes(searchLower));
        
        return nameMatch || descMatch || tagsMatch;
      });
    }

    // Apply category filter
    if (categoryId) {
      filteredConfigs = filteredConfigs.filter(config => {
        return config.menuItem?.category?._id?.toString() === categoryId;
      });
    }

    // Apply active filter on menu item
    if (isActive !== '') {
      const activeValue = isActive === 'true';
      filteredConfigs = filteredConfigs.filter(config => {
        return config.menuItem?.isActive === activeValue;
      });
    }

    // Merge global properties with branch-specific config
    const mergedMenuItems = filteredConfigs.map(config => {
      if (!config.menuItem) return null;

      // Calculate effective price using the model method
      const effectivePrice = config.timeBasedPricing && config.timeBasedPricing.length > 0
        ? calculateEffectivePrice(config)
        : config.price;

      return {
        // Global properties from MenuItem
        _id: config.menuItem._id,
        name: config.menuItem.name,
        description: config.menuItem.description,
        category: config.menuItem.category,
        basePrice: config.menuItem.basePrice,
        images: config.menuItem.images,
        isVeg: config.menuItem.isVeg,
        spiceLevel: config.menuItem.spiceLevel,
        modifiers: config.menuItem.modifiers,
        addOns: config.menuItem.addOns,
        tags: config.menuItem.tags,
        hsnCode: config.menuItem.hsnCode,
        
        // Branch-specific properties from MenuItemBranch
        branchConfig: {
          _id: config._id,
          price: config.price,
          effectivePrice: effectivePrice,
          timeBasedPricing: config.timeBasedPricing,
          isAvailable: config.isAvailable,
          availability: config.availability,
          preparationTime: config.preparationTime,
          requiresKitchen: config.requiresKitchen,
          outOfStock: config.outOfStock,
          lowStockThreshold: config.lowStockThreshold,
          taxRateOverride: config.taxRateOverride,
          displayOrder: config.displayOrder,
          channels: config.channels,
          isActive: config.isActive
        },
        
        isActive: config.menuItem.isActive && config.isActive,
        createdAt: config.menuItem.createdAt,
        updatedAt: config.menuItem.updatedAt
      };
    }).filter(item => item !== null);

    // Sort by display order, then by name
    mergedMenuItems.sort((a, b) => {
      if (a.branchConfig.displayOrder !== b.branchConfig.displayOrder) {
        return a.branchConfig.displayOrder - b.branchConfig.displayOrder;
      }
      return a.name.localeCompare(b.name);
    });

    // Get total count for pagination
    const total = await MenuItemBranch.countDocuments(branchQuery);

    return {
      menuItems: mergedMenuItems,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting menu items for branch:', error);
    throw error;
  }
};

/**
 * Calculate effective price based on time-based pricing
 * @param {Object} branchConfig - Branch configuration with time-based pricing
 * @returns {number} Effective price
 */
const calculateEffectivePrice = (branchConfig) => {
  if (!branchConfig.timeBasedPricing || branchConfig.timeBasedPricing.length === 0) {
    return branchConfig.price;
  }

  const now = new Date();
  const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const activePrice = branchConfig.timeBasedPricing.find(pricing => {
    if (!pricing.isActive) return false;
    if (!pricing.days || !pricing.days.includes(currentDay)) return false;
    return currentTime >= pricing.startTime && currentTime <= pricing.endTime;
  });

  return activePrice ? activePrice.price : branchConfig.price;
};

/**
 * Bulk assign menu item to multiple branches
 * @param {string} menuItemId - Menu item ID
 * @param {Array} branchConfigs - Array of { branchId, price, ...config }
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Array>} Created branch configs
 */
export const bulkAssignToBranches = async (menuItemId, branchConfigs, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItem = getMenuItemModel(companyDB);
    const MenuItemBranch = getMenuItemBranchModel(companyDB);
    const Branch = getBranchModel(companyDB);

    // Validate menu item exists
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    // Validate all branch configs
    const validatedConfigs = [];
    for (const config of branchConfigs) {
      const { branchId, ...configData } = config;

      // Validate branch access
      if (!validateBranchAccess(branchId, userBranchIds)) {
        throw new Error(`You do not have access to branch: ${branchId}`);
      }

      // Validate branch exists
      const branch = await Branch.findById(branchId);
      if (!branch) {
        throw new Error(`Branch not found: ${branchId}`);
      }

      // Validate price
      if (configData.price !== undefined) {
        validatePrice(configData.price);
      }

      // Validate preparation time
      if (configData.preparationTime !== undefined) {
        validatePreparationTime(configData.preparationTime);
      }

      // Validate tax rate
      if (configData.taxRateOverride !== undefined) {
        validateTaxRate(configData.taxRateOverride);
      }

      validatedConfigs.push({
        menuItem: menuItemId,
        branch: branchId,
        ...configData
      });
    }

    // Create all branch configs
    const createdConfigs = await MenuItemBranch.insertMany(validatedConfigs, {
      ordered: false // Continue on duplicate key errors
    });

    logger.info(`Bulk assigned menu item ${menuItemId} to ${createdConfigs.length} branches for company: ${companyId}`);

    // Populate and return
    const populatedConfigs = await MenuItemBranch.find({
      _id: { $in: createdConfigs.map(c => c._id) }
    })
      .populate('menuItem')
      .populate('branch')
      .lean();

    return populatedConfigs;
  } catch (error) {
    // Handle duplicate key errors gracefully
    if (error.code === 11000) {
      logger.warn('Some branch configurations already exist, skipping duplicates');
      // Return partial success
      throw new Error('One or more branch configurations already exist');
    }
    logger.error('Error bulk assigning to branches:', error);
    throw error;
  }
};

/**
 * Bulk update branch configurations for a menu item
 * @param {string} menuItemId - Menu item ID
 * @param {Array} branchConfigs - Array of { branchId, ...config }
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Array>} Updated branch configs
 */
export const bulkUpdateBranchConfigs = async (menuItemId, branchConfigs, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItem = getMenuItemModel(companyDB);
    const MenuItemBranch = getMenuItemBranchModel(companyDB);
    const Branch = getBranchModel(companyDB);

    // Validate menu item exists
    const menuItem = await MenuItem.findById(menuItemId).populate('category');
    if (!menuItem) {
      throw new Error('Menu item not found');
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

      // Validate price if provided
      if (updateData.price !== undefined) {
        validatePrice(updateData.price);
      }

      // Validate preparation time if provided
      if (updateData.preparationTime !== undefined) {
        validatePreparationTime(updateData.preparationTime);
      }

      // Validate tax rate if provided
      if (updateData.taxRateOverride !== undefined) {
        validateTaxRate(updateData.taxRateOverride);
      }

      // Find existing config or create new one
      let branchConfig = await MenuItemBranch.findOne({
        menuItem: menuItemId,
        branch: branchId
      });

      if (branchConfig) {
        // Update existing config
        Object.assign(branchConfig, updateData);
        await branchConfig.save();
      } else {
        // Create new config - track this as a new branch assignment
        newBranchIds.push(branchId);
        
        branchConfig = new MenuItemBranch({
          menuItem: menuItemId,
          branch: branchId,
          price: updateData.price !== undefined ? updateData.price : menuItem.basePrice,
          isAvailable: updateData.isAvailable !== undefined ? updateData.isAvailable : true,
          preparationTime: updateData.preparationTime !== undefined ? updateData.preparationTime : 15,
          requiresKitchen: updateData.requiresKitchen !== undefined ? updateData.requiresKitchen : true,
          outOfStock: updateData.outOfStock !== undefined ? updateData.outOfStock : false,
          lowStockThreshold: updateData.lowStockThreshold,
          taxRateOverride: updateData.taxRateOverride,
          displayOrder: updateData.displayOrder !== undefined ? updateData.displayOrder : 0,
          channels: updateData.channels || ['dine_in', 'takeaway', 'online'],
          timeBasedPricing: updateData.timeBasedPricing || [],
          availability: updateData.availability || { schedule: [] },
          isActive: true
        });
        await branchConfig.save();
      }

      updatedConfigs.push(branchConfig);
    }

    // Auto-assign category to newly added branches
    if (newBranchIds.length > 0 && menuItem.category) {
      logger.info(`Auto-assigning category ${menuItem.category._id} to new branches: ${newBranchIds.join(', ')}`);
      
      const MenuCategoryBranchValidationService = (await import('./menuCategoryBranchValidationService.js')).default;
      const validationService = new MenuCategoryBranchValidationService(companyDB);
      
      const assignmentResult = await validationService.assignCategoryToBranches(
        newBranchIds,
        menuItem.category._id.toString(),
        'system', // userId - using 'system' for automatic updates
        'menu_item_branch_update',
        null // no session
      );
      
      logger.info(`Category assignment result:`, assignmentResult);
    }

    logger.info(`Bulk updated ${updatedConfigs.length} branch configs for menu item ${menuItemId} in company: ${companyId}`);

    // Populate and return
    const populatedConfigs = await MenuItemBranch.find({
      _id: { $in: updatedConfigs.map(c => c._id) }
    })
      .populate('menuItem')
      .populate('branch')
      .lean();

    return populatedConfigs;
  } catch (error) {
    logger.error('Error bulk updating branch configs:', error);
    throw error;
  }
};
