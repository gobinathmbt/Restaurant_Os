import { getCompanyDB } from '../config/database.js';
import { getLocationModel } from '../models/company/Location.js';
import CompanyUser from '../models/platform/CompanyUser.js';
import notificationService from '../services/notificationService.js';
import { logger } from '../utils/logger.js';

/**
 * Get all branches for a company
 * For company_admin: only return branches they have access to
 * For super admins: return all branches
 */
export const getBranches = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { page = 1, limit = 10, search, isActive, type = 'branch' } = req.query;

    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    const query = { type }; // Filter by location type (branch, warehouse, etc.)
    
    // Filter by user role and location access
    if (role === 'company_admin') {
      const user = await CompanyUser.findById(userId).select('branchIds');
      
      if (!user) {
        return res.json({
          success: true,
          data: {
            branches: [],
            pagination: {
              currentPage: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              totalPages: 0
            }
          }
        });
      }
      
      // Company admin can only access branches
      if (type === 'branch' && user.branchIds && user.branchIds.length > 0) {
        query._id = { $in: user.branchIds };
      } else {
        // No access to other location types
        return res.json({
          success: true,
          data: {
            branches: [],
            pagination: {
              currentPage: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              totalPages: 0
            }
          }
        });
      }
    }
    // Warehouse admin can only access warehouses
    else if (role === 'warehouse_admin') {
      const user = await CompanyUser.findById(userId).select('warehouseIds');
      
      if (!user) {
        return res.json({
          success: true,
          data: {
            branches: [],
            pagination: {
              currentPage: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              totalPages: 0
            }
          }
        });
      }
      
      // Warehouse admin can only access warehouses
      if (type === 'warehouse' && user.warehouseIds && user.warehouseIds.length > 0) {
        query._id = { $in: user.warehouseIds };
      } else {
        // No access to other location types
        return res.json({
          success: true,
          data: {
            branches: [],
            pagination: {
              currentPage: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              totalPages: 0
            }
          }
        });
      }
    }
    // Super admins (primary and secondary) can see all locations
    // Employees can only access branches
    else if (role === 'employee') {
      const user = await CompanyUser.findById(userId).select('branchIds');
      
      if (!user) {
        return res.json({
          success: true,
          data: {
            branches: [],
            pagination: {
              currentPage: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              totalPages: 0
            }
          }
        });
      }
      
      // Employee can only access branches
      if (type === 'branch' && user.branchIds && user.branchIds.length > 0) {
        query._id = { $in: user.branchIds };
      } else {
        return res.json({
          success: true,
          data: {
            branches: [],
            pagination: {
              currentPage: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              totalPages: 0
            }
          }
        });
      }
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } }
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const skip = (page - 1) * limit;

    const [branches, total] = await Promise.all([
      Location.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Location.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        branches,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get branches error', error);
    next(error);
  }
};

/**
 * Get single branch by ID
 * For company_admin: only return if they have access to this branch
 */
export const getBranchById = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;

    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    const branch = await Location.findOne({ _id: id, type: 'branch' });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // If user is company_admin or employee, check if they have access to this branch
    if (role === 'company_admin' || role === 'employee') {
      const user = await CompanyUser.findById(userId).select('branchIds');
      
      if (!user || !user.branchIds || !user.branchIds.includes(id)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this branch'
        });
      }
    }

    res.json({
      success: true,
      data: { branch }
    });
  } catch (error) {
    logger.error('Get branch by ID error', error);
    next(error);
  }
};

/**
 * Create new branch
 * Only company_super_admin_primary and company_super_admin_secondary can create
 */
