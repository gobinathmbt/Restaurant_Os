import { useState, useEffect } from 'react';
import { Bell, Mail, MessageSquare, Smartphone, TestTube } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { notificationServices } from '@/api/services';
import { toast } from '@/hooks/use-toast';

interface NotificationSettings {
  _id?: string;
  userId?: string;
  isPrimaryAdmin?: boolean;
  preferences: Record<string, any>;
  quietHours: {
    enabled: boolean;
    start?: string;
    end?: string;
    timezone?: string;
  };
}

const eventLabels: Record<string, { label: string; description: string }> = {
  newOrder: {
    label: 'New Order',
    description: 'When a new order is received'
  },
  orderCompleted: {
    label: 'Order Completed',
    description: 'When an order is marked as completed'
  },
  orderCancelled: {
    label: 'Order Cancelled',
    description: 'When an order is cancelled'
  },
  lowStock: {
    label: 'Low Stock Alert',
    description: 'When inventory items are running low'
  },
  stockOut: {
    label: 'Stock Out Alert',
    description: 'When inventory items are out of stock'
  },
  staffCheckIn: {
    label: 'Staff Check In',
    description: 'When staff members check in'
  },
  staffCheckOut: {
    label: 'Staff Check Out',
    description: 'When staff members check out'
  },
  leaveRequest: {
    label: 'Leave Request',
    description: 'When staff submits a leave request'
  },
  dailySalesReport: {
    label: 'Daily Sales Report',
    description: 'Daily summary of sales and revenue'
  },
  paymentReceived: {
    label: 'Payment Received',
    description: 'When a payment is received'
  },
  systemAlert: {
    label: 'System Alerts',
    description: 'Important system notifications'
  }
};

export default function CompanyNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await notificationServices.getSettings();
      if (response.data.success) {
        setSettings(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notification settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEvent = async (event: string, enabled: boolean) => {
    try {
      await notificationServices.updateEventPreference(event, { enabled });
      
      setSettings(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          preferences: {
            ...prev.preferences,
            [event]: {
              ...prev.preferences[event],
              enabled
            }
          }
        };
      });

      toast({
        title: 'Success',
        description: 'Event preference updated'
      });
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        title: 'Error',
        description: 'Failed to update event preference',
        variant: 'destructive'
      });
    }
  };

  const handleToggleChannel = async (event: string, channel: string, enabled: boolean) => {
    try {
      const currentChannels = settings?.preferences[event]?.channels || {};
      await notificationServices.updateEventPreference(event, {
        channels: {
          ...currentChannels,
          [channel]: { ...currentChannels[channel], enabled }
        }
      });

      setSettings(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          preferences: {
            ...prev.preferences,
            [event]: {
              ...prev.preferences[event],
              channels: {
                ...prev.preferences[event]?.channels,
                [channel]: {
                  ...prev.preferences[event]?.channels?.[channel],
                  enabled
                }
              }
            }
          }
        };
      });

      toast({
        title: 'Success',
        description: 'Channel preference updated'
      });
    } catch (error) {
      console.error('Error updating channel:', error);
      toast({
        title: 'Error',
        description: 'Failed to update channel preference',
        variant: 'destructive'
      });
    }
  };

  const handleTestNotification = async () => {
    try {
      await notificationServices.sendTestNotification();
      toast({
        title: 'Success',
        description: 'Test notification sent! Check your notification bell.'
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to send test notification',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">No settings found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notification Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage how you receive notifications about restaurant operations
        </p>
      </div>

      {/* Test Notification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Test Notifications
          </CardTitle>
          <CardDescription>
            Send a test notification to verify your settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleTestNotification}>
            <Bell className="h-4 w-4 mr-2" />
            Send Test Notification
          </Button>
        </CardContent>
      </Card>

      {/* Event Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Event Preferences</CardTitle>
          <CardDescription>
            Choose which events you want to be notified about and through which channels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(eventLabels).map(([event, { label, description }]) => {
            const eventConfig = settings.preferences[event] || {};
            const isEnabled = eventConfig.enabled !== false;

            return (
              <div key={event} className="space-y-4 p-4 border rounded-lg">
                {/* Event Toggle */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`event-${event}`} className="font-medium text-base">
                        {label}
                      </Label>
                      {!isEnabled && (
                        <Badge variant="secondary" className="text-xs">Disabled</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                  <Switch
                    id={`event-${event}`}
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggleEvent(event, checked)}
                  />
                </div>

                {/* Channel Toggles */}
                {isEnabled && (
                  <div className="pl-4 space-y-3 border-l-2 border-primary/20">
                    <p className="text-sm font-medium text-muted-foreground">Notification Channels</p>
                    
                    {/* In-App */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor={`${event}-inapp`} className="text-sm cursor-pointer">
                          In-App Notifications
                        </Label>
                      </div>
                      <Switch
                        id={`${event}-inapp`}
                        checked={eventConfig.channels?.inApp?.enabled !== false}
                        onCheckedChange={(checked) =>
                          handleToggleChannel(event, 'inApp', checked)
                        }
                      />
                    </div>

                    {/* Email */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor={`${event}-email`} className="text-sm cursor-pointer">
                          Email
                          {eventConfig.channels?.email?.verified && (
                            <Badge variant="outline" className="ml-2 text-xs">Verified</Badge>
                          )}
                        </Label>
                      </div>
                      <Switch
                        id={`${event}-email`}
                        checked={eventConfig.channels?.email?.enabled === true}
                        onCheckedChange={(checked) =>
                          handleToggleChannel(event, 'email', checked)
                        }
                      />
                    </div>

                    {/* WhatsApp */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor={`${event}-whatsapp`} className="text-sm cursor-pointer">
                          WhatsApp
                          {eventConfig.channels?.whatsapp?.verified && (
                            <Badge variant="outline" className="ml-2 text-xs">Verified</Badge>
                          )}
                        </Label>
                      </div>
                      <Switch
                        id={`${event}-whatsapp`}
                        checked={eventConfig.channels?.whatsapp?.enabled === true}
                        onCheckedChange={(checked) =>
                          handleToggleChannel(event, 'whatsapp', checked)
                        }
                      />
                    </div>

                    {/* SMS */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor={`${event}-sms`} className="text-sm cursor-pointer">
                          SMS
                          {eventConfig.channels?.sms?.verified && (
                            <Badge variant="outline" className="ml-2 text-xs">Verified</Badge>
                          )}
                        </Label>
                      </div>
                      <Switch
                        id={`${event}-sms`}
                        checked={eventConfig.channels?.sms?.enabled === true}
                        onCheckedChange={(checked) =>
                          handleToggleChannel(event, 'sms', checked)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
