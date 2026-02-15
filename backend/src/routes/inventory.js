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
  rejectStockTransfer,
  getSuppliersForBranch,
  getInventoryItemsForBranch as getInventoryItemsForBranchGRN
} from '../controllers/inventoryController.js';
import {
  createBranchConfig,
  getBranchConfig,
  updateBranchConfig,
  getInventoryItemBranchById,
  getInventoryItemBranchesByIds,
  deleteBranchConfig,
  bulkUpdateBranchConfigs,
  getInventoryItemsForBranch,
  createInventoryItemWithBranches
} from '../controllers/inventoryItemBranchController.js';
import { authenticate } from '../middlewares/auth.js';
import { validateAndAssignItemCategories } from '../middlewares/categoryBranchValidation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Inventory Item routes
router.get('/items', getInventoryItems);
router.post('/items', validateAndAssignItemCategories, createInventoryItem);
router.post('/items/with-branches', createInventoryItemWithBranches);
router.get('/items/low-stock', getLowStockItems);
router.get('/items/expiring', getExpiringItems);
router.get('/items/categories', getInventoryCategories);
router.get('/items/:id', getInventoryItemById);
router.put('/items/:id', validateAndAssignItemCategories, updateInventoryItem);
router.delete('/items/:id', deleteInventoryItem);

// Inventory Item Branch Configuration routes
router.post('/items/:inventoryItemId/branches/:branchId', createBranchConfig);
router.get('/items/:inventoryItemId/branches/:branchId', getBranchConfig);
router.put('/items/:inventoryItemId/branches/:branchId', updateBranchConfig);
router.delete('/items/:inventoryItemId/branches/:branchId', deleteBranchConfig);
router.put('/items/:inventoryItemId/branches', bulkUpdateBranchConfigs);

// Get inventory items for a specific branch
router.get('/branches/:branchId/items', getInventoryItemsForBranch);
// Get a specific branch item by its id
router.get('/branches/:branchId/items/:branchItemId', getInventoryItemBranchById);
// Batch fetch multiple branch items by ids
router.post('/branches/:branchId/items/batch', getInventoryItemBranchesByIds);

// Branch-filtered endpoints for GRN creation
router.get('/branches/:branchId/suppliers', getSuppliersForBranch);
router.get('/branches/:branchId/inventory-items', getInventoryItemsForBranchGRN);

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
