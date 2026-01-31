import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import CompanyUser from '../models/platform/CompanyUser.js';
import PlatformAdmin from '../models/platform/PlatformAdmin.js';
import { logger } from '../utils/logger.js';

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user info to request
 * Checks both CompanyUser and PlatformAdmin collections
 */
export const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Invalid token format.',
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, ENV.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please login again.',
        });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please login again.',
        });
      }
      throw jwtError;
    }

    // Find user in CompanyUser collection first
    let user = await CompanyUser.findById(decoded.userId);
    let userType = 'company';
    
    // If not found in CompanyUser, check PlatformAdmin
    if (!user) {
      user = await PlatformAdmin.findById(decoded.userId);
      userType = 'platform';
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Token is invalid.',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
      });
    }

    // Attach user info to request object
    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role,
      userType,
    };

    // Add company-specific fields
    if (userType === 'company') {
      req.user.companyId = user.companyId;
      req.user.branchIds = user.branchIds;
    }

    // Add platform admin-specific fields
    if (userType === 'platform') {
      req.user.platformAdminPrimary = user.platformAdminPrimary;
      req.user.permissions = user.permissions;
    }

    logger.debug('User authenticated', { userId: user._id, role: user.role, userType });

    next();
  } catch (error) {
    logger.error('Authentication error', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed. Please login again.',
    });
  }
};

/**
 * Authorization Middleware
 * Checks if user has required role(s) to access resource
 * @param {...string} allowedRoles - Roles that are allowed to access the resource
 * @returns {Function} Express middleware function
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Check if user is authenticated (should be set by authenticate middleware)
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization failed', {
        userId: req.user.userId,
        userRole: req.user.role,
        allowedRoles,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }

    logger.debug('User authorized', {
      userId: req.user.userId,
      role: req.user.role,
    });

    next();
  };
};

/**
 * Require Platform Super Admin Middleware
 * Ensures only platform super admin (primary) can access the resource
 */
export const requirePlatformSuperAdmin = (req, res, next) => {
  // Check if user is authenticated
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  // Check if user is platform admin
  if (req.user.userType !== 'platform') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Platform admin access required.',
    });
  }

  // Check if user is platform super admin primary
  if (req.user.role !== 'platform_super_admin_primary') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Platform super admin access required.',
    });
  }

  logger.debug('Platform super admin authorized', {
    userId: req.user.userId,
  });

  next();
};
