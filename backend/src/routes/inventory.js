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
  createStockAdjustment,
  getStockAdjustments,
  getStockAdjustmentById,
  getStockAdjustmentDetails,
  resendStockAdjustmentInAppNotifications,
  createStockTransfer,
  getStockTransfers,
  getStockTransferById,
  approveStockTransfer,
  rejectStockTransfer,
  getSuppliersForBranch,
  getInventoryItemsForBranch as getInventoryItemsForBranchGRN
} from '../controllers/inventoryController.js';
import {
  createGRN,
  getGRNById,
  verifyGRN,
  cancelGRN,
  getGRNsByLocation,
  getAllGRNs
} from '../controllers/grnController.js';
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
import {
  getInventoryByLocation,
  getInventoryByItem,
  getInventoryAtLocation,
  getBatchesAtLocation,
  getExpiringBatches,
  getExpiredBatches,
  reserveInventory,
  releaseReservation,
  consumeReservation,
  getNegativeInventoryReport,
  getNegativeInventorySummary
} from '../controllers/locationInventoryController.js';
import {
  getLedgerForItemAtLocation,
  getLedgerForLocation,
  getInventoryMovements,
  getLedgerForUser
} from '../controllers/inventoryLedgerController.js';
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

// GRN (Goods Receipt Note) routes - using new location-based GRN controller
router.post('/grn', createGRN);
router.get('/grn/all', getAllGRNs);
router.get('/grn/:id', getGRNById);
router.put('/grn/:id/verify', verifyGRN);
router.put('/grn/:id/cancel', cancelGRN);
// Get GRNs by location (supports query params: status, startDate, endDate, limit, skip)
router.get('/grn/location/:locationId', getGRNsByLocation);

// Stock Adjustment routes
router.get('/adjustments', getStockAdjustments);
router.post('/adjustments', createStockAdjustment);
router.get('/adjustments/:branchId/:adjustmentId', getStockAdjustmentDetails);
router.post('/adjustments/:branchId/:adjustmentId/resend-inapp-notifications', resendStockAdjustmentInAppNotifications);
router.get('/adjustments/:id', getStockAdjustmentById);

// Stock Transfer routes
router.get('/transfers', getStockTransfers);
router.post('/transfers', createStockTransfer);
router.get('/transfers/:id', getStockTransferById);
router.put('/transfers/:id/approve', approveStockTransfer);
router.put('/transfers/:id/reject', rejectStockTransfer);

// Location-based Inventory Management routes (NEW)
// Get all inventory at a location
router.get('/location/:locationId', getInventoryByLocation);

// Get inventory for a specific item across all locations
router.get('/item/:itemId', getInventoryByItem);

// Get inventory for a specific item at a specific location
router.get('/location/:locationId/item/:itemId', getInventoryAtLocation);

// Get batches for a specific item at a location
router.get('/location/:locationId/item/:itemId/batches', getBatchesAtLocation);

// Get expiring batches at a location
router.get('/location/:locationId/expiring', getExpiringBatches);

// Get expired batches at a location
router.get('/location/:locationId/expired', getExpiredBatches);

// Reservation management
router.post('/reserve', reserveInventory);
router.post('/release', releaseReservation);
router.post('/consume', consumeReservation);

// Negative inventory reporting (NEW - Task 37.4)
// Get negative inventory report (all locations or filtered by location)
router.get('/negative', getNegativeInventoryReport);

// Get negative inventory summary statistics
router.get('/negative/summary', getNegativeInventorySummary);

// Inventory Ledger routes (NEW - Task 14)
// Get ledger entries for a specific item at a specific location
router.get('/ledger/location/:locationId/item/:itemId', getLedgerForItemAtLocation);

// Get all ledger entries for a specific location
router.get('/ledger/location/:locationId', getLedgerForLocation);

// Get inventory movements with filtering and grouping for reporting
router.get('/ledger/movements', getInventoryMovements);

// Get ledger entries for a specific user (audit trail)
router.get('/ledger/user/:userId', getLedgerForUser);

export default router;
