/**
 * Category-Branch Validation Service
 * Centralized service for category-branch consistency operations
 * Handles automatic assignment and validation of category-branch relationships
 */

import mongoose from 'mongoose';
import { getCategoryModel } from '../models/company/Category.js';
import { getInventoryItemModel } from '../models/company/InventoryItem.js';
import { getSupplierModel } from '../models/company/Supplier.js';
import { getCategoryBranchAuditLogModel } from '../models/company/CategoryBranchAuditLog.js';
import { logger } from '../utils/logger.js';
import { isFeatureEnabled, logFeatureDisabledWarning } from '../config/featureFlags.js';

/**
 * Category-Branch Validation Service Class
 */
class CategoryBranchValidationService {
  /**
   * Constructor
   * @param {Object} companyDB - Company database connection
   */
  constructor(companyDB) {
    if (!companyDB) {
      throw new Error('Company database connection is required');
    }
    
    this.companyDB = companyDB;
    this.Category = getCategoryModel(companyDB);
    this.InventoryItem = getInventoryItemModel(companyDB);
    this.Supplier = getSupplierModel(companyDB);
    this.AuditLog = getCategoryBranchAuditLogModel(companyDB);
  }

  /**
   * Check if categories and subcategories are accessible from given branches
   * @param {string[]} branchIds - Array of branch IDs
   * @param {string[]} categoryIds - Array of category IDs to check
   * @param {string[]} subcategoryIds - Array of subcategory IDs to check
   * @returns {Promise<{valid: boolean, missingAssignments: Object}>}
   */
  async checkCategoryBranchAccess(branchIds, categoryIds, subcategoryIds) {
    try {
      // Validate inputs
      if (!Array.isArray(branchIds) || branchIds.length === 0) {
        throw new Error('branchIds must be a non-empty array');
      }

      // Convert string IDs to ObjectIds for validation
      const validBranchIds = branchIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validBranchIds.length !== branchIds.length) {
        throw new Error('Invalid branch ID format');
      }

      const missingAssignments = {
        categories: [],
        subcategories: []
      };

      // Check categories
      if (categoryIds && categoryIds.length > 0) {
        const validCategoryIds = categoryIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validCategoryIds.length !== categoryIds.length) {
          throw new Error('Invalid category ID format');
        }

        for (const categoryId of validCategoryIds) {
          // Try to get from cache first (only if caching is enabled)
          let categoryBranchIds = null;
          
          
          if (!categoryBranchIds) {
            // Cache miss or caching disabled - fetch from database
            const category = await this.Category.findById(categoryId).lean();
            
            if (!category) {
              logger.warn(`Category not found: ${categoryId}`);
              continue;
            }

            categoryBranchIds = category.branchIds.map(id => id.toString());
            
          }

          // Check which branches don't have access to this category
          const missingBranches = validBranchIds.filter(
            branchId => !categoryBranchIds.includes(branchId.toString())
          );

          if (missingBranches.length > 0) {
            // Fetch category name if not in cache (we only cached branch IDs)
            const category = await this.Category.findById(categoryId).select('name').lean();
            
            missingAssignments.categories.push({
              categoryId: categoryId,
              categoryName: category?.name || 'Unknown',
              missingBranchIds: missingBranches
            });
          }
        }
      }

      // Check subcategories
      if (subcategoryIds && subcategoryIds.length > 0) {
        const validSubcategoryIds = subcategoryIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validSubcategoryIds.length !== subcategoryIds.length) {
          throw new Error('Invalid subcategory ID format');
        }

