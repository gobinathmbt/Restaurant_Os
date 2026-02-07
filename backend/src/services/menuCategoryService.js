/**
 * Menu Category Service
 * Business logic for menu category management operations
 */

import { getCompanyDB } from '../config/database.js';
import { getMenuCategoryModel } from '../models/company/MenuCategory.js';
import { getMenuItemModel } from '../models/company/MenuItem.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new menu category
 * @param {Object} categoryData - Category data
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Created category
 */
export const createMenuCategory = async (categoryData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuCategory = getMenuCategoryModel(companyDB);

    // Validate required fields
    if (!categoryData.name) {
      throw new Error('Category name is required');
    }

    // Check for duplicate category name
    const existingCategory = await MenuCategory.findOne({
      name: categoryData.name,
      isActive: true
    });

    if (existingCategory) {
      throw new Error('A category with this name already exists');
    }

    // Create category
    const category = new MenuCategory({
      ...categoryData,
      isActive: true
    });

    await category.save();

    logger.info(`Menu category created: ${category._id} for company: ${companyId}`);

    return category;
  } catch (error) {
    logger.error('Error creating menu category:', error);
    throw error;
  }
};

/**
 * Get menu categories with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated categories
 */
export const getMenuCategories = async (companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuCategory = getMenuCategoryModel(companyDB);
    const MenuItem = getMenuItemModel(companyDB);

    const {
      page = 1,
      limit = 10,
      search = '',
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
    // If isActive is empty string or not provided, show all

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [categories, total] = await Promise.all([
      MenuCategory.find(query)
        .sort({ displayOrder: 1, name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MenuCategory.countDocuments(query)
    ]);

    // Calculate menu item count for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const itemCount = await MenuItem.countDocuments({
          category: category._id,
          isActive: true
        });

        return {
          ...category,
          itemCount
        };
      })
    );

    return {
      categories: categoriesWithCounts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting menu categories:', error);
    throw error;
  }
};

/**
 * Get menu category by ID
 * @param {string} categoryId - Category ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Category
 */
export const getMenuCategoryById = async (categoryId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuCategory = getMenuCategoryModel(companyDB);
    const MenuItem = getMenuItemModel(companyDB);

    const category = await MenuCategory.findById(categoryId).lean();

    if (!category) {
      throw new Error('Category not found');
    }

    // Calculate menu item count
    const itemCount = await MenuItem.countDocuments({
      category: categoryId,
      isActive: true
    });

    return {
      ...category,
      itemCount
    };
  } catch (error) {
    logger.error('Error getting menu category by ID:', error);
    throw error;
  }
};

/**
 * Update menu category
 * @param {string} categoryId - Category ID
 * @param {Object} updateData - Update data
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated category
 */
export const updateMenuCategory = async (categoryId, updateData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuCategory = getMenuCategoryModel(companyDB);

    // Get existing category
    const existingCategory = await MenuCategory.findById(categoryId);
    if (!existingCategory) {
      throw new Error('Category not found');
    }

    // Check for duplicate name if name is being updated
    if (updateData.name && updateData.name !== existingCategory.name) {
      const duplicate = await MenuCategory.findOne({
        name: updateData.name,
        isActive: true,
        _id: { $ne: categoryId }
      });

      if (duplicate) {
        throw new Error('A category with this name already exists');
      }
    }

    // Update category
    Object.assign(existingCategory, updateData);
    await existingCategory.save();

    logger.info(`Menu category updated: ${categoryId} for company: ${companyId}`);

    return existingCategory;
  } catch (error) {
    logger.error('Error updating menu category:', error);
    throw error;
  }
};

/**
 * Delete menu category (soft delete)
 * @param {string} categoryId - Category ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Deleted category
 */
export const deleteMenuCategory = async (categoryId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuCategory = getMenuCategoryModel(companyDB);
    const MenuItem = getMenuItemModel(companyDB);

    const category = await MenuCategory.findById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // Check if category has associated menu items
    const itemCount = await MenuItem.countDocuments({
      category: categoryId,
      isActive: true
    });

    if (itemCount > 0) {
      throw new Error('Cannot delete category with associated menu items');
    }

    // Soft delete
    category.isActive = false;
    await category.save();

    logger.info(`Menu category soft deleted: ${categoryId} for company: ${companyId}`);

    return category;
  } catch (error) {
    logger.error('Error deleting menu category:', error);
    throw error;
  }
};
