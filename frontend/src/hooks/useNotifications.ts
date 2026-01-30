import { useState, useEffect, useCallback } from 'react';
import { notificationServices } from '../api/services';
import { socketService } from '../services/socket';
import { useSocket } from './useSocket';
import { toast } from './use-toast';

export interface Notification {
  _id: string;
  type: string;
  recipientType: string;
  recipientId: string;
  companyId?: string;
  category: string;
  event: string;
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channels: {
    inApp: {
      sent: boolean;
      sentAt?: string;
      read: boolean;
      readAt?: string;
    };
    email?: {
      sent: boolean;
      sentAt?: string;
      error?: string;
    };
    whatsapp?: {
      sent: boolean;
      sentAt?: string;
      error?: string;
    };
    sms?: {
      sent: boolean;
      sentAt?: string;
      error?: string;
    };
  };
  actionUrl?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface NotificationSettings {
  _id?: string;
  adminId?: string;
  companyId?: string;
  userId?: string;
  isPrimaryAdmin?: boolean;
  preferences: Record<string, any>;
  quietHours: {
    enabled: boolean;
    start?: string;
    end?: string;
    timezone?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socket = useSocket();

  // Fetch notifications from Socket
  const fetchNotifications = useCallback(async (options?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    category?: string;
  }) => {
    if (!socket.isConnected) {
      console.log('Cannot fetch notifications: Socket not connected');
      setError('Socket not connected');
      return;
    }

    try {
      console.log('Fetching notifications via socket...');
      setLoading(true);
      setError(null);

      socketService.getNotifications(options || {}, (response) => {
        console.log('Notifications response:', response);
        if (response.success) {
          console.log('Setting notifications:', response.data.notifications);
          setNotifications(response.data.notifications);
        } else {
          console.error('Failed to fetch notifications:', response.error);
          setError(response.error || 'Failed to fetch notifications');
        }
        setLoading(false);
      });
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError(err.message || 'Failed to fetch notifications');
      setLoading(false);
    }
  }, [socket.isConnected]);

  // Fetch unread count from Socket
  const fetchUnreadCount = useCallback(async () => {
    if (!socket.isConnected) {
      console.log('Cannot fetch unread count: Socket not connected');
      return;
    }

    console.log('Fetching unread count via socket...');
    socketService.getUnreadCount((response) => {
      if (response.success) {
        console.log('Unread count response:', response.data.count);
        setUnreadCount(response.data.count);
      } else {
        console.error('Failed to fetch unread count:', response.error);
      }
    });
  }, [socket.isConnected]);

  // Fetch notification settings via API
  const fetchSettings = useCallback(async () => {
    try {
      const response = await notificationServices.getSettings();
      if (response.data.success) {
        setSettings(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching notification settings:', err);
    }
  }, []);

  // Mark notification as read via Socket
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!socket.isConnected) return;

    socketService.markNotificationAsRead(notificationId, (response) => {
      if (response.success) {
        setNotifications(prev =>
          prev.map(n =>
            n._id === notificationId
              ? { ...n, channels: { ...n.channels, inApp: { ...n.channels.inApp, read: true } } }
              : n
          )
        );
        // Fetch updated count from server
        fetchUnreadCount();
        socket.markAsRead(notificationId);
      } else {
        console.error('Error marking notification as read:', response.error);
      }
    });
  }, [socket, fetchUnreadCount]);

  // Mark all as read via Socket
  const markAllAsRead = useCallback(async () => {
    if (!socket.isConnected) return;

    socketService.markAllNotificationsAsRead((response) => {
      if (response.success) {
        setNotifications(prev =>
          prev.map(n => ({
            ...n,
            channels: { ...n.channels, inApp: { ...n.channels.inApp, read: true } }
          }))
        );
        // Fetch updated count from server
        fetchUnreadCount();
        socket.markAllAsRead();
      } else {
        console.error('Error marking all notifications as read:', response.error);
      }
    });
  }, [socket, fetchUnreadCount]);

