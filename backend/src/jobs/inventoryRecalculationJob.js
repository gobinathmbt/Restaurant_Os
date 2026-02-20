import { getCompanyDB } from '../config/database.js';
import { getInventoryBatchLocationModel } from '../models/company/InventoryBatchLocation.js';
import { getInventoryItemLocationModel } from '../models/company/InventoryItemLocation.js';
import { getInventoryLedgerModel } from '../models/company/InventoryLedger.js';
import notificationService from '../services/notificationService.js';
import { logger } from '../utils/logger.js';

/**
 * Inventory Recalculation Job
 * 
 * Responsibilities:
 * - Recalculate aggregate quantities from batches
 * - Verify ledger consistency
 * - Report discrepancies
 * - Run weekly
 * 
 * Requirements: 17.9
 */
class InventoryRecalculationJob {
  constructor() {
    this.jobName = 'InventoryRecalculation';
    this.discrepancyThreshold = 0.01; // Allow 0.01 unit difference for floating point errors
  }

  /**
   * Execute the inventory recalculation job for a specific company
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
      const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
      const InventoryLedger = getInventoryLedgerModel(companyDB);

      // Step 1: Recalculate aggregate quantities from batches
      const recalculationResult = await this.recalculateAggregateQuantities(
        InventoryBatchLocation,
        InventoryItemLocation
      );

      // Step 2: Verify ledger consistency
      const ledgerVerificationResult = await this.verifyLedgerConsistency(
        InventoryItemLocation,
        InventoryLedger
      );

      // Step 3: Report discrepancies if any
      if (recalculationResult.discrepancies.length > 0 || ledgerVerificationResult.discrepancies.length > 0) {
        await this.reportDiscrepancies(
          companyId,
          recalculationResult.discrepancies,
          ledgerVerificationResult.discrepancies
        );
      }

      const duration = Date.now() - startTime;
      const result = {
        success: true,
        companyId,
        executedAt: new Date(),
        duration,
        inventoryItemsChecked: recalculationResult.checked,
        inventoryItemsCorrected: recalculationResult.corrected,
        batchDiscrepancies: recalculationResult.discrepancies.length,
        ledgerDiscrepancies: ledgerVerificationResult.discrepancies.length,
        totalDiscrepancies: recalculationResult.discrepancies.length + ledgerVerificationResult.discrepancies.length
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
   * Recalculate aggregate quantities from batches
   * @param {Model} InventoryBatchLocation - Batch model
   * @param {Model} InventoryItemLocation - Inventory item location model
   * @returns {Promise<Object>} Recalculation result
   */
  async recalculateAggregateQuantities(InventoryBatchLocation, InventoryItemLocation) {
    logger.info(`[${this.jobName}] Recalculating aggregate quantities from batches`);

    const discrepancies = [];
    let checked = 0;
    let corrected = 0;

    // Get all active inventory item locations
    const inventoryItems = await InventoryItemLocation.find({ isActive: true });

    for (const item of inventoryItems) {
      checked++;

      // Aggregate batch quantities for this item at this location
      const batchAggregation = await InventoryBatchLocation.aggregate([
        {
          $match: {
            locationId: item.locationId,
            inventoryItem: item.inventoryItem,
            isActive: true,
            status: 'active'
          }
        },
        {
          $group: {
            _id: null,
            totalAvailable: { $sum: '$availableQuantity' },
            totalReserved: { $sum: '$reservedQuantity' }
          }
        }
      ]);

      const batchTotals = batchAggregation[0] || { totalAvailable: 0, totalReserved: 0 };

      // Check for discrepancies
      const availableDiff = Math.abs(item.availableQuantity - batchTotals.totalAvailable);
      const reservedDiff = Math.abs(item.reservedQuantity - batchTotals.totalReserved);

      if (availableDiff > this.discrepancyThreshold || reservedDiff > this.discrepancyThreshold) {
        discrepancies.push({
          type: 'batch_aggregation',
          locationId: item.locationId,
          inventoryItem: item.inventoryItem,
          currentAvailable: item.availableQuantity,
          calculatedAvailable: batchTotals.totalAvailable,
          availableDifference: item.availableQuantity - batchTotals.totalAvailable,
          currentReserved: item.reservedQuantity,
          calculatedReserved: batchTotals.totalReserved,
          reservedDifference: item.reservedQuantity - batchTotals.totalReserved
        });

        // Auto-correct the discrepancy
        item.availableQuantity = batchTotals.totalAvailable;
        item.reservedQuantity = batchTotals.totalReserved;
        await item.save();
        corrected++;

        logger.warn(`[${this.jobName}] Corrected batch aggregation discrepancy for item ${item.inventoryItem} at location ${item.locationId}`);
      }
    }

    logger.info(`[${this.jobName}] Checked ${checked} inventory items, corrected ${corrected}, found ${discrepancies.length} discrepancies`);
    return { checked, corrected, discrepancies };
  }

