import { useState, useEffect } from 'react';
import { Settings2, Edit, Power, Eye } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import DataTableLayout from '@/components/common/DataTableLayout';
import ConfigEditModal from '@/components/platform/ConfigEditModal';
import { platformConfigServices } from '@/api/services';

interface PlatformConfig {
  _id: string;
  configKey: string;
  configValue: any;
  description?: string;
  category: 'auth' | 'payment' | 'email' | 'storage' | 'api' | 'system' | 'sms' | 'notification';
  isSecret: boolean;
  isActive: boolean;
  isEditable: boolean;
  lastModifiedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PlatformConfigStats {
  total: number;
  active: number;
  inactive: number;
  byCategory: Record<string, number>;
}

export default function SystemConfigTab() {
  const { toast } = useToast();
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
  const [viewingSecretId, setViewingSecretId] = useState<string | null>(null);
  const [secretValues, setSecretValues] = useState<Record<string, any>>({});
  
  const [editingConfig, setEditingConfig] = useState<PlatformConfig | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

      const response = await platformConfigServices.getConfigs(params);
      const data = response.data.data;
      setConfigs(data.configs);
      setTotalCount(data.pagination.total);
      setTotalPages(data.pagination.pages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch configurations',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await platformConfigServices.getStats();
      setStats(response.data.data);
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchSecretValue = async (configId: string) => {
    try {
      setViewingSecretId(configId);
      const response = await platformConfigServices.getConfig(configId);
      const data = response.data.data;
      setSecretValues(prev => ({ ...prev, [configId]: data.configValue }));
      toast({
        title: "Secret Revealed",
        description: "Secret value is now visible",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch secret value',
        variant: "destructive",
      });
    } finally {
      setViewingSecretId(null);
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchStats();
  }, [currentPage, rowsPerPage, searchValue, categoryFilter, statusFilter]);

  const handleEdit = (config: PlatformConfig) => {
    setEditingConfig(config);
    setIsEditModalOpen(true);
  };

  const handleSave = async (id: string, data: any) => {
    try {
      await platformConfigServices.updateConfig(id, data);
      toast({
        title: "Success",
        description: "Configuration updated successfully",
        variant: "success",
      });
      fetchConfigs();
      fetchStats();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to update configuration',
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleToggleStatus = async (config: PlatformConfig) => {
    try {
      await platformConfigServices.toggleConfigStatus(config._id);
      toast({
        title: "Success",
        description: `Configuration ${config.isActive ? 'disabled' : 'enabled'} successfully`,
        variant: "success",
      });
      fetchConfigs();
      fetchStats();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to toggle configuration status',
        variant: "destructive",
      });
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
      <TableHead className="w-16">S.No</TableHead>
      <TableHead className="w-[250px]">Config Key</TableHead>
      <TableHead className="w-[120px]">Category</TableHead>
      <TableHead className="w-[200px]">Value</TableHead>
      <TableHead>Description</TableHead>
      <TableHead className="w-[100px]">Status</TableHead>
      <TableHead className="w-[150px] text-right">Actions</TableHead>
    </>
  );

  const tableBody = configs.map((config, index) => {
    const displayValue = config.isSecret 
      ? (secretValues[config._id] !== undefined ? String(secretValues[config._id]) : '***HIDDEN***')
      : typeof config.configValue === 'object' 
        ? 'Object' 
        : String(config.configValue || '-');

    return (
      <tr key={config._id} className="border-b hover:bg-muted/50">
        <TableCell className="font-medium text-muted-foreground">
          {(currentPage - 1) * rowsPerPage + index + 1}
        </TableCell>
        <TableCell className="font-mono text-sm">{config.configKey}</TableCell>
        <TableCell>
          <Badge variant="outline" className={`capitalize ${getCategoryColor(config.category)}`}>
            {config.category}
          </Badge>
        </TableCell>
        <TableCell className="font-mono text-xs max-w-[200px]">
          <div className="flex items-center gap-2">
            <span className="truncate">{displayValue}</span>
            {config.isSecret && secretValues[config._id] === undefined && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchSecretValue(config._id)}
                disabled={viewingSecretId === config._id}
                className="h-6 w-6 p-0"
              >
                <Eye className="h-3 w-3" />
              </Button>
            )}
          </div>
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
    );
  });

  const emptyState = configs.length === 0 ? {
    icon: <Settings2 className="h-12 w-12" />,
    title: 'No configurations found',
    description: 'No platform configurations match your filters.',
  } : undefined;

  return (
    <div className="h-full flex flex-col">
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
