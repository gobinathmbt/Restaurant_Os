import { logger } from '../utils/logger.js';
import { getInventoryItemLocationModel } from '../models/company/InventoryItemLocation.js';
import { getInventoryBatchLocationModel } from '../models/company/InventoryBatchLocation.js';
import { getStockTransferModel } from '../models/company/StockTransfer.js';
import { getInventoryLedgerModel } from '../models/company/InventoryLedger.js';

/**
 * ReportingService
 * Provides analytics and reporting endpoints for inventory management
 * Implements caching for expensive reports
 */

// Simple in-memory cache with TTL
const reportCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get or set cache with TTL
 */
const getCachedReport = (key) => {
  const cached = reportCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};

const setCachedReport = (key, data) => {
  reportCache.set(key, {
    data,
    timestamp: Date.now()
  });
};

/**
 * Clear expired cache entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of reportCache.entries()) {
    if (now - value.timestamp >= CACHE_TTL) {
      reportCache.delete(key);
    }
  }
}, CACHE_TTL);

/**
 * Get inventory valuation report for a location
 * Calculates inventory value using the configured costing method
 * Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6
 */
export const getInventoryValuation = async (companyDB, locationId, asOfDate = null) => {
  try {
    const cacheKey = `valuation_${locationId}_${asOfDate || 'current'}`;
    const cached = getCachedReport(cacheKey);
    if (cached) {
      logger.info(`Returning cached inventory valuation for location ${locationId}`);
      return cached;
    }

    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    // Get all active inventory items at the location
    const inventoryItems = await InventoryItemLocation.find({
      locationId,
      isActive: true
    }).populate('inventoryItem', 'name category unit');

    const valuationData = [];
    let totalValue = 0;
    let totalQuantity = 0;

    for (const item of inventoryItems) {
      let itemValue = 0;
      let averageCost = 0;

      if (item.costingMethod === 'FIFO') {
        // FIFO: Value inventory using cost of most recent batches
        const batches = await InventoryBatchLocation.find({
          locationId,
          inventoryItem: item.inventoryItem._id,
          status: 'active',
          isActive: true
        }).sort({ expiryDate: -1, createdAt: -1 });

        let remainingQty = item.availableQuantity;
        for (const batch of batches.reverse()) {
          if (remainingQty <= 0) break;
          const qtyFromBatch = Math.min(batch.availableQuantity, remainingQty);
          itemValue += qtyFromBatch * batch.unitCost;
          remainingQty -= qtyFromBatch;
        }
        averageCost = item.availableQuantity > 0 ? itemValue / item.availableQuantity : 0;

      } else if (item.costingMethod === 'WEIGHTED_AVERAGE') {
        // Weighted Average: Calculate average cost across all batches
        const batches = await InventoryBatchLocation.find({
          locationId,
          inventoryItem: item.inventoryItem._id,
          status: 'active',
          isActive: true
        });

        let totalCost = 0;
        let totalBatchQty = 0;
        for (const batch of batches) {
          totalCost += batch.availableQuantity * batch.unitCost;
          totalBatchQty += batch.availableQuantity;
        }
        averageCost = totalBatchQty > 0 ? totalCost / totalBatchQty : 0;
        itemValue = item.availableQuantity * averageCost;

      } else if (item.costingMethod === 'STANDARD_COST') {
        // Standard Cost: Use predetermined cost
        averageCost = item.standardCost || 0;
        itemValue = item.availableQuantity * averageCost;
      }

      valuationData.push({
        inventoryItem: item.inventoryItem,
        costingMethod: item.costingMethod,
        availableQuantity: item.availableQuantity,
        reservedQuantity: item.reservedQuantity,
        inTransitQuantity: item.inTransitQuantity,
        totalQuantity: item.totalQuantity,
        averageCost,
        totalValue: itemValue
      });

      totalValue += itemValue;
      totalQuantity += item.availableQuantity;
    }

    const result = {
      locationId,
      asOfDate: asOfDate || new Date(),
      totalValue,
      totalQuantity,
      itemCount: valuationData.length,
      items: valuationData
    };

    setCachedReport(cacheKey, result);
    return result;

  } catch (error) {
    logger.error('Error generating inventory valuation report:', error);
    throw error;
  }
};

/**
 * Get inventory aging report for a location
 * Shows how long inventory has been in stock
 * Requirements: 21.6
 */
