/**
 * GRN Service
 * Business logic for Goods Receipt Note (GRN) operations with location-based batch tracking
 * Implements Requirements: 8.1, 8.2, 8.4, 8.5, 17.2, 16.1, 25.1, 25.6
 * Includes optimistic locking and retry logic for concurrent operations
 */

import { getCompanyDB } from '../config/database.js';
import { getGRNModel } from '../models/company/GRN.js';
import { getInventoryItemLocationModel } from '../models/company/InventoryItemLocation.js';
import { getLocationModel } from '../models/company/Location.js';
import { validateCapability } from './locationService.js';
import { createOrUpdateBatch } from './inventoryBatchLocationService.js';
import { recordLedgerEntry } from './inventoryLedgerService.js';
import { logger } from '../utils/logger.js';
import { withTransactionAndRetry } from '../utils/concurrencyControl.js';

/**
 * Generate unique GRN number
 * @param {string} companyId - Company ID
 * @param {string} locationId - Location ID
 * @returns {Promise<string>} Generated GRN number
 */
const generateGRNNumber = async (companyId, locationId) => {
  const companyDB = getCompanyDB(companyId);
  const GRN = getGRNModel(companyDB);
  
  // Get location code for GRN number prefix
  const Location = getLocationModel(companyDB);
  const location = await Location.findById(locationId);
  const locationCode = location ? location.code : 'LOC';
  
  // Get count of GRNs for this location
  const count = await GRN.countDocuments({ locationId });
  
  // Generate GRN number: LOC-GRN-YYYYMMDD-NNNN
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const sequence = String(count + 1).padStart(4, '0');
  
  return `${locationCode}-GRN-${dateStr}-${sequence}`;
};

/**
 * Create GRN with batch tracking and ledger integration
 * Implements Requirements: 8.1, 8.2, 8.4, 8.5, 17.2, 16.1, 25.1, 25.6
 * 
 * @param {Object} grnData - GRN data
 * @param {string} grnData.locationId - Location ID
 * @param {string} grnData.supplierId - Supplier ID
 * @param {Array} grnData.items - Array of items with quantity, unitPrice, batchNumber, expiryDate
 * @param {string} grnData.receivedDate - Date received
 * @param {string} grnData.notes - Optional notes
 * @param {string} grnData.invoiceNumber - Optional invoice number
 * @param {Date} grnData.invoiceDate - Optional invoice date
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID performing the operation
 * @returns {Promise<Object>} Created GRN
 */
