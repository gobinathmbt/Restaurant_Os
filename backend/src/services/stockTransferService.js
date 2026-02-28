/**
 * Stock Transfer Service
 * Business logic for stock transfer execution stage management
 * Handles stage transitions, exception recording, and stock acceptance
 */

import { getCompanyDB } from '../config/database.js';
import { getStockTransferModel } from '../models/company/StockTransfer.js';
import { getStockRequestModel } from '../models/company/StockRequest.js';
import { getInventoryItemLocationModel } from '../models/company/InventoryItemLocation.js';
import { getInventoryBatchLocationModel } from '../models/company/InventoryBatchLocation.js';
import { getInventoryLedgerModel } from '../models/company/InventoryLedger.js';
import { logger } from '../utils/logger.js';
import CompanyUser from '../models/platform/CompanyUser.js';
import notificationService from './notificationService.js';
import locationNotificationRouter from './locationNotificationRouter.js';

/**
 * Stage transition state machine
 * Defines valid transitions and role permissions for each stage
 * 
 * Field naming (CORRECTED):
 * - transfer.sourceLocation = actual SOURCE (warehouse/branch sending stock)
 * - transfer.destinationLocation = actual DESTINATION (branch receiving stock)
 */
const STAGE_TRANSITIONS = {
  PROCESS_STARTED: {
    next: ['PREPARING_STOCK'],
    roles: ['system'] // Auto-transition only
  },
  PREPARING_STOCK: {
    next: ['LOADING_INTO_VEHICLE'],
    roles: ['sender'] // Source location (warehouse) admins
  },
  LOADING_INTO_VEHICLE: {
    next: ['DISPATCHED'],
    roles: ['sender']
  },
  DISPATCHED: {
    next: ['IN_TRANSIT'],
    roles: ['sender', 'system'] // Sender can dispatch, then auto-transitions to IN_TRANSIT
  },
  IN_TRANSIT: {
    next: ['ARRIVED_AT_DESTINATION'],
    roles: ['destination'] // Destination location (branch) admins can mark as arrived
  },
  ARRIVED_AT_DESTINATION: {
    next: ['UNLOADING'],
    roles: ['destination']
  },
  UNLOADING: {
    next: ['GOODS_RECEIVED_CONFIRMED'],
    roles: ['destination']
  },
  GOODS_RECEIVED_CONFIRMED: {
    next: ['PROCESS_COMPLETED'],
    roles: ['destination', 'system'] // Destination can confirm, then auto-transitions to PROCESS_COMPLETED
  },
  PROCESS_COMPLETED: {
    next: [], // Terminal state
    roles: []
  }
};

/**
 * Check if user is Super Admin
 * @param {Object} user - User object
 * @returns {boolean} True if user is Super Admin
 */
const isSuperAdmin = (user) => {
  return user.role === 'company_super_admin_primary' || 
         user.role === 'company_super_admin_secondary';
};

/**
 * Check if user has access to location
 * @param {Object} user - User object
 * @param {string|Object} locationId - Location ID (string or ObjectId) or populated Location object
 * @returns {boolean} True if user has access
 */
const hasLocationAccess = (user, locationId) => {
  // Super Admins have access to all locations
  if (isSuperAdmin(user)) {
    return true;
  }
  
  // Handle populated location object (has _id property)
  const locationIdStr = (locationId?._id || locationId).toString();
  
  const hasBranchAccess = user.branchIds && user.branchIds.some(
    id => id.toString() === locationIdStr
  );
  const hasWarehouseAccess = user.warehouseIds && user.warehouseIds.some(
    id => id.toString() === locationIdStr
  );
  
  return hasBranchAccess || hasWarehouseAccess;
};

/**
 * Get a stock transfer by ID
 * 
 * @param {string} transferId - Stock transfer ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Stock transfer object
 * @throws {Error} If transfer not found
 */
export const getTransfer = async (transferId, companyId) => {
  try {
    const mongoose = (await import('mongoose')).default;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(transferId)) {
      logger.error(`Invalid transfer ID format: ${transferId}`);
      throw new Error('Invalid transfer ID format');
    }
    
    const companyDB = await getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);
    
    logger.debug(`Fetching transfer ${transferId} for company ${companyId}`);
    
    // Populate company-specific references only
    const transfer = await StockTransfer.findById(transferId)
      .populate('sourceLocation')
      .populate('destinationLocation')
      .populate('items.inventoryItem')
      .populate('exceptions.inventoryItem');
    
    if (!transfer) {
      logger.error(`Stock transfer not found: ${transferId} in company ${companyId}`);
      throw new Error('Stock transfer not found');
    }
    
    // Manually populate user fields from platform database
    const userIds = new Set();
    
    // Collect user IDs
    if (transfer.createdBy) userIds.add(transfer.createdBy.toString());
    if (transfer.approvedBy) userIds.add(transfer.approvedBy.toString());
    if (transfer.completedBy) userIds.add(transfer.completedBy.toString());
    
    // Collect user IDs from exceptions
    if (transfer.exceptions && transfer.exceptions.length > 0) {
      transfer.exceptions.forEach(exception => {
        if (exception.reportedBy) userIds.add(exception.reportedBy.toString());
        if (exception.resolvedBy) userIds.add(exception.resolvedBy.toString());
      });
    }
    
    // Collect user IDs from execution stages
    if (transfer.executionStages && transfer.executionStages.length > 0) {
      transfer.executionStages.forEach(stage => {
        if (stage.updatedBy) userIds.add(stage.updatedBy.toString());
      });
    }
    
    // Fetch all users at once
    if (userIds.size > 0) {
      const users = await CompanyUser.find({
        _id: { $in: Array.from(userIds) },
        companyId: companyId
      }).select('_id name email').lean();
      
      // Create a map for quick lookup
      const userMap = new Map(users.map(user => [user._id.toString(), user]));
      
      // Convert to plain object for manipulation
      const transferObj = transfer.toObject();
      
      // Populate user fields
      if (transferObj.createdBy && userMap.has(transferObj.createdBy.toString())) {
        transferObj.createdBy = userMap.get(transferObj.createdBy.toString());
      }
      if (transferObj.approvedBy && userMap.has(transferObj.approvedBy.toString())) {
        transferObj.approvedBy = userMap.get(transferObj.approvedBy.toString());
      }
      if (transferObj.completedBy && userMap.has(transferObj.completedBy.toString())) {
        transferObj.completedBy = userMap.get(transferObj.completedBy.toString());
      }
      
      // Populate exception user fields
      if (transferObj.exceptions && transferObj.exceptions.length > 0) {
        transferObj.exceptions = transferObj.exceptions.map(exception => {
          if (exception.reportedBy && userMap.has(exception.reportedBy.toString())) {
            exception.reportedBy = userMap.get(exception.reportedBy.toString());
          }
          if (exception.resolvedBy && userMap.has(exception.resolvedBy.toString())) {
            exception.resolvedBy = userMap.get(exception.resolvedBy.toString());
          }
          return exception;
        });
      }
      
      // Populate execution stage user fields
      if (transferObj.executionStages && transferObj.executionStages.length > 0) {
        transferObj.executionStages = transferObj.executionStages.map(stage => {
          if (stage.updatedBy && userMap.has(stage.updatedBy.toString())) {
            const user = userMap.get(stage.updatedBy.toString());
            stage.updatedBy = user;
            // Keep updatedByName for backward compatibility
            if (!stage.updatedByName) {
              stage.updatedByName = user.name;
            }
          }
          return stage;
        });
      }
      
      logger.debug(`Successfully fetched transfer ${transferId} with ${userIds.size} users populated`);
      return transferObj;
    }
    
    logger.debug(`Successfully fetched transfer ${transferId}`);
    return transfer;
  } catch (error) {
    logger.error('Error getting stock transfer:', error);
    throw error;
  }
};

