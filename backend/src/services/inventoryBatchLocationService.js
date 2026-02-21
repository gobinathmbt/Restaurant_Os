/**
 * InventoryBatchLocation Service
 * Business logic for batch-level inventory management
 * Supports FIFO costing, expiry management, and batch tracking
 */

import { getCompanyDB } from '../config/database.js';
import { getInventoryBatchLocationModel } from '../models/company/InventoryBatchLocation.js';
import { getInventoryItemLocationModel } from '../models/company/InventoryItemLocation.js';
import { logger } from '../utils/logger.js';
import { 
  getLocationTimezone, 
  getStartOfDayInTimezone, 
  getEndOfDayInTimezone,
  addDaysInTimezone,
  isExpiredInTimezone 
} from '../utils/timezoneHelper.js';

/**
 * Create or update a batch for GRN processing
 * If batch with same batchNumber exists at location, update it; otherwise create new
 * @param {Object} batchData - Batch data
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Created or updated batch
 */
export const createOrUpdateBatch = async (batchData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    // Validate required fields
    const requiredFields = ['inventoryItem', 'locationId', 'batchNumber', 'unitCost'];
    const missingFields = requiredFields.filter(field => !batchData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate quantity is non-negative
    const quantity = batchData.availableQuantity || 0;
    if (quantity < 0) {
      throw new Error('Available quantity cannot be negative');
    }

    // Validate unitCost is non-negative
    if (batchData.unitCost < 0) {
      throw new Error('Unit cost cannot be negative');
    }

    // Validate expiry date is not in the past (if provided)
    if (batchData.expiryDate) {
      const expiryDate = new Date(batchData.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (expiryDate < today) {
        logger.warn(`Batch ${batchData.batchNumber} has expiry date in the past`);
        // Don't throw error - allow creating batches with past expiry (they'll be marked expired)
      }
    }

    // Check if batch already exists
    const existingBatch = await InventoryBatchLocation.findOne({
      inventoryItem: batchData.inventoryItem,
      locationId: batchData.locationId,
      batchNumber: batchData.batchNumber
    });

    if (existingBatch) {
      // Update existing batch - add to quantity
      existingBatch.availableQuantity += quantity;
      existingBatch.version += 1;
      
      // Update other fields if provided
      if (batchData.expiryDate) existingBatch.expiryDate = batchData.expiryDate;
      if (batchData.manufacturingDate) existingBatch.manufacturingDate = batchData.manufacturingDate;
      if (batchData.supplier) existingBatch.supplier = batchData.supplier;
      if (batchData.grnReference) existingBatch.grnReference = batchData.grnReference;
      
      await existingBatch.save();
      
      logger.info(`Batch updated: ${existingBatch._id} at location ${batchData.locationId}`);
      return existingBatch;
    } else {
      // Create new batch
      const batch = new InventoryBatchLocation({
        inventoryItem: batchData.inventoryItem,
        locationId: batchData.locationId,
        batchNumber: batchData.batchNumber,
        expiryDate: batchData.expiryDate,
        manufacturingDate: batchData.manufacturingDate,
        availableQuantity: quantity,
        reservedQuantity: 0,
        unitCost: batchData.unitCost,
        supplier: batchData.supplier,
        grnReference: batchData.grnReference,
        status: 'active',
        isActive: true,
        version: 0
      });

      await batch.save();
      
      logger.info(`Batch created: ${batch._id} at location ${batchData.locationId}`);
      return batch;
    }
  } catch (error) {
    logger.error('Error creating or updating batch:', error);
    throw error;
  }
};

/**
 * Get batches at a location for a specific item with FIFO ordering
 * Orders by expiryDate ascending (oldest first), then createdAt ascending
 * @param {string} locationId - Location ID
 * @param {string} inventoryItemId - Inventory item ID
 * @param {string} companyId - Company ID
 * @param {Object} options - Query options (includeInactive, status)
 * @returns {Promise<Array>} Array of batches in FIFO order
 */
export const getBatchesAtLocation = async (locationId, inventoryItemId, companyId, options = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    const { includeInactive = false, status = 'active' } = options;

    // Build query
    const query = {
      locationId,
      inventoryItem: inventoryItemId
    };

    if (!includeInactive) {
      query.isActive = true;
    }

    if (status) {
      query.status = status;
    }

    // Query with FIFO ordering: expiryDate ASC (nulls last), then createdAt ASC
    const batches = await InventoryBatchLocation.find(query)
      .sort({ 
        expiryDate: 1,  // Oldest expiry first
        createdAt: 1    // Oldest batch first for same expiry
      })
      .populate('supplier', 'name contactPerson')
      .populate('grnReference', 'grnNumber receivedDate')
      .lean();

    // Move batches with null expiryDate to the end (FIFO for non-perishables)
    const batchesWithExpiry = batches.filter(b => b.expiryDate);
    const batchesWithoutExpiry = batches.filter(b => !b.expiryDate);

    return [...batchesWithExpiry, ...batchesWithoutExpiry];
  } catch (error) {
    logger.error('Error getting batches at location:', error);
    throw error;
  }
};