export const createGRNWithBatches = async (grnData, companyId, userId) => {
  const companyDB = getCompanyDB(companyId);
  
  // Validate required fields
  if (!grnData.locationId) {
    throw new Error('Location ID is required');
  }
  
  if (!grnData.supplierId) {
    throw new Error('Supplier ID is required');
  }
  
  if (!grnData.items || grnData.items.length === 0) {
    throw new Error('GRN must have at least one line item');
  }
  
  // Validate line items
  for (const item of grnData.items) {
    if (!item.inventoryItem || !item.quantity || item.unitPrice === undefined || item.unitPrice === null) {
      throw new Error('Each line item must have inventoryItem, quantity, and unitPrice');
    }
    if (item.quantity <= 0) {
      throw new Error('Quantity must be positive for all line items');
    }
    if (item.unitPrice < 0) {
      throw new Error('Unit price must be non-negative for all line items');
    }
  }
  
  // Requirement 8.1, 8.2: Validate location has canProcureDirectly capability
  const canProcure = await validateCapability(grnData.locationId, 'canProcureDirectly', companyId);
  if (!canProcure) {
    const error = new Error('Location does not have permission to procure directly from suppliers');
    error.statusCode = 403;
    throw error;
  }
  
  // Execute with transaction and retry logic
  const grn = await withTransactionAndRetry(
    companyDB,
    async (session) => {
      const GRN = getGRNModel(companyDB);
      const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
      
      // Generate GRN number
      const grnNumber = await generateGRNNumber(companyId, grnData.locationId);
      
      // Calculate line item totals
      const items = grnData.items.map(item => ({
        ...item,
        totalPrice: item.quantity * item.unitPrice
      }));
      
      // Create GRN document
      const grnDoc = {
        grnNumber,
        locationId: grnData.locationId,
        supplier: grnData.supplierId,
        purchaseOrder: grnData.purchaseOrder,
        items,
        receivedBy: userId,
        receivedDate: grnData.receivedDate || new Date(),
        status: grnData.status || 'received',
        notes: grnData.notes,
        invoiceNumber: grnData.invoiceNumber,
        invoiceDate: grnData.invoiceDate,
        paymentTerms: grnData.paymentTerms
      };
      
      // Create GRN
      const grnArray = await GRN.create([grnDoc], { session });
      const createdGrn = grnArray[0];
      
      // Requirement 17.2: For each item, create or update InventoryBatchLocation
      // Requirement 8.5: Update InventoryItemLocation availableQuantity
      // Requirement 16.1: Record ledger entry with GRN reference
      for (const item of items) {
        // Get or create InventoryItemLocation
        let inventoryItemLocation = await InventoryItemLocation.findOne({
          inventoryItem: item.inventoryItem,
          locationId: grnData.locationId
        }).session(session);
        
        if (!inventoryItemLocation) {
          // Create new InventoryItemLocation if it doesn't exist
          const newInventoryItemLocation = {
            inventoryItem: item.inventoryItem,
            locationId: grnData.locationId,
            availableQuantity: 0,
            reservedQuantity: 0,
            inTransitQuantity: 0,
            minimumStock: 0,
            costingMethod: 'FIFO',
            isActive: true,
            isArchived: false,
            version: 0
          };
          
          const result = await InventoryItemLocation.create([newInventoryItemLocation], { session });
          inventoryItemLocation = result[0];
        }
        
        // Store before state for ledger
        const beforeAvailable = inventoryItemLocation.availableQuantity;
        const beforeReserved = inventoryItemLocation.reservedQuantity;
        const beforeInTransit = inventoryItemLocation.inTransitQuantity;
        
        // Update availableQuantity
        inventoryItemLocation.availableQuantity += item.quantity;
        inventoryItemLocation.lastPurchasePrice = item.unitPrice;
        inventoryItemLocation.lastPurchaseDate = createdGrn.receivedDate;
        inventoryItemLocation.supplier = grnData.supplierId;
        inventoryItemLocation.version += 1;
        
        await inventoryItemLocation.save({ session });
        
        // Create or update batch
        const batchData = {
          inventoryItem: item.inventoryItem,
          locationId: grnData.locationId,
          batchNumber: item.batchNumber || `BATCH-${grnNumber}-${item.inventoryItem}`,
          expiryDate: item.expiryDate,
          manufacturingDate: item.manufacturingDate,
          availableQuantity: item.quantity,
          unitCost: item.unitPrice,
          supplier: grnData.supplierId,
          grnReference: createdGrn._id
        };
        
        await createOrUpdateBatch(batchData, companyId);
        
        // Record ledger entry
        await recordLedgerEntry({
          inventoryItem: item.inventoryItem,
          locationId: grnData.locationId,
          batchNumber: batchData.batchNumber,
          movementType: 'grn',
          quantityDelta: item.quantity,
          beforeAvailable,
          afterAvailable: inventoryItemLocation.availableQuantity,
          beforeReserved,
          afterReserved: inventoryItemLocation.reservedQuantity,
          beforeInTransit,
          afterInTransit: inventoryItemLocation.inTransitQuantity,
          referenceType: 'GRN',
          referenceId: createdGrn._id,
          referenceNumber: grnNumber,
          unitCost: item.unitPrice,
          totalValue: item.totalPrice,
          performedBy: userId,
          notes: item.notes
        }, companyId);
      }
      
      return createdGrn;
    },
    {
      operationName: 'Create GRN with batches',
      maxRetries: 3
    }
  );
  
  logger.info(`GRN created with batches: ${grn._id} (${grn.grnNumber}) for location: ${grnData.locationId}, company: ${companyId}`);
  
  return grn;
};

