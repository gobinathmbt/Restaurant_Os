/**
 * Unit Conversion Controller
 * HTTP request handlers for unit conversion endpoints
 */

import * as unitConversionService from '../services/unitConversionService.js';
import { logger } from '../utils/logger.js';

/**
 * Calculate smart conversions for recipe ingredients
 * POST /api/unit-conversion/calculate
 */
export const calculateSmartConversions = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { ingredients, branchId } = req.body;

    if (!ingredients || !Array.isArray(ingredients)) {
      return res.status(400).json({
        success: false,
        message: 'Ingredients array is required'
      });
    }

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    const results = await unitConversionService.calculateSmartConversions(
      ingredients,
      branchId,
      companyId
    );

    res.json({
      success: true,
      data: { conversions: results }
    });
  } catch (error) {
    logger.error('Calculate smart conversions error', error);
    next(error);
  }
};

/**
 * Get conversion suggestion for specific ingredient
 * POST /api/unit-conversion/suggest
 */
export const getConversionSuggestion = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { inventoryItemBranchId, targetUnit } = req.body;

    if (!inventoryItemBranchId) {
      return res.status(400).json({
        success: false,
        message: 'Inventory item branch ID is required'
      });
    }

    if (!targetUnit) {
      return res.status(400).json({
        success: false,
        message: 'Target unit is required'
      });
    }

    const suggestion = await unitConversionService.getConversionSuggestion(
      inventoryItemBranchId,
      targetUnit,
      companyId
    );

    res.json({
      success: true,
      data: { suggestion }
    });
  } catch (error) {
    logger.error('Get conversion suggestion error', error);
    
    if (error.message === 'Inventory item not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

export default {
  calculateSmartConversions,
  getConversionSuggestion,
};
