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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const socket = useSocket();

  // Fetch notifications from Socket
  const fetchNotifications = useCallback(async (options?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    category?: string;
    append?: boolean;
  }) => {
    if (!socket.isConnected) {
      setError('Socket not connected');
      return;
    }

    try {
      const isAppending = options?.append || false;
      
      if (isAppending) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      socketService.getNotifications(options || {}, (response) => {
        if (response.success) {
          const newNotifications = response.data.notifications;
          const totalPages = response.data.pagination?.totalPages || 1;
          const currentPage = response.data.pagination?.currentPage || 1;
                    
          if (isAppending) {
            // Append new notifications to existing ones
            setNotifications(prev => [...prev, ...newNotifications]);
          } else {
            // Replace notifications (initial load)
            setNotifications(newNotifications);
          }
          
          // Update hasMore based on pagination
          setHasMore(currentPage < totalPages);
          setPage(currentPage);
        } else {
          console.error('Failed to fetch notifications:', response.error);
          setError(response.error || 'Failed to fetch notifications');
        }
        
        if (isAppending) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      });
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError(err.message || 'Failed to fetch notifications');
      setLoading(false);
      setLoadingMore(false);
    }
  }, [socket.isConnected]);

  // Load more notifications
  const loadMoreNotifications = useCallback(() => {
    if (!hasMore || loadingMore || loading) {
      return;
    }
    
    const nextPage = page + 1;
    fetchNotifications({ page: nextPage, limit: 20, append: true });
  }, [hasMore, loadingMore, loading, page, fetchNotifications]);

  // Fetch unread count from Socket
  const fetchUnreadCount = useCallback(async () => {
    if (!socket.isConnected) {
      return;
    }

    socketService.getUnreadCount((response) => {
      if (response.success) {
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
    if (!socket.isConnected) {
      return;
    }
    
    // Update notification state and check if it was unread
    let wasUnread = false;
    
    setNotifications(prev => {
      const notification = prev.find(n => n._id === notificationId);
      wasUnread = notification ? !notification.channels.inApp.read : false;
      
      return prev.map(n =>
        n._id === notificationId
          ? { ...n, channels: { ...n.channels, inApp: { ...n.channels.inApp, read: true, readAt: new Date().toISOString() } } }
          : n
      );
    });
    
    // Decrement count if it was unread
    if (wasUnread) {
      setUnreadCount(prev => {
        const newCount = Math.max(0, prev - 1);
        return newCount;
      });
    }

    // Send to server (don't wait for response to update UI)
    socketService.markNotificationAsRead(notificationId, (response) => {
      if (response.success) {
        socket.markAsRead(notificationId);
      } else {
        console.error('Error marking notification as read:', response.error);
        // Revert on error
        if (wasUnread) {
          setUnreadCount(prev => prev + 1);
          setNotifications(prev =>
            prev.map(n =>
              n._id === notificationId
                ? { ...n, channels: { ...n.channels, inApp: { ...n.channels.inApp, read: false, readAt: undefined } } }
                : n
            )
          );
        }
      }
    });
  }, [socket]);

  // Mark all as read via Socket
  const markAllAsRead = useCallback(async () => {
    if (!socket.isConnected) {
      return;
    }
    
    // Update all notifications to read and set count to 0
    setNotifications(prev =>
      prev.map(n => ({
        ...n,
        channels: { ...n.channels, inApp: { ...n.channels.inApp, read: true, readAt: new Date().toISOString() } }
      }))
    );
    
    // Set count to 0
    setUnreadCount(0);

    // Send to server (don't wait for response to update UI)
    socketService.markAllNotificationsAsRead((response) => {
      if (response.success) {
        socket.markAllAsRead();
      } else {
        console.error('Error marking all notifications as read:', response.error);
        // Refetch on error to get correct state
        fetchNotifications({ page: 1, limit: 20 });
        fetchUnreadCount();
      }
    });
  }, [socket, fetchNotifications, fetchUnreadCount]);

  // Delete notification via Socket
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!socket.isConnected) {
      return;
    }
    
    // Check if notification is unread and update state
    let wasUnread = false;
    let deletedNotification: Notification | undefined;
    
    setNotifications(prev => {
      deletedNotification = prev.find(n => n._id === notificationId);
      wasUnread = deletedNotification ? !deletedNotification.channels.inApp.read : false;
      return prev.filter(n => n._id !== notificationId);
    });
    
    // Decrement count if it was unread
    if (wasUnread) {
      setUnreadCount(prev => {
        const newCount = Math.max(0, prev - 1);
        return newCount;
      });
    }

    // Send to server (don't wait for response to update UI)
    socketService.deleteNotification(notificationId, (response) => {
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Notification deleted successfully'
        });
      } else {
        console.error('Error deleting notification:', response.error);
        // Revert on error
        if (deletedNotification) {
          setNotifications(prev => [...prev, deletedNotification].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ));
          if (wasUnread) {
            setUnreadCount(prev => prev + 1);
          }
        }
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
      // Reset pagination state on reconnect
      setPage(1);
      setHasMore(true);
      
      // Small delay to ensure socket is fully ready
      const timer = setTimeout(() => {
        fetchNotifications({ page: 1, limit: 20 });
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
    loadingMore,
    error,
    hasMore,
    isConnected: socket.isConnected,
    fetchNotifications,
    loadMoreNotifications,
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
