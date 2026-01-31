/**
 * Recipe Service
 * Business logic for recipe management operations
 */

import { getCompanyDB } from '../config/database.js';
import { getRecipeModel } from '../models/company/Recipe.js';
import { getInventoryItemModel } from '../models/company/InventoryItem.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new recipe
 * @param {Object} recipeData - Recipe data
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Created recipe
 */
export const createRecipe = async (recipeData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Recipe = getRecipeModel(companyDB);

    // Validate required fields
    const requiredFields = ['name', 'finishedGood', 'ingredients', 'yield'];
    const missingFields = requiredFields.filter(field => !recipeData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate ingredients array is not empty
    if (!Array.isArray(recipeData.ingredients) || recipeData.ingredients.length === 0) {
      throw new Error('Recipe must have at least one ingredient');
    }

    // Validate each ingredient
    for (const ingredient of recipeData.ingredients) {
      if (!ingredient.rawMaterial || !ingredient.quantity || !ingredient.unit) {
        throw new Error('Each ingredient must have rawMaterial, quantity, and unit');
      }
      if (ingredient.quantity <= 0) {
        throw new Error('Ingredient quantity must be positive');
      }
    }

    // Validate yield
    if (!recipeData.yield.quantity || !recipeData.yield.unit) {
      throw new Error('Yield must have quantity and unit');
    }
    if (recipeData.yield.quantity <= 0) {
      throw new Error('Yield quantity must be positive');
    }

    // Create recipe with version 1
    const recipe = new Recipe({
      ...recipeData,
      version: 1,
      isActive: true
    });

    // Calculate cost per unit
    await recipe.calculateCost();
    await recipe.save();

    logger.info(`Recipe created: ${recipe._id} for company: ${companyId}`);

    return recipe;
  } catch (error) {
    logger.error('Error creating recipe:', error);
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
      finishedGood = ''
    } = filters;

    // Build query - only return active recipes
    const query = {
      isActive: true
    };

    // Search filter
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Finished good filter
    if (finishedGood) {
      query.finishedGood = finishedGood;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [recipes, total] = await Promise.all([
      Recipe.find(query)
        .populate('finishedGood', 'name category price')
        .populate('ingredients.rawMaterial', 'name unit costPrice')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Recipe.countDocuments(query)
    ]);

    // Calculate virtuals manually for lean queries
    const recipesWithVirtuals = recipes.map(recipe => ({
      ...recipe,
      totalTime: (recipe.preparationTime || 0) + (recipe.cookingTime || 0)
    }));

    return {
      recipes: recipesWithVirtuals,
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
 * @returns {Promise<Object>} Recipe with ingredient details
 */
export const getRecipeById = async (recipeId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Recipe = getRecipeModel(companyDB);

    const recipe = await Recipe.findById(recipeId)
      .populate('finishedGood', 'name category price description')
      .populate({
        path: 'ingredients.rawMaterial',
        select: 'name unit costPrice currentStock minimumStock type category'
      })
      .lean();

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    // Calculate virtual
    recipe.totalTime = (recipe.preparationTime || 0) + (recipe.cookingTime || 0);

    return recipe;
  } catch (error) {
    logger.error('Error getting recipe by ID:', error);
    throw error;
  }
};

/**
 * Update recipe
 * @param {string} recipeId - Recipe ID
 * @param {Object} updateData - Update data
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

    // Validate ingredients if provided
    if (updateData.ingredients) {
      if (!Array.isArray(updateData.ingredients) || updateData.ingredients.length === 0) {
        throw new Error('Recipe must have at least one ingredient');
      }

      // Validate each ingredient
      for (const ingredient of updateData.ingredients) {
        if (!ingredient.rawMaterial || !ingredient.quantity || !ingredient.unit) {
          throw new Error('Each ingredient must have rawMaterial, quantity, and unit');
        }
        if (ingredient.quantity <= 0) {
          throw new Error('Ingredient quantity must be positive');
        }
      }

      // Check if ingredients changed - increment version if they did
      const ingredientsChanged = JSON.stringify(existingRecipe.ingredients) !== JSON.stringify(updateData.ingredients);
      if (ingredientsChanged) {
        updateData.version = existingRecipe.version + 1;
      }
    }

    // Validate yield if provided
    if (updateData.yield) {
      if (!updateData.yield.quantity || !updateData.yield.unit) {
        throw new Error('Yield must have quantity and unit');
      }
      if (updateData.yield.quantity <= 0) {
        throw new Error('Yield quantity must be positive');
      }
    }

    // Update recipe
    Object.assign(existingRecipe, updateData);

    // Recalculate cost if ingredients or yield changed
    if (updateData.ingredients || updateData.yield) {
      await existingRecipe.calculateCost();
    }

    await existingRecipe.save();

    logger.info(`Recipe updated: ${recipeId} for company: ${companyId}`);

    return existingRecipe;
  } catch (error) {
    logger.error('Error updating recipe:', error);
    throw error;
  }
};

/**
 * Delete recipe (soft delete)
 * @param {string} recipeId - Recipe ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Deleted recipe
 */
export const deleteRecipe = async (recipeId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Recipe = getRecipeModel(companyDB);

    const recipe = await Recipe.findByIdAndUpdate(
      recipeId,
      { isActive: false },
      { new: true }
    );

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    logger.info(`Recipe soft deleted: ${recipeId} for company: ${companyId}`);

    return recipe;
  } catch (error) {
    logger.error('Error deleting recipe:', error);
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
