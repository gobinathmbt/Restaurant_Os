/**
 * Menu Item Service
 * Business logic for menu item management operations
 */

import mongoose from 'mongoose';
import { getCompanyDB } from '../config/database.js';
import { getMenuItemModel } from '../models/company/MenuItem.js';
import { getMenuCategoryModel } from '../models/company/MenuCategory.js';
import { getMenuItemBranchModel } from '../models/company/MenuItemBranch.js';
import { getLocationModel } from '../models/company/Location.js';
import MenuCategoryBranchValidationService from './menuCategoryBranchValidationService.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new menu item (global definition)
 * @param {Object} menuItemData - Menu item data
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Created menu item
 */
export const createMenuItem = async (menuItemData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItem = getMenuItemModel(companyDB);
    const MenuCategory = getMenuCategoryModel(companyDB);

    // Validate required fields
    if (!menuItemData.name || !menuItemData.category || menuItemData.basePrice === undefined) {
      throw new Error('Menu item name, category, and base price are required');
    }

    // Validate name length (max 200 characters)
    if (menuItemData.name.length > 200) {
      throw new Error('Menu item name cannot exceed 200 characters');
    }

    // Validate price format (non-negative, max 2 decimals)
    if (menuItemData.basePrice < 0) {
      throw new Error('Base price cannot be negative');
    }

    // Check for max 2 decimal places
    const priceStr = menuItemData.basePrice.toString();
    if (priceStr.includes('.')) {
      const decimalPlaces = priceStr.split('.')[1].length;
      if (decimalPlaces > 2) {
        throw new Error('Base price cannot have more than 2 decimal places');
      }
    }

    // Validate category reference existence
    const category = await MenuCategory.findById(menuItemData.category);
    if (!category) {
      throw new Error('Selected category does not exist');
    }

    // Validate spice level range
    const validSpiceLevels = ['none', 'mild', 'medium', 'hot', 'extra_hot'];
    if (menuItemData.spiceLevel && !validSpiceLevels.includes(menuItemData.spiceLevel)) {
      throw new Error('Invalid spice level. Must be one of: none, mild, medium, hot, extra_hot');
    }

    // Create menu item
    const menuItem = new MenuItem({
      ...menuItemData,
      isActive: true
    });

    await menuItem.save();

    logger.info(`Menu item created: ${menuItem._id} for company: ${companyId}`);

    return menuItem;
  } catch (error) {
    logger.error('Error creating menu item:', error);
    throw error;
  }
};

/**
 * Get menu items with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options (page, limit, search, categoryId, isActive)
 * @returns {Promise<Object>} Paginated menu items
 */
export const getMenuItems = async (companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItem = getMenuItemModel(companyDB);
    const MenuCategory = getMenuCategoryModel(companyDB);

    const {
      page = 1,
      limit = 10,
      search = '',
      categoryId = '',
      isActive = ''
    } = filters;

    // Build query
    const query = {};

    // Active/Inactive filter
    if (isActive === 'true') {
      query.isActive = true;
    } else if (isActive === 'false') {
      query.isActive = false;
    }

    // Category filter
    if (categoryId) {
      query.category = categoryId;
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [menuItems, total] = await Promise.all([
      MenuItem.find(query)
        .populate('category', 'name description color icon')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MenuItem.countDocuments(query)
    ]);

    return {
      menuItems,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting menu items:', error);
    throw error;
  }
};

/**
 * Get menu item by ID with branch configurations
 * @param {string} menuItemId - Menu item ID
 * @param {string} companyId - Company ID
 * @param {string|null} branchId - Optional branch ID to filter (null returns all branches)
 * @param {Array|null} userBranchIds - User's accessible branches (null for super admin)
 * @returns {Promise<Object>} Menu item with branch configurations
 */
export const getMenuItemById = async (menuItemId, companyId, branchId = null, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItem = getMenuItemModel(companyDB);
    const MenuItemBranch = getMenuItemBranchModel(companyDB);
    const MenuCategory = getMenuCategoryModel(companyDB);
    // Register Location model on this connection before populate
    const Branch = getLocationModel(companyDB);
    
    const menuItem = await MenuItem.findById(menuItemId)
      .populate('category', 'name description color icon')
      .lean();

    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    // Build query for branch configurations
    const branchQuery = { menuItem: menuItemId, isActive: true };
    
    // If specific branch is requested, filter by that branch
    if (branchId) {
      branchQuery.branch = branchId;
    }
    
    // NOTE: We don't filter by userBranchIds here because we want users to see
    // ALL branches where the menu item exists (for visibility), even if they
    // can only edit their own branches. The edit permission is enforced at the
    // update/delete endpoints, not at the read endpoint.

    // Fetch branch configurations
    const branchConfigs = await MenuItemBranch.find(branchQuery)
      .populate('branch', 'name code address')
      .populate('addOns', 'name basePrice description') // Populate add-ons with menu item details
      .lean();

    // Return menu item with branch configurations
    return {
      ...menuItem,
      branches: branchConfigs
    };
  } catch (error) {
    logger.error('Error getting menu item by ID:', error);
    throw error;
  }
};

