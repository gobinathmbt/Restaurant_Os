import { getCompanyDB } from '../config/database.js';
import { getBranchModel } from '../models/company/Branch.js';
import CompanyUser from '../models/platform/CompanyUser.js';
import notificationService from '../services/notificationService.js';
import { logger } from '../utils/logger.js';

/**
 * Get all branches for a company
 */
export const getBranches = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { page = 1, limit = 10, search, isActive } = req.query;

    const companyDB = getCompanyDB(companyId);
    const Branch = getBranchModel(companyDB);

    const query = {};
    
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
      Branch.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Branch.countDocuments(query)
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
 */
export const getBranchById = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const companyDB = getCompanyDB(companyId);
    const Branch = getBranchModel(companyDB);

    const branch = await Branch.findById(id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
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
    const Branch = getBranchModel(companyDB);

    // Check if branch code already exists
    const existingBranch = await Branch.findOne({ code: req.body.code });
    if (existingBranch) {
      return res.status(400).json({
        success: false,
        message: 'Branch code already exists'
      });
    }

    // Create branch
    const branch = await Branch.create({
      ...req.body,
      createdBy: userId
    });

    logger.info('Branch created', { branchId: branch._id, companyId, createdBy: userId });

    // Send notifications based on who created the branch
    try {
      const creator = await CompanyUser.findById(userId);
      
      if (role === 'company_super_admin_secondary') {
        // Notify primary admin
        const primaryAdmin = await CompanyUser.findOne({
          companyId,
          role: 'company_super_admin_primary'
        });

        if (primaryAdmin) {
          await notificationService.sendToCompanyUser(companyId, primaryAdmin._id, {
            category: 'branch_management',
            event: 'branchCreated',
            title: 'New Branch Created',
            message: `${creator.name} created a new branch: ${branch.name} (${branch.code})`,
            data: {
              branchId: branch._id,
              branchName: branch.name,
              branchCode: branch.code,
              createdBy: creator.name,
              createdAt: branch.createdAt
            },
            priority: 'medium',
            actionUrl: `/branches/${branch._id}`
          });
        }
      } else if (role === 'company_super_admin_primary') {
        // Only notify the creator (primary admin)
        await notificationService.sendToCompanyUser(companyId, userId, {
          category: 'branch_management',
          event: 'branchCreated',
          title: 'Branch Created Successfully',
          message: `You created a new branch: ${branch.name} (${branch.code})`,
          data: {
            branchId: branch._id,
            branchName: branch.name,
            branchCode: branch.code,
            createdAt: branch.createdAt
          },
          priority: 'low',
          actionUrl: `/branches/${branch._id}`
        });
      }
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
    const Branch = getBranchModel(companyDB);

    // Check if branch exists
    const branch = await Branch.findById(id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // If code is being updated, check for duplicates
    if (req.body.code && req.body.code !== branch.code) {
      const existingBranch = await Branch.findOne({ code: req.body.code });
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
    const Branch = getBranchModel(companyDB);

    // Check if branch exists
    const branch = await Branch.findById(id);
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
    const Branch = getBranchModel(companyDB);

    const branch = await Branch.findById(id);
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
