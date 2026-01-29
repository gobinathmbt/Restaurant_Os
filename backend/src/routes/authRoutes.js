import express from 'express';
import {
  registerCompany,
  login,
  googleLogin,
  getMe,
  logout,
} from '../controllers/authController.js';
import { authenticate } from '../middlewares/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

/**
 * Validation middleware to check for validation errors
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * POST /api/auth/register-company
 * Register a new company with primary admin
 * Public route
 */
router.post(
  '/register-company',
  [
    body('companyName')
      .trim()
      .notEmpty()
      .withMessage('Company name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Company name must be between 2 and 100 characters'),
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Invalid email format')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('adminName')
      .trim()
      .notEmpty()
      .withMessage('Admin name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Admin name must be between 2 and 100 characters'),
    body('phone')
      .optional()
      .trim()
      .matches(/^[0-9]{10}$/)
      .withMessage('Phone number must be 10 digits'),
    body('gstNumber')
      .optional()
      .trim()
      .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
      .withMessage('Invalid GST number format'),
    validate,
  ],
  registerCompany
);

/**
 * POST /api/auth/login
 * Login with email and password
 * Public route
 */
router.post(
  '/login',
  [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Invalid email format')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    validate,
  ],
  login
);

/**
 * POST /api/auth/google
 * Login with Google OAuth token
 * Public route
 */
router.post(
  '/google',
  [
    body('token')
      .notEmpty()
      .withMessage('Google token is required'),
    validate,
  ],
  googleLogin
);

/**
 * GET /api/auth/me
 * Get current authenticated user info
 * Protected route - requires authentication
 */
router.get('/me', authenticate, getMe);

/**
 * POST /api/auth/logout
 * Logout and revoke refresh token
 * Protected route - requires authentication
 */
router.post('/logout', authenticate, logout);

export default router;