export const getInventoryAging = async (companyDB, locationId) => {
  try {
    const cacheKey = `aging_${locationId}`;
    const cached = getCachedReport(cacheKey);
    if (cached) {
      logger.info(`Returning cached inventory aging for location ${locationId}`);
      return cached;
    }

    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    // Get all active batches at the location
    const batches = await InventoryBatchLocation.find({
      locationId,
      status: 'active',
      isActive: true
    }).populate('inventoryItem', 'name category unit');

    const now = new Date();
    const agingData = [];

    for (const batch of batches) {
      const ageInDays = Math.floor((now - batch.createdAt) / (1000 * 60 * 60 * 24));
      
      let agingBucket = '0-30 days';
      if (ageInDays > 180) agingBucket = '180+ days';
      else if (ageInDays > 90) agingBucket = '91-180 days';
      else if (ageInDays > 60) agingBucket = '61-90 days';
      else if (ageInDays > 30) agingBucket = '31-60 days';

      let daysUntilExpiry = null;
      if (batch.expiryDate) {
        daysUntilExpiry = Math.floor((batch.expiryDate - now) / (1000 * 60 * 60 * 24));
      }

      agingData.push({
        inventoryItem: batch.inventoryItem,
        batchNumber: batch.batchNumber,
        quantity: batch.availableQuantity,
        unitCost: batch.unitCost,
        totalValue: batch.availableQuantity * batch.unitCost,
        ageInDays,
        agingBucket,
        createdAt: batch.createdAt,
        expiryDate: batch.expiryDate,
        daysUntilExpiry,
        isExpiringSoon: daysUntilExpiry !== null && daysUntilExpiry <= 30
      });
    }

    // Group by aging bucket
    const summary = {
      '0-30 days': { count: 0, quantity: 0, value: 0 },
      '31-60 days': { count: 0, quantity: 0, value: 0 },
      '61-90 days': { count: 0, quantity: 0, value: 0 },
      '91-180 days': { count: 0, quantity: 0, value: 0 },
      '180+ days': { count: 0, quantity: 0, value: 0 }
    };

    for (const item of agingData) {
      summary[item.agingBucket].count++;
      summary[item.agingBucket].quantity += item.quantity;
      summary[item.agingBucket].value += item.totalValue;
    }

    const result = {
      locationId,
      reportDate: now,
      summary,
      details: agingData
    };

    setCachedReport(cacheKey, result);
    return result;

  } catch (error) {
    logger.error('Error generating inventory aging report:', error);
    throw error;
  }
};

/**
 * Get transfer summary report
 * Provides statistics on stock transfers
 * Requirements: 22.7
 */
export const getTransferSummary = async (companyDB, filters = {}) => {
  try {
    const { startDate, endDate, locationId, status } = filters;
    const cacheKey = `transfer_summary_${JSON.stringify(filters)}`;
    const cached = getCachedReport(cacheKey);
    if (cached) {
      logger.info('Returning cached transfer summary');
      return cached;
    }

    const StockTransfer = getStockTransferModel(companyDB);

    // Build query
    const query = {};
    if (startDate || endDate) {
      query.requestDate = {};
      if (startDate) query.requestDate.$gte = new Date(startDate);
      if (endDate) query.requestDate.$lte = new Date(endDate);
    }
    if (locationId) {
      query.$or = [
        { fromLocation: locationId },
        { toLocation: locationId }
      ];
    }
    if (status) {
      query.status = status;
    }

    const transfers = await StockTransfer.find(query)
      .populate('fromLocation', 'name code type')
      .populate('toLocation', 'name code type');

    // Calculate statistics
    const stats = {
      totalTransfers: transfers.length,
      byStatus: {},
      byType: {},
      totalItemsTransferred: 0,
      averageItemsPerTransfer: 0
    };

    for (const transfer of transfers) {
      // Count by status
      stats.byStatus[transfer.status] = (stats.byStatus[transfer.status] || 0) + 1;
      
      // Count by type
      stats.byType[transfer.transferType] = (stats.byType[transfer.transferType] || 0) + 1;
      
      // Count items
      stats.totalItemsTransferred += transfer.items.length;
    }

    stats.averageItemsPerTransfer = transfers.length > 0 
      ? (stats.totalItemsTransferred / transfers.length).toFixed(2) 
      : 0;

    const result = {
      filters,
      reportDate: new Date(),
      statistics: stats,
      transfers: transfers.map(t => ({
        transferNumber: t.transferNumber,
        fromLocation: t.fromLocation,
        toLocation: t.toLocation,
        transferType: t.transferType,
        status: t.status,
        itemCount: t.items.length,
        requestDate: t.requestDate,
        approvedDate: t.approvedDate,
        completedDate: t.completedDate
      }))
    };

    setCachedReport(cacheKey, result);
    return result;

  } catch (error) {
    logger.error('Error generating transfer summary report:', error);
    throw error;
  }
};

/**
 * Get stock movement report for a specific item at a location
 * Shows all inventory movements from the ledger
 * Requirements: 22.7
 */
