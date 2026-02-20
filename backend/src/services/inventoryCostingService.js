/**
 * Inventory Costing Service
 * Business logic for inventory costing operations (FIFO, Weighted Average, Standard Cost)
 * Handles consumption logic with proper cost calculation and ledger recording
 */

import { getCompanyDB } from '../config/database.js';
import { getInventoryBatchLocationModel } from '../models/company/InventoryBatchLocation.js';
import { getInventoryItemLocationModel } from '../models/company/InventoryItemLocation.js';
import { recordLedgerEntry } from './inventoryLedgerService.js';
import { logger } from '../utils/logger.js';

/**
 * Consume inventory using FIFO costing method
 * Consumes from oldest batches first (by expiry date, then creation date)
 * Skips expired batches during consumption
 * 
 * @param {string} locationId - Location ID
 * @param {string} itemId - Inventory item ID
 * @param {number} quantity - Quantity to consume
 * @param {string} userId - User performing the operation
 * @param {string} referenceType - Reference type (TRANSFER, ORDER, etc.)
 * @param {string} referenceId - Reference document ID
 * @param {string} companyId - Company ID
 * @param {Object} options - Additional options (referenceNumber, reason, notes, correlationId)
 * @returns {Promise<Object>} Consumption result with total cost and batches consumed
 */
export const consumeInventoryFIFO = async (
  locationId,
  itemId,
  quantity,
  userId,
  referenceType,
  referenceId,
  companyId,
  options = {}
) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    // Validate quantity
    if (quantity <= 0) {
      throw new Error('Quantity to consume must be greater than zero');
    }

    // Get inventory item location to check available quantity
    const inventory = await InventoryItemLocation.findOne({
      locationId,
      inventoryItem: itemId,
      isActive: true
    });

    if (!inventory) {
      throw new Error(`Inventory item ${itemId} not found at location ${locationId}`);
    }

    if (inventory.availableQuantity < quantity) {
      throw new Error(
        `Insufficient available quantity. Requested: ${quantity}, Available: ${inventory.availableQuantity}`
      );
    }

    // Get batches ordered by FIFO (expiry date ascending, then created date ascending)
    // Only include active batches with available quantity
    const batches = await InventoryBatchLocation.find({
      locationId,
      inventoryItem: itemId,
      status: 'active',
      availableQuantity: { $gt: 0 },
      isActive: true
    })
      .sort({ expiryDate: 1, createdAt: 1 })
      .lean();

    if (batches.length === 0) {
      throw new Error(`No active batches available for item ${itemId} at location ${locationId}`);
    }

    // Calculate total available quantity from active batches
    const totalBatchQuantity = batches.reduce((sum, batch) => sum + batch.availableQuantity, 0);

    if (totalBatchQuantity < quantity) {
      throw new Error(
        `Insufficient active batch quantity. Requested: ${quantity}, Available in batches: ${totalBatchQuantity}`
      );
    }

    // Consume from batches in FIFO order
    let remainingToConsume = quantity;
    let totalCost = 0;
    const batchesConsumed = [];
    const ledgerEntries = [];

    // Start a session for transaction
    const session = await companyDB.startSession();
    
    try {
      await session.startTransaction();

      for (const batch of batches) {
        if (remainingToConsume <= 0) break;

        const consumeFromBatch = Math.min(batch.availableQuantity, remainingToConsume);
        
        // Update batch quantity
        const updatedBatch = await InventoryBatchLocation.findByIdAndUpdate(
          batch._id,
          {
            $inc: { availableQuantity: -consumeFromBatch },
            $set: { version: batch.version + 1 }
          },
          { new: true, session }
        );

        if (!updatedBatch) {
          throw new Error(`Failed to update batch ${batch._id}`);
        }

        // Calculate cost for this batch
        const batchCost = consumeFromBatch * batch.unitCost;
        totalCost += batchCost;

        // Track batch consumption
        batchesConsumed.push({
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          quantityConsumed: consumeFromBatch,
          unitCost: batch.unitCost,
          totalCost: batchCost,
          expiryDate: batch.expiryDate
        });

        // Record ledger entry for this batch
        const ledgerEntry = await recordLedgerEntry(
          {
            inventoryItem: itemId,
            locationId,
            batchNumber: batch.batchNumber,
            movementType: 'consumption',
            quantityDelta: -consumeFromBatch,
            beforeAvailable: inventory.availableQuantity,
            afterAvailable: inventory.availableQuantity - consumeFromBatch,
            beforeReserved: inventory.reservedQuantity,
            afterReserved: inventory.reservedQuantity,
            beforeInTransit: inventory.inTransitQuantity,
            afterInTransit: inventory.inTransitQuantity,
            referenceType,
            referenceId,
            referenceNumber: options.referenceNumber,
            unitCost: batch.unitCost,
            totalValue: batchCost,
            performedBy: userId,
            reason: options.reason,
            notes: options.notes,
            correlationId: options.correlationId
          },
          companyId
        );

        ledgerEntries.push(ledgerEntry);

        // Update remaining quantity
        remainingToConsume -= consumeFromBatch;

        // Update inventory available quantity for next iteration
        inventory.availableQuantity -= consumeFromBatch;
      }

      // Update aggregate inventory quantity
      await InventoryItemLocation.findByIdAndUpdate(
        inventory._id,
        {
          $inc: { availableQuantity: -quantity },
          $set: { version: inventory.version + 1 }
        },
        { session }
      );

      await session.commitTransaction();

      logger.info(
        `FIFO consumption completed: ${quantity} units of item ${itemId} at location ${locationId}, ` +
        `total cost: ${totalCost}, batches consumed: ${batchesConsumed.length}`
      );

      return {
        quantityConsumed: quantity,
        totalCost,
        averageCost: totalCost / quantity,
        batchesConsumed,
        ledgerEntries
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    logger.error('Error consuming inventory with FIFO:', error);
    throw error;
  }
};

