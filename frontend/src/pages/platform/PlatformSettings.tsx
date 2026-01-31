import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, User, Shield, Database, Palette, Settings2, Edit, Power } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell, TableHead } from '@/components/ui/table';
import { toast } from 'sonner';
import NotificationSettings from '@/components/notifications/NotificationSettings';
import DataTableLayout from '@/components/common/DataTableLayout';
import ConfigEditModal from '@/components/platform/ConfigEditModal';
import {
  getAllConfigs,
  getConfigStats,
  updateConfig,
  toggleConfigStatus,
  PlatformConfig,
  PlatformConfigStats,
} from '@/api/platformConfig';

export default function PlatformSettings() {
  const [activeTab, setActiveTab] = useState('system');
  
  // Config management state
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [stats, setStats] = useState<PlatformConfigStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Edit modal state
  const [editingConfig, setEditingConfig] = useState<PlatformConfig | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Fetch configurations
  const fetchConfigs = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page: currentPage,
        limit: rowsPerPage,
      };
      
      if (searchValue) params.search = searchValue;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active';

      const data = await getAllConfigs(params);
      setConfigs(data.configs);
      setTotalCount(data.pagination.total);
      setTotalPages(data.pagination.pages);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch configurations');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const data = await getConfigStats();
      setStats(data);
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'system') {
      fetchConfigs();
      fetchStats();
    }
  }, [activeTab, currentPage, rowsPerPage, searchValue, categoryFilter, statusFilter]);

  const handleEdit = (config: PlatformConfig) => {
    setEditingConfig(config);
    setIsEditModalOpen(true);
  };

  const handleSave = async (id: string, data: any) => {
    try {
      await updateConfig(id, data);
      toast.success('Configuration updated successfully');
      fetchConfigs();
      fetchStats();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update configuration');
      throw error;
    }
  };

  const handleToggleStatus = async (config: PlatformConfig) => {
    try {
      await toggleConfigStatus(config._id);
      toast.success(`Configuration ${config.isActive ? 'disabled' : 'enabled'} successfully`);
      fetchConfigs();
      fetchStats();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to toggle configuration status');
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      auth: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      payment: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      email: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      storage: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      sms: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      notification: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      api: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
      system: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    };
    return colors[category] || colors.system;
  };

  const tableHeaders = (
    <>
      <TableHead className="w-[250px]">Config Key</TableHead>
      <TableHead className="w-[120px]">Category</TableHead>
      <TableHead className="w-[200px]">Value</TableHead>
      <TableHead>Description</TableHead>
      <TableHead className="w-[100px]">Status</TableHead>
      <TableHead className="w-[150px] text-right">Actions</TableHead>
    </>
  );

  const tableBody = configs.map((config) => (
    <tr key={config._id} className="border-b hover:bg-muted/50">
      <TableCell className="font-mono text-sm">{config.configKey}</TableCell>
      <TableCell>
        <Badge variant="outline" className={`capitalize ${getCategoryColor(config.category)}`}>
          {config.category}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-xs max-w-[200px] truncate">
        {config.isSecret ? (
          <span className="text-muted-foreground">***HIDDEN***</span>
        ) : typeof config.configValue === 'object' ? (
          <span className="text-muted-foreground">Object</span>
        ) : (
          String(config.configValue || '-')
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
        {config.description || '-'}
      </TableCell>
      <TableCell>
        <Badge variant={config.isActive ? 'default' : 'secondary'}>
          {config.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(config)}
            disabled={!config.isEditable}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleStatus(config)}
          >
            <Power className={`h-4 w-4 ${config.isActive ? 'text-green-600' : 'text-gray-400'}`} />
          </Button>
        </div>
      </TableCell>
    </tr>
  ));

  const emptyState = configs.length === 0 ? {
    icon: <Settings2 className="h-12 w-12" />,
    title: 'No configurations found',
    description: 'No platform configurations match your filters.',
  } : undefined;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto">
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">System Config</span>
          </TabsTrigger>
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

        <TabsContent value="system" className="space-y-4">
          <DataTableLayout
            statChips={stats ? [
              { label: 'Total', value: stats.total, variant: 'outline' },
              { label: 'Active', value: stats.active, variant: 'default' },
              { label: 'Inactive', value: stats.inactive, variant: 'secondary' },
            ] : []}
            searchValue={searchValue}
            searchPlaceholder="Search configurations..."
            onSearchChange={setSearchValue}
            filterConfig={{
              component: (
                <div className="flex items-center gap-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-9 w-[140px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="auth">Auth</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="storage">Storage</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="notification">Notification</SelectItem>
                      <SelectItem value="api">API</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-[120px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ),
            }}
            tableHeaders={tableHeaders}
            tableBody={tableBody}
            isLoading={isLoading}
            emptyState={emptyState}
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={setRowsPerPage}
            onRefresh={fetchConfigs}
            cookiePrefix="platform_config"
          />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationSettings userType="platform" />
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Manage your personal information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Profile settings coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your password, two-factor authentication, and security preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Security settings coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize the look and feel of your platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Appearance settings coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <ConfigEditModal
        config={editingConfig}
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingConfig(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}
