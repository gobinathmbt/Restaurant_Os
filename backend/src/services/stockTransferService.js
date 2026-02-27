/**
 * Stock Transfer Service
 * Business logic for stock transfer execution stage management
 * Handles stage transitions, exception recording, and stock acceptance
 */

import { getCompanyDB } from '../config/database.js';
import { getStockTransferModel } from '../models/company/StockTransfer.js';
import { logger } from '../utils/logger.js';
import CompanyUser from '../models/platform/CompanyUser.js';
import notificationService from './notificationService.js';
import locationNotificationRouter from './locationNotificationRouter.js';

/**
 * Stage transition state machine
 * Defines valid transitions and role permissions for each stage
 */
const STAGE_TRANSITIONS = {
  PROCESS_STARTED: {
    next: ['PREPARING_STOCK'],
    roles: ['system'] // Auto-transition only
  },
  PREPARING_STOCK: {
    next: ['LOADING_INTO_VEHICLE'],
    roles: ['sender'] // Sender location admins
  },
  LOADING_INTO_VEHICLE: {
    next: ['DISPATCHED'],
    roles: ['sender']
  },
  DISPATCHED: {
    next: ['IN_TRANSIT'],
    roles: ['sender']
  },
  IN_TRANSIT: {
    next: ['ARRIVED_AT_DESTINATION'],
    roles: ['sender', 'system']
  },
  ARRIVED_AT_DESTINATION: {
    next: ['UNLOADING'],
    roles: ['destination'] // Destination location admins
  },
  UNLOADING: {
    next: ['GOODS_RECEIVED_CONFIRMED'],
    roles: ['destination']
  },
  GOODS_RECEIVED_CONFIRMED: {
    next: ['PROCESS_COMPLETED'],
    roles: ['system'] // Auto-transition only
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
 * @param {string} locationId - Location ID to check
 * @returns {boolean} True if user has access
 */
const hasLocationAccess = (user, locationId) => {
  // Super Admins have access to all locations
  if (isSuperAdmin(user)) {
    return true;
  }
  
  const locationIdStr = locationId.toString();
  
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
      if (newStage !== 'PREPARING_STOCK') {
        throw new Error('Transfer must start with PREPARING_STOCK stage. Please start the process first.');
      }
      
      // Validate user has access to source location (destination in transfer model)
      if (!hasLocationAccess(user, transfer.destinationLocation) && !isSuperAdmin(user)) {
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
    
    // Check sender role permission
    if (requiredRoles.includes('sender')) {
      if (hasLocationAccess(user, transfer.destinationLocation)) {
        return true;
      }
    }
    
    // Check destination role permission
    if (requiredRoles.includes('destination')) {
      if (hasLocationAccess(user, transfer.sourceLocation)) {
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
    
    // Update transfer with new stage using optimistic locking
    const updateResult = await StockTransfer.updateOne(
      {
        _id: transfer._id,
        version: transfer.version
      },
      {
        $push: { executionStages: newStageEntry },
        $inc: { version: 1 }
      }
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
        transfer.destinationLocation._id.toString()
      );
      const destinationUsers = await locationNotificationRouter.getUsersByLocation(
        companyId, 
        transfer.sourceLocation._id.toString()
      );
      
      // Combine and deduplicate by userId
      const allRecipients = [...superAdmins, ...senderUsers, ...destinationUsers];
      const uniqueRecipients = Array.from(
        new Map(allRecipients.map(user => [user._id.toString(), user])).values()
      );
      
      const fromLocationName = transfer.destinationLocation?.name || 'Unknown location';
      const toLocationName = transfer.sourceLocation?.name || 'Unknown location';
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
        transfer.destinationLocation._id.toString()
      );
      const destinationUsers = await locationNotificationRouter.getUsersByLocation(
        companyId, 
        transfer.sourceLocation._id.toString()
      );
      
      // Combine and deduplicate by userId
      const allRecipients = [...superAdmins, ...senderUsers, ...destinationUsers];
      const uniqueRecipients = Array.from(
        new Map(allRecipients.map(user => [user._id.toString(), user])).values()
      );
      
      const fromLocationName = transfer.destinationLocation?.name || 'Unknown location';
      const toLocationName = transfer.sourceLocation?.name || 'Unknown location';
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
    
    // Validate user is destination admin
    if (!hasLocationAccess(user, transfer.sourceLocation._id) && !isSuperAdmin(user)) {
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
    
    // Send notifications to all parties
    try {
      const superAdmins = await locationNotificationRouter.getSuperAdmins(companyId);
      const senderUsers = await locationNotificationRouter.getUsersByLocation(
        companyId, 
        transfer.destinationLocation._id.toString()
      );
      const destinationUsers = await locationNotificationRouter.getUsersByLocation(
        companyId, 
        transfer.sourceLocation._id.toString()
      );
      
      // Combine and deduplicate by userId
      const allRecipients = [...superAdmins, ...senderUsers, ...destinationUsers];
      const uniqueRecipients = Array.from(
        new Map(allRecipients.map(user => [user._id.toString(), user])).values()
      );
      
      const fromLocationName = transfer.destinationLocation?.name || 'Unknown location';
      const toLocationName = transfer.sourceLocation?.name || 'Unknown location';
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