/**
 * Get GRN by ID
 * @param {string} grnId - GRN ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} GRN document
 */
export const getGRNById = async (grnId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);
    
    const grn = await GRN.findById(grnId)
      .populate('locationId', 'name code type')
      .populate('supplier', 'name contactPerson phone email')
      .populate('items.inventoryItem', 'name code unit')
      .lean();
    
    if (!grn) {
      throw new Error('GRN not found');
    }
    
    return grn;
  } catch (error) {
    logger.error('Error getting GRN:', error);
    throw error;
  }
};

/**
 * Get GRNs by location
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @param {Object} options - Query options (status, startDate, endDate, limit, skip)
 * @returns {Promise<Array>} Array of GRNs
 */
export const getGRNsByLocation = async (locationId, companyId, options = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);
    
    const query = { locationId };
    
    if (options.status) {
      query.status = options.status;
    }
    
    if (options.startDate || options.endDate) {
      query.receivedDate = {};
      if (options.startDate) query.receivedDate.$gte = new Date(options.startDate);
      if (options.endDate) query.receivedDate.$lte = new Date(options.endDate);
    }
    
    const grns = await GRN.find(query)
      .populate('locationId', 'name code type')
      .populate('supplier', 'name contactPerson')
      .sort({ receivedDate: -1 })
      .limit(options.limit || 100)
      .skip(options.skip || 0)
      .lean();
    
    return grns;
  } catch (error) {
    logger.error('Error getting GRNs by location:', error);
    throw error;
  }
};

/**
 * Get GRNs by supplier
 * @param {string} supplierId - Supplier ID
 * @param {string} companyId - Company ID
 * @param {Object} options - Query options (status, startDate, endDate, limit, skip)
 * @returns {Promise<Array>} Array of GRNs
 */
export const getGRNsBySupplier = async (supplierId, companyId, options = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);
    
    const query = { supplier: supplierId };
    
    if (options.status) {
      query.status = options.status;
    }
    
    if (options.startDate || options.endDate) {
      query.receivedDate = {};
      if (options.startDate) query.receivedDate.$gte = new Date(options.startDate);
      if (options.endDate) query.receivedDate.$lte = new Date(options.endDate);
    }
    
    const grns = await GRN.find(query)
      .populate('locationId', 'name code type')
      .populate('supplier', 'name contactPerson')
      .sort({ receivedDate: -1 })
      .limit(options.limit || 100)
      .skip(options.skip || 0)
      .lean();
    
    return grns;
  } catch (error) {
    logger.error('Error getting GRNs by supplier:', error);
    throw error;
  }
};

/**
 * Verify GRN
 * @param {string} grnId - GRN ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated GRN
 */
export const verifyGRN = async (grnId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);
    
    const grn = await GRN.findById(grnId);
    
    if (!grn) {
      throw new Error('GRN not found');
    }
    
    if (grn.status !== 'received') {
      throw new Error('Only received GRNs can be verified');
    }
    
    grn.status = 'verified';
    await grn.save();
    
    logger.info(`GRN verified: ${grnId}`);
    
    return grn;
  } catch (error) {
    logger.error('Error verifying GRN:', error);
    throw error;
  }
};

/**
 * Cancel GRN
 * @param {string} grnId - GRN ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated GRN
 */
export const cancelGRN = async (grnId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);
    
    const grn = await GRN.findById(grnId);
    
    if (!grn) {
      throw new Error('GRN not found');
    }
    
    if (grn.status === 'cancelled') {
      throw new Error('GRN is already cancelled');
    }
    
    grn.status = 'cancelled';
    await grn.save();
    
    logger.info(`GRN cancelled: ${grnId}`);
    
    return grn;
  } catch (error) {
    logger.error('Error cancelling GRN:', error);
    throw error;
  }
};
