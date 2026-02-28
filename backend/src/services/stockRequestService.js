/**
 * Stock Request Service
 * Business logic for stock request and approval workflow
 * Handles request creation, approval, rejection, and cancellation
 * Optimized for 5000+ branches with location-based access control
 */

import mongoose from 'mongoose';
import { getCompanyDB } from '../config/database.js';
import { getStockRequestModel } from '../models/company/StockRequest.js';
import { getCounterModel } from '../models/company/Counter.js';
import { getInventoryBatchLocationModel } from '../models/company/InventoryBatchLocation.js';
import { getStockTransferModel } from '../models/company/StockTransfer.js';
import { getStockBackorderModel } from '../models/company/StockBackorder.js';
import { logger } from '../utils/logger.js';
import CompanyUser from '../models/platform/CompanyUser.js';
import notificationService from './notificationService.js';
import locationNotificationRouter from './locationNotificationRouter.js';
import stockRequestEmailService from './emailTemplates/stockRequestEmailService.js';
/**
 * Generate unique request number in format REQ-YYYYMMDD-NNNN
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<string>} Unique request number
 */
const generateRequestNumber = async (companyDB) => {
  const Counter = getCounterModel(companyDB);
  
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const counterId = `REQUEST_${dateStr}`;
  
  // Atomic increment to prevent race conditions
  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { sequence: 1 } },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true
    }
  );
  
  const requestNumber = `REQ-${dateStr}-${counter.sequence.toString().padStart(4, '0')}`;
  return requestNumber;
};

/**
 * Calculate expected delivery date based on priority
 * @param {string} priority - Priority level (urgent, high, normal, low)
 * @returns {Date} Expected delivery date
 */
const calculateExpectedDeliveryDate = (priority) => {
  const now = new Date();
  const daysToAdd = {
    urgent: 1,
    high: 3,
    normal: 7,
    low: 14
  };
  
  const days = daysToAdd[priority] || 7; // Default to normal (7 days)
  const deliveryDate = new Date(now);
  deliveryDate.setDate(deliveryDate.getDate() + days);
  
  return deliveryDate;
};

/**
 * Validate user has Branch Admin role
 * @param {Object} user - User object
 * @returns {boolean} True if user is Branch Admin
 */
const isBranchAdmin = (user) => {
  // Branch Admin roles include: company_admin, warehouse_admin, employee
  // Super Admins also have Branch Admin capabilities
  const branchAdminRoles = [
    'company_super_admin_primary',
    'company_super_admin_secondary',
    'company_admin',
    'warehouse_admin',
    'employee'
  ];
  return branchAdminRoles.includes(user.role);
};

/**
 * Check if user is Super Admin (has access to all locations)
 * @param {Object} user - User object
 * @returns {boolean} True if user is Super Admin
 */
const isSuperAdmin = (user) => {
  return user.role === 'company_super_admin_primary' || 
         user.role === 'company_super_admin_secondary';
};

/**
 * Validate user has access to location
 * Super Admins have access to all locations (empty arrays = all access)
 * Other users must have locationId in their branchIds or warehouseIds
 * @param {Object} user - User object
 * @param {string} locationId - Location ID to check
 * @returns {boolean} True if user has access
 */
const hasLocationAccess = (user, locationId) => {
  // Super Admins have access to all locations
  if (isSuperAdmin(user)) {
    return true;
  }
  
  // Convert locationId to string for comparison
  const locationIdStr = locationId.toString();
  
  // Check if location is in user's branchIds or warehouseIds
  const hasBranchAccess = user.branchIds && user.branchIds.some(
    id => id.toString() === locationIdStr
  );
  const hasWarehouseAccess = user.warehouseIds && user.warehouseIds.some(
    id => id.toString() === locationIdStr
  );
  
  return hasBranchAccess || hasWarehouseAccess;
};

/**
 * Create new stock request
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID creating the request
 * @param {Object} requestData - Request data
 * @param {string} ipAddress - IP address of requester
 * @param {string} deviceInfo - Device information
 * @returns {Promise<Object>} Created stock request
 */
