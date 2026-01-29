import CompanyUser from '../models/platform/CompanyUser.js';
import Company from '../models/platform/Company.js';
import RefreshToken from '../models/platform/RefreshToken.js';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { OAuth2Client } from 'google-auth-library';
import { getCompanyDB } from '../config/database.js';
import { generateCompanyId, generateDatabaseName, calculateTrialEndDate } from '../utils/helpers.js';
import mongoose from 'mongoose';

const googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

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

    res.status(201).json({
      success: true,
      message: 'Company registered successfully. 30-day trial activated.',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
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

    // Find user with password field (explicitly select it)
    const user = await CompanyUser.findOne({ email }).select('+password');
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

    // Check company subscription status
    if (user.companyId) {
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

    logger.info('User logged in', { userId: user._id, email });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          branchIds: user.branchIds,
        },
        token,
        refreshToken,
      },
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

    // Find user by email or googleId
    let user = await CompanyUser.findOne({ $or: [{ email }, { googleId }] });

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

    // Check company subscription
    if (user.companyId) {
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

    logger.info('Google login successful', { userId: user._id, email });

    res.json({
      success: true,
      message: 'Google login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          profilePicture: user.profilePicture,
        },
        token,
        refreshToken,
      },
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
    const user = await CompanyUser.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get company details if user belongs to a company
    let company = null;
    if (user.companyId) {
      company = await Company.findOne({ companyId: user.companyId });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          branchIds: user.branchIds,
          profilePicture: user.profilePicture,
        },
        company: company ? {
          companyId: company.companyId,
          companyName: company.companyName,
          subscription: company.subscription,
          modules: company.modules,
        } : null,
      },
    });
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
