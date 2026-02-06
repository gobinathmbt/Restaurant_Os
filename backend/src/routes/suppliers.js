import express from 'express';
import {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  toggleSupplierStatus
} from '../controllers/supplierController.js';
import { authenticate } from '../middlewares/auth.js';
import { validateAndAssignSupplierCategories } from '../middlewares/categoryBranchValidation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Supplier routes
router.get('/', getSuppliers);
router.post('/', validateAndAssignSupplierCategories, createSupplier);
router.get('/:id', getSupplierById);
router.put('/:id', validateAndAssignSupplierCategories, updateSupplier);
router.delete('/:id', deleteSupplier);
router.patch('/:id/toggle-status', toggleSupplierStatus);

export default router;