/**
 * Validate stage transition is allowed
 * Checks sequential order, role permissions, and current stage
 * 
 * @param {Object} transfer - Stock transfer object
 * @param {string} newStage - New stage to transition to
 * @param {Object} user - User attempting the transition
 * @returns {boolean} True if transition is valid
 * @throws {Error} If transition is invalid
 */
export const validateStageTransition = (transfer, newStage, user) => {
  try {
    // Get current stage (last stage in executionStages array)
    const currentStage = transfer.executionStages && transfer.executionStages.length > 0
      ? transfer.executionStages[transfer.executionStages.length - 1].stage
      : null;
    
    if (!currentStage) {
      // First stage must be PROCESS_STARTED (manually triggered by source user)
      if (newStage !== 'PROCESS_STARTED') {
        throw new Error('Transfer must start with PROCESS_STARTED stage. Please start the process first.');
      }
      
      // Debug logging
      logger.debug('Validating source location access', {
        userId: user._id,
        userRole: user.role,
        userBranchIds: user.branchIds,
        userWarehouseIds: user.warehouseIds,
        sourceLocationId: transfer.sourceLocation?._id || transfer.sourceLocation,
        destinationLocationId: transfer.destinationLocation?._id || transfer.destinationLocation,
        isSuperAdmin: isSuperAdmin(user),
        hasSourceAccess: hasLocationAccess(user, transfer.sourceLocation),
        hasDestinationAccess: hasLocationAccess(user, transfer.destinationLocation)
      });
      
      // Only source location admins can start the transfer process
      // This is the "Start Work" action in Incoming Requests / Requests To Me tabs
      const hasSourceAccess = hasLocationAccess(user, transfer.sourceLocation);
      
      if (!hasSourceAccess && !isSuperAdmin(user)) {
        throw new Error('Only source location admins can start the transfer process');
      }
      
      return true;
    }
    
    // Check if current stage is terminal
    if (currentStage === 'PROCESS_COMPLETED') {
      throw new Error('Transfer is already completed. No further stage transitions allowed.');
    }
    
    // Get valid next stages for current stage
    const stageConfig = STAGE_TRANSITIONS[currentStage];
    if (!stageConfig) {
      throw new Error(`Invalid current stage: ${currentStage}`);
    }
    
    // Check if new stage is a valid next stage
    if (!stageConfig.next.includes(newStage)) {
      throw new Error(
        `Invalid stage transition from ${currentStage} to ${newStage}. ` +
        `Valid next stages: ${stageConfig.next.join(', ')}`
      );
    }
    
    // Get required role for new stage
    const newStageConfig = STAGE_TRANSITIONS[newStage];
    if (!newStageConfig) {
      throw new Error(`Invalid new stage: ${newStage}`);
    }
    
    // Check if this is a system-only transition
    if (newStageConfig.roles.includes('system') && newStageConfig.roles.length === 1) {
      throw new Error(`Stage ${newStage} can only be set by the system (auto-transition)`);
    }
    
    // Validate user has permission for this stage
    const requiredRoles = newStageConfig.roles;
    
    // Super admins can perform any non-system transition
    if (isSuperAdmin(user)) {
      return true;
    }
    
    // Field naming (CORRECTED):
    // - transfer.sourceLocation = actual SOURCE (warehouse sending stock)
    // - transfer.destinationLocation = actual DESTINATION (branch receiving stock)
    
    // Check sender role permission (source location - warehouse/branch sending stock)
    if (requiredRoles.includes('sender')) {
      if (hasLocationAccess(user, transfer.sourceLocation)) {
        return true;
      }
    }
    
    // Check destination role permission (destination location - branch receiving stock)
    if (requiredRoles.includes('destination')) {
      if (hasLocationAccess(user, transfer.destinationLocation)) {
        return true;
      }
    }
    
    // User doesn't have required permissions
    throw new Error(
      `User does not have permission to transition to stage ${newStage}. ` +
      `Required: ${requiredRoles.join(' or ')} location access`
    );
    
  } catch (error) {
    logger.error('Stage transition validation failed:', error);
    throw error;
  }
};

