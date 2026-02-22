/**
 * Recipe Branch Service
 * Business logic for branch-specific recipe configuration operations
 */

import { getCompanyDB } from '../config/database.js';
import { getRecipeModel } from '../models/company/Recipe.js';
import { getRecipeBranchModel } from '../models/company/RecipeBranch.js';
import { getLocationModel } from '../models/company/Location.js';
import { getInventoryItemLocationModel } from '../models/company/InventoryItemLocation.js';
import { getInventoryItemModel } from '../models/company/InventoryItem.js';
import { logger } from '../utils/logger.js';

/**
 * Helper function to populate recipe branch with proper model references
 * @param {Object} recipeBranch - RecipeBranch document
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<Object>} Populated recipe branch
 */
const populateRecipeBranch = async (recipeBranch, companyDB) => {
  const Recipe = getRecipeModel(companyDB);
  const Branch = getLocationModel(companyDB);
  const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
  const InventoryItem = getInventoryItemModel(companyDB);

  await recipeBranch.populate({
    path: 'recipe',
    model: Recipe
  });
  
  await recipeBranch.populate({
    path: 'branch',
    model: Branch
  });
  
  await recipeBranch.populate({
    path: 'ingredients.inventoryItem',
    model: InventoryItem
  });

  // Manually fetch location configs for each ingredient
  if (recipeBranch.ingredients && recipeBranch.ingredients.length > 0) {
    for (const ingredient of recipeBranch.ingredients) {
      if (ingredient.inventoryItem && ingredient.locationId) {
        const locationConfig = await InventoryItemLocation.findOne({
          inventoryItem: ingredient.inventoryItem._id,
          locationId: ingredient.locationId
        }).lean();
        
        ingredient.locationConfig = locationConfig;
      }
    }
  }

  return recipeBranch;
};

/**
 * Validate branch access based on user role
 * @param {string} branchId - Branch ID to validate
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {boolean} Whether user has access
 */
const validateBranchAccess = (branchId, userBranchIds) => {
  // Super admin has access to all branches
  if (userBranchIds === null || userBranchIds === undefined) {
    return true;
  }

  // Check if branch is in user's accessible branches
  return userBranchIds.includes(branchId.toString());
};

/**
 * Validate ingredient location reference and auto-assign if needed
 * @param {string} inventoryItemId - InventoryItem ID
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @returns {Promise<boolean>} Whether ingredient location config exists
 * @throws {Error} If validation fails
 */
export const validateIngredientLocation = async (inventoryItemId, locationId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB);

    // Check if inventory item exists
    const inventoryItem = await InventoryItem.findById(inventoryItemId);
    
    if (!inventoryItem) {
      throw new Error(`InventoryItem ${inventoryItemId} not found`);
    }

    // Check if location config exists
    let inventoryItemLocation = await InventoryItemLocation.findOne({
      inventoryItem: inventoryItemId,
      locationId: locationId
    });

    if (!inventoryItemLocation) {
      // Auto-create location configuration for this inventory item
      logger.info(`Auto-assigning inventory item ${inventoryItemId} to location ${locationId}`);
      
      inventoryItemLocation = new InventoryItemLocation({
        inventoryItem: inventoryItemId,
        locationId: locationId,
        availableQuantity: 0,
        reservedQuantity: 0,
        inTransitQuantity: 0,
        minimumStock: 0,
        costingMethod: 'FIFO',
        isActive: true
      });

      await inventoryItemLocation.save();
      logger.info(`Created new location config for inventory item ${inventoryItemId} in location ${locationId}`);
    }

    return true;
  } catch (error) {
    logger.error('Error validating ingredient location:', error);
    throw error;
  }
};

/**
 * Validate ingredients array
 * @param {Array} ingredients - Array of ingredients to validate
 * @throws {Error} If validation fails
 */
