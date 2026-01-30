import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

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

  async authenticatePlatformAdmin(socket, next) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.role !== 'platform_admin') {
        return next(new Error('Unauthorized: Platform admin access only'));
      }

      socket.user = {
        id: decoded.userId,
        role: decoded.role
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

      if (!decoded.companyId) {
        return next(new Error('Unauthorized: Company access only'));
      }

      socket.user = {
        id: decoded.userId,
        companyId: decoded.companyId,
        role: decoded.role
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
