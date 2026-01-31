/**
 * Recipe Controller
 * HTTP request handlers for recipe management endpoints
 */

import * as recipeService from '../services/recipeService.js';
import { logger } from '../utils/logger.js';

/**
 * Create recipe
 * POST /api/recipes
 */
export const createRecipe = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const recipeData = req.body;

    // Create recipe
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
    if (error.message.includes('Missing required fields') || 
        error.message.includes('must have at least one ingredient') ||
        error.message.includes('must have rawMaterial') ||
        error.message.includes('must be positive') ||
        error.message.includes('Yield must have')) {
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
 * GET /api/recipes
 */
export const getRecipes = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const filters = req.query;

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
 * Get recipe by ID
 * GET /api/recipes/:id
 */
export const getRecipeById = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    // Get recipe
    const recipe = await recipeService.getRecipeById(id, companyId);

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
 * Update recipe
 * PUT /api/recipes/:id
 */
export const updateRecipe = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;
    const updateData = req.body;

    // Update recipe
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

    if (error.message.includes('must have at least one ingredient') ||
        error.message.includes('must have rawMaterial') ||
        error.message.includes('must be positive') ||
        error.message.includes('Yield must have')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Delete recipe (soft delete)
 * DELETE /api/recipes/:id
 */
export const deleteRecipe = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;

    // Delete recipe
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
