/**
 * Location Validation Middleware
 * Provides validation rules for location management endpoints
 */

import { body, param, query } from 'express-validator';
import { validate, validateObjectId } from './validation.js';

/**
 * Validation for creating a location
 */
export const createLocationValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Location name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Location name must be between 2 and 200 characters'),
  
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Location code is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Location code must be between 2 and 50 characters')
    .matches(/^[A-Z0-9_-]+$/i)
    .withMessage('Location code can only contain letters, numbers, hyphens, and underscores'),
  
  body('type')
    .notEmpty()
    .withMessage('Location type is required')
    .isIn(['branch', 'warehouse', 'central_kitchen', 'cloud_kitchen'])
    .withMessage('Location type must be one of: branch, warehouse, central_kitchen, cloud_kitchen'),
  
  // Capabilities validation (optional)
  body('capabilities.canProcureDirectly')
    .optional()
    .isBoolean()
    .withMessage('canProcureDirectly must be a boolean'),
  
  body('capabilities.canDispatchStock')
    .optional()
    .isBoolean()
    .withMessage('canDispatchStock must be a boolean'),
  
  body('capabilities.canReceiveStock')
    .optional()
    .isBoolean()
    .withMessage('canReceiveStock must be a boolean'),
  
  body('capabilities.isProductionUnit')
    .optional()
    .isBoolean()
    .withMessage('isProductionUnit must be a boolean'),
  
  body('capabilities.allowsCustomerOrders')
    .optional()
    .isBoolean()
    .withMessage('allowsCustomerOrders must be a boolean'),
  
  // Preferred warehouse validation (optional)
  body('preferredWarehouse')
    .optional()
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Preferred warehouse must be a valid ObjectId'),
  
  // Address validation (optional, for branches)
  body('address.street')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Street address must not exceed 200 characters'),
  
  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City must not exceed 100 characters'),
  
  body('address.state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State must not exceed 100 characters'),
  
  body('address.postalCode')
    .optional()
    .trim()
    .matches(/^[0-9]{6}$/)
    .withMessage('Postal code must be a valid 6-digit Indian PIN code'),
  
  body('address.country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country must not exceed 100 characters'),
  
  // Contact validation (optional)
  body('contact.phone')
    .optional()
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Phone must be a valid 10-digit Indian phone number'),
  
  body('contact.email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Email must be a valid email address')
    .normalizeEmail(),
  
  body('contact.manager')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Manager name must not exceed 100 characters'),
  
  // GST and FSSAI validation (optional)
  body('gstNumber')
    .optional()
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage('GST number must be in valid format (e.g., 22AAAAA0000A1Z5)'),
  
  body('fssaiLicense')
    .optional()
    .trim()
    .matches(/^[0-9]{14}$/)
    .withMessage('FSSAI license must be a valid 14-digit number'),
  
  // Timezone validation (optional)
  body('timezone')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Timezone must not exceed 100 characters'),
  
  // Negative inventory policy validation (optional)
  body('negativeInventoryPolicy')
    .optional()
    .isIn(['allow_never', 'allow_temporarily', 'allow_always'])
    .withMessage('Negative inventory policy must be one of: allow_never, allow_temporarily, allow_always'),
  
  validate
];

/**
 * Validation for updating a location
 */