/**
 * Update inventory when transfer is completed
 * Increases stock at destination and decreases at source (if warehouse)
 * 
 * @param {Object} companyDB - Company database connection
 * @param {Object} transfer - Stock transfer object
 * @param {string} userId - User ID performing the update
 */
const updateInventoryOnCompletion = async (companyDB, transfer, userId) => {
  try {
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryLedger = getInventoryLedgerModel(companyDB);

    // Process each item in the transfer
    for (const item of transfer.items) {
      const inventoryItemId = item.inventoryItem._id || item.inventoryItem;
      const quantity = item.sentQuantity;
      const unit = item.unit;

      // 1. Increase inventory at DESTINATION location
      const destinationLocationId = transfer.destinationLocation._id || transfer.destinationLocation;

      let destinationInventory = await InventoryItemLocation.findOne({
        inventoryItem: inventoryItemId,
        locationId: destinationLocationId
      });

      if (!destinationInventory) {
        // Create new inventory record at destination
        destinationInventory = new InventoryItemLocation({
          inventoryItem: inventoryItemId,
          locationId: destinationLocationId,
          availableQuantity: 0,
          reservedQuantity: 0,
          inTransitQuantity: 0,
          unit: unit,
          minimumStock: 0
        });
      }

      destinationInventory.availableQuantity += quantity;
      destinationInventory.lastRestocked = new Date();
      
      const beforeAvailable = destinationInventory.availableQuantity - quantity;
      const afterAvailable = destinationInventory.availableQuantity;
      
      await destinationInventory.save();

      // Create ledger entry for destination (RECEIVE)
      await InventoryLedger.create({
        inventoryItem: inventoryItemId,
        locationId: destinationLocationId,
        movementType: 'transfer_in',
        quantityDelta: quantity,
        beforeAvailable: beforeAvailable,
        afterAvailable: afterAvailable,
        beforeReserved: 0,
        afterReserved: 0,
        beforeInTransit: 0,
        afterInTransit: 0,
        referenceType: 'TRANSFER',
        referenceId: transfer._id,
        referenceNumber: transfer.transferNumber,
        performedBy: userId,
        notes: `Stock received from ${transfer.sourceLocation.name || 'source location'}`,
        timestamp: new Date()
      });

      // 2. Decrease inventory at SOURCE location (if it's a warehouse)
      const sourceLocationId = transfer.sourceLocation._id || transfer.sourceLocation;
      const sourceLocationType = transfer.sourceLocation.type;

      if (sourceLocationType === 'warehouse' || item.isWarehouseSource) {
        let sourceInventory = await InventoryItemLocation.findOne({
          inventoryItem: inventoryItemId,
          locationId: sourceLocationId
        });

        if (sourceInventory) {
          const beforeSourceAvailable = sourceInventory.availableQuantity;
          sourceInventory.availableQuantity -= quantity;
          if (sourceInventory.availableQuantity < 0) {
            logger.warn(`Negative stock at source location ${sourceLocationId} for item ${inventoryItemId}`);
            sourceInventory.availableQuantity = 0; // Prevent negative stock
          }
          const afterSourceAvailable = sourceInventory.availableQuantity;
          await sourceInventory.save();

          // Create ledger entry for source (SEND)
          await InventoryLedger.create({
            inventoryItem: inventoryItemId,
            locationId: sourceLocationId,
            movementType: 'transfer_out',
            quantityDelta: -quantity, // Negative for outgoing
            beforeAvailable: beforeSourceAvailable,
            afterAvailable: afterSourceAvailable,
            beforeReserved: 0,
            afterReserved: 0,
            beforeInTransit: 0,
            afterInTransit: 0,
            referenceType: 'TRANSFER',
            referenceId: transfer._id,
            referenceNumber: transfer.transferNumber,
            performedBy: userId,
            notes: `Stock sent to ${transfer.destinationLocation.name || 'destination location'}`,
            timestamp: new Date()
          });
        }
      }
    }

    logger.info(`Inventory updated for completed transfer ${transfer.transferNumber}`);
  } catch (error) {
    logger.error('Error updating inventory on completion:', error);
    throw error;
  }
};

/**
 * Update execution stage with audit trail and notifications
 * Validates transition, adds stage to executionStages array, sends notifications
 * 
 * @param {string} transferId - Stock transfer ID
 * @param {string} newStage - New stage to transition to
 * @param {string} userId - User ID performing the update
 * @param {string} companyId - Company ID
 * @param {Object} options - Additional options
 * @param {string} options.notes - Optional notes for the stage transition
 * @param {string} options.ipAddress - IP address of user
 * @param {string} options.deviceInfo - Device information
 * @returns {Promise<Object>} Updated stock transfer
 */
