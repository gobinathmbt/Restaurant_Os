/**
 * Category-Branch Validation Middleware
 * Middleware functions for validating and auto-assigning category-branch relationships
 * Ensures data consistency across inventory items and suppliers
 */

import mongoose from 'mongoose';
import { getCompanyDB } from '../config/database.js';
import CategoryBranchValidationService from '../services/categoryBranchValidationService.js';
import { logger } from '../utils/logger.js';

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
  const session = await mongoose.startSession();
  
  try {
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

    // Prepare category and subcategory IDs
    const categoryIds = [itemData.category];
    const subcategoryIds = itemData.subcategory ? [itemData.subcategory] : [];

    // Start transaction
    session.startTransaction();

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

      const assignmentResult = await validationService.assignCategoriesToBranches(
        itemData.branchIds,
        categoryIds,
        subcategoryIds,
        userId,
        'item_assignment',
        session
      );

      // Attach assignment info to request for controller to include in response
      req.autoAssignments = assignmentResult.assigned;
    }

    // Commit transaction
    await session.commitTransaction();

    // Continue to next middleware/controller
    next();

  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    
    logger.error('Error in validateAndAssignItemCategories middleware', {
      error: error.message,
      stack: error.stack,
      companyId: req.user?.companyId,
      userId: req.user?.userId
    });

    // Return transaction error response
    return res.status(500).json({
      success: false,
      error: {
        code: 'TRANSACTION_FAILED',
        message: 'Failed to validate and assign categories',
        details: {
          operation: 'item_category_assignment',
          reason: error.message
        }
      }
    });

  } finally {
    // Always end session
    session.endSession();
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
  const session = await mongoose.startSession();
  
  try {
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

    // Start transaction
    session.startTransaction();

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

      const assignmentResult = await validationService.assignCategoriesToBranches(
        supplierData.branchIds,
        categoryIds,
        subcategoryIds,
        userId,
        'supplier_assignment',
        session
      );

      // Attach assignment info to request for controller to include in response
      req.autoAssignments = assignmentResult.assigned;
    }

    // Commit transaction
    await session.commitTransaction();

    // Continue to next middleware/controller
    next();

  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    
    logger.error('Error in validateAndAssignSupplierCategories middleware', {
      error: error.message,
      stack: error.stack,
      companyId: req.user?.companyId,
      userId: req.user?.userId
    });

    // Return transaction error response
    return res.status(500).json({
      success: false,
      error: {
        code: 'TRANSACTION_FAILED',
        message: 'Failed to validate and assign categories',
        details: {
          operation: 'supplier_category_assignment',
          reason: error.message
        }
      }
    });

  } finally {
    // Always end session
    session.endSession();
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