export const updateLocationValidation = [
  validateObjectId('id'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Location name must be between 2 and 200 characters'),
  
  body('code')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Location code must be between 2 and 50 characters')
    .matches(/^[A-Z0-9_-]+$/i)
    .withMessage('Location code can only contain letters, numbers, hyphens, and underscores'),
  
  body('type')
    .optional()
    .isIn(['branch', 'warehouse', 'central_kitchen', 'cloud_kitchen'])
    .withMessage('Location type must be one of: branch, warehouse, central_kitchen, cloud_kitchen'),
  
  // Capabilities validation (optional)
  body('capabilities.canProcureDirectly')
    .optional()
    .isBoolean()
    .withMessage('canProcureDirectly must be a boolean'),
  
  body('capabilities.canDispatchStock')
    .optional()
    .isBoolean()
    .withMessage('canDispatchStock must be a boolean'),
  
  body('capabilities.canReceiveStock')
    .optional()
    .isBoolean()
    .withMessage('canReceiveStock must be a boolean'),
  
  body('capabilities.isProductionUnit')
    .optional()
    .isBoolean()
    .withMessage('isProductionUnit must be a boolean'),
  
  body('capabilities.allowsCustomerOrders')
    .optional()
    .isBoolean()
    .withMessage('allowsCustomerOrders must be a boolean'),
  
  // Preferred warehouse validation (optional)
  body('preferredWarehouse')
    .optional()
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Preferred warehouse must be a valid ObjectId'),
  
  // Address validation (optional)
  body('address.street')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Street address must not exceed 200 characters'),
  
  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City must not exceed 100 characters'),
  
  body('address.state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State must not exceed 100 characters'),
  
  body('address.postalCode')
    .optional()
    .trim()
    .matches(/^[0-9]{6}$/)
    .withMessage('Postal code must be a valid 6-digit Indian PIN code'),
  
  body('address.country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country must not exceed 100 characters'),
  
  // Contact validation (optional)
  body('contact.phone')
    .optional()
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Phone must be a valid 10-digit Indian phone number'),
  
  body('contact.email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Email must be a valid email address')
    .normalizeEmail(),
  
  body('contact.manager')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Manager name must not exceed 100 characters'),
  
  // GST and FSSAI validation (optional)
  body('gstNumber')
    .optional()
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage('GST number must be in valid format (e.g., 22AAAAA0000A1Z5)'),
  
  body('fssaiLicense')
    .optional()
    .trim()
    .matches(/^[0-9]{14}$/)
    .withMessage('FSSAI license must be a valid 14-digit number'),
  
  // Timezone validation (optional)
  body('timezone')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Timezone must not exceed 100 characters'),
  
  // Negative inventory policy validation (optional)
  body('negativeInventoryPolicy')
    .optional()
    .isIn(['allow_never', 'allow_temporarily', 'allow_always'])
    .withMessage('Negative inventory policy must be one of: allow_never, allow_temporarily, allow_always'),
  
  validate
];

/**
 * Validation for getting a location by ID
 */
export const getLocationValidation = [
  validateObjectId('id'),
  
  query('includeArchived')
    .optional()
    .isBoolean()
    .withMessage('includeArchived must be a boolean'),
  
  validate
];

/**
 * Validation for archiving/deleting a location
 */
export const archiveLocationValidation = [
  validateObjectId('id'),
  validate
];

/**
 * Validation for listing locations
 */
export const listLocationsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query must not exceed 200 characters'),
  
  query('type')
    .optional()
    .isIn(['branch', 'warehouse', 'central_kitchen', 'cloud_kitchen', 'all'])
    .withMessage('Type must be one of: branch, warehouse, central_kitchen, cloud_kitchen, all'),
  
  query('isActive')
    .optional()
    .isIn(['true', 'false', 'all'])
    .withMessage('isActive must be one of: true, false, all'),
  
  query('includeArchived')
    .optional()
    .isBoolean()
    .withMessage('includeArchived must be a boolean'),
  
  query('capability')
    .optional()
    .isIn(['canProcureDirectly', 'canDispatchStock', 'canReceiveStock', 'isProductionUnit', 'allowsCustomerOrders', ''])
    .withMessage('Capability must be a valid capability name'),
  
  validate
];

/**
 * Validation for getting locations by capability
 */
export const getLocationsByCapabilityValidation = [
  param('capability')
    .notEmpty()
    .withMessage('Capability is required')
    .isIn(['canProcureDirectly', 'canDispatchStock', 'canReceiveStock', 'isProductionUnit', 'allowsCustomerOrders'])
    .withMessage('Capability must be one of: canProcureDirectly, canDispatchStock, canReceiveStock, isProductionUnit, allowsCustomerOrders'),
  
  validate
];
