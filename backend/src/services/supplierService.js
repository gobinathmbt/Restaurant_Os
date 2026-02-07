/**
 * Supplier Service
 * Business logic for supplier management operations
 */

import { getCompanyDB } from '../config/database.js';
import { getSupplierModel } from '../models/company/Supplier.js';
import { getCategoryModel } from '../models/company/Category.js';
import { getBranchModel } from '../models/company/Branch.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new supplier
 * @param {Object} supplierData - Supplier data
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (for company_admin)
 * @returns {Promise<Object>} Created supplier
 */
export const createSupplier = async (supplierData, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Supplier = getSupplierModel(companyDB);
    const Category = getCategoryModel(companyDB);

    // Validate required fields
    const requiredFields = ['name', 'phone', 'branchIds', 'categoryIds', 'subcategoryIds'];
    const missingFields = requiredFields.filter(field => !supplierData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate branchIds is an array and not empty
    if (!Array.isArray(supplierData.branchIds) || supplierData.branchIds.length === 0) {
      throw new Error('At least one branch must be assigned to the supplier');
    }

    // Validate categoryIds is an array and not empty
    if (!Array.isArray(supplierData.categoryIds) || supplierData.categoryIds.length === 0) {
      throw new Error('At least one main category must be assigned to the supplier');
    }

    // Validate subcategoryIds is an array and not empty
    if (!Array.isArray(supplierData.subcategoryIds) || supplierData.subcategoryIds.length === 0) {
      throw new Error('At least one subcategory must be assigned to the supplier');
    }

    // Validate main categories exist, are active, and have no parent
    const mainCategories = await Category.find({
      _id: { $in: supplierData.categoryIds },
      isActive: true,
      parent: null
    });

    if (mainCategories.length !== supplierData.categoryIds.length) {
      throw new Error('One or more selected main categories are invalid, inactive, or not main categories');
    }

    // Validate subcategories exist, are active, and have a parent
    const subcategories = await Category.find({
      _id: { $in: supplierData.subcategoryIds },
      isActive: true,
      parent: { $ne: null }
    });

    if (subcategories.length !== supplierData.subcategoryIds.length) {
      throw new Error('One or more selected subcategories are invalid, inactive, or not subcategories');
    }

    // Validate subcategories belong to selected main categories
    const invalidSubcategories = subcategories.filter(subcat => {
      const parentId = subcat.parent.toString();
      return !supplierData.categoryIds.some(catId => catId.toString() === parentId);
    });

    if (invalidSubcategories.length > 0) {
      throw new Error('All subcategories must belong to the selected main categories');
    }

    // Validate main categories belong to the assigned branches
    const invalidCategories = mainCategories.filter(category => {
      const categoryBranchIds = category.branchIds.map(id => id.toString());
      return !supplierData.branchIds.some(branchId => 
        categoryBranchIds.includes(branchId.toString())
      );
    });

    if (invalidCategories.length > 0) {
      throw new Error('Selected main categories must belong to the assigned branches');
    }

    // Validate subcategories belong to the assigned branches
    const invalidSubcats = subcategories.filter(subcat => {
      const subcatBranchIds = subcat.branchIds.map(id => id.toString());
      return !supplierData.branchIds.some(branchId => 
        subcatBranchIds.includes(branchId.toString())
      );
    });

    if (invalidSubcats.length > 0) {
      throw new Error('Selected subcategories must belong to the assigned branches');
    }


    // If user is company_admin, validate they can only assign branches they have access to
    if (userBranchIds && userBranchIds.length > 0) {
      const invalidBranches = supplierData.branchIds.filter(
        branchId => !userBranchIds.includes(branchId.toString())
      );
      
      if (invalidBranches.length > 0) {
        throw new Error('You can only assign suppliers to branches you have access to');
      }
    }

    // Initialize performance metrics to zero
    const performanceMetrics = {
      totalOrders: 0,
      totalPurchaseValue: 0,
      onTimeDeliveries: 0,
      lateDeliveries: 0,
      qualityIssues: 0
    };

    // Create supplier
    const supplier = new Supplier({
      ...supplierData,
      performanceMetrics,
      isActive: true
    });

    await supplier.save();

    logger.info(`Supplier created: ${supplier._id} for company: ${companyId}`);

    return supplier;
  } catch (error) {
    logger.error('Error creating supplier:', error);
    throw error;
  }
};

