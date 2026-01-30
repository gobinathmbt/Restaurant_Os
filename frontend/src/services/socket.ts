import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '../lib/config';

export interface NotificationData {
  id: string;
  category: string;
  event: string;
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actionUrl?: string;
  createdAt: string;
}

type NotificationCallback = (notification: NotificationData) => void;
type ConnectionCallback = () => void;
type ErrorCallback = (error: Error) => void;

class SocketService {
  private platformAdminSocket: Socket | null = null;
  private companySocket: Socket | null = null;
  private notificationCallbacks: Set<NotificationCallback> = new Set();
  private connectionCallbacks: Set<ConnectionCallback> = new Set();
  private disconnectionCallbacks: Set<ConnectionCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();

  /**
   * Connect to platform admin namespace
   */
  connectPlatformAdmin(token: string): void {
    if (this.platformAdminSocket?.connected) {
      console.log('Platform admin socket already connected');
      // Trigger connection callback for already connected socket
      this.connectionCallbacks.forEach(callback => callback());
      return;
    }

    const socketUrl = API_CONFIG.SOCKET_URL || API_CONFIG.BASE_URL.replace('/api', '');

    this.platformAdminSocket = io(`${socketUrl}/platform-admin`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    this.setupSocketListeners(this.platformAdminSocket, 'Platform Admin');
  }

  /**
   * Connect to company namespace
   */
  connectCompany(token: string): void {
    if (this.companySocket?.connected) {
      console.log('Company socket already connected');
      // Trigger connection callback for already connected socket
      this.connectionCallbacks.forEach(callback => callback());
      return;
    }

    const socketUrl = API_CONFIG.SOCKET_URL || API_CONFIG.BASE_URL.replace('/api', '');

    this.companySocket = io(`${socketUrl}/company`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    this.setupSocketListeners(this.companySocket, 'Company');
  }

  /**
   * Setup socket event listeners
   */
  private setupSocketListeners(socket: Socket, namespace: string): void {
    socket.on('connect', () => {
      console.log(`${namespace} socket connected:`, socket.id);
      this.connectionCallbacks.forEach(callback => callback());
    });

    socket.on('disconnect', (reason) => {
      console.log(`${namespace} socket disconnected:`, reason);
      this.disconnectionCallbacks.forEach(callback => callback());
    });

    socket.on('connect_error', (error) => {
      console.error(`${namespace} socket connection error:`, error);
      this.errorCallbacks.forEach(callback => callback(error));
    });

    socket.on('notification', (notification: NotificationData) => {
      console.log(`${namespace} notification received:`, notification);
      this.notificationCallbacks.forEach(callback => callback(notification));
    });

    socket.on('error', (error) => {
      console.error(`${namespace} socket error:`, error);
      this.errorCallbacks.forEach(callback => callback(new Error(error)));
    });
  }

  /**
   * Disconnect platform admin socket
   */
  disconnectPlatformAdmin(): void {
    if (this.platformAdminSocket) {
      this.platformAdminSocket.disconnect();
      this.platformAdminSocket = null;
      console.log('Platform admin socket disconnected');
    }
  }

  /**
   * Disconnect company socket
   */
  disconnectCompany(): void {
    if (this.companySocket) {
      this.companySocket.disconnect();
      this.companySocket = null;
      console.log('Company socket disconnected');
    }
  }

  /**
   * Disconnect all sockets
   */
  disconnectAll(): void {
    this.disconnectPlatformAdmin();
    this.disconnectCompany();
  }

  /**
   * Subscribe to notifications
   */
  onNotification(callback: NotificationCallback): () => void {
    this.notificationCallbacks.add(callback);
    return () => this.notificationCallbacks.delete(callback);
  }

  /**
   * Subscribe to connection events
   */
  onConnect(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);
    return () => this.connectionCallbacks.delete(callback);
  }

  /**
   * Subscribe to disconnection events
   */
  onDisconnect(callback: ConnectionCallback): () => void {
    this.disconnectionCallbacks.add(callback);
    return () => this.disconnectionCallbacks.delete(callback);
  }

  /**
   * Subscribe to error events
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  /**
   * Check if platform admin socket is connected
   */
  isPlatformAdminConnected(): boolean {
    return this.platformAdminSocket?.connected || false;
  }

  /**
   * Check if company socket is connected
   */
  isCompanyConnected(): boolean {
    return this.companySocket?.connected || false;
  }

  /**
   * Get platform admin socket instance
   */
  getPlatformAdminSocket(): Socket | null {
    return this.platformAdminSocket;
  }

  /**
   * Get company socket instance
   */
  getCompanySocket(): Socket | null {
    return this.companySocket;
  }

  /**
   * Socket event emitters with callbacks
   */

  // Get notifications
  getNotifications(options: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    category?: string;
  }, callback: (response: any) => void): void {
    const socket = this.platformAdminSocket || this.companySocket;
    if (socket && socket.connected) {
      socket.emit('notifications:get', options, callback);
    } else {
      callback({ success: false, error: 'Socket not connected' });
    }
  }

  // Get unread count
  getUnreadCount(callback: (response: any) => void): void {
    const socket = this.platformAdminSocket || this.companySocket;
    if (socket && socket.connected) {
      socket.emit('notifications:getUnreadCount', {}, callback);
    } else {
      callback({ success: false, error: 'Socket not connected' });
    }
  }

  // Mark notification as read
  markNotificationAsRead(notificationId: string, callback: (response: any) => void): void {
    const socket = this.platformAdminSocket || this.companySocket;
    if (socket && socket.connected) {
      socket.emit('notifications:markAsRead', { notificationId }, callback);
    } else {
      callback({ success: false, error: 'Socket not connected' });
    }
  }

  // Mark all as read
  markAllNotificationsAsRead(callback: (response: any) => void): void {
    const socket = this.platformAdminSocket || this.companySocket;
    if (socket && socket.connected) {
      socket.emit('notifications:markAllAsRead', {}, callback);
    } else {
      callback({ success: false, error: 'Socket not connected' });
    }
  }

  // Delete notification
  deleteNotification(notificationId: string, callback: (response: any) => void): void {
    const socket = this.platformAdminSocket || this.companySocket;
    if (socket && socket.connected) {
      socket.emit('notifications:delete', { notificationId }, callback);
    } else {
      callback({ success: false, error: 'Socket not connected' });
    }
  }
}

export const socketService = new SocketService();
