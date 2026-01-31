/**
 * Inventory Service
 * Business logic for inventory management operations
 */

import { getCompanyDB } from '../config/database.js';
import { getInventoryItemModel } from '../models/company/InventoryItem.js';
import { getGRNModel } from '../models/company/GRN.js';
import { getStockAdjustmentModel } from '../models/company/StockAdjustment.js';
import { getStockTransferModel } from '../models/company/StockTransfer.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new inventory item
 * @param {Object} itemData - Inventory item data
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @returns {Promise<Object>} Created inventory item
 */
export const createInventoryItem = async (itemData, companyId, branchId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);

    // Validate required fields
    const requiredFields = ['name', 'type', 'unit', 'minimumStock'];
    const missingFields = requiredFields.filter(field => !itemData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate negative values
    const numericFields = ['currentStock', 'minimumStock', 'maximumStock', 'reorderPoint', 'costPrice'];
    for (const field of numericFields) {
      if (itemData[field] !== undefined && itemData[field] < 0) {
        throw new Error(`${field} cannot be negative`);
      }
    }

    // Validate stock ranges
    if (itemData.maximumStock !== undefined && itemData.maximumStock < itemData.minimumStock) {
      throw new Error('Maximum stock cannot be less than minimum stock');
    }

    // Check unique SKU/barcode
    if (itemData.sku) {
      const existingSku = await InventoryItem.findOne({ sku: itemData.sku, isActive: true });
      if (existingSku) {
        throw new Error('SKU already exists');
      }
    }

    if (itemData.barcode) {
      const existingBarcode = await InventoryItem.findOne({ barcode: itemData.barcode, isActive: true });
      if (existingBarcode) {
        throw new Error('Barcode already exists');
      }
    }

    // Set initial stock if provided, otherwise default to 0
    if (itemData.initialStock !== undefined) {
      itemData.currentStock = itemData.initialStock;
      delete itemData.initialStock;
    } else if (itemData.currentStock === undefined) {
      itemData.currentStock = 0;
    }

    // Create inventory item
    const inventoryItem = new InventoryItem({
      ...itemData,
      branch: branchId,
      isActive: true
    });

    await inventoryItem.save();

    logger.info(`Inventory item created: ${inventoryItem._id} for company: ${companyId}`);

    return inventoryItem;
  } catch (error) {
    logger.error('Error creating inventory item:', error);
    throw error;
  }
};

/**
 * Get inventory items with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated inventory items
 */
export const getInventoryItems = async (companyId, branchId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);

    const {
      page = 1,
      limit = 10,
      search = '',
      type = '',
      category = '',
      lowStock = false
    } = filters;

    // Build query
    const query = {
      branch: branchId,
      isActive: true
    };

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ];
    }

    // Type filter
    if (type) {
      query.type = type;
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Low stock filter
    if (lowStock === true || lowStock === 'true') {
      query.$expr = { $lte: ['$currentStock', '$minimumStock'] };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [items, total] = await Promise.all([
      InventoryItem.find(query)
        .populate('supplier', 'name contactPerson phone email')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      InventoryItem.countDocuments(query)
    ]);

    // Calculate virtuals manually for lean queries
    const itemsWithVirtuals = items.map(item => ({
      ...item,
      isLowStock: item.currentStock <= item.minimumStock,
      isExpiringSoon: item.expiryDate ? isExpiringSoon(item.expiryDate) : false
    }));

    return {
      items: itemsWithVirtuals,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting inventory items:', error);
    throw error;
  }
};

/**
 * Get inventory item by ID
 * @param {string} itemId - Inventory item ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Inventory item
 */
export const getInventoryItemById = async (itemId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);

    const item = await InventoryItem.findById(itemId)
      .populate('supplier', 'name contactPerson phone email rating categories')
      .lean();

    if (!item) {
      throw new Error('Inventory item not found');
    }

    // Calculate virtuals
    item.isLowStock = item.currentStock <= item.minimumStock;
    item.isExpiringSoon = item.expiryDate ? isExpiringSoon(item.expiryDate) : false;

    return item;
  } catch (error) {
    logger.error('Error getting inventory item by ID:', error);
    throw error;
  }
};

/**
 * Update inventory item
 * @param {string} itemId - Inventory item ID
 * @param {Object} updateData - Update data
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated inventory item
 */
