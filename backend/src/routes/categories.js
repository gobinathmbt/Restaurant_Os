import express from 'express';
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  getCategoryTree,
  reorderCategories
} from '../controllers/categoryController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Category routes
router.get('/', getCategories);
router.post('/', createCategory);
router.patch('/reorder', reorderCategories);
router.get('/tree/:branchId', getCategoryTree);
router.get('/:id', getCategoryById);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);
router.patch('/:id/toggle-status', toggleCategoryStatus);

export default router;
