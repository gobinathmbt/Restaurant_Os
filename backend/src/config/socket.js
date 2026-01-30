import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import notificationService from '../services/notificationService.js';

class SocketManager {
  constructor() {
    this.io = null;
    this.platformAdminNamespace = null;
    this.companyNamespace = null;
    this.platformAdminSockets = new Map(); // userId -> socketId
    this.companySockets = new Map(); // companyId -> Set of socketIds
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Platform Admin Namespace
    this.platformAdminNamespace = this.io.of('/platform-admin');
    this.setupPlatformAdminNamespace();

    // Company Namespace
    this.companyNamespace = this.io.of('/company');
    this.setupCompanyNamespace();

    logger.info('Socket.IO initialized with namespaces');
  }

  setupPlatformAdminNamespace() {
    this.platformAdminNamespace.use(this.authenticatePlatformAdmin.bind(this));

    this.platformAdminNamespace.on('connection', (socket) => {
      const userId = socket.user.id;
      logger.info(`Platform Admin connected: ${userId}`);

      // Store socket connection
      this.platformAdminSockets.set(userId, socket.id);

      // Join personal room
      socket.join(`platform-admin-${userId}`);

      // Handle notification requests
      this.setupPlatformAdminHandlers(socket);

      socket.on('disconnect', () => {
        logger.info(`Platform Admin disconnected: ${userId}`);
        this.platformAdminSockets.delete(userId);
      });

      socket.on('error', (error) => {
        logger.error('Platform Admin socket error:', error);
      });
    });
  }

  setupCompanyNamespace() {
    this.companyNamespace.use(this.authenticateCompany.bind(this));

    this.companyNamespace.on('connection', (socket) => {
      const { userId, companyId, role } = socket.user;
      logger.info(`Company user connected: ${userId} from company: ${companyId}`);

      // Store socket connection
      if (!this.companySockets.has(companyId)) {
        this.companySockets.set(companyId, new Set());
      }
      this.companySockets.get(companyId).add(socket.id);

      // Join company room
      socket.join(`company-${companyId}`);
      
      // Join personal room
      socket.join(`user-${userId}`);

      // Join role-based room
      socket.join(`company-${companyId}-${role}`);

      // Handle notification requests
      this.setupCompanyHandlers(socket);

      socket.on('disconnect', () => {
        logger.info(`Company user disconnected: ${userId}`);
        const companySockets = this.companySockets.get(companyId);
        if (companySockets) {
          companySockets.delete(socket.id);
          if (companySockets.size === 0) {
            this.companySockets.delete(companyId);
          }
        }
      });

      socket.on('error', (error) => {
        logger.error('Company socket error:', error);
      });
    });
  }