export const getStockMovement = async (companyDB, locationId, itemId, filters = {}) => {
  try {
    const { startDate, endDate, movementType } = filters;
    const cacheKey = `stock_movement_${locationId}_${itemId}_${JSON.stringify(filters)}`;
    const cached = getCachedReport(cacheKey);
    if (cached) {
      logger.info(`Returning cached stock movement for location ${locationId}, item ${itemId}`);
      return cached;
    }

    const InventoryLedger = getInventoryLedgerModel(companyDB);

    // Build query
    const query = {
      locationId,
      inventoryItem: itemId
    };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (movementType) {
      query.movementType = movementType;
    }

    const movements = await InventoryLedger.find(query)
      .sort({ createdAt: -1 })
      .populate('inventoryItem', 'name category unit')
      .populate('performedBy', 'name email')
      .limit(1000); // Limit to prevent excessive data

    // Calculate summary statistics
    const summary = {
      totalMovements: movements.length,
      byMovementType: {},
      totalIncrease: 0,
      totalDecrease: 0,
      netChange: 0
    };

    for (const movement of movements) {
      summary.byMovementType[movement.movementType] = 
        (summary.byMovementType[movement.movementType] || 0) + 1;
      
      if (movement.quantityDelta > 0) {
        summary.totalIncrease += movement.quantityDelta;
      } else {
        summary.totalDecrease += Math.abs(movement.quantityDelta);
      }
    }

    summary.netChange = summary.totalIncrease - summary.totalDecrease;

    const result = {
      locationId,
      itemId,
      filters,
      reportDate: new Date(),
      summary,
      movements: movements.map(m => ({
        _id: m._id,
        movementType: m.movementType,
        quantityDelta: m.quantityDelta,
        beforeAvailable: m.beforeAvailable,
        afterAvailable: m.afterAvailable,
        beforeReserved: m.beforeReserved,
        afterReserved: m.afterReserved,
        beforeInTransit: m.beforeInTransit,
        afterInTransit: m.afterInTransit,
        referenceType: m.referenceType,
        referenceNumber: m.referenceNumber,
        unitCost: m.unitCost,
        totalValue: m.totalValue,
        performedBy: m.performedBy,
        reason: m.reason,
        notes: m.notes,
        createdAt: m.createdAt
      }))
    };

    setCachedReport(cacheKey, result);
    return result;

  } catch (error) {
    logger.error('Error generating stock movement report:', error);
    throw error;
  }
};

/**
 * Get expiry forecast report for a location
 * Shows batches expiring within specified days
 * Requirements: 21.6
 */
export const getExpiryForecast = async (companyDB, locationId, daysAhead = 30) => {
  try {
    const cacheKey = `expiry_forecast_${locationId}_${daysAhead}`;
    const cached = getCachedReport(cacheKey);
    if (cached) {
      logger.info(`Returning cached expiry forecast for location ${locationId}`);
      return cached;
    }

    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    const now = new Date();
    const forecastDate = new Date(now);
    forecastDate.setDate(forecastDate.getDate() + daysAhead);

    // Get batches expiring within the forecast period
    const expiringBatches = await InventoryBatchLocation.find({
      locationId,
      status: 'active',
      isActive: true,
      expiryDate: {
        $gte: now,
        $lte: forecastDate
      }
    })
    .populate('inventoryItem', 'name category unit')
    .sort({ expiryDate: 1 });

    // Get already expired batches
    const expiredBatches = await InventoryBatchLocation.find({
      locationId,
      status: 'active',
      isActive: true,
      expiryDate: {
        $lt: now
      }
    })
    .populate('inventoryItem', 'name category unit')
    .sort({ expiryDate: 1 });

    const expiryData = [];
    let totalExpiringValue = 0;
    let totalExpiredValue = 0;

    // Process expiring batches
    for (const batch of expiringBatches) {
      const daysUntilExpiry = Math.floor((batch.expiryDate - now) / (1000 * 60 * 60 * 24));
      const value = batch.availableQuantity * batch.unitCost;
      totalExpiringValue += value;

      expiryData.push({
        inventoryItem: batch.inventoryItem,
        batchNumber: batch.batchNumber,
        quantity: batch.availableQuantity,
        unitCost: batch.unitCost,
        totalValue: value,
        expiryDate: batch.expiryDate,
        daysUntilExpiry,
        status: 'expiring',
        urgency: daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 14 ? 'high' : 'medium'
      });
    }

    // Process expired batches
    for (const batch of expiredBatches) {
      const daysExpired = Math.floor((now - batch.expiryDate) / (1000 * 60 * 60 * 24));
      const value = batch.availableQuantity * batch.unitCost;
      totalExpiredValue += value;

      expiryData.push({
        inventoryItem: batch.inventoryItem,
        batchNumber: batch.batchNumber,
        quantity: batch.availableQuantity,
        unitCost: batch.unitCost,
        totalValue: value,
        expiryDate: batch.expiryDate,
        daysExpired,
        status: 'expired',
        urgency: 'critical'
      });
    }

    const result = {
      locationId,
      reportDate: now,
      forecastDays: daysAhead,
      summary: {
        expiringBatchCount: expiringBatches.length,
        expiredBatchCount: expiredBatches.length,
        totalExpiringValue,
        totalExpiredValue,
        totalAtRiskValue: totalExpiringValue + totalExpiredValue
      },
      batches: expiryData
    };

    setCachedReport(cacheKey, result);
    return result;

  } catch (error) {
    logger.error('Error generating expiry forecast report:', error);
    throw error;
  }
};

/**
 * Clear all cached reports
 */
export const clearReportCache = () => {
  reportCache.clear();
  logger.info('Report cache cleared');
};

export default {
  getInventoryValuation,
  getInventoryAging,
  getTransferSummary,
  getStockMovement,
  getExpiryForecast,
  clearReportCache
};