/**
 * Get next batch for consumption using FIFO logic
 * Returns the batch with earliest expiry date and available quantity > 0
 * @param {string} locationId - Location ID
 * @param {string} inventoryItemId - Inventory item ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object|null>} Next batch to consume or null if none available
 */
export const getNextBatchForConsumption = async (locationId, inventoryItemId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    // Find active batches with available quantity, ordered by FIFO
    const batch = await InventoryBatchLocation.findOne({
      locationId,
      inventoryItem: inventoryItemId,
      isActive: true,
      status: 'active',
      availableQuantity: { $gt: 0 }
    })
      .sort({ 
        expiryDate: 1,  // Oldest expiry first
        createdAt: 1    // Oldest batch first for same expiry
      })
      .populate('supplier', 'name contactPerson')
      .populate('grnReference', 'grnNumber receivedDate')
      .lean();

    return batch;
  } catch (error) {
    logger.error('Error getting next batch for consumption:', error);
    throw error;
  }
};

/**
 * Get batches expiring within specified number of days
 * Uses location timezone for accurate expiry calculations
 * @param {string} locationId - Location ID
 * @param {number} daysUntilExpiry - Number of days to look ahead
 * @param {string} companyId - Company ID
 * @param {string} inventoryItemId - Optional: filter by specific item
 * @returns {Promise<Array>} Array of expiring batches
 */
export const getExpiringBatches = async (locationId, daysUntilExpiry, companyId, inventoryItemId = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    // Get location timezone for accurate expiry calculation
    const timezone = await getLocationTimezone(locationId, companyId);

    // Calculate date range in location's timezone
    const startDate = getStartOfDayInTimezone(timezone);
    const futureDate = addDaysInTimezone(new Date(), daysUntilExpiry, timezone);
    const endDate = getEndOfDayInTimezone(timezone, futureDate);

    // Build query - all dates stored in UTC, comparison done with UTC dates
    const query = {
      locationId,
      isActive: true,
      status: 'active',
      expiryDate: {
        $gte: startDate,
        $lte: endDate
      },
      availableQuantity: { $gt: 0 }
    };

    if (inventoryItemId) {
      query.inventoryItem = inventoryItemId;
    }

    const batches = await InventoryBatchLocation.find(query)
      .sort({ expiryDate: 1 })
      .populate('inventoryItem', 'name type unit')
      .populate('supplier', 'name contactPerson')
      .populate('grnReference', 'grnNumber receivedDate')
      .lean();

    logger.info(`Found ${batches.length} batches expiring within ${daysUntilExpiry} days at location ${locationId} (timezone: ${timezone})`);

    return batches;
  } catch (error) {
    logger.error('Error getting expiring batches:', error);
    throw error;
  }

};

/**
 * Get expired batches at a location
 * Uses location timezone for accurate expiry determination
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @param {string} inventoryItemId - Optional: filter by specific item
 * @returns {Promise<Array>} Array of expired batches
 */
export const getExpiredBatches = async (locationId, companyId, inventoryItemId = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    // Get location timezone for accurate expiry determination
    const timezone = await getLocationTimezone(locationId, companyId);

    // Get start of today in location's timezone (converted to UTC)
    const todayStart = getStartOfDayInTimezone(timezone);

    // Build query - find batches with expiry date before today in location's timezone
    const query = {
      locationId,
      isActive: true,
      expiryDate: { $lt: todayStart },
      availableQuantity: { $gt: 0 }
    };

    if (inventoryItemId) {
      query.inventoryItem = inventoryItemId;
    }

    const batches = await InventoryBatchLocation.find(query)
      .sort({ expiryDate: 1 })
      .populate('inventoryItem', 'name type unit')
      .populate('supplier', 'name contactPerson')
      .populate('grnReference', 'grnNumber receivedDate')
      .lean();

    logger.info(`Found ${batches.length} expired batches at location ${locationId} (timezone: ${timezone})`);

    return batches;
  } catch (error) {
    logger.error('Error getting expired batches:', error);
    throw error;
  }
};