export const createRequest = async (
  companyId,
  userId,
  requestData,
  ipAddress,
  deviceInfo
) => {
  try {
    // Validate required fields
    const requiredFields = ['destinationLocation', 'sourceLocation', 'items'];
    const missingFields = requiredFields.filter(field => !requestData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate items array
    if (!Array.isArray(requestData.items) || requestData.items.length === 0) {
      throw new Error('At least one item is required');
    }

    // Validate each item has required fields and requestedQuantity > 0
    for (const item of requestData.items) {
      if (!item.inventoryItem) {
        throw new Error('Each item must have an inventoryItem');
      }
      if (!item.requestedQuantity || item.requestedQuantity <= 0) {
        throw new Error('Each item must have requestedQuantity greater than zero');
      }
      if (!item.unit) {
        throw new Error('Each item must have a unit');
      }
    }

    // Validate destinationLocation != sourceLocation
    if (requestData.destinationLocation.toString() === requestData.sourceLocation.toString()) {
      throw new Error('destinationLocation and sourceLocation cannot be the same');
    }

    // Get user details
    const user = await CompanyUser.findOne({
      _id: userId,
      companyId: companyId,
      isActive: true
    });

    if (!user) {
      throw new Error('User not found or inactive');
    }

    // Validate user has Branch Admin role
    if (!isBranchAdmin(user)) {
      throw new Error('User must have Branch Admin role to create stock requests');
    }

    // Block warehouse admins from creating requests
    if (user.role === 'warehouse_admin') {
      throw new Error('Warehouse admins cannot create stock requests. You can only receive and fulfill incoming requests.');
    }

    // Validate user has access to destinationLocation (source location)
    // Users can request TO any location, but must have access to FROM location
    if (!hasLocationAccess(user, requestData.destinationLocation)) {
      throw new Error('Access denied. You do not have permission to access the following locations: destinationLocation');
    }

    // Get company database
    const companyDB = getCompanyDB(companyId);
    const StockRequest = getStockRequestModel(companyDB);

    // Generate unique request number
    const requestNumber = await generateRequestNumber(companyDB);

    // Calculate expected delivery date based on priority
    const priority = requestData.priority || 'normal';
    const expectedDeliveryDate = calculateExpectedDeliveryDate(priority);

    // Create stock request
    const stockRequest = new StockRequest({
      requestNumber,
      companyId,
      destinationLocation: requestData.destinationLocation,
      sourceLocation: requestData.sourceLocation,
      priority,
      expectedDeliveryDate,
      items: requestData.items,
      status: 'pending',
      requestedBy: userId,
      requestDate: new Date(),
      requestIpAddress: ipAddress,
      requestDeviceInfo: deviceInfo,
      notes: requestData.notes || '',
      version: 0
    });

    await stockRequest.save();

    logger.info(`Stock request created: ${requestNumber} by user ${userId} for company ${companyId}`);

    // Populate request for notification (populate inventoryItem and manually populate requestedBy from platform DB)
    const populatedRequest = await StockRequest.findById(stockRequest._id)
      .populate('destinationLocation')
      .populate('sourceLocation')
      .populate('items.inventoryItem')
      .lean();

    // Manually populate requestedBy from platform CompanyUser model
    if (populatedRequest.requestedBy) {
      const requester = await CompanyUser.findOne({
        _id: populatedRequest.requestedBy,
        companyId: companyId,
        isActive: true
      }).select('_id name email role').lean();
      
      if (requester) {
        populatedRequest.requestedBy = requester;
      }
    }

    // Send notifications to Super Admins independently (non-blocking)
    setImmediate(async () => {
      try {
        const superAdmins = await locationNotificationRouter.getSuperAdmins(companyId);

        // Deduplicate recipients by userId
        const uniqueAdmins = Array.from(
          new Map(superAdmins.map(admin => [admin._id.toString(), admin])).values()
        );

        const fromLocationName = populatedRequest.destinationLocation?.name || 'Unknown location';
        const toLocationName = populatedRequest.sourceLocation?.name || 'Unknown location';
        const requesterName = populatedRequest.requestedBy?.name || 'Unknown user';
        const itemCount = populatedRequest.items?.length || 0;

        // Send in-app notifications
        const inAppPromises = uniqueAdmins.map(admin =>
          notificationService.sendToCompanyUser(companyId, admin._id, {
            category: 'inventory',
            event: 'stock_request_created',
            title: 'New Stock Request',
            message: `Stock request ${requestNumber} created by ${requesterName}. From: ${fromLocationName}, To: ${toLocationName}, Items: ${itemCount}, Priority: ${priority}`,
            data: {
              requestId: stockRequest._id,
              requestNumber: requestNumber,
              fromLocationName,
              toLocationName,
              itemCount,
              priority,
              requesterName
            },
            priority: priority === 'urgent' ? 'high' : 'medium',
            actionUrl: `/inventory/stock-requests/${stockRequest._id}`
          }).catch(error => {
            logger.error(`Failed to send notification to super admin ${admin._id}:`, error);
            return null;
          })
        );

        await Promise.allSettled(inAppPromises);
        logger.info(`In-app notifications sent to ${uniqueAdmins.length} super admin(s)`);

        // Send email notifications
        const emailPromises = uniqueAdmins
          .filter(admin => admin.email)
          .map(admin =>
            stockRequestEmailService.sendStockRequestCreationNotification(admin.email, {
              request: populatedRequest,
              recipientName: admin.name
            }).catch(error => {
              logger.error(`Failed to send email to super admin ${admin.email}:`, error);
              return null;
            })
          );

        await Promise.allSettled(emailPromises);
        logger.info(`Email notifications sent to ${emailPromises.length} super admin(s)`);

        logger.info(`Notifications completed for stock request ${requestNumber}`);
      } catch (notificationError) {
        logger.error('Error sending request creation notifications:', notificationError);
      }
    });

    return populatedRequest;
  } catch (error) {
    logger.error('Error creating stock request:', error);
    throw error;
  }
};

/**
 * Check if user is Warehouse Admin
 * @param {Object} user - User object
 * @returns {boolean} True if user is Warehouse Admin
 */
const isWarehouseAdmin = (user) => {
  return user.role === 'warehouse_admin';
};

/**
 * Validate user can approve requests (Super Admin or Warehouse Admin with location access)
 * @param {Object} user - User object
 * @param {string} toLocationId - Destination location ID
 * @returns {boolean} True if user can approve
 */
const canApproveRequest = (user, toLocationId) => {
  // Super Admins can approve all requests
  if (isSuperAdmin(user)) {
    return true;
  }
  
  // Warehouse Admins can approve if they have access to sourceLocation
  if (isWarehouseAdmin(user) && hasLocationAccess(user, toLocationId)) {
    return true;
  }
  
  return false;
};

/**
 * Reserve inventory using FIFO with FEFO prioritization
 * Queries InventoryBatchLocation in FIFO order (oldest createdAt first)
 * Excludes expired batches and non-active batches
 * Prioritizes by earliest expiryDate within FIFO order (FEFO within FIFO)
 * 
 * @param {Object} companyDB - Company database connection
 * @param {string} fromLocationId - Source location ID
 * @param {string} inventoryItemId - Inventory item ID
 * @param {number} quantityToReserve - Quantity to reserve
 * @returns {Promise<Array>} Array of batch reservations with retry logic
 */
const reserveInventoryFIFO = async (
  companyDB,
  fromLocationId,
  inventoryItemId,
  quantityToReserve
) => {
  const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);
  const maxRetries = 3;
  const baseBackoffMs = 100;
  
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Query batches in FIFO order with FEFO prioritization
      // 1. Filter: active status, not expired, has available quantity
      // 2. Sort: createdAt ASC (FIFO), then expiryDate ASC (FEFO within FIFO)
      const now = new Date();
      
      const batches = await InventoryBatchLocation.find({
        locationId: fromLocationId,
        inventoryItem: inventoryItemId,
        status: 'active',
        availableQuantity: { $gt: 0 },
        $or: [
          { expiryDate: { $exists: false } },
          { expiryDate: { $gte: now } }
        ]
      })
      .sort({ createdAt: 1, expiryDate: 1 }); // FIFO with FEFO
      
      // Calculate total available quantity
      const totalAvailable = batches.reduce((sum, batch) => sum + batch.availableQuantity, 0);
      
      if (totalAvailable < quantityToReserve) {
        // Get location details for better error message
        const Location = companyDB.model('Location');
        const location = await Location.findById(fromLocationId).select('name type capabilities');
        
        const locationName = location?.name || 'Unknown location';
        const locationType = location?.type || 'location';
        
        let errorMessage = `Insufficient inventory at ${locationName}: requested ${quantityToReserve}, available ${totalAvailable}`;
        
        // Add helpful suggestion based on location type
        if (locationType === 'warehouse' && location?.capabilities?.canProcureDirectly) {
          errorMessage += `. Create a GRN to add inventory to this warehouse first, or approve with partial quantity (${totalAvailable}) and create a backorder for the remaining items.`;
        } else if (totalAvailable > 0) {
          errorMessage += `. You can approve with partial quantity (${totalAvailable}) and create a backorder for the remaining items.`;
        } else {
          errorMessage += `. Add inventory to this location first or approve with 0 quantity to create a full backorder.`;
        }
        
        throw new Error(errorMessage);
      }
      
      // Reserve inventory from batches using FIFO
      let remainingToReserve = quantityToReserve;
      const reservations = [];
      
      for (const batch of batches) {
        if (remainingToReserve <= 0) break;
        
        const quantityFromThisBatch = Math.min(batch.availableQuantity, remainingToReserve);
        
        // Update batch with optimistic locking
        const updateResult = await InventoryBatchLocation.updateOne(
          {
            _id: batch._id,
            version: batch.version // Optimistic locking check
          },
          {
            $inc: {
              reservedQuantity: quantityFromThisBatch,
              version: 1
            }
          }
        );
        
        if (updateResult.modifiedCount === 0) {
          // Optimistic locking failure - version mismatch
          throw new Error('OPTIMISTIC_LOCK_FAILURE');
        }
        
        // Verify inventory invariant after update
        const updatedBatch = await InventoryBatchLocation.findById(batch._id);
        const totalQuantity = updatedBatch.availableQuantity + updatedBatch.reservedQuantity;
        const originalTotal = batch.availableQuantity + batch.reservedQuantity + quantityFromThisBatch;
        
        if (Math.abs(totalQuantity - originalTotal) > 0.000001) {
          throw new Error(
            `Inventory invariant violation: expected ${originalTotal}, got ${totalQuantity}`
          );
        }
        
        reservations.push({
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          quantityReserved: quantityFromThisBatch,
          unitCost: batch.unitCost,
          expiryDate: batch.expiryDate,
          manufacturingDate: batch.manufacturingDate
        });
        
        remainingToReserve -= quantityFromThisBatch;
      }
      
      return reservations;
      
    } catch (error) {
      if (error.message === 'OPTIMISTIC_LOCK_FAILURE' && attempt < maxRetries - 1) {
        // Retry with exponential backoff
        attempt++;
        const backoffMs = baseBackoffMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        logger.warn(`Optimistic locking failure, retrying (attempt ${attempt}/${maxRetries})`);
        continue;
      }
      
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded for inventory reservation');
};

