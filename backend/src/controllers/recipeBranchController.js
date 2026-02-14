/**
 * Recipe Branch Controller
 * HTTP request handlers for branch-specific recipe configuration endpoints
 */

import * as recipeBranchService from '../services/recipeBranchService.js';
import { logger } from '../utils/logger.js';

/**
 * Create branch configuration for recipe
 * POST /api/recipes/:recipeId/branches
 */
export const createRecipeBranch = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { recipeId } = req.params;
    const { branchId, ...configData } = req.body;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Create branch configuration
    const recipeBranch = await recipeBranchService.createRecipeBranch(
      recipeId,
      branchId,
      configData,
      companyId,
      userBranchIds
    );

    logger.info('Recipe branch config created via API', { 
      recipeId,
      branchId,
      companyId, 
      userId 
    });

    res.status(201).json({
      success: true,
      message: 'Recipe branch configuration created successfully',
      data: { recipeBranch }
    });
  } catch (error) {
    logger.error('Create recipe branch config error', error);
    
    // Handle authorization errors (403)
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Handle not found errors (404)
    if (error.message === 'Recipe not found' || error.message === 'Branch not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    // Handle validation errors (400)
    if (error.message.includes('Quantity must be greater than zero') ||
        error.message.includes('Unit is required') ||
        error.message.includes('Yield quantity must be greater than zero') ||
        error.message.includes('Yield unit is required') ||
        error.message.includes('already exists') ||
        error.message.includes('does not belong to branch') ||
        error.message.includes('not found') ||
        error.message.includes('Validation failed')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get all branch configurations for a recipe
 * GET /api/recipes/:recipeId/branches
 */
export const getRecipeBranches = async (req, res, next) => {
  try {
    const { companyId, role, branchIds } = req.user;
    const { recipeId } = req.params;
    const filters = req.query;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Get branch configurations
    const recipeBranches = await recipeBranchService.getRecipeBranches(
      recipeId,
      filters,
      companyId,
      userBranchIds
    );

    res.json({
      success: true,
      data: { recipeBranches }
    });
  } catch (error) {
    logger.error('Get recipe branches error', error);
    
    if (error.message === 'Recipe not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get specific branch configuration for a recipe
 * GET /api/recipes/:recipeId/branches/:branchId
 */
export const getRecipeBranch = async (req, res, next) => {
  try {
    const { companyId, role, branchIds } = req.user;
    const { recipeId, branchId } = req.params;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Get branch configuration
    const recipeBranch = await recipeBranchService.getRecipeBranch(
      recipeId,
      branchId,
      companyId,
      userBranchIds
    );

    res.json({
      success: true,
      data: { recipeBranch }
    });
  } catch (error) {
    logger.error('Get recipe branch error', error);
    
    // Handle authorization errors (403)
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Recipe branch configuration not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Update branch configuration for a recipe
 * PUT /api/recipes/:recipeId/branches/:branchId
 */
export const updateRecipeBranch = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { recipeId, branchId } = req.params;
    const updateData = req.body;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Update branch configuration
    const recipeBranch = await recipeBranchService.updateRecipeBranch(
      recipeId,
      branchId,
      updateData,
      companyId,
      userBranchIds
    );

    logger.info('Recipe branch config updated via API', { 
      recipeId,
      branchId,
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Recipe branch configuration updated successfully',
      data: { recipeBranch }
    });
  } catch (error) {
    logger.error('Update recipe branch config error', error);
    
    // Handle authorization errors (403)
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Handle not found errors (404)
    if (error.message === 'Recipe branch configuration not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    // Handle validation errors (400)
    if (error.message.includes('Quantity must be greater than zero') ||
        error.message.includes('Unit is required') ||
        error.message.includes('Yield quantity must be greater than zero') ||
        error.message.includes('Yield unit is required') ||
        error.message.includes('does not belong to branch') ||
        error.message.includes('not found') ||
        error.message.includes('Validation failed')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Delete branch configuration for a recipe
 * DELETE /api/recipes/:recipeId/branches/:branchId
 */
export const deleteRecipeBranch = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { recipeId, branchId } = req.params;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Delete branch configuration
    await recipeBranchService.deleteRecipeBranch(
      recipeId,
      branchId,
      companyId,
      userBranchIds
    );

    logger.info('Recipe branch config deleted via API', { 
      recipeId,
      branchId,
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Recipe branch configuration deleted successfully'
    });
  } catch (error) {
    logger.error('Delete recipe branch config error', error);
    
    // Handle authorization errors (403)
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Handle not found errors (404)
    if (error.message === 'Recipe branch configuration not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Bulk create/update branch configurations for a recipe
 * POST /api/recipes/:recipeId/branches/bulk
 */
export const bulkUpsertRecipeBranches = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { recipeId } = req.params;
    const { branchConfigs } = req.body;

    if (!branchConfigs || !Array.isArray(branchConfigs)) {
      return res.status(400).json({
        success: false,
        message: 'branchConfigs array is required'
      });
    }

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Bulk upsert branch configurations
    const result = await recipeBranchService.bulkUpsertRecipeBranches(
      recipeId,
      branchConfigs,
      companyId,
      userBranchIds
    );

    logger.info('Recipe branch configs bulk upserted via API', { 
      recipeId,
      count: branchConfigs.length,
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Recipe branch configurations processed successfully',
      data: result
    });
  } catch (error) {
    logger.error('Bulk upsert recipe branch configs error', error);
    
    // Handle authorization errors (403)
    if (error.message.includes('do not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Handle not found errors (404)
    if (error.message === 'Recipe not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    // Handle validation errors (400)
    if (error.message.includes('Branch ID is required') ||
        error.message.includes('Quantity must be greater than zero') ||
        error.message.includes('Unit is required') ||
        error.message.includes('Yield quantity must be greater than zero') ||
        error.message.includes('Yield unit is required') ||
        error.message.includes('does not belong to branch') ||
        error.message.includes('not found') ||
        error.message.includes('Validation failed')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};