/**
 * Get suppliers with filtering and pagination
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @param {Array} userBranchIds - User's accessible branch IDs (for company_admin)
 * @returns {Promise<Object>} Paginated suppliers
 */
export const getSuppliers = async (companyId, filters = {}, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Supplier = getSupplierModel(companyDB);
    // Ensure Category and Branch models are registered for population
    getCategoryModel(companyDB);
    getBranchModel(companyDB);

    const {
      page = 1,
      limit = 10,
      search = '',
      category = '',
      subcategory = '',
      isActive = true,
      branchId = ''
    } = filters;

    // Build query - return only active suppliers by default
    const query = {
      isActive: isActive === 'false' ? false : true
    };

    // Branch filtering
    if (branchId && branchId !== 'all') {
      // Filter by specific branch
      query.branchIds = branchId;
    } else if (userBranchIds && userBranchIds.length > 0) {
      // For company_admin, only show suppliers assigned to their branches
      query.branchIds = { $in: userBranchIds };
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Category filter (main category)
    if (category && category !== 'all') {
      query.categoryIds = category;
    }

    // Subcategory filter
    if (subcategory && subcategory !== 'all') {
      query.subcategoryIds = subcategory;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [suppliers, total] = await Promise.all([
      Supplier.find(query)
        .populate('branchIds', 'name code')
        .populate('categoryIds', 'name color type')
        .populate('subcategoryIds', 'name color type parent')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Supplier.countDocuments(query)
    ]);

    // Calculate virtuals manually for lean queries
    const suppliersWithVirtuals = suppliers.map(supplier => {
      const totalDeliveries = supplier.performanceMetrics.onTimeDeliveries + supplier.performanceMetrics.lateDeliveries;
      const onTimeDeliveryRate = totalDeliveries === 0 ? 0 : (supplier.performanceMetrics.onTimeDeliveries / totalDeliveries) * 100;
      const averageOrderValue = supplier.performanceMetrics.totalOrders === 0 ? 0 : supplier.performanceMetrics.totalPurchaseValue / supplier.performanceMetrics.totalOrders;

      return {
        ...supplier,
        onTimeDeliveryRate,
        averageOrderValue
      };
    });

    return {
      suppliers: suppliersWithVirtuals,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting suppliers:', error);
    throw error;
  }
};

/**
 * Get supplier by ID
 * @param {string} supplierId - Supplier ID
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (for company_admin)
 * @returns {Promise<Object>} Supplier with calculated virtual fields
 */
export const getSupplierById = async (supplierId, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Supplier = getSupplierModel(companyDB);
    // Ensure Category and Branch models are registered for population
    getCategoryModel(companyDB);
    getBranchModel(companyDB);

    const supplier = await Supplier.findById(supplierId)
      .populate('branchIds', 'name code')
      .populate('categoryIds', 'name color type')
      .populate('subcategoryIds', 'name color type parent')
      .lean();

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    // If user is company_admin, verify they have access to at least one of the supplier's branches
    if (userBranchIds && userBranchIds.length > 0) {
      const hasAccess = supplier.branchIds.some(
        branch => userBranchIds.includes(branch._id.toString())
      );
      
      if (!hasAccess) {
        throw new Error('You do not have access to this supplier');
      }
    }

    // Calculate virtuals
    const totalDeliveries = supplier.performanceMetrics.onTimeDeliveries + supplier.performanceMetrics.lateDeliveries;
    const onTimeDeliveryRate = totalDeliveries === 0 ? 0 : (supplier.performanceMetrics.onTimeDeliveries / totalDeliveries) * 100;
    const averageOrderValue = supplier.performanceMetrics.totalOrders === 0 ? 0 : supplier.performanceMetrics.totalPurchaseValue / supplier.performanceMetrics.totalOrders;

    return {
      ...supplier,
      onTimeDeliveryRate,
      averageOrderValue
    };
  } catch (error) {
    logger.error('Error getting supplier by ID:', error);
    throw error;
  }
};

/**
 * Update supplier
 * @param {string} supplierId - Supplier ID
 * @param {Object} updateData - Update data
 * @param {string} companyId - Company ID
 * @param {Array} userBranchIds - User's accessible branch IDs (for company_admin)
 * @returns {Promise<Object>} Updated supplier
 */
export const updateSupplier = async (supplierId, updateData, companyId, userBranchIds = null) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Supplier = getSupplierModel(companyDB);
    const Category = getCategoryModel(companyDB);

    // Get existing supplier
    const existingSupplier = await Supplier.findById(supplierId);
    if (!existingSupplier) {
      throw new Error('Supplier not found');
    }

    // If user is company_admin, verify they have access to the supplier
    if (userBranchIds && userBranchIds.length > 0) {
      const hasAccess = existingSupplier.branchIds.some(
        branchId => userBranchIds.includes(branchId.toString())
      );
      
      if (!hasAccess) {
        throw new Error('You do not have access to this supplier');
      }

      // If updating branchIds, handle branch updates more flexibly
      if (updateData.branchIds) {
        if (!Array.isArray(updateData.branchIds) || updateData.branchIds.length === 0) {
          throw new Error('At least one branch must be assigned to the supplier');
        }

        // Get existing branches the user doesn't have access to
        const existingInaccessibleBranches = existingSupplier.branchIds
          .map(id => id.toString())
          .filter(branchId => !userBranchIds.includes(branchId));
        
        // Get new branches the user wants to add/keep
        const newAccessibleBranches = updateData.branchIds.filter(
          branchId => userBranchIds.includes(branchId.toString())
        );
        
        // Check if user is trying to add branches they don't have access to
        const unauthorizedNewBranches = updateData.branchIds.filter(
          branchId => !userBranchIds.includes(branchId.toString()) && 
                     !existingInaccessibleBranches.includes(branchId.toString())
        );
        
        if (unauthorizedNewBranches.length > 0) {
          throw new Error('You can only assign suppliers to branches you have access to');
        }
        
        // Merge: keep inaccessible branches + user's selected accessible branches
        // This allows branch managers to edit suppliers without affecting branches they don't manage
        updateData.branchIds = [...existingInaccessibleBranches, ...newAccessibleBranches];
        
        // Ensure at least one branch remains
        if (updateData.branchIds.length === 0) {
          throw new Error('At least one branch must be assigned to the supplier');
        }
      }
    }

    // Validate categoryIds if provided
    if (updateData.categoryIds) {
      if (!Array.isArray(updateData.categoryIds) || updateData.categoryIds.length === 0) {
        throw new Error('At least one main category must be assigned to the supplier');
      }

      // Validate main categories exist, are active, and have no parent
      const mainCategories = await Category.find({
        _id: { $in: updateData.categoryIds },
        isActive: true,
        parent: null
      });

      if (mainCategories.length !== updateData.categoryIds.length) {
        throw new Error('One or more selected main categories are invalid, inactive, or not main categories');
      }

      // Validate main categories belong to the assigned branches
      const branchIdsToCheck = updateData.branchIds || existingSupplier.branchIds;
      const invalidCategories = mainCategories.filter(category => {
        const categoryBranchIds = category.branchIds.map(id => id.toString());
        return !branchIdsToCheck.some(branchId => 
          categoryBranchIds.includes(branchId.toString())
        );
      });

      if (invalidCategories.length > 0) {
        throw new Error('Selected main categories must belong to the assigned branches');
      }
    }

    // Validate subcategoryIds if provided
    if (updateData.subcategoryIds) {
      if (!Array.isArray(updateData.subcategoryIds) || updateData.subcategoryIds.length === 0) {
        throw new Error('At least one subcategory must be assigned to the supplier');
      }

      // Validate subcategories exist, are active, and have a parent
      const subcategories = await Category.find({
        _id: { $in: updateData.subcategoryIds },
        isActive: true,
        parent: { $ne: null }
      });

      if (subcategories.length !== updateData.subcategoryIds.length) {
        throw new Error('One or more selected subcategories are invalid, inactive, or not subcategories');
      }

      // Validate subcategories belong to selected main categories
      const categoryIdsToCheck = updateData.categoryIds || existingSupplier.categoryIds;
      const invalidSubcategories = subcategories.filter(subcat => {
        const parentId = subcat.parent.toString();
        return !categoryIdsToCheck.some(catId => catId.toString() === parentId);
      });

      if (invalidSubcategories.length > 0) {
        throw new Error('All subcategories must belong to the selected main categories');
      }

      // Validate subcategories belong to the assigned branches
      const branchIdsToCheck = updateData.branchIds || existingSupplier.branchIds;
      const invalidSubcats = subcategories.filter(subcat => {
        const subcatBranchIds = subcat.branchIds.map(id => id.toString());
        return !branchIdsToCheck.some(branchId => 
          subcatBranchIds.includes(branchId.toString())
        );
      });

      if (invalidSubcats.length > 0) {
        throw new Error('Selected subcategories must belong to the assigned branches');
      }
    }

    // Validate data
    if (updateData.creditLimit !== undefined && updateData.creditLimit < 0) {
      throw new Error('Credit limit cannot be negative');
    }

    if (updateData.currentBalance !== undefined && updateData.currentBalance < 0) {
      throw new Error('Current balance cannot be negative');
    }

    if (updateData.rating !== undefined && (updateData.rating < 1 || updateData.rating > 5)) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Don't allow direct updates to performance metrics through this method
    if (updateData.performanceMetrics) {
      delete updateData.performanceMetrics;
    }

    // Update supplier
    Object.assign(existingSupplier, updateData);
    await existingSupplier.save();

    logger.info(`Supplier updated: ${supplierId} for company: ${companyId}`);

    return existingSupplier;
  } catch (error) {
    logger.error('Error updating supplier:', error);
    throw error;
  }
};

