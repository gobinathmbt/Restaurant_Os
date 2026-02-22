/**
 * Stock Movement Service
 * Production-grade atomic stock operations with transaction support
 * Handles all inventory movements with proper concurrency control
 */

import { getCompanyDB } from '../config/database.js';
import { getInventoryItemLocationModel } from '../models/company/InventoryItemLocation.js';
import { getInventoryLedgerModel } from '../models/company/InventoryLedger.js';
import { logger } from '../utils/logger.js';

/**
 * Atomically deduct stock with ledger entry
 * Uses MongoDB atomic operations to prevent race conditions
 * 
 * @param {string} itemId - Inventory item ID
 * @param {string} locationId - Location ID
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
export const atomicStockDeduction = async (itemId, locationId, quantity, options) => {
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
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryLedger = getInventoryLedgerModel(companyDB);

    // Atomic update with stock check and optimistic locking
    const updateResult = await InventoryItemLocation.findOneAndUpdate(
      {
        inventoryItem: itemId,
        locationId: locationId,
        availableQuantity: { $gte: quantity }, // Ensure sufficient stock
        isActive: true
      },
      {
        $inc: { 
          availableQuantity: -quantity,
          version: 1 // Increment version for optimistic locking
        }
      },
      {
        new: true, // Return updated document
        session // Use transaction session if provided
      }
    ).populate('inventoryItem', 'name code unit')
     .populate('locationId', 'name code');

    if (!updateResult) {
      // Either item not found or insufficient stock
      const item = await InventoryItemLocation.findOne({
        inventoryItem: itemId,
        locationId: locationId
      })
        .populate('inventoryItem', 'name')
        .session(session);
      
      if (!item) {
        throw new Error(`Inventory item location not found: itemId=${itemId}, locationId=${locationId}`);
      }
      
      throw new Error(
        `Insufficient stock for ${item.inventoryItem?.name || 'item'}. ` +
        `Available: ${item.availableQuantity}, Required: ${quantity}`
      );
    }

    // Calculate before/after values
    const beforeStock = updateResult.availableQuantity + quantity;
    const afterStock = updateResult.availableQuantity;

    // Create immutable ledger entry
    const ledgerEntry = new InventoryLedger({
      inventoryItem: updateResult.inventoryItem._id,
      locationId: updateResult.locationId._id || updateResult.locationId,
      movementType,
      quantityDelta: -quantity,
      beforeAvailable: beforeStock,
      afterAvailable: afterStock,
      beforeReserved: updateResult.reservedQuantity,
      afterReserved: updateResult.reservedQuantity,
      beforeInTransit: updateResult.inTransitQuantity,
      afterInTransit: updateResult.inTransitQuantity,
      referenceType,
      referenceId,
      referenceNumber,
      unitCost: updateResult.standardCost || updateResult.lastPurchasePrice || 0,
      totalValue: (updateResult.standardCost || updateResult.lastPurchasePrice || 0) * quantity,
      performedBy,
      reason,
      notes,
      correlationId
    });

    await ledgerEntry.save({ session });

    logger.info(
      `Stock deducted atomically: ${quantity} units of ${updateResult.inventoryItem?.name} ` +
      `at location ${updateResult.locationId?.name}. New stock: ${afterStock}`
    );

    return {
      success: true,
      inventoryItemLocation: updateResult,
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
 * @param {string} itemId - Inventory item ID
 * @param {string} locationId - Location ID
 * @param {number} quantity - Quantity to add
 * @param {Object} options - Movement options (same as deduction)
 * @returns {Promise<Object>} Movement result with ledger entry
 */
export const atomicStockAddition = async (itemId, locationId, quantity, options) => {
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
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryLedger = getInventoryLedgerModel(companyDB);

    // Atomic update with optimistic locking
    const updateResult = await InventoryItemLocation.findOneAndUpdate(
      {
        inventoryItem: itemId,
        locationId: locationId,
        isActive: true
      },
      {
        $inc: { 
          availableQuantity: quantity,
          version: 1 // Increment version for optimistic locking
        }
      },
      {
        new: true,
        session
      }
    ).populate('inventoryItem', 'name code unit')
     .populate('locationId', 'name code');

    if (!updateResult) {
      throw new Error(`Inventory item location not found: itemId=${itemId}, locationId=${locationId}`);
    }

    // Calculate before/after values
    const beforeStock = updateResult.availableQuantity - quantity;
    const afterStock = updateResult.availableQuantity;

    // Create ledger entry
    const ledgerEntry = new InventoryLedger({
      inventoryItem: updateResult.inventoryItem._id,
      locationId: updateResult.locationId._id || updateResult.locationId,
      movementType,
      quantityDelta: quantity,
      beforeAvailable: beforeStock,
      afterAvailable: afterStock,
      beforeReserved: updateResult.reservedQuantity,
      afterReserved: updateResult.reservedQuantity,
      beforeInTransit: updateResult.inTransitQuantity,
      afterInTransit: updateResult.inTransitQuantity,
      referenceType,
      referenceId,
      referenceNumber,
      unitCost: unitCost || updateResult.standardCost || updateResult.lastPurchasePrice || 0,
      totalValue: (unitCost || updateResult.standardCost || updateResult.lastPurchasePrice || 0) * quantity,
      performedBy,
      reason,
      notes,
      correlationId
    });

    await ledgerEntry.save({ session });

    logger.info(
      `Stock added atomically: ${quantity} units of ${updateResult.inventoryItem?.name} ` +
      `at location ${updateResult.locationId?.name}. New stock: ${afterStock}`
    );

    return {
      success: true,
      inventoryItemLocation: updateResult,
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
 * @param {Array} ingredients - Array of {itemId, locationId, quantity}
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
        ingredient.itemId,
        ingredient.locationId,
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
 * @param {Array} ingredients - Array of {itemId, locationId, quantity}
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Availability check result
 */
export const checkStockAvailability = async (ingredients, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    const insufficientItems = [];
    const availableItems = [];

    for (const ingredient of ingredients) {
      const item = await InventoryItemLocation.findOne({
        inventoryItem: ingredient.itemId,
        locationId: ingredient.locationId
      })
        .populate('inventoryItem', 'name code unit')
        .populate('locationId', 'name code')
        .lean();

      if (!item) {
        insufficientItems.push({
          itemId: ingredient.itemId,
          locationId: ingredient.locationId,
          required: ingredient.quantity,
          available: 0,
          reason: 'Item not found'
        });
        continue;
      }

      if (item.availableQuantity < ingredient.quantity) {
        insufficientItems.push({
          itemId: ingredient.itemId,
          locationId: ingredient.locationId,
          itemName: item.inventoryItem?.name,
          locationName: item.locationId?.name,
          required: ingredient.quantity,
          available: item.availableQuantity,
          shortfall: ingredient.quantity - item.availableQuantity,
          reason: 'Insufficient stock'
        });
      } else {
        availableItems.push({
          itemId: ingredient.itemId,
          locationId: ingredient.locationId,
          itemName: item.inventoryItem?.name,
          locationName: item.locationId?.name,
          required: ingredient.quantity,
          available: item.availableQuantity
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
