import express from 'express';
import notificationController from '../controllers/notificationController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get notifications
router.get('/', notificationController.getNotifications);

// Get unread count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Mark all as read
router.patch('/read-all', notificationController.markAllAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

// Get notification settings
router.get('/settings', notificationController.getSettings);

// Update notification settings
router.put('/settings', notificationController.updateSettings);

// Update specific event preference
router.patch('/settings/events/:event', notificationController.updateEventPreference);

// Test notification
router.post('/test', notificationController.testNotification);

export default router;
