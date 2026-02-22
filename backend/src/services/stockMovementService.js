/**
 * Stock Movement Service
 * Production-grade atomic stock operations with transaction support
 * Handles all inventory movements with proper concurrency control
 */

import mongoose from 'mongoose';
import { getCompanyDB } from '../config/database.js';
import { getInventoryItemBranchModel } from '../models/company/InventoryItemBranch.js';
import { getInventoryLedgerModel } from '../models/company/InventoryLedger.js';
import { logger } from '../utils/logger.js';

/**
 * Atomically deduct stock with ledger entry
 * Uses MongoDB atomic operations to prevent race conditions
 * 
 * @param {string} inventoryItemBranchId - Inventory item branch ID
 * @param {number} quantity - Quantity to deduct
 * @param {Object} options - Movement options
 * @param {string} options.movementType - Type of movement (consumption, reservation, etc.)
 * @param {string} options.referenceType - Reference document type (ORDER, RECIPE, etc.)
 * @param {string} options.referenceId - Reference document ID
 * @param {string} options.referenceNumber - Reference number for display
 * @param {string} options.performedBy - User ID who performed the action
 * @param {string} options.companyId - Company ID
 * @param {Object} options.session - MongoDB session for transaction (optional)
 * @param {string} options.reason - Reason for movement
 * @param {string} options.notes - Additional notes
 * @param {string} options.correlationId - Correlation ID for tracking related operations
 * @returns {Promise<Object>} Movement result with ledger entry
 */
export const atomicStockDeduction = async (inventoryItemBranchId, quantity, options) => {
  const {
    movementType = 'consumption',
    referenceType,
    referenceId,
    referenceNumber,
    performedBy,
    companyId,
    session,
    reason,
    notes,
    correlationId
  } = options;

  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);
    const InventoryLedger = getInventoryLedgerModel(companyDB);

    // Atomic update with stock check
    const updateResult = await InventoryItemBranch.findOneAndUpdate(
      {
        _id: inventoryItemBranchId,
        currentStock: { $gte: quantity }, // Ensure sufficient stock
        isActive: true
      },
      {
        $inc: { currentStock: -quantity }
      },
      {
        new: true, // Return updated document
        session // Use transaction session if provided
      }
    ).populate('inventoryItem', 'name code unit')
     .populate('branch', 'name code');

    if (!updateResult) {
      // Either item not found or insufficient stock
      const item = await InventoryItemBranch.findById(inventoryItemBranchId)
        .populate('inventoryItem', 'name')
        .session(session);
      
      if (!item) {
        throw new Error(`Inventory item branch not found: ${inventoryItemBranchId}`);
      }
      
      throw new Error(
        `Insufficient stock for ${item.inventoryItem?.name || 'item'}. ` +
        `Available: ${item.currentStock}, Required: ${quantity}`
      );
    }

    // Calculate before/after values
    const beforeStock = updateResult.currentStock + quantity;
    const afterStock = updateResult.currentStock;

    // Create immutable ledger entry
    const ledgerEntry = new InventoryLedger({
      inventoryItem: updateResult.inventoryItem._id,
      locationId: updateResult.branch._id || updateResult.branch,
      movementType,
      quantityDelta: -quantity,
      beforeAvailable: beforeStock,
      afterAvailable: afterStock,
      beforeReserved: 0, // TODO: Implement reservation tracking
      afterReserved: 0,
      beforeInTransit: 0,
      afterInTransit: 0,
      referenceType,
      referenceId,
      referenceNumber,
      unitCost: updateResult.costPrice || 0,
      totalValue: (updateResult.costPrice || 0) * quantity,
      performedBy,
      reason,
      notes,
      correlationId
    });

    await ledgerEntry.save({ session });

    logger.info(
      `Stock deducted atomically: ${quantity} units of ${updateResult.inventoryItem?.name} ` +
      `at branch ${updateResult.branch?.name}. New stock: ${afterStock}`
    );

    return {
      success: true,
      inventoryItemBranch: updateResult,
      beforeStock,
      afterStock,
      deducted: quantity,
      ledgerEntry: ledgerEntry._id
    };
  } catch (error) {
    logger.error('Error in atomic stock deduction:', error);
    throw error;
  }
};

/**
 * Atomically add stock with ledger entry
 * 
 * @param {string} inventoryItemBranchId - Inventory item branch ID
 * @param {number} quantity - Quantity to add
 * @param {Object} options - Movement options (same as deduction)
 * @returns {Promise<Object>} Movement result with ledger entry
 */
