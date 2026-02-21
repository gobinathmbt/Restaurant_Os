import { getCompanyDB } from '../config/database.js';
import { getInventoryBatchLocationModel } from '../models/company/InventoryBatchLocation.js';
import { getLocationModel } from '../models/company/Location.js';
import notificationService from '../services/notificationService.js';
import { logger } from '../utils/logger.js';
import { getStartOfDayInTimezone, getEndOfDayInTimezone, addDaysInTimezone } from '../utils/timezoneHelper.js';

/**
 * Batch Expiry Monitoring Job
 * 
 * Responsibilities:
 * - Query batches expiring within configured threshold
 * - Send notifications to location managers
 * - Mark expired batches as status='expired'
 * - Run daily
 * 
 * Requirements: 21.2, 21.3
 */
class BatchExpiryMonitoringJob {
  constructor() {
    this.jobName = 'BatchExpiryMonitoring';
    this.expiryWarningDays = 7; // Default: warn 7 days before expiry
  }

  /**
   * Execute the batch expiry monitoring job for a specific company
   * Uses timezone-aware calculations for each location
   * @param {string} companyId - Company ID
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job execution result
   */
  async execute(companyId, options = {}) {
    const startTime = Date.now();
    logger.info(`[${this.jobName}] Starting job for company ${companyId}`);

    try {
      const companyDB = getCompanyDB(companyId);
      const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);
      const Location = getLocationModel(companyDB);

      const expiryWarningDays = options.expiryWarningDays || this.expiryWarningDays;

      // Get all active locations to process timezone-aware expiry
      const locations = await Location.find({ isActive: true }).select('_id timezone').lean();

      let totalExpiredMarked = 0;
      let totalExpiringFound = 0;
      const allExpiringBatches = [];

      // Process each location with its own timezone
      for (const location of locations) {
        const timezone = location.timezone || 'UTC';
        
        // Step 1: Mark expired batches for this location
        const todayStart = getStartOfDayInTimezone(timezone);
        const expiredResult = await this.markExpiredBatchesForLocation(
          InventoryBatchLocation,
          location._id,
          todayStart
        );
        totalExpiredMarked += expiredResult.modifiedCount;

        // Step 2: Find batches expiring soon for this location
        const futureDate = addDaysInTimezone(new Date(), expiryWarningDays, timezone);
        const warningThreshold = getEndOfDayInTimezone(timezone, futureDate);
        
        const expiringBatches = await this.findExpiringBatchesForLocation(
          InventoryBatchLocation,
          location._id,
          todayStart,
          warningThreshold
        );
        
        totalExpiringFound += expiringBatches.length;
        allExpiringBatches.push(...expiringBatches);
      }

      // Step 3: Group by location and send notifications
      const notificationResult = await this.sendExpiryNotifications(
        companyId,
        allExpiringBatches,
        Location,
        expiryWarningDays
      );

      const duration = Date.now() - startTime;
      const result = {
        success: true,
        companyId,
        executedAt: new Date(),
        duration,
        locationsProcessed: locations.length,
        expiredBatchesMarked: totalExpiredMarked,
        expiringBatchesFound: totalExpiringFound,
        notificationsSent: notificationResult.sent,
        notificationsFailed: notificationResult.failed
      };

      logger.info(`[${this.jobName}] Completed for company ${companyId} in ${duration}ms`, result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[${this.jobName}] Failed for company ${companyId}:`, error);
      
      return {
        success: false,
        companyId,
        executedAt: new Date(),
        duration,
        error: error.message
      };
    }
  }

  /**
   * Mark batches as expired for a specific location if their expiry date has passed
   * Uses location timezone for accurate expiry determination
   * @param {Model} InventoryBatchLocation - Batch model
   * @param {string} locationId - Location ID
   * @param {Date} todayStart - Start of today in location's timezone (UTC)
   * @returns {Promise<Object>} Update result
   */
  async markExpiredBatchesForLocation(InventoryBatchLocation, locationId, todayStart) {
    const result = await InventoryBatchLocation.updateMany(
      {
        locationId,
        expiryDate: { $lt: todayStart },
        status: 'active',
        isActive: true
      },
      {
        $set: { status: 'expired' }
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`[${this.jobName}] Marked ${result.modifiedCount} batches as expired at location ${locationId}`);
    }
    
    return result;
  }

  /**
   * Find batches expiring within the warning threshold for a specific location
   * Uses location timezone for accurate expiry calculation
   * @param {Model} InventoryBatchLocation - Batch model
   * @param {string} locationId - Location ID
   * @param {Date} todayStart - Start of today in location's timezone (UTC)
   * @param {Date} warningThreshold - Warning threshold date in location's timezone (UTC)
   * @returns {Promise<Array>} Expiring batches
   */
  async findExpiringBatchesForLocation(InventoryBatchLocation, locationId, todayStart, warningThreshold) {
    const expiringBatches = await InventoryBatchLocation.find({
      locationId,
      expiryDate: {
        $gte: todayStart,
        $lte: warningThreshold
      },
      status: 'active',
      isActive: true,
      $or: [
        { availableQuantity: { $gt: 0 } },
        { reservedQuantity: { $gt: 0 } }
      ]
    })
      .populate('inventoryItem', 'name code category unit')
      .populate('locationId', 'name code type timezone')
      .lean();

    return expiringBatches;
  }

  /**
   * Send expiry notifications grouped by location
   * @param {string} companyId - Company ID
   * @param {Array} expiringBatches - Batches expiring soon
   * @param {Model} Location - Location model
   * @param {number} expiryWarningDays - Days until expiry
   * @returns {Promise<Object>} Notification result
   */
  async sendExpiryNotifications(companyId, expiringBatches, Location, expiryWarningDays) {
    if (expiringBatches.length === 0) {
      logger.info(`[${this.jobName}] No expiring batches to notify about`);
      return { sent: 0, failed: 0 };
    }

    // Group batches by location
    const batchesByLocation = expiringBatches.reduce((acc, batch) => {
      const locationId = batch.locationId._id.toString();
      if (!acc[locationId]) {
        acc[locationId] = {
          location: batch.locationId,
          batches: []
        };
      }
      acc[locationId].batches.push(batch);
      return acc;
    }, {});

    logger.info(`[${this.jobName}] Sending notifications for ${Object.keys(batchesByLocation).length} locations`);

    let sent = 0;
    let failed = 0;

    // Send notification for each location
    for (const [locationId, data] of Object.entries(batchesByLocation)) {
      try {
        const { location, batches } = data;
        
        // Create summary message
        const batchCount = batches.length;
        const itemNames = [...new Set(batches.map(b => b.inventoryItem.name))].slice(0, 3);
        const itemSummary = itemNames.join(', ') + (batchCount > 3 ? ` and ${batchCount - 3} more` : '');

        // Send notification to company primary admin
        // In a real system, you would send to location managers specifically
        await notificationService.sendToCompanyPrimaryAdmin(companyId, {
          category: 'inventory',
          event: 'batch_expiry_warning',
          title: `${batchCount} Batch${batchCount > 1 ? 'es' : ''} Expiring Soon at ${location.name}`,
          message: `${batchCount} inventory batch${batchCount > 1 ? 'es' : ''} will expire within ${expiryWarningDays} days at ${location.name}: ${itemSummary}`,
          data: {
            locationId: location._id,
            locationName: location.name,
            locationCode: location.code,
            batchCount,
            expiryWarningDays,
            batches: batches.map(b => ({
              batchNumber: b.batchNumber,
              itemName: b.inventoryItem.name,
              itemCode: b.inventoryItem.code,
              expiryDate: b.expiryDate,
              availableQuantity: b.availableQuantity,
              reservedQuantity: b.reservedQuantity,
              unit: b.inventoryItem.unit
            }))
          },
          priority: 'high',
          actionUrl: `/inventory/location/${location._id}/expiring`
        });

        sent++;
        logger.info(`[${this.jobName}] Sent expiry notification for location ${location.name} (${batchCount} batches)`);
      } catch (error) {
        failed++;
        logger.error(`[${this.jobName}] Failed to send notification for location ${locationId}:`, error);
      }
    }

    return { sent, failed };
  }

  /**
   * Execute the job for all companies
   * @param {Array<string>} companyIds - Array of company IDs
   * @param {Object} options - Job options
   * @returns {Promise<Array>} Results for all companies
   */
  async executeForAllCompanies(companyIds, options = {}) {
    logger.info(`[${this.jobName}] Executing for ${companyIds.length} companies`);

    const results = await Promise.allSettled(
      companyIds.map(companyId => this.execute(companyId, options))
    );

    const summary = {
      total: companyIds.length,
      successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
      failed: results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message })
    };

    logger.info(`[${this.jobName}] Completed for all companies:`, summary);
    return summary;
  }
}

export default new BatchExpiryMonitoringJob();