/**
 * Update menu item (global properties)
 * @param {string} menuItemId - Menu item ID
 * @param {Object} updateData - Update data
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated menu item
 */
export const updateMenuItem = async (menuItemId, updateData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItem = getMenuItemModel(companyDB);
    const MenuCategory = getMenuCategoryModel(companyDB);

    // Get existing menu item
    const existingMenuItem = await MenuItem.findById(menuItemId);
    if (!existingMenuItem) {
      throw new Error('Menu item not found');
    }

    // Validate name length if being updated
    if (updateData.name && updateData.name.length > 200) {
      throw new Error('Menu item name cannot exceed 200 characters');
    }

    // Validate price format if being updated
    if (updateData.basePrice !== undefined) {
      if (updateData.basePrice < 0) {
        throw new Error('Base price cannot be negative');
      }

      // Check for max 2 decimal places
      const priceStr = updateData.basePrice.toString();
      if (priceStr.includes('.')) {
        const decimalPlaces = priceStr.split('.')[1].length;
        if (decimalPlaces > 2) {
          throw new Error('Base price cannot have more than 2 decimal places');
        }
      }
    }

    // Validate category reference if being updated
    if (updateData.category) {
      const category = await MenuCategory.findById(updateData.category);
      if (!category) {
        throw new Error('Selected category does not exist');
      }
      
      logger.info(`Validated category for menu item update: ${category._id} (${category.name})`);
      
      // If category is changing, auto-assign new category to all branches where this menu item exists
      if (updateData.category !== existingMenuItem.category.toString()) {
        logger.info(`Menu item ${menuItemId} category changing from ${existingMenuItem.category} to ${updateData.category}`);
        
        // Get all branches where this menu item is assigned
        const MenuItemBranch = getMenuItemBranchModel(companyDB);
        const branchAssignments = await MenuItemBranch.find({
          menuItem: menuItemId,
          isActive: true
        }).select('branch').lean();
        
        logger.info(`Menu item has ${branchAssignments.length} branch assignment(s)`);
        
        if (branchAssignments.length > 0) {
          const branchIds = branchAssignments.map(a => a.branch.toString());
          logger.info(`Auto-assigning new category ${updateData.category} to branches: ${branchIds.join(', ')}`);
          
          // Auto-assign new category to these branches
          const validationService = new MenuCategoryBranchValidationService(companyDB);
          const assignmentResult = await validationService.assignCategoryToBranches(
            branchIds,
            updateData.category,
            'system', // userId - using 'system' for automatic updates
            'menu_item_category_update',
            null // no session for simple updates
          );
          
          logger.info(`Category assignment result:`, assignmentResult);
        } else {
          logger.info(`⚠️  Menu item ${menuItemId} has no branch assignments yet. Category will be auto-assigned when branches are added via bulkUpdateBranchConfigs.`);
        }
      }
    }

    // Validate spice level if being updated
    if (updateData.spiceLevel) {
      const validSpiceLevels = ['none', 'mild', 'medium', 'hot', 'extra_hot'];
      if (!validSpiceLevels.includes(updateData.spiceLevel)) {
        throw new Error('Invalid spice level. Must be one of: none, mild, medium, hot, extra_hot');
      }
    }

    // Update menu item
    Object.assign(existingMenuItem, updateData);
    await existingMenuItem.save();

    logger.info(`Menu item updated: ${menuItemId} for company: ${companyId}`);

    return existingMenuItem;
  } catch (error) {
    logger.error('Error updating menu item:', error);
    throw error;
  }
};