  // Delete notification via Socket
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!socket.isConnected) return;

    socketService.deleteNotification(notificationId, (response) => {
      if (response.success) {
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
        toast({
          title: 'Success',
          description: 'Notification deleted successfully'
        });
      } else {
        console.error('Error deleting notification:', response.error);
        toast({
          title: 'Error',
          description: 'Failed to delete notification',
          variant: 'destructive'
        });
      }
    });
  }, [socket]);

  // Update notification settings via API
  const updateSettings = useCallback(async (updates: Partial<NotificationSettings>) => {
    try {
      const response = await notificationServices.updateSettings(updates);
      
      if (response.data.success) {
        setSettings(response.data.data);
        toast({
          title: 'Success',
          description: 'Notification settings updated successfully'
        });
      }
    } catch (err) {
      console.error('Error updating notification settings:', err);
      toast({
        title: 'Error',
        description: 'Failed to update notification settings',
        variant: 'destructive'
      });
    }
  }, []);

  // Update event preference via API
  const updateEventPreference = useCallback(async (
    event: string,
    updates: { enabled?: boolean; channels?: any }
  ) => {
    try {
      const response = await notificationServices.updateEventPreference(event, updates);
      
      if (response.data.success) {
        setSettings(response.data.data);
        toast({
          title: 'Success',
          description: 'Event preference updated successfully'
        });
      }
    } catch (err) {
      console.error('Error updating event preference:', err);
      toast({
        title: 'Error',
        description: 'Failed to update event preference',
        variant: 'destructive'
      });
    }
  }, []);

  // Send test notification via API
  const sendTestNotification = useCallback(async () => {
    try {
      const response = await notificationServices.sendTestNotification();
      
      if (response.data.success) {
        toast({
          title: 'Success',
          description: 'Test notification sent successfully'
        });
      }
    } catch (err) {
      console.error('Error sending test notification:', err);
      toast({
        title: 'Error',
        description: 'Failed to send test notification',
        variant: 'destructive'
      });
    }
  }, []);

  // Handle real-time notifications from socket
  useEffect(() => {
    if (socket.notifications.length > 0) {
      const latestNotification = socket.notifications[0];
      
      // Add to notifications list
      setNotifications(prev => {
        const exists = prev.some(n => n._id === latestNotification.id);
        if (!exists) {
          return [
            {
              _id: latestNotification.id,
              type: '',
              recipientType: '',
              recipientId: '',
              category: latestNotification.category,
              event: latestNotification.event,
              title: latestNotification.title,
              message: latestNotification.message,
              data: latestNotification.data,
              priority: latestNotification.priority,
              channels: {
                inApp: { sent: true, read: false }
              },
              actionUrl: latestNotification.actionUrl,
              createdAt: latestNotification.createdAt
            },
            ...prev
          ];
        }
        return prev;
      });

      // Show toast notification
      toast({
        title: latestNotification.title,
        description: latestNotification.message,
        variant: latestNotification.priority === 'urgent' || latestNotification.priority === 'high' 
          ? 'destructive' 
          : 'default'
      });
      
      // Fetch updated count from server
      fetchUnreadCount();
    }
  }, [socket.notifications, toast, fetchUnreadCount]);

  // Don't sync from socket - useNotifications manages its own count
  // The count is fetched from server via fetchUnreadCount()

  // Initial data fetch - fetch notifications and count when socket connects (only once)
  useEffect(() => {
    if (socket.isConnected) {
      console.log('Socket connected, fetching notifications and count');
      // Small delay to ensure socket is fully ready
      const timer = setTimeout(() => {
        fetchNotifications();
        fetchUnreadCount();
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [socket.isConnected]); // Remove fetchNotifications and fetchUnreadCount from deps

  return {
    notifications,
    unreadCount,
    settings,
    loading,
    error,
    isConnected: socket.isConnected,
    fetchNotifications,
    fetchUnreadCount,
    fetchSettings,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updateSettings,
    updateEventPreference,
    sendTestNotification
  };
};
