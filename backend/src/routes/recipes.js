import express from 'express';
import {
  createRecipe,
  getRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe,
  permanentlyDeleteRecipe,
  toggleRecipeStatus,
  createRecipeWithBranches
} from '../controllers/recipeController.js';
import {
  createRecipeBranch,
  getRecipeBranches,
  getRecipeBranch,
  updateRecipeBranch,
  deleteRecipeBranch,
  bulkUpsertRecipeBranches,
  copyRecipeBranchToTargets
} from '../controllers/recipeBranchController.js';
import {
  calculateSmartConversions,
  getConversionSuggestion
} from '../controllers/unitConversionController.js';
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
router.delete('/:id', deleteRecipe); // Soft delete (sets isActive = false)
router.delete('/:id/permanent', permanentlyDeleteRecipe); // Permanent delete with branch configs
router.patch('/:id/toggle-status', toggleRecipeStatus); // Toggle active status

// RecipeBranch routes (branch-specific configurations)
router.post('/:recipeId/branches', createRecipeBranch);
router.post('/:recipeId/branches/bulk', bulkUpsertRecipeBranches);
router.post('/:recipeId/branches/:sourceBranchId/copy', copyRecipeBranchToTargets); // Copy config to target branches
router.get('/:recipeId/branches', getRecipeBranches);
router.get('/:recipeId/branches/:branchId', getRecipeBranch);
router.put('/:recipeId/branches/:branchId', updateRecipeBranch);
router.delete('/:recipeId/branches/:branchId', deleteRecipeBranch);

// Unit conversion routes
router.post('/unit-conversion/calculate', calculateSmartConversions);
router.post('/unit-conversion/suggest', getConversionSuggestion);

export default router;
