/**
 * Recipe Service
 * Business logic for recipe management operations
 */

import { getCompanyDB } from '../config/database.js';
import { getRecipeModel } from '../models/company/Recipe.js';
import { getRecipeBranchModel } from '../models/company/RecipeBranch.js';
import { getInventoryItemModel } from '../models/company/InventoryItem.js';
import { getInventoryItemBranchModel } from '../models/company/InventoryItemBranch.js';
import { getMenuItemModel } from '../models/company/MenuItem.js';
import { getCategoryModel } from '../models/company/Category.js';
import { getLocationModel } from '../models/company/Location.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new recipe
 * @param {Object} recipeData - Recipe data (global fields only)
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Created recipe
 */
export const createRecipe = async (recipeData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Recipe = getRecipeModel(companyDB);

    // Validate required fields (only global fields)
    const requiredFields = ['name', 'finishedGood'];
    const missingFields = requiredFields.filter(field => !recipeData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Create recipe with only global fields
    const recipe = new Recipe({
      name: recipeData.name,
      finishedGood: recipeData.finishedGood,
      preparationSteps: recipeData.preparationSteps || [],
      version: 1,
      isActive: recipeData.isActive !== undefined ? recipeData.isActive : true,
      notes: recipeData.notes || ''
    });

    await recipe.save();

    logger.info(`Recipe created: ${recipe._id} for company: ${companyId}`);

    return recipe;
  } catch (error) {
    logger.error('Error creating recipe:', error);
    throw error;
  }
};

/**
 * Create a recipe with branch configurations in one transaction
 * @param {Object} recipeData - Recipe data (global fields)
 * @param {Array} branchConfigs - Array of branch configurations
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Created recipe with branches
 */
export const createRecipeWithBranches = async (recipeData, branchConfigs, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Recipe = getRecipeModel(companyDB);
    const RecipeBranch = getRecipeBranchModel(companyDB);

    // Validate required fields
    const requiredFields = ['name', 'finishedGood'];
    const missingFields = requiredFields.filter(field => !recipeData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate branch configs
    if (!Array.isArray(branchConfigs) || branchConfigs.length === 0) {
      throw new Error('At least one branch configuration is required');
    }

    // Create recipe
    const recipe = new Recipe({
      name: recipeData.name,
      finishedGood: recipeData.finishedGood,
      preparationSteps: recipeData.preparationSteps || [],
      version: 1,
      isActive: recipeData.isActive !== undefined ? recipeData.isActive : true,
      notes: recipeData.notes || ''
    });

    await recipe.save();

    // Create branch configurations
    const recipeBranches = [];
    for (const branchConfig of branchConfigs) {
      if (!branchConfig.branch) {
        throw new Error('Each branch configuration must have a branch ID');
      }

      const recipeBranch = new RecipeBranch({
        recipe: recipe._id,
        branch: branchConfig.branch,
        ingredients: branchConfig.ingredients || [],
        yield: branchConfig.yield,
        preparationTime: branchConfig.preparationTime,
        cookingTime: branchConfig.cookingTime,
        isActive: branchConfig.isActive !== undefined ? branchConfig.isActive : true,
        notes: branchConfig.notes || ''
      });

      // Calculate cost if ingredients and yield are provided
      if (recipeBranch.ingredients.length > 0 && recipeBranch.yield) {
        await recipeBranch.calculateCost();
      }

      await recipeBranch.save();
      recipeBranches.push(recipeBranch);
    }

    logger.info(`Recipe created with ${recipeBranches.length} branch configurations: ${recipe._id} for company: ${companyId}`);

    // Return recipe with branches
    const recipeWithBranches = recipe.toObject();
    recipeWithBranches.branches = recipeBranches;

    return recipeWithBranches;
  } catch (error) {
    logger.error('Error creating recipe with branches:', error);
    throw error;
  }
};

/**
 * Get recipes with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated recipes
 */