/**
 * Calculate weighted average cost for an inventory item at a location
 * 
 * @param {string} locationId - Location ID
 * @param {string} itemId - Inventory item ID
 * @param {string} companyId - Company ID
 * @returns {Promise<number>} Weighted average cost per unit
 */
export const calculateWeightedAverageCost = async (locationId, itemId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    // Get all active batches with available quantity
    const batches = await InventoryBatchLocation.find({
      locationId,
      inventoryItem: itemId,
      status: 'active',
      availableQuantity: { $gt: 0 },
      isActive: true
    }).lean();

    if (batches.length === 0) {
      return 0;
    }

    // Calculate weighted average
    let totalValue = 0;
    let totalQuantity = 0;

    for (const batch of batches) {
      totalValue += batch.availableQuantity * batch.unitCost;
      totalQuantity += batch.availableQuantity;
    }

    if (totalQuantity === 0) {
      return 0;
    }

    const weightedAverageCost = totalValue / totalQuantity;

    logger.info(
      `Weighted average cost calculated for item ${itemId} at location ${locationId}: ${weightedAverageCost}`
    );

    return weightedAverageCost;
  } catch (error) {
    logger.error('Error calculating weighted average cost:', error);
    throw error;
  }
};

/**
 * Consume inventory using Weighted Average costing method
 * 
 * @param {string} locationId - Location ID
 * @param {string} itemId - Inventory item ID
 * @param {number} quantity - Quantity to consume
 * @param {string} userId - User performing the operation
 * @param {string} referenceType - Reference type (TRANSFER, ORDER, etc.)
 * @param {string} referenceId - Reference document ID
 * @param {string} companyId - Company ID
 * @param {Object} options - Additional options (referenceNumber, reason, notes, correlationId)
 * @returns {Promise<Object>} Consumption result with total cost
 */