const validateIngredients = (ingredients) => {
  if (!Array.isArray(ingredients)) {
    throw new Error('Ingredients must be an array');
  }

  for (const ingredient of ingredients) {
    if (!ingredient.inventoryItem) {
      throw new Error('Each ingredient must have an inventoryItem reference');
    }

    if (!ingredient.locationId) {
      throw new Error('Each ingredient must have a locationId reference');
    }

    if (typeof ingredient.quantity !== 'number' || ingredient.quantity <= 0) {
      throw new Error('Each ingredient must have a quantity greater than zero');
    }

    if (!ingredient.unit || typeof ingredient.unit !== 'string') {
      throw new Error('Each ingredient must have a valid unit');
    }
  }
};

/**
 * Validate yield object
 * @param {Object} yieldData - Yield object to validate
 * @throws {Error} If validation fails
 */
const validateYield = (yieldData) => {
  if (!yieldData || typeof yieldData !== 'object') {
    throw new Error('Yield must be an object');
  }

  if (typeof yieldData.quantity !== 'number' || yieldData.quantity <= 0) {
    throw new Error('Yield quantity must be greater than zero');
  }

  if (!yieldData.unit || typeof yieldData.unit !== 'string') {
    throw new Error('Yield must have a valid unit');
  }
};

/**
 * Create branch configuration for recipe
 * @param {string} recipeId - Recipe ID
 * @param {string} branchId - Branch ID
 * @param {Object} configData - Branch configuration data
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Created branch config
 */
export const createRecipeBranch = async (recipeId, branchId, configData, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Recipe = getRecipeModel(companyDB);
    const RecipeBranch = getRecipeBranchModel(companyDB);
    const Branch = getLocationModel(companyDB);

    // Validate branch access
    if (!validateBranchAccess(branchId, userBranchIds)) {
      throw new Error('You do not have access to this branch');
    }

    // Validate recipe exists
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    // Validate branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      throw new Error('Branch not found');
    }

    // Validate ingredients if provided
    if (configData.ingredients) {
      validateIngredients(configData.ingredients);
      
      // Validate each ingredient has location config
      for (const ingredient of configData.ingredients) {
        await validateIngredientLocation(ingredient.inventoryItem, ingredient.locationId, companyId);
      }
    }

    // Validate yield if provided
    if (configData.yield) {
      validateYield(configData.yield);
    }

    // Check if branch config already exists
    const existingConfig = await RecipeBranch.findOne({
      recipe: recipeId,
      branch: branchId
    });

    if (existingConfig) {
      throw new Error('Branch configuration already exists for this recipe');
    }

    // Create branch configuration
    const recipeBranch = new RecipeBranch({
      recipe: recipeId,
      branch: branchId,
      ...configData
    });

    await recipeBranch.save();

    logger.info(`RecipeBranch created for recipe: ${recipeId}, branch: ${branchId}, company: ${companyId}`);

    // Populate and return
    await populateRecipeBranch(recipeBranch, companyDB);

    return recipeBranch;
  } catch (error) {
    logger.error('Error creating RecipeBranch:', error);
    throw error;
  }
};

/**
 * Get branch configurations for recipe
 * @param {string} recipeId - Recipe ID
 * @param {Object} filters - Filter options (branchId, isActive)
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Array>} Branch configurations
 */
