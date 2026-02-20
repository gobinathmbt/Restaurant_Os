/**
 * Inventory Ledger Controller
 * Handles API endpoints for inventory ledger queries and audit trail
 * Provides immutable audit trail of all inventory movements
 */

import { getCompanyDB } from '../config/database.js';
import { getLocationModel } from '../models/company/Location.js';
import { getInventoryItemModel } from '../models/company/InventoryItem.js';
import * as inventoryLedgerService from '../services/inventoryLedgerService.js';

/**
 * GET /api/inventory/ledger/location/:locationId/item/:itemId
 * Get ledger entries for a specific item at a specific location
 */
export const getLedgerForItemAtLocation = async (req, res, next) => {
  try {
    const { locationId, itemId } = req.params;
    const { 
      page = 1, 
      limit = 100,
      startDate,
      endDate,
      movementType,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    const { companyId } = req.user;

    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB);

    // Verify location exists
    const location = await Location.findById(locationId);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Verify inventory item exists
    const item = await InventoryItem.findById(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Build filters
    const filters = {
      locationId,
      inventoryItem: itemId,
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder
    };

    // Add optional filters
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (movementType) filters.movementType = movementType;

    // Get ledger entries
    const result = await inventoryLedgerService.getLedgerEntries(companyId, filters);

    res.status(200).json({
      success: true,
      data: result.entries,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/inventory/ledger/location/:locationId
 * Get all ledger entries for a specific location
 */
export const getLedgerForLocation = async (req, res, next) => {
  try {
    const { locationId } = req.params;
    const { 
      page = 1, 
      limit = 100,
      inventoryItem,
      startDate,
      endDate,
      movementType,
      referenceType,
      performedBy,
      batchNumber,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
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

    // Build filters
    const filters = {
      locationId,
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder
    };

    // Add optional filters
    if (inventoryItem) filters.inventoryItem = inventoryItem;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (movementType) filters.movementType = movementType;
    if (referenceType) filters.referenceType = referenceType;
    if (performedBy) filters.performedBy = performedBy;
    if (batchNumber) filters.batchNumber = batchNumber;

    // Get ledger entries
    const result = await inventoryLedgerService.getLedgerEntries(companyId, filters);

    res.status(200).json({
      success: true,
      data: result.entries,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/inventory/ledger/movements
 * Get inventory movements with filtering and grouping for reporting
 */
export const getInventoryMovements = async (req, res, next) => {
  try {
    const { 
      locationId,
      inventoryItem,
      movementType,
      startDate,
      endDate,
      groupBy = 'movementType'
    } = req.query;
    const { companyId } = req.user;

    // Validate groupBy parameter
    const validGroupByOptions = ['movementType', 'location', 'item', 'date', 'user'];
    if (!validGroupByOptions.includes(groupBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid groupBy parameter. Must be one of: ${validGroupByOptions.join(', ')}`
      });
    }

    // Build filters
    const filters = {
      groupBy
    };

    // Add optional filters
    if (locationId) filters.locationId = locationId;
    if (inventoryItem) filters.inventoryItem = inventoryItem;
    if (movementType) filters.movementType = movementType;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    // Get inventory movements
    const movements = await inventoryLedgerService.getInventoryMovements(companyId, filters);

    res.status(200).json({
      success: true,
      data: movements,
      groupBy
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/inventory/ledger/user/:userId
 * Get ledger entries for a specific user (audit trail)
 */
export const getLedgerForUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { 
      page = 1, 
      limit = 100,
      locationId,
      inventoryItem,
      startDate,
      endDate,
      movementType,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    const { companyId } = req.user;

    // Build filters
    const filters = {
      performedBy: userId,
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder
    };

    // Add optional filters
    if (locationId) filters.locationId = locationId;
    if (inventoryItem) filters.inventoryItem = inventoryItem;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (movementType) filters.movementType = movementType;

    // Get ledger entries
    const result = await inventoryLedgerService.getLedgerEntries(companyId, filters);

    res.status(200).json({
      success: true,
      data: result.entries,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};