export const getRecipes = async (companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Recipe = getRecipeModel(companyDB);

    const {
      page = 1,
      limit = 10,
      search = '',
      finishedGood = '',
      branchId = '',
      populateBranches = false
    } = filters;

    // Build query - only return active recipes
    const query = {};

    // Search filter
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Finished good filter
    if (finishedGood && finishedGood !== 'all') {
      query.finishedGood = finishedGood;
    }

    // If branch filter is provided, we need to filter recipes that have RecipeBranch for that branch
    if (branchId && branchId !== 'all') {
      const RecipeBranch = getRecipeBranchModel(companyDB);
      const recipeBranches = await RecipeBranch.find({ 
        branch: branchId, 
        isActive: true 
      }).select('recipe').lean();
      
      const recipeIds = recipeBranches.map(rb => rb.recipe);
      query._id = { $in: recipeIds };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Register MenuItem model for populate
    // Ensure Category model is registered on this connection so nested populates work
    getCategoryModel(companyDB);
    const MenuItem = getMenuItemModel(companyDB);

    // Execute query - populate only finishedGood for global recipes
    const [recipes, total] = await Promise.all([
      Recipe.find(query)
        .populate({
          path: 'finishedGood',
          model: MenuItem,
          select: 'name category price'
        })
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Recipe.countDocuments(query)
    ]);

    // Populate branch configurations (with inventory item details) for returned recipes
    if (recipes.length > 0) {
      const RecipeBranch = getRecipeBranchModel(companyDB);
      const InventoryItemBranch = getInventoryItemBranchModel(companyDB);
      const InventoryItem = getInventoryItemModel(companyDB);
      const Branch = getLocationModel(companyDB);

      const recipeIds = recipes.map(r => r._id);

      // Build query: optionally filter by branchId if provided
      const branchQuery = {
        recipe: { $in: recipeIds },
        isActive: true
      };
      if (branchId && branchId !== 'all') {
        branchQuery.branch = branchId;
      }

      const recipeBranches = await RecipeBranch.find(branchQuery)
        .populate({
          path: 'branch',
          model: Branch,
          select: 'name code location'
        })
        .populate({
          path: 'ingredients.inventoryItemBranch',
          model: InventoryItemBranch,
          select: 'inventoryItem currentStock costPrice isActive',
          populate: {
            path: 'inventoryItem',
            model: InventoryItem,
            select: 'name unit type category'
          }
        })
        .lean();

      // Group branches by recipe id
      const branchesMap = {};
      recipeBranches.forEach(rb => {
        const rId = rb.recipe.toString();
        if (!branchesMap[rId]) branchesMap[rId] = [];
        branchesMap[rId].push({
          ...rb,
          totalTime: (rb.preparationTime || 0) + (rb.cookingTime || 0)
        });
      });

      // Attach branches array and, if branch filter applied, a branchConfig shortcut
      recipes.forEach(recipe => {
        const rId = recipe._id.toString();
        recipe.branches = branchesMap[rId] || [];
        if (branchId && branchId !== 'all') {
          // if filtered by a single branch, expose branchConfig for convenience
          recipe.branchConfig = recipe.branches.length > 0 ? recipe.branches[0] : null;
        }
      });
    }

    return {
      recipes,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting recipes:', error);
    throw error;
  }
};

/**
 * Get recipe by ID
 * @param {string} recipeId - Recipe ID
 * @param {string} companyId - Company ID
 * @param {Object} options - Options for population
 * @returns {Promise<Object>} Recipe with optional branch details
 */
export const getRecipeById = async (recipeId, companyId, options = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Recipe = getRecipeModel(companyDB);
    // Ensure Category model is registered on this connection so nested populates work
    getCategoryModel(companyDB);
    const MenuItem = getMenuItemModel(companyDB);

    const { populateBranches = false, branch = null } = options;

    const recipe = await Recipe.findById(recipeId)
      .populate({
        path: 'finishedGood',
        model: MenuItem,
        select: 'name category price description'
      })
      .lean();

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    // Populate branch configurations if requested
    if (populateBranches) {
      const RecipeBranch = getRecipeBranchModel(companyDB);
      const InventoryItemBranch = getInventoryItemBranchModel(companyDB);
      const InventoryItem = getInventoryItemModel(companyDB);
      const Branch = getLocationModel(companyDB); // Ensure Location model is registered
      
      const branchQuery = { recipe: recipeId, isActive: true };
      if (branch) {
        branchQuery.branch = branch;
      }

      const recipeBranches = await RecipeBranch.find(branchQuery)
        .populate({
          path: 'branch',
          model: Branch,
          select: 'name code location'
        })
        .populate({
          path: 'ingredients.inventoryItemBranch',
          model: InventoryItemBranch,
          select: 'inventoryItem currentStock costPrice isActive',
          populate: {
            path: 'inventoryItem',
            model: InventoryItem,
            select: 'name unit type category'
          }
        })
        .lean();

      // Add totalTime virtual to each branch
      recipe.branches = recipeBranches.map(rb => ({
        ...rb,
        totalTime: (rb.preparationTime || 0) + (rb.cookingTime || 0)
      }));
    }

    return recipe;
  } catch (error) {
    logger.error('Error getting recipe by ID:', error);
    throw error;
  }
};

