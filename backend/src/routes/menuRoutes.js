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
  createMenuItemWithBranches
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
  handleMulterError
} from '../controllers/imageUploadController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
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

// Branch-specific menu item configuration
router.post('/items/:menuItemId/branches/:branchId', createBranchConfig);
router.get('/items/:menuItemId/branches/:branchId', getBranchConfig);
router.put('/items/:menuItemId/branches/:branchId', updateBranchConfig);
router.delete('/items/:menuItemId/branches/:branchId', deleteBranchConfig);

// Get menu items for a specific branch (merged with global data)
router.get('/branches/:branchId/items', getMenuItemsForBranch);

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
