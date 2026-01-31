import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, User, Shield, Database, Palette } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import NotificationSettings from '@/components/notifications/NotificationSettings';
import SystemConfigTab from '@/components/platform/SystemConfigTab';
import ProfileTab from '@/components/platform/ProfileTab';
import SecurityTab from '@/components/platform/SecurityTab';
import AppearanceTab from '@/components/platform/AppearanceTab';

export default function PlatformSettings() {
  const { user } = useAuth();
  const isPlatformSuperAdmin = user?.role === 'platform_super_admin' && user?.platformAdminPrimary === true;
  const [activeTab, setActiveTab] = useState(isPlatformSuperAdmin ? 'system' : 'notifications');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
      <TabsList className={`mx-6 mt-6 grid w-full ${isPlatformSuperAdmin ? 'grid-cols-5' : 'grid-cols-4'} lg:w-auto`}>
        {isPlatformSuperAdmin && (
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">System Config</span>
          </TabsTrigger>
        )}
        <TabsTrigger value="notifications" className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">Notifications</span>
        </TabsTrigger>
        <TabsTrigger value="profile" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">Profile</span>
        </TabsTrigger>
        <TabsTrigger value="security" className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span className="hidden sm:inline">Security</span>
        </TabsTrigger>
        <TabsTrigger value="appearance" className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          <span className="hidden sm:inline">Appearance</span>
        </TabsTrigger>
      </TabsList>

      {isPlatformSuperAdmin && (
        <TabsContent value="system" className="m-0 flex-1">
          <SystemConfigTab />
        </TabsContent>
      )}

      <TabsContent value="notifications" className="m-6">
        <NotificationSettings userType="platform" />
      </TabsContent>

      <TabsContent value="profile" className="m-6">
        <ProfileTab />
      </TabsContent>

      <TabsContent value="security" className="m-6">
        <SecurityTab />
      </TabsContent>

      <TabsContent value="appearance" className="m-6">
        <AppearanceTab />
      </TabsContent>
    </Tabs>
  );
}
