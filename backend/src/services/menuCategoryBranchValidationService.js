/**
 * Menu Category-Branch Validation Service
 * Centralized service for menu category-branch consistency operations
 * Handles automatic assignment and validation of menu category-branch relationships
 */

import mongoose from 'mongoose';
import { getMenuCategoryModel } from '../models/company/MenuCategory.js';
import { getMenuItemModel } from '../models/company/MenuItem.js';
import { getMenuItemBranchModel } from '../models/company/MenuItemBranch.js';
import { logger } from '../utils/logger.js';

/**
 * Menu Category-Branch Validation Service Class
 */
class MenuCategoryBranchValidationService {
  /**
   * Constructor
   * @param {Object} companyDB - Company database connection
   */
  constructor(companyDB) {
    if (!companyDB) {
      throw new Error('Company database connection is required');
    }
    
    this.companyDB = companyDB;
    this.MenuCategory = getMenuCategoryModel(companyDB);
    this.MenuItem = getMenuItemModel(companyDB);
    this.MenuItemBranch = getMenuItemBranchModel(companyDB);
  }

  /**
   * Check if menu category is accessible from given branches
   * @param {string[]} branchIds - Array of branch IDs
   * @param {string} categoryId - Category ID to check
   * @returns {Promise<{valid: boolean, missingBranches: string[]}>}
   */
  async checkCategoryBranchAccess(branchIds, categoryId) {
    try {
      // Validate inputs
      if (!Array.isArray(branchIds) || branchIds.length === 0) {
        throw new Error('branchIds must be a non-empty array');
      }

      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new Error('Invalid category ID format');
      }

      // Get category
      const category = await this.MenuCategory.findById(categoryId).lean();
      
      if (!category) {
        throw new Error('Menu category not found');
      }

      const categoryBranchIds = category.branchIds.map(id => id.toString());

      // Check which branches don't have access to this category
      const missingBranches = branchIds.filter(
        branchId => !categoryBranchIds.includes(branchId.toString())
      );

      return {
        valid: missingBranches.length === 0,
        missingBranches,
        categoryName: category.name
      };
    } catch (error) {
      logger.error('Error checking menu category-branch access:', error);
      throw error;
    }
  }

  /**
   * Find all menu items using a category in specific branches
   * @param {string} categoryId - Category ID to check
   * @param {string[]} branchIds - Branch IDs to check (optional, checks all if not provided)
   * @returns {Promise<{count: number, items: Array}>}
   */
  async findDependentMenuItems(categoryId, branchIds = null) {
    try {
      // Validate inputs
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new Error('Invalid category ID format');
      }

      // Find all menu items using this category
      const menuItems = await this.MenuItem.find({
        category: categoryId,
        isActive: true
      })
        .select('_id name basePrice')
        .lean();

      if (menuItems.length === 0) {
        return {
          count: 0,
          items: [],
          branchAssignments: []
        };
      }

      const menuItemIds = menuItems.map(item => item._id);

      // Build query for branch assignments
      const branchQuery = {
        menuItem: { $in: menuItemIds },
        isActive: true
      };

      if (branchIds && branchIds.length > 0) {
        branchQuery.branch = { $in: branchIds };
      }

      // Find branch assignments
      const branchAssignments = await this.MenuItemBranch.find(branchQuery)
        .populate('branch', 'name code')
        .populate('menuItem', 'name')
        .select('menuItem branch')
        .lean();

      return {
        count: branchAssignments.length,
        items: menuItems.map(item => ({
          id: item._id,
          name: item.name,
          basePrice: item.basePrice
        })),
        branchAssignments: branchAssignments.map(assignment => ({
          menuItemId: assignment.menuItem._id,
          menuItemName: assignment.menuItem.name,
          branchId: assignment.branch._id,
          branchName: assignment.branch.name,
          branchCode: assignment.branch.code
        }))
      };
    } catch (error) {
      logger.error('Error finding dependent menu items:', error);
      throw error;
    }
  }

  /**
   * Automatically assign menu category to branches
   * @param {string[]} branchIds - Branches to assign to
   * @param {string} categoryId - Category to assign
   * @param {string} userId - User performing the action
   * @param {string} reason - Reason for assignment (e.g., "menu_item_assignment")
   * @param {Object} session - MongoDB session for transaction support
   * @returns {Promise<{assigned: boolean, newBranches: string[], alreadyAssigned: boolean}>}
   */
  async assignCategoryToBranches(branchIds, categoryId, userId, reason, session = null) {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        return await this._assignCategoryToBranchesWithLocking(
          branchIds, 
          categoryId, 
          userId, 
          reason, 
          session
        );
      } catch (error) {
        // Check if it's a version conflict error
        if (error.name === 'VersionError' && attempt < maxRetries - 1) {
          attempt++;
          logger.warn(`Concurrent modification detected, retrying (attempt ${attempt}/${maxRetries})...`);
          // Add exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Internal method to assign category with optimistic locking
   * @private
   */
  async _assignCategoryToBranchesWithLocking(branchIds, categoryId, userId, reason, session = null) {
    try {
      logger.info(`[MenuCategoryBranchValidation] Starting assignment - Category: ${categoryId}, Branches: ${branchIds.join(', ')}, Reason: ${reason}`);
      
      // Validate inputs
      if (!Array.isArray(branchIds) || branchIds.length === 0) {
        throw new Error('branchIds must be a non-empty array');
      }
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new Error('Invalid category ID format');
      }
      if (!userId) {
        throw new Error('userId is required');
      }
      if (!reason) {
        throw new Error('reason is required');
      }

      const validBranchIds = branchIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validBranchIds.length !== branchIds.length) {
        throw new Error('Invalid branch ID format');
      }

      // Get category
      const categoryQuery = this.MenuCategory.findById(categoryId);
      if (session) categoryQuery.session(session);
      const category = await categoryQuery;
      
      if (!category) {
        throw new Error('Menu category not found');
      }

      logger.info(`[MenuCategoryBranchValidation] Found category: ${category.name}, Current branches: ${category.branchIds.map(id => id.toString()).join(', ')}`);

      const categoryBranchIds = category.branchIds.map(id => id.toString());
      const newBranches = validBranchIds.filter(
        branchId => !categoryBranchIds.includes(branchId.toString())
      );

      logger.info(`[MenuCategoryBranchValidation] New branches to assign: ${newBranches.length > 0 ? newBranches.join(', ') : 'None (already assigned)'}`);

      if (newBranches.length > 0) {
        // Use findOneAndUpdate with version checking for optimistic locking
        const updateOptions = { 
          new: true,
          runValidators: true
        };
        if (session) updateOptions.session = session;
        
        // Build update query with version check (if version exists)
        const updateQuery = { _id: categoryId };
        if (category.__v !== undefined) {
          updateQuery.__v = category.__v;
        }
        
        const updatedCategory = await this.MenuCategory.findOneAndUpdate(
          updateQuery,
          { 
            $addToSet: { branchIds: { $each: newBranches } },
            $inc: { __v: 1 }  // Increment version
          },
          updateOptions
        );

        if (!updatedCategory) {
          // Version mismatch - concurrent modification detected
          const error = new Error('Concurrent modification detected');
          error.name = 'VersionError';
          throw error;
        }

        logger.info(`✅ [MenuCategoryBranchValidation] Successfully assigned menu category ${categoryId} (${updatedCategory.name}) to branches: ${newBranches.join(', ')} - Reason: ${reason}`);

        return {
          assigned: true,
          newBranches,
          alreadyAssigned: false,
          categoryName: updatedCategory.name
        };
      } else {
        logger.info(`ℹ️  [MenuCategoryBranchValidation] Category ${category.name} already assigned to all requested branches`);
        
        return {
          assigned: false,
          newBranches: [],
          alreadyAssigned: true,
          categoryName: category.name
        };
      }
    } catch (error) {
      logger.error(`❌ [MenuCategoryBranchValidation] Error assigning menu category to branches:`, error);
      throw error;
    }
  }

  /**
   * Validate branch removal from menu category
   * @param {string} categoryId - Category ID
   * @param {string} branchId - Branch ID to remove
   * @param {string} userId - User performing the action
   * @param {Object} session - MongoDB session for transaction support
   * @returns {Promise<{canRemove: boolean, dependencies: Object, message: string}>}
   */
  async validateBranchRemoval(categoryId, branchId, userId = null, session = null) {
    try {
      // Validate inputs
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new Error('Invalid category ID format');
      }
      if (!mongoose.Types.ObjectId.isValid(branchId)) {
        throw new Error('Invalid branch ID format');
      }

      // Find dependent menu items in this branch
      const dependencies = await this.findDependentMenuItems(categoryId, [branchId]);

      const canRemove = dependencies.count === 0;

      let message = '';
      if (!canRemove) {
        const category = await this.MenuCategory.findById(categoryId).select('name').lean();
        message = `Cannot remove branch from category "${category.name}". ${dependencies.count} menu item(s) are using this category in this branch.`;
      }

      logger.info(`Branch removal validation for category ${categoryId}, branch ${branchId}: ${canRemove ? 'Allowed' : 'Blocked'}`);

      return {
        canRemove,
        dependencies,
        message
      };
    } catch (error) {
      logger.error('Error validating branch removal:', error);
      throw error;
    }
  }

  /**
   * Validate menu category deletion
   * @param {string} categoryId - Category ID to delete
   * @returns {Promise<{canDelete: boolean, dependencies: Object, message: string}>}
   */
  async validateCategoryDeletion(categoryId) {
    try {
      // Validate input
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new Error('Invalid category ID format');
      }

      // Find all dependent menu items across all branches
      const dependencies = await this.findDependentMenuItems(categoryId);

      const canDelete = dependencies.count === 0;

      let message = '';
      if (!canDelete) {
        const category = await this.MenuCategory.findById(categoryId).select('name').lean();
        const uniqueMenuItems = new Set(dependencies.branchAssignments.map(a => a.menuItemId.toString()));
        message = `Cannot delete category "${category.name}". ${uniqueMenuItems.size} menu item(s) are using this category across ${dependencies.count} branch assignment(s).`;
      }

      logger.info(`Category deletion validation for ${categoryId}: ${canDelete ? 'Allowed' : 'Blocked'}`);

      return {
        canDelete,
        dependencies,
        message
      };
    } catch (error) {
      logger.error('Error validating category deletion:', error);
      throw error;
    }
  }
}

export default MenuCategoryBranchValidationService;