export const updateExecutionStage = async (
  transferId,
  newStage,
  userId,
  companyId,
  options = {}
) => {
  const { notes, ipAddress, deviceInfo } = options;
  
  logger.debug('updateExecutionStage called', { transferId, newStage, userId, companyId });
  
  try {
    // Get user details first (no session needed for platform DB)
    const user = await CompanyUser.findOne({
      _id: userId,
      companyId: companyId,
      isActive: true
    });
    
    if (!user) {
      logger.error('User not found in updateExecutionStage', { userId, companyId });
      throw new Error('User not found or inactive');
    }
    
    // Get company database
    const companyDB = await getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);
    
    // Get stock transfer with optimistic locking
    const transfer = await StockTransfer.findOne({
      _id: transferId,
      companyId: companyId
    })
    .populate('destinationLocation')
    .populate('sourceLocation');
    
    if (!transfer) {
      throw new Error('Stock transfer not found');
    }
    
    // Validate stage transition
    validateStageTransition(transfer, newStage, user);
    
    // Create new stage entry
    const newStageEntry = {
      stage: newStage,
      timestamp: new Date(),
      updatedBy: userId,
      updatedByName: user.name,
      ipAddress: ipAddress,
      deviceInfo: deviceInfo,
      notes: notes || ''
    };
    
    // Check if we need to auto-transition after this stage
    const stagesToUpdate = [newStageEntry];
    
    // Auto-transition: DISPATCHED → IN_TRANSIT
    if (newStage === 'DISPATCHED') {
      stagesToUpdate.push({
        stage: 'IN_TRANSIT',
        timestamp: new Date(),
        updatedBy: userId,
        updatedByName: 'System',
        ipAddress: ipAddress,
        deviceInfo: deviceInfo,
        notes: 'Auto-transitioned to IN_TRANSIT after dispatch confirmation'
      });
    }
    
    // Auto-transition: GOODS_RECEIVED_CONFIRMED → PROCESS_COMPLETED
    if (newStage === 'GOODS_RECEIVED_CONFIRMED') {
      stagesToUpdate.push({
        stage: 'PROCESS_COMPLETED',
        timestamp: new Date(),
        updatedBy: userId,
        updatedByName: 'System',
        ipAddress: ipAddress,
        deviceInfo: deviceInfo,
        notes: 'Auto-transitioned to PROCESS_COMPLETED after goods confirmation'
      });
      
      // Update inventory at destination and source
      await updateInventoryOnCompletion(companyDB, transfer, userId);
      
      // Update stock request status to completed
      if (transfer.originalRequestId) {
        const StockRequest = companyDB.model('StockRequest');
        await StockRequest.updateOne(
          { _id: transfer.originalRequestId },
          {
            $set: {
              status: 'completed',
              completedBy: userId,
              completedDate: new Date()
            }
          }
        );
        logger.info(`Stock request ${transfer.originalRequestId} marked as completed`);
      }
    }
    
    // Update transfer with new stage(s) using optimistic locking
    // Also update status based on stage
    const updateData = {
      $push: { executionStages: { $each: stagesToUpdate } },
      $inc: { version: 1 }
    };
    
    // Update status based on stage
    if (newStage === 'PROCESS_STARTED') {
      // When work starts, change status from 'not_started' to 'in_progress'
      updateData.$set = {
        status: 'in_progress'
      };
    } else if (newStage === 'GOODS_RECEIVED_CONFIRMED') {
      // When goods are received, set status to completed
      updateData.$set = {
        status: 'completed',
        completedBy: userId,
        completedDate: new Date()
      };
    }
    
    const updateResult = await StockTransfer.updateOne(
      {
        _id: transfer._id,
        version: transfer.version
      },
      updateData
    );
    
    if (updateResult.modifiedCount === 0) {
      throw new Error('Transfer was modified by another user. Please refresh and try again.');
    }
    
    // Get updated transfer
    const updatedTransfer = await StockTransfer.findById(transfer._id)
      .populate('destinationLocation')
      .populate('sourceLocation');
    
    logger.info(
      `Stock transfer ${transfer.transferNumber} stage updated to ${newStage} by user ${userId} for company ${companyId}`
    );
    
    // Send notifications to super admins, sender, and destination
    try {
      const superAdmins = await locationNotificationRouter.getSuperAdmins(companyId);
      const senderUsers = await locationNotificationRouter.getUsersByLocation(
        companyId, 
        transfer.sourceLocation._id.toString()
      );
      const destinationUsers = await locationNotificationRouter.getUsersByLocation(
        companyId, 
        transfer.destinationLocation._id.toString()
      );
      
      // Combine and deduplicate by userId
      const allRecipients = [...superAdmins, ...senderUsers, ...destinationUsers];
      const uniqueRecipients = Array.from(
        new Map(allRecipients.map(user => [user._id.toString(), user])).values()
      );
      
      const fromLocationName = transfer.sourceLocation?.name || 'Unknown location';
      const toLocationName = transfer.destinationLocation?.name || 'Unknown location';
      const updaterName = user.name || 'Unknown user';
      
      // Send notifications to all unique recipients
      for (const recipient of uniqueRecipients) {
        await notificationService.sendToCompanyUser(companyId, recipient._id, {
          category: 'inventory',
          event: 'stock_transfer_stage_updated',
          title: 'Stock Transfer Stage Updated',
          message: `Transfer ${transfer.transferNumber} stage updated to ${newStage} by ${updaterName}. From: ${fromLocationName}, To: ${toLocationName}`,
          data: {
            transferId: transfer._id,
            transferNumber: transfer.transferNumber,
            fromLocationName,
            toLocationName,
            newStage,
            updaterName,
            notes: notes || ''
          },
          priority: 'medium',
          actionUrl: `/inventory/stock-transfers/${transfer._id}`
        }).catch(error => {
          logger.error(`Failed to send stage update notification to user ${recipient._id}:`, error);
        });
      }
      
      logger.info(`Stage update notifications sent for transfer ${transfer.transferNumber}: ${uniqueRecipients.length} recipients`);
    } catch (notificationError) {
      // Log but don't fail the stage update
      logger.error('Error sending stage update notifications:', notificationError);
    }
    
    return updatedTransfer;
    
  } catch (error) {
    logger.error('Error updating execution stage:', error);
    throw error;
  }
};

/**
 * Record exception (damage, missing, excess) for a transfer
 * Adds exception to transfer.exceptions array and sends notifications
 * 
 * @param {string} companyId - Company ID
 * @param {string} transferId - Stock transfer ID
 * @param {string} userId - User ID reporting the exception
 * @param {Object} exceptionData - Exception data (type, inventoryItem, quantity, description)
 * @returns {Promise<Object>} Updated stock transfer
 */
