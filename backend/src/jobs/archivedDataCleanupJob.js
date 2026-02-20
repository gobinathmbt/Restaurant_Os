import { getCompanyDB } from '../config/database.js';
import { getInventoryLedgerModel } from '../models/company/InventoryLedger.js';
import { getInventoryLedgerArchiveModel } from '../models/company/InventoryLedgerArchive.js';
import { getArchivalMetadataModel } from '../models/company/ArchivalMetadata.js';
import { getStockTransferModel } from '../models/company/StockTransfer.js';
import notificationService from '../services/notificationService.js';
import { logger } from '../utils/logger.js';

/**
 * Archived Data Cleanup Job
 * 
 * Responsibilities:
 * - Archive old ledger entries (older than retention period)
 * - Archive completed transfers (older than retention period)
 * - Maintain audit trail integrity
 * - Run monthly
 * 
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5
 */
class ArchivedDataCleanupJob {
  constructor() {
    this.jobName = 'ArchivedDataCleanup';
    this.ledgerRetentionDays = 730; // Default: 2 years
    this.transferRetentionDays = 730; // Default: 2 years
    this.batchSize = 1000; // Process in batches to avoid memory issues
  }

  /**
   * Execute the archived data cleanup job for a specific company
   * @param {string} companyId - Company ID
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job execution result
   */
  async execute(companyId, options = {}) {
    const startTime = Date.now();
    logger.info(`[${this.jobName}] Starting job for company ${companyId}`);

    try {
      const companyDB = getCompanyDB(companyId);
      const InventoryLedger = getInventoryLedgerModel(companyDB);
      const InventoryLedgerArchive = getInventoryLedgerArchiveModel(companyDB);
      const ArchivalMetadata = getArchivalMetadataModel(companyDB);
      const StockTransfer = getStockTransferModel(companyDB);

      const ledgerRetentionDays = options.ledgerRetentionDays || this.ledgerRetentionDays;
      const transferRetentionDays = options.transferRetentionDays || this.transferRetentionDays;

      // Calculate cutoff dates
      const now = new Date();
      const ledgerCutoffDate = new Date(now);
      ledgerCutoffDate.setDate(ledgerCutoffDate.getDate() - ledgerRetentionDays);

      const transferCutoffDate = new Date(now);
      transferCutoffDate.setDate(transferCutoffDate.getDate() - transferRetentionDays);

      // Step 1: Archive old ledger entries
      const ledgerArchivalResult = await this.archiveLedgerEntries(
        InventoryLedger,
        InventoryLedgerArchive,
        ArchivalMetadata,
        ledgerCutoffDate
      );

      // Step 2: Archive completed transfers (soft archive - just mark as archived)
      const transferArchivalResult = await this.archiveCompletedTransfers(
        StockTransfer,
        transferCutoffDate
      );

      // Step 3: Send summary notification
      await this.sendArchivalSummary(
        companyId,
        ledgerArchivalResult,
        transferArchivalResult,
        ledgerRetentionDays,
        transferRetentionDays
      );

      const duration = Date.now() - startTime;
      const result = {
        success: true,
        companyId,
        executedAt: now,
        duration,
        ledgerEntriesArchived: ledgerArchivalResult.archived,
        ledgerEntriesDeleted: ledgerArchivalResult.deleted,
        transfersArchived: transferArchivalResult.archived,
        ledgerRetentionDays,
        transferRetentionDays
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
   * Archive old ledger entries
   * @param {Model} InventoryLedger - Ledger model
   * @param {Model} InventoryLedgerArchive - Archive model
   * @param {Model} ArchivalMetadata - Metadata model
   * @param {Date} cutoffDate - Cutoff date for archival
   * @returns {Promise<Object>} Archival result
   */
  async archiveLedgerEntries(InventoryLedger, InventoryLedgerArchive, ArchivalMetadata, cutoffDate) {
    logger.info(`[${this.jobName}] Archiving ledger entries older than ${cutoffDate.toISOString()}`);

    // Create archival metadata record
    const metadata = await ArchivalMetadata.create({
      archivalType: 'LEDGER_ENTRIES',
      periodStart: new Date(0), // Beginning of time
      periodEnd: cutoffDate,
      entriesArchived: 0,
      status: 'in_progress',
      startedDate: new Date()
    });

    let totalArchived = 0;
    let totalDeleted = 0;

    try {
      // Process in batches to avoid memory issues
      let hasMore = true;
      
      while (hasMore) {
        // Find a batch of old entries
        const entriesToArchive = await InventoryLedger.find({
          createdAt: { $lt: cutoffDate }
        })
          .limit(this.batchSize)
          .lean();

        if (entriesToArchive.length === 0) {
          hasMore = false;
          break;
        }

        // Transform entries for archive (preserve createdAt as originalCreatedAt)
        const archiveEntries = entriesToArchive.map(entry => ({
          ...entry,
          _id: entry._id, // Preserve original ID
          originalCreatedAt: entry.createdAt,
          archivedDate: new Date()
        }));

        // Insert into archive collection
        await InventoryLedgerArchive.insertMany(archiveEntries, { ordered: false });

        // Delete from active collection
        const entryIds = entriesToArchive.map(e => e._id);
        const deleteResult = await InventoryLedger.deleteMany({
          _id: { $in: entryIds }
        });

        totalArchived += archiveEntries.length;
        totalDeleted += deleteResult.deletedCount;

        logger.info(`[${this.jobName}] Archived batch: ${archiveEntries.length} entries, deleted: ${deleteResult.deletedCount}`);
      }

      // Update metadata
      metadata.entriesArchived = totalArchived;
      metadata.status = 'completed';
      metadata.completedDate = new Date();
      metadata.durationMs = Date.now() - metadata.startedDate.getTime();
      await metadata.save();

      logger.info(`[${this.jobName}] Archived ${totalArchived} ledger entries, deleted ${totalDeleted} from active collection`);
      return { archived: totalArchived, deleted: totalDeleted };
    } catch (error) {
      // Update metadata with error
      metadata.status = 'failed';
      metadata.errorMessage = error.message;
      metadata.completedDate = new Date();
      metadata.durationMs = Date.now() - metadata.startedDate.getTime();
      await metadata.save();

      logger.error(`[${this.jobName}] Failed to archive ledger entries:`, error);
      throw error;
    }
  }

  /**
   * Archive completed transfers (soft archive)
   * @param {Model} StockTransfer - Transfer model
   * @param {Date} cutoffDate - Cutoff date for archival
   * @returns {Promise<Object>} Archival result
   */
  async archiveCompletedTransfers(StockTransfer, cutoffDate) {
    logger.info(`[${this.jobName}] Archiving completed transfers older than ${cutoffDate.toISOString()}`);

    // Note: StockTransfer records are never deleted (audit trail requirement)
    // We just mark them as archived for query optimization
    
    // Check if the model has isArchived field
    const sampleTransfer = await StockTransfer.findOne();
    if (!sampleTransfer || !('isArchived' in sampleTransfer.toObject())) {
      logger.warn(`[${this.jobName}] StockTransfer model does not have isArchived field, skipping transfer archival`);
      return { archived: 0 };
    }

    const result = await StockTransfer.updateMany(
      {
        status: { $in: ['completed', 'rejected', 'cancelled', 'returned'] },
        completedDate: { $lt: cutoffDate },
        isArchived: { $ne: true }
      },
      {
        $set: { isArchived: true }
      }
    );

    logger.info(`[${this.jobName}] Marked ${result.modifiedCount} transfers as archived`);
    return { archived: result.modifiedCount };
  }

  /**
   * Send archival summary notification
   * @param {string} companyId - Company ID
   * @param {Object} ledgerResult - Ledger archival result
   * @param {Object} transferResult - Transfer archival result
   * @param {number} ledgerRetentionDays - Ledger retention days
   * @param {number} transferRetentionDays - Transfer retention days
   * @returns {Promise<void>}
   */
  async sendArchivalSummary(companyId, ledgerResult, transferResult, ledgerRetentionDays, transferRetentionDays) {
    logger.info(`[${this.jobName}] Sending archival summary notification`);

    try {
      await notificationService.sendToCompanyPrimaryAdmin(companyId, {
        category: 'system',
        event: 'data_archival_completed',
        title: 'Monthly Data Archival Completed',
        message: `Data archival completed successfully. ${ledgerResult.archived} ledger entries archived (retention: ${ledgerRetentionDays} days), ${transferResult.archived} transfers archived (retention: ${transferRetentionDays} days).`,
        data: {
          ledgerEntriesArchived: ledgerResult.archived,
          ledgerEntriesDeleted: ledgerResult.deleted,
          transfersArchived: transferResult.archived,
          ledgerRetentionDays,
          transferRetentionDays,
          executedAt: new Date()
        },
        priority: 'low',
        actionUrl: `/system/archival-reports`
      });

      logger.info(`[${this.jobName}] Archival summary notification sent`);
    } catch (error) {
      logger.error(`[${this.jobName}] Failed to send archival summary:`, error);
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

export default new ArchivedDataCleanupJob();