export const createBranch = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;

    // Check permissions
    if (!['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can create branches'
      });
    }

    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    // Check if branch code already exists
    const existingBranch = await Location.findOne({ code: req.body.code, type: 'branch' });
    if (existingBranch) {
      return res.status(400).json({
        success: false,
        message: 'Branch code already exists'
      });
    }

    // Create branch as location with type='branch'
    const branch = await Location.create({
      ...req.body,
      type: 'branch',
      capabilities: {
        canProcureDirectly: req.body.capabilities?.canProcureDirectly ?? true,
        canDispatchStock: req.body.capabilities?.canDispatchStock ?? true,
        canReceiveStock: req.body.capabilities?.canReceiveStock ?? true,
        isProductionUnit: req.body.capabilities?.isProductionUnit ?? false,
        allowsCustomerOrders: req.body.capabilities?.allowsCustomerOrders ?? true
      },
      createdBy: userId
    });

    logger.info('Branch created', { branchId: branch._id, companyId, createdBy: userId });

    // Send notifications to all super admins
    try {
      const creator = await CompanyUser.findById(userId);
      
      // Get all super admins (primary and secondary)
      const superAdmins = await CompanyUser.find({
        companyId,
        role: { $in: ['company_super_admin_primary', 'company_super_admin_secondary'] },
        _id: { $ne: userId } // Exclude the creator
      });

      // Send notification to all super admins
      for (const admin of superAdmins) {
        await notificationService.sendToCompanyUser(companyId, admin._id, {
          category: 'system',
          event: 'branchCreated',
          title: 'New Branch Created',
          message: `${creator.name} created a new branch: ${branch.name} (${branch.code})`,
          data: {
            branchId: branch._id,
            branchName: branch.name,
            branchCode: branch.code,
            branchAddress: branch.address,
            createdBy: creator.name,
            creatorRole: role,
            createdAt: branch.createdAt
          },
          priority: 'medium',
          actionUrl: `/branches/${branch._id}`
        });
      }

      // Send confirmation notification to the creator
      await notificationService.sendToCompanyUser(companyId, userId, {
        category: 'system',
        event: 'branchCreated',
        title: 'Branch Created Successfully',
        message: `You created a new branch: ${branch.name} (${branch.code})`,
        data: {
          branchId: branch._id,
          branchName: branch.name,
          branchCode: branch.code,
          branchAddress: branch.address,
          createdAt: branch.createdAt
        },
        priority: 'low',
        actionUrl: `/branches/${branch._id}`
      });

      logger.info('Branch creation notifications sent', { 
        branchId: branch._id, 
        notificationCount: superAdmins.length + 1 
      });

    } catch (notifError) {
      logger.error('Failed to send branch creation notification', notifError);
    }

    res.status(201).json({
      success: true,
      message: 'Branch created successfully',
      data: { branch }
    });
  } catch (error) {
    logger.error('Create branch error', error);
    next(error);
  }
};

/**
 * Update branch
 */
export const updateBranch = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;

    // Check permissions
    if (!['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can update branches'
      });
    }

    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    // Check if branch exists
    const branch = await Location.findOne({ _id: id, type: 'branch' });
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // If code is being updated, check for duplicates
    if (req.body.code && req.body.code !== branch.code) {
      const existingBranch = await Location.findOne({ code: req.body.code, type: 'branch' });
      if (existingBranch) {
        return res.status(400).json({
          success: false,
          message: 'Branch code already exists'
        });
      }
    }

    // Update branch
    Object.assign(branch, req.body);
    branch.updatedBy = userId;
    await branch.save();

    logger.info('Branch updated', { branchId: branch._id, companyId, updatedBy: userId });

    res.json({
      success: true,
      message: 'Branch updated successfully',
      data: { branch }
    });
  } catch (error) {
    logger.error('Update branch error', error);
    next(error);
  }
};

/**
 * Delete branch
 * Check for dependencies before deletion
 */
export const deleteBranch = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;

    // Check permissions
    if (!['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can delete branches'
      });
    }

    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    // Check if branch exists
    const branch = await Location.findOne({ _id: id, type: 'branch' });
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Check for users assigned to this branch
    const usersWithBranch = await CompanyUser.countDocuments({
      companyId,
      branchIds: id
    });

    if (usersWithBranch > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete branch. ${usersWithBranch} user(s) are assigned to this branch.`,
        data: { dependencyCount: usersWithBranch }
      });
    }

    // TODO: Add more dependency checks (orders, inventory, etc.)
    // For now, we'll just check users

    await branch.deleteOne();

    logger.info('Branch deleted', { branchId: id, companyId, deletedBy: userId });

    res.json({
      success: true,
      message: 'Branch deleted successfully'
    });
  } catch (error) {
    logger.error('Delete branch error', error);
    next(error);
  }
};

/**
 * Toggle branch active status
 */
export const toggleBranchStatus = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { id } = req.params;

    // Check permissions
    if (!['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can change branch status'
      });
    }

    const companyDB = getCompanyDB(companyId);
    const Location = getLocationModel(companyDB);

    const branch = await Location.findOne({ _id: id, type: 'branch' });
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    branch.isActive = !branch.isActive;
    branch.updatedBy = userId;
    await branch.save();

    logger.info('Branch status toggled', { branchId: id, isActive: branch.isActive, companyId });

    res.json({
      success: true,
      message: `Branch ${branch.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { branch }
    });
  } catch (error) {
    logger.error('Toggle branch status error', error);
    next(error);
  }
};
