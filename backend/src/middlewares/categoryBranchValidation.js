/**
 * Category-Branch Validation Middleware
 * Middleware functions for validating and auto-assigning category-branch relationships
 * Ensures data consistency across inventory items and suppliers
 */

import mongoose from 'mongoose';
import { getCompanyDB } from '../config/database.js';
import CategoryBranchValidationService from '../services/categoryBranchValidationService.js';
import { logger } from '../utils/logger.js';
import { isFeatureEnabled, logFeatureDisabledWarning } from '../config/featureFlags.js';

/**
 * Middleware to validate and auto-assign categories when creating/updating inventory items
 * Automatically assigns categories and subcategories to branches when items are assigned
 * 
 * Requirements: 1.1, 1.2, 1.5, 7.1, 7.2, 7.3
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export const validateAndAssignItemCategories = async (req, res, next) => {
  // Check if auto-assignment feature is enabled
  if (!isFeatureEnabled('AUTO_ASSIGN_CATEGORIES')) {
    logFeatureDisabledWarning(
      'AUTO_ASSIGN_CATEGORIES',
      'validateAndAssignItemCategories middleware',
      {
        companyId: req.user?.companyId,
        userId: req.user?.userId,
        operation: 'item_category_assignment'
      }
    );
    // Skip validation and continue to next middleware
    return next();
  }

  // Extract user and company info from authenticated request
  const { companyId, userId } = req.user;
  const itemData = req.body;

  // Skip validation if no branches or categories specified
  if (!itemData.branchIds || !Array.isArray(itemData.branchIds) || itemData.branchIds.length === 0) {
    return next();
  }

  if (!itemData.category) {
    return next();
  }

  // Get company database connection
  const companyDB = getCompanyDB(companyId);
  const validationService = new CategoryBranchValidationService(companyDB);
  
  try {
    // Prepare category and subcategory IDs
    const categoryIds = [itemData.category];
    const subcategoryIds = itemData.subcategory ? [itemData.subcategory] : [];

    // Check if categories need to be assigned to branches
    const accessCheck = await validationService.checkCategoryBranchAccess(
      itemData.branchIds,
      categoryIds,
      subcategoryIds
    );

    // If categories are missing from branches, auto-assign them
    if (!accessCheck.valid) {
      logger.info('Auto-assigning categories to branches for item', {
        companyId,
        userId,
        branchIds: itemData.branchIds,
        categoryIds,
        subcategoryIds
      });

      // Note: Passing null for session - transactions require replica set
      // For standalone MongoDB, operations will run without transaction
      const assignmentResult = await validationService.assignCategoriesToBranches(
        itemData.branchIds,
        categoryIds,
        subcategoryIds,
        userId,
        'item_assignment',
        null
      );

      // Attach assignment info to request for controller to include in response
      req.autoAssignments = assignmentResult.assigned;
    }

    // Continue to next middleware/controller
    next();

  } catch (error) {
    logger.error('Error in validateAndAssignItemCategories middleware', {
      error: error.message,
      stack: error.stack,
      companyId: req.user?.companyId,
      userId: req.user?.userId
    });

    // Return error response
    return res.status(500).json({
      success: false,
      error: {
        code: 'ASSIGNMENT_FAILED',
        message: 'Failed to validate and assign categories',
        details: {
          operation: 'item_category_assignment',
          reason: error.message
        }
      }
    });
  }
};

/**
 * Middleware to validate and auto-assign categories when creating/updating suppliers
 * Automatically assigns categories and subcategories to branches when suppliers are assigned
 * 
 * Requirements: 1.3, 1.4, 1.5, 7.1, 7.2, 7.3
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export const validateAndAssignSupplierCategories = async (req, res, next) => {
  // Check if auto-assignment feature is enabled
  if (!isFeatureEnabled('AUTO_ASSIGN_CATEGORIES')) {
    logFeatureDisabledWarning(
      'AUTO_ASSIGN_CATEGORIES',
      'validateAndAssignSupplierCategories middleware',
      {
        companyId: req.user?.companyId,
        userId: req.user?.userId,
        operation: 'supplier_category_assignment'
      }
    );
    // Skip validation and continue to next middleware
    return next();
  }

  // Extract user and company info from authenticated request
  const { companyId, userId } = req.user;
  const supplierData = req.body;

  // Skip validation if no branches or categories specified
  if (!supplierData.branchIds || !Array.isArray(supplierData.branchIds) || supplierData.branchIds.length === 0) {
    return next();
  }

  const categoryIds = supplierData.categoryIds || [];
  const subcategoryIds = supplierData.subcategoryIds || [];

  if (categoryIds.length === 0 && subcategoryIds.length === 0) {
    return next();
  }

  // Get company database connection
  const companyDB = getCompanyDB(companyId);
  const validationService = new CategoryBranchValidationService(companyDB);
  
  try {
    // Check if categories need to be assigned to branches
    const accessCheck = await validationService.checkCategoryBranchAccess(
      supplierData.branchIds,
      categoryIds,
      subcategoryIds
    );

    // If categories are missing from branches, auto-assign them
    if (!accessCheck.valid) {
      logger.info('Auto-assigning categories to branches for supplier', {
        companyId,
        userId,
        branchIds: supplierData.branchIds,
        categoryIds,
        subcategoryIds
      });

      // Note: Passing null for session - transactions require replica set
      // For standalone MongoDB, operations will run without transaction
      const assignmentResult = await validationService.assignCategoriesToBranches(
        supplierData.branchIds,
        categoryIds,
        subcategoryIds,
        userId,
        'supplier_assignment',
        null
      );

      // Attach assignment info to request for controller to include in response
      req.autoAssignments = assignmentResult.assigned;
    }

    // Continue to next middleware/controller
    next();

  } catch (error) {
    logger.error('Error in validateAndAssignSupplierCategories middleware', {
      error: error.message,
      stack: error.stack,
      companyId: req.user?.companyId,
      userId: req.user?.userId
    });

    // Return error response
    return res.status(500).json({
      success: false,
      error: {
        code: 'ASSIGNMENT_FAILED',
        message: 'Failed to validate and assign categories',
        details: {
          operation: 'supplier_category_assignment',
          reason: error.message
        }
      }
    });
  }
};

/**
 * Middleware to validate branch removal from categories
 * Prevents removal if items or suppliers depend on the category in that branch
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 7.1, 7.2, 7.3
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export const validateCategoryBranchRemoval = async (req, res, next) => {
  // Check if branch removal validation feature is enabled
  if (!isFeatureEnabled('VALIDATE_BRANCH_REMOVAL')) {
    logFeatureDisabledWarning(
      'VALIDATE_BRANCH_REMOVAL',
      'validateCategoryBranchRemoval middleware',
      {
        companyId: req.user?.companyId,
        userId: req.user?.userId,
        categoryId: req.params?.categoryId,
        branchId: req.body?.branchId,
        operation: 'branch_removal_validation'
      }
    );
    // Skip validation and continue to next middleware
    return next();
  }

  try {
    // Extract user and company info from authenticated request
    const { companyId, userId } = req.user;
    const { categoryId } = req.params;
    const { branchId, isSubcategory } = req.body;

    // Validate required fields
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Category ID is required'
      });
    }

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Validate ObjectId formats
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid branch ID format'
      });
    }

    // Get company database connection
    const companyDB = getCompanyDB(companyId);
    const validationService = new CategoryBranchValidationService(companyDB);

    // Validate branch removal
    const validationResult = await validationService.validateBranchRemoval(
      categoryId,
      branchId,
      isSubcategory || false,
      userId
    );

    // If removal is not allowed, return error with dependency details
    if (!validationResult.canRemove) {
      const { dependencies } = validationResult;
      
      // Get category name for error message
      const Category = companyDB.model('Category');
      const category = await Category.findById(categoryId).select('name').lean();
      const categoryName = category ? category.name : 'Unknown';

      // Get branch name for error message
      const Branch = companyDB.model('Branch');
      const branch = await Branch.findById(branchId).select('name').lean();
      const branchName = branch ? branch.name : 'Unknown';

      logger.warn('Branch removal blocked due to dependencies', {
        companyId,
        userId,
        categoryId,
        branchId,
        dependencyCount: dependencies.total
      });

      // Return validation error with dependency details
      return res.status(409).json({
        success: false,
        error: {
          code: 'CATEGORY_BRANCH_MISMATCH',
          message: `Cannot remove Branch '${branchName}' from ${isSubcategory ? 'Subcategory' : 'Category'} '${categoryName}'`,
          details: {
            categoryId,
            categoryName,
            branchId,
            branchName,
            dependencies: {
              items: {
                count: dependencies.items.count,
                examples: dependencies.items.items
              },
              suppliers: {
                count: dependencies.suppliers.count,
                examples: dependencies.suppliers.suppliers
              }
            }
          }
        }
      });
    }

    // Attach validation result to request for controller
    req.branchRemovalValidation = validationResult;

    // Continue to next middleware/controller
    next();

  } catch (error) {
    logger.error('Error in validateCategoryBranchRemoval middleware', {
      error: error.message,
      stack: error.stack,
      companyId: req.user?.companyId,
      userId: req.user?.userId
    });

    // Return error response
    return res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Failed to validate branch removal',
        details: {
          operation: 'branch_removal_validation',
          reason: error.message
        }
      }
    });
  }
};

/**
 * Middleware to validate category updates that might remove branches
 * Prevents branch removal if items or suppliers depend on the category in those branches
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 7.1, 7.2, 7.3
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export const validateCategoryUpdate = async (req, res, next) => {
  // Check if branch removal validation feature is enabled
  if (!isFeatureEnabled('VALIDATE_BRANCH_REMOVAL')) {
    logFeatureDisabledWarning(
      'VALIDATE_BRANCH_REMOVAL',
      'validateCategoryUpdate middleware',
      {
        companyId: req.user?.companyId,
        userId: req.user?.userId,
        categoryId: req.params?.id,
        operation: 'category_update_validation'
      }
    );
    // Skip validation and continue to next middleware
    return next();
  }

  try {
    // Extract user and company info from authenticated request
    const { companyId, userId } = req.user;
    const { id: categoryId } = req.params;
    const updateData = req.body;

    // Only validate if branchIds are being updated
    if (!updateData.branchIds || !Array.isArray(updateData.branchIds)) {
      return next();
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format'
      });
    }

    // Get company database connection
    const companyDB = getCompanyDB(companyId);
    const Category = companyDB.model('Category');
    const validationService = new CategoryBranchValidationService(companyDB);

    // Get existing category to compare branches
    const existingCategory = await Category.findById(categoryId).select('branchIds parent').lean();
    
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Determine which branches are being removed
    const existingBranchIds = existingCategory.branchIds.map(id => id.toString());
    const newBranchIds = updateData.branchIds.map(id => id.toString());
    const removedBranchIds = existingBranchIds.filter(id => !newBranchIds.includes(id));

    // If no branches are being removed, skip validation
    if (removedBranchIds.length === 0) {
      return next();
    }

    // Determine if this is a subcategory
    const isSubcategory = !!existingCategory.parent;

    // Validate each branch removal
    const validationErrors = [];
    
    for (const branchId of removedBranchIds) {
      const validationResult = await validationService.validateBranchRemoval(
        categoryId,
        branchId,
        isSubcategory,
        userId
      );

      if (!validationResult.canRemove) {
        // Get branch name for error message
        const Branch = companyDB.model('Branch');
        const branch = await Branch.findById(branchId).select('name').lean();
        const branchName = branch ? branch.name : 'Unknown';

        validationErrors.push({
          branchId,
          branchName,
          dependencies: validationResult.dependencies
        });
      }
    }

    // If any branch removal is blocked, return error
    if (validationErrors.length > 0) {
      // Get category name for error message
      const category = await Category.findById(categoryId).select('name').lean();
      const categoryName = category ? category.name : 'Unknown';

      logger.warn('Category update blocked due to branch dependencies', {
        companyId,
        userId,
        categoryId,
        removedBranches: removedBranchIds,
        validationErrors: validationErrors.length
      });

      // Build detailed error message
      const branchMessages = validationErrors.map(err => {
        const itemCount = err.dependencies.items.count;
        const supplierCount = err.dependencies.suppliers.count;
        return `Branch '${err.branchName}': ${itemCount} item(s), ${supplierCount} supplier(s)`;
      }).join('; ');

      // Return validation error with dependency details
      return res.status(409).json({
        success: false,
        error: {
          code: 'CATEGORY_BRANCH_MISMATCH',
          message: `Cannot remove branches from ${isSubcategory ? 'Subcategory' : 'Category'} '${categoryName}' due to dependencies`,
          details: {
            categoryId,
            categoryName,
            removedBranches: validationErrors,
            summary: branchMessages
          }
        }
      });
    }

    // All validations passed, continue to next middleware/controller
    next();

  } catch (error) {
    logger.error('Error in validateCategoryUpdate middleware', {
      error: error.message,
      stack: error.stack,
      companyId: req.user?.companyId,
      userId: req.user?.userId
    });

    // Return error response
    return res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Failed to validate category update',
        details: {
          operation: 'category_update_validation',
          reason: error.message
        }
      }
    });
  }
};

/**
 * Middleware to validate category deletion
 * Prevents deletion if items or suppliers depend on the category in any branch
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export const validateCategoryDeletion = async (req, res, next) => {
  // Check if branch removal validation feature is enabled
  if (!isFeatureEnabled('VALIDATE_BRANCH_REMOVAL')) {
    logFeatureDisabledWarning(
      'VALIDATE_BRANCH_REMOVAL',
      'validateCategoryDeletion middleware',
      {
        companyId: req.user?.companyId,
        userId: req.user?.userId,
        categoryId: req.params?.id,
        operation: 'category_deletion_validation'
      }
    );
    // Skip validation and continue to next middleware
    return next();
  }

  try {
    // Extract user and company info from authenticated request
    const { companyId, userId } = req.user;
    const { id: categoryId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format'
      });
    }

    // Get company database connection
    const companyDB = getCompanyDB(companyId);
    const Category = companyDB.model('Category');
    const validationService = new CategoryBranchValidationService(companyDB);

    // Get category to check its branches
    const category = await Category.findById(categoryId).select('branchIds parent name').lean();
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Determine if this is a subcategory
    const isSubcategory = !!category.parent;

    // Check dependencies in all branches
    const branchDependencies = [];
    
    for (const branchId of category.branchIds) {
      const validationResult = await validationService.validateBranchRemoval(
        categoryId,
        branchId.toString(),
        isSubcategory,
        userId
      );

      if (!validationResult.canRemove) {
        // Get branch name for error message
        const Branch = companyDB.model('Branch');
        const branch = await Branch.findById(branchId).select('name').lean();
        const branchName = branch ? branch.name : 'Unknown';

        branchDependencies.push({
          branchId: branchId.toString(),
          branchName,
          dependencies: validationResult.dependencies
        });
      }
    }

    // If any branch has dependencies, block deletion
    if (branchDependencies.length > 0) {
      logger.warn('Category deletion blocked due to dependencies', {
        companyId,
        userId,
        categoryId,
        branchesWithDependencies: branchDependencies.length
      });

      // Build detailed error message
      const branchMessages = branchDependencies.map(dep => {
        const itemCount = dep.dependencies.items.count;
        const supplierCount = dep.dependencies.suppliers.count;
        return `Branch '${dep.branchName}': ${itemCount} item(s), ${supplierCount} supplier(s)`;
      }).join('; ');

      // Return validation error with dependency details
      return res.status(409).json({
        success: false,
        error: {
          code: 'CATEGORY_HAS_DEPENDENCIES',
          message: `Cannot delete ${isSubcategory ? 'Subcategory' : 'Category'} '${category.name}' because it has dependencies`,
          details: {
            categoryId,
            categoryName: category.name,
            branchesWithDependencies: branchDependencies,
            summary: branchMessages
          }
        }
      });
    }

    // All validations passed, continue to next middleware/controller
    next();

  } catch (error) {
    logger.error('Error in validateCategoryDeletion middleware', {
      error: error.message,
      stack: error.stack,
      companyId: req.user?.companyId,
      userId: req.user?.userId
    });

    // Return error response
    return res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Failed to validate category deletion',
        details: {
          operation: 'category_deletion_validation',
          reason: error.message
        }
      }
    });
  }
};
