/**
 * Unit Conversion Utility
 * Handles automatic and manual unit conversions for recipe ingredients
 */

/**
 * Unit conversion factors
 * Base unit for weight: gram
 * Base unit for volume: ml
 */
const CONVERSION_FACTORS = {
  // Weight conversions (base: gram)
  weight: {
    kg: 1000,
    gram: 1,
    g: 1,
  },
  // Volume conversions (base: ml)
  volume: {
    liter: 1000,
    l: 1000,
    ml: 1,
  },
  // Count-based units (no conversion between different types)
  count: {
    piece: 1,
    dozen: 12,
    packet: 1,
    serving: 1,
  }
};

/**
 * Unit categories mapping
 */
const UNIT_CATEGORIES = {
  kg: 'weight',
  gram: 'weight',
  g: 'weight',
  liter: 'volume',
  l: 'volume',
  ml: 'volume',
  piece: 'count',
  dozen: 'count',
  packet: 'count',
  serving: 'count',
};

/**
 * Get the category of a unit
 * @param {string} unit - Unit to categorize
 * @returns {string|null} Category or null if unknown
 */
export const getUnitCategory = (unit) => {
  return UNIT_CATEGORIES[unit.toLowerCase()] || null;
};

/**
 * Check if two units are compatible for conversion
 * @param {string} fromUnit - Source unit
 * @param {string} toUnit - Target unit
 * @returns {boolean} Whether units can be converted
 */
export const areUnitsCompatible = (fromUnit, toUnit) => {
  const fromCategory = getUnitCategory(fromUnit);
  const toCategory = getUnitCategory(toUnit);
  
  if (!fromCategory || !toCategory) {
    return false;
  }
  
  return fromCategory === toCategory;
};

/**
 * Convert quantity from one unit to another
 * @param {number} quantity - Quantity to convert
 * @param {string} fromUnit - Source unit
 * @param {string} toUnit - Target unit
 * @returns {number|null} Converted quantity or null if conversion not possible
 */
export const convertUnit = (quantity, fromUnit, toUnit) => {
  // Normalize unit names
  const from = fromUnit.toLowerCase();
  const to = toUnit.toLowerCase();
  
  // Same unit, no conversion needed
  if (from === to) {
    return quantity;
  }
  
  // Check if units are compatible
  if (!areUnitsCompatible(from, to)) {
    return null;
  }
  
  const category = getUnitCategory(from);
  const conversionTable = CONVERSION_FACTORS[category];
  
  // Convert to base unit, then to target unit
  const baseQuantity = quantity * conversionTable[from];
  const convertedQuantity = baseQuantity / conversionTable[to];
  
  return convertedQuantity;
};

/**
 * Calculate conversion factor between two units
 * @param {string} fromUnit - Source unit
 * @param {string} toUnit - Target unit
 * @returns {number|null} Conversion factor or null if not compatible
 */
export const getConversionFactor = (fromUnit, toUnit) => {
  return convertUnit(1, fromUnit, toUnit);
};

/**
 * Convert price per unit
 * @param {number} pricePerUnit - Price per source unit
 * @param {string} fromUnit - Source unit
 * @param {string} toUnit - Target unit
 * @returns {number|null} Converted price or null if conversion not possible
 */
export const convertPrice = (pricePerUnit, fromUnit, toUnit) => {
  const conversionFactor = getConversionFactor(fromUnit, toUnit);
  
  if (conversionFactor === null) {
    return null;
  }
  
  // Price conversion is inverse of quantity conversion
  // If 1 kg = 1000 g, then price per gram = price per kg / 1000
  return pricePerUnit / conversionFactor;
};

/**
 * Calculate ingredient cost with unit conversion
 * @param {number} quantity - Quantity needed in recipe
 * @param {string} recipeUnit - Unit used in recipe
 * @param {number} inventoryPrice - Price per inventory unit
 * @param {string} inventoryUnit - Unit used in inventory
 * @param {number} manualConversionFactor - Optional manual conversion factor
 * @returns {Object} Cost calculation result
 */
export const calculateIngredientCost = (
  quantity,
  recipeUnit,
  inventoryPrice,
  inventoryUnit,
  manualConversionFactor = null
) => {
  let conversionFactor;
  let convertedPrice;
  let totalCost;
  let conversionMethod;
  
  // Use manual conversion factor if provided
  if (manualConversionFactor !== null && manualConversionFactor > 0) {
    conversionFactor = manualConversionFactor;
    convertedPrice = inventoryPrice / conversionFactor;
    totalCost = quantity * convertedPrice;
    conversionMethod = 'manual';
  } else {
    // Try automatic conversion
    conversionFactor = getConversionFactor(inventoryUnit, recipeUnit);
    
    if (conversionFactor !== null) {
      convertedPrice = convertPrice(inventoryPrice, inventoryUnit, recipeUnit);
      totalCost = quantity * convertedPrice;
      conversionMethod = 'automatic';
    } else {
      // No conversion possible, use direct multiplication
      convertedPrice = inventoryPrice;
      totalCost = quantity * inventoryPrice;
      conversionMethod = 'direct';
      conversionFactor = 1;
    }
  }
  
  return {
    quantity,
    recipeUnit,
    inventoryPrice,
    inventoryUnit,
    conversionFactor,
    convertedPrice,
    totalCost,
    conversionMethod,
    isCompatible: conversionMethod !== 'direct' || recipeUnit === inventoryUnit,
  };
};

/**
 * Batch calculate costs for multiple ingredients
 * @param {Array} ingredients - Array of ingredient objects
 * @returns {Array} Array of cost calculation results
 */
export const batchCalculateIngredientCosts = (ingredients) => {
  return ingredients.map(ingredient => {
    const {
      quantity,
      unit: recipeUnit,
      inventoryPrice,
      inventoryUnit,
      manualConversionFactor,
    } = ingredient;
    
    return calculateIngredientCost(
      quantity,
      recipeUnit,
      inventoryPrice,
      inventoryUnit,
      manualConversionFactor
    );
  });
};

/**
 * Suggest conversion factor based on common conversions
 * @param {string} fromUnit - Source unit
 * @param {string} toUnit - Target unit
 * @returns {Object} Suggestion with factor and confidence
 */
export const suggestConversionFactor = (fromUnit, toUnit) => {
  const autoFactor = getConversionFactor(fromUnit, toUnit);
  
  if (autoFactor !== null) {
    return {
      factor: autoFactor,
      confidence: 'high',
      method: 'automatic',
      description: `1 ${fromUnit} = ${autoFactor} ${toUnit}`,
    };
  }
  
  // For incompatible units, suggest manual entry
  return {
    factor: null,
    confidence: 'none',
    method: 'manual_required',
    description: `Cannot automatically convert ${fromUnit} to ${toUnit}. Please enter conversion factor manually.`,
  };
};

export default {
  getUnitCategory,
  areUnitsCompatible,
  convertUnit,
  getConversionFactor,
  convertPrice,
  calculateIngredientCost,
  batchCalculateIngredientCosts,
  suggestConversionFactor,
};
