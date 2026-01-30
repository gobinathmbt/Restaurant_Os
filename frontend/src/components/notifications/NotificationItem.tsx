import { formatDistanceToNow } from 'date-fns';
import { X, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import type { Notification } from '../../hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800'
};

const categoryIcons: Record<string, string> = {
  company_registration: '🏢',
  subscription: '💳',
  payment: '💰',
  order: '🛒',
  inventory: '📦',
  staff: '👥',
  financial: '💵',
  system: '⚙️',
  security: '🔒'
};

export const NotificationItem = ({
  notification,
  onMarkAsRead,
  onDelete
}: NotificationItemProps) => {
  const isUnread = !notification.channels.inApp.read;

  const handleClick = () => {
    if (isUnread) {
      onMarkAsRead(notification._id);
    }
    if (notification.actionUrl) {
      window.open(notification.actionUrl, '_blank');
    }
  };

  return (
    <div
      className={cn(
        'p-4 hover:bg-accent/50 transition-colors cursor-pointer relative group',
        isUnread && 'bg-accent/30'
      )}
      onClick={handleClick}
    >
      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification._id);
        }}
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Content */}
      <div className="flex gap-3">
        {/* Icon */}
        <div className="text-2xl flex-shrink-0">
          {categoryIcons[notification.category] || '📬'}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className={cn(
              'font-medium text-sm',
              isUnread && 'font-semibold'
            )}>
              {notification.title}
            </h4>
            <Badge
              variant="secondary"
              className={cn('text-xs', priorityColors[notification.priority])}
            >
              {notification.priority}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {notification.message}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
            </span>

            {notification.actionUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(notification.actionUrl, '_blank');
                }}
              >
                View <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>

          {/* Unread Indicator */}
          {isUnread && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </div>
      </div>
    </div>
  );
};