export const recordException = async (
  companyId,
  transferId,
  userId,
  exceptionData
) => {
  try {
    // Validate exception data
    if (!exceptionData.type || !['damage', 'missing', 'excess'].includes(exceptionData.type)) {
      throw new Error('Exception type must be one of: damage, missing, excess');
    }
    
    if (!exceptionData.inventoryItem) {
      throw new Error('Exception must include inventoryItem');
    }
    
    if (!exceptionData.quantity || exceptionData.quantity <= 0) {
      throw new Error('Exception quantity must be greater than zero');
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
    
    // Get company database
    const companyDB = await getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);
    
    // Get stock transfer
    const transfer = await StockTransfer.findOne({
      _id: transferId,
      companyId: companyId
    })
    .populate('destinationLocation')
    .populate('sourceLocation');
    
    if (!transfer) {
      throw new Error('Stock transfer not found');
    }
    
    // Validate user has access to either location
    const hasAccess = hasLocationAccess(user, transfer.destinationLocation._id) || 
                      hasLocationAccess(user, transfer.sourceLocation._id);
    
    if (!hasAccess && !isSuperAdmin(user)) {
      throw new Error('User does not have access to this transfer');
    }
    
    // Create exception entry
    const exceptionEntry = {
      type: exceptionData.type,
      inventoryItem: exceptionData.inventoryItem,
      quantity: exceptionData.quantity,
      unit: exceptionData.unit || '',
      description: exceptionData.description || '',
      reportedBy: userId,
      reportedAt: new Date(),
      resolved: false
    };
    
    // Update transfer with new exception using optimistic locking
    const updateResult = await StockTransfer.updateOne(
      {
        _id: transfer._id,
        version: transfer.version
      },
      {
        $push: { exceptions: exceptionEntry },
        $inc: { version: 1 }
      }
    );
    
    if (updateResult.modifiedCount === 0) {
      throw new Error('Transfer was modified by another user. Please refresh and try again.');
    }
    
    // Get updated transfer
    const updatedTransfer = await StockTransfer.findById(transfer._id)
      .populate('destinationLocation')
      .populate('sourceLocation')
      .populate('exceptions.inventoryItem');
    
    logger.info(
      `Exception recorded for transfer ${transfer.transferNumber}: ${exceptionData.type} - ` +
      `${exceptionData.quantity} units by user ${userId} for company ${companyId}`
    );
    
    // Send notifications to all parties
    try {
      const superAdmins = await locationNotificationRouter.getSuperAdmins(companyId);
      const senderUsers = await locationNotificationRouter.getUsersByLocation(
        companyId, 
        transfer.sourceLocation._id.toString()
      );
      const destinationUsers = await locationNotificationRouter.getUsersByLocation(
        companyId, 
        transfer.destinationLocation._id.toString()
      );
      
      // Combine and deduplicate by userId
      const allRecipients = [...superAdmins, ...senderUsers, ...destinationUsers];
      const uniqueRecipients = Array.from(
        new Map(allRecipients.map(user => [user._id.toString(), user])).values()
      );
      
      const fromLocationName = transfer.sourceLocation?.name || 'Unknown location';
      const toLocationName = transfer.destinationLocation?.name || 'Unknown location';
      const reporterName = user.name || 'Unknown user';
      
      // Send notifications to all unique recipients
      for (const recipient of uniqueRecipients) {
        await notificationService.sendToCompanyUser(companyId, recipient._id, {
          category: 'inventory',
          event: 'stock_transfer_exception',
          title: 'Stock Transfer Exception Reported',
          message: `Exception reported for transfer ${transfer.transferNumber}: ${exceptionData.type} - ${exceptionData.quantity} units. Reported by ${reporterName}. From: ${fromLocationName}, To: ${toLocationName}`,
          data: {
            transferId: transfer._id,
            transferNumber: transfer.transferNumber,
            fromLocationName,
            toLocationName,
            exceptionType: exceptionData.type,
            quantity: exceptionData.quantity,
            reporterName,
            description: exceptionData.description || ''
          },
          priority: 'high',
          actionUrl: `/inventory/stock-transfers/${transfer._id}`
        }).catch(error => {
          logger.error(`Failed to send exception notification to user ${recipient._id}:`, error);
        });
      }
      
      logger.info(`Exception notifications sent for transfer ${transfer.transferNumber}: ${uniqueRecipients.length} recipients`);
    } catch (notificationError) {
      // Log but don't fail the exception recording
      logger.error('Error sending exception notifications:', notificationError);
    }
    
    return updatedTransfer;
    
  } catch (error) {
    logger.error('Error recording exception:', error);
    throw error;
  }
};

/**
 * Accept stock at destination with quantity verification and exception recording
 * Validates user is destination admin, records exceptions, updates stages
 * 
 * @param {string} companyId - Company ID
 * @param {string} transferId - Stock transfer ID
 * @param {string} userId - User ID accepting the stock
 * @param {Object} acceptanceData - Acceptance data with item verifications
 * @param {string} ipAddress - IP address of user
 * @param {string} deviceInfo - Device information
 * @returns {Promise<Object>} Updated stock transfer with exceptions
 */
