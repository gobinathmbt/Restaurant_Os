/**
 * Location Inventory Service
 * Business logic for location-based inventory operations with ledger integration
 * Handles inventory quantity updates, reservations, and ensures atomic operations
 */

import mongoose from 'mongoose';
import { getCompanyDB } from '../config/database.js';
import { getInventoryItemLocationModel } from '../models/company/InventoryItemLocation.js';
import { getInventoryReservationModel } from '../models/company/InventoryReservation.js';
import { recordLedgerEntry } from './inventoryLedgerService.js';
import { logger } from '../utils/logger.js';

/**
 * Update available quantity for an inventory item at a location
 * Records ledger entry atomically with inventory update
 * 
 * @param {Object} params - Update parameters
 * @param {string} params.locationId - Location ID
 * @param {string} params.itemId - Inventory item ID
 * @param {number} params.delta - Quantity change (positive or negative)
 * @param {string} params.movementType - Type of movement (grn, transfer_out, etc.)
 * @param {string} params.referenceType - Reference document type (GRN, TRANSFER, etc.)
 * @param {string} params.referenceId - Reference document ID
 * @param {string} params.userId - User performing the operation
 * @param {string} params.companyId - Company ID
 * @param {string} [params.batchNumber] - Optional batch number
 * @param {string} [params.referenceNumber] - Optional human-readable reference
 * @param {number} [params.unitCost] - Optional unit cost
 * @param {string} [params.reason] - Optional reason for the change
 * @param {string} [params.notes] - Optional notes
 * @param {string} [params.correlationId] - Optional correlation ID for related operations
 * @returns {Promise<Object>} Updated inventory item location
 */