export const getRecipeBranches = async (recipeId, filters = {}, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const RecipeBranch = getRecipeBranchModel(companyDB);

    // Build query
    const query = {
      recipe: recipeId
    };

    // Apply branch filter
    if (filters.branchId) {
      // Validate branch access
      if (!validateBranchAccess(filters.branchId, userBranchIds)) {
        throw new Error('You do not have access to this branch');
      }
      query.branch = filters.branchId;
    } else if (userBranchIds !== null && userBranchIds !== undefined) {
      // Filter by user's accessible branches
      query.branch = { $in: userBranchIds };
    }

    // Apply isActive filter
    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive === 'true' || filters.isActive === true;
    }

    // Query RecipeBranch
    const Recipe = getRecipeModel(companyDB);
    const Branch = getLocationModel(companyDB);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB);

    const recipeBranches = await RecipeBranch.find(query)
      .populate({
        path: 'recipe',
        model: Recipe
      })
      .populate({
        path: 'branch',
        model: Branch
      })
      .populate({
        path: 'ingredients.inventoryItem',
        model: InventoryItem
      })
      .lean();

    // For each recipe branch, fetch location configs for ingredients
    for (const rb of recipeBranches) {
      if (rb.ingredients && rb.ingredients.length > 0) {
        for (const ingredient of rb.ingredients) {
          if (ingredient.inventoryItem && ingredient.locationId) {
            const locationConfig = await InventoryItemLocation.findOne({
              inventoryItem: ingredient.inventoryItem._id,
              locationId: ingredient.locationId
            }).lean();
            
            ingredient.locationConfig = locationConfig;
          }
        }
      }
    }

    logger.info(`Retrieved ${recipeBranches.length} RecipeBranch configs for recipe: ${recipeId}, company: ${companyId}`);

    return recipeBranches;
  } catch (error) {
    logger.error('Error getting RecipeBranches:', error);
    throw error;
  }
};

/**
 * Get specific branch configuration for recipe
 * @param {string} recipeId - Recipe ID
 * @param {string} branchId - Branch ID
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Branch configuration
 */
export const getRecipeBranch = async (recipeId, branchId, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const RecipeBranch = getRecipeBranchModel(companyDB);

    // Validate branch access
    if (!validateBranchAccess(branchId, userBranchIds)) {
      throw new Error('You do not have access to this branch');
    }

    const Recipe = getRecipeModel(companyDB);
    const Branch = getLocationModel(companyDB);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB);

    const recipeBranch = await RecipeBranch.findOne({
      recipe: recipeId,
      branch: branchId
    })
      .populate({
        path: 'recipe',
        model: Recipe
      })
      .populate({
        path: 'branch',
        model: Branch
      })
      .populate({
        path: 'ingredients.inventoryItem',
        model: InventoryItem
      })
      .lean();

    if (!recipeBranch) {
      throw new Error('RecipeBranch configuration not found');
    }

    // Fetch location configs for ingredients
    if (recipeBranch.ingredients && recipeBranch.ingredients.length > 0) {
      for (const ingredient of recipeBranch.ingredients) {
        if (ingredient.inventoryItem && ingredient.locationId) {
          const locationConfig = await InventoryItemLocation.findOne({
            inventoryItem: ingredient.inventoryItem._id,
            locationId: ingredient.locationId
          }).lean();
          
          ingredient.locationConfig = locationConfig;
        }
      }
    }

    return recipeBranch;
  } catch (error) {
    logger.error('Error getting RecipeBranch:', error);
    throw error;
  }
};

/**
 * Update branch configuration
 * @param {string} recipeId - Recipe ID
 * @param {string} branchId - Branch ID
 * @param {Object} updateData - Update data
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Updated branch config
 */