/**
 * Delete menu item (soft delete)
 * @param {string} menuItemId - Menu item ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Deleted menu item
 */
export const deleteMenuItem = async (menuItemId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItem = getMenuItemModel(companyDB);

    // Get menu item first to access images
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    // Soft delete the menu item
    menuItem.isActive = false;
    await menuItem.save();

    // Delete all images from S3 (async, don't wait for it)
    if (menuItem.images && menuItem.images.length > 0) {
      import('./imageUploadService.js').then(({ deleteImageFromS3 }) => {
        menuItem.images.forEach(image => {
          deleteImageFromS3(image.url).catch(err => {
            logger.warn(`Failed to delete image from S3: ${image.url}`, err);
          });
        });
      });
    }

    logger.info(`Menu item soft deleted: ${menuItemId} for company: ${companyId}`);

    return menuItem;
  } catch (error) {
    logger.error('Error deleting menu item:', error);
    throw error;
  }
};

/**
 * Permanently delete menu item and all branch configurations
 * @param {string} menuItemId - Menu item ID
 * @param {string} companyId - Company ID
 * @returns {Promise<void>}
 */
export const permanentlyDeleteMenuItem = async (menuItemId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItem = getMenuItemModel(companyDB);
    const MenuItemBranch = getMenuItemBranchModel(companyDB);

    // Get menu item first to access images
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    // Delete all branch configurations first
    await MenuItemBranch.deleteMany({ menuItem: menuItemId });
    logger.info(`Deleted all branch configurations for menu item: ${menuItemId}`);

    // Delete all images from S3 (async, don't wait for it)
    if (menuItem.images && menuItem.images.length > 0) {
      import('./imageUploadService.js').then(({ deleteImageFromS3 }) => {
        menuItem.images.forEach(image => {
          deleteImageFromS3(image.url).catch(err => {
            logger.warn(`Failed to delete image from S3: ${image.url}`, err);
          });
        });
      });
    }

    // Permanently delete the menu item
    await MenuItem.findByIdAndDelete(menuItemId);

    logger.info(`Menu item permanently deleted: ${menuItemId} for company: ${companyId}`);
  } catch (error) {
    logger.error('Error permanently deleting menu item:', error);
    throw error;
  }
};

/**
 * Toggle menu item active status
 * @param {string} menuItemId - Menu item ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated menu item
 */
export const toggleMenuItemStatus = async (menuItemId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItem = getMenuItemModel(companyDB);

    // Get menu item
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    // Toggle isActive status
    menuItem.isActive = !menuItem.isActive;
    await menuItem.save();

    logger.info(`Menu item status toggled: ${menuItemId}, new status: ${menuItem.isActive}, company: ${companyId}`);

    return menuItem;
  } catch (error) {
    logger.error('Error toggling menu item status:', error);
    throw error;
  }
};

/**
 * Add image to menu item
 * @param {string} menuItemId - Menu item ID
 * @param {string} imageUrl - S3 image URL
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated menu item
 */
export const addImageToMenuItem = async (menuItemId, imageUrl, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItem = getMenuItemModel(companyDB);

    // Validate image URL
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error('Valid image URL is required');
    }

    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    // Calculate display order (next in sequence)
    const displayOrder = menuItem.images.length;

    // Add image to array
    menuItem.images.push({
      url: imageUrl,
      displayOrder,
      uploadedAt: new Date()
    });

    await menuItem.save();

    logger.info(`Image added to menu item: ${menuItemId} for company: ${companyId}`);

    return menuItem;
  } catch (error) {
    logger.error('Error adding image to menu item:', error);
    throw error;
  }
};

