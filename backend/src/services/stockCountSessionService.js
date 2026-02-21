/**
 * Stock Count Session Service
 * Business logic for physical stock count operations
 * Handles structured stock counts with blind counting and variance analysis
 * Supports concurrent counting by multiple users
 */

import { getCompanyDB } from '../config/database.js';
import { getStockCountSessionModel } from '../models/company/StockCountSession.js';
import { getLocationModel } from '../models/company/Location.js';
import { getInventoryItemLocationModel } from '../models/company/InventoryItemLocation.js';
import { getInventoryBatchLocationModel } from '../models/company/InventoryBatchLocation.js';
import { createAdjustment } from './stockAdjustmentService.js';
import { logger } from '../utils/logger.js';

/**
 * Generate unique session number
 * Format: CNT-YYYYMMDD-XXXXX
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<string>} Unique session number
 */
const generateSessionNumber = async (companyDB) => {
  const StockCountSession = getStockCountSessionModel(companyDB);
  
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `CNT-${dateStr}-`;
  
  // Find the last session number for today
  const lastSession = await StockCountSession.findOne({
    sessionNumber: { $regex: `^${prefix}` }
  })
    .sort({ sessionNumber: -1 })
    .select('sessionNumber')
    .lean();
  
  let sequence = 1;
  if (lastSession) {
    const lastSequence = parseInt(lastSession.sessionNumber.split('-')[2]);
    sequence = lastSequence + 1;
  }
  
  const sessionNumber = `${prefix}${sequence.toString().padStart(5, '0')}`;
  return sessionNumber;
};

/**
 * Create a new stock count session
 * @param {Object} sessionData - Session data
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Created session
 */
export const createCountSession = async (sessionData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockCountSession = getStockCountSessionModel(companyDB);
    const Location = getLocationModel(companyDB);

    // Validate required fields
    const requiredFields = ['locationId', 'countType', 'items', 'createdBy'];
    const missingFields = requiredFields.filter(field => !sessionData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate count type
    const validTypes = ['cycle_count', 'full_count'];
    if (!validTypes.includes(sessionData.countType)) {
      throw new Error(
        `Invalid count type: ${sessionData.countType}. ` +
        `Must be one of: ${validTypes.join(', ')}`
      );
    }

    // Validate items array
    if (!Array.isArray(sessionData.items) || sessionData.items.length === 0) {
      throw new Error('At least one item is required');
    }

    // Validate each item has required fields
    for (const item of sessionData.items) {
      if (!item.inventoryItem) {
        throw new Error('Each item must have an inventoryItem');
      }
    }

    // Validate location exists and is active
    const location = await Location.findOne({
      _id: sessionData.locationId,
      isActive: true,
      isArchived: false
    });

    if (!location) {
      throw new Error('Location not found or inactive');
    }

    // Generate unique session number
    const sessionNumber = await generateSessionNumber(companyDB);

    // Create session
    const session = new StockCountSession({
      sessionNumber,
      locationId: sessionData.locationId,
      countType: sessionData.countType,
      items: sessionData.items.map(item => ({
        inventoryItem: item.inventoryItem,
        batchNumber: item.batchNumber,
        systemQuantity: 0, // Will be set when session is started
        notes: item.notes
      })),
      status: 'draft',
      blindCount: sessionData.blindCount || false,
      createdBy: sessionData.createdBy,
      createdDate: new Date(),
      notes: sessionData.notes
    });

    await session.save();

    logger.info(
      `Stock count session created: ${session.sessionNumber} ` +
      `(${session.countType}) at ${location.name} for company: ${companyId}`
    );

    return session;
  } catch (error) {
    logger.error('Error creating stock count session:', error);
    throw error;
  }
};

/**
 * Start a stock count session
 * Freezes system quantities for all items
 * @param {string} sessionId - Session ID
 * @param {string} userId - User starting the session
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Started session
 */