/**
 * Generate unique transfer number in format TRF-YYYYMMDD-NNNN
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<string>} Unique transfer number
 */
const generateTransferNumber = async (companyDB) => {
  const Counter = getCounterModel(companyDB);
  
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const counterId = `TRANSFER_${dateStr}`;
  
  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { sequence: 1 } },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true
    }
  );
  
  const transferNumber = `TRF-${dateStr}-${counter.sequence.toString().padStart(4, '0')}`;
  return transferNumber;
};

/**
 * Approve stock request (full or partial approval)
 * Creates transfer and backorders as needed
 * Uses database transaction for atomicity
 * 
 * @param {string} companyId - Company ID
 * @param {string} requestId - Stock request ID
 * @param {string} userId - User ID approving the request
 * @param {Object} approvalData - Approval data with items and approved quantities
 * @param {string} ipAddress - IP address of approver
 * @param {string} deviceInfo - Device information
 * @returns {Promise<Object>} Approval result with request, transfer, and backorders
 */
export const approveRequest = async (
  companyId,
  requestId,
  userId,
  approvalData,
  ipAddress,
  deviceInfo
) => {
  // Get company database first
  const companyDB = getCompanyDB(companyId);
  
  try {
    // Get user details
    const user = await CompanyUser.findOne({
      _id: userId,
      companyId: companyId,
      isActive: true
    });
    
    if (!user) {
      throw new Error('User not found or inactive');
    }
    
    const StockRequest = getStockRequestModel(companyDB);
    const StockTransfer = getStockTransferModel(companyDB);
    const StockBackorder = getStockBackorderModel(companyDB);
    
    // Log the query parameters for debugging
    logger.info('Attempting to find stock request', {
      requestId,
      requestIdOriginal: requestId,
      companyId,
      requestIdType: typeof requestId,
      isValidObjectId: mongoose.Types.ObjectId.isValid(requestId),
      requestIdLength: requestId.length
    });
    
    // Try to find without companyId filter first for debugging
    const requestWithoutCompanyFilter = await StockRequest.findById(requestId);
    logger.info('Stock request query without company filter', {
      found: !!requestWithoutCompanyFilter,
      companyIdInDb: requestWithoutCompanyFilter?.companyId,
      companyIdProvided: companyId,
      match: requestWithoutCompanyFilter?.companyId === companyId
    });
    
    // Get stock request with optimistic locking
    const request = await StockRequest.findOne({
      _id: requestId,
      companyId: companyId
    });
    
    logger.info('Stock request query result', {
      found: !!request,
      requestIdAfterQuery: requestId,
      requestIdUsedInQuery: requestId
    });
    
    if (!request) {
      throw new Error('Stock request not found');
    }
    
    // Validate request status is 'pending'
    if (request.status !== 'pending') {
      throw new Error(`Cannot approve request with status '${request.status}'. Only 'pending' requests can be approved.`);
    }
    
    // Validate user authorization
    if (!canApproveRequest(user, request.sourceLocation)) {
      throw new Error('User is not authorized to approve this request. Must be Super Admin or Warehouse Admin with access to destination location.');
    }
    
    // Validate approval data
    if (!approvalData.items || !Array.isArray(approvalData.items) || approvalData.items.length === 0) {
      throw new Error('Approval data must include items array');
    }
    
    // Validate approved quantities
    const approvalMap = new Map();
    for (const approvalItem of approvalData.items) {
      if (!approvalItem.inventoryItem) {
        throw new Error('Each approval item must have inventoryItem');
      }
      
      if (approvalItem.approvedQuantity < 0) {
        throw new Error('Approved quantity cannot be negative');
      }
      
      // Find corresponding request item
      const requestItem = request.items.find(
        item => item.inventoryItem.toString() === approvalItem.inventoryItem.toString()
      );
      
      if (!requestItem) {
        throw new Error(`Item ${approvalItem.inventoryItem} not found in request`);
      }
      
      if (approvalItem.approvedQuantity > requestItem.requestedQuantity) {
        throw new Error(
          `Approved quantity (${approvalItem.approvedQuantity}) cannot exceed requested quantity (${requestItem.requestedQuantity})`
        );
      }
      
      approvalMap.set(approvalItem.inventoryItem.toString(), approvalItem.approvedQuantity);
    }
    
    // Check if source location is a warehouse type
    const Location = companyDB.model('Location');
    const sourceLocation = await Location.findById(request.sourceLocation).select('type name');
    const isWarehouseSource = sourceLocation?.type === 'warehouse';
    
    // Reserve inventory for each approved item
    const transferItems = [];
    const backorderItems = [];
    
    for (const requestItem of request.items) {
      const itemIdStr = requestItem.inventoryItem.toString();
      const approvedQuantity = approvalMap.get(itemIdStr) || 0;
      const backorderedQuantity = requestItem.requestedQuantity - approvedQuantity;
      
      // Update request item with approved and backordered quantities
      requestItem.approvedQuantity = approvedQuantity;
      requestItem.backorderedQuantity = backorderedQuantity;
      
      // Reserve inventory if approved quantity > 0
      if (approvedQuantity > 0) {
        let reservations = [];
        let totalCost = 0;
        
        // Skip inventory reservation for warehouse-type locations
        // Warehouses have separate WMS and don't track inventory in this system
        if (!isWarehouseSource) {
          // Reserve inventory from sourceLocation (the source/warehouse)
          reservations = await reserveInventoryFIFO(
            companyDB,
            request.sourceLocation, // Source location (warehouse)
            requestItem.inventoryItem,
            approvedQuantity,
            null
          );
          totalCost = reservations.reduce((sum, r) => sum + (r.quantityReserved * r.unitCost), 0);
        } else {
          // For warehouse sources, create a placeholder reservation
          // This will be reconciled when WMS integration is built
          logger.info(
            `Skipping inventory reservation for warehouse ${sourceLocation.name}. ` +
            `Request ${request.requestNumber} approved without inventory validation. ` +
            `Future WMS integration will handle actual inventory tracking.`
          );
          
          // Use zero cost for warehouse items since we don't track their inventory
          totalCost = 0;
        }
        
        // Create transfer item
        transferItems.push({
          inventoryItem: requestItem.inventoryItem,
          requestedQuantity: approvedQuantity,
          sentQuantity: approvedQuantity,
          backorderedQuantity: 0,
          unit: requestItem.unit,
          notes: requestItem.notes,
          batchCosts: reservations.map(r => ({
            sourceBatchId: r.batchId,
            quantity: r.quantityReserved,
            unitCost: r.unitCost,
            totalCost: r.quantityReserved * r.unitCost
          })),
          totalCost: totalCost,
          // Add flag to indicate this is from a warehouse without inventory tracking
          isWarehouseSource: isWarehouseSource
        });
      }
      
      // Create backorder if backordered quantity > 0
      if (backorderedQuantity > 0) {
        backorderItems.push({
          companyId: companyId,
          originalRequestId: request._id,
          originalTransferId: null, // Will be set after transfer creation
          destinationLocation: request.sourceLocation, // Source location (warehouse)
          sourceLocation: request.destinationLocation, // Destination location (requesting branch)
          inventoryItem: requestItem.inventoryItem,
          backorderedQuantity: backorderedQuantity,
          unit: requestItem.unit,
          status: 'pending',
          createdBy: userId,
          createdIpAddress: ipAddress,
          createdDeviceInfo: deviceInfo,
          notes: `Backorder from request ${request.requestNumber}`
        });
      }
    }
    
    // Update request status to 'approved' with optimistic locking
    const updateResult = await StockRequest.updateOne(
      {
        _id: request._id,
        version: request.version
      },
      {
        $set: {
          status: 'approved',
          approvedBy: userId,
          approvedDate: new Date(),
          approvedIpAddress: ipAddress,
          approvedDeviceInfo: deviceInfo,
          approvalNotes: approvalData.notes || '',
          items: request.items  // Save updated items with approvedQuantity and backorderedQuantity
        },
        $inc: { version: 1 }
      }
    );
    
    if (updateResult.modifiedCount === 0) {
      throw new Error('Request was modified by another user. Please refresh and try again.');
    }
    
    // Create stock transfer if any items were approved
    let transfer = null;
    if (transferItems.length > 0) {
      const transferNumber = await generateTransferNumber(companyDB);
      
      transfer = new StockTransfer({
        transferNumber,
        companyId: companyId,
        destinationLocation: request.sourceLocation, // Source location (warehouse)
        sourceLocation: request.destinationLocation, // Destination location (requesting branch)
        transferType: 'request',
        originalRequestId: request._id,
        priority: request.priority,
        expectedDeliveryDate: request.expectedDeliveryDate,
        items: transferItems,
        status: 'approved',
        requestedBy: request.requestedBy,
        requestDate: request.requestDate,
        approvedBy: userId,
        approvedDate: new Date(),
        notes: `Transfer created from approved request ${request.requestNumber}`,
        executionStages: [],
        version: 0
      });
      
      await transfer.save();
      
      // Link transfer back to request
      await StockRequest.updateOne(
        { _id: request._id },
        { $set: { createdTransferId: transfer._id } }
      );
      
      // Auto-initiate PROCESS_STARTED stage when source accepts the request
      // This happens immediately after approval (source has accepted the request)
      const processStartedStage = {
        stage: 'PROCESS_STARTED',
        timestamp: new Date(),
        updatedBy: userId,
        updatedByName: user.name || 'System',
        ipAddress: ipAddress,
        deviceInfo: deviceInfo,
        notes: 'Transfer process started automatically after request approval'
      };
      
      transfer.executionStages.push(processStartedStage);
      await transfer.save();
      
      logger.info(`PROCESS_STARTED stage auto-initiated for transfer ${transfer.transferNumber}`);
    }
    
    // Create backorders
    const backorders = [];
    if (backorderItems.length > 0 && transfer) {
      // Set originalTransferId for backorders
      for (const backorderItem of backorderItems) {
        backorderItem.originalTransferId = transfer._id;
      }
      
      const createdBackorders = await StockBackorder.insertMany(backorderItems);
      backorders.push(...createdBackorders);
    }
    
    // Get updated request with populated fields
    const updatedRequest = await StockRequest.findById(request._id)
      .populate('destinationLocation')
      .populate('sourceLocation')
      .populate('items.inventoryItem')
      .lean();
    
    // Manually populate requestedBy and approvedBy from platform CompanyUser model
    if (updatedRequest.requestedBy) {
      const requester = await CompanyUser.findOne({
        _id: updatedRequest.requestedBy,
        companyId: companyId,
        isActive: true
      }).select('_id name email role').lean();
      
      if (requester) {
        updatedRequest.requestedBy = requester;
      }
    }
    
    if (updatedRequest.approvedBy) {
      const approver = await CompanyUser.findOne({
        _id: updatedRequest.approvedBy,
        companyId: companyId,
        isActive: true
      }).select('_id name email role').lean();
      
      if (approver) {
        updatedRequest.approvedBy = approver;
      }
    }
    
    logger.info(
      `Stock request ${request.requestNumber} approved by user ${userId} for company ${companyId}. ` +
      `Transfer: ${transfer ? transfer.transferNumber : 'none'}, Backorders: ${backorders.length}`
    );

    // Send notifications asynchronously (fire-and-forget) - don't block the API response
    // This runs independently in the background
    setImmediate(async () => {
      try {
        const superAdmins = await locationNotificationRouter.getSuperAdmins(companyId);
        const sourceLocationUsers = await locationNotificationRouter.getUsersByLocation(companyId, request.sourceLocation.toString());
        const destinationLocationUsers = await locationNotificationRouter.getUsersByLocation(companyId, request.destinationLocation.toString());
        
        const fromLocationName = updatedRequest.destinationLocation?.name || 'Unknown location';
        const toLocationName = updatedRequest.sourceLocation?.name || 'Unknown location';
        const approverName = updatedRequest.approvedBy?.name || 'Unknown user';
        const itemCount = updatedRequest.items?.length || 0;
        const hasBackorders = backorders.length > 0;

        // 1. Send to Super Admins
        for (const admin of superAdmins) {
          try {
            await notificationService.sendToCompanyUser(companyId, admin._id, {
              category: 'inventory',
              event: 'stock_request_approved',
              title: 'Stock Request Approved',
              message: `Stock request ${request.requestNumber} approved by ${approverName}. From: ${fromLocationName}, To: ${toLocationName}, Items: ${itemCount}${hasBackorders ? `, Backorders: ${backorders.length}` : ''}`,
              data: {
                requestId: updatedRequest._id,
                requestNumber: request.requestNumber,
                fromLocationName,
                toLocationName,
                itemCount,
                approverName,
                transferNumber: transfer?.transferNumber,
                backorderCount: backorders.length
              },
              priority: 'low',
              actionUrl: `/inventory/stock-requests/${updatedRequest._id}`
            });

            if (admin.email) {
              await stockRequestEmailService.sendStockRequestApprovalNotification(admin.email, {
                request: updatedRequest,
                recipientName: admin.name,
                transfer: transfer,
                backorders: backorders
              });
            }
          } catch (error) {
            logger.error(`Failed to send notification to super admin ${admin._id}:`, error);
          }
        }

        // 2. Send to Source Location Users (Warehouse - receiving the request)
        // Message: "You have received an item request from..."
        for (const user of sourceLocationUsers) {
          try {
            const isApprover = user._id.toString() === userId.toString();
            
            await notificationService.sendToCompanyUser(companyId, user._id, {
              category: 'inventory',
              event: 'stock_request_approved',
              title: isApprover ? 'Stock Request Approved' : 'Item Request Received',
              message: isApprover
                ? `You approved stock request ${request.requestNumber} from ${fromLocationName}. Items: ${itemCount}${hasBackorders ? `, Backorders: ${backorders.length}` : ''}`
                : `You have received an item request ${request.requestNumber} from ${fromLocationName}. Items: ${itemCount}. Approved by ${approverName}.${hasBackorders ? ` ${backorders.length} item(s) backordered.` : ''}`,
              data: {
                requestId: updatedRequest._id,
                requestNumber: request.requestNumber,
                fromLocationName,
                toLocationName,
                itemCount,
                approverName,
                transferNumber: transfer?.transferNumber,
                backorderCount: backorders.length
              },
              priority: isApprover ? 'medium' : 'low',
              actionUrl: `/inventory/stock-requests/${updatedRequest._id}`
            });

            if (user.email) {
              await stockRequestEmailService.sendStockRequestApprovalNotification(user.email, {
                request: updatedRequest,
                recipientName: user.name,
                transfer: transfer,
                backorders: backorders,
                isSourceLocation: true,  // Flag to customize email template
                isApprover: isApprover
              });
            }
          } catch (error) {
            logger.error(`Failed to send notification to source location user ${user._id}:`, error);
          }
        }

        // 3. Send to Destination Location Users (Requesting branch)
        // Message: "Your request has been approved" or "Incoming stock approved"
        for (const user of destinationLocationUsers) {
          try {
            const isRequester = user._id.toString() === updatedRequest.requestedBy._id.toString();
            
            await notificationService.sendToCompanyUser(companyId, user._id, {
              category: 'inventory',
              event: 'stock_request_approved',
              title: isRequester ? 'Your Stock Request Approved' : 'Incoming Stock Approved',
              message: isRequester
                ? `Your stock request ${request.requestNumber} has been approved by ${approverName} at ${toLocationName}. ${hasBackorders ? `${backorders.length} item(s) backordered.` : 'All items approved.'}`
                : `Stock request ${request.requestNumber} approved. Your location (${fromLocationName}) will receive ${itemCount} item(s) from ${toLocationName}.${hasBackorders ? ` ${backorders.length} item(s) backordered.` : ''}`,
              data: {
                requestId: updatedRequest._id,
                requestNumber: request.requestNumber,
                fromLocationName,
                toLocationName,
                itemCount,
                approverName,
                transferNumber: transfer?.transferNumber,
                backorderCount: backorders.length
              },
              priority: isRequester ? 'medium' : 'low',
              actionUrl: `/inventory/stock-requests/${updatedRequest._id}`
            });

            if (user.email) {
              await stockRequestEmailService.sendStockRequestApprovalNotification(user.email, {
                request: updatedRequest,
                recipientName: user.name,
                transfer: transfer,
                backorders: backorders,
                isSourceLocation: false,  // Flag to customize email template
                isRequester: isRequester
              });
            }
          } catch (error) {
            logger.error(`Failed to send notification to destination location user ${user._id}:`, error);
          }
        }

        // 4. If backorders were created, notify the requester separately
        if (hasBackorders) {
          try {
            await notificationService.sendToCompanyUser(companyId, updatedRequest.requestedBy._id, {
              category: 'inventory',
              event: 'backorder_created',
              title: 'Backorder Created',
              message: `${backorders.length} item(s) from request ${request.requestNumber} have been backordered due to insufficient inventory.`,
              data: {
                requestId: updatedRequest._id,
                requestNumber: request.requestNumber,
                backorderCount: backorders.length,
                backorderIds: backorders.map(b => b._id)
              },
              priority: 'medium',
              actionUrl: `/inventory/backorders`
            });

            if (updatedRequest.requestedBy.email) {
              for (const backorder of backorders) {
                const populatedBackorder = {
                  ...backorder.toObject(),
                  originalRequestId: updatedRequest,
                  destinationLocation: updatedRequest.destinationLocation,
                  sourceLocation: updatedRequest.sourceLocation,
                  inventoryItem: updatedRequest.items.find(item => 
                    item.inventoryItem._id.toString() === backorder.inventoryItem.toString()
                  )?.inventoryItem
                };

                await stockRequestEmailService.sendBackorderCreationNotification(updatedRequest.requestedBy.email, {
                  backorder: populatedBackorder,
                  recipientName: updatedRequest.requestedBy.name
                });
              }
            }
          } catch (error) {
            logger.error(`Failed to send backorder notifications:`, error);
          }
        }

        logger.info(`Approval notifications sent asynchronously for stock request ${request.requestNumber}`);
      } catch (error) {
        logger.error('Error in async notification sending:', error);
      }
    });

    
    return {
      request: updatedRequest,
      transfer: transfer,
      backorders: backorders
    };
    
  } catch (error) {
    logger.error('Error approving stock request:', error);
    throw error;
  }
};

