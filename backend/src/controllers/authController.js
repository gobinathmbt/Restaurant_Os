import CompanyUser from '../models/platform/CompanyUser.js';
import Company from '../models/platform/Company.js';
import PlatformAdmin from '../models/platform/PlatformAdmin.js';
import RefreshToken from '../models/platform/RefreshToken.js';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { getCompanyDB } from '../config/database.js';
import { generateCompanyId, generateDatabaseName, calculateTrialEndDate } from '../utils/helpers.js';
import mongoose from 'mongoose';



/**
 * Generate JWT Token
 * @param {string} userId - User ID to encode in token
 * @returns {string} JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRE,
  });
};

/**
 * Generate and store Refresh Token
 * @param {string} userId - User ID to associate with refresh token
 * @returns {Promise<string>} Refresh token
 */
const generateRefreshToken = async (userId) => {
  const token = jwt.sign({ userId }, ENV.JWT_SECRET, { expiresIn: '30d' });
  
  await RefreshToken.create({
    userId,
    token,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });
  
  return token;
};

/**
 * Register Company (New Company Super Admin Primary)
 * Creates a new company with primary admin user, dedicated database, and 30-day trial
 */
export const registerCompany = async (req, res, next) => {
  try {
    const {
      companyName,
      email,
      password,
      phone,
      address,
      gstNumber,
      fssaiLicense,
      adminName,
    } = req.body;

    // Validate required fields
    if (!companyName || !email || !password || !adminName) {
      return res.status(400).json({
        success: false,
        message: 'Company name, email, password, and admin name are required',
      });
    }

    // Check if email already exists
    const existingUser = await CompanyUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Generate unique company ID and database name
    const companyId = generateCompanyId();
    const databaseName = generateDatabaseName(companyId);

    // Create user (Company Super Admin Primary)
    const user = await CompanyUser.create({
      name: adminName,
      email,
      password,
      role: 'company_super_admin_primary',
      companyId,
    });

    // Create company entry with 30-day trial
    const trialStartDate = new Date();
    const trialEndDate = calculateTrialEndDate(trialStartDate);

    const company = await Company.create({
      companyId,
      companyName,
      email,
      phone,
      address,
      gstNumber,
      fssaiLicense,
      databaseName,
      primaryAdmin: {
        userId: user._id,
        name: adminName,
        email,
      },
      subscription: {
        status: 'trial',
        trialStartDate,
        trialEndDate,
        trialUsed: true,
      },
    });

    // Create dedicated company database and initialize collections
    const companyDB = getCompanyDB(companyId);
    
    // Create initial company settings in the new database
    const CompanySettings = companyDB.model('CompanySettings', new mongoose.Schema({
      companyId: String,
      companyName: String,
      currency: { type: String, default: 'INR' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      gstNumber: String,
      fssaiLicense: String,
      modules: Object,
      createdAt: { type: Date, default: Date.now },
    }));

    await CompanySettings.create({
      companyId,
      companyName,
      gstNumber,
      fssaiLicense,
      modules: company.modules,
    });

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    logger.info('Company registered successfully', { companyId, email });

    // Send welcome email to the new company admin with BCC to all platform admins
    try {
      const welcomeEmailService = await import('../services/emailTemplates/welcomeEmailService.js');
      await welcomeEmailService.default.sendWelcomeEmail({
        adminName,
        email,
        companyName,
        companyId,
        trialEndDate,
        phone,
        address
      });
      logger.info('Welcome email sent successfully', { companyId, email });
    } catch (emailError) {
      logger.error('Failed to send welcome email', emailError);
      // Don't fail registration if email fails
    }

    // Send notification to all platform admins about new company registration
    try {
      const notificationService = await import('../services/notificationService.js');
      await notificationService.default.sendToAllPlatformAdmins({
        category: 'company_registration',
        event: 'companyRegistration',
        title: 'New Company Registered',
        message: `${companyName} has registered with a 30-day trial. Primary admin: ${adminName} (${email})`,
        data: {
          companyId,
          companyName,
          adminName,
          email,
          phone,
          trialEndDate,
          registeredAt: new Date()
        },
        priority: 'high',
        actionUrl: `/platform/companies/${companyId}`
      });
      logger.info('Platform admin notification sent for new company registration', { companyId });
    } catch (notifError) {
      logger.error('Failed to send platform admin notification', notifError);
      // Don't fail registration if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Company registered successfully. 30-day trial activated.',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          userType: 'company',
          companyId: user.companyId,
        },
        company: {
          id: company._id,
          companyId: company.companyId,
          companyName: company.companyName,
          subscription: company.subscription,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('Register company error', error);
    next(error);
  }
};

/**
 * Login with Email/Password
 * Authenticates user and returns JWT tokens
 * Priority: CompanyUser first, then PlatformAdmin
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // First priority: Find in CompanyUser
    let user = await CompanyUser.findOne({ email }).select('+password');
    let userType = 'company';

    // Second priority: Find in PlatformAdmin if not found in CompanyUser
    if (!user) {
      user = await PlatformAdmin.findOne({ email }).select('+password');
      userType = 'platform';
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if password exists (for Google OAuth users)
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'Please login with Google',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
      });
    }

    // Verify password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check company subscription status (only for company users)
    if (userType === 'company' && user.companyId) {
      const company = await Company.findOne({ companyId: user.companyId });
      
      if (!company || !company.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Company account is inactive',
        });
      }

      if (company.subscription.status === 'suspended' || company.subscription.status === 'expired') {
        return res.status(403).json({
          success: false,
          message: 'Company subscription has expired. Please renew to continue.',
        });
      }
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    logger.info('User logged in', { userId: user._id, email, userType });

    // Prepare response based on user type
    const responseData = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        userType,
      },
      token,
      refreshToken,
    };

    // Add company-specific fields
    if (userType === 'company') {
      responseData.user.companyId = user.companyId;
      responseData.user.branchIds = user.branchIds;
    }

    // Add platform admin-specific fields
    if (userType === 'platform') {
      responseData.user.platformAdminPrimary = user.platformAdminPrimary;
      responseData.user.permissions = user.permissions;
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: responseData,
    });
  } catch (error) {
    logger.error('Login error', error);
    next(error);
  }
};

/**
 * Google OAuth Login
 * Authenticates user via Google OAuth access token
 */
export const googleLogin = async (req, res, next) => {
  try {
    const { token: accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Google access token is required',
      });
    }

    // Verify access token by fetching user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google access token',
      });
    }

    const userInfo = await userInfoResponse.json();
    const { sub: googleId, email, name, picture } = userInfo;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email not provided by Google',
      });
    }

    // Find user by email or googleId - check CompanyUser first, then PlatformAdmin
    let user = await CompanyUser.findOne({ $or: [{ email }, { googleId }] });
    let userType = 'company';

    // If not found in CompanyUser, check PlatformAdmin
    if (!user) {
      user = await PlatformAdmin.findOne({ $or: [{ email }, { googleId }] });
      userType = 'platform';
    }

    if (!user) {
      // New user - need to register company first
      return res.status(404).json({
        success: false,
        message: 'No account found. Please register your company first.',
        data: {
          googleId,
          email,
          name,
          picture,
        },
      });
    }

    // Update Google ID and profile picture if not set
    if (!user.googleId) {
      user.googleId = googleId;
      user.profilePicture = picture;
      await user.save();
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated',
      });
    }

    // Check company subscription (only for company users)
    if (userType === 'company' && user.companyId) {
      const company = await Company.findOne({ companyId: user.companyId });
      
      if (!company || !company.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Company account is inactive',
        });
      }

      if (company.subscription.status === 'suspended' || company.subscription.status === 'expired') {
        return res.status(403).json({
          success: false,
          message: 'Company subscription has expired',
        });
      }
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    logger.info('Google login successful', { userId: user._id, email, userType });

    // Prepare response based on user type
    const responseData = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        userType,
        profilePicture: user.profilePicture,
      },
      token,
      refreshToken,
    };

    // Add company-specific fields
    if (userType === 'company') {
      responseData.user.companyId = user.companyId;
      responseData.user.branchIds = user.branchIds;
    }

    // Add platform admin-specific fields
    if (userType === 'platform') {
      responseData.user.platformAdminPrimary = user.platformAdminPrimary;
      responseData.user.permissions = user.permissions;
    }

    res.json({
      success: true,
      message: 'Google login successful',
      data: responseData,
    });
  } catch (error) {
    logger.error('Google login error', error);
    next(error);
  }
};

