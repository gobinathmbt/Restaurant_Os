/**
 * Menu Category Service
 * Business logic for menu category management operations
 */

import { getCompanyDB } from '../config/database.js';
import { getMenuCategoryModel } from '../models/company/MenuCategory.js';
import { getMenuItemModel } from '../models/company/MenuItem.js';
import { getMenuItemBranchModel } from '../models/company/MenuItemBranch.js';
import { getLocationModel } from '../models/company/Location.js';
import MenuCategoryBranchValidationService from './menuCategoryBranchValidationService.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new menu category
 * @param {Object} categoryData - Category data
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (for validation)
 * @returns {Promise<Object>} Created category
 */
export const createMenuCategory = async (categoryData, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuCategory = getMenuCategoryModel(companyDB);

    // Validate required fields
    if (!categoryData.name) {
      throw new Error('Category name is required');
    }

    if (!categoryData.branchIds || categoryData.branchIds.length === 0) {
      throw new Error('At least one branch must be selected');
    }

    // Validate branch access if userBranchIds provided (not super admin)
    if (userBranchIds !== null && userBranchIds !== undefined && userBranchIds.length > 0) {
      const invalidBranches = categoryData.branchIds.filter(
        branchId => !userBranchIds.includes(branchId.toString())
      );
      if (invalidBranches.length > 0) {
        throw new Error('You do not have access to one or more selected branches');
      }
    }
    // Super admins (userBranchIds === null) can access all branches

    // Check for duplicate category name in the same branches
    const existingCategory = await MenuCategory.findOne({
      name: categoryData.name,
      branchIds: { $in: categoryData.branchIds },
      isActive: true
    });

    if (existingCategory) {
      throw new Error('A category with this name already exists in one or more selected branches');
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
 * @param {Array} userBranchIds - User's accessible branch IDs (for filtering)
 * @returns {Promise<Object>} Paginated categories
 */
export const getMenuCategories = async (companyId, filters = {}, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuCategory = getMenuCategoryModel(companyDB);
    const MenuItem = getMenuItemModel(companyDB);
    // Register Location model on this connection before populate
    const Branch = getLocationModel(companyDB);

    const {
      page = 1,
      limit = 10,
      search = '',
      isActive = '',
      branchId = ''
    } = filters;

    // Build query
    const query = {};

    // Branch filter
    if (branchId) {
      // Check if branchIds array contains the specified branchId
      query.branchIds = { $in: [branchId] };
    } else if (userBranchIds !== null && userBranchIds !== undefined && userBranchIds.length > 0) {
      // Filter by user's accessible branches (only for non-super admins)
      query.branchIds = { $in: userBranchIds };
    }
    // If userBranchIds is null (super admin) and no branchId filter, show all categories

    // Active/Inactive filter
    if (isActive === 'true' || isActive === true) {
      query.isActive = true;
    } else if (isActive === 'false' || isActive === false) {
      query.isActive = false;
    }
    // If isActive is empty string or not provided, show all

    // Log query for debugging
    logger.info('Menu categories query:', { query, userBranchIds, filters });

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
        .populate('branchIds', 'name code')
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
 * Validate if a branch can be removed from a category
 * @param {string} categoryId - Category ID
 * @param {string} branchId - Branch ID to remove
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Validation result with canRemove flag, count, and message
 */
export const validateBranchRemovalForCategory = async (categoryId, branchId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    
    // Use validation service
    const validationService = new MenuCategoryBranchValidationService(companyDB);

    // Use the validation service
    const validation = await validationService.validateBranchRemoval(categoryId, branchId);

    if (!validation.canRemove) {
      // Get menu item names for better error message
      const menuItemNames = validation.dependencies.items
        .slice(0, 5)
        .map(item => item.name)
        .join(', ');
      
      const moreItems = validation.dependencies.items.length > 5 
        ? ` and ${validation.dependencies.items.length - 5} more` 
        : '';
      
      return {
        canRemove: false,
        count: validation.dependencies.count,
        message: validation.message + ` Menu items: ${menuItemNames}${moreItems}.`,
        menuItems: validation.dependencies.items
      };
    }

    return {
      canRemove: true,
      count: 0
    };
  } catch (error) {
    logger.error('Error validating branch removal for category:', error);
    throw error;
  }
};

/**
 * Update menu category
 * @param {string} categoryId - Category ID
 * @param {Object} updateData - Update data
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (for validation)
 * @returns {Promise<Object>} Updated category
 */
export const updateMenuCategory = async (categoryId, updateData, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const MenuCategory = getMenuCategoryModel(companyDB);

    // Get existing category
    const existingCategory = await MenuCategory.findById(categoryId);
    if (!existingCategory) {
      throw new Error('Category not found');
    }

    // NEW: Validate branch removal if branchIds are being updated
    if (updateData.branchIds) {
      const removedBranches = existingCategory.branchIds.filter(
        branchId => !updateData.branchIds.includes(branchId.toString())
      );

      // Validate each removed branch
      for (const branchId of removedBranches) {
        const validation = await validateBranchRemovalForCategory(
          categoryId,
          branchId,
          companyId
        );

        if (!validation.canRemove) {
          throw new Error(validation.message);
        }
      }
    }

    // Validate branch access if userBranchIds provided and branchIds are being updated
    // Super admins (userBranchIds === null) can access all branches
    if (updateData.branchIds && userBranchIds !== null && userBranchIds !== undefined && userBranchIds.length > 0) {
      const invalidBranches = updateData.branchIds.filter(
        branchId => !userBranchIds.includes(branchId.toString())
      );
      if (invalidBranches.length > 0) {
        throw new Error('You do not have access to one or more selected branches');
      }
    }

    // Check for duplicate name if name is being updated
    if (updateData.name && updateData.name !== existingCategory.name) {
      const branchesToCheck = updateData.branchIds || existingCategory.branchIds;
      const duplicate = await MenuCategory.findOne({
        name: updateData.name,
        branchIds: { $in: branchesToCheck },
        isActive: true,
        _id: { $ne: categoryId }
      });

      if (duplicate) {
        throw new Error('A category with this name already exists in one or more selected branches');
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
    
    // Use validation service
    const validationService = new MenuCategoryBranchValidationService(companyDB);

    const category = await MenuCategory.findById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // Validate category deletion using the validation service
    const validation = await validationService.validateCategoryDeletion(categoryId);

    if (!validation.canDelete) {
      // Get menu item names for better error message
      const menuItemNames = validation.dependencies.items
        .slice(0, 5)
        .map(item => item.name)
        .join(', ');
      
      const moreItems = validation.dependencies.items.length > 5 
        ? ` and ${validation.dependencies.items.length - 5} more` 
        : '';
      
      throw new Error(
        `Cannot delete category "${category.name}". It is being used by the following menu items: ${menuItemNames}${moreItems}. ` +
        `Total: ${validation.dependencies.items.length} menu item(s) across ${validation.dependencies.count} branch assignment(s).`
      );
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