export const updateRecipeBranch = async (recipeId, branchId, updateData, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const RecipeBranch = getRecipeBranchModel(companyDB);

    logger.info(`Updating RecipeBranch - recipe: ${recipeId}, branch: ${branchId}, company: ${companyId}`);
    console.log('📝 Update data received:', JSON.stringify(updateData, null, 2));

    // Validate branch access
    if (!validateBranchAccess(branchId, userBranchIds)) {
      throw new Error('You do not have access to this branch');
    }

    // Get existing branch config
    const recipeBranch = await RecipeBranch.findOne({
      recipe: recipeId,
      branch: branchId
    });

    if (!recipeBranch) {
      throw new Error('RecipeBranch configuration not found');
    }

    console.log('📦 Existing config:', JSON.stringify(recipeBranch.toObject(), null, 2));

    // Validate ingredients if being updated
    if (updateData.ingredients) {
      console.log('🔍 Validating ingredients...');
      validateIngredients(updateData.ingredients);
      
      // Log each ingredient with conversion data
      updateData.ingredients.forEach((ing, index) => {
        console.log(`Ingredient ${index}:`, {
          inventoryItem: ing.inventoryItem,
          locationId: ing.locationId,
          quantity: ing.quantity,
          unit: ing.unit,
          conversionFactor: ing.conversionFactor,
          overrideCostPerUnit: ing.overrideCostPerUnit,
        });
      });
      
      // Validate each ingredient has location config
      for (const ingredient of updateData.ingredients) {
        await validateIngredientLocation(ingredient.inventoryItem, ingredient.locationId, companyId);
      }
    }

    // Validate yield if being updated
    if (updateData.yield) {
      console.log('📊 Validating yield:', updateData.yield);
      validateYield(updateData.yield);
    }

    // Update branch config
    Object.assign(recipeBranch, updateData);
    await recipeBranch.save();

    console.log('✅ Recipe branch updated successfully');
    logger.info(`RecipeBranch updated successfully for recipe: ${recipeId}, branch: ${branchId}`);

    // Populate and return
    await populateRecipeBranch(recipeBranch, companyDB);

    console.log('📤 Returning updated config:', JSON.stringify(recipeBranch.toObject(), null, 2));

    return recipeBranch;
  } catch (error) {
    console.error('❌ Error updating RecipeBranch:', error);
    logger.error('Error updating RecipeBranch:', error);
    throw error;
  }
};

/**
 * Delete branch configuration
 * @param {string} recipeId - Recipe ID
 * @param {string} branchId - Branch ID
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Object>} Deleted branch config
 */
export const deleteRecipeBranch = async (recipeId, branchId, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const RecipeBranch = getRecipeBranchModel(companyDB);

    // Validate branch access
    if (!validateBranchAccess(branchId, userBranchIds)) {
      throw new Error('You do not have access to this branch');
    }

    // Find and delete branch config
    const recipeBranch = await RecipeBranch.findOneAndDelete({
      recipe: recipeId,
      branch: branchId
    });

    if (!recipeBranch) {
      throw new Error('RecipeBranch configuration not found');
    }

    logger.info(`RecipeBranch deleted for recipe: ${recipeId}, branch: ${branchId}, company: ${companyId}`);

    return recipeBranch;
  } catch (error) {
    logger.error('Error deleting RecipeBranch:', error);
    throw error;
  }
};

/**
 * Bulk upsert (create or update) branch configurations
 * @param {string} recipeId - Recipe ID
 * @param {Array} branchConfigs - Array of { branchId, ...config }
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (null for super admin)
 * @returns {Promise<Array>} Created/updated branch configs
 */
export const bulkUpsertRecipeBranches = async (recipeId, branchConfigs, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Recipe = getRecipeModel(companyDB);
    const RecipeBranch = getRecipeBranchModel(companyDB);
    const Branch = getLocationModel(companyDB);

    // Validate recipe exists
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    // Validate all branch configs
    const results = [];
    for (const config of branchConfigs) {
      const { branchId, ...configData } = config;

      // Validate branch access
      if (!validateBranchAccess(branchId, userBranchIds)) {
        throw new Error(`You do not have access to branch: ${branchId}`);
      }

      // Validate branch exists
      const branch = await Branch.findById(branchId);
      if (!branch) {
        throw new Error(`Branch not found: ${branchId}`);
      }

      // Validate ingredients if provided
      if (configData.ingredients) {
        validateIngredients(configData.ingredients);
        
        // Validate each ingredient has location config
        for (const ingredient of configData.ingredients) {
          await validateIngredientLocation(ingredient.inventoryItem, ingredient.locationId, companyId);
        }
      }

      // Validate yield if provided
      if (configData.yield) {
        validateYield(configData.yield);
      }

      // Upsert: update if exists, create if not
      let recipeBranch = await RecipeBranch.findOne({
        recipe: recipeId,
        branch: branchId
      });

      if (recipeBranch) {
        // Update existing
        Object.assign(recipeBranch, configData);
        await recipeBranch.save();
        logger.info(`RecipeBranch updated for recipe: ${recipeId}, branch: ${branchId}`);
      } else {
        // Create new
        recipeBranch = new RecipeBranch({
          recipe: recipeId,
          branch: branchId,
          ...configData
        });
        await recipeBranch.save();
        logger.info(`RecipeBranch created for recipe: ${recipeId}, branch: ${branchId}`);
      }

      // Populate before adding to results
      await populateRecipeBranch(recipeBranch, companyDB);

      results.push(recipeBranch);
    }

    logger.info(`Bulk upsert completed: ${results.length} RecipeBranch configs for recipe: ${recipeId}, company: ${companyId}`);

    return results;
  } catch (error) {
    logger.error('Error bulk upserting RecipeBranches:', error);
    throw error;
  }
};