export const startCountSession = async (sessionId, userId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockCountSession = getStockCountSessionModel(companyDB);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    // Get session
    const session = await StockCountSession.findById(sessionId);
    
    if (!session) {
      throw new Error(`Stock count session not found: ${sessionId}`);
    }

    // Validate status
    if (session.status !== 'draft') {
      throw new Error(
        `Cannot start session with status '${session.status}'. ` +
        `Session must be in 'draft' status.`
      );
    }

    // Freeze system quantities for all items
    for (const item of session.items) {
      if (item.batchNumber) {
        // Get batch quantity
        const batch = await InventoryBatchLocation.findOne({
          locationId: session.locationId,
          inventoryItem: item.inventoryItem,
          batchNumber: item.batchNumber,
          isActive: true
        });

        if (batch) {
          item.systemQuantity = batch.availableQuantity;
        } else {
          item.systemQuantity = 0;
        }
      } else {
        // Get aggregate quantity
        const inventory = await InventoryItemLocation.findOne({
          locationId: session.locationId,
          inventoryItem: item.inventoryItem,
          isActive: true
        });

        if (inventory) {
          item.systemQuantity = inventory.availableQuantity;
        } else {
          item.systemQuantity = 0;
        }
      }
    }

    // Update session status
    session.status = 'in_progress';
    session.startedBy = userId;
    session.startedDate = new Date();
    
    await session.save();

    logger.info(
      `Stock count session started: ${session.sessionNumber} by user ${userId} for company: ${companyId}`
    );

    return session;
  } catch (error) {
    logger.error('Error starting stock count session:', error);
    throw error;
  }
};

/**
 * Record counted quantity for an item
 * Supports concurrent counting by multiple users
 * @param {string} sessionId - Session ID
 * @param {string} itemId - Item ID (inventoryItem)
 * @param {string} batchNumber - Batch number (optional)
 * @param {number} countedQuantity - Counted quantity
 * @param {string} userId - User who counted
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated session
 */
export const recordCountedQuantity = async (
  sessionId,
  itemId,
  batchNumber,
  countedQuantity,
  userId,
  companyId
) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockCountSession = getStockCountSessionModel(companyDB);

    // Get session
    const session = await StockCountSession.findById(sessionId);
    
    if (!session) {
      throw new Error(`Stock count session not found: ${sessionId}`);
    }

    // Validate status
    if (session.status !== 'in_progress') {
      throw new Error(
        `Cannot record count for session with status '${session.status}'. ` +
        `Session must be in 'in_progress' status.`
      );
    }

    // Validate counted quantity
    if (countedQuantity === undefined || countedQuantity === null || countedQuantity < 0) {
      throw new Error('Counted quantity must be a non-negative number');
    }

    // Find the item in the session
    const item = session.items.find(i => 
      i.inventoryItem.toString() === itemId.toString() &&
      (batchNumber ? i.batchNumber === batchNumber : !i.batchNumber)
    );

    if (!item) {
      throw new Error('Item not found in count session');
    }

    // Record counted quantity
    item.countedQuantity = countedQuantity;
    item.countedBy = userId;
    item.countedDate = new Date();
    
    // Calculate variance
    item.variance = countedQuantity - item.systemQuantity;

    await session.save();

    logger.info(
      `Counted quantity recorded: ${session.sessionNumber}, ` +
      `item ${itemId}, quantity ${countedQuantity} by user ${userId} for company: ${companyId}`
    );

    return session;
  } catch (error) {
    logger.error('Error recording counted quantity:', error);
    throw error;
  }
};

/**
 * Complete a stock count session
 * Calculates variances and generates variance report
 * @param {string} sessionId - Session ID
 * @param {string} userId - User completing the session
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Completed session with variance report
 */