export const updateInventoryItem = async (itemId, updateData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);

    // Get existing item
    const existingItem = await InventoryItem.findById(itemId);
    if (!existingItem) {
      throw new Error('Inventory item not found');
    }

    // Validate negative values
    const numericFields = ['currentStock', 'minimumStock', 'maximumStock', 'reorderPoint', 'costPrice'];
    for (const field of numericFields) {
      if (updateData[field] !== undefined && updateData[field] < 0) {
        throw new Error(`${field} cannot be negative`);
      }
    }

    // Validate stock ranges
    const newMinStock = updateData.minimumStock !== undefined ? updateData.minimumStock : existingItem.minimumStock;
    const newMaxStock = updateData.maximumStock !== undefined ? updateData.maximumStock : existingItem.maximumStock;
    
    if (newMaxStock !== undefined && newMaxStock < newMinStock) {
      throw new Error('Maximum stock cannot be less than minimum stock');
    }

    // Check unique SKU/barcode if being updated
    if (updateData.sku && updateData.sku !== existingItem.sku) {
      const existingSku = await InventoryItem.findOne({ 
        sku: updateData.sku, 
        isActive: true,
        _id: { $ne: itemId }
      });
      if (existingSku) {
        throw new Error('SKU already exists');
      }
    }

    if (updateData.barcode && updateData.barcode !== existingItem.barcode) {
      const existingBarcode = await InventoryItem.findOne({ 
        barcode: updateData.barcode, 
        isActive: true,
        _id: { $ne: itemId }
      });
      if (existingBarcode) {
        throw new Error('Barcode already exists');
      }
    }

    // Update item
    Object.assign(existingItem, updateData);
    await existingItem.save();

    logger.info(`Inventory item updated: ${itemId} for company: ${companyId}`);

    return existingItem;
  } catch (error) {
    logger.error('Error updating inventory item:', error);
    throw error;
  }
};

/**
 * Delete inventory item (soft delete)
 * @param {string} itemId - Inventory item ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Deleted inventory item
 */
export const deleteInventoryItem = async (itemId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);

    const item = await InventoryItem.findByIdAndUpdate(
      itemId,
      { isActive: false },
      { new: true }
    );

    if (!item) {
      throw new Error('Inventory item not found');
    }

    logger.info(`Inventory item soft deleted: ${itemId} for company: ${companyId}`);

    return item;
  } catch (error) {
    logger.error('Error deleting inventory item:', error);
    throw error;
  }
};

/**
 * Check low stock items
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Low stock items
 */
export const checkLowStock = async (companyId, branchId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);

    const items = await InventoryItem.find({
      branch: branchId,
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minimumStock'] }
    })
      .populate('supplier', 'name contactPerson phone email')
      .sort({ currentStock: 1 })
      .lean();

    // Add virtuals
    const itemsWithVirtuals = items.map(item => ({
      ...item,
      isLowStock: true,
      isExpiringSoon: item.expiryDate ? isExpiringSoon(item.expiryDate) : false
    }));

    return itemsWithVirtuals;
  } catch (error) {
    logger.error('Error checking low stock:', error);
    throw error;
  }
};

/**
 * Check expiring items
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @param {number} daysAhead - Days ahead to check (default: 7)
 * @returns {Promise<Array>} Expiring items
 */
export const checkExpiringItems = async (companyId, branchId, daysAhead = 7) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const items = await InventoryItem.find({
      branch: branchId,
      isActive: true,
      expiryDate: {
        $gte: today,
        $lte: futureDate
      }
    })
      .populate('supplier', 'name contactPerson phone email')
      .sort({ expiryDate: 1 })
      .lean();

    // Add virtuals
    const itemsWithVirtuals = items.map(item => ({
      ...item,
      isLowStock: item.currentStock <= item.minimumStock,
      isExpiringSoon: true
    }));

    return itemsWithVirtuals;
  } catch (error) {
    logger.error('Error checking expiring items:', error);
    throw error;
  }
};

/**
 * Get distinct inventory categories
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} List of categories
 */
export const getInventoryCategories = async (companyId, branchId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItem = getInventoryItemModel(companyDB);

    const categories = await InventoryItem.distinct('category', {
      branch: branchId,
      isActive: true
    });

    return categories.sort();
  } catch (error) {
    logger.error('Error getting inventory categories:', error);
    throw error;
  }
};

/**
 * Helper function to check if an item is expiring soon
 * @param {Date} expiryDate - Expiry date
 * @returns {boolean} True if expiring within 7 days
 */