  setupPlatformAdminHandlers(socket) {
    const userId = socket.user.id;

    // Get notifications
    socket.on('notifications:get', async (data, callback) => {
      try {
        const { page = 1, limit = 20, unreadOnly = false, category } = data || {};
        
        const result = await notificationService.getNotifications(userId, {
          page,
          limit,
          unreadOnly,
          category,
          isPlatformAdmin: true
        });

        callback({ success: true, data: result });
      } catch (error) {
        logger.error('Error getting notifications:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Get unread count
    socket.on('notifications:getUnreadCount', async (data, callback) => {
      try {
        const count = await notificationService.getUnreadCount(userId, null, true);
        callback({ success: true, data: { count } });
      } catch (error) {
        logger.error('Error getting unread count:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Mark as read
    socket.on('notifications:markAsRead', async (data, callback) => {
      try {
        const { notificationId } = data;
        const notification = await notificationService.markAsRead(
          notificationId,
          userId,
          null,
          true
        );
        callback({ success: true, data: notification });
      } catch (error) {
        logger.error('Error marking notification as read:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Mark all as read
    socket.on('notifications:markAllAsRead', async (data, callback) => {
      try {
        const result = await notificationService.markAllAsRead(userId, null, true);
        callback({ success: true, data: { modifiedCount: result.modifiedCount } });
      } catch (error) {
        logger.error('Error marking all as read:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Delete notification
    socket.on('notifications:delete', async (data, callback) => {
      try {
        const { notificationId } = data;
        await notificationService.deleteNotification(notificationId, userId, null, true);
        callback({ success: true, message: 'Notification deleted' });
      } catch (error) {
        logger.error('Error deleting notification:', error);
        callback({ success: false, error: error.message });
      }
    });
  }

  setupCompanyHandlers(socket) {
    const { userId, companyId } = socket.user;

    // Get notifications
    socket.on('notifications:get', async (data, callback) => {
      try {
        const { page = 1, limit = 20, unreadOnly = false, category } = data || {};
        
        const result = await notificationService.getNotifications(userId, {
          page,
          limit,
          unreadOnly,
          category,
          companyId,
          isPlatformAdmin: false
        });

        callback({ success: true, data: result });
      } catch (error) {
        logger.error('Error getting notifications:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Get unread count
    socket.on('notifications:getUnreadCount', async (data, callback) => {
      try {
        const count = await notificationService.getUnreadCount(userId, companyId, false);
        callback({ success: true, data: { count } });
      } catch (error) {
        logger.error('Error getting unread count:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Mark as read
    socket.on('notifications:markAsRead', async (data, callback) => {
      try {
        const { notificationId } = data;
        const notification = await notificationService.markAsRead(
          notificationId,
          userId,
          companyId,
          false
        );
        callback({ success: true, data: notification });
      } catch (error) {
        logger.error('Error marking notification as read:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Mark all as read
    socket.on('notifications:markAllAsRead', async (data, callback) => {
      try {
        const result = await notificationService.markAllAsRead(userId, companyId, false);
        callback({ success: true, data: { modifiedCount: result.modifiedCount } });
      } catch (error) {
        logger.error('Error marking all as read:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Delete notification
    socket.on('notifications:delete', async (data, callback) => {
      try {
        const { notificationId } = data;
        await notificationService.deleteNotification(notificationId, userId, companyId, false);
        callback({ success: true, message: 'Notification deleted' });
      } catch (error) {
        logger.error('Error deleting notification:', error);
        callback({ success: false, error: error.message });
      }
    });
  }

  async authenticatePlatformAdmin(socket, next) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user is a platform admin
      const { default: PlatformAdmin } = await import('../models/platform/PlatformAdmin.js');
      const admin = await PlatformAdmin.findById(decoded.userId);

      if (!admin) {
        return next(new Error('Unauthorized: Platform admin access only'));
      }

      if (!admin.isActive) {
        return next(new Error('Account is deactivated'));
      }

      socket.user = {
        id: admin._id,
        role: admin.role,
        email: admin.email
      };

      next();
    } catch (error) {
      logger.error('Platform admin socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  }

  async authenticateCompany(socket, next) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user is a company user
      const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
      const user = await CompanyUser.findById(decoded.userId);

      if (!user) {
        return next(new Error('Unauthorized: Company access only'));
      }

      if (!user.isActive) {
        return next(new Error('Account is deactivated'));
      }

      if (!user.companyId) {
        return next(new Error('User not associated with a company'));
      }

      socket.user = {
        id: user._id,
        userId: user._id,
        companyId: user.companyId,
        role: user.role,
        email: user.email
      };

      next();
    } catch (error) {
      logger.error('Company socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  }

  // Emit to specific platform admin
  emitToPlatformAdmin(userId, event, data) {
    this.platformAdminNamespace.to(`platform-admin-${userId}`).emit(event, data);
  }

  // Emit to all platform admins
  emitToAllPlatformAdmins(event, data) {
    this.platformAdminNamespace.emit(event, data);
  }

  // Emit to specific company
  emitToCompany(companyId, event, data) {
    this.companyNamespace.to(`company-${companyId}`).emit(event, data);
  }

  // Emit to specific user in company
  emitToCompanyUser(userId, event, data) {
    this.companyNamespace.to(`user-${userId}`).emit(event, data);
  }

  // Emit to specific role in company
  emitToCompanyRole(companyId, role, event, data) {
    this.companyNamespace.to(`company-${companyId}-${role}`).emit(event, data);
  }

  getIO() {
    return this.io;
  }

  getPlatformAdminNamespace() {
    return this.platformAdminNamespace;
  }

  getCompanyNamespace() {
    return this.companyNamespace;
  }
}

export default new SocketManager();
