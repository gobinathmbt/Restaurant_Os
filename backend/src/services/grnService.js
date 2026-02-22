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
import { publishDomainEvent } from './domainEventService.js';
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
  
  // Generate date string
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Find all GRNs with today's date pattern in the number
  const todayPattern = new RegExp(`^GRN-${dateStr}-(\\d{4})$`);
  
  const existingGRNs = await GRN.find({
    grnNumber: todayPattern
  }).select('grnNumber').lean();
  
  // Extract all sequence numbers and find the max
  let maxSequence = 0;
  for (const grn of existingGRNs) {
    const match = grn.grnNumber.match(/-(\d{4})$/);
    if (match) {
      const seq = parseInt(match[1]);
      if (seq > maxSequence) {
        maxSequence = seq;
      }
    }
  }
  
  // Increment to get next sequence
  const nextSequence = maxSequence + 1;
  const sequenceStr = String(nextSequence).padStart(4, '0');
  
  const grnNumber = `GRN-${dateStr}-${sequenceStr}`;
  
  console.log('🔢 [GRN] Number generation:', {
    date: dateStr,
    existingCount: existingGRNs.length,
    maxSequence,
    nextSequence,
    generated: grnNumber
  });
  
  return grnNumber;
};

/**
 * Create GRN with batch tracking and ledger integration
 * GRN is ONLY for supplier procurement (financial document)
 * For internal warehouse transfers, use StockTransfer model
 * 
 * Implements Requirements: 8.1, 8.2, 8.4, 8.5, 17.2, 16.1, 25.1, 25.6
 * 
 * @param {Object} grnData - GRN data
 * @param {string} grnData.locationId - Location ID receiving the goods
 * @param {string} grnData.supplierId - Supplier ID (REQUIRED - this is procurement)
 * @param {string} grnData.purchaseOrder - Optional purchase order reference
 * @param {Array} grnData.items - Array of items with quantity, unitPrice, batchNumber, expiryDate
 * @param {string} grnData.receivedDate - Date received
 * @param {string} grnData.invoiceNumber - Invoice number
 * @param {Date} grnData.invoiceDate - Invoice date
 * @param {string} grnData.paymentTerms - Payment terms
 * @param {string} grnData.notes - Optional notes
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID performing the operation
 * @returns {Promise<Object>} Created GRN
 */