export const completeCountSession = async (sessionId, userId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockCountSession = getStockCountSessionModel(companyDB);

    // Get session
    const session = await StockCountSession.findById(sessionId)
      .populate('items.inventoryItem', 'name code unit costPrice');
    
    if (!session) {
      throw new Error(`Stock count session not found: ${sessionId}`);
    }

    // Validate status
    if (session.status !== 'in_progress') {
      throw new Error(
        `Cannot complete session with status '${session.status}'. ` +
        `Session must be in 'in_progress' status.`
      );
    }

    // Validate all items have been counted
    const uncountedItems = session.items.filter(item => 
      item.countedQuantity === undefined || item.countedQuantity === null
    );

    if (uncountedItems.length > 0) {
      throw new Error(
        `Cannot complete session: ${uncountedItems.length} items have not been counted`
      );
    }

    // Calculate total variance value
    let totalVarianceValue = 0;
    for (const item of session.items) {
      if (item.inventoryItem && item.inventoryItem.costPrice) {
        const varianceValue = item.variance * item.inventoryItem.costPrice;
        totalVarianceValue += varianceValue;
      }
    }

    // Update session status
    session.status = 'completed';
    session.completedBy = userId;
    session.completedDate = new Date();
    session.totalVarianceValue = totalVarianceValue;
    
    await session.save();

    // Generate variance report
    const varianceReport = {
      sessionNumber: session.sessionNumber,
      locationId: session.locationId,
      countType: session.countType,
      completedDate: session.completedDate,
      totalVarianceValue,
      items: session.items.map(item => ({
        inventoryItem: item.inventoryItem,
        batchNumber: item.batchNumber,
        systemQuantity: item.systemQuantity,
        countedQuantity: item.countedQuantity,
        variance: item.variance,
        varianceValue: item.inventoryItem && item.inventoryItem.costPrice
          ? item.variance * item.inventoryItem.costPrice
          : 0,
        countedBy: item.countedBy,
        countedDate: item.countedDate,
        notes: item.notes
      }))
    };

    logger.info(
      `Stock count session completed: ${session.sessionNumber} by user ${userId} for company: ${companyId}`
    );

    return {
      session,
      varianceReport
    };
  } catch (error) {
    logger.error('Error completing stock count session:', error);
    throw error;
  }
};

/**
 * Approve a stock count session
 * Automatically creates stock adjustments for items with variances
 * @param {string} sessionId - Session ID
 * @param {string} userId - User approving the session
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Approved session and created adjustments
 */
export const approveCountSession = async (sessionId, userId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockCountSession = getStockCountSessionModel(companyDB);

    // Get session
    const session = await StockCountSession.findById(sessionId)
      .populate('items.inventoryItem', 'name code unit');
    
    if (!session) {
      throw new Error(`Stock count session not found: ${sessionId}`);
    }

    // Validate status
    if (session.status !== 'completed') {
      throw new Error(
        `Cannot approve session with status '${session.status}'. ` +
        `Session must be in 'completed' status.`
      );
    }

    // Filter items with variances
    const itemsWithVariances = session.items.filter(item => item.variance !== 0);

    let createdAdjustments = [];

    // Create stock adjustments for items with variances
    if (itemsWithVariances.length > 0) {
      const adjustmentData = {
        locationId: session.locationId,
        adjustmentType: 'physical_count',
        items: itemsWithVariances.map(item => ({
          inventoryItem: item.inventoryItem._id,
          batchNumber: item.batchNumber,
          currentQuantity: item.systemQuantity,
          adjustedQuantity: item.countedQuantity,
          quantityDelta: item.variance,
          reason: `Physical count variance from session ${session.sessionNumber}`,
          notes: item.notes
        })),
        createdBy: userId,
        notes: `Auto-generated from stock count session ${session.sessionNumber}`,
        stockCountSessionId: session._id
      };

      const adjustment = await createAdjustment(adjustmentData, companyId);
      createdAdjustments.push(adjustment);
    }

    // Update session status
    session.status = 'approved';
    session.approvedBy = userId;
    session.approvedDate = new Date();
    
    await session.save();

    logger.info(
      `Stock count session approved: ${session.sessionNumber} by user ${userId}, ` +
      `created ${createdAdjustments.length} adjustments for company: ${companyId}`
    );

    return {
      session,
      adjustments: createdAdjustments
    };
  } catch (error) {
    logger.error('Error approving stock count session:', error);
    throw error;
  }
};

/**
 * Reject a stock count session
 * @param {string} sessionId - Session ID
 * @param {string} userId - User rejecting the session
 * @param {string} rejectionReason - Reason for rejection
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Rejected session
 */