export const consumeInventoryWeightedAverage = async (
  locationId,
  itemId,
  quantity,
  userId,
  referenceType,
  referenceId,
  companyId,
  options = {}
) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    // Validate quantity
    if (quantity <= 0) {
      throw new Error('Quantity to consume must be greater than zero');
    }

    // Get inventory item location
    const inventory = await InventoryItemLocation.findOne({
      locationId,
      inventoryItem: itemId,
      isActive: true
    });

    if (!inventory) {
      throw new Error(`Inventory item ${itemId} not found at location ${locationId}`);
    }

    if (inventory.availableQuantity < quantity) {
      throw new Error(
        `Insufficient available quantity. Requested: ${quantity}, Available: ${inventory.availableQuantity}`
      );
    }

    // Calculate weighted average cost
    const weightedAverageCost = await calculateWeightedAverageCost(locationId, itemId, companyId);

    if (weightedAverageCost === 0) {
      throw new Error(`Cannot calculate weighted average cost for item ${itemId} at location ${locationId}`);
    }

    // Calculate total cost
    const totalCost = quantity * weightedAverageCost;

    // Start a session for transaction
    const session = await companyDB.startSession();
    
    try {
      await session.startTransaction();

      // Update aggregate inventory quantity
      await InventoryItemLocation.findByIdAndUpdate(
        inventory._id,
        {
          $inc: { availableQuantity: -quantity },
          $set: { version: inventory.version + 1 }
        },
        { session }
      );

      // Record ledger entry
      const ledgerEntry = await recordLedgerEntry(
        {
          inventoryItem: itemId,
          locationId,
          movementType: 'consumption',
          quantityDelta: -quantity,
          beforeAvailable: inventory.availableQuantity,
          afterAvailable: inventory.availableQuantity - quantity,
          beforeReserved: inventory.reservedQuantity,
          afterReserved: inventory.reservedQuantity,
          beforeInTransit: inventory.inTransitQuantity,
          afterInTransit: inventory.inTransitQuantity,
          referenceType,
          referenceId,
          referenceNumber: options.referenceNumber,
          unitCost: weightedAverageCost,
          totalValue: totalCost,
          performedBy: userId,
          reason: options.reason,
          notes: options.notes,
          correlationId: options.correlationId
        },
        companyId
      );

      await session.commitTransaction();

      logger.info(
        `Weighted average consumption completed: ${quantity} units of item ${itemId} at location ${locationId}, ` +
        `total cost: ${totalCost}, average cost: ${weightedAverageCost}`
      );

      return {
        quantityConsumed: quantity,
        totalCost,
        averageCost: weightedAverageCost,
        ledgerEntry
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    logger.error('Error consuming inventory with weighted average:', error);
    throw error;
  }
};

/**
 * Consume inventory using Standard Cost costing method
 * Uses the standardCost field from InventoryItemLocation
 * 
 * @param {string} locationId - Location ID
 * @param {string} itemId - Inventory item ID
 * @param {number} quantity - Quantity to consume
 * @param {string} userId - User performing the operation
 * @param {string} referenceType - Reference type (TRANSFER, ORDER, etc.)
 * @param {string} referenceId - Reference document ID
 * @param {string} companyId - Company ID
 * @param {Object} options - Additional options (referenceNumber, reason, notes, correlationId)
 * @returns {Promise<Object>} Consumption result with total cost
 */
