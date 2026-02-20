/**
 * Location Inventory Controller
 * Handles API endpoints for location-based inventory management
 * Supports batch tracking, reservations, and expiry monitoring
 */

import { getCompanyDB } from '../config/database.js';
import { getInventoryItemLocationModel } from '../models/company/InventoryItemLocation.js';
import { getInventoryItemModel } from '../models/company/InventoryItem.js';
import { getLocationModel } from '../models/company/Location.js';
import * as locationInventoryService from '../services/locationInventoryService.js';
import * as inventoryBatchLocationService from '../services/inventoryBatchLocationService.js';

/**
 * GET /api/inventory/location/:locationId
 * Get all inventory items at a specific location
 */
export const getInventoryByLocation = async (req, res, next) => {
  try {
    const { locationId } = req.params;
    const { page = 1, limit = 100, includeArchived = false } = req.query;
    const { companyId } = req.user;

    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    // Verify location exists and belongs to company
    const location = await Location.findById(locationId);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Get inventory with pagination
    const filters = {
      includeArchived: includeArchived === 'true',
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const inventory = await locationInventoryService.getInventoryByLocation(
      locationId,
      companyId,
      filters
    );

    res.status(200).json({
      success: true,
      data: inventory.items,
      pagination: {
        page: inventory.page,
        limit: inventory.limit,
        total: inventory.total,
        pages: inventory.pages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/inventory/item/:itemId
 * Get inventory for a specific item across all locations
 */
export const getInventoryByItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { page = 1, limit = 100 } = req.query;
    const { companyId } = req.user;

    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    // Verify item exists
    const item = await InventoryItem.findById(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Get inventory across all locations with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [inventory, total] = await Promise.all([
      InventoryItemLocation.find({
        inventoryItem: itemId,
        isActive: true
      })
        .populate('locationId', 'name code type')
        .populate('inventoryItem', 'name itemCode unit')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ 'locationId.name': 1 }),
      InventoryItemLocation.countDocuments({
        inventoryItem: itemId,
        isActive: true
      })
    ]);

    res.status(200).json({
      success: true,
      data: inventory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/inventory/location/:locationId/item/:itemId
 * Get inventory for a specific item at a specific location
 */
export const getInventoryAtLocation = async (req, res, next) => {
  try {
    const { locationId, itemId } = req.params;
    const { companyId } = req.user;

    const inventory = await locationInventoryService.getInventoryAtLocation(
      locationId,
      itemId,
      companyId
    );

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Inventory not found at this location'
      });
    }

    res.status(200).json({
      success: true,
      data: inventory
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/inventory/location/:locationId/item/:itemId/batches
 * Get all batches for a specific item at a location
 */
export const getBatchesAtLocation = async (req, res, next) => {
  try {
    const { locationId, itemId } = req.params;
    const { page = 1, limit = 100, status } = req.query;
    const { companyId } = req.user;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit)
    };

    if (status) {
      options.status = status;
    }

    const result = await inventoryBatchLocationService.getBatchesAtLocation(
      locationId,
      itemId,
      companyId,
      options
    );

    res.status(200).json({
      success: true,
      data: result.batches,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: result.pages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/inventory/location/:locationId/expiring
 * Get batches expiring within specified days at a location
 */
export const getExpiringBatches = async (req, res, next) => {
  try {
    const { locationId } = req.params;
    const { days = 30, itemId, page = 1, limit = 100 } = req.query;
    const { companyId } = req.user;

    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    // Verify location exists
    const location = await Location.findById(locationId);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Get expiring batches
    const batches = await inventoryBatchLocationService.getExpiringBatches(
      locationId,
      parseInt(days),
      companyId,
      itemId || null
    );

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedBatches = batches.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      data: paginatedBatches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: batches.length,
        pages: Math.ceil(batches.length / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/inventory/location/:locationId/expired
 * Get expired batches at a location
 */
export const getExpiredBatches = async (req, res, next) => {
  try {
    const { locationId } = req.params;
    const { itemId, page = 1, limit = 100 } = req.query;
    const { companyId } = req.user;

    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    // Verify location exists
    const location = await Location.findById(locationId);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Get expired batches
    const batches = await inventoryBatchLocationService.getExpiredBatches(
      locationId,
      companyId,
      itemId || null
    );

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedBatches = batches.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      data: paginatedBatches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: batches.length,
        pages: Math.ceil(batches.length / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/inventory/reserve
 * Reserve inventory for an order or allocation
 */
export const reserveInventory = async (req, res, next) => {
  try {
    const { locationId, itemId, quantity, referenceType, referenceId, reason } = req.body;
    const { companyId, userId } = req.user;

    // Validate required fields
    if (!locationId || !itemId || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'locationId, itemId, and quantity are required'
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      });
    }

    // Reserve inventory
    await locationInventoryService.reserveInventory({
      locationId,
      itemId,
      quantity,
      userId,
      companyId,
      referenceType: referenceType || 'ORDER',
      referenceId: referenceId || null,
      reason: reason || 'Manual reservation'
    });

    res.status(200).json({
      success: true,
      message: 'Inventory reserved successfully',
      data: {
        locationId,
        itemId,
        quantity,
        reservedAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/inventory/release
 * Release a previously reserved inventory
 */
export const releaseReservation = async (req, res, next) => {
  try {
    const { locationId, itemId, quantity, reservationId, referenceType, referenceId, reason } = req.body;
    const { companyId, userId } = req.user;

    // Validate required fields
    if (!locationId || !itemId || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'locationId, itemId, and quantity are required'
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      });
    }

    // If reservationId is not provided, we need to find or create a dummy reservation
    // For now, require reservationId for proper tracking
    if (!reservationId) {
      return res.status(400).json({
        success: false,
        message: 'reservationId is required to release a reservation'
      });
    }

    // Release reservation
    await locationInventoryService.releaseReservation({
      locationId,
      itemId,
      quantity,
      reservationId,
      userId,
      companyId,
      reason: reason || 'Manual release',
      referenceType: referenceType || 'ORDER',
      referenceId: referenceId || null
    });

    res.status(200).json({
      success: true,
      message: 'Reservation released successfully',
      data: {
        locationId,
        itemId,
        quantity,
        releasedAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/inventory/consume
 * Consume reserved inventory
 */
export const consumeReservation = async (req, res, next) => {
  try {
    const { locationId, itemId, quantity, reservationId, referenceType, referenceId, reason } = req.body;
    const { companyId, userId } = req.user;

    // Validate required fields
    if (!locationId || !itemId || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'locationId, itemId, and quantity are required'
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      });
    }

    // If reservationId is not provided, require it for proper tracking
    if (!reservationId) {
      return res.status(400).json({
        success: false,
        message: 'reservationId is required to consume a reservation'
      });
    }

    // Consume reservation
    const result = await locationInventoryService.consumeReservation({
      locationId,
      itemId,
      quantity,
      reservationId,
      userId,
      companyId,
      referenceType: referenceType || 'ORDER',
      referenceId: referenceId || null,
      notes: reason || 'Manual consumption'
    });

    res.status(200).json({
      success: true,
      message: 'Reservation consumed successfully',
      data: {
        locationId,
        itemId,
        quantity,
        totalCost: result.totalCost,
        consumedAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};