export const createGRNWithBatches = async (grnData, companyId, userId) => {
  const companyDB = getCompanyDB(companyId);
  
  console.log('🚀 [GRN] Starting GRN creation:', {
    locationId: grnData.locationId,
    supplierId: grnData.supplierId,
    itemCount: grnData.items?.length,
    companyId,
    userId
  });
  
  // Validate required fields
  if (!grnData.locationId) {
    throw new Error('Location ID is required');
  }
  
  if (!grnData.supplierId) {
    throw new Error('Supplier ID is required. GRN is only for supplier procurement. Use StockTransfer for internal movements.');
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
  // GRN is ONLY for direct supplier procurement
  console.log('🔐 [GRN] Validating location capability');
  const canProcure = await validateCapability(grnData.locationId, 'canProcureDirectly', companyId);
  if (!canProcure) {
    console.error('❌ [GRN] Location does not have procurement capability');
    const error = new Error('Location does not have permission to procure directly from suppliers. Use StockTransfer for internal movements.');
    error.statusCode = 403;
    throw error;
  }
  console.log('✅ [GRN] Location capability validated');
  
  // Execute with transaction and retry logic
  console.log('🔄 [GRN] Starting transaction');
  const grn = await withTransactionAndRetry(
    companyDB,
    async (session) => {
      const GRN = getGRNModel(companyDB);
      const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
      
      // Generate GRN number
      const grnNumber = await generateGRNNumber(companyId, grnData.locationId);
      console.log('🔢 [GRN] Generated GRN number:', grnNumber);
      
      // Calculate line item totals
      const items = grnData.items.map(item => ({
        ...item,
        quantity: Number(item.quantity), // Ensure quantity is a number
        unitPrice: Number(item.unitPrice), // Ensure unitPrice is a number
        totalPrice: Number(item.quantity) * Number(item.unitPrice)
      }));
      
      console.log('💰 [GRN] Calculated totals:', {
        itemCount: items.length,
        totalAmount: items.reduce((sum, item) => sum + item.totalPrice, 0)
      });
      
      // Create GRN document
      const grnDoc = {
        grnNumber,
        locationId: grnData.locationId,
        branch: grnData.locationId, // Set branch to locationId for backward compatibility with legacy index
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
      
      console.log('📄 [GRN] Creating GRN document');
      
      // Create GRN (with or without session)
      const grnArray = session 
        ? await GRN.create([grnDoc], { session })
        : await GRN.create([grnDoc]);
      const createdGrn = grnArray[0];
      
      console.log('✅ [GRN] GRN document created:', {
        id: createdGrn._id,
        grnNumber: createdGrn.grnNumber,
        totalAmount: createdGrn.totalAmount
      });
      
      // Requirement 17.2: For each item, create or update InventoryBatchLocation
      // Requirement 8.5: Update InventoryItemLocation availableQuantity
      // Requirement 16.1: Record ledger entry with GRN reference
      console.log('🔄 [GRN] Starting inventory updates for', items.length, 'items');
      
      for (const item of items) {
        console.log('📦 [GRN] Processing item:', {
          inventoryItem: item.inventoryItem,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          locationId: grnData.locationId
        });
        
        // Get or create InventoryItemLocation
        let query = InventoryItemLocation.findOne({
          inventoryItem: item.inventoryItem,
          locationId: grnData.locationId
        });
        
        // Add session only if available
        if (session) {
          query = query.session(session);
        }
        
        let inventoryItemLocation = await query;
        
        console.log('📊 [GRN] Current inventory state:', {
          found: !!inventoryItemLocation,
          currentQuantity: inventoryItemLocation?.availableQuantity || 0
        });
        
        if (!inventoryItemLocation) {
          console.log('➕ [GRN] Creating new InventoryItemLocation');
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
          
          const result = session
            ? await InventoryItemLocation.create([newInventoryItemLocation], { session })
            : await InventoryItemLocation.create([newInventoryItemLocation]);
          inventoryItemLocation = result[0];
          console.log('✅ [GRN] Created InventoryItemLocation:', inventoryItemLocation._id);
        }
        
        // Store before state for ledger
        const beforeAvailable = inventoryItemLocation.availableQuantity;
        const beforeReserved = inventoryItemLocation.reservedQuantity;
        const beforeInTransit = inventoryItemLocation.inTransitQuantity;
        
        // Ensure quantity is a number (safety check)
        const quantityToAdd = Number(item.quantity);
        if (isNaN(quantityToAdd)) {
          console.error('❌ [GRN] Invalid quantity:', item.quantity);
          throw new Error(`Invalid quantity for item ${item.inventoryItem}: ${item.quantity}`);
        }
        
        // Update availableQuantity
        inventoryItemLocation.availableQuantity = Number(inventoryItemLocation.availableQuantity) + quantityToAdd;
        inventoryItemLocation.lastPurchasePrice = Number(item.unitPrice);
        inventoryItemLocation.lastPurchaseDate = createdGrn.receivedDate;
        inventoryItemLocation.supplier = grnData.supplierId;
        inventoryItemLocation.version += 1;
        
        // Warn if quantity seems suspiciously large (possible data corruption)
        if (inventoryItemLocation.availableQuantity > 100000000) {
          console.warn('⚠️  [GRN] WARNING: Suspiciously large quantity detected:', {
            itemId: item.inventoryItem,
            quantity: inventoryItemLocation.availableQuantity,
            message: 'This might indicate data corruption from string concatenation'
          });
        }
        
        console.log('📈 [GRN] Updating inventory:', {
          before: beforeAvailable,
          adding: quantityToAdd,
          after: inventoryItemLocation.availableQuantity
        });
        
        // Save with or without session
        if (session) {
          await inventoryItemLocation.save({ session });
        } else {
          await inventoryItemLocation.save();
        }
        
        console.log('💾 [GRN] Saved inventory update');
        
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
        
        console.log('🏷️ [GRN] Creating/updating batch:', batchData.batchNumber);
        await createOrUpdateBatch(batchData, companyId);
        console.log('✅ [GRN] Batch created/updated');
        
        // Record ledger entry
        console.log('📝 [GRN] Recording ledger entry');
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
        console.log('✅ [GRN] Ledger entry recorded');
      }
      
      console.log('✅ [GRN] All inventory updates completed successfully');
      
      return createdGrn;
    },
    {
      operationName: 'Create GRN with batches',
      maxRetries: 3
    }
  );
  
  console.log('✅ [GRN] Transaction completed successfully:', {
    grnId: grn._id,
    grnNumber: grn.grnNumber
  });
  
  // Publish domain event
  await publishDomainEvent(companyDB, {
    eventType: 'GRN_CREATED',
    entityType: 'GRN',
    entityId: grn._id,
    payload: {
      grnNumber: grn.grnNumber,
      locationId: grn.locationId,
      supplierId: grn.supplier,
      itemCount: grn.items.length,
      totalAmount: grn.totalAmount
    },
    userId: userId,
    locationId: grn.locationId
  }, companyId);
  
  logger.info(`GRN created with batches: ${grn._id} (${grn.grnNumber}) for location: ${grnData.locationId}, supplier: ${grnData.supplierId}, company: ${companyId}`);
  
  // Send notifications asynchronously (don't block GRN creation)
  setImmediate(async () => {
    try {
      // Get GRN model to fetch populated details
      const GRN = getGRNModel(companyDB);
      
      // Populate GRN details for notification
      const populatedGRN = await GRN.findById(grn._id)
        .populate('locationId', 'name code address')
        .populate('branch', 'name code address')
        .populate('supplier', 'name contactPerson phone email')
        .populate('items.inventoryItem', 'name')
        .lean();

      // Manually populate receivedBy from platform database
      if (populatedGRN.receivedBy) {
        const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
        const user = await CompanyUser.findById(populatedGRN.receivedBy).select('name email').lean();
        if (user) {
          populatedGRN.receivedBy = {
            _id: user._id,
            name: user.name,
            email: user.email
          };
        }
      }

      // Import and call notification service
      const notificationService = (await import('./notificationService.js')).default;
      
      // Send notifications (in-app + email to super admins + supplier)
      await notificationService.notifyGRNCreation(companyId, populatedGRN);
      logger.info(`GRN notifications sent successfully for ${grn.grnNumber}`);
    } catch (notificationError) {
      // Log but don't throw - notification failures shouldn't affect GRN creation
      logger.error('Error sending GRN notifications:', notificationError);
    }
  });
  
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
      .populate('locationId', 'name code type address')
      .populate('branch', 'name code type address')
      .populate('supplier', 'name contactPerson phone email')
      .populate('items.inventoryItem', 'name code unit')
      .lean();
    
    if (!grn) {
      throw new Error('GRN not found');
    }
    
    // Manually populate receivedBy from platform database
    if (grn.receivedBy) {
      const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
      const user = await CompanyUser.findById(grn.receivedBy).select('name email').lean();
      if (user) {
        grn.receivedBy = {
          _id: user._id,
          name: user.name,
          email: user.email
        };
      }
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
      .populate('branch', 'name code type')
      .populate('supplier', 'name contactPerson')
      .sort({ receivedDate: -1 })
      .limit(options.limit || 100)
      .skip(options.skip || 0)
      .lean();
    
    // Manually populate receivedBy from platform database for each GRN
    const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
    for (const grn of grns) {
      if (grn.receivedBy) {
        const user = await CompanyUser.findById(grn.receivedBy).select('name email').lean();
        if (user) {
          grn.receivedBy = {
            _id: user._id,
            name: user.name,
            email: user.email
          };
        }
      }
    }
    
    return grns;
  } catch (error) {
    logger.error('Error getting GRNs by location:', error);
    throw error;
  }
};

/**
 * Get count of GRNs by location
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @param {Object} options - Query options (status, startDate, endDate)
 * @returns {Promise<number>} Count of GRNs
 */
export const getGRNsCountByLocation = async (locationId, companyId, options = {}) => {
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
    
    const count = await GRN.countDocuments(query);
    
    return count;
  } catch (error) {
    logger.error('Error getting GRNs count by location:', error);
    throw error;
  }
};

/**
 * Get all GRNs across all locations
 * @param {string} companyId - Company ID
 * @param {Object} options - Query options (status, startDate, endDate, search, limit, skip)
 * @returns {Promise<Object>} Object with grns array and total count
 */
export const getAllGRNs = async (companyId, options = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const GRN = getGRNModel(companyDB);
    
    const query = {};
    
    if (options.status) {
      query.status = options.status;
    }
    
    if (options.startDate || options.endDate) {
      query.receivedDate = {};
      if (options.startDate) query.receivedDate.$gte = new Date(options.startDate);
      if (options.endDate) query.receivedDate.$lte = new Date(options.endDate);
    }
    
    // Search across grnNumber and supplier name
    if (options.search) {
      query.$or = [
        { grnNumber: { $regex: options.search, $options: 'i' } }
      ];
    }
    
    const [grns, total] = await Promise.all([
      GRN.find(query)
        .populate('locationId', 'name code type')
        .populate('branch', 'name code type')
        .populate('supplier', 'name contactPerson')
        .sort({ receivedDate: -1 })
        .limit(options.limit || 100)
        .skip(options.skip || 0)
        .lean(),
      GRN.countDocuments(query)
    ]);
    
    // Manually populate receivedBy from platform database for each GRN
    const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
    for (const grn of grns) {
      if (grn.receivedBy) {
        const user = await CompanyUser.findById(grn.receivedBy).select('name email').lean();
        if (user) {
          grn.receivedBy = {
            _id: user._id,
            name: user.name,
            email: user.email
          };
        }
      }
    }
    
    return { grns, total };
  } catch (error) {
    logger.error('Error getting all GRNs:', error);
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
      .populate('branch', 'name code type')
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

// Remove getGRNsByWarehouse - use StockTransfer instead

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
