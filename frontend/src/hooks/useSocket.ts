import { useEffect, useState, useCallback } from 'react';
import { socketService, NotificationData } from '../services/socket';
import { useAuth } from '../contexts/AuthContext';

export const useSocket = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Connect socket based on user type
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    
    if (!user || !token) {
      return; // Don't disconnect, just don't connect
    }

    // Connect to appropriate namespace based on userType
    if (user.userType === 'platform') {
      socketService.connectPlatformAdmin(token);
      // Check if already connected
      if (socketService.isPlatformAdminConnected()) {
        setIsConnected(true);
      }
    } else if (user.userType === 'company' && user.companyId) {
      socketService.connectCompany(token);
      // Check if already connected
      if (socketService.isCompanyConnected()) {
        setIsConnected(true);
      }
    }

    // Setup event listeners
    const unsubscribeConnect = socketService.onConnect(() => {
      setIsConnected(true);
    });

    const unsubscribeDisconnect = socketService.onDisconnect(() => {
      setIsConnected(false);
    });

    const unsubscribeError = socketService.onError((error) => {
      console.error('Socket error:', error);
    });

    // Cleanup on unmount - only unsubscribe listeners, don't disconnect socket
    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeError();
      // Don't disconnect socket here - keep it alive
    };
  }, [user]);

  // Handle incoming notifications (stable reference)
  const handleNotification = useCallback((notification: NotificationData) => {
    setNotifications(prev => [notification, ...prev]);
    // Don't increment count here - let useNotifications handle it via socket.notifications
  }, []); // No dependencies - stable reference

  // Subscribe to notifications (only once)
  useEffect(() => {
    const unsubscribe = socketService.onNotification(handleNotification);
    return unsubscribe;
  }, []); // Empty deps - only subscribe once

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
    );
    // Don't decrement count here - let useNotifications handle it
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    // Don't reset count here - let useNotifications handle it
  }, []);

  // Fetch unread count from server
  const fetchUnreadCount = useCallback(() => {
    socketService.getUnreadCount((response) => {
      if (response.success) {
        setUnreadCount(response.data.count);
      }
    });
  }, []);

  // Fetch unread count when socket connects (only once)
  useEffect(() => {
    if (isConnected) {
      // Small delay to ensure socket is fully ready
      const timer = setTimeout(() => {
        fetchUnreadCount();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isConnected]); // Remove fetchUnreadCount from deps

  return {
    isConnected,
    notifications,
    unreadCount,
    clearNotifications,
    markAsRead,
    markAllAsRead,
    fetchUnreadCount
  };
};
