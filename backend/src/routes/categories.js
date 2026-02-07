import express from 'express';
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  permanentlyDeleteCategory,
  toggleCategoryStatus,
  getCategoryTree,
  reorderCategories,
  removeBranchFromCategory,
  getCategoryBranchAuditLogs
} from '../controllers/categoryController.js';
import { authenticate } from '../middlewares/auth.js';
import { validateCategoryBranchRemoval, validateCategoryUpdate, validateCategoryDeletion } from '../middlewares/categoryBranchValidation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Category routes
router.get('/', getCategories);
router.post('/', createCategory);
router.patch('/reorder', reorderCategories);
router.get('/tree/:branchId?', getCategoryTree); // Optional branchId parameter
router.get('/audit-logs/category-branch', getCategoryBranchAuditLogs);
router.get('/:id', getCategoryById);
router.put('/:id', validateCategoryUpdate, updateCategory);
router.put('/:id/remove-branch', validateCategoryBranchRemoval, removeBranchFromCategory);
router.delete('/:id', validateCategoryDeletion, deleteCategory);
router.delete('/:id/permanent', validateCategoryDeletion, permanentlyDeleteCategory);
router.patch('/:id/toggle-status', toggleCategoryStatus);

export default router;
