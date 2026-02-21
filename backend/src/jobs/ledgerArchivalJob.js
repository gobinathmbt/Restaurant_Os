import { getCompanyDB } from '../config/database.js';
import { getInventoryLedgerModel } from '../models/company/InventoryLedger.js';
import { getInventoryLedgerArchiveModel } from '../models/company/InventoryLedgerArchive.js';
import { getArchivalMetadataModel } from '../models/company/ArchivalMetadata.js';
import { logger } from '../utils/logger.js';

/**
 * Ledger Archival Job
 * 
 * Responsibilities:
 * - Query entries older than retention period (default: 2 years)
 * - Copy to archive collection in batches
 * - Delete from active collection
 * - Update archival metadata
 * - Run monthly
 * 
 * Requirements: 31.1, 31.2, 31.6
 */
class LedgerArchivalJob {
  constructor() {
    this.jobName = 'LedgerArchival';
    this.defaultRetentionDays = 730; // 2 years
    this.defaultBatchSize = 1000;
  }

  /**
   * Execute the ledger archival job for a specific company
   * @param {string} companyId - Company ID
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job execution result
   */
  async execute(companyId, options = {}) {
    const startTime = Date.now();
    logger.info(`[${this.jobName}] Starting job for company ${companyId}`);

    const companyDB = getCompanyDB(companyId);
    const InventoryLedger = getInventoryLedgerModel(companyDB);
    const InventoryLedgerArchive = getInventoryLedgerArchiveModel(companyDB);
    const ArchivalMetadata = getArchivalMetadataModel(companyDB);

    const retentionDays = options.retentionDays || this.defaultRetentionDays;
    const batchSize = options.batchSize || this.defaultBatchSize;
    const dryRun = options.dryRun || false;

    // Calculate cutoff date (entries older than this will be archived)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    logger.info(`[${this.jobName}] Archiving entries older than ${cutoffDate.toISOString()} (${retentionDays} days)`);

    // Create archival metadata record
    const archivalMetadata = new ArchivalMetadata({
      archivalType: 'inventory_ledger',
      dateRangeStart: new Date(0), // Beginning of time
      dateRangeEnd: cutoffDate,
      entriesArchived: 0,
      entriesFailed: 0,
      status: 'in_progress',
      startedAt: new Date(),
      retentionPeriodDays: retentionDays,
      batchSize: batchSize,
      initiatedBy: options.userId ? 'manual' : 'system',
      userId: options.userId || null,
      notes: dryRun ? 'Dry run - no actual archival performed' : null
    });

    if (!dryRun) {
      await archivalMetadata.save();
    }

    try {
      // Count total entries to archive
      const totalToArchive = await InventoryLedger.countDocuments({
        createdAt: { $lt: cutoffDate }
      });

      logger.info(`[${this.jobName}] Found ${totalToArchive} entries to archive`);

      if (totalToArchive === 0) {
        if (!dryRun) {
          await archivalMetadata.markCompleted();
        }
        
        const duration = Date.now() - startTime;
        return {
          success: true,
          companyId,
          executedAt: new Date(),
          duration,
          totalToArchive: 0,
          entriesArchived: 0,
          entriesFailed: 0,
          dryRun
        };
      }

      let entriesArchived = 0;
      let entriesFailed = 0;
      let hasMore = true;

      // Process in batches
      while (hasMore) {
        try {
          // Fetch a batch of entries to archive
          const entriesToArchive = await InventoryLedger.find({
            createdAt: { $lt: cutoffDate }
          })
            .limit(batchSize)
            .lean();

          if (entriesToArchive.length === 0) {
            hasMore = false;
            break;
          }

          logger.info(`[${this.jobName}] Processing batch of ${entriesToArchive.length} entries`);

          if (!dryRun) {
            // Archive the batch
            const batchResult = await this.archiveBatch(
              entriesToArchive,
              InventoryLedger,
              InventoryLedgerArchive
            );

            entriesArchived += batchResult.archived;
            entriesFailed += batchResult.failed;

            // Update metadata
            archivalMetadata.entriesArchived = entriesArchived;
            archivalMetadata.entriesFailed = entriesFailed;
            await archivalMetadata.save();
          } else {
            // Dry run - just count
            entriesArchived += entriesToArchive.length;
          }

          // Check if we've processed all entries
          if (entriesToArchive.length < batchSize) {
            hasMore = false;
          }
        } catch (batchError) {
          logger.error(`[${this.jobName}] Batch processing error:`, batchError);
          entriesFailed += batchSize; // Assume entire batch failed
          
          if (!dryRun) {
            archivalMetadata.entriesFailed = entriesFailed;
            await archivalMetadata.save();
          }
        }
      }

      // Mark archival as completed
      if (!dryRun) {
        await archivalMetadata.markCompleted();
      }

      const duration = Date.now() - startTime;
      const result = {
        success: true,
        companyId,
        executedAt: new Date(),
        duration,
        totalToArchive,
        entriesArchived,
        entriesFailed,
        successRate: totalToArchive > 0 ? ((entriesArchived / totalToArchive) * 100).toFixed(2) : 100,
        dryRun,
        archivalMetadataId: dryRun ? null : archivalMetadata._id
      };

      logger.info(`[${this.jobName}] Completed for company ${companyId} in ${duration}ms`, result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[${this.jobName}] Failed for company ${companyId}:`, error);

      if (!dryRun) {
        await archivalMetadata.markFailed(error.message, {
          stack: error.stack,
          duration
        });
      }

      return {
        success: false,
        companyId,
        executedAt: new Date(),
        duration,
        error: error.message,
        dryRun
      };
    }
  }

  /**
   * Archive a batch of ledger entries
   * @param {Array} entries - Entries to archive
   * @param {Model} InventoryLedger - Active ledger model
   * @param {Model} InventoryLedgerArchive - Archive ledger model
   * @returns {Promise<Object>} Batch result
   */
  async archiveBatch(entries, InventoryLedger, InventoryLedgerArchive) {
    let archived = 0;
    let failed = 0;

    // Use a session for transaction
    const session = await InventoryLedger.db.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Prepare archive documents
        const archiveDocuments = entries.map(entry => ({
          ...entry,
          _id: entry._id, // Preserve original ID
          originalCreatedAt: entry.createdAt,
          originalUpdatedAt: entry.updatedAt,
          archivedAt: new Date()
        }));

        // Insert into archive collection
        await InventoryLedgerArchive.insertMany(archiveDocuments, { session, ordered: false });

        // Delete from active collection
        const entryIds = entries.map(e => e._id);
        const deleteResult = await InventoryLedger.deleteMany(
          { _id: { $in: entryIds } },
          { session }
        );

        archived = deleteResult.deletedCount;
        failed = entries.length - archived;

        logger.info(`[${this.jobName}] Archived ${archived} entries, ${failed} failed in batch`);
      });
    } catch (error) {
      logger.error(`[${this.jobName}] Batch archival transaction failed:`, error);
      failed = entries.length;
    } finally {
      await session.endSession();
    }

    return { archived, failed };
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
      totalEntriesArchived: results
        .filter(r => r.status === 'fulfilled' && r.value.success)
        .reduce((sum, r) => sum + r.value.entriesArchived, 0),
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message })
    };

    logger.info(`[${this.jobName}] Completed for all companies:`, summary);
    return summary;
  }

  /**
   * Get archival statistics for a company
   * @param {string} companyId - Company ID
   * @returns {Promise<Object>} Archival statistics
   */
  async getArchivalStats(companyId) {
    const companyDB = getCompanyDB(companyId);
    const InventoryLedger = getInventoryLedgerModel(companyDB);
    const InventoryLedgerArchive = getInventoryLedgerArchiveModel(companyDB);
    const ArchivalMetadata = getArchivalMetadataModel(companyDB);

    const [activeCount, archivedCount, lastArchival, totalArchivalRuns] = await Promise.all([
      InventoryLedger.countDocuments(),
      InventoryLedgerArchive.countDocuments(),
      ArchivalMetadata.findOne({ status: 'completed' }).sort({ completedAt: -1 }).lean(),
      ArchivalMetadata.countDocuments({ status: 'completed' })
    ]);

    return {
      activeEntries: activeCount,
      archivedEntries: archivedCount,
      totalEntries: activeCount + archivedCount,
      lastArchivalDate: lastArchival?.completedAt || null,
      lastArchivalEntriesArchived: lastArchival?.entriesArchived || 0,
      totalArchivalRuns
    };
  }
}

export default new LedgerArchivalJob();