/**
 * Reject stock request
 * @param {string} companyId - Company ID
 * @param {string} requestId - Request ID to reject
 * @param {string} userId - User ID performing rejection
 * @param {string} rejectionReason - Reason for rejection (required)
 * @param {string} ipAddress - IP address of user
 * @param {string} deviceInfo - Device information
 * @returns {Promise<Object>} Rejected stock request
 */
export const rejectRequest = async (
  companyId,
  requestId,
  userId,
  rejectionReason,
  ipAddress,
  deviceInfo
) => {
  // Get company database first
  const companyDB = getCompanyDB(companyId);
  
  try {
    // Validate rejection reason is non-empty
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new Error('Rejection reason is required and cannot be empty');
    }
    
    // Get user details
    const user = await CompanyUser.findOne({
      _id: userId,
      companyId: companyId,
      isActive: true
    });
    
    if (!user) {
      throw new Error('User not found or inactive');
    }
    
    const StockRequest = getStockRequestModel(companyDB);
    
    // Get stock request with optimistic locking
    const request = await StockRequest.findOne({
      _id: requestId,
      companyId: companyId
    });
    
    if (!request) {
      throw new Error('Stock request not found');
    }
    
    // Validate request status is 'pending'
    if (request.status !== 'pending') {
      throw new Error(`Cannot reject request with status '${request.status}'. Only 'pending' requests can be rejected.`);
    }
    
    // Validate user authorization
    // Must be Super Admin or Warehouse Admin with access to sourceLocation
    if (!canApproveRequest(user, request.sourceLocation)) {
      throw new Error('User is not authorized to reject this request. Must be Super Admin or Warehouse Admin with access to destination location.');
    }
    
    // Update request status to 'rejected' with optimistic locking
    const updateResult = await StockRequest.updateOne(
      {
        _id: request._id,
        version: request.version
      },
      {
        $set: {
          status: 'rejected',
          rejectedBy: userId,
          rejectedDate: new Date(),
          rejectedIpAddress: ipAddress,
          rejectedDeviceInfo: deviceInfo,
          rejectionReason: rejectionReason.trim()
        },
        $inc: { version: 1 }
      }
    );
    
    if (updateResult.modifiedCount === 0) {
      throw new Error('Request was modified by another user. Please refresh and try again.');
    }
    
    // Get updated request with populated fields
    const updatedRequest = await StockRequest.findById(request._id)
      .populate('destinationLocation')
      .populate('sourceLocation')
      .populate('items.inventoryItem')
      .lean();
    
    // Manually populate requestedBy and rejectedBy from platform CompanyUser model
    if (updatedRequest.requestedBy) {
      const requester = await CompanyUser.findOne({
        _id: updatedRequest.requestedBy,
        companyId: companyId,
        isActive: true
      }).select('_id name email role').lean();
      
      if (requester) {
        updatedRequest.requestedBy = requester;
      }
    }
    
    if (updatedRequest.rejectedBy) {
      const rejector = await CompanyUser.findOne({
        _id: updatedRequest.rejectedBy,
        companyId: companyId,
        isActive: true
      }).select('_id name email role').lean();
      
      if (rejector) {
        updatedRequest.rejectedBy = rejector;
      }
    }
    
    logger.info(
      `Stock request ${request.requestNumber} rejected by user ${userId} for company ${companyId}. ` +
      `Reason: ${rejectionReason}`
    );

    // Send notification to requestedBy user with rejectionReason
    try {
      const fromLocationName = updatedRequest.destinationLocation?.name || 'Unknown location';
      const toLocationName = updatedRequest.sourceLocation?.name || 'Unknown location';
      const rejectorName = updatedRequest.rejectedBy?.name || 'Unknown user';

      await notificationService.sendToCompanyUser(companyId, updatedRequest.requestedBy._id, {
        category: 'inventory',
        event: 'stock_request_rejected',
        title: 'Stock Request Rejected',
        message: `Your stock request ${request.requestNumber} has been rejected by ${rejectorName}. Reason: ${rejectionReason}`,
        data: {
          requestId: updatedRequest._id,
          requestNumber: request.requestNumber,
          fromLocationName,
          toLocationName,
          rejectorName,
          rejectionReason
        },
        priority: 'high',
        actionUrl: `/inventory/stock-requests/${updatedRequest._id}`
      }).catch(error => {
        logger.error(`Failed to send rejection notification to requester ${updatedRequest.requestedBy._id}:`, error);
      });

      // Send email notification to requester
      if (updatedRequest.requestedBy?.email) {
        await stockRequestEmailService.sendStockRequestRejectionNotification(updatedRequest.requestedBy.email, {
          request: updatedRequest,
          recipientName: updatedRequest.requestedBy.name
        }).catch(error => {
          logger.error(`Failed to send rejection email to requester ${updatedRequest.requestedBy.email}:`, error);
        });
      }

      logger.info(`Rejection notification sent for stock request ${request.requestNumber}`);
    } catch (notificationError) {
      // Log but don't fail the rejection
      logger.error('Error sending rejection notification:', notificationError);
    }
    
    return updatedRequest;
    
  } catch (error) {
    logger.error('Error rejecting stock request:', error);
    throw error;
  }
};

