/**
 * Inventory Ledger Service
 * Business logic for inventory ledger operations
 * Provides immutable audit trail of all inventory movements
 */

import { getCompanyDB } from '../config/database.js';
import { getInventoryLedgerModel } from '../models/company/InventoryLedger.js';
import { getInventoryLedgerArchiveModel } from '../models/company/InventoryLedgerArchive.js';
import { logger } from '../utils/logger.js';

/**
 * Record a ledger entry for inventory movement
 * @param {Object} entryData - Ledger entry data
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Created ledger entry
 */
export const recordLedgerEntry = async (entryData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryLedger = getInventoryLedgerModel(companyDB);

    // Validate required fields
    const requiredFields = [
      'inventoryItem',
      'locationId',
      'movementType',
      'quantityDelta',
      'beforeAvailable',
      'afterAvailable',
      'beforeReserved',
      'afterReserved',
      'beforeInTransit',
      'afterInTransit',
      'referenceType',
      'referenceId',
      'performedBy'
    ];

    const missingFields = requiredFields.filter(field => entryData[field] === undefined || entryData[field] === null);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields for ledger entry: ${missingFields.join(', ')}`);
    }

    // Validate movement type
    const validMovementTypes = [
      'grn',
      'transfer_out',
      'transfer_in',
      'return_in',
      'return_out',
      'adjustment',
      'reservation',
      'release',
      'consumption',
      'damage',
      'expiry',
      'theft'
    ];

    if (!validMovementTypes.includes(entryData.movementType)) {
      throw new Error(`Invalid movement type: ${entryData.movementType}. Must be one of: ${validMovementTypes.join(', ')}`);
    }

    // Validate reference type
    const validReferenceTypes = ['GRN', 'TRANSFER', 'ADJUSTMENT', 'RESERVATION', 'ORDER', 'STOCK_COUNT'];
    
    if (!validReferenceTypes.includes(entryData.referenceType)) {
      throw new Error(`Invalid reference type: ${entryData.referenceType}. Must be one of: ${validReferenceTypes.join(', ')}`);
    }

    // Create ledger entry
    const ledgerEntry = new InventoryLedger({
      inventoryItem: entryData.inventoryItem,
      locationId: entryData.locationId,
      batchNumber: entryData.batchNumber,
      movementType: entryData.movementType,
      quantityDelta: entryData.quantityDelta,
      beforeAvailable: entryData.beforeAvailable,
      afterAvailable: entryData.afterAvailable,
      beforeReserved: entryData.beforeReserved,
      afterReserved: entryData.afterReserved,
      beforeInTransit: entryData.beforeInTransit,
      afterInTransit: entryData.afterInTransit,
      referenceType: entryData.referenceType,
      referenceId: entryData.referenceId,
      referenceNumber: entryData.referenceNumber,
      unitCost: entryData.unitCost,
      totalValue: entryData.totalValue,
      performedBy: entryData.performedBy,
      reason: entryData.reason,
      notes: entryData.notes,
      correlationId: entryData.correlationId
    });

    await ledgerEntry.save();

    logger.info(`Ledger entry recorded: ${ledgerEntry._id} for item ${entryData.inventoryItem} at location ${entryData.locationId}`);

    return ledgerEntry;
  } catch (error) {
    logger.error('Error recording ledger entry:', error);
    throw error;
  }
};

/**
 * Get ledger entries with filtering
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated ledger entries
 */
export const getLedgerEntries = async (companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryLedger = getInventoryLedgerModel(companyDB);

    const {
      page = 1,
      limit = 100,
      locationId,
      inventoryItem,
      movementType,
      referenceType,
      referenceId,
      performedBy,
      batchNumber,
      correlationId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters;

    // Build query
    const query = {};

    // Location filter
    if (locationId) {
      query.locationId = locationId;
    }

    // Inventory item filter
    if (inventoryItem) {
      query.inventoryItem = inventoryItem;
    }

    // Movement type filter
    if (movementType) {
      if (Array.isArray(movementType)) {
        query.movementType = { $in: movementType };
      } else {
        query.movementType = movementType;
      }
    }

    // Reference type filter
    if (referenceType) {
      query.referenceType = referenceType;
    }

    // Reference ID filter
    if (referenceId) {
      query.referenceId = referenceId;
    }

    // Performed by filter
    if (performedBy) {
      query.performedBy = performedBy;
    }

    // Batch number filter
    if (batchNumber) {
      query.batchNumber = batchNumber;
    }

    // Correlation ID filter
    if (correlationId) {
      query.correlationId = correlationId;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [entries, total] = await Promise.all([
      InventoryLedger.find(query)
        .populate('inventoryItem', 'name code unit')
        .populate('locationId', 'name code type')
        .populate('performedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      InventoryLedger.countDocuments(query)
    ]);

    return {
      entries,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting ledger entries:', error);
    throw error;
  }
};

/**
 * Get inventory movements for reporting
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Inventory movements
 */
export const getInventoryMovements = async (companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryLedger = getInventoryLedgerModel(companyDB);

    const {
      locationId,
      inventoryItem,
      movementType,
      startDate,
      endDate,
      groupBy = 'movementType' // Options: 'movementType', 'location', 'item', 'date', 'user'
    } = filters;

    // Build match stage for aggregation
    const matchStage = {};

    if (locationId) {
      matchStage.locationId = locationId;
    }

    if (inventoryItem) {
      matchStage.inventoryItem = inventoryItem;
    }

    if (movementType) {
      if (Array.isArray(movementType)) {
        matchStage.movementType = { $in: movementType };
      } else {
        matchStage.movementType = movementType;
      }
    }

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) {
        matchStage.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        matchStage.createdAt.$lte = new Date(endDate);
      }
    }

    // Build aggregation pipeline based on groupBy
    let groupStage = {};
    let sortStage = {};

    switch (groupBy) {
      case 'movementType':
        groupStage = {
          _id: '$movementType',
          totalQuantity: { $sum: '$quantityDelta' },
          totalValue: { $sum: '$totalValue' },
          count: { $sum: 1 }
        };
        sortStage = { totalQuantity: -1 };
        break;

      case 'location':
        groupStage = {
          _id: '$locationId',
          totalQuantity: { $sum: '$quantityDelta' },
          totalValue: { $sum: '$totalValue' },
          count: { $sum: 1 }
        };
        sortStage = { totalQuantity: -1 };
        break;

      case 'item':
        groupStage = {
          _id: '$inventoryItem',
          totalQuantity: { $sum: '$quantityDelta' },
          totalValue: { $sum: '$totalValue' },
          count: { $sum: 1 }
        };
        sortStage = { totalQuantity: -1 };
        break;

      case 'date':
        groupStage = {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          totalQuantity: { $sum: '$quantityDelta' },
          totalValue: { $sum: '$totalValue' },
          count: { $sum: 1 }
        };
        sortStage = { '_id.year': -1, '_id.month': -1, '_id.day': -1 };
        break;

      case 'user':
        groupStage = {
          _id: '$performedBy',
          totalQuantity: { $sum: '$quantityDelta' },
          totalValue: { $sum: '$totalValue' },
          count: { $sum: 1 }
        };
        sortStage = { count: -1 };
        break;

      default:
        throw new Error(`Invalid groupBy option: ${groupBy}`);
    }

    // Execute aggregation
    const movements = await InventoryLedger.aggregate([
      { $match: matchStage },
      { $group: groupStage },
      { $sort: sortStage }
    ]);

    // Populate references if needed
    if (groupBy === 'location') {
      const { getLocationModel } = await import('../models/company/Location.js');
      const Location = getLocationModel(companyDB);
      
      for (const movement of movements) {
        if (movement._id) {
          const location = await Location.findById(movement._id).select('name code type').lean();
          movement.location = location;
        }
      }
    } else if (groupBy === 'item') {
      const { getInventoryItemModel } = await import('../models/company/InventoryItem.js');
      const InventoryItem = getInventoryItemModel(companyDB);
      
      for (const movement of movements) {
        if (movement._id) {
          const item = await InventoryItem.findById(movement._id).select('name code unit').lean();
          movement.item = item;
        }
      }
    } else if (groupBy === 'user') {
      // Note: CompanyUser is a platform model, not company-specific
      // We'll just include the user ID in the response
      // The API layer can populate user details if needed
      for (const movement of movements) {
        movement.userId = movement._id;
      }
    }

    return movements;
  } catch (error) {
    logger.error('Error getting inventory movements:', error);
    throw error;
  }
};

/**
 * Get ledger entries for a specific item at a location
 * @param {string} locationId - Location ID
 * @param {string} inventoryItemId - Inventory item ID
 * @param {string} companyId - Company ID
 * @param {Object} options - Additional options (dateRange, limit, etc.)
 * @returns {Promise<Array>} Ledger entries
 */
export const getLedgerEntriesForItemAtLocation = async (
  locationId,
  inventoryItemId,
  companyId,
  options = {}
) => {
  try {
    const filters = {
      locationId,
      inventoryItem: inventoryItemId,
      ...options
    };

    const result = await getLedgerEntries(companyId, filters);
    return result.entries;
  } catch (error) {
    logger.error('Error getting ledger entries for item at location:', error);
    throw error;
  }
};

/**
 * Get ledger entries by reference
 * @param {string} referenceType - Reference type (GRN, TRANSFER, etc.)
 * @param {string} referenceId - Reference ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Ledger entries
 */
export const getLedgerEntriesByReference = async (referenceType, referenceId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryLedger = getInventoryLedgerModel(companyDB);

    const entries = await InventoryLedger.find({
      referenceType,
      referenceId
    })
      .populate('inventoryItem', 'name code unit')
      .populate('locationId', 'name code type')
      .populate('performedBy', 'name email')
      .sort({ createdAt: 1 })
      .lean();

    return entries;
  } catch (error) {
    logger.error('Error getting ledger entries by reference:', error);
    throw error;
  }
};

/**
 * Get ledger entries by correlation ID
 * @param {string} correlationId - Correlation ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Ledger entries
 */
export const getLedgerEntriesByCorrelation = async (correlationId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryLedger = getInventoryLedgerModel(companyDB);

    const entries = await InventoryLedger.find({
      correlationId
    })
      .populate('inventoryItem', 'name code unit')
      .populate('locationId', 'name code type')
      .populate('performedBy', 'name email')
      .sort({ createdAt: 1 })
      .lean();

    return entries;
  } catch (error) {
    logger.error('Error getting ledger entries by correlation:', error);
    throw error;
  }
};

/**
 * Get ledger summary for a location
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options (startDate, endDate, inventoryItem)
 * @returns {Promise<Object>} Ledger summary
 */
export const getLedgerSummary = async (locationId, companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryLedger = getInventoryLedgerModel(companyDB);

    const { startDate, endDate, inventoryItem } = filters;

    // Build match stage
    const matchStage = { locationId };

    if (inventoryItem) {
      matchStage.inventoryItem = inventoryItem;
    }

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) {
        matchStage.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        matchStage.createdAt.$lte = new Date(endDate);
      }
    }

    // Aggregate by movement type
    const summary = await InventoryLedger.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$movementType',
          totalQuantity: { $sum: '$quantityDelta' },
          totalValue: { $sum: '$totalValue' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Calculate totals
    const totals = {
      totalEntries: summary.reduce((sum, item) => sum + item.count, 0),
      totalQuantityChange: summary.reduce((sum, item) => sum + item.totalQuantity, 0),
      totalValueChange: summary.reduce((sum, item) => sum + (item.totalValue || 0), 0)
    };

    return {
      summary,
      totals
    };
  } catch (error) {
    logger.error('Error getting ledger summary:', error);
    throw error;
  }
};

/**
 * Validate ledger entry data before recording
 * @param {Object} entryData - Ledger entry data
 * @returns {Object} Validation result
 */
export const validateLedgerEntry = (entryData) => {
  const errors = [];

  // Check required fields
  const requiredFields = [
    'inventoryItem',
    'locationId',
    'movementType',
    'quantityDelta',
    'beforeAvailable',
    'afterAvailable',
    'beforeReserved',
    'afterReserved',
    'beforeInTransit',
    'afterInTransit',
    'referenceType',
    'referenceId',
    'performedBy'
  ];

  requiredFields.forEach(field => {
    if (entryData[field] === undefined || entryData[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Validate quantity delta matches before/after changes
  const availableDelta = entryData.afterAvailable - entryData.beforeAvailable;
  const reservedDelta = entryData.afterReserved - entryData.beforeReserved;
  const inTransitDelta = entryData.afterInTransit - entryData.beforeInTransit;

  // The quantityDelta should match one of the state changes
  // (This is a simplified check - actual validation depends on movement type)
  const totalDelta = availableDelta + reservedDelta + inTransitDelta;
  
  if (Math.abs(totalDelta) > 0 && entryData.quantityDelta === 0) {
    errors.push('Quantity delta does not match state changes');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};


/**
 * Get ledger entries with support for archived entries
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated ledger entries (active and/or archived)
 */
export const getLedgerEntriesWithArchive = async (companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryLedger = getInventoryLedgerModel(companyDB);
    const InventoryLedgerArchive = getInventoryLedgerArchiveModel(companyDB);

    const {
      page = 1,
      limit = 100,
      locationId,
      inventoryItem,
      movementType,
      referenceType,
      referenceId,
      performedBy,
      batchNumber,
      correlationId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeArchived = false // NEW: Flag to include archived entries
    } = filters;

    // Build query
    const query = {};

    // Location filter
    if (locationId) {
      query.locationId = locationId;
    }

    // Inventory item filter
    if (inventoryItem) {
      query.inventoryItem = inventoryItem;
    }

    // Movement type filter
    if (movementType) {
      if (Array.isArray(movementType)) {
        query.movementType = { $in: movementType };
      } else {
        query.movementType = movementType;
      }
    }

    // Reference type filter
    if (referenceType) {
      query.referenceType = referenceType;
    }

    // Reference ID filter
    if (referenceId) {
      query.referenceId = referenceId;
    }

    // Performed by filter
    if (performedBy) {
      query.performedBy = performedBy;
    }

    // Batch number filter
    if (batchNumber) {
      query.batchNumber = batchNumber;
    }

    // Correlation ID filter
    if (correlationId) {
      query.correlationId = correlationId;
    }

    // Date range filter
    const dateField = includeArchived ? 'originalCreatedAt' : 'createdAt';
    if (startDate || endDate) {
      query[dateField] = {};
      if (startDate) {
        query[dateField].$gte = new Date(startDate);
      }
      if (endDate) {
        query[dateField].$lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort object
    const sort = {};
    const sortField = includeArchived && sortBy === 'createdAt' ? 'originalCreatedAt' : sortBy;
    sort[sortField] = sortOrder === 'asc' ? 1 : -1;

    if (!includeArchived) {
      // Query only active ledger
      const [entries, total] = await Promise.all([
        InventoryLedger.find(query)
          .populate('inventoryItem', 'name code unit')
          .populate('locationId', 'name code type')
          .populate('performedBy', 'name email')
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        InventoryLedger.countDocuments(query)
      ]);

      // Mark entries as active
      entries.forEach(entry => {
        entry.isArchived = false;
      });

      return {
        entries,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      };
    } else {
      // Query both active and archived ledgers
      const archiveQuery = { ...query };
      
      // For archived entries, use originalCreatedAt instead of createdAt
      if (query.createdAt) {
        archiveQuery.originalCreatedAt = query.createdAt;
        delete archiveQuery.createdAt;
      }

      const [activeEntries, archivedEntries, activeTotal, archivedTotal] = await Promise.all([
        InventoryLedger.find(query)
          .populate('inventoryItem', 'name code unit')
          .populate('locationId', 'name code type')
          .populate('performedBy', 'name email')
          .lean(),
        InventoryLedgerArchive.find(archiveQuery)
          .populate('inventoryItem', 'name code unit')
          .populate('locationId', 'name code type')
          .populate('performedBy', 'name email')
          .lean(),
        InventoryLedger.countDocuments(query),
        InventoryLedgerArchive.countDocuments(archiveQuery)
      ]);

      // Mark entries as active or archived
      activeEntries.forEach(entry => {
        entry.isArchived = false;
      });

      archivedEntries.forEach(entry => {
        entry.isArchived = true;
        // Use originalCreatedAt as createdAt for consistent sorting
        entry.createdAt = entry.originalCreatedAt;
      });

      // Merge and sort results
      const allEntries = [...activeEntries, ...archivedEntries];
      
      // Sort merged results
      allEntries.sort((a, b) => {
        const aValue = a[sortField] || a.createdAt;
        const bValue = b[sortField] || b.createdAt;
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      // Apply pagination to merged results
      const paginatedEntries = allEntries.slice(skip, skip + parseInt(limit));

      const total = activeTotal + archivedTotal;

      return {
        entries: paginatedEntries,
        pagination: {
          total,
          activeCount: activeTotal,
          archivedCount: archivedTotal,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      };
    }
  } catch (error) {
    logger.error('Error getting ledger entries with archive:', error);
    throw error;
  }
};

/**
 * Get inventory movements with support for archived entries
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Inventory movements (active and/or archived)
 */
export const getInventoryMovementsWithArchive = async (companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryLedger = getInventoryLedgerModel(companyDB);
    const InventoryLedgerArchive = getInventoryLedgerArchiveModel(companyDB);

    const {
      locationId,
      inventoryItem,
      movementType,
      startDate,
      endDate,
      groupBy = 'movementType',
      includeArchived = false
    } = filters;

    // Build match stage for aggregation
    const matchStage = {};

    if (locationId) {
      matchStage.locationId = locationId;
    }

    if (inventoryItem) {
      matchStage.inventoryItem = inventoryItem;
    }

    if (movementType) {
      if (Array.isArray(movementType)) {
        matchStage.movementType = { $in: movementType };
      } else {
        matchStage.movementType = movementType;
      }
    }

    const dateField = includeArchived ? 'originalCreatedAt' : 'createdAt';
    if (startDate || endDate) {
      matchStage[dateField] = {};
      if (startDate) {
        matchStage[dateField].$gte = new Date(startDate);
      }
      if (endDate) {
        matchStage[dateField].$lte = new Date(endDate);
      }
    }

    // Build aggregation pipeline based on groupBy
    let groupStage = {};
    let sortStage = {};

    switch (groupBy) {
      case 'movementType':
        groupStage = {
          _id: '$movementType',
          totalQuantity: { $sum: '$quantityDelta' },
          totalValue: { $sum: '$totalValue' },
          count: { $sum: 1 }
        };
        sortStage = { totalQuantity: -1 };
        break;

      case 'location':
        groupStage = {
          _id: '$locationId',
          totalQuantity: { $sum: '$quantityDelta' },
          totalValue: { $sum: '$totalValue' },
          count: { $sum: 1 }
        };
        sortStage = { totalQuantity: -1 };
        break;

      case 'item':
        groupStage = {
          _id: '$inventoryItem',
          totalQuantity: { $sum: '$quantityDelta' },
          totalValue: { $sum: '$totalValue' },
          count: { $sum: 1 }
        };
        sortStage = { totalQuantity: -1 };
        break;

      case 'date':
        const dateFieldForGroup = includeArchived ? '$originalCreatedAt' : '$createdAt';
        groupStage = {
          _id: {
            year: { $year: dateFieldForGroup },
            month: { $month: dateFieldForGroup },
            day: { $dayOfMonth: dateFieldForGroup }
          },
          totalQuantity: { $sum: '$quantityDelta' },
          totalValue: { $sum: '$totalValue' },
          count: { $sum: 1 }
        };
        sortStage = { '_id.year': -1, '_id.month': -1, '_id.day': -1 };
        break;

      case 'user':
        groupStage = {
          _id: '$performedBy',
          totalQuantity: { $sum: '$quantityDelta' },
          totalValue: { $sum: '$totalValue' },
          count: { $sum: 1 }
        };
        sortStage = { count: -1 };
        break;

      default:
        throw new Error(`Invalid groupBy option: ${groupBy}`);
    }

    if (!includeArchived) {
      // Query only active ledger
      const movements = await InventoryLedger.aggregate([
        { $match: matchStage },
        { $group: groupStage },
        { $sort: sortStage }
      ]);

      // Populate references if needed
      await populateMovementReferences(movements, groupBy, companyDB);

      return movements;
    } else {
      // Query both active and archived ledgers
      const archiveMatchStage = { ...matchStage };
      
      // For archived entries, use originalCreatedAt instead of createdAt
      if (matchStage.createdAt) {
        archiveMatchStage.originalCreatedAt = matchStage.createdAt;
        delete archiveMatchStage.createdAt;
      }

      const [activeMovements, archivedMovements] = await Promise.all([
        InventoryLedger.aggregate([
          { $match: matchStage },
          { $group: groupStage },
          { $sort: sortStage }
        ]),
        InventoryLedgerArchive.aggregate([
          { $match: archiveMatchStage },
          { $group: groupStage },
          { $sort: sortStage }
        ])
      ]);

      // Merge movements by grouping key
      const mergedMovements = mergeMovements(activeMovements, archivedMovements);

      // Populate references if needed
      await populateMovementReferences(mergedMovements, groupBy, companyDB);

      return mergedMovements;
    }
  } catch (error) {
    logger.error('Error getting inventory movements with archive:', error);
    throw error;
  }
};

/**
 * Helper function to merge movements from active and archived ledgers
 * @param {Array} activeMovements - Movements from active ledger
 * @param {Array} archivedMovements - Movements from archived ledger
 * @returns {Array} Merged movements
 */
const mergeMovements = (activeMovements, archivedMovements) => {
  const movementMap = new Map();

  // Add active movements
  activeMovements.forEach(movement => {
    const key = JSON.stringify(movement._id);
    movementMap.set(key, { ...movement });
  });

  // Merge archived movements
  archivedMovements.forEach(movement => {
    const key = JSON.stringify(movement._id);
    
    if (movementMap.has(key)) {
      const existing = movementMap.get(key);
      existing.totalQuantity += movement.totalQuantity;
      existing.totalValue = (existing.totalValue || 0) + (movement.totalValue || 0);
      existing.count += movement.count;
    } else {
      movementMap.set(key, { ...movement });
    }
  });

  return Array.from(movementMap.values());
};

/**
 * Helper function to populate references in movement aggregations
 * @param {Array} movements - Movement aggregation results
 * @param {string} groupBy - Group by field
 * @param {Object} companyDB - Company database connection
 */
const populateMovementReferences = async (movements, groupBy, companyDB) => {
  if (groupBy === 'location') {
    const { getLocationModel } = await import('../models/company/Location.js');
    const Location = getLocationModel(companyDB);
    
    for (const movement of movements) {
      if (movement._id) {
        const location = await Location.findById(movement._id).select('name code type').lean();
        movement.location = location;
      }
    }
  } else if (groupBy === 'item') {
    const { getInventoryItemModel } = await import('../models/company/InventoryItem.js');
    const InventoryItem = getInventoryItemModel(companyDB);
    
    for (const movement of movements) {
      if (movement._id) {
        const item = await InventoryItem.findById(movement._id).select('name code unit').lean();
        movement.item = item;
      }
    }
  } else if (groupBy === 'user') {
    for (const movement of movements) {
      movement.userId = movement._id;
    }
  }
};

/**
 * Get ledger summary with support for archived entries
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Ledger summary (active and/or archived)
 */
export const getLedgerSummaryWithArchive = async (locationId, companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryLedger = getInventoryLedgerModel(companyDB);
    const InventoryLedgerArchive = getInventoryLedgerArchiveModel(companyDB);

    const { startDate, endDate, inventoryItem, includeArchived = false } = filters;

    // Build match stage
    const matchStage = { locationId };

    if (inventoryItem) {
      matchStage.inventoryItem = inventoryItem;
    }

    const dateField = includeArchived ? 'originalCreatedAt' : 'createdAt';
    if (startDate || endDate) {
      matchStage[dateField] = {};
      if (startDate) {
        matchStage[dateField].$gte = new Date(startDate);
      }
      if (endDate) {
        matchStage[dateField].$lte = new Date(endDate);
      }
    }

    if (!includeArchived) {
      // Query only active ledger
      const summary = await InventoryLedger.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$movementType',
            totalQuantity: { $sum: '$quantityDelta' },
            totalValue: { $sum: '$totalValue' },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      const totals = {
        totalEntries: summary.reduce((sum, item) => sum + item.count, 0),
        totalQuantityChange: summary.reduce((sum, item) => sum + item.totalQuantity, 0),
        totalValueChange: summary.reduce((sum, item) => sum + (item.totalValue || 0), 0)
      };

      return { summary, totals };
    } else {
      // Query both active and archived ledgers
      const archiveMatchStage = { ...matchStage };
      
      if (matchStage.createdAt) {
        archiveMatchStage.originalCreatedAt = matchStage.createdAt;
        delete archiveMatchStage.createdAt;
      }

      const [activeSummary, archivedSummary] = await Promise.all([
        InventoryLedger.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: '$movementType',
              totalQuantity: { $sum: '$quantityDelta' },
              totalValue: { $sum: '$totalValue' },
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } }
        ]),
        InventoryLedgerArchive.aggregate([
          { $match: archiveMatchStage },
          {
            $group: {
              _id: '$movementType',
              totalQuantity: { $sum: '$quantityDelta' },
              totalValue: { $sum: '$totalValue' },
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } }
        ])
      ]);

      // Merge summaries
      const summary = mergeMovements(activeSummary, archivedSummary);

      const totals = {
        totalEntries: summary.reduce((sum, item) => sum + item.count, 0),
        totalQuantityChange: summary.reduce((sum, item) => sum + item.totalQuantity, 0),
        totalValueChange: summary.reduce((sum, item) => sum + (item.totalValue || 0), 0)
      };

      return { summary, totals };
    }
  } catch (error) {
    logger.error('Error getting ledger summary with archive:', error);
    throw error;
  }
};
