/**
 * Menu Routes
 * API endpoints for menu management (items, categories, images, branch configurations)
 */

import express from 'express';
import {
  createMenuItem,
  getMenuItems,
  getMenuItemById,
  updateMenuItem,
  deleteMenuItem,
  addImage,
  removeImage,
  reorderImages
} from '../controllers/menuItemController.js';
import {
  createBranchConfig,
  getBranchConfig,
  updateBranchConfig,
  deleteBranchConfig,
  getMenuItemsForBranch,
  createMenuItemWithBranches,
  bulkUpdateBranchConfigs,
  updateModifiers,
  deleteModifier,
  addAddOns,
  removeAddOn,
  getAvailableAddOns
} from '../controllers/menuItemBranchController.js';
import {
  createMenuCategory,
  getMenuCategories,
  getMenuCategoryById,
  updateMenuCategory,
  deleteMenuCategory,
  validateBranchRemoval
} from '../controllers/menuCategoryController.js';
import {
  uploadImage,
  uploadMiddleware,
  handleMulterError,
  getImage
} from '../controllers/imageUploadController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// ============================================
// PUBLIC IMAGE PROXY ROUTE (No Auth Required)
// ============================================

// Image proxy for private S3 bucket - must be before authenticate middleware
router.get('/images/proxy', getImage);

// All other routes require authentication
router.use(authenticate);

// ============================================
// MENU ITEM ROUTES
// ============================================

// Menu item CRUD operations
router.post('/items', createMenuItem);
router.get('/items', getMenuItems);
router.get('/items/:id', getMenuItemById);
router.put('/items/:id', updateMenuItem);
router.delete('/items/:id', deleteMenuItem);

// Create menu item with branch assignments
router.post('/items/with-branches', createMenuItemWithBranches);

// Menu item image management
router.post('/items/:id/images', addImage);
router.delete('/items/:id/images', removeImage);
router.put('/items/:id/images/reorder', reorderImages);

// ============================================
// BRANCH CONFIGURATION ROUTES
// ============================================

// Bulk update branch configurations for a menu item
router.put('/items/:menuItemId/branches', bulkUpdateBranchConfigs);

// Branch-specific menu item configuration
router.post('/items/:menuItemId/branches/:branchId', createBranchConfig);
router.get('/items/:menuItemId/branches/:branchId', getBranchConfig);
router.put('/items/:menuItemId/branches/:branchId', updateBranchConfig);
router.delete('/items/:menuItemId/branches/:branchId', deleteBranchConfig);

// Get menu items for a specific branch (merged with global data)
router.get('/branches/:branchId/items', getMenuItemsForBranch);

// ============================================
// MODIFIER MANAGEMENT ROUTES
// ============================================

// Update modifiers for a menu item branch
router.put('/menu-item-branches/:id/modifiers', updateModifiers);

// Delete a specific modifier from a menu item branch
router.delete('/menu-item-branches/:id/modifiers/:index', deleteModifier);

// ============================================
// ADD-ON MANAGEMENT ROUTES
// ============================================

// Add menu items as add-ons to a menu item branch
router.post('/menu-item-branches/:id/add-ons', addAddOns);

// Remove an add-on from a menu item branch
router.delete('/menu-item-branches/:id/add-ons/:addOnId', removeAddOn);

// Get available menu items for add-ons (excludes self)
router.get('/menu-item-branches/:id/available-add-ons', getAvailableAddOns);

// ============================================
// MENU CATEGORY ROUTES
// ============================================

// Menu category CRUD operations
router.post('/categories', createMenuCategory);
router.get('/categories', getMenuCategories);
router.get('/categories/:id', getMenuCategoryById);
router.put('/categories/:id', updateMenuCategory);
router.delete('/categories/:id', deleteMenuCategory);

// Validate branch removal from category
router.post('/categories/:id/validate-branch-removal', validateBranchRemoval);

// ============================================
// IMAGE UPLOAD ROUTE
// ============================================

// Image upload to S3
router.post('/upload', uploadMiddleware, uploadImage);

// Multer error handler (must be after upload route)
router.use(handleMulterError);

export default router;
