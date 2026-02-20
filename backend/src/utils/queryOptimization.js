/**
 * Query Optimization Utilities
 * Provides pagination, filtering, and caching helpers for optimal query performance
 * Designed for 5000+ location deployments with millions of records
 */

import NodeCache from 'node-cache';

/**
 * Query result cache
 * TTL: 5 minutes for most queries, 1 minute for real-time data
 */
const queryCache = new NodeCache({
  stdTTL: 300, // 5 minutes default
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // Don't clone objects for better performance
});

/**
 * Pagination configuration
 */
export const PAGINATION_DEFAULTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 100,
  MAX_LIMIT: 1000,
  MIN_LIMIT: 1
};

/**
 * Parse and validate pagination parameters
 * @param {Object} query - Request query parameters
 * @returns {Object} Validated pagination parameters
 */
export function parsePaginationParams(query) {
  const page = Math.max(
    PAGINATION_DEFAULTS.MIN_LIMIT,
    parseInt(query.page) || PAGINATION_DEFAULTS.DEFAULT_PAGE
  );
  
  let limit = parseInt(query.limit) || PAGINATION_DEFAULTS.DEFAULT_LIMIT;
  limit = Math.min(
    Math.max(PAGINATION_DEFAULTS.MIN_LIMIT, limit),
    PAGINATION_DEFAULTS.MAX_LIMIT
  );
  
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

/**
 * Build paginated response
 * @param {Array} data - Query results
 * @param {Number} total - Total count of records
 * @param {Number} page - Current page
 * @param {Number} limit - Records per page
 * @returns {Object} Paginated response
 */
export function buildPaginatedResponse(data, total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalRecords: total,
      recordsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    }
  };
}

/**
 * Parse and validate sort parameters
 * @param {String} sortParam - Sort parameter (e.g., "createdAt:desc" or "-createdAt")
 * @param {Array} allowedFields - Allowed sort fields
 * @param {String} defaultSort - Default sort field
 * @returns {Object} Mongoose sort object
 */
export function parseSortParams(sortParam, allowedFields, defaultSort = 'createdAt') {
  if (!sortParam) {
    return { [defaultSort]: -1 };
  }
  
  // Support both "field:asc/desc" and "+field/-field" formats
  let field, direction;
  
  if (sortParam.includes(':')) {
    [field, direction] = sortParam.split(':');
    direction = direction.toLowerCase() === 'asc' ? 1 : -1;
  } else if (sortParam.startsWith('-')) {
    field = sortParam.substring(1);
    direction = -1;
  } else if (sortParam.startsWith('+')) {
    field = sortParam.substring(1);
    direction = 1;
  } else {
    field = sortParam;
    direction = 1;
  }
  
  // Validate field
  if (!allowedFields.includes(field)) {
    return { [defaultSort]: -1 };
  }
  
  return { [field]: direction };
}

/**
 * Parse date range filter
 * @param {String} startDate - Start date (ISO string)
 * @param {String} endDate - End date (ISO string)
 * @returns {Object} MongoDB date range query or null
 */
export function parseDateRangeFilter(startDate, endDate) {
  if (!startDate && !endDate) {
    return null;
  }
  
  const filter = {};
  
  if (startDate) {
    filter.$gte = new Date(startDate);
  }
  
  if (endDate) {
    filter.$lte = new Date(endDate);
  }
  
  return filter;
}

/**
 * Build search filter for text fields
 * @param {String} searchTerm - Search term
 * @param {Array} searchFields - Fields to search in
 * @returns {Object} MongoDB $or query or null
 */
export function buildSearchFilter(searchTerm, searchFields) {
  if (!searchTerm || !searchFields || searchFields.length === 0) {
    return null;
  }
  
  const regex = new RegExp(searchTerm, 'i');
  
  return {
    $or: searchFields.map(field => ({
      [field]: regex
    }))
  };
}

/**
 * Generate cache key from query parameters
 * @param {String} prefix - Cache key prefix (e.g., "transfers", "inventory")
 * @param {Object} params - Query parameters
 * @returns {String} Cache key
 */
export function generateCacheKey(prefix, params) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&');
  
  return `${prefix}:${sortedParams}`;
}

/**
 * Get cached query result
 * @param {String} cacheKey - Cache key
 * @returns {Object|null} Cached result or null
 */
export function getCachedResult(cacheKey) {
  return queryCache.get(cacheKey);
}

/**
 * Set cached query result
 * @param {String} cacheKey - Cache key
 * @param {Object} result - Query result
 * @param {Number} ttl - Time to live in seconds (optional)
 */
export function setCachedResult(cacheKey, result, ttl = null) {
  if (ttl) {
    queryCache.set(cacheKey, result, ttl);
  } else {
    queryCache.set(cacheKey, result);
  }
}

/**
 * Invalidate cache by prefix
 * @param {String} prefix - Cache key prefix
 */
export function invalidateCacheByPrefix(prefix) {
  const keys = queryCache.keys();
  const keysToDelete = keys.filter(key => key.startsWith(prefix));
  queryCache.del(keysToDelete);
}

/**
 * Clear all cache
 */
export function clearAllCache() {
  queryCache.flushAll();
}

/**
 * Execute query with caching
 * @param {String} cacheKey - Cache key
 * @param {Function} queryFn - Async function that executes the query
 * @param {Number} ttl - Cache TTL in seconds (optional)
 * @returns {Promise<Object>} Query result
 */
