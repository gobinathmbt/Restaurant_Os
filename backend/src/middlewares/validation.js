/**
 * Validation Middleware
 * Provides validation helpers and common validation schemas
 * Uses express-validator for input validation
 */

import { validationResult, body, param, query } from 'express-validator';

/**
 * Validation error formatter middleware
 * Checks for validation errors and returns formatted response
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  
  next();
};

/**
 * Common validation schemas
 * Reusable validation rules for common fields
 */

// Email validation
export const validateEmail = () => 
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase();

// Password validation
export const validatePassword = (fieldName = 'password') =>
  body(fieldName)
    .trim()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number');

// Phone number validation (Indian format)
export const validatePhone = (fieldName = 'phone') =>
  body(fieldName)
    .optional()
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit Indian phone number');

// Name validation
export const validateName = (fieldName = 'name') =>
  body(fieldName)
    .trim()
    .notEmpty()
    .withMessage(`${fieldName} is required`)
    .isLength({ min: 2, max: 100 })
    .withMessage(`${fieldName} must be between 2 and 100 characters`)
    .matches(/^[a-zA-Z\s.'-]+$/)
    .withMessage(`${fieldName} can only contain letters, spaces, and basic punctuation`);

// GST number validation (Indian format)
export const validateGST = (fieldName = 'gstNumber') =>
  body(fieldName)
    .optional()
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage('Please provide a valid GST number (e.g., 22AAAAA0000A1Z5)');

// FSSAI license validation (Indian format)
export const validateFSSAI = (fieldName = 'fssaiLicense') =>
  body(fieldName)
    .optional()
    .trim()
    .matches(/^[0-9]{14}$/)
    .withMessage('Please provide a valid 14-digit FSSAI license number');

// MongoDB ObjectId validation
export const validateObjectId = (fieldName = 'id') =>
  param(fieldName)
    .trim()
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Invalid ID format');

// Required string field validation
export const validateRequiredString = (fieldName, minLength = 1, maxLength = 500) =>
  body(fieldName)
    .trim()
    .notEmpty()
    .withMessage(`${fieldName} is required`)
    .isLength({ min: minLength, max: maxLength })
    .withMessage(`${fieldName} must be between ${minLength} and ${maxLength} characters`);

// Optional string field validation
export const validateOptionalString = (fieldName, minLength = 1, maxLength = 500) =>
  body(fieldName)
    .optional()
    .trim()
    .isLength({ min: minLength, max: maxLength })
    .withMessage(`${fieldName} must be between ${minLength} and ${maxLength} characters`);

// Number validation
export const validateNumber = (fieldName, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  body(fieldName)
    .isNumeric()
    .withMessage(`${fieldName} must be a number`)
    .isFloat({ min, max })
    .withMessage(`${fieldName} must be between ${min} and ${max}`);

// Boolean validation
export const validateBoolean = (fieldName) =>
  body(fieldName)
    .isBoolean()
    .withMessage(`${fieldName} must be a boolean value`);

// Date validation
export const validateDate = (fieldName) =>
  body(fieldName)
    .isISO8601()
    .withMessage(`${fieldName} must be a valid date`)
    .toDate();

// Array validation
export const validateArray = (fieldName, minLength = 0, maxLength = 100) =>
  body(fieldName)
    .isArray({ min: minLength, max: maxLength })
    .withMessage(`${fieldName} must be an array with ${minLength} to ${maxLength} items`);

// Enum validation
export const validateEnum = (fieldName, allowedValues) =>
  body(fieldName)
    .isIn(allowedValues)
    .withMessage(`${fieldName} must be one of: ${allowedValues.join(', ')}`);

/**
 * Validation rule sets for common operations
 */

// Login validation
export const loginValidation = [
  validateEmail(),
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required'),
  validate,
];

// Company registration validation
export const registerCompanyValidation = [
  validateName('adminName'),
  validateEmail(),
  validatePassword(),
  validateRequiredString('companyName', 2, 200),
  validatePhone(),
  validateOptionalString('address', 5, 500),
  validateGST(),
  validateFSSAI(),
  validate,
];

// User creation validation
export const createUserValidation = [
  validateName(),
  validateEmail(),
  validatePassword(),
  validateEnum('role', ['company_super_admin_secondary', 'company_admin', 'employee']),
  validate,
];

// Update profile validation
export const updateProfileValidation = [
  validateName().optional(),
  validatePhone().optional(),
  validate,
];

/**
 * Helper function to create custom validation chains
 * 
 * @param {Array} validations - Array of validation chains
 * @returns {Array} Validation chain with error formatter
 */
export const createValidation = (validations) => {
  return [...validations, validate];
};
