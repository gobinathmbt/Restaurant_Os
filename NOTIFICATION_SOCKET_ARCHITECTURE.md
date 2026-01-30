# Notification System - Socket-Based Architecture

## Overview

The notification system now uses **Socket.IO for all notification operations** with only settings management handled via REST API. This provides real-time, bidirectional communication with proper authentication and validation.

## Architecture

### Socket Events (Real-time)
All notification CRUD operations are handled through Socket.IO events:
- ✅ Get notifications
- ✅ Get unread count
- ✅ Mark as read
- ✅ Mark all as read
- ✅ Delete notification
- ✅ Real-time notification delivery

### REST API (Settings Only)
Only notification settings are managed via REST API:
- ✅ GET `/api/notifications/settings` - Get user settings
- ✅ PUT `/api/notifications/settings` - Update settings
- ✅ PATCH `/api/notifications/settings/events/:event` - Update event preference
- ✅ POST `/api/notifications/test` - Send test notification

## Socket Events

### Client → Server Events

#### 1. Get Notifications
```javascript
socket.emit('notifications:get', {
  page: 1,
  limit: 20,
  unreadOnly: false,
  category: 'order' // optional
}, (response) => {
  // response: { success: true, data: { notifications, pagination } }
});
```

#### 2. Get Unread Count
```javascript
socket.emit('notifications:getUnreadCount', {}, (response) => {
  // response: { success: true, data: { count: 5 } }
});
```

#### 3. Mark as Read
```javascript
socket.emit('notifications:markAsRead', {
  notificationId: '507f1f77bcf86cd799439011'
}, (response) => {
  // response: { success: true, data: notification }
});
```

#### 4. Mark All as Read
```javascript
socket.emit('notifications:markAllAsRead', {}, (response) => {
  // response: { success: true, data: { modifiedCount: 10 } }
});
```

#### 5. Delete Notification
```javascript
socket.emit('notifications:delete', {
  notificationId: '507f1f77bcf86cd799439011'
}, (response) => {
  // response: { success: true, message: 'Notification deleted' }
});
```

### Server → Client Events

#### 1. New Notification
```javascript
socket.on('notification', (data) => {
  // data: { id, category, event, title, message, priority, ... }
});
```

## Authentication & Validation

### Socket Authentication

Each socket connection is authenticated using JWT:

```javascript
// Platform Admin
const socket = io('http://localhost:5000/platform-admin', {
  auth: { token: jwtToken }
});

// Company User
const socket = io('http://localhost:5000/company', {
  auth: { token: jwtToken }
});
```

### Server-Side Validation

```javascript
// Platform Admin Authentication
async authenticatePlatformAdmin(socket, next) {
  const token = socket.handshake.auth.token;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  if (decoded.role !== 'platform_admin') {
    return next(new Error('Unauthorized'));
  }
  
  socket.user = { id: decoded.userId, role: decoded.role };
  next();
}

// Company User Authentication
async authenticateCompany(socket, next) {
  const token = socket.handshake.auth.token;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  if (!decoded.companyId) {
    return next(new Error('Unauthorized'));
  }
  
  socket.user = {
    id: decoded.userId,
    companyId: decoded.companyId,
    role: decoded.role
  };
  next();
}
```

### Per-Event Validation

Each socket event handler validates:
1. **User authentication** - Already validated at connection
2. **Data ownership** - User can only access their own notifications
3. **Database context** - Correct database (platform/company) is used
4. **Input validation** - Event data is validated

## Backend Implementation

### Socket Manager (`backend/src/config/socket.js`)

```javascript
class SocketManager {
  setupPlatformAdminHandlers(socket) {
    const userId = socket.user.id;

    socket.on('notifications:get', async (data, callback) => {
      // Validate user owns the data
      const result = await notificationService.getNotifications(userId, {
        ...data,
        isPlatformAdmin: true
      });
      callback({ success: true, data: result });
    });

    // ... other handlers
  }

  setupCompanyHandlers(socket) {
    const { userId, companyId } = socket.user;

    socket.on('notifications:get', async (data, callback) => {
      // Validate user belongs to company
      const result = await notificationService.getNotifications(userId, {
        ...data,
        companyId,
        isPlatformAdmin: false
      });
      callback({ success: true, data: result });
    });

    // ... other handlers
  }
}
```

## Frontend Implementation

### Socket Service (`frontend/src/services/socket.ts`)