const isExpiringSoon = (expiryDate) => {
  if (!expiryDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  return expiry >= today && expiry <= sevenDaysFromNow;
};

/**
 * Generate unique GRN number
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @returns {Promise<string>} Generated GRN number
 */
export const generateGRNNumber = async (companyId, branchId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `GRN-${year}${month}`;

    // Find the last GRN number for this month and branch
    const lastGRN = await GRN.findOne({
      branch: branchId,
      grnNumber: { $regex: `^${prefix}` }
    })
      .sort({ grnNumber: -1 })
      .lean();

    let sequence = 1;
    if (lastGRN) {
      const lastSequence = parseInt(lastGRN.grnNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    const grnNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;

    return grnNumber;
  } catch (error) {
    logger.error('Error generating GRN number:', error);
    throw error;
  }
};

/**
 * Create a new GRN and update inventory
 * @param {Object} grnData - GRN data
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Created GRN
 */
export const createGRN = async (grnData, companyId, branchId, userId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB);

    // Validate line items
    if (!grnData.items || grnData.items.length === 0) {
      throw new Error('GRN must have at least one line item');
    }

    // Validate each line item
    for (const item of grnData.items) {
      if (!item.inventoryItem || !item.quantity || !item.unitPrice) {
        throw new Error('Each line item must have inventoryItem, quantity, and unitPrice');
      }
      if (item.quantity <= 0 || item.unitPrice < 0) {
        throw new Error('Quantity must be positive and unit price cannot be negative');
      }
    }

    // Generate GRN number
    const grnNumber = await generateGRNNumber(companyId, branchId);

    // Calculate line item totals
    const items = grnData.items.map(item => ({
      ...item,
      totalPrice: item.quantity * item.unitPrice
    }));

    // Create GRN (totalAmount will be calculated by pre-save hook)
    const grn = new GRN({
      grnNumber,
      branch: branchId,
      supplier: grnData.supplierId || grnData.supplier,
      purchaseOrder: grnData.purchaseOrder,
      items,
      receivedBy: userId,
      receivedDate: grnData.receivedDate || new Date(),
      status: grnData.status || 'received',
      notes: grnData.notes,
      invoiceNumber: grnData.invoiceNumber,
      invoiceDate: grnData.invoiceDate
    });

    await grn.save();

    // Update inventory for each line item
    for (const item of items) {
      const inventoryItem = await InventoryItem.findById(item.inventoryItem);
      
      if (!inventoryItem) {
        logger.warn(`Inventory item not found: ${item.inventoryItem}`);
        continue;
      }

      // Increase stock
      inventoryItem.currentStock += item.quantity;

      // Update cost price and purchase metadata
      inventoryItem.costPrice = item.unitPrice;
      inventoryItem.lastPurchaseDate = grn.receivedDate;
      inventoryItem.lastPurchasePrice = item.unitPrice;

      // Update batch number if provided
      if (item.batchNumber) {
        inventoryItem.batchNumber = item.batchNumber;
      }

      // Update expiry date if provided
      if (item.expiryDate) {
        inventoryItem.expiryDate = item.expiryDate;
      }

      await inventoryItem.save();
    }

    logger.info(`GRN created: ${grn._id} (${grnNumber}) for company: ${companyId}`);

    return grn;
  } catch (error) {
    logger.error('Error creating GRN:', error);
    throw error;
  }
};

/**
 * Get GRNs with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated GRNs
 */