        for (const subcategoryId of validSubcategoryIds) {
          // Try to get from cache first (only if caching is enabled)
          let subcategoryBranchIds = null;
          
          
          if (!subcategoryBranchIds) {
            // Cache miss or caching disabled - fetch from database
            const subcategory = await this.Category.findById(subcategoryId).lean();
            
            if (!subcategory) {
              logger.warn(`Subcategory not found: ${subcategoryId}`);
              continue;
            }

            subcategoryBranchIds = subcategory.branchIds.map(id => id.toString());
            
          }

          // Check which branches don't have access to this subcategory
          const missingBranches = validBranchIds.filter(
            branchId => !subcategoryBranchIds.includes(branchId.toString())
          );

          if (missingBranches.length > 0) {
            // Fetch subcategory name if not in cache (we only cached branch IDs)
            const subcategory = await this.Category.findById(subcategoryId).select('name').lean();
            
            missingAssignments.subcategories.push({
              subcategoryId: subcategoryId,
              subcategoryName: subcategory?.name || 'Unknown',
              missingBranchIds: missingBranches
            });
          }
        }
      }

      const valid = missingAssignments.categories.length === 0 && 
                    missingAssignments.subcategories.length === 0;

      return {
        valid,
        missingAssignments
      };
    } catch (error) {
      logger.error('Error checking category-branch access:', error);
      throw error;
    }
  }

  /**
   * Find all inventory items using a category/subcategory in a specific branch
   * @param {string} categoryId - Category ID to check
   * @param {string} branchId - Branch ID to check
   * @param {boolean} isSubcategory - Whether checking subcategory
   * @returns {Promise<{count: number, items: Array}>}
   */
  async findDependentItems(categoryId, branchId, isSubcategory = false) {
    try {
      // Validate inputs
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new Error('Invalid category ID format');
      }
      if (!mongoose.Types.ObjectId.isValid(branchId)) {
        throw new Error('Invalid branch ID format');
      }

      // Build query
      const query = {
        branchIds: branchId,
        isActive: true
      };

      if (isSubcategory) {
        query.subcategory = categoryId;
      } else {
        query.category = categoryId;
      }

      // Find items
      const items = await this.InventoryItem.find(query)
        .select('_id name type sku')
        .limit(10)
        .lean();

      const count = await this.InventoryItem.countDocuments(query);

      return {
        count,
        items: items.map(item => ({
          id: item._id,
          name: item.name,
          type: item.type,
          sku: item.sku
        }))
      };
    } catch (error) {
      logger.error('Error finding dependent items:', error);
      throw error;
    }
  }

  /**
   * Find all suppliers using a category/subcategory in a specific branch
   * @param {string} categoryId - Category ID to check
   * @param {string} branchId - Branch ID to check
   * @param {boolean} isSubcategory - Whether checking subcategory
   * @returns {Promise<{count: number, suppliers: Array}>}
   */
  async findDependentSuppliers(categoryId, branchId, isSubcategory = false) {
    try {
      // Validate inputs
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new Error('Invalid category ID format');
      }
      if (!mongoose.Types.ObjectId.isValid(branchId)) {
        throw new Error('Invalid branch ID format');
      }

      // Build query
      const query = {
        branchIds: branchId,
        isActive: true
      };

      if (isSubcategory) {
        query.subcategoryIds = categoryId;
      } else {
        query.categoryIds = categoryId;
      }

      // Find suppliers
      const suppliers = await this.Supplier.find(query)
        .select('_id name contactPerson phone')
        .limit(10)
        .lean();

      const count = await this.Supplier.countDocuments(query);

      return {
        count,
        suppliers: suppliers.map(supplier => ({
          id: supplier._id,
          name: supplier.name,
          contactPerson: supplier.contactPerson,
          phone: supplier.phone
        }))
      };
    } catch (error) {
      logger.error('Error finding dependent suppliers:', error);
      throw error;
    }
  }

  /**
   * Automatically assign categories and subcategories to branches with optimistic locking
   * @param {string[]} branchIds - Branches to assign to
   * @param {string[]} categoryIds - Categories to assign
   * @param {string[]} subcategoryIds - Subcategories to assign
   * @param {string} userId - User performing the action
   * @param {string} reason - Reason for assignment (e.g., "item_assignment")
   * @param {Object} session - MongoDB session for transaction support
   * @returns {Promise<{assigned: Object, alreadyAssigned: Object}>}
   */
  async assignCategoriesToBranches(branchIds, categoryIds, subcategoryIds, userId, reason, session = null) {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        return await this._assignCategoriesToBranchesWithLocking(
          branchIds, 
          categoryIds, 
          subcategoryIds, 
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
   * Internal method to assign categories with optimistic locking
   * @private
   */
  async _assignCategoriesToBranchesWithLocking(branchIds, categoryIds, subcategoryIds, userId, reason, session = null) {
    try {
      // Validate inputs
      if (!Array.isArray(branchIds) || branchIds.length === 0) {
        throw new Error('branchIds must be a non-empty array');
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

      const assigned = {
        categories: [],
        subcategories: []
      };

      const alreadyAssigned = {
        categories: [],
        subcategories: []
      };

      // Process categories
      if (categoryIds && categoryIds.length > 0) {
        const validCategoryIds = categoryIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        
        for (const categoryId of validCategoryIds) {
          const categoryQuery = this.Category.findById(categoryId);
          if (session) categoryQuery.session(session);
          const category = await categoryQuery;
          
          if (!category) {
            logger.warn(`Category not found: ${categoryId}`);
            continue;
          }

          const categoryBranchIds = category.branchIds.map(id => id.toString());
          const newBranches = validBranchIds.filter(
            branchId => !categoryBranchIds.includes(branchId.toString())
          );

          if (newBranches.length > 0) {
            // Use findOneAndUpdate with version checking for optimistic locking
            const updateOptions = { 
              new: true,
              runValidators: true
            };
            if (session) updateOptions.session = session;
            
            const updatedCategory = await this.Category.findOneAndUpdate(
              { 
                _id: categoryId,
                __v: category.__v  // Version check
              },
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


            assigned.categories.push({
              categoryId: categoryId,
              categoryName: updatedCategory.name,
              branchIds: newBranches
            });

            // Create audit log (only if audit logging is enabled)
            if (isFeatureEnabled('ENABLE_AUDIT_LOGGING')) {
              await this.createAuditLog(
                userId,
                'auto_assign_category',
                'category',
                categoryId,
                categoryId,
                null,
                newBranches,
                reason,
                { categoryName: updatedCategory.name },
                session
              );
            } else {
              logFeatureDisabledWarning(
                'ENABLE_AUDIT_LOGGING',
                'assignCategoriesToBranches - category assignment',
                { categoryId, branchIds: newBranches }
              );
            }

            logger.info(`Auto-assigned category ${categoryId} to branches: ${newBranches.join(', ')}`);
          } else {
            alreadyAssigned.categories.push({
              categoryId: categoryId,
              categoryName: category.name
            });
          }
        }
      }

      // Process subcategories
      if (subcategoryIds && subcategoryIds.length > 0) {
        const validSubcategoryIds = subcategoryIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        
        for (const subcategoryId of validSubcategoryIds) {
          const subcategoryQuery = this.Category.findById(subcategoryId);
          if (session) subcategoryQuery.session(session);
          const subcategory = await subcategoryQuery;
          
          if (!subcategory) {
            logger.warn(`Subcategory not found: ${subcategoryId}`);
            continue;
          }

          const subcategoryBranchIds = subcategory.branchIds.map(id => id.toString());
          const newBranches = validBranchIds.filter(
            branchId => !subcategoryBranchIds.includes(branchId.toString())
          );

          if (newBranches.length > 0) {
            // Use findOneAndUpdate with version checking for optimistic locking
            const updateOptions = { 
              new: true,
              runValidators: true
            };
            if (session) updateOptions.session = session;
            
            const updatedSubcategory = await this.Category.findOneAndUpdate(
              { 
                _id: subcategoryId,
                __v: subcategory.__v  // Version check
              },
              { 
                $addToSet: { branchIds: { $each: newBranches } },
                $inc: { __v: 1 }  // Increment version
              },
              updateOptions
            );

            if (!updatedSubcategory) {
              // Version mismatch - concurrent modification detected
              const error = new Error('Concurrent modification detected');
              error.name = 'VersionError';
              throw error;
            }



            assigned.subcategories.push({
              subcategoryId: subcategoryId,
              subcategoryName: updatedSubcategory.name,
              branchIds: newBranches
            });

            // Create audit log (only if audit logging is enabled)
            if (isFeatureEnabled('ENABLE_AUDIT_LOGGING')) {
              await this.createAuditLog(
                userId,
                'auto_assign_subcategory',
                'category',
                subcategoryId,
                updatedSubcategory.parent,
                subcategoryId,
                newBranches,
                reason,
                { subcategoryName: updatedSubcategory.name },
                session
              );
            } else {
              logFeatureDisabledWarning(
                'ENABLE_AUDIT_LOGGING',
                'assignCategoriesToBranches - subcategory assignment',
                { subcategoryId, branchIds: newBranches }
              );
            }

            logger.info(`Auto-assigned subcategory ${subcategoryId} to branches: ${newBranches.join(', ')}`);
          } else {
            alreadyAssigned.subcategories.push({
              subcategoryId: subcategoryId,
              subcategoryName: subcategory.name
            });
          }
        }
      }

      return {
        assigned,
        alreadyAssigned
      };
    } catch (error) {
      logger.error('Error assigning categories to branches:', error);
      throw error;
    }
  }

  /**
   * Automatically assign supplier to branches
   * @param {string[]} branchIds - Branches to assign to
   * @param {string} supplierId - Supplier to assign
   * @param {string} userId - User performing the action
   * @param {string} reason - Reason for assignment
   * @param {Object} session - MongoDB session for transaction support
   * @returns {Promise<{assigned: Object, alreadyAssigned: Object}>}
   */
  async assignSupplierToBranches(branchIds, supplierId, userId, reason, session = null) {
    try {
      // Validate inputs
      if (!Array.isArray(branchIds) || branchIds.length === 0) {
        throw new Error('branchIds must be a non-empty array');
      }
      if (!supplierId) {
        throw new Error('supplierId is required');
      }
      if (!userId) {
        throw new Error('userId is required');
      }
      if (!reason) {
        throw new Error('reason is required');
      }

      // Validate branch IDs format
      const validBranchIds = branchIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validBranchIds.length !== branchIds.length) {
        throw new Error('Invalid branch ID format');
      }

      // Validate supplier ID format
      if (!mongoose.Types.ObjectId.isValid(supplierId)) {
        throw new Error('Invalid supplier ID format');
      }

      const assigned = {
        suppliers: []
      };

      const alreadyAssigned = {
        suppliers: []
      };

      // Get supplier document
      const supplierQuery = this.Supplier.findById(supplierId);
      if (session) supplierQuery.session(session);
      const supplier = await supplierQuery;

      if (!supplier) {
        throw new Error(`Supplier not found: ${supplierId}`);
      }

      // Check which branches don't have the supplier
      const supplierBranchIds = supplier.branchIds.map(id => id.toString());
      const newBranches = validBranchIds.filter(
        branchId => !supplierBranchIds.includes(branchId.toString())
      );

      if (newBranches.length > 0) {
        // Add branches to supplier's branchIds array
        const updateOptions = { 
          new: true,
          runValidators: true
        };
        if (session) updateOptions.session = session;

        const updatedSupplier = await this.Supplier.findByIdAndUpdate(
          supplierId,
          { 
            $addToSet: { branchIds: { $each: newBranches } }
          },
          updateOptions
        );

        if (!updatedSupplier) {
          throw new Error(`Failed to update supplier: ${supplierId}`);
        }

        assigned.suppliers.push({
          supplierId: supplierId,
          supplierName: updatedSupplier.name,
          branchIds: newBranches
        });

        // Create audit log (only if audit logging is enabled)
        if (isFeatureEnabled('ENABLE_AUDIT_LOGGING')) {
          await this.createAuditLog(
            userId,
            'auto_assign_supplier',
            'supplier',
            supplierId,
            null,
            null,
            newBranches,
            reason,
            { supplierName: updatedSupplier.name },
            session
          );
        } else {
          logFeatureDisabledWarning(
            'ENABLE_AUDIT_LOGGING',
            'assignSupplierToBranches - supplier assignment',
            { supplierId, branchIds: newBranches }
          );
        }

        logger.info(`Auto-assigned supplier ${supplierId} to branches: ${newBranches.join(', ')}`);
      } else {
        alreadyAssigned.suppliers.push({
          supplierId: supplierId,
          supplierName: supplier.name
        });
      }

      return {
        assigned,
        alreadyAssigned
      };
    } catch (error) {
      logger.error('Error assigning supplier to branches:', error);
      throw error;
    }
  }

  /**
   * Validate branch removal from category/subcategory
   * @param {string} categoryId - Category ID
   * @param {string} branchId - Branch ID to remove
   * @param {boolean} isSubcategory - Whether it's a subcategory
   * @param {string} userId - User performing the action (optional, for audit logging)
   * @param {Object} session - MongoDB session for transaction support
   * @returns {Promise<{canRemove: boolean, dependencies: Object}>}
   */
  async validateBranchRemoval(categoryId, branchId, isSubcategory = false, userId = null, session = null) {
    try {
      // Validate inputs
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new Error('Invalid category ID format');
      }
      if (!mongoose.Types.ObjectId.isValid(branchId)) {
        throw new Error('Invalid branch ID format');
      }

      // Find dependent items and suppliers
      const [itemDependencies, supplierDependencies] = await Promise.all([
        this.findDependentItems(categoryId, branchId, isSubcategory),
        this.findDependentSuppliers(categoryId, branchId, isSubcategory)
      ]);

      const totalDependencies = itemDependencies.count + supplierDependencies.count;
      const canRemove = totalDependencies === 0;

      const dependencies = {
        items: itemDependencies,
        suppliers: supplierDependencies,
        total: totalDependencies
      };

      // Create audit log if userId is provided (and audit logging is enabled)
      if (userId && isFeatureEnabled('ENABLE_AUDIT_LOGGING')) {
        const category = await this.Category.findById(categoryId).select('name parent').lean();
        const action = canRemove ? 'branch_removal_success' : 'branch_removal_blocked';
        
        await this.createAuditLog(
          userId,
          action,
          'category',
          categoryId,
          isSubcategory ? null : categoryId,
          isSubcategory ? categoryId : null,
          [branchId],
          canRemove ? 'Branch removal validated - no dependencies' : 'Branch removal blocked - dependencies exist',
          {
            categoryName: category?.name,
            isSubcategory,
            dependencyCount: totalDependencies,
            itemCount: itemDependencies.count,
            supplierCount: supplierDependencies.count
          },
          session
        );
      } else if (userId && !isFeatureEnabled('ENABLE_AUDIT_LOGGING')) {
        logFeatureDisabledWarning(
          'ENABLE_AUDIT_LOGGING',
          'validateBranchRemoval',
          { categoryId, branchId, isSubcategory }
        );
      }

      return {
        canRemove,
        dependencies
      };
    } catch (error) {
      logger.error('Error validating branch removal:', error);
      throw error;
    }
  }

  /**
   * Batch validate multiple items/suppliers
   * @param {Array} entities - Array of items or suppliers to validate
   * @param {string} entityType - "item" or "supplier"
   * @returns {Promise<{valid: boolean, errors: Array}>}
   */
  async batchValidate(entities, entityType) {
    try {
      // Validate inputs
      if (!Array.isArray(entities) || entities.length === 0) {
        throw new Error('entities must be a non-empty array');
      }
      if (!['item', 'supplier'].includes(entityType)) {
        throw new Error('entityType must be "item" or "supplier"');
      }

      const errors = [];
      const validationPromises = [];

      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        
        // Validate entity structure
        if (!entity.branchIds || !Array.isArray(entity.branchIds) || entity.branchIds.length === 0) {
          errors.push({
            index: i,
            entityId: entity._id || entity.id,
            error: 'branchIds must be a non-empty array'
          });
          continue;
        }

        // Prepare category and subcategory IDs based on entity type
        let categoryIds = [];
        let subcategoryIds = [];

        if (entityType === 'item') {
          if (entity.category) {
            categoryIds = [entity.category];
          }
          if (entity.subcategory) {
            subcategoryIds = [entity.subcategory];
          }
        } else if (entityType === 'supplier') {
          categoryIds = entity.categoryIds || [];
          subcategoryIds = entity.subcategoryIds || [];
        }

        // Validate category-branch access
        validationPromises.push(
          this.checkCategoryBranchAccess(entity.branchIds, categoryIds, subcategoryIds)
            .then(result => {
              if (!result.valid) {
                errors.push({
                  index: i,
                  entityId: entity._id || entity.id,
                  error: 'Category-branch access validation failed',
                  missingAssignments: result.missingAssignments
                });
              }
            })
            .catch(err => {
              errors.push({
                index: i,
                entityId: entity._id || entity.id,
                error: err.message
              });
            })
        );
      }

      // Wait for all validations to complete
      await Promise.all(validationPromises);

      const valid = errors.length === 0;

      return {
        valid,
        errors
      };
    } catch (error) {
      logger.error('Error in batch validation:', error);
      throw error;
    }
  }

  /**
   * Create audit log entry
   * @param {string} userId - User ID
   * @param {string} action - Action performed
   * @param {string} entityType - Entity type
   * @param {string} entityId - Entity ID
   * @param {string} categoryId - Category ID
   * @param {string} subcategoryId - Subcategory ID
   * @param {string[]} branchIds - Branch IDs
   * @param {string} reason - Reason for action
   * @param {Object} metadata - Additional metadata
   * @param {Object} session - MongoDB session for transaction support
   * @returns {Promise<void>}
   */
  async createAuditLog(userId, action, entityType, entityId, categoryId, subcategoryId, branchIds, reason, metadata = {}, session = null) {
    try {
      // Validate required fields
      if (!userId || !action || !entityType || !entityId || !reason) {
        throw new Error('Missing required audit log fields');
      }

      const auditLog = new this.AuditLog({
        userId,
        action,
        entityType,
        entityId,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        branchIds: branchIds || [],
        reason,
        metadata
      });

      await auditLog.save({ session });

      logger.info(`Audit log created: ${action} for ${entityType} ${entityId}`);
    } catch (error) {
      logger.error('Error creating audit log:', error);
      throw error;
    }
  }
}

export default CategoryBranchValidationService;
