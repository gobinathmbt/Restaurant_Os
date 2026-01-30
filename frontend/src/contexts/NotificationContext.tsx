import { createContext, useContext, ReactNode } from 'react';
import { useNotifications as useNotificationsHook } from '../hooks/useNotifications';
import type { Notification, NotificationSettings } from '../hooks/useNotifications';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  settings: NotificationSettings | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  isConnected: boolean;
  fetchNotifications: (options?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    category?: string;
    append?: boolean;
  }) => Promise<void>;
  loadMoreNotifications: () => void;
  fetchUnreadCount: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  updateSettings: (updates: Partial<NotificationSettings>) => Promise<void>;
  updateEventPreference: (event: string, updates: { enabled?: boolean; channels?: any }) => Promise<void>;
  sendTestNotification: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const notificationState = useNotificationsHook();

  return (
    <NotificationContext.Provider value={notificationState}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
