import express from 'express';
import {
  createInventoryItem,
  getInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  deleteInventoryItem,
  getLowStockItems,
  getExpiringItems,
  getInventoryCategories,
  createGRN,
  getGRNs,
  getGRNById,
  createStockAdjustment,
  getStockAdjustments,
  getStockAdjustmentById,
  createStockTransfer,
  getStockTransfers,
  getStockTransferById,
  approveStockTransfer,
  rejectStockTransfer
} from '../controllers/inventoryController.js';
import { authenticate } from '../middlewares/auth.js';
import { validateAndAssignItemCategories } from '../middlewares/categoryBranchValidation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Inventory Item routes
router.get('/items', getInventoryItems);
router.post('/items', validateAndAssignItemCategories, createInventoryItem);
router.get('/items/low-stock', getLowStockItems);
router.get('/items/expiring', getExpiringItems);
router.get('/items/categories', getInventoryCategories);
router.get('/items/:id', getInventoryItemById);
router.put('/items/:id', validateAndAssignItemCategories, updateInventoryItem);
router.delete('/items/:id', deleteInventoryItem);

// GRN (Goods Receipt Note) routes
router.get('/grn', getGRNs);
router.post('/grn', createGRN);
router.get('/grn/:id', getGRNById);

// Stock Adjustment routes
router.get('/adjustments', getStockAdjustments);
router.post('/adjustments', createStockAdjustment);
router.get('/adjustments/:id', getStockAdjustmentById);

// Stock Transfer routes
router.get('/transfers', getStockTransfers);
router.post('/transfers', createStockTransfer);
router.get('/transfers/:id', getStockTransferById);
router.put('/transfers/:id/approve', approveStockTransfer);
router.put('/transfers/:id/reject', rejectStockTransfer);

export default router;
