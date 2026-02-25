import CompanyUser from '../models/platform/CompanyUser.js';
import Company from '../models/platform/Company.js';
import notificationService from '../services/notificationService.js';
import staffWelcomeEmailService from '../services/emailTemplates/staffWelcomeEmailService.js';
import { logger } from '../utils/logger.js';

/**
 * Get all users for a company
 */
export const getUsers = async (req, res, next) => {
  try {
    const { companyId, userId, role: currentUserRole } = req.user;
    const { page = 1, limit = 10, search, role, isActive, branchId } = req.query;

    const query = { companyId };
    
    // Exclude current user from the list
    query._id = { $ne: userId };
    
    // Role-based filtering
    if (currentUserRole === 'company_admin') {
      // Company admin can only see employees
      query.role = 'employee';
    } else if (currentUserRole === 'warehouse_admin') {
      // Warehouse admin cannot see any users (no permission to manage users)
      return res.json({
        success: true,
        data: {
          users: [],
          pagination: {
            currentPage: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            totalPages: 0
          }
        }
      });
    } else if (currentUserRole === 'company_super_admin_secondary') {
      // Secondary admin cannot see primary admin
      query.role = { $ne: 'company_super_admin_primary' };
    }
    // Primary admin can see all users (no additional restriction)
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) {
      // Apply role filter only if it doesn't conflict with role-based restrictions
      if (currentUserRole === 'company_admin' && role !== 'employee') {
        // Company admin trying to filter non-employees - return empty
        return res.json({
          success: true,
          data: {
            users: [],
            pagination: {
              currentPage: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              totalPages: 0
            }
          }
        });
      }
      if (currentUserRole === 'company_super_admin_secondary' && role === 'company_super_admin_primary') {
        // Secondary admin trying to see primary admin - return empty
        return res.json({
          success: true,
          data: {
            users: [],
            pagination: {
              currentPage: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              totalPages: 0
            }
          }
        });
      }
      query.role = role;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (branchId) {
      query.branchIds = branchId;
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      CompanyUser.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      CompanyUser.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get users error', error);
    next(error);
  }
};

/**
 * Get single user by ID
 */
export const getUserById = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const user = await CompanyUser.findOne({ _id: id, companyId }).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    logger.error('Get user by ID error', error);
    next(error);
  }
};

/**
 * Create new user
 * Role-based permissions apply
 */
