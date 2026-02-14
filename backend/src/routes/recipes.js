import express from 'express';
import {
  createRecipe,
  getRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe,
  createRecipeWithBranches
} from '../controllers/recipeController.js';
import {
  createRecipeBranch,
  getRecipeBranches,
  getRecipeBranch,
  updateRecipeBranch,
  deleteRecipeBranch,
  bulkUpsertRecipeBranches
} from '../controllers/recipeBranchController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Recipe routes (global data)
router.get('/', getRecipes);
router.post('/', createRecipe);
router.post('/with-branches', createRecipeWithBranches);
router.get('/:id', getRecipeById);
router.put('/:id', updateRecipe);
router.delete('/:id', deleteRecipe);

// RecipeBranch routes (branch-specific configurations)
router.post('/:recipeId/branches', createRecipeBranch);
router.post('/:recipeId/branches/bulk', bulkUpsertRecipeBranches);
router.get('/:recipeId/branches', getRecipeBranches);
router.get('/:recipeId/branches/:branchId', getRecipeBranch);
router.put('/:recipeId/branches/:branchId', updateRecipeBranch);
router.delete('/:recipeId/branches/:branchId', deleteRecipeBranch);

export default router;
