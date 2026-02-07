/**
 * Menu Item Service
 * Business logic for menu item management operations
 */

import { getCompanyDB } from '../config/database.js';
import { getMenuItemModel } from '../models/company/MenuItem.js';
import { getMenuCategoryModel } from '../models/company/MenuCategory.js';
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
 * Get menu item by ID
 * @param {string} menuItemId - Menu item ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Menu item
 */
export const getMenuItemById = async (menuItemId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuItem = getMenuItemModel(companyDB);
    const MenuCategory = getMenuCategoryModel(companyDB);

    const menuItem = await MenuItem.findById(menuItemId)
      .populate('category', 'name description color icon')
      .lean();

    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    return menuItem;
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

    const menuItem = await MenuItem.findByIdAndUpdate(
      menuItemId,
      { isActive: false },
      { new: true }
    );

    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    logger.info(`Menu item soft deleted: ${menuItemId} for company: ${companyId}`);

    return menuItem;
  } catch (error) {
    logger.error('Error deleting menu item:', error);
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