export async function executeWithCache(cacheKey, queryFn, ttl = null) {
  // Check cache first
  const cached = getCachedResult(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Execute query
  const result = await queryFn();
  
  // Cache result
  setCachedResult(cacheKey, result, ttl);
  
  return result;
}

/**
 * Build filter object from query parameters
 * @param {Object} query - Request query parameters
 * @param {Object} filterConfig - Filter configuration
 * @returns {Object} MongoDB filter object
 */
export function buildFilterObject(query, filterConfig) {
  const filter = {};
  
  for (const [key, config] of Object.entries(filterConfig)) {
    const value = query[key];
    
    if (value === undefined || value === null || value === '') {
      continue;
    }
    
    switch (config.type) {
      case 'exact':
        filter[config.field || key] = value;
        break;
        
      case 'boolean':
        if (value === 'true' || value === true) {
          filter[config.field || key] = true;
        } else if (value === 'false' || value === false) {
          filter[config.field || key] = false;
        }
        break;
        
      case 'enum':
        if (config.values.includes(value)) {
          filter[config.field || key] = value;
        }
        break;
        
      case 'objectId':
        if (value.match(/^[0-9a-fA-F]{24}$/)) {
          filter[config.field || key] = value;
        }
        break;
        
      case 'dateRange':
        const dateFilter = parseDateRangeFilter(query[config.startField], query[config.endField]);
        if (dateFilter) {
          filter[config.field || key] = dateFilter;
        }
        break;
        
      case 'search':
        const searchFilter = buildSearchFilter(value, config.fields);
        if (searchFilter) {
          Object.assign(filter, searchFilter);
        }
        break;
        
      case 'number':
        const num = parseFloat(value);
        if (!isNaN(num)) {
          filter[config.field || key] = num;
        }
        break;
        
      case 'numberRange':
        const rangeFilter = {};
        if (query[config.minField]) {
          rangeFilter.$gte = parseFloat(query[config.minField]);
        }
        if (query[config.maxField]) {
          rangeFilter.$lte = parseFloat(query[config.maxField]);
        }
        if (Object.keys(rangeFilter).length > 0) {
          filter[config.field || key] = rangeFilter;
        }
        break;
        
      default:
        filter[config.field || key] = value;
    }
  }
  
  return filter;
}

/**
 * Optimize query with lean and select
 * @param {Query} query - Mongoose query
 * @param {Array} selectFields - Fields to select (optional)
 * @returns {Query} Optimized query
 */
export function optimizeQuery(query, selectFields = null) {
  // Use lean() for read-only queries (faster, returns plain objects)
  query = query.lean();
  
  // Select only needed fields if specified
  if (selectFields && selectFields.length > 0) {
    query = query.select(selectFields.join(' '));
  }
  
  return query;
}

/**
 * Execute paginated query with optimization
 * @param {Model} model - Mongoose model
 * @param {Object} filter - MongoDB filter
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Paginated result
 */
export async function executePaginatedQuery(model, filter, options = {}) {
  const {
    page = PAGINATION_DEFAULTS.DEFAULT_PAGE,
    limit = PAGINATION_DEFAULTS.DEFAULT_LIMIT,
    sort = { createdAt: -1 },
    select = null,
    populate = null,
    lean = true
  } = options;
  
  const skip = (page - 1) * limit;
  
  // Build query
  let query = model.find(filter);
  
  // Apply sort
  query = query.sort(sort);
  
  // Apply pagination
  query = query.skip(skip).limit(limit);
  
  // Apply select
  if (select) {
    query = query.select(select);
  }
  
  // Apply populate
  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach(pop => {
        query = query.populate(pop);
      });
    } else {
      query = query.populate(populate);
    }
  }
  
  // Apply lean for performance
  if (lean) {
    query = query.lean();
  }
  
  // Execute query and count in parallel
  const [data, total] = await Promise.all([
    query.exec(),
    model.countDocuments(filter)
  ]);
  
  return buildPaginatedResponse(data, total, page, limit);
}

/**
 * Cache configuration for different entity types
 */
export const CACHE_CONFIG = {
  // Real-time data (1 minute cache)
  INVENTORY: { ttl: 60, prefix: 'inventory' },
  TRANSFERS: { ttl: 60, prefix: 'transfers' },
  RESERVATIONS: { ttl: 60, prefix: 'reservations' },
  
  // Semi-static data (5 minutes cache)
  LOCATIONS: { ttl: 300, prefix: 'locations' },
  ITEMS: { ttl: 300, prefix: 'items' },
  SUPPLIERS: { ttl: 300, prefix: 'suppliers' },
  
  // Reports and analytics (15 minutes cache)
  REPORTS: { ttl: 900, prefix: 'reports' },
  ANALYTICS: { ttl: 900, prefix: 'analytics' },
  
  // Historical data (1 hour cache)
  LEDGER: { ttl: 3600, prefix: 'ledger' },
  ARCHIVED: { ttl: 3600, prefix: 'archived' }
};

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  return queryCache.getStats();
}

export default {
  parsePaginationParams,
  buildPaginatedResponse,
  parseSortParams,
  parseDateRangeFilter,
  buildSearchFilter,
  generateCacheKey,
  getCachedResult,
  setCachedResult,
  invalidateCacheByPrefix,
  clearAllCache,
  executeWithCache,
  buildFilterObject,
  optimizeQuery,
  executePaginatedQuery,
  getCacheStats,
  PAGINATION_DEFAULTS,
  CACHE_CONFIG
};