export const consumeInventoryStandardCost = async (
  locationId,
  itemId,
  quantity,
  userId,
  referenceType,
  referenceId,
  companyId,
  options = {}
) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    // Validate quantity
    if (quantity <= 0) {
      throw new Error('Quantity to consume must be greater than zero');
    }

    // Get inventory item location
    const inventory = await InventoryItemLocation.findOne({
      locationId,
      inventoryItem: itemId,
      isActive: true
    });

    if (!inventory) {
      throw new Error(`Inventory item ${itemId} not found at location ${locationId}`);
    }

    if (inventory.availableQuantity < quantity) {
      throw new Error(
        `Insufficient available quantity. Requested: ${quantity}, Available: ${inventory.availableQuantity}`
      );
    }

    // Check if standard cost is set
    if (!inventory.standardCost || inventory.standardCost <= 0) {
      throw new Error(
        `Standard cost not set for item ${itemId} at location ${locationId}. ` +
        `Please set standardCost before using STANDARD_COST costing method.`
      );
    }

    // Calculate total cost using standard cost
    const totalCost = quantity * inventory.standardCost;

    // Start a session for transaction
    const session = await companyDB.startSession();
    
    try {
      await session.startTransaction();

      // Update aggregate inventory quantity
      await InventoryItemLocation.findByIdAndUpdate(
        inventory._id,
        {
          $inc: { availableQuantity: -quantity },
          $set: { version: inventory.version + 1 }
        },
        { session }
      );

      // Record ledger entry
      const ledgerEntry = await recordLedgerEntry(
        {
          inventoryItem: itemId,
          locationId,
          movementType: 'consumption',
          quantityDelta: -quantity,
          beforeAvailable: inventory.availableQuantity,
          afterAvailable: inventory.availableQuantity - quantity,
          beforeReserved: inventory.reservedQuantity,
          afterReserved: inventory.reservedQuantity,
          beforeInTransit: inventory.inTransitQuantity,
          afterInTransit: inventory.inTransitQuantity,
          referenceType,
          referenceId,
          referenceNumber: options.referenceNumber,
          unitCost: inventory.standardCost,
          totalValue: totalCost,
          performedBy: userId,
          reason: options.reason,
          notes: options.notes,
          correlationId: options.correlationId
        },
        companyId
      );

      await session.commitTransaction();

      logger.info(
        `Standard cost consumption completed: ${quantity} units of item ${itemId} at location ${locationId}, ` +
        `total cost: ${totalCost}, standard cost: ${inventory.standardCost}`
      );

      return {
        quantityConsumed: quantity,
        totalCost,
        averageCost: inventory.standardCost,
        ledgerEntry
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    logger.error('Error consuming inventory with standard cost:', error);
    throw error;
  }
};

/**
 * Consume inventory using the configured costing method for the item at the location
 * This is the main entry point for inventory consumption
 * 
 * @param {string} locationId - Location ID
 * @param {string} itemId - Inventory item ID
 * @param {number} quantity - Quantity to consume
 * @param {string} userId - User performing the operation
 * @param {string} referenceType - Reference type (TRANSFER, ORDER, etc.)
 * @param {string} referenceId - Reference document ID
 * @param {string} companyId - Company ID
 * @param {Object} options - Additional options (referenceNumber, reason, notes, correlationId)
 * @returns {Promise<Object>} Consumption result with total cost
 */
export const consumeInventory = async (
  locationId,
  itemId,
  quantity,
  userId,
  referenceType,
  referenceId,
  companyId,
  options = {}
) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    // Get inventory item location to determine costing method
    const inventory = await InventoryItemLocation.findOne({
      locationId,
      inventoryItem: itemId,
      isActive: true
    });

    if (!inventory) {
      throw new Error(`Inventory item ${itemId} not found at location ${locationId}`);
    }

    // Route to appropriate costing method
    switch (inventory.costingMethod) {
      case 'FIFO':
        return await consumeInventoryFIFO(
          locationId,
          itemId,
          quantity,
          userId,
          referenceType,
          referenceId,
          companyId,
          options
        );

      case 'WEIGHTED_AVERAGE':
        return await consumeInventoryWeightedAverage(
          locationId,
          itemId,
          quantity,
          userId,
          referenceType,
          referenceId,
          companyId,
          options
        );

      case 'STANDARD_COST':
        return await consumeInventoryStandardCost(
          locationId,
          itemId,
          quantity,
          userId,
          referenceType,
          referenceId,
          companyId,
          options
        );

      default:
        throw new Error(`Invalid costing method: ${inventory.costingMethod}`);
    }
  } catch (error) {
    logger.error('Error consuming inventory:', error);
    throw error;
  }
};