/**
 * Update recipe (global fields only)
 * @param {string} recipeId - Recipe ID
 * @param {Object} updateData - Update data (global fields only)
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated recipe
 */
export const updateRecipe = async (recipeId, updateData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Recipe = getRecipeModel(companyDB);

    // Get existing recipe
    const existingRecipe = await Recipe.findById(recipeId);
    if (!existingRecipe) {
      throw new Error('Recipe not found');
    }

    // Only allow updating global fields
    const allowedFields = ['name', 'finishedGood', 'preparationSteps', 'notes', 'isActive'];
    const updates = {};
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    // Check if any global data changed - increment version if it did
    const globalDataChanged = 
      (updates.name && updates.name !== existingRecipe.name) ||
      (updates.finishedGood && updates.finishedGood.toString() !== existingRecipe.finishedGood.toString()) ||
      (updates.preparationSteps && JSON.stringify(updates.preparationSteps) !== JSON.stringify(existingRecipe.preparationSteps));

    if (globalDataChanged) {
      updates.version = existingRecipe.version + 1;
    }

    // Update recipe
    Object.assign(existingRecipe, updates);
    await existingRecipe.save();

    logger.info(`Recipe updated: ${recipeId} for company: ${companyId}`);

    return existingRecipe;
  } catch (error) {
    logger.error('Error updating recipe:', error);
    throw error;
  }
};

/**
 * Delete recipe (soft delete) and cascade delete RecipeBranch records
 * @param {string} recipeId - Recipe ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Deleted recipe
 */
export const deleteRecipe = async (recipeId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Recipe = getRecipeModel(companyDB);
    const RecipeBranch = getRecipeBranchModel(companyDB);

    // Soft delete the recipe
    const recipe = await Recipe.findByIdAndUpdate(
      recipeId,
      { isActive: false },
      { new: true }
    );

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    // Cascade delete all associated RecipeBranch records
    await RecipeBranch.deleteMany({ recipe: recipeId });

    logger.info(`Recipe soft deleted: ${recipeId} and associated RecipeBranch records deleted for company: ${companyId}`);

    return recipe;
  } catch (error) {
    logger.error('Error deleting recipe:', error);
    throw error;
  }
};

/**
 * Permanently delete recipe and all branch configurations
 * @param {string} recipeId - Recipe ID
 * @param {string} companyId - Company ID
 * @returns {Promise<void>}
 */