```typescript
class SocketService {
  // Get notifications
  getNotifications(options, callback) {
    const socket = this.platformAdminSocket || this.companySocket;
    if (socket && socket.connected) {
      socket.emit('notifications:get', options, callback);
    } else {
      callback({ success: false, error: 'Socket not connected' });
    }
  }

  // Mark as read
  markNotificationAsRead(notificationId, callback) {
    const socket = this.platformAdminSocket || this.companySocket;
    socket.emit('notifications:markAsRead', { notificationId }, callback);
  }

  // ... other methods
}
```

### useNotifications Hook

```typescript
export const useNotifications = () => {
  const socket = useSocket();

  const fetchNotifications = useCallback((options) => {
    if (!socket.isConnected) return;

    socketService.getNotifications(options, (response) => {
      if (response.success) {
        setNotifications(response.data.notifications);
      }
    });
  }, [socket.isConnected]);

  const markAsRead = useCallback((notificationId) => {
    socketService.markNotificationAsRead(notificationId, (response) => {
      if (response.success) {
        // Update local state
      }
    });
  }, []);

  // ... other methods
};
```

## Benefits

### 1. Real-Time Communication
- Instant notification delivery
- Bidirectional communication
- No polling required

### 2. Better Performance
- Reduced HTTP overhead
- Persistent connections
- Efficient data transfer

### 3. Enhanced Security
- JWT authentication per connection
- Per-event validation
- User context maintained throughout session

### 4. Scalability
- Connection pooling
- Room-based broadcasting
- Efficient message routing

### 5. Better UX
- Instant updates
- No page refresh needed
- Real-time unread counts

## Security Considerations

### 1. Authentication
- ✅ JWT validation on connection
- ✅ Token expiry handled
- ✅ Automatic reconnection with new token

### 2. Authorization
- ✅ User can only access own notifications
- ✅ Company users isolated per company database
- ✅ Platform admins isolated from company data

### 3. Data Validation
- ✅ Input validation on all events
- ✅ MongoDB injection prevention
- ✅ XSS protection in notification content

### 4. Rate Limiting
- ⚠️ Consider implementing rate limiting per socket
- ⚠️ Limit events per second per user

## Error Handling

### Connection Errors
```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  // Retry with exponential backoff
});
```

### Event Errors
```javascript
socket.emit('notifications:get', {}, (response) => {
  if (!response.success) {
    console.error('Error:', response.error);
    // Handle error appropriately
  }
});
```

### Disconnection Handling
```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // Auto-reconnect handled by socket.io
});
```

## Testing

### Test Socket Connection
```javascript
// Connect
const socket = io('http://localhost:5000/platform-admin', {
  auth: { token: 'your-jwt-token' }
});

// Test get notifications
socket.emit('notifications:get', { page: 1, limit: 10 }, (response) => {
  console.log('Notifications:', response);
});

// Test mark as read
socket.emit('notifications:markAsRead', {
  notificationId: '507f1f77bcf86cd799439011'
}, (response) => {
  console.log('Marked as read:', response);
});
```

### Test Real-Time Delivery
```javascript
// Listen for new notifications
socket.on('notification', (notification) => {
  console.log('New notification:', notification);
});

// Trigger a test notification via API
fetch('http://localhost:5000/api/notifications/test', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Migration from REST API

If migrating from REST API to Socket.IO:

1. **Update frontend hooks** - Use socket events instead of API calls
2. **Keep settings API** - Settings remain as REST endpoints
3. **Test thoroughly** - Ensure all operations work via sockets
4. **Monitor performance** - Check socket connection stability
5. **Gradual rollout** - Can support both temporarily

## Best Practices

1. **Always check connection status** before emitting events
2. **Handle callbacks** for all socket events
3. **Implement reconnection logic** with exponential backoff
4. **Use acknowledgments** for critical operations
5. **Monitor socket health** and connection count
6. **Implement heartbeat** to detect stale connections
7. **Clean up listeners** on component unmount
8. **Use rooms efficiently** for targeted broadcasting

## Troubleshooting

### Socket not connecting
1. Check CORS configuration
2. Verify JWT token is valid
3. Check network connectivity
4. Verify server is running

### Events not working
1. Check socket connection status
2. Verify event names match exactly
3. Check callback function is provided
4. Review server logs for errors

### Notifications not appearing
1. Verify socket is connected
2. Check notification listener is registered
3. Verify user has correct permissions
4. Check database for notification records

## Summary

The socket-based architecture provides:
- ✅ Real-time bidirectional communication
- ✅ Better performance than REST API
- ✅ Enhanced security with per-connection auth
- ✅ Scalable room-based broadcasting
- ✅ Efficient data transfer
- ✅ Better user experience

All notification operations except settings are now handled through Socket.IO, providing a modern, real-time notification system with proper authentication and validation at every step.
