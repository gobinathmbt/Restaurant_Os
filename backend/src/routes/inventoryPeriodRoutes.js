/**
 * Inventory Period Routes
 * API endpoints for inventory period locking operations
 * Ensures financial compliance by preventing backdated transactions
 */

import express from 'express';
import {
  createPeriodHandler,
  lockPeriodHandler,
  unlockPeriodHandler,
  getPeriodHandler,
  getPeriodsByLocationHandler,
  getLockedPeriodsHandler,
  deletePeriodHandler
} from '../controllers/inventoryPeriodController.js';
import { authenticate } from '../middlewares/auth.js';
import { body, param, query } from 'express-validator';
import { validate, validateObjectId } from '../middlewares/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * Validation for creating a period
 */
const createPeriodValidation = [
  body('locationId')
    .notEmpty()
    .withMessage('Location ID is required')
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Location ID must be a valid ObjectId'),
  
  body('periodStart')
    .notEmpty()
    .withMessage('Period start date is required')
    .isISO8601()
    .withMessage('Period start must be a valid date'),
  
  body('periodEnd')
    .notEmpty()
    .withMessage('Period end date is required')
    .isISO8601()
    .withMessage('Period end must be a valid date'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),
  
  validate
];

/**
 * Validation for getting periods by location
 */
const getPeriodsByLocationValidation = [
  validateObjectId('locationId'),
  
  query('status')
    .optional()
    .isIn(['open', 'locked'])
    .withMessage('Status must be either open or locked'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  validate
];

/**
 * Validation for getting locked periods
 */
const getLockedPeriodsValidation = [
  validateObjectId('locationId'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  validate
];

/**
 * GET /api/inventory-periods/location/:locationId
 * Get all periods for a specific location
 */
router.get(
  '/location/:locationId',
  getPeriodsByLocationValidation,
  getPeriodsByLocationHandler
);

/**
 * GET /api/inventory-periods/locked/:locationId
 * Get locked periods for a specific location and date range
 */
router.get(
  '/locked/:locationId',
  getLockedPeriodsValidation,
  getLockedPeriodsHandler
);

/**
 * GET /api/inventory-periods/:id
 * Get a specific period by ID
 */
router.get(
  '/:id',
  validateObjectId('id'),
  getPeriodHandler
);

/**
 * POST /api/inventory-periods
 * Create a new inventory period
 * Requires super admin or financial controller role
 */
router.post(
  '/',
  createPeriodValidation,
  createPeriodHandler
);

/**
 * PUT /api/inventory-periods/:id/lock
 * Lock an inventory period
 * Requires super admin or financial controller role
 */
router.put(
  '/:id/lock',
  validateObjectId('id'),
  lockPeriodHandler
);

/**
 * PUT /api/inventory-periods/:id/unlock
 * Unlock an inventory period
 * Requires super admin or financial controller role
 */
router.put(
  '/:id/unlock',
  validateObjectId('id'),
  unlockPeriodHandler
);

/**
 * DELETE /api/inventory-periods/:id
 * Delete a period (only if not locked)
 * Requires super admin role
 */
router.delete(
  '/:id',
  validateObjectId('id'),
  deletePeriodHandler
);

export default router;
