/**
 * Supplier Controller
 * HTTP request handlers for supplier management endpoints
 */

import * as supplierService from '../services/supplierService.js';
import { logger } from '../utils/logger.js';

/**
 * Create supplier
 * POST /api/suppliers
 */
export const createSupplier = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const supplierData = req.body;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Create supplier
    const supplier = await supplierService.createSupplier(supplierData, companyId, userBranchIds);

    logger.info('Supplier created via API', { 
      supplierId: supplier._id, 
      companyId, 
      userId 
    });

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: { supplier }
    });
  } catch (error) {
    logger.error('Create supplier error', error);
    
    // Handle specific validation errors
    if (error.message.includes('Missing required fields') ||
        error.message.includes('At least one branch') ||
        error.message.includes('only assign suppliers to branches')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get suppliers with filtering and pagination
 * GET /api/suppliers
 */
export const getSuppliers = async (req, res, next) => {
  try {
    const { companyId, role, branchIds } = req.user;
    const filters = req.query;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Get suppliers
    const result = await supplierService.getSuppliers(companyId, filters, userBranchIds);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get suppliers error', error);
    next(error);
  }
};

/**
 * Get supplier by ID
 * GET /api/suppliers/:id
 */
export const getSupplierById = async (req, res, next) => {
  try {
    const { companyId, role, branchIds } = req.user;
    const { id } = req.params;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Get supplier
    const supplier = await supplierService.getSupplierById(id, companyId, userBranchIds);

    res.json({
      success: true,
      data: { supplier }
    });
  } catch (error) {
    logger.error('Get supplier by ID error', error);
    
    if (error.message === 'Supplier not found' || error.message === 'You do not have access to this supplier') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Update supplier
 * PUT /api/suppliers/:id
 */
export const updateSupplier = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { id } = req.params;
    const updateData = req.body;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Update supplier
    const supplier = await supplierService.updateSupplier(id, updateData, companyId, userBranchIds);

    logger.info('Supplier updated via API', { 
      supplierId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: { supplier }
    });
  } catch (error) {
    logger.error('Update supplier error', error);
    
    if (error.message === 'Supplier not found' || error.message === 'You do not have access to this supplier') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('cannot be negative') ||
        error.message.includes('Rating must be between') ||
        error.message.includes('At least one branch') ||
        error.message.includes('only assign suppliers to branches')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Delete supplier (soft delete)
 * DELETE /api/suppliers/:id
 */
export const deleteSupplier = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;

    // Delete supplier
    await supplierService.deleteSupplier(id, companyId);

    logger.info('Supplier deleted via API', { 
      supplierId: id, 
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    logger.error('Delete supplier error', error);
    
    if (error.message === 'Supplier not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Toggle supplier status (activate/deactivate)
 * PATCH /api/suppliers/:id/toggle-status
 */
export const toggleSupplierStatus = async (req, res, next) => {
  try {
    const { companyId, userId, role, branchIds } = req.user;
    const { id } = req.params;

    // Determine user's accessible branches
    const userBranchIds = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)
      ? null // Super admins have access to all branches
      : branchIds; // Company admins only have access to their assigned branches

    // Get current supplier
    const currentSupplier = await supplierService.getSupplierById(id, companyId, userBranchIds);

    // Toggle isActive status
    const supplier = await supplierService.updateSupplier(
      id, 
      { isActive: !currentSupplier.isActive }, 
      companyId,
      userBranchIds
    );

    logger.info('Supplier status toggled via API', { 
      supplierId: id, 
      newStatus: supplier.isActive,
      companyId, 
      userId 
    });

    res.json({
      success: true,
      message: `Supplier ${supplier.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { supplier }
    });
  } catch (error) {
    logger.error('Toggle supplier status error', error);
    
    if (error.message === 'Supplier not found' || error.message === 'You do not have access to this supplier') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