export const acceptStock = async (
  companyId,
  transferId,
  userId,
  acceptanceData,
  ipAddress,
  deviceInfo
) => {
  try {
    // Validate acceptance data
    if (!acceptanceData.items || !Array.isArray(acceptanceData.items) || acceptanceData.items.length === 0) {
      throw new Error('Acceptance data must include items array');
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
    
    // Get company database
    const companyDB = await getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);
    
    // Get stock transfer
    const transfer = await StockTransfer.findOne({
      _id: transferId,
      companyId: companyId
    })
    .populate('destinationLocation')
    .populate('sourceLocation');
    
    if (!transfer) {
      throw new Error('Stock transfer not found');
    }
    
    // Validate user is destination admin (where stock is going TO)
    if (!hasLocationAccess(user, transfer.destinationLocation._id) && !isSuperAdmin(user)) {
      throw new Error('User must be destination admin to accept stock');
    }
    
    // Validate current stage is ARRIVED_AT_DESTINATION
    const currentStage = transfer.executionStages && transfer.executionStages.length > 0
      ? transfer.executionStages[transfer.executionStages.length - 1].stage
      : null;
    
    if (currentStage !== 'ARRIVED_AT_DESTINATION') {
      throw new Error(
        `Cannot accept stock at current stage ${currentStage}. ` +
        `Stock must be at ARRIVED_AT_DESTINATION stage.`
      );
    }
    
    // Process each item and record exceptions
    const exceptions = [];
    
    for (const acceptanceItem of acceptanceData.items) {
      if (!acceptanceItem.inventoryItem) {
        throw new Error('Each acceptance item must have inventoryItem');
      }
      
      // Find corresponding transfer item
      const transferItem = transfer.items.find(
        item => item.inventoryItem.toString() === acceptanceItem.inventoryItem.toString()
      );
      
      if (!transferItem) {
        throw new Error(`Item ${acceptanceItem.inventoryItem} not found in transfer`);
      }
      
      const expectedQuantity = transferItem.sentQuantity || transferItem.requestedQuantity;
      const receivedQuantity = acceptanceItem.receivedQuantity || 0;
      
      // Record damage if any
      if (acceptanceItem.damageQuantity && acceptanceItem.damageQuantity > 0) {
        exceptions.push({
          type: 'damage',
          inventoryItem: acceptanceItem.inventoryItem,
          quantity: acceptanceItem.damageQuantity,
          unit: transferItem.unit,
          description: acceptanceItem.damageNotes || 'Damaged items reported during acceptance',
          reportedBy: userId,
          reportedAt: new Date(),
          resolved: false
        });
      }
      
      // Record missing items if any
      if (acceptanceItem.missingQuantity && acceptanceItem.missingQuantity > 0) {
        exceptions.push({
          type: 'missing',
          inventoryItem: acceptanceItem.inventoryItem,
          quantity: acceptanceItem.missingQuantity,
          unit: transferItem.unit,
          description: acceptanceItem.missingNotes || 'Missing items reported during acceptance',
          reportedBy: userId,
          reportedAt: new Date(),
          resolved: false
        });
      }
      
      // Record excess items if any
      if (acceptanceItem.excessQuantity && acceptanceItem.excessQuantity > 0) {
        exceptions.push({
          type: 'excess',
          inventoryItem: acceptanceItem.inventoryItem,
          quantity: acceptanceItem.excessQuantity,
          unit: transferItem.unit,
          description: acceptanceItem.excessNotes || 'Excess items reported during acceptance',
          reportedBy: userId,
          reportedAt: new Date(),
          resolved: false
        });
      }
      
      // Update transfer item with received quantity
      transferItem.receivedQuantity = receivedQuantity;
      
      // Calculate discrepancy
      const discrepancy = receivedQuantity - expectedQuantity;
      if (Math.abs(discrepancy) > 0.000001) {
        transferItem.discrepancyQuantity = discrepancy;
      }
    }
    
    // Add GOODS_RECEIVED_CONFIRMED stage
    const goodsReceivedStage = {
      stage: 'GOODS_RECEIVED_CONFIRMED',
      timestamp: new Date(),
      updatedBy: userId,
      updatedByName: user.name,
      ipAddress: ipAddress,
      deviceInfo: deviceInfo,
      notes: `Stock accepted by destination admin. ${exceptions.length} exception(s) recorded.`
    };
    
    // Add PROCESS_COMPLETED stage (auto-transition)
    const processCompletedStage = {
      stage: 'PROCESS_COMPLETED',
      timestamp: new Date(),
      updatedBy: userId,
      updatedByName: 'System',
      ipAddress: ipAddress,
      deviceInfo: deviceInfo,
      notes: 'Transfer process completed automatically after goods confirmation'
    };
    
    // Update transfer with exceptions and stages using optimistic locking
    const updateResult = await StockTransfer.updateOne(
      {
        _id: transfer._id,
        version: transfer.version
      },
      {
        $push: { 
          exceptions: { $each: exceptions },
          executionStages: { $each: [goodsReceivedStage, processCompletedStage] }
        },
        $set: { 
          items: transfer.items,
          status: 'completed',
          completedBy: userId,
          completedDate: new Date(),
          completedIpAddress: ipAddress,
          completedDeviceInfo: deviceInfo
        },
        $inc: { version: 1 }
      }
    );
    
    if (updateResult.modifiedCount === 0) {
      throw new Error('Transfer was modified by another user. Please refresh and try again.');
    }
    
    // Get updated transfer
    const updatedTransfer = await StockTransfer.findById(transfer._id)
      .populate('destinationLocation')
      .populate('sourceLocation')
      .populate('exceptions.inventoryItem');
    
    logger.info(
      `Stock accepted for transfer ${transfer.transferNumber} by user ${userId} for company ${companyId}. ` +
      `${exceptions.length} exception(s) recorded.`
    );
    
    // Update inventory at destination location (if source is branch, not warehouse)
    // Deduct from source location inventory
    const Location = companyDB.model('Location');
    const sourceLocationDoc = await Location.findById(transfer.destinationLocation._id);
    const isWarehouseSource = sourceLocationDoc?.type === 'warehouse';
    
    if (!isWarehouseSource) {
      // Source is a branch - deduct inventory from source location
      const { recordLedgerEntry } = await import('./inventoryLedgerService.js');
      const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
      const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);
      
      for (const item of transfer.items) {
        const receivedQuantity = item.receivedQuantity || item.sentQuantity;
        
        // Deduct from source location inventory using batch costs
        if (item.batchCosts && item.batchCosts.length > 0) {
          for (const batchCost of item.batchCosts) {
            // Update batch location - deduct from reserved, add to consumed
            const batch = await InventoryBatchLocation.findById(batchCost.sourceBatchId);
            if (batch) {
              batch.reservedQuantity -= batchCost.quantity;
              batch.version += 1;
              await batch.save();
              
              logger.info(`Deducted ${batchCost.quantity} from batch ${batch.batchNumber} at source location`);
            }
          }
        }
        
        // Update inventory item location summary
        const itemLocation = await InventoryItemLocation.findOne({
          inventoryItem: item.inventoryItem,
          locationId: transfer.destinationLocation._id
        });
        
        if (itemLocation) {
          const beforeAvailable = itemLocation.availableQuantity;
          const beforeReserved = itemLocation.reservedQuantity;
          const beforeInTransit = itemLocation.inTransitQuantity;
          
          itemLocation.reservedQuantity -= receivedQuantity;
          itemLocation.version += 1;
          await itemLocation.save();
          
          // Record ledger entry for transfer out
          await recordLedgerEntry({
            inventoryItem: item.inventoryItem,
            locationId: transfer.destinationLocation._id,
            movementType: 'transfer_out',
            quantityDelta: -receivedQuantity,
            beforeAvailable: beforeAvailable,
            afterAvailable: itemLocation.availableQuantity,
            beforeReserved: beforeReserved,
            afterReserved: itemLocation.reservedQuantity,
            beforeInTransit: beforeInTransit,
            afterInTransit: itemLocation.inTransitQuantity,
            referenceType: 'StockTransfer',
            referenceId: transfer._id,
            performedBy: userId,
            notes: `Stock transferred out to ${transfer.sourceLocation.name}`,
            companyId: companyId
          }, companyId);
          
          logger.info(`Inventory deducted at source location for item ${item.inventoryItem}`);
        }
      }
      
      // Add to destination location inventory
      for (const item of transfer.items) {
        const receivedQuantity = item.receivedQuantity || item.sentQuantity;
        
        // Create or update batch at destination
        const { createOrUpdateBatch } = await import('./inventoryBatchLocationService.js');
        
        // Use average cost from batch costs or zero for warehouse sources
        const avgUnitCost = item.batchCosts && item.batchCosts.length > 0
          ? item.totalCost / receivedQuantity
          : 0;
        
        await createOrUpdateBatch({
          inventoryItem: item.inventoryItem,
          locationId: transfer.sourceLocation._id,
          batchNumber: `TRF-${transfer.transferNumber}-${item.inventoryItem}`,
          availableQuantity: receivedQuantity,
          unitCost: avgUnitCost,
          grnReference: null
        }, companyId);
        
        // Update inventory item location summary
        const itemLocation = await InventoryItemLocation.findOne({
          inventoryItem: item.inventoryItem,
          locationId: transfer.sourceLocation._id
        });
        
        if (itemLocation) {
          const beforeAvailable = itemLocation.availableQuantity;
          const beforeReserved = itemLocation.reservedQuantity;
          const beforeInTransit = itemLocation.inTransitQuantity;
          
          itemLocation.availableQuantity += receivedQuantity;
          itemLocation.version += 1;
          await itemLocation.save();
          
          // Record ledger entry for transfer in
          await recordLedgerEntry({
            inventoryItem: item.inventoryItem,
            locationId: transfer.sourceLocation._id,
            movementType: 'transfer_in',
            quantityDelta: receivedQuantity,
            beforeAvailable: beforeAvailable,
            afterAvailable: itemLocation.availableQuantity,
            beforeReserved: beforeReserved,
            afterReserved: itemLocation.reservedQuantity,
            beforeInTransit: beforeInTransit,
            afterInTransit: itemLocation.inTransitQuantity,
            referenceType: 'StockTransfer',
            referenceId: transfer._id,
            performedBy: userId,
            notes: `Stock transferred in from ${transfer.destinationLocation.name}`,
            companyId: companyId
          }, companyId);
          
          logger.info(`Inventory added at destination location for item ${item.inventoryItem}`);
        } else {
          // Create new inventory item location if doesn't exist
          const newItemLocation = new InventoryItemLocation({
            inventoryItem: item.inventoryItem,
            locationId: transfer.sourceLocation._id,
            availableQuantity: receivedQuantity,
            reservedQuantity: 0,
            inTransitQuantity: 0,
            version: 0
          });
          await newItemLocation.save();
          
          // Record ledger entry
          await recordLedgerEntry({
            inventoryItem: item.inventoryItem,
            locationId: transfer.sourceLocation._id,
            movementType: 'transfer_in',
            quantityDelta: receivedQuantity,
            beforeAvailable: 0,
            afterAvailable: receivedQuantity,
            beforeReserved: 0,
            afterReserved: 0,
            beforeInTransit: 0,
            afterInTransit: 0,
            referenceType: 'StockTransfer',
            referenceId: transfer._id,
            performedBy: userId,
            notes: `Stock transferred in from ${transfer.destinationLocation.name} (first time)`,
            companyId: companyId
          }, companyId);
          
          logger.info(`New inventory item location created at destination for item ${item.inventoryItem}`);
        }
      }
    } else {
      logger.info(`Skipping inventory deduction for warehouse source ${sourceLocationDoc.name}`);
    }
    
    // Update stock request status to completed if this transfer was created from a request
    if (transfer.originalRequestId) {
      const StockRequest = getStockRequestModel(companyDB);
      await StockRequest.updateOne(
        { _id: transfer.originalRequestId },
        { 
          $set: { 
            status: 'completed',
            completedBy: userId,
            completedDate: new Date()
          }
        }
      );
      logger.info(`Stock request ${transfer.originalRequestId} marked as completed`);
    }
    
    // Send notifications to all parties
    try {
      const superAdmins = await locationNotificationRouter.getSuperAdmins(companyId);
      const senderUsers = await locationNotificationRouter.getUsersByLocation(
        companyId, 
        transfer.sourceLocation._id.toString()
      );
      const destinationUsers = await locationNotificationRouter.getUsersByLocation(
        companyId, 
        transfer.destinationLocation._id.toString()
      );
      
      // Combine and deduplicate by userId
      const allRecipients = [...superAdmins, ...senderUsers, ...destinationUsers];
      const uniqueRecipients = Array.from(
        new Map(allRecipients.map(user => [user._id.toString(), user])).values()
      );
      
      const fromLocationName = transfer.sourceLocation?.name || 'Unknown location';
      const toLocationName = transfer.destinationLocation?.name || 'Unknown location';
      const acceptorName = user.name || 'Unknown user';
      
      // Send notifications to all unique recipients
      for (const recipient of uniqueRecipients) {
        const hasExceptions = exceptions.length > 0;
        
        await notificationService.sendToCompanyUser(companyId, recipient._id, {
          category: 'inventory',
          event: 'stock_transfer_completed',
          title: 'Stock Transfer Completed',
          message: `Transfer ${transfer.transferNumber} completed. Stock accepted by ${acceptorName}. From: ${fromLocationName}, To: ${toLocationName}${hasExceptions ? `. ${exceptions.length} exception(s) reported.` : ''}`,
          data: {
            transferId: transfer._id,
            transferNumber: transfer.transferNumber,
            fromLocationName,
            toLocationName,
            acceptorName,
            exceptionCount: exceptions.length,
            hasExceptions
          },
          priority: hasExceptions ? 'high' : 'medium',
          actionUrl: `/inventory/stock-transfers/${transfer._id}`
        }).catch(error => {
          logger.error(`Failed to send completion notification to user ${recipient._id}:`, error);
        });
      }
      
      logger.info(`Completion notifications sent for transfer ${transfer.transferNumber}: ${uniqueRecipients.length} recipients`);
    } catch (notificationError) {
      // Log but don't fail the acceptance
      logger.error('Error sending completion notifications:', notificationError);
    }
    
    return updatedTransfer;
    
  } catch (error) {
    logger.error('Error accepting stock:', error);
    throw error;
  }
};


