/**
 * Capacity Validator Service
 * Validates receiving quantities against maximum stock capacity
 */

import { logger } from '../utils/logger.js';

class CapacityValidator {
  constructor(companyDB) {
    this.companyDB = companyDB;
  }

  /**
   * Validate GRN capacity for all line items
   * @param {string} branchId - Branch/Location ID
   * @param {Array} items - Array of line items with inventoryItem and quantity
   * @param {Object} session - MongoDB session for transactions (optional)
   * @returns {Promise<Object>} Validation result { valid: boolean, errors: Array<string> }
   */
  async validateGRNCapacity(branchId, items, session = null) {
    try {
      const { getInventoryItemLocationModel } = await import('../models/company/InventoryItemLocation.js');
      const InventoryItemLocation = getInventoryItemLocationModel(this.companyDB);
      const { getInventoryItemModel } = await import('../models/company/InventoryItem.js');
      const InventoryItem = getInventoryItemModel(this.companyDB);

      const errors = [];

      // Validate each line item
      for (const item of items) {
        const result = await this.checkItemCapacity(
          branchId,
          item.inventoryItem,
          item.quantity,
          session
        );

        if (!result.valid) {
          // Fetch item name for better error message
          const inventoryItemQuery = InventoryItem.findById(item.inventoryItem).select('name');
          if (session) inventoryItemQuery.session(session);
          const inventoryItem = await inventoryItemQuery;
          
          const itemName = inventoryItem ? inventoryItem.name : item.inventoryItem;
          
          errors.push(
            `${itemName}: Receiving ${result.receivingQuantity} units would exceed maximum capacity. ` +
            `Current stock: ${result.currentStock}, Maximum: ${result.maxStock}, ` +
            `Projected: ${result.projectedStock}`
          );
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      logger.error('Error validating GRN capacity:', error);
      throw error;
    }
  }

  /**
   * Validate stock adjustment capacity for increase type
   * @param {string} branchId - Branch/Location ID
   * @param {string} inventoryItemId - Inventory item ID
   * @param {number} adjustmentQuantity - Quantity being added
   * @param {Object} session - MongoDB session for transactions (optional)
   * @returns {Promise<Object>} Validation result with stock details
   */
  async validateAdjustmentCapacity(branchId, inventoryItemId, adjustmentQuantity, session = null) {
    try {
      const { getInventoryItemLocationModel } = await import('../models/company/InventoryItemLocation.js');
      const InventoryItemLocation = getInventoryItemLocationModel(this.companyDB);

      // Fetch inventory item location configuration (branchId is actually locationId)
      const inventoryItemLocationQuery = InventoryItemLocation.findOne({
        inventoryItem: inventoryItemId,
        locationId: branchId
      });
      if (session) inventoryItemLocationQuery.session(session);
      
      const inventoryItemLocation = await inventoryItemLocationQuery;

      if (!inventoryItemLocation) {
        throw new Error(`Inventory item ${inventoryItemId} not found for location ${branchId}`);
      }

      const currentStock = inventoryItemLocation.availableQuantity || 0;
      const maxStock = inventoryItemLocation.maximumStock;
      const projectedStock = currentStock + adjustmentQuantity;

      // If no maximum stock is set or maximum is 0, validation passes
      if (!maxStock || maxStock === 0) {
        return {
          valid: true,
          currentStock,
          maxStock: null,
          projectedStock,
          adjustmentQuantity
        };
      }

      // Check if projected stock exceeds maximum
      const valid = projectedStock <= maxStock;

      return {
        valid,
        currentStock,
        maxStock,
        projectedStock,
        adjustmentQuantity,
        error: valid ? null : `Adjustment would exceed maximum stock capacity. Current: ${currentStock}, Maximum: ${maxStock}, Projected: ${projectedStock}`
      };
    } catch (error) {
      logger.error('Error validating adjustment capacity:', error);
      throw error;
    }
  }

  /**
   * Check capacity for a single inventory item
   * @param {string} branchId - Branch/Location ID
   * @param {string} inventoryItemId - Inventory item ID
   * @param {number} receivingQuantity - Quantity being received
   * @param {Object} session - MongoDB session for transactions (optional)
   * @returns {Promise<Object>} Validation result with stock details
   */
  async checkItemCapacity(branchId, inventoryItemId, receivingQuantity, session = null) {
    try {
      const { getInventoryItemLocationModel } = await import('../models/company/InventoryItemLocation.js');
      const InventoryItemLocation = getInventoryItemLocationModel(this.companyDB);

      // Fetch inventory item location configuration (branchId is actually locationId)
      const inventoryItemLocationQuery = InventoryItemLocation.findOne({
        inventoryItem: inventoryItemId,
        locationId: branchId
      });
      if (session) inventoryItemLocationQuery.session(session);
      
      const inventoryItemLocation = await inventoryItemLocationQuery;

      if (!inventoryItemLocation) {
        throw new Error(`Inventory item ${inventoryItemId} not found for location ${branchId}`);
      }

      const currentStock = inventoryItemLocation.availableQuantity || 0;
      const maxStock = inventoryItemLocation.maximumStock;
      const projectedStock = currentStock + receivingQuantity;

      // If no maximum stock is set, validation passes
      if (!maxStock || maxStock === 0) {
        return {
          valid: true,
          currentStock,
          maxStock: null,
          projectedStock,
          receivingQuantity
        };
      }

      // Check if projected stock exceeds maximum
      const valid = projectedStock <= maxStock;

      return {
        valid,
        currentStock,
        maxStock,
        projectedStock,
        receivingQuantity
      };
    } catch (error) {
      logger.error('Error checking item capacity:', error);
      throw error;
    }
  }


}

export default CapacityValidator;