export const getGRNs = async (companyId, branchId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);

    const {
      page = 1,
      limit = 10,
      supplier = '',
      status = '',
      startDate = '',
      endDate = ''
    } = filters;

    // Build query
    const query = {
      branch: branchId
    };

    // Supplier filter
    if (supplier) {
      query.supplier = supplier;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      query.receivedDate = {};
      if (startDate) {
        query.receivedDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.receivedDate.$lte = end;
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [grns, total] = await Promise.all([
      GRN.find(query)
        .populate('supplier', 'name contactPerson phone email')
        .populate('receivedBy', 'name email')
        .sort({ receivedDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      GRN.countDocuments(query)
    ]);

    return {
      grns,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting GRNs:', error);
    throw error;
  }
};

/**
 * Get GRN by ID
 * @param {string} grnId - GRN ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} GRN
 */
export const getGRNById = async (grnId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);

    const grn = await GRN.findById(grnId)
      .populate('supplier', 'name contactPerson phone email address gstNumber')
      .populate('receivedBy', 'name email')
      .populate('items.inventoryItem', 'name type unit sku')
      .lean();

    if (!grn) {
      throw new Error('GRN not found');
    }

    return grn;
  } catch (error) {
    logger.error('Error getting GRN by ID:', error);
    throw error;
  }
};

/**
 * Generate unique adjustment number
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @returns {Promise<string>} Generated adjustment number
 */
export const generateAdjustmentNumber = async (companyId, branchId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `ADJ-${year}${month}`;

    // Find the last adjustment number for this month and branch
    const lastAdjustment = await StockAdjustment.findOne({
      branch: branchId,
      adjustmentNumber: { $regex: `^${prefix}` }
    })
      .sort({ adjustmentNumber: -1 })
      .lean();

    let sequence = 1;
    if (lastAdjustment) {
      const lastSequence = parseInt(lastAdjustment.adjustmentNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    const adjustmentNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;

    return adjustmentNumber;
  } catch (error) {
    logger.error('Error generating adjustment number:', error);
    throw error;
  }
};

/**
 * Create a stock adjustment and update inventory
 * @param {Object} adjustmentData - Stock adjustment data
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Created stock adjustment
 */
export const createStockAdjustment = async (adjustmentData, companyId, branchId, userId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB);

    // Validate required fields
    if (!adjustmentData.inventoryItemId || !adjustmentData.adjustmentType || !adjustmentData.quantity || !adjustmentData.reason) {
      throw new Error('Missing required fields: inventoryItemId, adjustmentType, quantity, and reason are required');
    }

    // Validate adjustment type
    const validTypes = ['increase', 'decrease', 'correction'];
    if (!validTypes.includes(adjustmentData.adjustmentType)) {
      throw new Error('Invalid adjustment type. Must be: increase, decrease, or correction');
    }

    // Validate reason
    const validReasons = ['damaged', 'expired', 'theft', 'wastage', 'count_correction', 'other'];
    if (!validReasons.includes(adjustmentData.reason)) {
      throw new Error('Invalid reason');
    }

    // Get inventory item
    const inventoryItem = await InventoryItem.findById(adjustmentData.inventoryItemId);
    if (!inventoryItem) {
      throw new Error('Inventory item not found');
    }

    // Verify item belongs to the branch
    if (inventoryItem.branch.toString() !== branchId) {
      throw new Error('Inventory item does not belong to this branch');
    }

    const previousStock = inventoryItem.currentStock;
    let newStock;

    // Calculate new stock based on adjustment type
    switch (adjustmentData.adjustmentType) {
      case 'increase':
        newStock = previousStock + adjustmentData.quantity;
        break;
      case 'decrease':
        newStock = previousStock - adjustmentData.quantity;
        if (newStock < 0) {
          throw new Error('Insufficient stock. Adjustment would result in negative stock');
        }
        break;
      case 'correction':
        newStock = adjustmentData.quantity;
        break;
      default:
        throw new Error('Invalid adjustment type');
    }

    // Generate adjustment number
    const adjustmentNumber = await generateAdjustmentNumber(companyId, branchId);

    // Create stock adjustment
    const adjustment = new StockAdjustment({
      adjustmentNumber,
      branch: branchId,
      inventoryItem: adjustmentData.inventoryItemId,
      adjustmentType: adjustmentData.adjustmentType,
      quantity: adjustmentData.quantity,
      previousStock,
      newStock,
      reason: adjustmentData.reason,
      notes: adjustmentData.notes,
      adjustedBy: userId,
      adjustmentDate: adjustmentData.adjustmentDate || new Date()
    });

    await adjustment.save();

    // Update inventory item stock
    inventoryItem.currentStock = newStock;
    await inventoryItem.save();

    logger.info(`Stock adjustment created: ${adjustment._id} (${adjustmentNumber}) for company: ${companyId}`);

    return adjustment;
  } catch (error) {
    logger.error('Error creating stock adjustment:', error);
    throw error;
  }
};

/**
 * Get stock adjustments with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated stock adjustments
 */
