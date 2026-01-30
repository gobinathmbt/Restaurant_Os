import { useState, useEffect } from 'react';
import { Mail, MessageSquare, Smartphone, Bell, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useToast } from '../../hooks/use-toast';
import { notificationServices } from '../../api/services';

interface NotificationSettingsProps {
  userType: 'platform' | 'company';
}

interface NotificationSettings {
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

export default function NotificationSettings({ userType }: NotificationSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  // Event labels based on user type
  const platformEventLabels: Record<string, string> = {
    companyRegistration: 'Company Registration',
    subscriptionExpiring: 'Subscription Expiring',
    subscriptionExpired: 'Subscription Expired',
    subscriptionRenewed: 'Subscription Renewed',
    paymentReceived: 'Payment Received',
    paymentFailed: 'Payment Failed',
    systemAlert: 'System Alert',
    securityAlert: 'Security Alert'
  };

  const companyEventLabels: Record<string, string> = {
    newOrder: 'New Order',
    orderCompleted: 'Order Completed',
    orderCancelled: 'Order Cancelled',
    lowStock: 'Low Stock Alert',
    stockOut: 'Stock Out Alert',
    staffCheckIn: 'Staff Check In',
    staffCheckOut: 'Staff Check Out',
    leaveRequest: 'Leave Request',
    dailySalesReport: 'Daily Sales Report',
    systemAlert: 'System Alert',
    securityAlert: 'Security Alert'
  };

  const eventLabels = userType === 'platform' ? platformEventLabels : companyEventLabels;

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await notificationServices.getSettings();
      
      if (response.data.success && response.data.data) {
        setSettings(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notification settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEvent = async (event: string, enabled: boolean) => {
    try {
      const response = await notificationServices.updateEventPreference(event, { enabled });
      
      if (response.data.success) {
        setSettings(response.data.data);
        toast({
          title: 'Success',
          description: 'Event preference updated successfully',
        });
      }
    } catch (error) {
      console.error('Failed to update event preference:', error);
      toast({
        title: 'Error',
        description: 'Failed to update event preference',
        variant: 'destructive',
      });
    }
  };

  const handleToggleChannel = async (event: string, channel: string, enabled: boolean) => {
    try {
      const currentChannels = settings?.preferences[event]?.channels || {};
      const response = await notificationServices.updateEventPreference(event, {
        channels: {
          ...currentChannels,
          [channel]: { ...currentChannels[channel], enabled }
        }
      });
      
      if (response.data.success) {
        setSettings(response.data.data);
        toast({
          title: 'Success',
          description: 'Channel preference updated successfully',
        });
      }
    } catch (error) {
      console.error('Failed to update channel preference:', error);
      toast({
        title: 'Error',
        description: 'Failed to update channel preference',
        variant: 'destructive',
      });
    }
  };

  const handleTestNotification = async () => {
    try {
      const response = await notificationServices.sendTestNotification();
      
      if (response.data.success) {
        toast({
          title: 'Success',
          description: 'Test notification sent successfully',
        });
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to send test notification',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            {userType === 'platform' 
              ? 'Configure how you receive platform notifications'
              : 'Configure how you receive restaurant notifications'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Test Notification */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleTestNotification}
            >
              <Bell className="h-4 w-4 mr-2" />
              Send Test Notification
            </Button>

            <div className="border-t pt-4">
              <h4 className="font-medium text-sm text-muted-foreground mb-4">
                Event Preferences
              </h4>
              
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
                  {Object.entries(settings.preferences || {})
                    .filter(([event]) => eventLabels[event]) // Only show relevant events
                    .map(([event, config]: [string, any]) => (
                      <div key={event} className="space-y-3 p-4 border rounded-lg bg-card">
                        {/* Event Toggle */}
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`event-${event}`} className="font-medium">
                            {eventLabels[event] || event}
                          </Label>
                          <Switch
                            id={`event-${event}`}
                            checked={config?.enabled !== false}
                            onCheckedChange={(checked) => handleToggleEvent(event, checked)}
                          />
                        </div>

                        {/* Channel Toggles */}
                        {config?.enabled !== false && (
                          <div className="pl-4 space-y-3 border-l-2 border-primary-500/20">
                            {/* In-App */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Bell className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor={`${event}-inapp`} className="text-sm">
                                  In-App
                                </Label>
                              </div>
                              <Switch
                                id={`${event}-inapp`}
                                checked={config?.channels?.inApp?.enabled !== false}
                                onCheckedChange={(checked) =>
                                  handleToggleChannel(event, 'inApp', checked)
                                }
                              />
                            </div>

                            {/* Email */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor={`${event}-email`} className="text-sm">
                                  Email
                                  {config?.channels?.email?.verified && (
                                    <span className="ml-1 text-xs text-green-600">✓</span>
                                  )}
                                </Label>
                              </div>
                              <Switch
                                id={`${event}-email`}
                                checked={config?.channels?.email?.enabled === true}
                                onCheckedChange={(checked) =>
                                  handleToggleChannel(event, 'email', checked)
                                }
                              />
                            </div>

                            {/* WhatsApp */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor={`${event}-whatsapp`} className="text-sm">
                                  WhatsApp
                                  {config?.channels?.whatsapp?.verified && (
                                    <span className="ml-1 text-xs text-green-600">✓</span>
                                  )}
                                </Label>
                              </div>
                              <Switch
                                id={`${event}-whatsapp`}
                                checked={config?.channels?.whatsapp?.enabled === true}
                                onCheckedChange={(checked) =>
                                  handleToggleChannel(event, 'whatsapp', checked)
                                }
                              />
                            </div>

                            {/* SMS */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Smartphone className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor={`${event}-sms`} className="text-sm">
                                  SMS
                                  {config?.channels?.sms?.verified && (
                                    <span className="ml-1 text-xs text-green-600">✓</span>
                                  )}
                                </Label>
                              </div>
                              <Switch
                                id={`${event}-sms`}
                                checked={config?.channels?.sms?.enabled === true}
                                onCheckedChange={(checked) =>
                                  handleToggleChannel(event, 'sms', checked)
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
