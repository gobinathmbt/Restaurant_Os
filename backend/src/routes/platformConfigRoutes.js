import express from 'express';
import {
  getAllConfigs,
  getConfigById,
  updateConfig,
  toggleConfigStatus,
  getConfigStats,
} from '../controllers/platformConfigController.js';
import { authenticate, requirePlatformSuperAdmin } from '../middlewares/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

/**
 * Validation middleware
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
 * All routes require authentication and platform super admin role
 */
router.use(authenticate);
router.use(requirePlatformSuperAdmin);

/**
 * GET /api/platform-config/stats
 * Get configuration statistics
 */
router.get('/stats', getConfigStats);

/**
 * GET /api/platform-config
 * Get all platform configurations with pagination and filters
 */
router.get('/', getAllConfigs);

/**
 * GET /api/platform-config/:id
 * Get single configuration by ID
 */
router.get('/:id', getConfigById);

/**
 * PUT /api/platform-config/:id
 * Update platform configuration
 */
router.put(
  '/:id',
  [
    body('configValue')
      .optional()
      .custom((value) => {
        // Allow any type of value (string, number, boolean, object, array)
        return true;
      }),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must not exceed 500 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    validate,
  ],
  updateConfig
);

/**
 * PATCH /api/platform-config/:id/toggle
 * Toggle configuration active status
 */
router.patch('/:id/toggle', toggleConfigStatus);

export default router;