export const getStockAdjustments = async (companyId, branchId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);

    const {
      page = 1,
      limit = 10,
      startDate = '',
      endDate = '',
      type = '',
      reason = ''
    } = filters;

    // Build query
    const query = {
      branch: branchId
    };

    // Date range filter
    if (startDate || endDate) {
      query.adjustmentDate = {};
      if (startDate) {
        query.adjustmentDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.adjustmentDate.$lte = end;
      }
    }

    // Type filter
    if (type) {
      query.adjustmentType = type;
    }

    // Reason filter
    if (reason) {
      query.reason = reason;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [adjustments, total] = await Promise.all([
      StockAdjustment.find(query)
        .populate('inventoryItem', 'name type unit sku')
        .populate('adjustedBy', 'name email')
        .sort({ adjustmentDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockAdjustment.countDocuments(query)
    ]);

    return {
      adjustments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting stock adjustments:', error);
    throw error;
  }
};

/**
 * Get stock adjustment by ID
 * @param {string} adjustmentId - Stock adjustment ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Stock adjustment
 */
export const getStockAdjustmentById = async (adjustmentId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);

    const adjustment = await StockAdjustment.findById(adjustmentId)
      .populate('inventoryItem', 'name type unit sku currentStock minimumStock')
      .populate('adjustedBy', 'name email')
      .populate('approvedBy', 'name email')
      .lean();

    if (!adjustment) {
      throw new Error('Stock adjustment not found');
    }

    return adjustment;
  } catch (error) {
    logger.error('Error getting stock adjustment by ID:', error);
    throw error;
  }
};

/**
 * Generate unique transfer number
 * @param {string} companyId - Company ID
 * @returns {Promise<string>} Generated transfer number
 */
export const generateTransferNumber = async (companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `TRF-${year}${month}`;

    // Find the last transfer number for this month
    const lastTransfer = await StockTransfer.findOne({
      transferNumber: { $regex: `^${prefix}` }
    })
      .sort({ transferNumber: -1 })
      .lean();

    let sequence = 1;
    if (lastTransfer) {
      const lastSequence = parseInt(lastTransfer.transferNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    const transferNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;

    return transferNumber;
  } catch (error) {
    logger.error('Error generating transfer number:', error);
    throw error;
  }
};

/**
 * Create a stock transfer request
 * @param {Object} transferData - Stock transfer data
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Created stock transfer
 */
export const createStockTransfer = async (transferData, companyId, userId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    // Validate required fields
    if (!transferData.fromBranch || !transferData.toBranch || !transferData.items || transferData.items.length === 0) {
      throw new Error('Missing required fields: fromBranch, toBranch, and items are required');
    }

    // Validate branches are different
    if (transferData.fromBranch === transferData.toBranch) {
      throw new Error('From branch and to branch must be different');
    }

    // Validate each line item
    for (const item of transferData.items) {
      if (!item.inventoryItem || !item.quantity || !item.unit) {
        throw new Error('Each line item must have inventoryItem, quantity, and unit');
      }
      if (item.quantity <= 0) {
        throw new Error('Quantity must be positive');
      }
    }

    // Generate transfer number
    const transferNumber = await generateTransferNumber(companyId);

    // Create stock transfer
    const transfer = new StockTransfer({
      transferNumber,
      fromBranch: transferData.fromBranch,
      toBranch: transferData.toBranch,
      items: transferData.items,
      requestedBy: userId,
      requestDate: transferData.requestDate || new Date(),
      status: 'pending',
      notes: transferData.notes
    });

    await transfer.save();

    logger.info(`Stock transfer created: ${transfer._id} (${transferNumber}) for company: ${companyId}`);

    return transfer;
  } catch (error) {
    logger.error('Error creating stock transfer:', error);
    throw error;
  }
};

/**
 * Approve a stock transfer and execute the transfer
 * @param {string} transferId - Stock transfer ID
 * @param {string} companyId - Company ID
 * @param {string} approverId - Approver user ID
 * @returns {Promise<Object>} Approved stock transfer
 */
