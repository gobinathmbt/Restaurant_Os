/**
 * Menu Category Controller
 * HTTP request handlers for menu category management endpoints
 */

import * as menuCategoryService from '../services/menuCategoryService.js';
import { logger } from '../utils/logger.js';

/**
 * Create menu category
 * POST /api/menu/categories
 */
export const createMenuCategory = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const categoryData = req.body;

    // Create menu category
    const category = await menuCategoryService.createMenuCategory(categoryData, companyId);

    logger.info('Menu category created via API', { 
      categoryId: category._id, 
      companyId, 
      userId 
    });

    res.status(201).json({
      success: true,
      message: 'Menu category created successfully',
      data: { category }
    });
  } catch (error) {
    logger.error('Create menu category error', error);
    
    // Handle validation errors (400)
    if (error.message.includes('required') ||
        error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get menu categories with filtering and pagination
 * GET /api/menu/categories
 */
export const getMenuCategories = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const filters = req.query;

    // Get menu categories
    const result = await menuCategoryService.getMenuCategories(companyId, filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get menu categories error', error);
    next(error);
  }
};

/**
 * Get menu category by ID
 * GET /api/menu/categories/:id
 */
export const getMenuCategoryById = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    // Get menu category
    const category = await menuCategoryService.getMenuCategoryById(id, companyId);

    res.json({
      success: true,
      data: { category }
    });
  } catch (error) {
    logger.error('Get menu category by ID error', error);
    
    if (error.message === 'Category not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Update menu category
 * PUT /api/menu/categories/:id
 */
export const updateMenuCategory = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;
    const updateData = req.body;

    // Update menu category
    const category = await menuCategoryService.updateMenuCategory(id, updateData, companyId);

    logger.info('Menu category updated via API', { 
      categoryId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Menu category updated successfully',
      data: { category }
    });
  } catch (error) {
    logger.error('Update menu category error', error);
    
    if (error.message === 'Category not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    // Handle validation errors (400)
    if (error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Delete menu category (soft delete)
 * DELETE /api/menu/categories/:id
 */
export const deleteMenuCategory = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;

    // Delete menu category
    await menuCategoryService.deleteMenuCategory(id, companyId);

    logger.info('Menu category deleted via API', { 
      categoryId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Menu category deleted successfully'
    });
  } catch (error) {
    logger.error('Delete menu category error', error);
    
    if (error.message === 'Category not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    // Handle validation errors (400)
    if (error.message.includes('Cannot delete category')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};
