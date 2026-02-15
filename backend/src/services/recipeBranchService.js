/**
 * Recipe Branch Service
 * Business logic for branch-specific recipe configuration operations
 */

import { getCompanyDB } from '../config/database.js';
import { getRecipeModel } from '../models/company/Recipe.js';
import { getRecipeBranchModel } from '../models/company/RecipeBranch.js';
import { getBranchModel } from '../models/company/Branch.js';
import { getInventoryItemBranchModel } from '../models/company/InventoryItemBranch.js';
import { logger } from '../utils/logger.js';

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
 * Validate ingredient branch reference and auto-assign if needed
 * @param {string} inventoryItemBranchId - InventoryItemBranch ID
 * @param {string} branchId - Expected branch ID
 * @param {string} companyId - Company ID
 * @returns {Promise<boolean>} Whether ingredient belongs to branch
 * @throws {Error} If validation fails
 */
export const validateIngredientBranch = async (inventoryItemBranchId, branchId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);

    // Check if inventoryItemBranch exists
    const inventoryItemBranch = await InventoryItemBranch.findById(inventoryItemBranchId);
    
    if (!inventoryItemBranch) {
      throw new Error(`InventoryItemBranch ${inventoryItemBranchId} not found`);
    }

    // Check if ingredient belongs to the same branch
    if (inventoryItemBranch.branch.toString() !== branchId.toString()) {
      // Instead of throwing error, auto-assign the inventory item to the branch
      logger.info(`Auto-assigning inventory item ${inventoryItemBranch.inventoryItem} to branch ${branchId}`);
      
      // Check if this inventory item already has a branch config for the target branch
      const existingBranchConfig = await InventoryItemBranch.findOne({
        inventoryItem: inventoryItemBranch.inventoryItem,
        branch: branchId
      });

      if (existingBranchConfig) {
        // Branch config already exists, just log it
        logger.info(`Inventory item ${inventoryItemBranch.inventoryItem} already assigned to branch ${branchId}`);
        return true;
      }

      // Create new branch configuration for this inventory item
      const newBranchConfig = new InventoryItemBranch({
        inventoryItem: inventoryItemBranch.inventoryItem,
        branch: branchId,
        quantity: 0, // Start with 0 quantity
        minStockLevel: inventoryItemBranch.minStockLevel || 0,
        maxStockLevel: inventoryItemBranch.maxStockLevel || 0,
        reorderPoint: inventoryItemBranch.reorderPoint || 0,
        reorderQuantity: inventoryItemBranch.reorderQuantity || 0,
        costPrice: inventoryItemBranch.costPrice || 0,
        isAvailable: true,
        isActive: true
      });

      await newBranchConfig.save();
      logger.info(`Created new branch config for inventory item ${inventoryItemBranch.inventoryItem} in branch ${branchId}`);
    }

    return true;
  } catch (error) {
    logger.error('Error validating ingredient branch:', error);
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
    if (!ingredient.inventoryItemBranch) {
      throw new Error('Each ingredient must have an inventoryItemBranch reference');
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
    const Branch = getBranchModel(companyDB);

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
      
      // Validate each ingredient belongs to the branch
      for (const ingredient of configData.ingredients) {
        await validateIngredientBranch(ingredient.inventoryItemBranch, branchId, companyId);
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
    await recipeBranch.populate('recipe');
    await recipeBranch.populate('branch');
    await recipeBranch.populate('ingredients.inventoryItemBranch');

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
    const recipeBranches = await RecipeBranch.find(query)
      .populate('recipe')
      .populate('branch')
      .populate('ingredients.inventoryItemBranch')
      .lean();

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

    const recipeBranch = await RecipeBranch.findOne({
      recipe: recipeId,
      branch: branchId
    })
      .populate('recipe')
      .populate('branch')
      .populate('ingredients.inventoryItemBranch')
      .lean();

    if (!recipeBranch) {
      throw new Error('RecipeBranch configuration not found');
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

    // Validate ingredients if being updated
    if (updateData.ingredients) {
      validateIngredients(updateData.ingredients);
      
      // Validate each ingredient belongs to the branch
      for (const ingredient of updateData.ingredients) {
        await validateIngredientBranch(ingredient.inventoryItemBranch, branchId, companyId);
      }
    }

    // Validate yield if being updated
    if (updateData.yield) {
      validateYield(updateData.yield);
    }

    // Update branch config
    Object.assign(recipeBranch, updateData);
    await recipeBranch.save();

    logger.info(`RecipeBranch updated successfully for recipe: ${recipeId}, branch: ${branchId}`);

    // Populate and return
    await recipeBranch.populate('recipe');
    await recipeBranch.populate('branch');
    await recipeBranch.populate('ingredients.inventoryItemBranch');

    return recipeBranch;
  } catch (error) {
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
    const Branch = getBranchModel(companyDB);

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
        
        // Validate each ingredient belongs to the branch
        for (const ingredient of configData.ingredients) {
          await validateIngredientBranch(ingredient.inventoryItemBranch, branchId, companyId);
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
      await recipeBranch.populate('recipe');
      await recipeBranch.populate('branch');
      await recipeBranch.populate('ingredients.inventoryItemBranch');

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
 * Map ingredients from source branch to target branch
 * Finds corresponding inventory item branch IDs for the target branch
 * @param {Array} sourceIngredients - Ingredients from source branch
 * @param {string} targetBranchId - Target branch ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Mapped ingredients for target branch
 */
export const mapIngredientsToTargetBranch = async (sourceIngredients, targetBranchId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const InventoryItemBranch = getInventoryItemBranchModel(companyDB);

    const mappedIngredients = [];

    for (const ingredient of sourceIngredients) {
      // Get the source inventory item branch to find the base inventory item
      const sourceItemBranch = await InventoryItemBranch.findById(ingredient.inventoryItemBranch)
        .populate('inventoryItem');

      if (!sourceItemBranch) {
        logger.warn(`Source inventory item branch not found: ${ingredient.inventoryItemBranch}`);
        continue;
      }

      // Find the corresponding inventory item branch for the target branch
      let targetItemBranch = await InventoryItemBranch.findOne({
        inventoryItem: sourceItemBranch.inventoryItem._id,
        branch: targetBranchId
      });

      // If not found, create it (auto-assign)
      if (!targetItemBranch) {
        logger.info(`Auto-creating inventory item branch for item ${sourceItemBranch.inventoryItem._id} in branch ${targetBranchId}`);
        
        targetItemBranch = new InventoryItemBranch({
          inventoryItem: sourceItemBranch.inventoryItem._id,
          branch: targetBranchId,
          currentStock: 0,
          minimumStock: sourceItemBranch.minimumStock || 0,
          maximumStock: sourceItemBranch.maximumStock || 0,
          reorderPoint: sourceItemBranch.reorderPoint || 0,
          reorderQuantity: sourceItemBranch.reorderQuantity || 0,
          costPrice: sourceItemBranch.costPrice || 0,
          isAvailable: true,
          isActive: true
        });

        await targetItemBranch.save();
      }

      // Map the ingredient with the target branch's inventory item branch ID
      mappedIngredients.push({
        inventoryItemBranch: targetItemBranch._id.toString(),
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        conversionFactor: ingredient.conversionFactor,
        overrideCostPerUnit: ingredient.overrideCostPerUnit
      });
    }

    logger.info(`Mapped ${mappedIngredients.length} ingredients from source to target branch ${targetBranchId}`);

    return mappedIngredients;
  } catch (error) {
    logger.error('Error mapping ingredients to target branch:', error);
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