export const createUser = async (req, res, next) => {
  try {
    const { companyId, userId, role: creatorRole } = req.user;
    const { name, email, password, role, branchIds, warehouseIds } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are required'
      });
    }

    // Validate location access based on role
    if (role === 'warehouse_admin') {
      // Warehouse admin must have at least one warehouse
      if (!warehouseIds || warehouseIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one warehouse must be selected for warehouse_admin role'
        });
      }
    } else if (role === 'company_admin') {
      // Company admin must have at least one branch
      if (!branchIds || branchIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one branch must be selected for company_admin role'
        });
      }
    } else if (role === 'employee') {
      // Employee must have at least one branch
      if (!branchIds || branchIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one branch must be selected for employee role'
        });
      }
    }

    // Check role-based permissions
    const allowedRoles = {
      company_super_admin_primary: ['company_super_admin_secondary', 'company_admin', 'warehouse_admin', 'employee'],
      company_super_admin_secondary: ['company_admin', 'warehouse_admin', 'employee'],
      company_admin: ['employee'],
      warehouse_admin: [] // Warehouse admin cannot create users
    };

    if (!allowedRoles[creatorRole] || !allowedRoles[creatorRole].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to create users with this role'
      });
    }

    // Check if email already exists
    const existingUser = await CompanyUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Create user with appropriate location access based on role
    const userData = {
      name,
      email,
      password,
      role,
      companyId
    };

    // Set location access based on role
    if (role === 'warehouse_admin') {
      userData.warehouseIds = warehouseIds || [];
      userData.branchIds = []; // Warehouse admin has no branch access
    } else if (role === 'company_admin' || role === 'employee') {
      userData.branchIds = branchIds || [];
      userData.warehouseIds = []; // Company admin and employee have no warehouse access
    } else {
      // Super admins have no specific location restrictions
      userData.branchIds = [];
      userData.warehouseIds = [];
    }

    const newUser = await CompanyUser.create(userData);

    // Remove password from response
    const userResponse = newUser.toJSON();

    logger.info('User created', { userId: newUser._id, companyId, createdBy: userId, role });

    // Send welcome email and notifications based on role hierarchy
    try {
      const creator = await CompanyUser.findById(userId);
      const company = await Company.findOne({ companyId });

      // Collect BCC emails and notification recipients based on role
      let bccEmails = [];
      let notificationRecipients = [];

      if (role === 'company_super_admin_secondary') {
        // Notify primary admin and all other secondary admins
        const primaryAdmin = await CompanyUser.findOne({
          companyId,
          role: 'company_super_admin_primary'
        });

        const otherSecondaryAdmins = await CompanyUser.find({
          companyId,
          role: 'company_super_admin_secondary',
          _id: { $ne: newUser._id }
        });

        if (primaryAdmin) {
          bccEmails.push(primaryAdmin.email);
          notificationRecipients.push(primaryAdmin);
        }

        otherSecondaryAdmins.forEach(admin => {
          bccEmails.push(admin.email);
          notificationRecipients.push(admin);
        });

      } else if (role === 'company_admin') {
        // Notify all super admins and other admins in the same branches
        const superAdmins = await CompanyUser.find({
          companyId,
          role: { $in: ['company_super_admin_primary', 'company_super_admin_secondary'] }
        });

        const otherAdmins = await CompanyUser.find({
          companyId,
          role: 'company_admin',
          branchIds: { $in: branchIds },
          _id: { $ne: newUser._id }
        });

        superAdmins.forEach(admin => {
          bccEmails.push(admin.email);
          notificationRecipients.push(admin);
        });

        otherAdmins.forEach(admin => {
          bccEmails.push(admin.email);
          notificationRecipients.push(admin);
        });

      } else if (role === 'employee') {
        // Notify all super admins, admins, and other employees in the same branches
        const superAdmins = await CompanyUser.find({
          companyId,
          role: { $in: ['company_super_admin_primary', 'company_super_admin_secondary'] }
        });

        const branchAdmins = await CompanyUser.find({
          companyId,
          role: 'company_admin',
          branchIds: { $in: branchIds }
        });

        const otherEmployees = await CompanyUser.find({
          companyId,
          role: 'employee',
          branchIds: { $in: branchIds },
          _id: { $ne: newUser._id }
        });

        superAdmins.forEach(admin => {
          bccEmails.push(admin.email);
          notificationRecipients.push(admin);
        });

        branchAdmins.forEach(admin => {
          bccEmails.push(admin.email);
          notificationRecipients.push(admin);
        });

        otherEmployees.forEach(emp => {
          bccEmails.push(emp.email);
          notificationRecipients.push(emp);
        });
      }

      // Remove duplicates from BCC emails
      bccEmails = [...new Set(bccEmails)];

      // Send welcome email to the new user with BCC to relevant users
      await staffWelcomeEmailService.sendStaffWelcomeEmail({
        userName: name,
        userEmail: email,
        userRole: role,
        companyId,
        companyName: company?.companyName || 'Your Company',
        branchIds: branchIds || [],
        warehouseIds: warehouseIds || [],
        createdBy: creator.name,
        bccEmails
      });

      // Send in-app notifications to all relevant users
      for (const recipient of notificationRecipients) {
        await notificationService.sendToCompanyUser(companyId, recipient._id, {
          category: 'staff',
          event: 'userCreated',
          title: 'New Team Member Added',
          message: `${creator.name} created a new ${role.replace('company_', '').replace('_', ' ')}: ${name} (${email})`,
          data: {
            userId: newUser._id,
            userName: name,
            userEmail: email,
            userRole: role,
            createdBy: creator.name,
            creatorRole: creatorRole,
            branchIds: branchIds || [],
            warehouseIds: warehouseIds || [],
            createdAt: newUser.createdAt
          },
          priority: 'medium',
          actionUrl: `/staff/${newUser._id}`
        });
      }

      // Send welcome notification to the new user
      await notificationService.sendToCompanyUser(companyId, newUser._id, {
        category: 'system',
        event: 'accountCreated',
        title: 'Welcome to RestaurantOS',
        message: `Your account has been created by ${creator.name}. You can now login with your email: ${email}`,
        data: {
          companyName: company?.companyName,
          role,
          createdBy: creator.name,
          branchIds: branchIds || [],
          warehouseIds: warehouseIds || []
        },
        priority: 'high',
        actionUrl: '/settings/profile'
      });

      logger.info('Welcome email and notifications sent', { 
        userId: newUser._id, 
        bccCount: bccEmails.length,
        notificationCount: notificationRecipients.length 
      });

    } catch (notifError) {
      logger.error('Failed to send user creation notifications', notifError);
      // Don't fail the user creation if notifications fail
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user: userResponse }
    });
  } catch (error) {
    logger.error('Create user error', error);
    next(error);
  }
};

