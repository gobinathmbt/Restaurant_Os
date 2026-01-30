import { Mail, MessageSquare, Smartphone, Bell, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { useNotifications } from '../../hooks/useNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface NotificationSettingsProps {
  userType: 'platform' | 'company';
}

export default function NotificationSettings({ userType }: NotificationSettingsProps) {
  const { settings, updateEventPreference, sendTestNotification, loading } = useNotifications();

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

  const handleToggleEvent = async (event: string, enabled: boolean) => {
    await updateEventPreference(event, { enabled });
  };

  const handleToggleChannel = async (event: string, channel: string, enabled: boolean) => {
    const currentChannels = settings?.preferences[event]?.channels || {};
    await updateEventPreference(event, {
      channels: {
        ...currentChannels,
        [channel]: { ...currentChannels[channel], enabled }
      }
    });
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
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
              onClick={sendTestNotification}
            >
              <Bell className="h-4 w-4 mr-2" />
              Send Test Notification
            </Button>

            <Separator />

            {/* Event Preferences */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">
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