/**
 * Delete supplier (soft delete)
 * @param {string} supplierId - Supplier ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Deleted supplier
 */
export const deleteSupplier = async (supplierId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Supplier = getSupplierModel(companyDB);

    const supplier = await Supplier.findByIdAndUpdate(
      supplierId,
      { isActive: false },
      { new: true }
    );

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    logger.info(`Supplier soft deleted: ${supplierId} for company: ${companyId}`);

    return supplier;
  } catch (error) {
    logger.error('Error deleting supplier:', error);
    throw error;
  }
};

/**
 * Update supplier performance metrics
 * @param {string} supplierId - Supplier ID
 * @param {Object} metrics - Performance metrics to update
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Updated supplier
 */
export const updatePerformanceMetrics = async (supplierId, metrics, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Supplier = getSupplierModel(companyDB);

    // Get existing supplier
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    // Validate metrics
    const validMetrics = ['totalOrders', 'totalPurchaseValue', 'onTimeDeliveries', 'lateDeliveries', 'qualityIssues'];
    const invalidMetrics = Object.keys(metrics).filter(key => !validMetrics.includes(key));
    
    if (invalidMetrics.length > 0) {
      throw new Error(`Invalid metrics: ${invalidMetrics.join(', ')}`);
    }

    // Validate all metrics are non-negative
    for (const [key, value] of Object.entries(metrics)) {
      if (value < 0) {
        throw new Error(`${key} cannot be negative`);
      }
    }

    // Update performance metrics
    Object.assign(supplier.performanceMetrics, metrics);
    await supplier.save();

    logger.info(`Supplier performance metrics updated: ${supplierId} for company: ${companyId}`);

    return supplier;
  } catch (error) {
    logger.error('Error updating supplier performance metrics:', error);
    throw error;
  }
};