/**
 * Map ingredients from source location to target location
 * Ensures inventory items have location configs for the target location
 * @param {Array} sourceIngredients - Ingredients from source location
 * @param {string} targetLocationId - Target location ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Mapped ingredients for target location
 */
export const mapIngredientsToTargetBranch = async (sourceIngredients, targetLocationId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB);

    const mappedIngredients = [];

    for (const ingredient of sourceIngredients) {
      // Get the inventory item
      const inventoryItem = await InventoryItem.findById(ingredient.inventoryItem);

      if (!inventoryItem) {
        logger.warn(`Inventory item not found: ${ingredient.inventoryItem}`);
        continue;
      }

      // Find or create the location config for the target location
      let targetLocationConfig = await InventoryItemLocation.findOne({
        inventoryItem: inventoryItem._id,
        locationId: targetLocationId
      });

      // If not found, create it (auto-assign)
      if (!targetLocationConfig) {
        logger.info(`Auto-creating inventory item location for item ${inventoryItem._id} in location ${targetLocationId}`);
        
        targetLocationConfig = new InventoryItemLocation({
          inventoryItem: inventoryItem._id,
          locationId: targetLocationId,
          availableQuantity: 0,
          reservedQuantity: 0,
          inTransitQuantity: 0,
          minimumStock: 0,
          costingMethod: 'FIFO',
          isActive: true
        });

        await targetLocationConfig.save();
      }

      // Map the ingredient with the target location ID
      mappedIngredients.push({
        inventoryItem: inventoryItem._id.toString(),
        locationId: targetLocationId,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        conversionFactor: ingredient.conversionFactor,
        overrideCostPerUnit: ingredient.overrideCostPerUnit
      });
    }

    logger.info(`Mapped ${mappedIngredients.length} ingredients from source to target location ${targetLocationId}`);

    return mappedIngredients;
  } catch (error) {
    logger.error('Error mapping ingredients to target location:', error);
    throw error;
  }
};

/**
 * Calculate and update recipe cost for a branch
 * @param {string} recipeBranchId - RecipeBranch ID
 * @param {string} companyId - Company ID
 * @returns {Promise<number>} Calculated cost per unit
 */
export const calculateRecipeCost = async (recipeBranchId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const RecipeBranch = getRecipeBranchModel(companyDB);

    // Find RecipeBranch
    const recipeBranch = await RecipeBranch.findById(recipeBranchId);

    if (!recipeBranch) {
      throw new Error('RecipeBranch not found');
    }

    // Calculate cost using model method
    const costPerUnit = await recipeBranch.calculateCost();

    // Save updated cost
    await recipeBranch.save();

    logger.info(`Recipe cost calculated for RecipeBranch: ${recipeBranchId}, cost: ${costPerUnit}, company: ${companyId}`);

    return costPerUnit;
  } catch (error) {
    logger.error('Error calculating recipe cost:', error);
    throw error;
  }
};

