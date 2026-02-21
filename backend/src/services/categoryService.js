/**
 * Category Service
 * Business logic for category management operations
 */

import { getCompanyDB } from '../config/database.js';
import { getCategoryModel } from '../models/company/Category.js';
import { getLocationModel } from '../models/company/Location.js';
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
    // Ensure Location model is registered for population
    getLocationModel(companyDB);

    // Validate required fields
    if (!categoryData.name || !categoryData.branchIds || categoryData.branchIds.length === 0) {
      throw new Error('Category name and at least one branch are required');
    }

    // If user is company_admin, validate they have access to all selected branches
    if (userBranchIds && userBranchIds.length > 0) {
      const invalidBranches = categoryData.branchIds.filter(
        branchId => !userBranchIds.includes(branchId.toString())
      );
      
      if (invalidBranches.length > 0) {
        throw new Error('You do not have access to one or more selected branches');
      }
    }

    // Check for duplicate category name (global check, not per branch)
    const existingCategory = await Category.findOne({
      name: categoryData.name,
      parent: categoryData.parent || null
    });

    if (existingCategory) {
      throw new Error('A category with this name already exists');
    }

    // Create category
    const category = new Category({
      ...categoryData,
      parent: categoryData.parent || null,
      isActive: true
    });

    await category.save();

    // Populate branches for response
    await category.populate('branchIds', 'name code');

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
    // Ensure Location model is registered for population
    getLocationModel(companyDB);

    const {
      page = 1,
      limit = 10,
      search = '',
      branchId = '',
      branchIds = '',
      type = '',
      isActive = '',
      parentId = ''
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

    // Branch filtering - handle both single branchId and multiple branchIds
    let targetBranchIds = [];
    
    // Check for branchIds (comma-separated or array)
    if (branchIds && branchIds !== 'all') {
      if (typeof branchIds === 'string') {
        // Handle comma-separated string
        targetBranchIds = branchIds.split(',').map(id => id.trim()).filter(id => id);
      } else if (Array.isArray(branchIds)) {
        // Handle array
        targetBranchIds = branchIds;
      }
    }
    // Fallback to single branchId for backward compatibility
    else if (branchId && branchId !== 'all') {
      if (typeof branchId === 'string' && branchId.includes(',')) {
        // Handle comma-separated string in branchId
        targetBranchIds = branchId.split(',').map(id => id.trim()).filter(id => id);
      } else {
        targetBranchIds = [branchId];
      }
    }

    // Apply branch filter
    if (targetBranchIds.length > 0) {
      query.branchIds = targetBranchIds.length === 1 ? targetBranchIds[0] : { $in: targetBranchIds };
    } else if (userBranchIds && userBranchIds.length > 0) {
      // For company_admin, only show categories that have at least one of their branches
      query.branchIds = { $in: userBranchIds };
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
        .populate('branchIds', 'name code')
        .populate('parent', 'name')
        .sort({ displayOrder: 1, name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Category.countDocuments(query)
    ]);

    // Filter categories based on user's branch access for editing
    const categoriesWithPermissions = categories.map(category => {
      let editableBranches = category.branchIds || [];
      
      // If user is company_admin, only show branches they have access to
      if (userBranchIds && userBranchIds.length > 0) {
        editableBranches = editableBranches.filter(branch => 
          branch && branch._id && userBranchIds.includes(branch._id.toString())
        );
      }
      
      // Super admin can always edit (userBranchIds is null/empty)
      // Company admin can edit if they have access to at least one branch
      const canEdit = (!userBranchIds || userBranchIds.length === 0) || editableBranches.length > 0;
      
      return {
        ...category,
        editableBranches,
        canEdit
      };
    });

    return {
      categories: categoriesWithPermissions,
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
    // Ensure Location model is registered for population
    getLocationModel(companyDB);

    const category = await Category.findById(categoryId)
      .populate('branchIds', 'name code')
      .populate('parent', 'name')
      .lean();

    if (!category) {
      throw new Error('Category not found');
    }

    // Determine which branches the user can edit
    let editableBranches = category.branchIds || [];
    
    // If user is company_admin, filter to only their accessible branches
    if (userBranchIds && userBranchIds.length > 0) {
      editableBranches = editableBranches.filter(branch => 
        branch && branch._id && userBranchIds.includes(branch._id.toString())
      );
      
      // User must have access to at least one branch to view the category
      if (editableBranches.length === 0) {
        throw new Error('You do not have access to this category');
      }
    }

    // Super admin can always edit (userBranchIds is null/empty)
    // Company admin can edit if they have access to at least one branch
    const canEdit = (!userBranchIds || userBranchIds.length === 0) || editableBranches.length > 0;

    return {
      ...category,
      editableBranches,
      canEdit
    };
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
    // Ensure Location model is registered for population
    getLocationModel(companyDB);

    // Get existing category
    const existingCategory = await Category.findById(categoryId);
    if (!existingCategory) {
      throw new Error('Category not found');
    }

    // Determine which branches the user can edit
    let editableBranchIds = existingCategory.branchIds.map(id => id.toString());
    
    // If user is company_admin, filter to only their accessible branches
    if (userBranchIds && userBranchIds.length > 0) {
      editableBranchIds = existingCategory.branchIds
        .map(id => id.toString())
        .filter(branchId => userBranchIds.includes(branchId));
      
      if (editableBranchIds.length === 0) {
        throw new Error('You do not have access to edit this category');
      }
    }

    // If updating branchIds, validate access
    if (updateData.branchIds) {
      // Super admins can update all branches
      if (!userBranchIds || userBranchIds.length === 0) {
        // Super admin - can set any branches
        editableBranchIds = updateData.branchIds;
      } else {
        // Company admin - can only update branches they have access to
        // Keep existing branches they don't have access to
        const existingInaccessibleBranches = existingCategory.branchIds
          .map(id => id.toString())
          .filter(branchId => !userBranchIds.includes(branchId));
        
        // Validate new branches
        const newBranches = updateData.branchIds.filter(
          branchId => !existingInaccessibleBranches.includes(branchId)
        );
        
        const invalidBranches = newBranches.filter(
          branchId => !userBranchIds.includes(branchId)
        );
        
        if (invalidBranches.length > 0) {
          throw new Error('You do not have access to one or more selected branches');
        }
        
        // Merge: keep inaccessible branches + add new accessible branches
        updateData.branchIds = [...existingInaccessibleBranches, ...newBranches];
      }
    }

    // Check for duplicate name if name is being updated
    if (updateData.name && updateData.name !== existingCategory.name) {
      const duplicate = await Category.findOne({
        name: updateData.name,
        parent: updateData.parent !== undefined ? updateData.parent : existingCategory.parent,
        _id: { $ne: categoryId }
      });

      if (duplicate) {
        throw new Error('A category with this name already exists');
      }
    }

    // Update category
    Object.assign(existingCategory, updateData);
    await existingCategory.save();

    // Populate for response
    await existingCategory.populate('branchIds', 'name code');
    await existingCategory.populate('parent', 'name');

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
    // Ensure Location model is registered for population
    getLocationModel(companyDB);

    const category = await Category.findById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // If user is company_admin, verify they have access to at least one branch
    if (userBranchIds && userBranchIds.length > 0) {
      const hasAccess = category.branchIds.some(branchId => 
        userBranchIds.includes(branchId.toString())
      );
      
      if (!hasAccess) {
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
 * Permanently delete category (hard delete)
 * @param {string} categoryId - Category ID
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (for company_admin)
 * @returns {Promise<Object>} Deleted category
 */
export const permanentlyDeleteCategory = async (categoryId, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Category = getCategoryModel(companyDB);
    // Ensure Location model is registered for population
    getLocationModel(companyDB);

    const category = await Category.findById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // If user is company_admin, verify they have access to at least one branch
    if (userBranchIds && userBranchIds.length > 0) {
      const hasAccess = category.branchIds.some(branchId => 
        userBranchIds.includes(branchId.toString())
      );
      
      if (!hasAccess) {
        throw new Error('You do not have access to this category');
      }
    }

    // Check if category has subcategories
    const subcategories = await Category.find({ parent: categoryId });
    if (subcategories.length > 0) {
      throw new Error('Cannot delete category with subcategories. Please delete subcategories first.');
    }

    // Hard delete
    await Category.findByIdAndDelete(categoryId);

    logger.info(`Category permanently deleted: ${categoryId} for company: ${companyId}`);

    return category;
  } catch (error) {
    logger.error('Error permanently deleting category:', error);
    throw error;
  }
};

/**
 * Get category tree for branches
 * @param {string|Array} branchIds - Branch ID(s)
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Category tree
 */
export const getCategoryTree = async (branchIds, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Category = getCategoryModel(companyDB);
    // Ensure Location model is registered for population
    getLocationModel(companyDB);

    // Convert single branchId to array
    const branchIdArray = Array.isArray(branchIds) ? branchIds : [branchIds];

    const tree = await Category.getTree(branchIdArray);

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
    // Ensure Location model is registered for population
    getLocationModel(companyDB);

    // Validate all categories exist and user has access
    for (const update of updates) {
      const category = await Category.findById(update.categoryId);
      
      if (!category) {
        throw new Error(`Category ${update.categoryId} not found`);
      }

      // If user is company_admin, verify they have access to at least one branch
      if (userBranchIds && userBranchIds.length > 0) {
        const hasAccess = category.branchIds.some(branchId => 
          userBranchIds.includes(branchId.toString())
        );
        
        if (!hasAccess) {
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

/**
 * Remove branch from category
 * @param {string} categoryId - Category ID
 * @param {string} branchId - Branch ID to remove
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (for company_admin)
 * @returns {Promise<Object>} Updated category
 */
export const removeBranchFromCategory = async (categoryId, branchId, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Category = getCategoryModel(companyDB);
    // Ensure Location model is registered for population
    getLocationModel(companyDB);

    // Get existing category
    const category = await Category.findById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // If user is company_admin, verify they have access to at least one branch
    if (userBranchIds && userBranchIds.length > 0) {
      const hasAccess = category.branchIds.some(id => 
        userBranchIds.includes(id.toString())
      );
      
      if (!hasAccess) {
        throw new Error('You do not have access to this category');
      }
    }

    // Check if branch exists in category
    const branchIndex = category.branchIds.findIndex(
      id => id.toString() === branchId.toString()
    );

    if (branchIndex === -1) {
      throw new Error('Branch not found in category');
    }

    // Remove branch from category
    category.branchIds.splice(branchIndex, 1);
    await category.save();

    // Populate for response
    await category.populate('branchIds', 'name code');
    await category.populate('parent', 'name');

    logger.info(`Branch ${branchId} removed from category ${categoryId} for company: ${companyId}`);

    return category;
  } catch (error) {
    logger.error('Error removing branch from category:', error);
    throw error;
  }
};

/**
 * Get category-branch audit logs with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @param {Array} userBranchIds - User's accessible branch IDs (for company_admin)
 * @returns {Promise<Object>} Paginated audit logs
 */
export const getCategoryBranchAuditLogs = async (companyId, filters = {}, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const CategoryBranchAuditLog = companyDB.model('CategoryBranchAuditLog');
    
    // Ensure models are registered for population
    getCategoryModel(companyDB);
    getLocationModel(companyDB);
    const CompanyUser = companyDB.model('CompanyUser');

    const {
      page = 1,
      limit = 20,
      startDate = '',
      endDate = '',
      branchId = '',
      categoryId = '',
      userId = '',
      action = '',
      entityType = ''
    } = filters;

    // Build query
    const query = {};

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Branch filter
    if (branchId) {
      query.branchIds = branchId;
    } else if (userBranchIds && userBranchIds.length > 0) {
      // For company_admin, only show logs for their accessible branches
      query.branchIds = { $in: userBranchIds };
    }

    // Category filter
    if (categoryId) {
      query.$or = [
        { categoryId: categoryId },
        { subcategoryId: categoryId }
      ];
    }

    // User filter
    if (userId) {
      query.userId = userId;
    }

    // Action filter
    if (action) {
      query.action = action;
    }

    // Entity type filter
    if (entityType) {
      query.entityType = entityType;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [logs, total] = await Promise.all([
      CategoryBranchAuditLog.find(query)
        .populate('userId', 'name email')
        .populate('categoryId', 'name')
        .populate('subcategoryId', 'name')
        .populate('branchIds', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      CategoryBranchAuditLog.countDocuments(query)
    ]);

    return {
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting category-branch audit logs:', error);
    throw error;
  }
};

