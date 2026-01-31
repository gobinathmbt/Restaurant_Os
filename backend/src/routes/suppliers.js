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

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Supplier routes
router.get('/', getSuppliers);
router.post('/', createSupplier);
router.get('/:id', getSupplierById);
router.put('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);
router.patch('/:id/toggle-status', toggleSupplierStatus);

export default router;