/**
 * Remove image from menu item
 * @param {string} menuItemId - Menu item ID
 * @param {string} imageUrl - Image URL to remove
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated menu item
 */
export const removeImageFromMenuItem = async (menuItemId, imageUrl, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItem = getMenuItemModel(companyDB);

    // Validate image URL
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error('Valid image URL is required');
    }

    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    // Find and remove the image
    const imageIndex = menuItem.images.findIndex(img => img.url === imageUrl);
    if (imageIndex === -1) {
      throw new Error('Image not found in menu item');
    }

    menuItem.images.splice(imageIndex, 1);

    // Reorder remaining images
    menuItem.images.forEach((img, index) => {
      img.displayOrder = index;
    });

    await menuItem.save();

    // Delete image from S3 (async, don't wait for it)
    // Import dynamically to avoid circular dependencies
    import('./imageUploadService.js').then(({ deleteImageFromS3 }) => {
      deleteImageFromS3(imageUrl).catch(err => {
        logger.warn(`Failed to delete image from S3: ${imageUrl}`, err);
      });
    });

    logger.info(`Image removed from menu item: ${menuItemId} for company: ${companyId}`);

    return menuItem;
  } catch (error) {
    logger.error('Error removing image from menu item:', error);
    throw error;
  }
};

/**
 * Reorder images for menu item
 * @param {string} menuItemId - Menu item ID
 * @param {Array} imageOrder - Array of { url, displayOrder }
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated menu item
 */
export const reorderMenuItemImages = async (menuItemId, imageOrder, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItem = getMenuItemModel(companyDB);

    // Validate imageOrder array
    if (!Array.isArray(imageOrder) || imageOrder.length === 0) {
      throw new Error('Image order array is required');
    }

    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    // Validate that all URLs in imageOrder exist in menu item
    const existingUrls = menuItem.images.map(img => img.url);
    const orderUrls = imageOrder.map(item => item.url);

    const invalidUrls = orderUrls.filter(url => !existingUrls.includes(url));
    if (invalidUrls.length > 0) {
      throw new Error('One or more image URLs not found in menu item');
    }

    // Validate that imageOrder contains all images
    if (orderUrls.length !== existingUrls.length) {
      throw new Error('Image order must include all images');
    }

    // Update display order for each image
    imageOrder.forEach(orderItem => {
      const image = menuItem.images.find(img => img.url === orderItem.url);
      if (image) {
        image.displayOrder = orderItem.displayOrder;
      }
    });

    // Sort images by display order
    menuItem.images.sort((a, b) => a.displayOrder - b.displayOrder);

    await menuItem.save();

    logger.info(`Images reordered for menu item: ${menuItemId} for company: ${companyId}`);

    return menuItem;
  } catch (error) {
    logger.error('Error reordering menu item images:', error);
    throw error;
  }
};

/**
 * Validate if user has access to a specific branch
 * @param {string} branchId - Branch ID to check
 * @param {Array|null} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {boolean} True if user has access, false otherwise
 */
export const validateBranchAccess = (branchId, userBranchIds) => {
  // Super admins (null or undefined userBranchIds) have access to all branches
  if (userBranchIds === null || userBranchIds === undefined) {
    return true;
  }

  // Check if branch is in user's accessible branches
  return userBranchIds.includes(branchId.toString());
};

/**
 * Create menu item with branch assignments
 * @param {Object} menuItemData - Menu item data
 * @param {Array} branchConfigs - Array of { branchId, ...config }
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID for audit logging
 * @param {Array|null} userBranchIds - User's accessible branches (null for super admin)
 * @returns {Promise<Object>} Created menu item with branch configs
 */