/**
 * Get completed stock transfers
 * Shows transfers that have been fully processed (status: completed)
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @param {Object} pagination - Pagination options
 * @param {Object} accessControl - Access control options (isUnrestricted, locationIds)
 * @returns {Promise<Object>} Completed transfers with pagination
 */
export const getCompletedTransfers = async (companyId, filters = {}, pagination = {}, accessControl = {}) => {
  try {
    const companyDB = await getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);
    
    const {
      destinationLocation,
      sourceLocation,
      startDate,
      endDate,
      search,
      hasExceptions
    } = filters;
    
    const {
      page = 1,
      limit = 10
    } = pagination;
    
    const {
      isUnrestricted = false,
      locationIds = []
    } = accessControl;
    
    const skip = (page - 1) * limit;
    
    // Build query for completed transfers
    const query = {
      status: 'completed',
      isArchived: false
    };
    
    // Apply location-based filtering
    if (!isUnrestricted && locationIds.length > 0) {
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
      query.transferNumber = { $regex: search, $options: 'i' };
    }
    
    if (hasExceptions === 'true' || hasExceptions === true) {
      query['exceptions.0'] = { $exists: true };
    }
    
    // Get total count
    const total = await StockTransfer.countDocuments(query);
    const pages = Math.ceil(total / limit);
    
    // Execute query with pagination
    const transfers = await StockTransfer.find(query)
      .sort({ completedDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate('destinationLocation', 'name type')
      .populate('sourceLocation', 'name type')
      .populate('items.inventoryItem', 'name code')
      .populate('exceptions.inventoryItem', 'name code')
      .populate('originalRequestId', 'requestNumber')
      .lean();
    
    // Manually populate user fields
    const userIds = new Set();
    transfers.forEach(transfer => {
      if (transfer.requestedBy) userIds.add(transfer.requestedBy.toString());
      if (transfer.approvedBy) userIds.add(transfer.approvedBy.toString());
      if (transfer.completedBy) userIds.add(transfer.completedBy.toString());
      
      // Collect user IDs from execution stages
      if (transfer.executionStages) {
        transfer.executionStages.forEach(stage => {
          if (stage.updatedBy) userIds.add(stage.updatedBy.toString());
        });
      }
      
      // Collect user IDs from exceptions
      if (transfer.exceptions) {
        transfer.exceptions.forEach(exception => {
          if (exception.reportedBy) userIds.add(exception.reportedBy.toString());
        });
      }
    });
    
    if (userIds.size > 0) {
      const users = await CompanyUser.find({
        _id: { $in: Array.from(userIds) },
        companyId: companyId
      }).select('_id name email role').lean();
      
      const userMap = new Map(users.map(u => [u._id.toString(), u]));
      
      transfers.forEach(transfer => {
        if (transfer.requestedBy && userMap.has(transfer.requestedBy.toString())) {
          transfer.requestedBy = userMap.get(transfer.requestedBy.toString());
        }
        if (transfer.approvedBy && userMap.has(transfer.approvedBy.toString())) {
          transfer.approvedBy = userMap.get(transfer.approvedBy.toString());
        }
        if (transfer.completedBy && userMap.has(transfer.completedBy.toString())) {
          transfer.completedBy = userMap.get(transfer.completedBy.toString());
        }
        
        // Populate execution stage users
        if (transfer.executionStages) {
          transfer.executionStages.forEach(stage => {
            if (stage.updatedBy && userMap.has(stage.updatedBy.toString())) {
              stage.updatedBy = userMap.get(stage.updatedBy.toString());
            }
          });
        }
        
        // Populate exception users
        if (transfer.exceptions) {
          transfer.exceptions.forEach(exception => {
            if (exception.reportedBy && userMap.has(exception.reportedBy.toString())) {
              exception.reportedBy = userMap.get(exception.reportedBy.toString());
            }
          });
        }
      });
    }
    
    logger.info(`Completed transfers fetched: ${transfers.length} for company ${companyId}`);
    
    return {
      transfers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages
      }
    };
  } catch (error) {
    logger.error('Error getting completed transfers:', error);
    throw error;
  }
};