/**
 * Cancel stock request
 * @param {string} companyId - Company ID
 * @param {string} requestId - Request ID to cancel
 * @param {string} userId - User ID performing cancellation
 * @param {string} cancellationReason - Reason for cancellation (required)
 * @param {string} ipAddress - IP address of user
 * @param {string} deviceInfo - Device information
 * @returns {Promise<Object>} Cancelled stock request
 */
export const cancelRequest = async (
  companyId,
  requestId,
  userId,
  cancellationReason,
  ipAddress,
  deviceInfo
) => {
  // Get company database first
  const companyDB = getCompanyDB(companyId);
  
  try {
    // Validate cancellation reason is non-empty
    if (!cancellationReason || cancellationReason.trim().length === 0) {
      throw new Error('Cancellation reason is required and cannot be empty');
    }
    
    // Get user details
    const user = await CompanyUser.findOne({
      _id: userId,
      companyId: companyId,
      isActive: true
    });
    
    if (!user) {
      throw new Error('User not found or inactive');
    }
    
    const StockRequest = getStockRequestModel(companyDB);
    
    // Get stock request with optimistic locking
    const request = await StockRequest.findOne({
      _id: requestId,
      companyId: companyId
    });
    
    if (!request) {
      throw new Error('Stock request not found');
    }
    
    // Validate user authorization
    // User must be the requester OR have approval rights (Super Admin or Warehouse Admin with location access)
    const isRequester = request.requestedBy.toString() === userId.toString();
    const hasApprovalRights = canApproveRequest(user, request.sourceLocation);
    
    if (!isRequester && !hasApprovalRights) {
      throw new Error('User is not authorized to cancel this request. Must be the requester, Super Admin, or Warehouse Admin with access to destination location.');
    }
    
    // Validate request can be cancelled (only pending or approved requests can be cancelled)
    if (!['pending', 'approved'].includes(request.status)) {
      throw new Error(`Cannot cancel request with status '${request.status}'. Only 'pending' or 'approved' requests can be cancelled.`);
    }
    
    // If request is approved, we need to release inventory reservations
    if (request.status === 'approved') {
      // Get the associated transfer
      if (request.createdTransferId) {
        const StockTransfer = getStockTransferModel(companyDB);
        const transfer = await StockTransfer.findById(request.createdTransferId);
        
        if (transfer && transfer.status === 'approved') {
          // Check if source is a warehouse (skip inventory release for warehouses)
          const Location = companyDB.model('Location');
          const sourceLocation = await Location.findById(request.sourceLocation).select('type name');
          const isWarehouseSource = sourceLocation?.type === 'warehouse';
          
          // Release inventory reservations only for non-warehouse sources
          if (!isWarehouseSource) {
            const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);
            
            for (const item of transfer.items) {
              if (item.batchCosts && item.batchCosts.length > 0) {
                for (const batchCost of item.batchCosts) {
                  // Decrement reservedQuantity with optimistic locking and retry
                  let retries = 3;
                  let success = false;
                  
                  while (retries > 0 && !success) {
                    try {
                      const batch = await InventoryBatchLocation.findById(batchCost.sourceBatchId);
                      
                      if (batch) {
                        const updateResult = await InventoryBatchLocation.updateOne(
                          {
                            _id: batch._id,
                            version: batch.version
                          },
                          {
                            $inc: { 
                              reservedQuantity: -batchCost.quantity,
                              version: 1
                            }
                          }
                        );
                        
                        if (updateResult.modifiedCount > 0) {
                          success = true;
                        } else {
                          retries--;
                          if (retries > 0) {
                            // Exponential backoff
                            await new Promise(resolve => setTimeout(resolve, 100 * (4 - retries)));
                          }
                        }
                      } else {
                        success = true; // Batch doesn't exist, skip
                      }
                    } catch (err) {
                      retries--;
                      if (retries === 0) {
                        throw new Error(`Failed to release inventory reservation for batch ${batchCost.sourceBatchId}: ${err.message}`);
                      }
                      // Exponential backoff
                      await new Promise(resolve => setTimeout(resolve, 100 * (4 - retries)));
                    }
                  }
                }
              }
            }
          } else {
            logger.info(
              `Skipping inventory release for warehouse ${sourceLocation.name}. ` +
              `Request ${request.requestNumber} cancelled without inventory release.`
            );
          }
          
          // Cancel the transfer
          await StockTransfer.updateOne(
            { _id: transfer._id },
            { 
              $set: { 
                status: 'cancelled',
                cancelledBy: userId,
                cancelledDate: new Date(),
                cancelledIpAddress: ipAddress,
                cancelledDeviceInfo: deviceInfo,
                cancellationReason: `Transfer cancelled due to request cancellation: ${cancellationReason}`
              },
              $inc: { version: 1 }
            }
          );
        }
      }
    }
    
    // Update request status to 'cancelled' with optimistic locking
    const updateResult = await StockRequest.updateOne(
      {
        _id: request._id,
        version: request.version
      },
      {
        $set: {
          status: 'cancelled',
          cancelledBy: userId,
          cancelledDate: new Date(),
          cancelledIpAddress: ipAddress,
          cancelledDeviceInfo: deviceInfo,
          cancellationReason: cancellationReason.trim()
        },
        $inc: { version: 1 }
      }
    );
    
    if (updateResult.modifiedCount === 0) {
      throw new Error('Request was modified by another user. Please refresh and try again.');
    }
    
    // Get updated request with populated fields for notifications
    const updatedRequest = await StockRequest.findById(request._id)
      .populate('destinationLocation')
      .populate('sourceLocation')
      .populate('items.inventoryItem')
      .lean();
    
    // Manually populate cancelledBy from platform CompanyUser model
    if (updatedRequest.cancelledBy) {
      const canceller = await CompanyUser.findOne({
        _id: updatedRequest.cancelledBy,
        companyId: companyId,
        isActive: true
      }).select('_id name email role').lean();
      
      if (canceller) {
        updatedRequest.cancelledBy = canceller;
      }
    }
    
    logger.info(
      `Stock request ${request.requestNumber} cancelled by user ${userId} for company ${companyId}. ` +
      `Reason: ${cancellationReason}`
    );

    // Send notifications to Super Admins independently (non-blocking)
    setImmediate(async () => {
      try {
        const superAdmins = await locationNotificationRouter.getSuperAdmins(companyId);

        // Deduplicate recipients by userId
        const uniqueAdmins = Array.from(
          new Map(superAdmins.map(admin => [admin._id.toString(), admin])).values()
        );

        const fromLocationName = updatedRequest.destinationLocation?.name || 'Unknown location';
        const toLocationName = updatedRequest.sourceLocation?.name || 'Unknown location';
        const cancellerName = updatedRequest.cancelledBy?.name || user.name || 'Unknown user';

        // Send in-app notifications to super admins
        const inAppPromises = uniqueAdmins.map(admin =>
          notificationService.sendToCompanyUser(companyId, admin._id, {
            category: 'inventory',
            event: 'stock_request_cancelled',
            title: 'Stock Request Cancelled',
            message: `Stock request ${request.requestNumber} has been cancelled by ${cancellerName}. Reason: ${cancellationReason}`,
            data: {
              requestId: updatedRequest._id,
              requestNumber: request.requestNumber,
              fromLocationName,
              toLocationName,
              cancellerName,
              cancellationReason
            },
            priority: 'medium',
            actionUrl: `/inventory/stock-requests/${updatedRequest._id}`
          }).catch(error => {
            logger.error(`Failed to send cancellation notification to super admin ${admin._id}:`, error);
            return null;
          })
        );

        await Promise.allSettled(inAppPromises);
        logger.info(`Cancellation in-app notifications sent to ${uniqueAdmins.length} super admin(s)`);

        // Send email notifications to super admins
        const emailPromises = uniqueAdmins
          .filter(admin => admin.email)
          .map(admin =>
            stockRequestEmailService.sendStockRequestCancellationNotification(admin.email, {
              request: updatedRequest,
              recipientName: admin.name
            }).catch(error => {
              logger.error(`Failed to send cancellation email to super admin ${admin.email}:`, error);
              return null;
            })
          );

        await Promise.allSettled(emailPromises);
        logger.info(`Cancellation email notifications sent to ${emailPromises.length} super admin(s)`);

        logger.info(`Cancellation notifications completed for stock request ${request.requestNumber}`);
      } catch (notificationError) {
        logger.error('Error sending cancellation notifications:', notificationError);
      }
    });
    
    return updatedRequest;
    
  } catch (error) {
    logger.error('Error cancelling stock request:', error);
    throw error;
  }
};


