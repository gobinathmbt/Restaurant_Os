/**
 * Unit Conversion Service
 * Business logic for unit conversion operations in recipes
 */

import { getCompanyDB } from '../config/database.js';
import { getInventoryItemBranchModel } from '../models/company/InventoryItemBranch.js';
import { logger } from '../utils/logger.js';
import * as unitConversion from '../utils/unitConversion.js';

/**
 * Calculate smart conversion for recipe ingredients
 * @param {Array} ingredients - Array of ingredient objects with inventoryItemBranch IDs
 * @param {string} branchId - Branch ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Array of ingredients with conversion calculations
 */
export const calculateSmartConversions = async (ingredients, branchId, companyId) => {
  try {
    console.log('🔧 calculateSmartConversions called', {
      ingredientsCount: ingredients.length,
      branchId,
      companyId,
    });

    const companyDB = getCompanyDB(companyId);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);

    const results = [];

    for (const ingredient of ingredients) {
      console.log('📦 Processing ingredient:', ingredient);

      // Fetch inventory item branch details
      const inventoryItemBranch = await InventoryItemBranch.findById(
        ingredient.inventoryItemBranch
      ).populate('inventoryItem');

      if (!inventoryItemBranch) {
        console.error('❌ Inventory item not found:', ingredient.inventoryItemBranch);
        results.push({
          ...ingredient,
          error: 'Inventory item not found',
          conversionPossible: false,
        });
        continue;
      }

      const inventoryUnit = inventoryItemBranch.inventoryItem.unit;
      const inventoryPrice = inventoryItemBranch.costPrice || 0;
      const recipeUnit = ingredient.unit;
      const recipeQuantity = ingredient.quantity;
      const manualConversionFactor = ingredient.conversionFactor;

      console.log('💡 Conversion details:', {
        inventoryUnit,
        inventoryPrice,
        recipeUnit,
        recipeQuantity,
        manualConversionFactor,
      });

      // Calculate cost with unit conversion
      const costCalc = unitConversion.calculateIngredientCost(
        recipeQuantity,
        recipeUnit,
        inventoryPrice,
        inventoryUnit,
        manualConversionFactor
      );

      console.log('💰 Cost calculation result:', costCalc);

      // Get conversion suggestion
      const suggestion = unitConversion.suggestConversionFactor(inventoryUnit, recipeUnit);

      const result = {
        inventoryItemBranch: ingredient.inventoryItemBranch,
        inventoryItemName: inventoryItemBranch.inventoryItem.name,
        quantity: recipeQuantity,
        unit: recipeUnit,
        inventoryUnit,
        inventoryPrice,
        ...costCalc,
        suggestion,
        currentConversionFactor: manualConversionFactor,
        currentOverrideCost: ingredient.overrideCostPerUnit,
      };

      console.log('✅ Ingredient result:', result);
      results.push(result);
    }

    logger.info(`Smart conversion calculated for ${results.length} ingredients in branch ${branchId}`);
    console.log('🎉 All conversions calculated:', results);

    return results;
  } catch (error) {
    console.error('❌ Error calculating smart conversions:', error);
    logger.error('Error calculating smart conversions:', error);
    throw error;
  }
};

/**
 * Apply conversion factors to ingredients
 * @param {Array} ingredients - Array of ingredients with conversion data
 * @returns {Array} Updated ingredients with applied conversions
 */
export const applyConversionFactors = (ingredients) => {
  return ingredients.map(ingredient => {
    const {
      inventoryItemBranch,
      quantity,
      unit,
      conversionFactor,
      overrideCostPerUnit,
    } = ingredient;

    const result = {
      inventoryItemBranch,
      quantity,
      unit,
    };

    // Add conversion factor if provided
    if (conversionFactor !== undefined && conversionFactor !== null && conversionFactor > 0) {
      result.conversionFactor = conversionFactor;
    }

    // Add override cost if provided
    if (overrideCostPerUnit !== undefined && overrideCostPerUnit !== null && overrideCostPerUnit >= 0) {
      result.overrideCostPerUnit = overrideCostPerUnit;
    }

    return result;
  });
};

/**
 * Validate conversion factor
 * @param {number} factor - Conversion factor to validate
 * @returns {boolean} Whether factor is valid
 */
export const validateConversionFactor = (factor) => {
  return typeof factor === 'number' && factor > 0 && isFinite(factor);
};

/**
 * Get conversion suggestions for ingredient
 * @param {string} inventoryItemBranchId - Inventory item branch ID
 * @param {string} targetUnit - Target unit for recipe
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Conversion suggestion
 */
export const getConversionSuggestion = async (inventoryItemBranchId, targetUnit, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);

    const inventoryItemBranch = await InventoryItemBranch.findById(inventoryItemBranchId)
      .populate('inventoryItem');

    if (!inventoryItemBranch) {
      throw new Error('Inventory item not found');
    }

    const inventoryUnit = inventoryItemBranch.inventoryItem.unit;
    const suggestion = unitConversion.suggestConversionFactor(inventoryUnit, targetUnit);

    return {
      inventoryUnit,
      targetUnit,
      ...suggestion,
    };
  } catch (error) {
    logger.error('Error getting conversion suggestion:', error);
    throw error;
  }
};

export default {
  calculateSmartConversions,
  applyConversionFactors,
  validateConversionFactor,
  getConversionSuggestion,
};
