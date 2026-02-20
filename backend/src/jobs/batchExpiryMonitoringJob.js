import { getCompanyDB } from '../config/database.js';
import { getInventoryBatchLocationModel } from '../models/company/InventoryBatchLocation.js';
import { getLocationModel } from '../models/company/Location.js';
import notificationService from '../services/notificationService.js';
import { logger } from '../utils/logger.js';

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
      const now = new Date();
      const warningThreshold = new Date(now);
      warningThreshold.setDate(warningThreshold.getDate() + expiryWarningDays);

      // Step 1: Mark expired batches
      const expiredResult = await this.markExpiredBatches(
        InventoryBatchLocation,
        now
      );

      // Step 2: Find batches expiring soon
      const expiringBatches = await this.findExpiringBatches(
        InventoryBatchLocation,
        now,
        warningThreshold
      );

      // Step 3: Group by location and send notifications
      const notificationResult = await this.sendExpiryNotifications(
        companyId,
        expiringBatches,
        Location,
        expiryWarningDays
      );

      const duration = Date.now() - startTime;
      const result = {
        success: true,
        companyId,
        executedAt: now,
        duration,
        expiredBatchesMarked: expiredResult.modifiedCount,
        expiringBatchesFound: expiringBatches.length,
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
   * Mark batches as expired if their expiry date has passed
   * @param {Model} InventoryBatchLocation - Batch model
   * @param {Date} now - Current date
   * @returns {Promise<Object>} Update result
   */
  async markExpiredBatches(InventoryBatchLocation, now) {
    logger.info(`[${this.jobName}] Marking expired batches`);

    const result = await InventoryBatchLocation.updateMany(
      {
        expiryDate: { $lt: now },
        status: 'active',
        isActive: true
      },
      {
        $set: { status: 'expired' }
      }
    );

    logger.info(`[${this.jobName}] Marked ${result.modifiedCount} batches as expired`);
    return result;
  }

  /**
   * Find batches expiring within the warning threshold
   * @param {Model} InventoryBatchLocation - Batch model
   * @param {Date} now - Current date
   * @param {Date} warningThreshold - Warning threshold date
   * @returns {Promise<Array>} Expiring batches
   */
  async findExpiringBatches(InventoryBatchLocation, now, warningThreshold) {
    logger.info(`[${this.jobName}] Finding batches expiring between ${now.toISOString()} and ${warningThreshold.toISOString()}`);

    const expiringBatches = await InventoryBatchLocation.find({
      expiryDate: {
        $gte: now,
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
      .populate('locationId', 'name code type')
      .lean();

    logger.info(`[${this.jobName}] Found ${expiringBatches.length} batches expiring soon`);
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