export const rejectCountSession = async (sessionId, userId, rejectionReason, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockCountSession = getStockCountSessionModel(companyDB);

    // Get session
    const session = await StockCountSession.findById(sessionId);
    
    if (!session) {
      throw new Error(`Stock count session not found: ${sessionId}`);
    }

    // Validate status
    if (session.status !== 'completed') {
      throw new Error(
        `Cannot reject session with status '${session.status}'. ` +
        `Session must be in 'completed' status.`
      );
    }

    // Validate rejection reason
    if (!rejectionReason || rejectionReason.trim() === '') {
      throw new Error('Rejection reason is required');
    }

    // Update session status
    session.status = 'rejected';
    session.rejectedBy = userId;
    session.rejectedDate = new Date();
    session.rejectionReason = rejectionReason;
    
    await session.save();

    logger.info(
      `Stock count session rejected: ${session.sessionNumber} by user ${userId} for company: ${companyId}`
    );

    return session;
  } catch (error) {
    logger.error('Error rejecting stock count session:', error);
    throw error;
  }
};

/**
 * Get session by ID
 * Supports blind counting mode (hides systemQuantity if blindCount=true and status=in_progress)
 * @param {string} sessionId - Session ID
 * @param {string} companyId - Company ID
 * @param {boolean} isCounter - Whether the requester is a counter (affects blind count visibility)
 * @returns {Promise<Object>} Session
 */
export const getCountSession = async (sessionId, companyId, isCounter = false) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockCountSession = getStockCountSessionModel(companyDB);

    const session = await StockCountSession.findById(sessionId)
      .populate('locationId', 'name code type')
      .populate('items.inventoryItem', 'name code unit costPrice')
      .populate('createdBy', 'name email')
      .populate('startedBy', 'name email')
      .populate('completedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .populate('items.countedBy', 'name email')
      .lean();

    if (!session) {
      throw new Error('Stock count session not found');
    }

    // Apply blind counting mode
    if (session.blindCount && session.status === 'in_progress' && isCounter) {
      // Hide systemQuantity from counters during counting
      session.items = session.items.map(item => ({
        ...item,
        systemQuantity: undefined
      }));
    }

    return session;
  } catch (error) {
    logger.error('Error getting stock count session:', error);
    throw error;
  }
};

/**
 * Get sessions by location
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated sessions
 */
export const getCountSessionsByLocation = async (locationId, companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockCountSession = getStockCountSessionModel(companyDB);

    const {
      page = 1,
      limit = 10,
      status = '',
      countType = '',
      startDate = '',
      endDate = '',
      sortBy = 'createdDate',
      sortOrder = 'desc'
    } = filters;

    // Build query
    const query = {
      locationId
    };

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Count type filter
    if (countType && countType !== 'all') {
      query.countType = countType;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdDate = {};
      if (startDate) {
        query.createdDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdDate.$lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [sessions, total] = await Promise.all([
      StockCountSession.find(query)
        .populate('locationId', 'name code type')
        .populate('createdBy', 'name email')
        .populate('completedBy', 'name email')
        .populate('approvedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockCountSession.countDocuments(query)
    ]);

    return {
      sessions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting count sessions by location:', error);
    throw error;
  }
};

/**
 * Get sessions by status
 * @param {string} status - Session status
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated sessions
 */
export const getCountSessionsByStatus = async (status, companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockCountSession = getStockCountSessionModel(companyDB);

    // Validate status
    const validStatuses = ['draft', 'in_progress', 'completed', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`
      );
    }

    const {
      page = 1,
      limit = 10,
      locationId = '',
      countType = '',
      startDate = '',
      endDate = '',
      sortBy = 'createdDate',
      sortOrder = 'desc'
    } = filters;

    // Build query
    const query = {
      status
    };

    // Location filter
    if (locationId) {
      query.locationId = locationId;
    }

    // Count type filter
    if (countType && countType !== 'all') {
      query.countType = countType;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdDate = {};
      if (startDate) {
        query.createdDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdDate.$lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [sessions, total] = await Promise.all([
      StockCountSession.find(query)
        .populate('locationId', 'name code type')
        .populate('createdBy', 'name email')
        .populate('completedBy', 'name email')
        .populate('approvedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockCountSession.countDocuments(query)
    ]);

    return {
      sessions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting count sessions by status:', error);
    throw error;
  }
};

