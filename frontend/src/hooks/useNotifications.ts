import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/axios';
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

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (options?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    category?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.unreadOnly) params.append('unreadOnly', 'true');
      if (options?.category) params.append('category', options.category);

      const response = await apiClient.get(`/notifications?${params.toString()}`);
      
      if (response.data.success) {
        setNotifications(response.data.data.notifications);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await apiClient.get('/notifications/unread-count');
      if (response.data.success) {
        setUnreadCount(response.data.data.count);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, []);

  // Fetch notification settings
  const fetchSettings = useCallback(async () => {
    try {
      const response = await apiClient.get('/notifications/settings');
      if (response.data.success) {
        setSettings(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching notification settings:', err);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await apiClient.patch(`/notifications/${notificationId}/read`);
      
      if (response.data.success) {
        setNotifications(prev =>
          prev.map(n =>
            n._id === notificationId
              ? { ...n, channels: { ...n.channels, inApp: { ...n.channels.inApp, read: true } } }
              : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
        socket.markAsRead(notificationId);
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, [socket]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await apiClient.patch('/notifications/read-all');
      
      if (response.data.success) {
        setNotifications(prev =>
          prev.map(n => ({
            ...n,
            channels: { ...n.channels, inApp: { ...n.channels.inApp, read: true } }
          }))
        );
        setUnreadCount(0);
        socket.markAllAsRead();
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, [socket]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await apiClient.delete(`/notifications/${notificationId}`);
      
      if (response.data.success) {
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
        toast({
          title: 'Success',
          description: 'Notification deleted successfully'
        });
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete notification',
        variant: 'destructive'
      });
    }
  }, []);

  // Update notification settings
  const updateSettings = useCallback(async (updates: Partial<NotificationSettings>) => {
    try {
      const response = await apiClient.put('/notifications/settings', updates);
      
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

  // Update event preference
  const updateEventPreference = useCallback(async (
    event: string,
    updates: { enabled?: boolean; channels?: any }
  ) => {
    try {
      const response = await apiClient.patch(`/notifications/settings/events/${event}`, updates);
      
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

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    try {
      const response = await apiClient.post('/notifications/test');
      
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
    }
  }, [socket.notifications]);

  // Sync unread count with socket
  useEffect(() => {
    setUnreadCount(socket.unreadCount);
  }, [socket.unreadCount]);

  // Initial data fetch
  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    fetchSettings();
  }, [fetchNotifications, fetchUnreadCount, fetchSettings]);

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