export const createMenuItemWithBranches = async (
  menuItemData,
  branchConfigs,
  companyId,
  userId,
  userBranchIds = null
) => {
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
    const MenuItem = getMenuItemModel(companyDB);
    const MenuCategory = getMenuCategoryModel(companyDB);
    const MenuItemBranch = getMenuItemBranchModel(companyDB);

    // Validate required fields
    if (!menuItemData.name || !menuItemData.category || menuItemData.basePrice === undefined) {
      throw new Error('Menu item name, category, and base price are required');
    }

    if (!branchConfigs || !Array.isArray(branchConfigs) || branchConfigs.length === 0) {
      throw new Error('At least one branch configuration is required');
    }

    // Validate name length (max 200 characters)
    if (menuItemData.name.length > 200) {
      throw new Error('Menu item name cannot exceed 200 characters');
    }

    // Validate price format (non-negative, max 2 decimals)
    if (menuItemData.basePrice < 0) {
      throw new Error('Base price cannot be negative');
    }

    // Check for max 2 decimal places
    const priceStr = menuItemData.basePrice.toString();
    if (priceStr.includes('.')) {
      const decimalPlaces = priceStr.split('.')[1].length;
      if (decimalPlaces > 2) {
        throw new Error('Base price cannot have more than 2 decimal places');
      }
    }

    // Validate category reference existence
    const categoryQuery = MenuCategory.findById(menuItemData.category);
    if (session) categoryQuery.session(session);
    const category = await categoryQuery;
    
    if (!category) {
      throw new Error('Selected category does not exist');
    }

    // Validate spice level range
    const validSpiceLevels = ['none', 'mild', 'medium', 'hot', 'extra_hot'];
    if (menuItemData.spiceLevel && !validSpiceLevels.includes(menuItemData.spiceLevel)) {
      throw new Error('Invalid spice level. Must be one of: none, mild, medium, hot, extra_hot');
    }

    // 1. Validate branch access for all branches
    for (const config of branchConfigs) {
      if (!config.branchId) {
        throw new Error('Branch ID is required in branch configuration');
      }

      if (!validateBranchAccess(config.branchId, userBranchIds)) {
        throw new Error(`No access to branch: ${config.branchId}`);
      }
    }

    // 2. Create menu item
    let menuItem;
    if (session) {
      menuItem = await MenuItem.create(
        [{
          ...menuItemData,
          isActive: true
        }],
        { session }
      );
    } else {
      menuItem = [await MenuItem.create({
        ...menuItemData,
        isActive: true
      })];
    }

    // 3. Auto-assign category to branches if needed
    const categoryId = menuItemData.category;
    const branchIds = branchConfigs.map(c => c.branchId);

    logger.info(`Auto-assigning menu category ${categoryId} to branches: ${branchIds.join(', ')}`);

    const validationService = new MenuCategoryBranchValidationService(companyDB);
    
    const assignmentResult = await validationService.assignCategoryToBranches(
      branchIds,
      categoryId,
      userId,
      'menu_item_assignment',
      session
    );

    logger.info(`Category assignment result:`, assignmentResult);

    // 4. Create branch configurations
    const branchConfigDocs = branchConfigs.map(config => ({
      menuItem: menuItem[0]._id,
      branch: config.branchId,
      price: config.price !== undefined ? config.price : menuItemData.basePrice,
      isAvailable: config.isAvailable !== undefined ? config.isAvailable : true,
      preparationTime: config.preparationTime !== undefined ? config.preparationTime : 15,
      requiresKitchen: config.requiresKitchen !== undefined ? config.requiresKitchen : true,
      outOfStock: config.outOfStock !== undefined ? config.outOfStock : false,
      lowStockThreshold: config.lowStockThreshold,
      taxRateOverride: config.taxRateOverride,
      displayOrder: config.displayOrder !== undefined ? config.displayOrder : 0,
      channels: config.channels || ['dine_in', 'takeaway', 'online'],
      timeBasedPricing: config.timeBasedPricing || [],
      availability: config.availability || { schedule: [] },
      isActive: true
    }));

    if (session) {
      await MenuItemBranch.insertMany(branchConfigDocs, { session });
    } else {
      await MenuItemBranch.insertMany(branchConfigDocs);
    }

    if (session) {
      await session.commitTransaction();
    }

    logger.info(`Menu item created with branches: ${menuItem[0]._id} for company: ${companyId}`);

    return {
      menuItem: menuItem[0],
      branchConfigs: branchConfigDocs
    };
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    logger.error('Error creating menu item with branches:', error);
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

