import express from 'express';
import notificationController from '../controllers/notificationController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ONLY SETTINGS ENDPOINTS - All other operations handled via Socket.IO

// Get notification settings
router.get('/settings', notificationController.getSettings);

// Update notification settings
router.put('/settings', notificationController.updateSettings);

// Update specific event preference
router.patch('/settings/events/:event', notificationController.updateEventPreference);

// Test notification (for testing purposes)
router.post('/test', notificationController.testNotification);

export default router;
