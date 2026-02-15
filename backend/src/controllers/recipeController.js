/**
 * Recipe Controller
 * HTTP request handlers for recipe management endpoints
 */

import * as recipeService from '../services/recipeService.js';
import { logger } from '../utils/logger.js';

/**
 * Create recipe (global data only)
 * POST /api/recipes
 */
export const createRecipe = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const recipeData = req.body;

    // Create recipe with global fields only
    const recipe = await recipeService.createRecipe(recipeData, companyId);

    logger.info('Recipe created via API', { 
      recipeId: recipe._id, 
      companyId, 
      userId 
    });

    res.status(201).json({
      success: true,
      message: 'Recipe created successfully',
      data: { recipe }
    });
  } catch (error) {
    logger.error('Create recipe error', error);
    
    // Handle specific validation errors
    if (error.message.includes('Missing required fields')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get recipes with filtering and pagination
 * Supports branch filtering and role-based access control
 * GET /api/recipes
 */
export const getRecipes = async (req, res, next) => {
  try {
    const { companyId, role, branchIds } = req.user;
    const filters = req.query;

    // Determine user's accessible branches for role-based filtering
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // If user has limited branch access and no branch filter is specified, 
    // default to their accessible branches
    if (userBranchIds && !filters.branchId) {
      // For single-branch users, automatically filter by their branch
      if (userBranchIds.length === 1) {
        filters.branchId = userBranchIds[0];
      }
      // For multi-branch users, don't auto-filter but they can only see their branches
    }

    // If branch filter is specified, validate user has access to that branch
    if (filters.branchId && filters.branchId !== 'all' && userBranchIds) {
      if (!userBranchIds.includes(filters.branchId)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this branch'
        });
      }
    }

    // Get recipes
    const result = await recipeService.getRecipes(companyId, filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get recipes error', error);
    next(error);
  }
};

/**
 * Get recipe by ID with optional branch population
 * GET /api/recipes/:id
 */
export const getRecipeById = async (req, res, next) => {
  try {
    const { companyId, role, branchIds } = req.user;
    const { id } = req.params;
    const { populateBranches, branch } = req.query;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // If branch filter is specified, validate user has access to that branch
    if (branch && userBranchIds) {
      if (!userBranchIds.includes(branch)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this branch'
        });
      }
    }

    // Get recipe with options
    const options = {
      populateBranches: populateBranches === 'true',
      branch: branch || null
    };

    const recipe = await recipeService.getRecipeById(id, companyId, options);

    // Filter branches based on user access if populated
    if (recipe.branches && userBranchIds) {
      recipe.branches = recipe.branches.filter(rb => 
        userBranchIds.includes(rb.branch._id?.toString() || rb.branch.toString())
      );
    }

    res.json({
      success: true,
      data: { recipe }
    });
  } catch (error) {
    logger.error('Get recipe by ID error', error);
    
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
 * Update recipe (global fields only)
 * PUT /api/recipes/:id
 */
export const updateRecipe = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;
    const updateData = req.body;

    // Update recipe (only global fields)
    const recipe = await recipeService.updateRecipe(id, updateData, companyId);

    logger.info('Recipe updated via API', { 
      recipeId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Recipe updated successfully',
      data: { recipe }
    });
  } catch (error) {
    logger.error('Update recipe error', error);
    
    if (error.message === 'Recipe not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Missing required fields')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Delete recipe (soft delete) and cascade delete RecipeBranch records
 * DELETE /api/recipes/:id
 */
export const deleteRecipe = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;

    // Delete recipe and cascade delete RecipeBranch records
    await recipeService.deleteRecipe(id, companyId);

    logger.info('Recipe deleted via API', { 
      recipeId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Recipe deleted successfully'
    });
  } catch (error) {
    logger.error('Delete recipe error', error);
    
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
 * Create recipe with branch configurations in one request
 * POST /api/recipes/with-branches
 */
export const createRecipeWithBranches = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { recipeData, branchConfigs } = req.body;

    // Validate request structure
    if (!recipeData || !branchConfigs) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: recipeData and branchConfigs'
      });
    }

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Validate user has access to all specified branches
    if (userBranchIds) {
      for (const branchConfig of branchConfigs) {
        if (!userBranchIds.includes(branchConfig.branch)) {
          return res.status(403).json({
            success: false,
            message: `You do not have permission to create recipe configuration for branch ${branchConfig.branch}`
          });
        }
      }
    }

    // Create recipe with branches
    const recipe = await recipeService.createRecipeWithBranches(
      recipeData,
      branchConfigs,
      companyId
    );

    logger.info('Recipe created with branches via API', { 
      recipeId: recipe._id, 
      branchCount: branchConfigs.length,
      companyId, 
      userId 
    });

    res.status(201).json({
      success: true,
      message: 'Recipe created with branch configurations successfully',
      data: { recipe }
    });
  } catch (error) {
    logger.error('Create recipe with branches error', error);
    
    // Handle specific validation errors
    if (error.message.includes('Missing required fields') ||
        error.message.includes('At least one branch configuration is required') ||
        error.message.includes('Each branch configuration must have a branch ID') ||
        error.message.includes('does not belong to branch')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};