/**
 * Mark a batch as expired
 * @param {string} batchId - Batch ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated batch
 */
export const markBatchAsExpired = async (batchId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    const batch = await InventoryBatchLocation.findById(batchId);
    
    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status === 'expired') {
      logger.warn(`Batch ${batchId} is already marked as expired`);
      return batch;
    }

    // Update status to expired
    batch.status = 'expired';
    batch.version += 1;
    await batch.save();

    logger.info(`Batch ${batchId} marked as expired`);

    return batch;
  } catch (error) {
    logger.error('Error marking batch as expired:', error);
    throw error;
  }
};

/**
 * Get batch by ID
 * @param {string} batchId - Batch ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Batch
 */
export const getBatchById = async (batchId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    const batch = await InventoryBatchLocation.findById(batchId)
      .populate('inventoryItem', 'name type unit')
      .populate('locationId', 'name code type')
      .populate('supplier', 'name contactPerson phone email')
      .populate('grnReference', 'grnNumber receivedDate totalAmount')
      .lean();

    if (!batch) {
      throw new Error('Batch not found');
    }

    return batch;
  } catch (error) {
    logger.error('Error getting batch by ID:', error);
    throw error;
  }
};

/**
 * Update batch quantity (for internal use by inventory operations)
 * @param {string} batchId - Batch ID
 * @param {number} quantityDelta - Change in quantity (positive or negative)
 * @param {string} quantityType - Type of quantity to update ('available' or 'reserved')
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated batch
 */
export const updateBatchQuantity = async (batchId, quantityDelta, quantityType, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    const batch = await InventoryBatchLocation.findById(batchId);
    
    if (!batch) {
      throw new Error('Batch not found');
    }

    // Update quantity based on type
    if (quantityType === 'available') {
      const newQuantity = batch.availableQuantity + quantityDelta;
      
      if (newQuantity < 0) {
        throw new Error(`Operation would result in negative available quantity for batch ${batchId}`);
      }
      
      batch.availableQuantity = newQuantity;
    } else if (quantityType === 'reserved') {
      const newQuantity = batch.reservedQuantity + quantityDelta;
      
      if (newQuantity < 0) {
        throw new Error(`Operation would result in negative reserved quantity for batch ${batchId}`);
      }
      
      batch.reservedQuantity = newQuantity;
    } else {
      throw new Error(`Invalid quantity type: ${quantityType}`);
    }

    batch.version += 1;
    await batch.save();

    logger.info(`Batch ${batchId} ${quantityType} quantity updated by ${quantityDelta}`);

    return batch;
  } catch (error) {
    logger.error('Error updating batch quantity:', error);
    throw error;
  }
};

/**
 * Get total available quantity across all active batches for an item at a location
 * @param {string} locationId - Location ID
 * @param {string} inventoryItemId - Inventory item ID
 * @param {string} companyId - Company ID
 * @returns {Promise<number>} Total available quantity
 */
export const getTotalAvailableQuantity = async (locationId, inventoryItemId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    const result = await InventoryBatchLocation.aggregate([
      {
        $match: {
          locationId: locationId,
          inventoryItem: inventoryItemId,
          isActive: true,
          status: 'active'
        }
      },
      {
        $group: {
          _id: null,
          totalAvailable: { $sum: '$availableQuantity' }
        }
      }
    ]);

    return result.length > 0 ? result[0].totalAvailable : 0;
  } catch (error) {
    logger.error('Error getting total available quantity:', error);
    throw error;
  }
};

export default {
  createOrUpdateBatch,
  getBatchesAtLocation,
  getNextBatchForConsumption,
  getExpiringBatches,
  getExpiredBatches,
  markBatchAsExpired,
  getBatchById,
  updateBatchQuantity,
  getTotalAvailableQuantity
};
