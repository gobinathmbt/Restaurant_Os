import mongoose from 'mongoose';

/**
 * Top Requested Item Sub-Schema
 * Tracks most requested inventory items
 */
const topRequestedItemSchema = new mongoose.Schema({
  inventoryItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  itemName: {
    type: String,
    required: true
  },
  itemCode: {
    type: String
  },
  totalRequestedQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true
  }
}, { _id: false });

/**
 * Top Location Sub-Schema
 * Tracks locations with most pending requests
 */
const topLocationSchema = new mongoose.Schema({
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  locationName: {
    type: String,
    required: true
  },
  locationCode: {
    type: String
  },
  pendingRequestCount: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

/**
 * Backorder Count by Location Sub-Schema
 * Tracks backorder counts grouped by destinationLocation
 */
const backorderCountSchema = new mongoose.Schema({
  destinationLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  locationName: {
    type: String,
    required: true
  },
  locationCode: {
    type: String
  },
  pendingBackorderCount: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

/**
 * DashboardCache Schema
 * Stores aggregated statistics for fast dashboard queries (< 200ms)
 * Updated every 5 minutes via background job
 * 
 * Requirements: 6.8, 6.9, 16.1-16.10
 */
const dashboardCacheSchema = new mongoose.Schema({
  // Company isolation for multi-tenant architecture
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  // Cache type identifier (for future extensibility)
  cacheType: {
    type: String,
    required: true,
    enum: ['stock_requests_dashboard'],
    default: 'stock_requests_dashboard'
  },
  
  // Stock Request Counts by Status
  requestCounts: {
    pending: {
      type: Number,
      default: 0,
      min: 0
    },
    approved: {
      type: Number,
      default: 0,
      min: 0
    },
    rejected: {
      type: Number,
      default: 0,
      min: 0
    },
    cancelled: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Stock Transfer Counts by Status
  transferCounts: {
    approved: {
      type: Number,
      default: 0,
      min: 0
    },
    in_transit: {
      type: Number,
      default: 0,
      min: 0
    },
    completed: {
      type: Number,
      default: 0,
      min: 0
    },
    cancelled: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Backorder Counts by Location
  backorderCountsByLocation: {
    type: [backorderCountSchema],
    default: []
  },
  
  // Total pending backorders across all locations
  totalPendingBackorders: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Performance Metrics (last 30 days)
  performanceMetrics: {
    // Average time from request to approval (in hours)
    averageApprovalTimeHours: {
      type: Number,
      min: 0
    },
    // Average time from approval to transfer completion (in hours)
    averageCompletionTimeHours: {
      type: Number,
      min: 0
    },
    // Sample size for approval time calculation
    approvalTimeSampleSize: {
      type: Number,
      default: 0,
      min: 0
    },
    // Sample size for completion time calculation
    completionTimeSampleSize: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Top 10 Most Requested Items
  topRequestedItems: {
    type: [topRequestedItemSchema],
    default: [],
    validate: {
      validator: function(items) {
        return items.length <= 10;
      },
      message: 'Top requested items cannot exceed 10'
    }
  },
  
  // Top 10 Locations by Pending Requests
  topLocationsByPendingRequests: {
    type: [topLocationSchema],
    default: [],
    validate: {
      validator: function(locations) {
        return locations.length <= 10;
      },
      message: 'Top locations cannot exceed 10'
    }
  },
  
  // Cache metadata
  lastUpdatedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  lastUpdatedBy: {
    type: String,
    default: 'system'
  },
  updateDurationMs: {
    type: Number,
    min: 0
  },
  
  // Data freshness indicator
  dataAsOfDate: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for fast lookups
dashboardCacheSchema.index({ companyId: 1, cacheType: 1 }, { unique: true });
dashboardCacheSchema.index({ lastUpdatedAt: -1 });
dashboardCacheSchema.index({ companyId: 1, lastUpdatedAt: -1 });

/**
 * Static method to get or create cache for a company
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Dashboard cache document
 */
dashboardCacheSchema.statics.getOrCreate = async function(companyId) {
  let cache = await this.findOne({
    companyId,
    cacheType: 'stock_requests_dashboard'
  });
  
  if (!cache) {
    cache = await this.create({
      companyId,
      cacheType: 'stock_requests_dashboard',
      requestCounts: {
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0
      },
      transferCounts: {
        approved: 0,
        in_transit: 0,
        completed: 0,
        cancelled: 0
      },
      backorderCountsByLocation: [],
      totalPendingBackorders: 0,
      performanceMetrics: {},
      topRequestedItems: [],
      topLocationsByPendingRequests: []
    });
  }
  
  return cache;
};

/**
 * Instance method to check if cache is stale
 * @param {number} maxAgeMinutes - Maximum age in minutes (default: 5)
 * @returns {boolean} Whether cache is stale
 */
dashboardCacheSchema.methods.isStale = function(maxAgeMinutes = 5) {
  const ageMs = Date.now() - this.lastUpdatedAt.getTime();
  const maxAgeMs = maxAgeMinutes * 60 * 1000;
  return ageMs > maxAgeMs;
};

// Export model factory function following existing pattern
export const getDashboardCacheModel = (companyDB) => {
  return companyDB.model('DashboardCache', dashboardCacheSchema);
};

export default dashboardCacheSchema;