export const approveStockTransfer = async (transferId, companyId, approverId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB);

    // Get transfer
    const transfer = await StockTransfer.findById(transferId);
    if (!transfer) {
      throw new Error('Stock transfer not found');
    }

    // Verify status is pending
    if (transfer.status !== 'pending') {
      throw new Error(`Cannot approve transfer with status: ${transfer.status}`);
    }

    // Validate sufficient stock in from branch for all items
    for (const item of transfer.items) {
      const inventoryItem = await InventoryItem.findOne({
        _id: item.inventoryItem,
        branch: transfer.fromBranch
      });

      if (!inventoryItem) {
        throw new Error(`Inventory item not found in from branch: ${item.inventoryItem}`);
      }

      if (inventoryItem.currentStock < item.quantity) {
        throw new Error(`Insufficient stock for item: ${inventoryItem.name}. Available: ${inventoryItem.currentStock}, Required: ${item.quantity}`);
      }
    }

    // Execute transfer: decrease from branch, increase to branch
    for (const item of transfer.items) {
      // Decrease stock in from branch
      const fromItem = await InventoryItem.findOne({
        _id: item.inventoryItem,
        branch: transfer.fromBranch
      });

      if (fromItem) {
        fromItem.currentStock -= item.quantity;
        await fromItem.save();
      }

      // Increase stock in to branch (or create if doesn't exist)
      let toItem = await InventoryItem.findOne({
        _id: item.inventoryItem,
        branch: transfer.toBranch
      });

      if (toItem) {
        toItem.currentStock += item.quantity;
        await toItem.save();
      } else {
        // If item doesn't exist in to branch, create it
        const sourceItem = await InventoryItem.findById(item.inventoryItem);
        if (sourceItem) {
          const newItem = new InventoryItem({
            name: sourceItem.name,
            type: sourceItem.type,
            category: sourceItem.category,
            unit: sourceItem.unit,
            currentStock: item.quantity,
            minimumStock: sourceItem.minimumStock,
            maximumStock: sourceItem.maximumStock,
            reorderPoint: sourceItem.reorderPoint,
            costPrice: sourceItem.costPrice,
            branch: transfer.toBranch,
            supplier: sourceItem.supplier,
            sku: null, // Don't copy unique fields
            barcode: null,
            isActive: true
          });
          await newItem.save();
        }
      }
    }

    // Update transfer status
    transfer.status = 'completed';
    transfer.approvedBy = approverId;
    transfer.approvedDate = new Date();
    transfer.completedDate = new Date();
    await transfer.save();

    logger.info(`Stock transfer approved: ${transferId} for company: ${companyId}`);

    return transfer;
  } catch (error) {
    logger.error('Error approving stock transfer:', error);
    throw error;
  }
};

/**
 * Reject a stock transfer
 * @param {string} transferId - Stock transfer ID
 * @param {string} companyId - Company ID
 * @param {string} rejectorId - Rejector user ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} Rejected stock transfer
 */
export const rejectStockTransfer = async (transferId, companyId, rejectorId, reason) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    // Get transfer
    const transfer = await StockTransfer.findById(transferId);
    if (!transfer) {
      throw new Error('Stock transfer not found');
    }

    // Verify status is pending
    if (transfer.status !== 'pending') {
      throw new Error(`Cannot reject transfer with status: ${transfer.status}`);
    }

    // Validate rejection reason
    if (!reason || reason.trim() === '') {
      throw new Error('Rejection reason is required');
    }

    // Update transfer status
    transfer.status = 'rejected';
    transfer.rejectedBy = rejectorId;
    transfer.rejectedDate = new Date();
    transfer.rejectionReason = reason;
    await transfer.save();

    logger.info(`Stock transfer rejected: ${transferId} for company: ${companyId}`);

    return transfer;
  } catch (error) {
    logger.error('Error rejecting stock transfer:', error);
    throw error;
  }
};

/**
 * Get stock transfers with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID (optional - returns transfers where branch is from or to)
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated stock transfers
 */
export const getStockTransfers = async (companyId, branchId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    const {
      page = 1,
      limit = 10,
      status = ''
    } = filters;

    // Build query
    const query = {};

    // Branch filter - return transfers where branch is from or to
    if (branchId) {
      query.$or = [
        { fromBranch: branchId },
        { toBranch: branchId }
      ];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [transfers, total] = await Promise.all([
      StockTransfer.find(query)
        .populate('fromBranch', 'name address')
        .populate('toBranch', 'name address')
        .populate('requestedBy', 'name email')
        .populate('approvedBy', 'name email')
        .populate('rejectedBy', 'name email')
        .populate('items.inventoryItem', 'name type unit sku')
        .sort({ requestDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockTransfer.countDocuments(query)
    ]);

    return {
      transfers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting stock transfers:', error);
    throw error;
  }
};

/**
 * Get stock transfer by ID
 * @param {string} transferId - Stock transfer ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Stock transfer
 */
export const getStockTransferById = async (transferId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    const transfer = await StockTransfer.findById(transferId)
      .populate('fromBranch', 'name address city state')
      .populate('toBranch', 'name address city state')
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .populate('items.inventoryItem', 'name type unit sku currentStock')
      .lean();

    if (!transfer) {
      throw new Error('Stock transfer not found');
    }

    return transfer;
  } catch (error) {
    logger.error('Error getting stock transfer by ID:', error);
    throw error;
  }
};
