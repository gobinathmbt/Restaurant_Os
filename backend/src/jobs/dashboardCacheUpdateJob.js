import { getCompanyDB } from '../config/database.js';
import { getDashboardCacheModel } from '../models/company/DashboardCache.js';
import { getStockRequestModel } from '../models/company/StockRequest.js';
import { getStockTransferModel } from '../models/company/StockTransfer.js';
import { getStockBackorderModel } from '../models/company/StockBackorder.js';
import { logger } from '../utils/logger.js';

/**
 * Dashboard Cache Update Job
 * 
 * Responsibilities:
 * - Query aggregated statistics from StockRequest, StockTransfer, StockBackorder collections
 * - Calculate performance metrics (average approval time, completion time)
 * - Identify top requested items and locations
 * - Update DashboardCache collection for fast dashboard queries (< 200ms)
 * - Run every 5 minutes
 * 
 * Requirements: 16.8, 6.8, 16.1-16.10
 */
class DashboardCacheUpdateJob {
  constructor() {
    this.jobName = 'DashboardCacheUpdate';
  }

  /**
   * Execute the dashboard cache update job for a specific company
   * @param {string} companyId - Company ID
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job execution result
   */
  async execute(companyId, options = {}) {
    const startTime = Date.now();
    logger.info(`[${this.jobName}] Starting job for company ${companyId}`);

    try {
      const companyDB = getCompanyDB(companyId);
      const DashboardCache = getDashboardCacheModel(companyDB);
      const StockRequest = getStockRequestModel(companyDB);
      const StockTransfer = getStockTransferModel(companyDB);
      const StockBackorder = getStockBackorderModel(companyDB);

      // Get or create cache document
      const cache = await DashboardCache.getOrCreate(companyId);

      // Step 1: Aggregate request counts by status
      const requestCounts = await this.aggregateRequestCounts(StockRequest, companyId);

      // Step 2: Aggregate transfer counts by status
      const transferCounts = await this.aggregateTransferCounts(StockTransfer, companyId);

      // Step 3: Aggregate backorder counts by location
      const backorderData = await this.aggregateBackorderCounts(StockBackorder, companyId);

      // Step 4: Calculate performance metrics (last 30 days)
      const performanceMetrics = await this.calculatePerformanceMetrics(
        StockRequest,
        StockTransfer,
        companyId
      );

      // Step 5: Get top 10 most requested items
      const topRequestedItems = await this.getTopRequestedItems(StockRequest, companyId);

      // Step 6: Get top 10 locations by pending requests
      const topLocations = await this.getTopLocationsByPendingRequests(StockRequest, companyId);

      // Update cache
      cache.requestCounts = requestCounts;
      cache.transferCounts = transferCounts;
      cache.backorderCountsByLocation = backorderData.byLocation;
      cache.totalPendingBackorders = backorderData.total;
      cache.performanceMetrics = performanceMetrics;
      cache.topRequestedItems = topRequestedItems;
      cache.topLocationsByPendingRequests = topLocations;
      cache.lastUpdatedAt = new Date();
      cache.lastUpdatedBy = 'system';
      cache.dataAsOfDate = new Date();
      cache.updateDurationMs = Date.now() - startTime;

      await cache.save();

      const duration = Date.now() - startTime;
      const result = {
        success: true,
        companyId,
        executedAt: new Date(),
        duration,
        cacheUpdated: true,
        stats: {
          requestCounts,
          transferCounts,
          totalPendingBackorders: backorderData.total,
          backorderLocations: backorderData.byLocation.length,
          topItemsCount: topRequestedItems.length,
          topLocationsCount: topLocations.length
        }
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
   * Aggregate request counts by status
   * @param {Model} StockRequest - StockRequest model
   * @param {string} companyId - Company ID
   * @returns {Promise<Object>} Request counts
   */
  async aggregateRequestCounts(StockRequest, companyId) {
    const results = await StockRequest.aggregate([
      {
        $match: {
          companyId: companyId,
          isArchived: false
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const counts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0
    };

    results.forEach(result => {
      if (counts.hasOwnProperty(result._id)) {
        counts[result._id] = result.count;
      }
    });

    return counts;
  }

  /**
   * Aggregate transfer counts by status
   * @param {Model} StockTransfer - StockTransfer model
   * @param {string} companyId - Company ID
   * @returns {Promise<Object>} Transfer counts
   */
  async aggregateTransferCounts(StockTransfer, companyId) {
    const results = await StockTransfer.aggregate([
      {
        $match: {
          companyId: companyId,
          isArchived: false
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const counts = {
      approved: 0,
      in_transit: 0,
      completed: 0,
      cancelled: 0
    };

    results.forEach(result => {
      if (counts.hasOwnProperty(result._id)) {
        counts[result._id] = result.count;
      }
    });

    return counts;
  }

  /**
   * Aggregate backorder counts by destinationLocation
   * @param {Model} StockBackorder - StockBackorder model
   * @param {string} companyId - Company ID
   * @returns {Promise<Object>} Backorder data
   */
  async aggregateBackorderCounts(StockBackorder, companyId) {
    const results = await StockBackorder.aggregate([
      {
        $match: {
          companyId: companyId,
          status: 'pending',
          isArchived: false
        }
      },
      {
        $group: {
          _id: '$destinationLocation',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'locations',
          localField: '_id',
          foreignField: '_id',
          as: 'locationData'
        }
      },
      {
        $unwind: {
          path: '$locationData',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          destinationLocation: '$_id',
          locationName: '$locationData.name',
          locationCode: '$locationData.code',
          pendingBackorderCount: '$count'
        }
      },
      {
        $sort: { pendingBackorderCount: -1 }
      }
    ]);

    const total = results.reduce((sum, item) => sum + item.pendingBackorderCount, 0);

    return {
      byLocation: results,
      total
    };
  }

  /**
   * Calculate performance metrics for last 30 days
   * @param {Model} StockRequest - StockRequest model
   * @param {Model} StockTransfer - StockTransfer model
   * @param {string} companyId - Company ID
   * @returns {Promise<Object>} Performance metrics
   */
  async calculatePerformanceMetrics(StockRequest, StockTransfer, companyId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Calculate average approval time
    const approvalTimeResults = await StockRequest.aggregate([
      {
        $match: {
          companyId: companyId,
          status: 'approved',
          approvedDate: { $gte: thirtyDaysAgo },
          requestDate: { $exists: true },
          approvedDate: { $exists: true }
        }
      },
      {
        $project: {
          approvalTimeMs: {
            $subtract: ['$approvedDate', '$requestDate']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgApprovalTimeMs: { $avg: '$approvalTimeMs' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate average completion time
    const completionTimeResults = await StockTransfer.aggregate([
      {
        $match: {
          companyId: companyId,
          status: 'completed',
          completedDate: { $gte: thirtyDaysAgo },
          requestDate: { $exists: true },
          completedDate: { $exists: true }
        }
      },
      {
        $project: {
          completionTimeMs: {
            $subtract: ['$completedDate', '$requestDate']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgCompletionTimeMs: { $avg: '$completionTimeMs' },
          count: { $sum: 1 }
        }
      }
    ]);

    const metrics = {};

    if (approvalTimeResults.length > 0) {
      const avgMs = approvalTimeResults[0].avgApprovalTimeMs;
      metrics.averageApprovalTimeHours = avgMs ? Number((avgMs / (1000 * 60 * 60)).toFixed(2)) : 0;
      metrics.approvalTimeSampleSize = approvalTimeResults[0].count;
    } else {
      metrics.averageApprovalTimeHours = 0;
      metrics.approvalTimeSampleSize = 0;
    }

    if (completionTimeResults.length > 0) {
      const avgMs = completionTimeResults[0].avgCompletionTimeMs;
      metrics.averageCompletionTimeHours = avgMs ? Number((avgMs / (1000 * 60 * 60)).toFixed(2)) : 0;
      metrics.completionTimeSampleSize = completionTimeResults[0].count;
    } else {
      metrics.averageCompletionTimeHours = 0;
      metrics.completionTimeSampleSize = 0;
    }

    return metrics;
  }

  /**
   * Get top 10 most requested items
   * @param {Model} StockRequest - StockRequest model
   * @param {string} companyId - Company ID
   * @returns {Promise<Array>} Top requested items
   */
  async getTopRequestedItems(StockRequest, companyId) {
    const results = await StockRequest.aggregate([
      {
        $match: {
          companyId: companyId,
          isArchived: false
        }
      },
      {
        $unwind: '$items'
      },
      {
        $group: {
          _id: '$items.inventoryItem',
          totalRequestedQuantity: { $sum: '$items.requestedQuantity' },
          unit: { $first: '$items.unit' }
        }
      },
      {
        $lookup: {
          from: 'inventoryitems',
          localField: '_id',
          foreignField: '_id',
          as: 'itemData'
        }
      },
      {
        $unwind: {
          path: '$itemData',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          inventoryItem: '$_id',
          itemName: '$itemData.name',
          itemCode: '$itemData.code',
          totalRequestedQuantity: 1,
          unit: 1
        }
      },
      {
        $sort: { totalRequestedQuantity: -1 }
      },
      {
        $limit: 10
      }
    ]);

    return results;
  }

  /**
   * Get top 10 locations by pending requests
   * @param {Model} StockRequest - StockRequest model
   * @param {string} companyId - Company ID
   * @returns {Promise<Array>} Top locations
   */
  async getTopLocationsByPendingRequests(StockRequest, companyId) {
    const results = await StockRequest.aggregate([
      {
        $match: {
          companyId: companyId,
          status: 'pending',
          isArchived: false
        }
      },
      {
        $group: {
          _id: '$sourceLocation',
          pendingRequestCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'locations',
          localField: '_id',
          foreignField: '_id',
          as: 'locationData'
        }
      },
      {
        $unwind: {
          path: '$locationData',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          location: '$_id',
          locationName: '$locationData.name',
          locationCode: '$locationData.code',
          pendingRequestCount: 1
        }
      },
      {
        $sort: { pendingRequestCount: -1 }
      },
      {
        $limit: 10
      }
    ]);

    return results;
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

export default new DashboardCacheUpdateJob();
