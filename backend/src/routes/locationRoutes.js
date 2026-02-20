/**
 * Location Routes
 * API endpoints for location management
 * Supports branches, warehouses, central kitchens, and cloud kitchens
 */

import express from 'express';
import {
  createLocationHandler,
  getLocationHandler,
  updateLocationHandler,
  archiveLocationHandler,
  listLocationsHandler,
  getLocationsByCapabilityHandler,
  restoreLocationHandler
} from '../controllers/locationController.js';
import {
  createLocationValidation,
  updateLocationValidation,
  getLocationValidation,
  archiveLocationValidation,
  listLocationsValidation,
  getLocationsByCapabilityValidation
} from '../middlewares/locationValidation.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/locations/by-capability/:capability
 * Get locations by specific capability
 * Must be defined before /:id route to avoid route conflict
 */
router.get(
  '/by-capability/:capability',
  getLocationsByCapabilityValidation,
  getLocationsByCapabilityHandler
);

/**
 * GET /api/locations
 * List all locations with filtering and pagination
 */
router.get(
  '/',
  listLocationsValidation,
  listLocationsHandler
);

/**
 * GET /api/locations/:id
 * Get a specific location by ID
 */
router.get(
  '/:id',
  getLocationValidation,
  getLocationHandler
);

/**
 * POST /api/locations
 * Create a new location
 * Requires super admin role
 */
router.post(
  '/',
  createLocationValidation,
  createLocationHandler
);

/**
 * PUT /api/locations/:id
 * Update an existing location
 * Requires super admin role
 */
router.put(
  '/:id',
  updateLocationValidation,
  updateLocationHandler
);

/**
 * DELETE /api/locations/:id
 * Archive a location (soft delete)
 * Requires super admin role
 */
router.delete(
  '/:id',
  archiveLocationValidation,
  archiveLocationHandler
);

/**
 * POST /api/locations/:id/restore
 * Restore an archived location
 * Requires super admin role
 */
router.post(
  '/:id/restore',
  archiveLocationValidation,
  restoreLocationHandler
);

export default router;
