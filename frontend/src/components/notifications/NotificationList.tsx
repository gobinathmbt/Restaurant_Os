import { useNotifications } from '../../hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';

export const NotificationList = () => {
  const {
    notifications,
    unreadCount,
    loading,
    markAllAsRead,
    deleteNotification,
    markAsRead,
    fetchNotifications,
    fetchUnreadCount
  } = useNotifications();

  const handleRefresh = () => {
    fetchNotifications();
    fetchUnreadCount();
  };

  return (
    <div className="flex flex-col h-[500px]">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg">Notifications</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh notifications"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={markAllAsRead}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification._id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
