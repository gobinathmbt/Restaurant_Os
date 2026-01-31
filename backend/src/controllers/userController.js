import CompanyUser from '../models/platform/CompanyUser.js';
import Company from '../models/platform/Company.js';
import notificationService from '../services/notificationService.js';
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
    const { name, email, password, role, branchIds } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are required'
      });
    }

    // Check role-based permissions
    const allowedRoles = {
      company_super_admin_primary: ['company_super_admin_secondary', 'company_admin', 'employee'],
      company_super_admin_secondary: ['company_admin', 'employee'],
      company_admin: ['employee']
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

    // Create user
    const newUser = await CompanyUser.create({
      name,
      email,
      password,
      role,
      companyId,
      branchIds: branchIds || []
    });

    // Remove password from response
    const userResponse = newUser.toJSON();

    logger.info('User created', { userId: newUser._id, companyId, createdBy: userId, role });

    // Send notifications based on creator role
    try {
      const creator = await CompanyUser.findById(userId);
      const company = await Company.findOne({ companyId });

      if (creatorRole === 'company_admin') {
        // Notify both super admins
        const superAdmins = await CompanyUser.find({
          companyId,
          role: { $in: ['company_super_admin_primary', 'company_super_admin_secondary'] }
        });

        for (const admin of superAdmins) {
          await notificationService.sendToCompanyUser(companyId, admin._id, {
            category: 'staff',
            event: 'userCreated',
            title: 'New User Created',
            message: `${creator.name} (Admin) created a new ${role.replace('company_', '').replace('_', ' ')}: ${name} (${email})`,
            data: {
              userId: newUser._id,
              userName: name,
              userEmail: email,
              userRole: role,
              createdBy: creator.name,
              creatorRole: creatorRole,
              branchIds: branchIds || [],
              createdAt: newUser.createdAt
            },
            priority: 'medium',
            actionUrl: `/staff/${newUser._id}`
          });
        }
      } else if (creatorRole === 'company_super_admin_secondary') {
        // Notify primary admin
        const primaryAdmin = await CompanyUser.findOne({
          companyId,
          role: 'company_super_admin_primary'
        });

        if (primaryAdmin) {
          await notificationService.sendToCompanyUser(companyId, primaryAdmin._id, {
            category: 'staff',
            event: 'userCreated',
            title: 'New User Created',
            message: `${creator.name} (Super Admin) created a new ${role.replace('company_', '').replace('_', ' ')}: ${name} (${email})`,
            data: {
              userId: newUser._id,
              userName: name,
              userEmail: email,
              userRole: role,
              createdBy: creator.name,
              creatorRole: creatorRole,
              branchIds: branchIds || [],
              createdAt: newUser.createdAt
            },
            priority: 'medium',
            actionUrl: `/staff/${newUser._id}`
          });
        }
      } else if (creatorRole === 'company_super_admin_primary') {
        // Only notify the creator
        await notificationService.sendToCompanyUser(companyId, userId, {
          category: 'staff',
          event: 'userCreated',
          title: 'User Created Successfully',
          message: `You created a new ${role.replace('company_', '').replace('_', ' ')}: ${name} (${email})`,
          data: {
            userId: newUser._id,
            userName: name,
            userEmail: email,
            userRole: role,
            branchIds: branchIds || [],
            createdAt: newUser.createdAt
          },
          priority: 'low',
          actionUrl: `/staff/${newUser._id}`
        });
      }

      // Notify the new user
      await notificationService.sendToCompanyUser(companyId, newUser._id, {
        category: 'system',
        event: 'accountCreated',
        title: 'Welcome to RestaurantOS',
        message: `Your account has been created by ${creator.name}. You can now login with your email: ${email}`,
        data: {
          companyName: company?.companyName,
          role,
          createdBy: creator.name
        },
        priority: 'high',
        actionUrl: '/settings/profile'
      });
    } catch (notifError) {
      logger.error('Failed to send user creation notification', notifError);
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
    const { name, email, role, branchIds, isActive, password } = req.body;

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
        company_super_admin_primary: ['company_super_admin_secondary', 'company_admin', 'employee'],
        company_super_admin_secondary: ['company_admin', 'employee'],
        company_admin: ['employee']
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
    if (role) user.role = role;
    if (branchIds !== undefined) user.branchIds = branchIds;
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
      company_super_admin_primary: ['company_super_admin_secondary', 'company_admin', 'employee'],
      company_super_admin_secondary: ['company_admin', 'employee'],
      company_admin: ['employee']
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