export const atomicStockAddition = async (inventoryItemBranchId, quantity, options) => {
  const {
    movementType = 'grn',
    referenceType,
    referenceId,
    referenceNumber,
    performedBy,
    companyId,
    session,
    reason,
    notes,
    correlationId,
    unitCost
  } = options;

  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);
    const InventoryLedger = getInventoryLedgerModel(companyDB);

    // Atomic update
    const updateResult = await InventoryItemBranch.findOneAndUpdate(
      {
        _id: inventoryItemBranchId,
        isActive: true
      },
      {
        $inc: { currentStock: quantity }
      },
      {
        new: true,
        session
      }
    ).populate('inventoryItem', 'name code unit')
     .populate('branch', 'name code');

    if (!updateResult) {
      throw new Error(`Inventory item branch not found: ${inventoryItemBranchId}`);
    }

    // Calculate before/after values
    const beforeStock = updateResult.currentStock - quantity;
    const afterStock = updateResult.currentStock;

    // Create ledger entry
    const ledgerEntry = new InventoryLedger({
      inventoryItem: updateResult.inventoryItem._id,
      locationId: updateResult.branch._id || updateResult.branch,
      movementType,
      quantityDelta: quantity,
      beforeAvailable: beforeStock,
      afterAvailable: afterStock,
      beforeReserved: 0,
      afterReserved: 0,
      beforeInTransit: 0,
      afterInTransit: 0,
      referenceType,
      referenceId,
      referenceNumber,
      unitCost: unitCost || updateResult.costPrice || 0,
      totalValue: (unitCost || updateResult.costPrice || 0) * quantity,
      performedBy,
      reason,
      notes,
      correlationId
    });

    await ledgerEntry.save({ session });

    logger.info(
      `Stock added atomically: ${quantity} units of ${updateResult.inventoryItem?.name} ` +
      `at branch ${updateResult.branch?.name}. New stock: ${afterStock}`
    );

    return {
      success: true,
      inventoryItemBranch: updateResult,
      beforeStock,
      afterStock,
      added: quantity,
      ledgerEntry: ledgerEntry._id
    };
  } catch (error) {
    logger.error('Error in atomic stock addition:', error);
    throw error;
  }
};

/**
 * Deduct multiple ingredients atomically within a transaction
 * All-or-nothing operation - if any ingredient fails, all rollback
 * 
 * @param {Array} ingredients - Array of {inventoryItemBranchId, quantity}
 * @param {Object} options - Movement options
 * @returns {Promise<Object>} Deduction results
 */
export const atomicBulkStockDeduction = async (ingredients, options) => {
  const { companyId, performedBy, referenceType, referenceId, referenceNumber, correlationId } = options;

  const companyDB = getCompanyDB(companyId);
  const session = await companyDB.startSession();
  
  try {
    session.startTransaction();

    const deductions = [];
    
    for (const ingredient of ingredients) {
      const result = await atomicStockDeduction(
        ingredient.inventoryItemBranchId,
        ingredient.quantity,
        {
          ...options,
          session,
          correlationId: correlationId || `bulk_${Date.now()}`
        }
      );
      
      deductions.push(result);
    }

    await session.commitTransaction();
    
    logger.info(
      `Bulk stock deduction completed: ${deductions.length} ingredients deducted ` +
      `for ${referenceType} ${referenceNumber || referenceId}`
    );

    return {
      success: true,
      deductions,
      totalItems: deductions.length
    };
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error in bulk stock deduction, transaction rolled back:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Check if sufficient stock is available for multiple ingredients
 * Does NOT deduct stock, only checks availability
 * 
 * @param {Array} ingredients - Array of {inventoryItemBranchId, quantity}
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Availability check result
 */
export const checkStockAvailability = async (ingredients, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);

    const insufficientItems = [];
    const availableItems = [];

    for (const ingredient of ingredients) {
      const item = await InventoryItemBranch.findById(ingredient.inventoryItemBranchId)
        .populate('inventoryItem', 'name code unit')
        .populate('branch', 'name code')
        .lean();

      if (!item) {
        insufficientItems.push({
          inventoryItemBranchId: ingredient.inventoryItemBranchId,
          required: ingredient.quantity,
          available: 0,
          reason: 'Item not found'
        });
        continue;
      }

      if (item.currentStock < ingredient.quantity) {
        insufficientItems.push({
          inventoryItemBranchId: ingredient.inventoryItemBranchId,
          itemName: item.inventoryItem?.name,
          branchName: item.branch?.name,
          required: ingredient.quantity,
          available: item.currentStock,
          shortfall: ingredient.quantity - item.currentStock,
          reason: 'Insufficient stock'
        });
      } else {
        availableItems.push({
          inventoryItemBranchId: ingredient.inventoryItemBranchId,
          itemName: item.inventoryItem?.name,
          branchName: item.branch?.name,
          required: ingredient.quantity,
          available: item.currentStock
        });
      }
    }

    return {
      sufficient: insufficientItems.length === 0,
      insufficientItems,
      availableItems,
      totalChecked: ingredients.length
    };
  } catch (error) {
    logger.error('Error checking stock availability:', error);
    throw error;
  }
};

export default {
  atomicStockDeduction,
  atomicStockAddition,
  atomicBulkStockDeduction,
  checkStockAvailability
};
