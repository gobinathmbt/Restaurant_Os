/**
 * Category Service
 * Business logic for category management operations
 */

import { getCompanyDB } from '../config/database.js';
import { getCategoryModel } from '../models/company/Category.js';
import { getBranchModel } from '../models/company/Branch.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new category
 * @param {Object} categoryData - Category data
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (for company_admin)
 * @returns {Promise<Object>} Created category
 */
export const createCategory = async (categoryData, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Category = getCategoryModel(companyDB);
    // Ensure Branch model is registered for population
    getBranchModel(companyDB);

    // Validate required fields
    if (!categoryData.name || !categoryData.branchId) {
      throw new Error('Category name and branch are required');
    }

    // If user is company_admin, validate they have access to the branch
    if (userBranchIds && userBranchIds.length > 0) {
      if (!userBranchIds.includes(categoryData.branchId.toString())) {
        throw new Error('You do not have access to this branch');
      }
    }

    // Check for duplicate category name in the same branch
    const existingCategory = await Category.findOne({
      name: categoryData.name,
      branchId: categoryData.branchId,
      parent: categoryData.parent || null
    });

    if (existingCategory) {
      throw new Error('A category with this name already exists in this branch');
    }

    // Create category
    const category = new Category({
      ...categoryData,
      parent: categoryData.parent || null,
      isActive: true
    });

    await category.save();

    logger.info(`Category created: ${category._id} for company: ${companyId}`);

    return category;
  } catch (error) {
    logger.error('Error creating category:', error);
    throw error;
  }
};

/**
 * Get categories with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @param {Array} userBranchIds - User's accessible branch IDs (for company_admin)
 * @returns {Promise<Object>} Paginated categories
 */
