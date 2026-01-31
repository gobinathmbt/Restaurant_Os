/**
 * Supplier Service
 * Business logic for supplier management operations
 */

import { getCompanyDB } from '../config/database.js';
import { getSupplierModel } from '../models/company/Supplier.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new supplier
 * @param {Object} supplierData - Supplier data
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Created supplier
 */
export const createSupplier = async (supplierData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Supplier = getSupplierModel(companyDB);

    // Validate required fields
    const requiredFields = ['name', 'phone'];
    const missingFields = requiredFields.filter(field => !supplierData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
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
 * @returns {Promise<Object>} Paginated suppliers
 */
export const getSuppliers = async (companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Supplier = getSupplierModel(companyDB);

    const {
      page = 1,
      limit = 10,
      search = '',
      category = '',
      isActive = true
    } = filters;

    // Build query - return only active suppliers by default
    const query = {
      isActive: isActive === 'false' ? false : true
    };

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Category filter
    if (category) {
      query.categories = category;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [suppliers, total] = await Promise.all([
      Supplier.find(query)
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
 * @returns {Promise<Object>} Supplier with calculated virtual fields
 */
export const getSupplierById = async (supplierId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Supplier = getSupplierModel(companyDB);

    const supplier = await Supplier.findById(supplierId).lean();

    if (!supplier) {
      throw new Error('Supplier not found');
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
 * @returns {Promise<Object>} Updated supplier
 */
export const updateSupplier = async (supplierId, updateData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const Supplier = getSupplierModel(companyDB);

    // Get existing supplier
    const existingSupplier = await Supplier.findById(supplierId);
    if (!existingSupplier) {
      throw new Error('Supplier not found');
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
