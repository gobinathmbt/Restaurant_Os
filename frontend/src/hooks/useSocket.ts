import { useEffect, useState, useCallback } from 'react';
import { socketService, NotificationData } from '../services/socket';
import { useAuth } from '../contexts/AuthContext';

export const useSocket = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Connect socket based on user role
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    
    if (!user || !token) {
      socketService.disconnectAll();
      setIsConnected(false);
      return;
    }

    // Connect to appropriate namespace based on role
    if (user.role === 'platform_admin') {
      socketService.connectPlatformAdmin(token);
    } else if (user.companyId) {
      socketService.connectCompany(token);
    }

    // Setup event listeners
    const unsubscribeConnect = socketService.onConnect(() => {
      setIsConnected(true);
      console.log('Socket connected');
    });

    const unsubscribeDisconnect = socketService.onDisconnect(() => {
      setIsConnected(false);
      console.log('Socket disconnected');
    });

    const unsubscribeError = socketService.onError((error) => {
      console.error('Socket error:', error);
    });

    // Cleanup on unmount
    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeError();
      socketService.disconnectAll();
    };
  }, [user]);

  // Handle incoming notifications
  const handleNotification = useCallback((notification: NotificationData) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
  }, []);

  // Subscribe to notifications
  useEffect(() => {
    const unsubscribe = socketService.onNotification(handleNotification);
    return unsubscribe;
  }, [handleNotification]);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  return {
    isConnected,
    notifications,
    unreadCount,
    clearNotifications,
    markAsRead,
    markAllAsRead
  };
};
