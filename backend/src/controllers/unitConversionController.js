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
    const { ingredients, locationId } = req.body;

    if (!ingredients || !Array.isArray(ingredients)) {
      return res.status(400).json({
        success: false,
        message: 'Ingredients array is required'
      });
    }

    if (!locationId) {
      return res.status(400).json({
        success: false,
        message: 'Location ID is required'
      });
    }

    const results = await unitConversionService.calculateSmartConversions(
      ingredients,
      locationId,
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
    const { inventoryItemId, locationId, targetUnit } = req.body;

    if (!inventoryItemId) {
      return res.status(400).json({
        success: false,
        message: 'Inventory item ID is required'
      });
    }

    if (!locationId) {
      return res.status(400).json({
        success: false,
        message: 'Location ID is required'
      });
    }

    if (!targetUnit) {
      return res.status(400).json({
        success: false,
        message: 'Target unit is required'
      });
    }

    const suggestion = await unitConversionService.getConversionSuggestion(
      inventoryItemId,
      locationId,
      targetUnit,
      companyId
    );

    res.json({
      success: true,
      data: { suggestion }
    });
  } catch (error) {
    logger.error('Get conversion suggestion error', error);
    
    if (error.message === 'Inventory item not found at this location') {
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