export const updateAvailableQuantity = async (params) => {
  const {
    locationId,
    itemId,
    delta,
    movementType,
    referenceType,
    referenceId,
    userId,
    companyId,
    batchNumber,
    referenceNumber,
    unitCost,
    reason,
    notes,
    correlationId
  } = params;

  // Validate required parameters
  if (!locationId || !itemId || delta === undefined || !movementType || !referenceType || !referenceId || !userId || !companyId) {
    throw new Error('Missing required parameters for updateAvailableQuantity');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    // Get current inventory state
    const inventory = await InventoryItemLocation.findOne({
      locationId,
      inventoryItem: itemId,
      isActive: true
    }).session(session);

    if (!inventory) {
      throw new Error(`Inventory item ${itemId} not found at location ${locationId}`);
    }

    // Calculate new quantity
    const newAvailableQuantity = inventory.availableQuantity + delta;

    // Validate non-negativity (Requirement 2.6)
    if (newAvailableQuantity < 0) {
      throw new Error(
        `Insufficient available quantity. Current: ${inventory.availableQuantity}, ` +
        `Requested change: ${delta}, Would result in: ${newAvailableQuantity}`
      );
    }

    // Store before state for ledger
    const beforeAvailable = inventory.availableQuantity;
    const beforeReserved = inventory.reservedQuantity;
    const beforeInTransit = inventory.inTransitQuantity;

    // Update inventory quantity
    inventory.availableQuantity = newAvailableQuantity;
    inventory.version += 1; // Increment version for optimistic locking

    await inventory.save({ session });

    // Calculate total value if unit cost provided
    const totalValue = unitCost ? Math.abs(delta) * unitCost : undefined;

    // Record ledger entry atomically (Requirement 16.1, 16.2, 25.6)
    await recordLedgerEntry({
      inventoryItem: itemId,
      locationId,
      batchNumber,
      movementType,
      quantityDelta: delta,
      beforeAvailable,
      afterAvailable: newAvailableQuantity,
      beforeReserved,
      afterReserved: beforeReserved,
      beforeInTransit,
      afterInTransit: beforeInTransit,
      referenceType,
      referenceId,
      referenceNumber,
      unitCost,
      totalValue,
      performedBy: userId,
      reason,
      notes,
      correlationId
    }, companyId);

    // Commit transaction
    await session.commitTransaction();

    logger.info(
      `Updated available quantity for item ${itemId} at location ${locationId}: ` +
      `${beforeAvailable} -> ${newAvailableQuantity} (delta: ${delta})`
    );

    return inventory;
  } catch (error) {
    // Rollback transaction on error (Requirement 25.7)
    await session.abortTransaction();
    logger.error('Error updating available quantity:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Calculate default reservation expiry based on location or global settings
 * @param {Object} location - Location document
 * @param {string} companyId - Company ID
 * @returns {Promise<Date>} Default expiry timestamp
 */
const calculateDefaultReservationExpiry = async (location, companyId) => {
  try {
    // Try to get location-specific timeout from settings
    const locationTimeoutMinutes = location?.settings?.reservationTimeoutMinutes;
    
    if (locationTimeoutMinutes && locationTimeoutMinutes > 0) {
      const expiryDate = new Date();
      expiryDate.setMinutes(expiryDate.getMinutes() + locationTimeoutMinutes);
      return expiryDate;
    }

    // Fall back to global setting (default: 24 hours)
    const { getConfig } = await import('../config/env.js');
    const globalTimeoutMinutes = await getConfig('RESERVATION_TIMEOUT_MINUTES', 'RESERVATION_TIMEOUT_MINUTES', 1440); // 24 hours default
    
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + parseInt(globalTimeoutMinutes));
    return expiryDate;
  } catch (error) {
    // If config loading fails, use 24 hours as fallback
    logger.warn('Failed to load reservation timeout config, using 24 hours default:', error);
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + 1440);
    return expiryDate;
  }
};

/**
 * Reserve inventory for an order or production
 * Decreases available quantity and increases reserved quantity
 * Records ledger entry atomically
 * 
 * @param {Object} params - Reservation parameters
 * @param {string} params.locationId - Location ID
 * @param {string} params.itemId - Inventory item ID
 * @param {number} params.quantity - Quantity to reserve
 * @param {string} params.referenceType - Reference type (ORDER, PRODUCTION, etc.)
 * @param {string} params.referenceId - Reference document ID
 * @param {string} params.userId - User performing the operation
 * @param {string} params.companyId - Company ID
 * @param {Date} [params.expiresAt] - Optional expiration timestamp
 * @param {string} [params.notes] - Optional notes
 * @param {string} [params.correlationId] - Optional correlation ID
 * @returns {Promise<Object>} Created reservation record
 */
export const reserveInventory = async (params) => {
  const {
    locationId,
    itemId,
    quantity,
    referenceType,
    referenceId,
    userId,
    companyId,
    expiresAt,
    notes,
    correlationId
  } = params;

  // Validate required parameters
  if (!locationId || !itemId || !quantity || !referenceType || !referenceId || !userId || !companyId) {
    throw new Error('Missing required parameters for reserveInventory');
  }

  // Validate quantity is positive
  if (quantity <= 0) {
    throw new Error('Reservation quantity must be positive');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryReservation = getInventoryReservationModel(companyDB);
    const { getLocationModel } = await import('../models/company/Location.js');
    const Location = getLocationModel(companyDB);

    // Get location for default expiry calculation (Requirement 26.5)
    const location = await Location.findById(locationId).session(session);
    if (!location) {
      throw new Error(`Location ${locationId} not found`);
    }

    // Calculate expiry timestamp if not provided (Requirement 26.1, 26.5)
    let reservationExpiresAt = expiresAt;
    if (!reservationExpiresAt) {
      reservationExpiresAt = await calculateDefaultReservationExpiry(location, companyId);
    }

    // Get current inventory state
    const inventory = await InventoryItemLocation.findOne({
      locationId,
      inventoryItem: itemId,
      isActive: true
    }).session(session);

    if (!inventory) {
      throw new Error(`Inventory item ${itemId} not found at location ${locationId}`);
    }

    // Validate sufficient available quantity (Requirement 13.7)
    if (inventory.availableQuantity < quantity) {
      throw new Error(
        `Insufficient available quantity to reserve. Available: ${inventory.availableQuantity}, ` +
        `Requested: ${quantity}`
      );
    }

    // Store before state for ledger
    const beforeAvailable = inventory.availableQuantity;
    const beforeReserved = inventory.reservedQuantity;
    const beforeInTransit = inventory.inTransitQuantity;

    // Update inventory quantities (Requirement 13.2, 13.3)
    inventory.availableQuantity -= quantity;
    inventory.reservedQuantity += quantity;
    inventory.version += 1;

    await inventory.save({ session });

    // Create reservation record
    const reservation = new InventoryReservation({
      inventoryItem: itemId,
      locationId,
      quantity,
      reservationExpiresAt,
      status: 'active',
      referenceType,
      referenceId,
      reservedBy: userId,
      reservedDate: new Date(),
      notes
    });

    await reservation.save({ session });

    // Record ledger entry atomically (Requirement 16.1, 16.2)
    await recordLedgerEntry({
      inventoryItem: itemId,
      locationId,
      movementType: 'reservation',
      quantityDelta: -quantity,
      beforeAvailable,
      afterAvailable: inventory.availableQuantity,
      beforeReserved,
      afterReserved: inventory.reservedQuantity,
      beforeInTransit,
      afterInTransit: beforeInTransit,
      referenceType: 'RESERVATION',
      referenceId: reservation._id,
      performedBy: userId,
      notes,
      correlationId
    }, companyId);

    // Commit transaction
    await session.commitTransaction();

    logger.info(
      `Reserved ${quantity} units of item ${itemId} at location ${locationId} ` +
      `(reservation: ${reservation._id})`
    );

    return reservation;
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    logger.error('Error reserving inventory:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Release a reservation (cancel without consuming)
 * Increases available quantity and decreases reserved quantity
 * Records ledger entry atomically
 * 
 * @param {Object} params - Release parameters
 * @param {string} params.locationId - Location ID
 * @param {string} params.itemId - Inventory item ID
 * @param {number} params.quantity - Quantity to release
 * @param {string} params.reservationId - Reservation ID to release
 * @param {string} params.userId - User performing the operation
 * @param {string} params.companyId - Company ID
 * @param {string} [params.reason] - Optional reason for release
 * @param {string} [params.notes] - Optional notes
 * @param {string} [params.correlationId] - Optional correlation ID
 * @returns {Promise<Object>} Updated inventory item location
 */
export const releaseReservation = async (params) => {
  const {
    locationId,
    itemId,
    quantity,
    reservationId,
    userId,
    companyId,
    reason,
    notes,
    correlationId
  } = params;

  // Validate required parameters
  if (!locationId || !itemId || !quantity || !reservationId || !userId || !companyId) {
    throw new Error('Missing required parameters for releaseReservation');
  }

  // Validate quantity is positive
  if (quantity <= 0) {
    throw new Error('Release quantity must be positive');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryReservation = getInventoryReservationModel(companyDB);

    // Get reservation
    const reservation = await InventoryReservation.findById(reservationId).session(session);

    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    // Validate reservation is active
    if (reservation.status !== 'active') {
      throw new Error(`Reservation ${reservationId} is not active (status: ${reservation.status})`);
    }

    // Validate quantity matches reservation
    if (reservation.quantity !== quantity) {
      throw new Error(
        `Release quantity ${quantity} does not match reservation quantity ${reservation.quantity}`
      );
    }

    // Get current inventory state
    const inventory = await InventoryItemLocation.findOne({
      locationId,
      inventoryItem: itemId,
      isActive: true
    }).session(session);

    if (!inventory) {
      throw new Error(`Inventory item ${itemId} not found at location ${locationId}`);
    }

    // Validate sufficient reserved quantity
    if (inventory.reservedQuantity < quantity) {
      throw new Error(
        `Insufficient reserved quantity to release. Reserved: ${inventory.reservedQuantity}, ` +
        `Requested: ${quantity}`
      );
    }

    // Store before state for ledger
    const beforeAvailable = inventory.availableQuantity;
    const beforeReserved = inventory.reservedQuantity;
    const beforeInTransit = inventory.inTransitQuantity;

    // Update inventory quantities (Requirement 13.4, 13.5)
    inventory.availableQuantity += quantity;
    inventory.reservedQuantity -= quantity;
    inventory.version += 1;

    await inventory.save({ session });

    // Update reservation status
    reservation.status = 'released';
    reservation.releasedBy = userId;
    reservation.releasedDate = new Date();

    await reservation.save({ session });

    // Record ledger entry atomically (Requirement 16.1, 16.2)
    await recordLedgerEntry({
      inventoryItem: itemId,
      locationId,
      movementType: 'release',
      quantityDelta: quantity,
      beforeAvailable,
      afterAvailable: inventory.availableQuantity,
      beforeReserved,
      afterReserved: inventory.reservedQuantity,
      beforeInTransit,
      afterInTransit: beforeInTransit,
      referenceType: 'RESERVATION',
      referenceId: reservationId,
      performedBy: userId,
      reason,
      notes,
      correlationId
    }, companyId);

    // Commit transaction
    await session.commitTransaction();

    logger.info(
      `Released ${quantity} units of item ${itemId} at location ${locationId} ` +
      `(reservation: ${reservationId})`
    );

    return inventory;
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    logger.error('Error releasing reservation:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Consume a reservation (fulfill the reservation)
 * Decreases reserved quantity without changing available quantity
 * Records ledger entry atomically
 * 
 * @param {Object} params - Consumption parameters
 * @param {string} params.locationId - Location ID
 * @param {string} params.itemId - Inventory item ID
 * @param {number} params.quantity - Quantity to consume
 * @param {string} params.reservationId - Reservation ID to consume
 * @param {string} params.userId - User performing the operation
 * @param {string} params.companyId - Company ID
 * @param {string} [params.notes] - Optional notes
 * @param {string} [params.correlationId] - Optional correlation ID
 * @returns {Promise<Object>} Updated inventory item location
 */
export const consumeReservation = async (params) => {
  const {
    locationId,
    itemId,
    quantity,
    reservationId,
    userId,
    companyId,
    notes,
    correlationId
  } = params;

  // Validate required parameters
  if (!locationId || !itemId || !quantity || !reservationId || !userId || !companyId) {
    throw new Error('Missing required parameters for consumeReservation');
  }

  // Validate quantity is positive
  if (quantity <= 0) {
    throw new Error('Consumption quantity must be positive');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryReservation = getInventoryReservationModel(companyDB);

    // Get reservation
    const reservation = await InventoryReservation.findById(reservationId).session(session);

    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    // Validate reservation is active
    if (reservation.status !== 'active') {
      throw new Error(`Reservation ${reservationId} is not active (status: ${reservation.status})`);
    }

    // Prevent consumption of expired reservations (Requirement 26.7)
    if (reservation.reservationExpiresAt && reservation.reservationExpiresAt < new Date()) {
      throw new Error(
        `Reservation ${reservationId} has expired at ${reservation.reservationExpiresAt.toISOString()}. ` +
        `Cannot consume expired reservation.`
      );
    }

    // Validate quantity matches reservation
    if (reservation.quantity !== quantity) {
      throw new Error(
        `Consumption quantity ${quantity} does not match reservation quantity ${reservation.quantity}`
      );
    }

    // Get current inventory state
    const inventory = await InventoryItemLocation.findOne({
      locationId,
      inventoryItem: itemId,
      isActive: true
    }).session(session);

    if (!inventory) {
      throw new Error(`Inventory item ${itemId} not found at location ${locationId}`);
    }

    // Validate sufficient reserved quantity (Requirement 13.6)
    if (inventory.reservedQuantity < quantity) {
      throw new Error(
        `Insufficient reserved quantity to consume. Reserved: ${inventory.reservedQuantity}, ` +
        `Requested: ${quantity}`
      );
    }

    // Store before state for ledger
    const beforeAvailable = inventory.availableQuantity;
    const beforeReserved = inventory.reservedQuantity;
    const beforeInTransit = inventory.inTransitQuantity;

    // Update inventory quantities (Requirement 13.6)
    inventory.reservedQuantity -= quantity;
    inventory.version += 1;

    await inventory.save({ session });

    // Update reservation status
    reservation.status = 'consumed';
    reservation.consumedBy = userId;
    reservation.consumedDate = new Date();

    await reservation.save({ session });

    // Record ledger entry atomically (Requirement 16.1, 16.2)
    await recordLedgerEntry({
      inventoryItem: itemId,
      locationId,
      movementType: 'consumption',
      quantityDelta: -quantity,
      beforeAvailable,
      afterAvailable: beforeAvailable, // Available doesn't change
      beforeReserved,
      afterReserved: inventory.reservedQuantity,
      beforeInTransit,
      afterInTransit: beforeInTransit,
      referenceType: 'RESERVATION',
      referenceId: reservationId,
      performedBy: userId,
      notes,
      correlationId
    }, companyId);

    // Commit transaction
    await session.commitTransaction();

    logger.info(
      `Consumed ${quantity} units of item ${itemId} at location ${locationId} ` +
      `(reservation: ${reservationId})`
    );

    return inventory;
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    logger.error('Error consuming reservation:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Get inventory at a specific location
 * @param {string} locationId - Location ID
 * @param {string} itemId - Inventory item ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Inventory item location
 */
export const getInventoryAtLocation = async (locationId, itemId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    const inventory = await InventoryItemLocation.findOne({
      locationId,
      inventoryItem: itemId,
      isActive: true
    }).populate('inventoryItem').populate('locationId').populate('supplier');

    return inventory;
  } catch (error) {
    logger.error('Error getting inventory at location:', error);
    throw error;
  }
};

/**
 * Get all inventory at a location with pagination support
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @param {Object} filters - Optional filters
 * @param {boolean} filters.includeArchived - Include archived items
 * @param {number} filters.page - Page number (default: 1)
 * @param {number} filters.limit - Items per page (default: 100)
 * @returns {Promise<Object>} Paginated inventory results
 */
export const getInventoryByLocation = async (locationId, companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    const query = {
      locationId,
      isActive: true
    };

    if (filters.includeArchived) {
      delete query.isActive;
    }

    // Pagination parameters
    const page = filters.page || 1;
    const limit = filters.limit || 100;
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const [items, total] = await Promise.all([
      InventoryItemLocation.find(query)
        .populate('inventoryItem')
        .populate('locationId')
        .populate('supplier')
        .sort({ 'inventoryItem.name': 1 })
        .skip(skip)
        .limit(limit),
      InventoryItemLocation.countDocuments(query)
    ]);

    return {
      items,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    };
  } catch (error) {
    logger.error('Error getting inventory by location:', error);
    throw error;
  }
};

