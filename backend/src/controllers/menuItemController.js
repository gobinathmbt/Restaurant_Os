/**
 * Menu Item Controller
 * HTTP request handlers for menu item management endpoints
 */

import * as menuItemService from '../services/menuItemService.js';
import { logger } from '../utils/logger.js';

/**
 * Create menu item
 * POST /api/menu/items
 */
export const createMenuItem = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const menuItemData = req.body;

    // Create menu item
    const menuItem = await menuItemService.createMenuItem(menuItemData, companyId);

    logger.info('Menu item created via API', { 
      menuItemId: menuItem._id, 
      companyId, 
      userId 
    });

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: { menuItem }
    });
  } catch (error) {
    logger.error('Create menu item error', error);
    
    // Handle validation errors (400)
    if (error.message.includes('required') ||
        error.message.includes('cannot exceed') ||
        error.message.includes('cannot be negative') ||
        error.message.includes('cannot have more than') ||
        error.message.includes('does not exist') ||
        error.message.includes('Invalid spice level')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get menu items with filters
 * GET /api/menu/items
 */
export const getMenuItems = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const filters = req.query;

    // Get menu items
    const result = await menuItemService.getMenuItems(companyId, filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get menu items error', error);
    next(error);
  }
};

/**
 * Get menu item by ID with branch configurations
 * GET /api/menu/items/:id
 * Query params: branchId (optional) - filter by specific branch
 */
export const getMenuItemById = async (req, res, next) => {
  try {
    const { companyId, role, branchIds } = req.user;
    const { id } = req.params;
    const { branchId } = req.query;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Get menu item with branch configurations
    const menuItem = await menuItemService.getMenuItemById(id, companyId, branchId, userBranchIds);

    res.json({
      success: true,
      data: { menuItem }
    });
  } catch (error) {
    logger.error('Get menu item by ID error', error);
    
    if (error.message === 'Menu item not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Update menu item
 * PUT /api/menu/items/:id
 */
export const updateMenuItem = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;
    const updateData = req.body;

    // Update menu item
    const menuItem = await menuItemService.updateMenuItem(id, updateData, companyId);

    logger.info('Menu item updated via API', { 
      menuItemId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: { menuItem }
    });
  } catch (error) {
    logger.error('Update menu item error', error);
    
    if (error.message === 'Menu item not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    // Handle validation errors (400)
    if (error.message.includes('cannot exceed') ||
        error.message.includes('cannot be negative') ||
        error.message.includes('cannot have more than') ||
        error.message.includes('does not exist') ||
        error.message.includes('Invalid spice level')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Delete menu item (soft delete)
 * DELETE /api/menu/items/:id
 */
export const deleteMenuItem = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;

    // Delete menu item
    await menuItemService.deleteMenuItem(id, companyId);

    logger.info('Menu item deleted via API', { 
      menuItemId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Menu item deleted successfully'
    });
  } catch (error) {
    logger.error('Delete menu item error', error);
    
    if (error.message === 'Menu item not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Permanently delete menu item (hard delete with all branch configs)
 * DELETE /api/menu/items/:id/permanent
 */
export const permanentlyDeleteMenuItem = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;

    // Permanently delete menu item and all branch configurations
    await menuItemService.permanentlyDeleteMenuItem(id, companyId);

    logger.info('Menu item permanently deleted via API', { 
      menuItemId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Menu item and all branch configurations permanently deleted'
    });
  } catch (error) {
    logger.error('Permanently delete menu item error', error);
    
    if (error.message === 'Menu item not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Toggle menu item active status
 * PATCH /api/menu/items/:id/toggle-status
 */
export const toggleMenuItemStatus = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;

    // Toggle menu item status
    const menuItem = await menuItemService.toggleMenuItemStatus(id, companyId);

    logger.info('Menu item status toggled via API', { 
      menuItemId: id,
      newStatus: menuItem.isActive,
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: `Menu item ${menuItem.isActive ? 'enabled' : 'disabled'} successfully`,
      data: { menuItem }
    });
  } catch (error) {
    logger.error('Toggle menu item status error', error);
    
    if (error.message === 'Menu item not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Add image to menu item
 * POST /api/menu/items/:id/images
 */
export const addImage = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;
    const { imageUrl } = req.body;

    // Validate imageUrl is provided
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required'
      });
    }

    // Add image to menu item
    const menuItem = await menuItemService.addImageToMenuItem(id, imageUrl, companyId);

    logger.info('Image added to menu item via API', { 
      menuItemId: id, 
      imageUrl,
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Image added successfully',
      data: { menuItem }
    });
  } catch (error) {
    logger.error('Add image error', error);
    
    if (error.message === 'Menu item not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('required') || error.message.includes('Valid image URL')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Remove image from menu item
 * DELETE /api/menu/items/:id/images
 */
export const removeImage = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;
    const { imageUrl } = req.body;

    // Validate imageUrl is provided
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required'
      });
    }

    // Remove image from menu item
    const menuItem = await menuItemService.removeImageFromMenuItem(id, imageUrl, companyId);

    logger.info('Image removed from menu item via API', { 
      menuItemId: id, 
      imageUrl,
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Image removed successfully',
      data: { menuItem }
    });
  } catch (error) {
    logger.error('Remove image error', error);
    
    if (error.message === 'Menu item not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('required') || 
        error.message.includes('Valid image URL') ||
        error.message.includes('not found in menu item')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Reorder images for menu item
 * PUT /api/menu/items/:id/images/reorder
 */
export const reorderImages = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;
    const { imageOrder } = req.body;

    // Validate imageOrder is provided
    if (!imageOrder || !Array.isArray(imageOrder)) {
      return res.status(400).json({
        success: false,
        message: 'Image order array is required'
      });
    }

    // Reorder images
    const menuItem = await menuItemService.reorderMenuItemImages(id, imageOrder, companyId);

    logger.info('Images reordered for menu item via API', { 
      menuItemId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Images reordered successfully',
      data: { menuItem }
    });
  } catch (error) {
    logger.error('Reorder images error', error);
    
    if (error.message === 'Menu item not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('required') || 
        error.message.includes('not found in menu item') ||
        error.message.includes('must include all images')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};