export const permanentlyDeleteRecipe = async (recipeId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Recipe = getRecipeModel(companyDB);
    const RecipeBranch = getRecipeBranchModel(companyDB);

    // Get recipe first to verify it exists
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    // Delete all branch configurations first
    await RecipeBranch.deleteMany({ recipe: recipeId });
    logger.info(`Deleted all branch configurations for recipe: ${recipeId}`);

    // Permanently delete the recipe
    await Recipe.findByIdAndDelete(recipeId);

    logger.info(`Recipe permanently deleted: ${recipeId} for company: ${companyId}`);
  } catch (error) {
    logger.error('Error permanently deleting recipe:', error);
    throw error;
  }
};

/**
 * Toggle recipe active status
 * @param {string} recipeId - Recipe ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated recipe
 */
export const toggleRecipeStatus = async (recipeId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Recipe = getRecipeModel(companyDB);

    // Get recipe
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    // Toggle isActive status
    recipe.isActive = !recipe.isActive;
    await recipe.save();

    logger.info(`Recipe status toggled: ${recipeId}, new status: ${recipe.isActive}, company: ${companyId}`);

    return recipe;
  } catch (error) {
    logger.error('Error toggling recipe status:', error);
    throw error;
  }
};

/**
 * Deduct inventory by recipe when finished good is sold
 * @param {string} finishedGoodId - Finished good (menu item) ID
 * @param {number} quantity - Quantity of finished goods sold
 * @param {string} companyId - Company ID
 * @param {string} branchId - Branch ID
 * @returns {Promise<Object>} Deduction result
 */
export const deductInventoryByRecipe = async (finishedGoodId, quantity, companyId, branchId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Recipe = getRecipeModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB);

    // Validate quantity
    if (!quantity || quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    // Find active recipe for the finished good
    const recipe = await Recipe.findOne({
      finishedGood: finishedGoodId,
      isActive: true
    }).populate('ingredients.rawMaterial');

    if (!recipe) {
      throw new Error('No active recipe found for this finished good');
    }

    // Validate sufficient stock for all ingredients
    const insufficientItems = [];
    for (const ingredient of recipe.ingredients) {
      const requiredQuantity = ingredient.quantity * quantity;
      
      const inventoryItem = await InventoryItem.findOne({
        _id: ingredient.rawMaterial._id,
        branch: branchId,
        isActive: true
      });

      if (!inventoryItem) {
        insufficientItems.push({
          name: ingredient.rawMaterial.name,
          required: requiredQuantity,
          available: 0
        });
      } else if (inventoryItem.currentStock < requiredQuantity) {
        insufficientItems.push({
          name: inventoryItem.name,
          required: requiredQuantity,
          available: inventoryItem.currentStock
        });
      }
    }

    if (insufficientItems.length > 0) {
      throw new Error(`Insufficient stock for ingredients: ${JSON.stringify(insufficientItems)}`);
    }

    // Deduct inventory for each ingredient
    const deductions = [];
    for (const ingredient of recipe.ingredients) {
      const requiredQuantity = ingredient.quantity * quantity;
      
      const inventoryItem = await InventoryItem.findOne({
        _id: ingredient.rawMaterial._id,
        branch: branchId,
        isActive: true
      });

      if (inventoryItem) {
        const previousStock = inventoryItem.currentStock;
        inventoryItem.currentStock -= requiredQuantity;
        await inventoryItem.save();

        deductions.push({
          itemId: inventoryItem._id,
          itemName: inventoryItem.name,
          previousStock,
          deducted: requiredQuantity,
          newStock: inventoryItem.currentStock
        });
      }
    }

    logger.info(`Inventory deducted by recipe: ${recipe._id} for finished good: ${finishedGoodId}, quantity: ${quantity}, company: ${companyId}`);

    return {
      recipeId: recipe._id,
      recipeName: recipe.name,
      finishedGoodId,
      quantityProduced: quantity,
      deductions
    };
  } catch (error) {
    logger.error('Error deducting inventory by recipe:', error);
    throw error;
  }
};