/**
 * Update user
 */
export const updateUser = async (req, res, next) => {
  try {
    const { companyId, userId: currentUserId, role: creatorRole } = req.user;
    const { id } = req.params;
    const { name, email, role, branchIds, warehouseIds, isActive, password } = req.body;

    // Find user
    const user = await CompanyUser.findOne({ _id: id, companyId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Only company_super_admin_primary can update passwords
    if (password) {
      if (creatorRole !== 'company_super_admin_primary') {
        return res.status(403).json({
          success: false,
          message: 'Only primary admin can update user passwords'
        });
      }
      // Password will be hashed by the pre-save hook
      user.password = password;
    }

    // Check permissions for role change
    if (role && role !== user.role) {
      const allowedRoles = {
        company_super_admin_primary: ['company_super_admin_secondary', 'company_admin', 'warehouse_admin', 'employee'],
        company_super_admin_secondary: ['company_admin', 'warehouse_admin', 'employee'],
        company_admin: ['employee'],
        warehouse_admin: [] // Warehouse admin cannot update user roles
      };

      if (!allowedRoles[creatorRole] || !allowedRoles[creatorRole].includes(role)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to assign this role'
        });
      }
    }

    // Check if email is being changed and if it already exists
    if (email && email !== user.email) {
      const existingUser = await CompanyUser.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
    }

    // Update user
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) {
      user.role = role;
      // Clear inappropriate location access when role changes
      if (role === 'warehouse_admin') {
        user.branchIds = [];
        user.warehouseIds = warehouseIds !== undefined ? warehouseIds : user.warehouseIds;
      } else if (role === 'company_admin' || role === 'employee') {
        user.warehouseIds = [];
        user.branchIds = branchIds !== undefined ? branchIds : user.branchIds;
      } else {
        // Super admins have no location restrictions
        user.branchIds = [];
        user.warehouseIds = [];
      }
    } else {
      // Role not changing, update location access normally
      if (branchIds !== undefined) user.branchIds = branchIds;
      if (warehouseIds !== undefined) user.warehouseIds = warehouseIds;
    }
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    const userResponse = user.toJSON();

    logger.info('User updated', { userId: id, companyId, updatedBy: currentUserId });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user: userResponse }
    });
  } catch (error) {
    logger.error('Update user error', error);
    next(error);
  }
};

/**
 * Delete user
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { companyId, userId: currentUserId, role: creatorRole } = req.user;
    const { id } = req.params;

    // Prevent self-deletion
    if (id === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Find user
    const user = await CompanyUser.findOne({ _id: id, companyId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deletion of primary admin
    if (user.role === 'company_super_admin_primary') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete primary admin'
      });
    }

    // Check permissions
    const canDelete = {
      company_super_admin_primary: ['company_super_admin_secondary', 'company_admin', 'warehouse_admin', 'employee'],
      company_super_admin_secondary: ['company_admin', 'warehouse_admin', 'employee'],
      company_admin: ['employee'],
      warehouse_admin: [] // Warehouse admin cannot delete users
    };

    if (!canDelete[creatorRole] || !canDelete[creatorRole].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this user'
      });
    }

    await user.deleteOne();

    logger.info('User deleted', { userId: id, companyId, deletedBy: currentUserId });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Delete user error', error);
    next(error);
  }
};

/**
 * Toggle user active status
 */
export const toggleUserStatus = async (req, res, next) => {
  try {
    const { companyId, userId: currentUserId, role: creatorRole } = req.user;
    const { id } = req.params;

    // Prevent self-deactivation
    if (id === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }

    const user = await CompanyUser.findOne({ _id: id, companyId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deactivation of primary admin
    if (user.role === 'company_super_admin_primary') {
      return res.status(403).json({
        success: false,
        message: 'Cannot deactivate primary admin'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    logger.info('User status toggled', { userId: id, isActive: user.isActive, companyId });

    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user: user.toJSON() }
    });
  } catch (error) {
    logger.error('Toggle user status error', error);
    next(error);
  }
};