  /**
   * Verify ledger consistency
   * @param {Model} InventoryItemLocation - Inventory item location model
   * @param {Model} InventoryLedger - Inventory ledger model
   * @returns {Promise<Object>} Verification result
   */
  async verifyLedgerConsistency(InventoryItemLocation, InventoryLedger) {
    logger.info(`[${this.jobName}] Verifying ledger consistency`);

    const discrepancies = [];

    // Sample verification: Check that the latest ledger entry matches current inventory state
    // In a full implementation, you would replay all ledger entries and verify the final state
    
    const inventoryItems = await InventoryItemLocation.find({ isActive: true }).limit(100); // Sample check

    for (const item of inventoryItems) {
      // Get the most recent ledger entry for this item at this location
      const latestEntry = await InventoryLedger.findOne({
        locationId: item.locationId,
        inventoryItem: item.inventoryItem
      })
        .sort({ createdAt: -1 })
        .lean();

      if (latestEntry) {
        // Verify that the latest ledger entry's "after" values match current inventory
        const availableDiff = Math.abs(item.availableQuantity - latestEntry.afterAvailable);
        const reservedDiff = Math.abs(item.reservedQuantity - latestEntry.afterReserved);
        const inTransitDiff = Math.abs(item.inTransitQuantity - latestEntry.afterInTransit);

        if (availableDiff > this.discrepancyThreshold || 
            reservedDiff > this.discrepancyThreshold || 
            inTransitDiff > this.discrepancyThreshold) {
          discrepancies.push({
            type: 'ledger_consistency',
            locationId: item.locationId,
            inventoryItem: item.inventoryItem,
            currentAvailable: item.availableQuantity,
            ledgerAvailable: latestEntry.afterAvailable,
            availableDifference: item.availableQuantity - latestEntry.afterAvailable,
            currentReserved: item.reservedQuantity,
            ledgerReserved: latestEntry.afterReserved,
            reservedDifference: item.reservedQuantity - latestEntry.afterReserved,
            currentInTransit: item.inTransitQuantity,
            ledgerInTransit: latestEntry.afterInTransit,
            inTransitDifference: item.inTransitQuantity - latestEntry.afterInTransit,
            latestLedgerEntry: latestEntry._id,
            latestLedgerDate: latestEntry.createdAt
          });

          logger.warn(`[${this.jobName}] Ledger consistency discrepancy for item ${item.inventoryItem} at location ${item.locationId}`);
        }
      }
    }

    logger.info(`[${this.jobName}] Verified ledger consistency, found ${discrepancies.length} discrepancies`);
    return { discrepancies };
  }

  /**
   * Report discrepancies to administrators
   * @param {string} companyId - Company ID
   * @param {Array} batchDiscrepancies - Batch aggregation discrepancies
   * @param {Array} ledgerDiscrepancies - Ledger consistency discrepancies
   * @returns {Promise<void>}
   */
  async reportDiscrepancies(companyId, batchDiscrepancies, ledgerDiscrepancies) {
    logger.info(`[${this.jobName}] Reporting ${batchDiscrepancies.length + ledgerDiscrepancies.length} discrepancies`);

    const totalDiscrepancies = batchDiscrepancies.length + ledgerDiscrepancies.length;

    try {
      await notificationService.sendToCompanyPrimaryAdmin(companyId, {
        category: 'inventory',
        event: 'inventory_discrepancy_detected',
        title: `Inventory Discrepancies Detected`,
        message: `Weekly inventory recalculation found ${totalDiscrepancies} discrepanc${totalDiscrepancies > 1 ? 'ies' : 'y'}. ${batchDiscrepancies.length} batch aggregation issue${batchDiscrepancies.length !== 1 ? 's' : ''} (auto-corrected) and ${ledgerDiscrepancies.length} ledger consistency issue${ledgerDiscrepancies.length !== 1 ? 's' : ''} (requires review).`,
        data: {
          totalDiscrepancies,
          batchDiscrepanciesCount: batchDiscrepancies.length,
          ledgerDiscrepanciesCount: ledgerDiscrepancies.length,
          batchDiscrepancies: batchDiscrepancies.slice(0, 10), // First 10
          ledgerDiscrepancies: ledgerDiscrepancies.slice(0, 10), // First 10
          executedAt: new Date()
        },
        priority: 'high',
        actionUrl: `/inventory/reports/discrepancies`
      });

      logger.info(`[${this.jobName}] Discrepancy report sent to company admin`);
    } catch (error) {
      logger.error(`[${this.jobName}] Failed to send discrepancy report:`, error);
    }
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

export default new InventoryRecalculationJob();