/**
 * Get completed stock requests with their associated transfers
 * Shows requests that have been fully processed (status: completed)
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @param {Object} pagination - Pagination options
 * @param {Object} user - User object for access control
 * @returns {Promise<Object>} Completed requests with pagination
 */
export const getCompletedRequests = async (companyId, filters = {}, pagination = {}, user) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockRequest = getStockRequestModel(companyDB);
    const StockTransfer = getStockTransferModel(companyDB);
    
    const {
      destinationLocation,
      sourceLocation,
      startDate,
      endDate,
      search
    } = filters;
    
    const {
      page = 1,
      limit = 10
    } = pagination;
    
    const skip = (page - 1) * limit;
    
    // Build query for completed requests
    const query = {
      status: 'completed',
      isArchived: false
    };
    
    // Apply location-based filtering
    if (!isSuperAdmin(user)) {
      // Non-Super Admins can only see requests for their locations
      const locationIds = [
        ...(user.branchIds || []),
        ...(user.warehouseIds || [])
      ];
      
      query.$or = [
        { destinationLocation: { $in: locationIds } },
        { sourceLocation: { $in: locationIds } }
      ];
    }
    
    // Apply filters
    if (destinationLocation) {
      query.destinationLocation = destinationLocation;
    }
    
    if (sourceLocation) {
      query.sourceLocation = sourceLocation;
    }
    
    if (startDate || endDate) {
      query.completedDate = {};
      if (startDate) {
        query.completedDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.completedDate.$lte = new Date(endDate);
      }
    }
    
    if (search) {
      query.requestNumber = { $regex: search, $options: 'i' };
    }
    
    // Get total count
    const total = await StockRequest.countDocuments(query);
    const pages = Math.ceil(total / limit);
    
    // Execute query with pagination
    const requests = await StockRequest.find(query)
      .sort({ completedDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate('destinationLocation', 'name type')
      .populate('sourceLocation', 'name type')
      .populate('items.inventoryItem', 'name code')
      .populate('createdTransferId')
      .lean();
    
    // Manually populate user fields
    const userIds = new Set();
    requests.forEach(request => {
      if (request.requestedBy) userIds.add(request.requestedBy.toString());
      if (request.approvedBy) userIds.add(request.approvedBy.toString());
      if (request.completedBy) userIds.add(request.completedBy.toString());
    });
    
    if (userIds.size > 0) {
      const users = await CompanyUser.find({
        _id: { $in: Array.from(userIds) },
        companyId: companyId
      }).select('_id name email role').lean();
      
      const userMap = new Map(users.map(u => [u._id.toString(), u]));
      
      requests.forEach(request => {
        if (request.requestedBy && userMap.has(request.requestedBy.toString())) {
          request.requestedBy = userMap.get(request.requestedBy.toString());
        }
        if (request.approvedBy && userMap.has(request.approvedBy.toString())) {
          request.approvedBy = userMap.get(request.approvedBy.toString());
        }
        if (request.completedBy && userMap.has(request.completedBy.toString())) {
          request.completedBy = userMap.get(request.completedBy.toString());
        }
      });
    }
    
    // Fetch transfer details for each request
    for (const request of requests) {
      if (request.createdTransferId) {
        const transfer = await StockTransfer.findById(request.createdTransferId)
          .select('transferNumber status executionStages exceptions')
          .lean();
        request.transfer = transfer;
      }
    }
    
    logger.info(`Completed requests fetched: ${requests.length} for company ${companyId}`);
    
    return {
      requests,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages
      }
    };
  } catch (error) {
    logger.error('Error getting completed requests:', error);
    throw error;
  }
};