export const getCategories = async (companyId, filters = {}, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Category = getCategoryModel(companyDB);
    // Ensure Branch model is registered for population
    getBranchModel(companyDB);

    const {
      page = 1,
      limit = 10,
      search = '',
      branchId = '',
      type = '',
      isActive = true,
      parentId = ''
    } = filters;

    // Build query
    const query = {
      isActive: isActive === 'false' ? false : true
    };

    // Branch filtering
    if (branchId) {
      query.branchId = branchId;
    } else if (userBranchIds && userBranchIds.length > 0) {
      // For company_admin, only show categories from their branches
      query.branchId = { $in: userBranchIds };
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Type filter
    if (type) {
      query.type = type;
    }

    // Parent filter
    if (parentId === 'null' || parentId === '') {
      query.parent = null;
    } else if (parentId) {
      query.parent = parentId;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [categories, total] = await Promise.all([
      Category.find(query)
        .populate('branchId', 'name code')
        .populate('parent', 'name')
        .sort({ displayOrder: 1, name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Category.countDocuments(query)
    ]);

    return {
      categories,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting categories:', error);
    throw error;
  }
};

/**
 * Get category by ID
 * @param {string} categoryId - Category ID
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (for company_admin)
 * @returns {Promise<Object>} Category
 */
export const getCategoryById = async (categoryId, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Category = getCategoryModel(companyDB);
    // Ensure Branch model is registered for population
    getBranchModel(companyDB);

    const category = await Category.findById(categoryId)
      .populate('branchId', 'name code')
      .populate('parent', 'name')
      .lean();

    if (!category) {
      throw new Error('Category not found');
    }

    // If user is company_admin, verify they have access to the category's branch
    if (userBranchIds && userBranchIds.length > 0) {
      if (!userBranchIds.includes(category.branchId._id.toString())) {
        throw new Error('You do not have access to this category');
      }
    }

    return category;
  } catch (error) {
    logger.error('Error getting category by ID:', error);
    throw error;
  }
};

/**
 * Update category
 * @param {string} categoryId - Category ID
 * @param {Object} updateData - Update data
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (for company_admin)
 * @returns {Promise<Object>} Updated category
 */
export const updateCategory = async (categoryId, updateData, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Category = getCategoryModel(companyDB);
    // Ensure Branch model is registered for population
    getBranchModel(companyDB);

    // Get existing category
    const existingCategory = await Category.findById(categoryId);
    if (!existingCategory) {
      throw new Error('Category not found');
    }

    // If user is company_admin, verify they have access
    if (userBranchIds && userBranchIds.length > 0) {
      if (!userBranchIds.includes(existingCategory.branchId.toString())) {
        throw new Error('You do not have access to this category');
      }

      // If updating branchId, validate new branch access
      if (updateData.branchId && updateData.branchId !== existingCategory.branchId.toString()) {
        if (!userBranchIds.includes(updateData.branchId.toString())) {
          throw new Error('You do not have access to the target branch');
        }
      }
    }

    // Check for duplicate name if name is being updated
    if (updateData.name && updateData.name !== existingCategory.name) {
      const duplicate = await Category.findOne({
        name: updateData.name,
        branchId: updateData.branchId || existingCategory.branchId,
        parent: updateData.parent !== undefined ? updateData.parent : existingCategory.parent,
        _id: { $ne: categoryId }
      });

      if (duplicate) {
        throw new Error('A category with this name already exists in this branch');
      }
    }

    // Update category
    Object.assign(existingCategory, updateData);
    await existingCategory.save();

    logger.info(`Category updated: ${categoryId} for company: ${companyId}`);

    return existingCategory;
  } catch (error) {
    logger.error('Error updating category:', error);
    throw error;
  }
};

/**
 * Delete category (soft delete)
 * @param {string} categoryId - Category ID
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (for company_admin)
 * @returns {Promise<Object>} Deleted category
 */
export const deleteCategory = async (categoryId, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Category = getCategoryModel(companyDB);
    // Ensure Branch model is registered for population
    getBranchModel(companyDB);

    const category = await Category.findById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // If user is company_admin, verify they have access
    if (userBranchIds && userBranchIds.length > 0) {
      if (!userBranchIds.includes(category.branchId.toString())) {
        throw new Error('You do not have access to this category');
      }
    }

    // Check if category has subcategories
    const subcategories = await Category.find({ parent: categoryId });
    if (subcategories.length > 0) {
      throw new Error('Cannot delete category with subcategories. Please delete subcategories first.');
    }

    // Soft delete
    category.isActive = false;
    await category.save();

    logger.info(`Category soft deleted: ${categoryId} for company: ${companyId}`);

    return category;
  } catch (error) {
    logger.error('Error deleting category:', error);
    throw error;
  }
};

/**
 * Get category tree for a branch
 * @param {string} branchId - Branch ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Category tree
 */
export const getCategoryTree = async (branchId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Category = getCategoryModel(companyDB);
    // Ensure Branch model is registered for population
    getBranchModel(companyDB);

    const tree = await Category.getTree(branchId);

    return tree;
  } catch (error) {
    logger.error('Error getting category tree:', error);
    throw error;
  }
};

/**
 * Reorder categories
 * @param {Array} updates - Array of { categoryId, displayOrder }
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (for company_admin)
 * @returns {Promise<void>}
 */
export const reorderCategories = async (updates, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Category = getCategoryModel(companyDB);
    // Ensure Branch model is registered for population
    getBranchModel(companyDB);

    // Validate all categories exist and user has access
    for (const update of updates) {
      const category = await Category.findById(update.categoryId);
      
      if (!category) {
        throw new Error(`Category ${update.categoryId} not found`);
      }

      // If user is company_admin, verify they have access
      if (userBranchIds && userBranchIds.length > 0) {
        if (!userBranchIds.includes(category.branchId.toString())) {
          throw new Error('You do not have access to one or more categories');
        }
      }
    }

    // Update display orders
    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: { _id: update.categoryId },
        update: { $set: { displayOrder: update.displayOrder } }
      }
    }));

    await Category.bulkWrite(bulkOps);

    logger.info(`Reordered ${updates.length} categories for company: ${companyId}`);
  } catch (error) {
    logger.error('Error reordering categories:', error);
    throw error;
  }
};
