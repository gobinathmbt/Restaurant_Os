import { useNotifications } from '../../contexts/NotificationContext';
import { NotificationItem } from './NotificationItem';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Bell, CheckCheck, RefreshCw, Loader2 } from 'lucide-react';
import { useRef, useEffect } from 'react';

export const NotificationList = () => {
  const {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    markAllAsRead,
    deleteNotification,
    markAsRead,
    fetchNotifications,
    fetchUnreadCount,
    loadMoreNotifications
  } = useNotifications();

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  const handleRefresh = () => {
    fetchNotifications({ page: 1, limit: 20 });
    fetchUnreadCount();
  };

  // Infinite scroll using Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreNotifications();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loadingMore, loading, loadMoreNotifications]);

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
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        {loading && notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <>
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
            
            {/* Intersection Observer Target */}
            <div ref={observerTarget} className="h-4" />
            
            {/* Loading More Indicator */}
            {loadingMore && (
              <div className="p-4 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading more...</span>
              </div>
            )}
            
            {/* No More Notifications */}
            {!hasMore && notifications.length > 0 && (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No more notifications
              </div>
            )}
          </>
        )}
      </ScrollArea>
    </div>
  );
};
