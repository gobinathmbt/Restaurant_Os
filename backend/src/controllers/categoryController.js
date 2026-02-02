/**
 * Category Controller
 * HTTP request handlers for category management endpoints
 */

import * as categoryService from '../services/categoryService.js';
import { logger } from '../utils/logger.js';

/**
 * Create category
 * POST /api/categories
 */
export const createCategory = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const categoryData = req.body;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Create category
    const category = await categoryService.createCategory(categoryData, companyId, userBranchIds);

    logger.info('Category created via API', { 
      categoryId: category._id, 
      companyId, 
      userId 
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category }
    });
  } catch (error) {
    logger.error('Create category error', error);
    
    if (error.message.includes('required') ||
        error.message.includes('already exists') ||
        error.message.includes('do not have access')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get categories with filtering and pagination
 * GET /api/categories
 */
export const getCategories = async (req, res, next) => {
  try {
    const { companyId, role, branchIds } = req.user;
    const filters = req.query;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Get categories
    const result = await categoryService.getCategories(companyId, filters, userBranchIds);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get categories error', error);
    next(error);
  }
};

/**
 * Get category by ID
 * GET /api/categories/:id
 */
export const getCategoryById = async (req, res, next) => {
  try {
    const { companyId, role, branchIds } = req.user;
    const { id } = req.params;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Get category
    const category = await categoryService.getCategoryById(id, companyId, userBranchIds);

    res.json({
      success: true,
      data: { category }
    });
  } catch (error) {
    logger.error('Get category by ID error', error);
    
    if (error.message === 'Category not found' || error.message === 'You do not have access to this category') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Update category
 * PUT /api/categories/:id
 */
export const updateCategory = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { id } = req.params;
    const updateData = req.body;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Update category
    const category = await categoryService.updateCategory(id, updateData, companyId, userBranchIds);

    logger.info('Category updated via API', { 
      categoryId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: { category }
    });
  } catch (error) {
    logger.error('Update category error', error);
    
    if (error.message === 'Category not found' || error.message === 'You do not have access to this category') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('already exists') ||
        error.message.includes('do not have access')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Delete category (soft delete)
 * DELETE /api/categories/:id
 */
export const deleteCategory = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { id } = req.params;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Delete category
    await categoryService.deleteCategory(id, companyId, userBranchIds);

    logger.info('Category soft deleted via API', { 
      categoryId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Category deactivated successfully'
    });
  } catch (error) {
    logger.error('Delete category error', error);
    
    if (error.message === 'Category not found' || error.message === 'You do not have access to this category') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot delete category')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Permanently delete category (hard delete)
 * DELETE /api/categories/:id/permanent
 */
export const permanentlyDeleteCategory = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { id } = req.params;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null
      : branchIds;

    // Permanently delete category
    await categoryService.permanentlyDeleteCategory(id, companyId, userBranchIds);

    logger.info('Category permanently deleted via API', { 
      categoryId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Category permanently deleted successfully'
    });
  } catch (error) {
    logger.error('Permanently delete category error', error);
    
    if (error.message === 'Category not found' || error.message === 'You do not have access to this category') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot delete category')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Toggle category status (activate/deactivate)
 * PATCH /api/categories/:id/toggle-status
 */
export const toggleCategoryStatus = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { id } = req.params;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Get current category
    const currentCategory = await categoryService.getCategoryById(id, companyId, userBranchIds);

    // Toggle isActive status
    const category = await categoryService.updateCategory(
      id, 
      { isActive: !currentCategory.isActive }, 
      companyId,
      userBranchIds
    );

    logger.info('Category status toggled via API', { 
      categoryId: id, 
      newStatus: category.isActive,
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { category }
    });
  } catch (error) {
    logger.error('Toggle category status error', error);
    
    if (error.message === 'Category not found' || error.message === 'You do not have access to this category') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get category tree for branches
 * GET /api/categories/tree/:branchId or GET /api/categories/tree (with query params)
 */
export const getCategoryTree = async (req, res, next) => {
  try {
    const { companyId, role, branchIds: userBranchIds } = req.user;
    const { branchId } = req.params;
    const { branchIds: queryBranchIds } = req.query;

    // Determine which branches to get tree for
    let targetBranchIds = [];
    
    if (branchId) {
      // Single branch from params - handle comma-separated values
      if (typeof branchId === 'string' && branchId.includes(',')) {
        targetBranchIds = branchId.split(',').map(id => id.trim()).filter(id => id);
      } else {
        targetBranchIds = [branchId];
      }
    } else if (queryBranchIds) {
      // Multiple branches from query - handle comma-separated string or array
      if (typeof queryBranchIds === 'string') {
        targetBranchIds = queryBranchIds.split(',').map(id => id.trim()).filter(id => id);
      } else if (Array.isArray(queryBranchIds)) {
        targetBranchIds = queryBranchIds;
      } else {
        targetBranchIds = [queryBranchIds];
      }
    } else if (userBranchIds && userBranchIds.length > 0) {
      // User's accessible branches
      targetBranchIds = userBranchIds;
    }

    // If user is company_admin, verify they have access to requested branches
    if (role === 'company_admin' && userBranchIds && userBranchIds.length > 0) {
      const invalidBranches = targetBranchIds.filter(id => !userBranchIds.includes(id));
      if (invalidBranches.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to one or more requested branches'
        });
      }
    }

    // Get category tree
    const tree = await categoryService.getCategoryTree(targetBranchIds, companyId);

    res.json({
      success: true,
      data: { tree }
    });
  } catch (error) {
    logger.error('Get category tree error', error);
    next(error);
  }
};

/**
 * Reorder categories
 * PATCH /api/categories/reorder
 */
export const reorderCategories = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { updates } = req.body; // Array of { categoryId, displayOrder }

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null
      : branchIds;

    // Reorder categories
    await categoryService.reorderCategories(updates, companyId, userBranchIds);

    logger.info('Categories reordered via API', { 
      count: updates.length,
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Categories reordered successfully'
    });
  } catch (error) {
    logger.error('Reorder categories error', error);
    
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};