/**
 * Get Current User (Me)
 * Returns current authenticated user info with company details
 */
export const getMe = async (req, res, next) => {
  try {
    // First try to find in CompanyUser
    let user = await CompanyUser.findById(req.user.userId);
    let userType = 'company';
    
    // If not found, try PlatformAdmin
    if (!user) {
      user = await PlatformAdmin.findById(req.user.userId);
      userType = 'platform';
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prepare base user data
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      userType,
      profilePicture: user.profilePicture,
    };

    // Add company-specific data
    if (userType === 'company') {
      userData.companyId = user.companyId;
      userData.branchIds = user.branchIds;
      
      // Get company details if user belongs to a company
      let company = null;
      if (user.companyId) {
        company = await Company.findOne({ companyId: user.companyId });
      }

      return res.json({
        success: true,
        data: {
          user: userData,
          company: company ? {
            companyId: company.companyId,
            companyName: company.companyName,
            subscription: company.subscription,
            modules: company.modules,
          } : null,
        },
      });
    }

    // Add platform admin-specific data
    if (userType === 'platform') {
      userData.platformAdminPrimary = user.platformAdminPrimary;
      userData.permissions = user.permissions;

      return res.json({
        success: true,
        data: {
          user: userData,
          company: null,
        },
      });
    }
  } catch (error) {
    logger.error('Get me error', error);
    next(error);
  }
};

/**
 * Logout
 * Revokes refresh token and logs out user
 */
export const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await RefreshToken.updateOne(
        { token: refreshToken },
        { isRevoked: true }
      );
    }

    logger.info('User logged out', { userId: req.user.userId });

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error('Logout error', error);
    next(error);
  }
};
