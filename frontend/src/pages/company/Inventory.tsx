import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { branchServices } from '@/api/services';
import { useAuth } from '@/contexts/AuthContext';
import InventoryItemsTab from '@/components/inventory/InventoryItemsTab';
import CategoriesTab from '@/components/inventory/CategoriesTab';
import GRNTab from '@/components/inventory/GRNTab';
import StockAdjustmentsTab from '@/components/inventory/StockAdjustmentsTab';
import StockTransfersTab from '@/components/inventory/StockTransfersTab';
import LocationsTab from '@/components/inventory/LocationsTab';
import { STORAGE_KEYS } from '@/utils/storage';
import { useTabStorage } from '@/hooks/useStorage';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

export default function Inventory() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  // Determine user's branch access
  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');
  const isWarehouseAdmin = user?.role === 'warehouse_admin';
  const isMultiBranchAdmin = (user?.role === 'company_admin' && (user?.branchIds?.length || 0) > 1) || 
                             (isWarehouseAdmin && (user?.warehouseIds?.length || 0) > 1);
  const isSingleBranchAdmin = (user?.role === 'company_admin' && (user?.branchIds?.length || 0) === 1) ||
                              (isWarehouseAdmin && (user?.warehouseIds?.length || 0) === 1);

  // Determine default tab based on role (warehouse admins only need transfers)
  const defaultTab = isWarehouseAdmin ? 'transfers' : 'items';
  // Use storage hook to persist active tab per browser tab (sessionStorage)
  const [activeTab, setActiveTab] = useTabStorage(STORAGE_KEYS.INVENTORY_ACTIVE_TAB, defaultTab);

  // Fetch branches on mount
  useEffect(() => {
    fetchBranches();
  }, []);

  // ensure active tab switches to transfers when role changes
  useEffect(() => {
    if (isWarehouseAdmin && activeTab !== 'transfers') {
      setActiveTab('transfers');
    }
  }, [isWarehouseAdmin, activeTab, setActiveTab]);

  // Auto-select branch for single-branch admins and multi-branch admins
  useEffect(() => {
    if (isSingleBranchAdmin && user?.branchIds && user.branchIds.length === 1) {
      setSelectedBranch(user.branchIds[0]);
    } else if (isSingleBranchAdmin && isWarehouseAdmin && user?.warehouseIds && user.warehouseIds.length === 1) {
      setSelectedBranch(user.warehouseIds[0]);
    } else if (isMultiBranchAdmin && !selectedBranch) {
      // For multi-branch admins (company_admin or warehouse_admin), default to "all"
      setSelectedBranch('all');
    } else if (isSuperAdmin && !selectedBranch && branches.length > 0) {
      // For super admins, default to "all" branches
      setSelectedBranch('all');
    }
  }, [isSingleBranchAdmin, isMultiBranchAdmin, isSuperAdmin, isWarehouseAdmin, user?.branchIds, user?.warehouseIds, selectedBranch, branches]);

  const fetchBranches = async () => {
    try {
      const response = await branchServices.getBranches({ limit: 100, isActive: true });
      const allBranches = response.data.data.branches || [];
      
      // Filter branches based on user role
      let availableBranches = allBranches;
      if (user?.role === 'company_admin') {
        availableBranches = allBranches.filter((branch: Branch) => 
          user?.branchIds?.includes(branch._id)
        );
      } else if (isWarehouseAdmin) {
        availableBranches = allBranches.filter((branch: Branch) => 
          user?.warehouseIds?.includes(branch._id)
        );
      }
      
      setBranches(availableBranches);
      
      // Auto-select for super admins if none selected
      if (isSuperAdmin && !selectedBranch && availableBranches.length > 0) {
        setSelectedBranch('all');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch branches",
        variant: "destructive",
      });
    }
  };

  // compute layout classes early (non-hooks)
  const tabListClass = isWarehouseAdmin
    ? 'mx-6 mt-6 mb-0 flex w-full'
    : 'mx-6 mt-6 mb-0 grid w-full grid-cols-6 lg:w-auto flex-shrink-0';

  const tabTriggerClass = isWarehouseAdmin ? 'flex-1 text-center' : '';

  if (!selectedBranch && !isSingleBranchAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-8">
        <Package className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Select a Branch</h3>
        <p className="text-muted-foreground text-center mb-4">
          Please select a branch to view inventory
        </p>
        {(isSuperAdmin || isMultiBranchAdmin) && branches.length > 0 && (
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              {isSuperAdmin && (
                <SelectItem value="all">All Branches</SelectItem>
              )}
              {branches.map((branch) => (
                <SelectItem key={branch._id} value={branch._id}>
                  {branch.name} ({branch.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  }

  // hide all tabs except transfers when user is warehouse_admin
  const isTabVisible = (tab: string) => {
    if (isWarehouseAdmin) {
      return tab === 'transfers';
    }
    return true;
  };


  return (
    <div className="h-[calc(100vh-4rem)] -m-6 flex flex-col overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className={tabListClass}>
          {isTabVisible('items') && <TabsTrigger className={tabTriggerClass} value="items">Items</TabsTrigger>}
          {isTabVisible('categories') && <TabsTrigger className={tabTriggerClass} value="categories">Categories</TabsTrigger>}
          {isTabVisible('locations') && <TabsTrigger className={tabTriggerClass} value="locations">Locations</TabsTrigger>}
          {isTabVisible('grn') && <TabsTrigger className={tabTriggerClass} value="grn">GRN</TabsTrigger>}
          {isTabVisible('adjustments') && <TabsTrigger className={tabTriggerClass} value="adjustments">Adjustments</TabsTrigger>}
          {isTabVisible('transfers') && <TabsTrigger className={tabTriggerClass} value="transfers">Request for Stock</TabsTrigger>}
        </TabsList>

        {isTabVisible('items') && (
          <TabsContent value="items" className="m-0 flex-1 min-h-0 overflow-hidden">
            <InventoryItemsTab
              selectedBranch={selectedBranch}
              branches={branches}
              onBranchChange={setSelectedBranch}
              isSuperAdmin={isSuperAdmin}
              isMultiBranchAdmin={isMultiBranchAdmin}
            />
          </TabsContent>
        )}

        {isTabVisible('categories') && (
          <TabsContent value="categories" className="m-0 flex-1 min-h-0 overflow-hidden">
            <CategoriesTab
              selectedBranch={selectedBranch}
              branches={branches}
              onBranchChange={setSelectedBranch}
              isSuperAdmin={isSuperAdmin}
              isMultiBranchAdmin={isMultiBranchAdmin}
            />
          </TabsContent>
        )}

        {isTabVisible('locations') && (
          <TabsContent value="locations" className="m-0 flex-1 min-h-0 overflow-hidden">
            <LocationsTab />
          </TabsContent>
        )}

        {isTabVisible('grn') && (
          <TabsContent value="grn" className="m-0 flex-1 min-h-0 overflow-hidden">
            <GRNTab
              selectedBranch={selectedBranch}
              branches={branches}
              onBranchChange={setSelectedBranch}
              isSuperAdmin={isSuperAdmin}
              isMultiBranchAdmin={isMultiBranchAdmin}
            />
          </TabsContent>
        )}

        {isTabVisible('adjustments') && (
          <TabsContent value="adjustments" className="m-0 flex-1 min-h-0 overflow-hidden">
            <StockAdjustmentsTab
              selectedBranch={selectedBranch}
              branches={branches}
              onBranchChange={setSelectedBranch}
              isSuperAdmin={isSuperAdmin}
              isMultiBranchAdmin={isMultiBranchAdmin}
            />
          </TabsContent>
        )}

        {isTabVisible('transfers') && (
          <TabsContent value="transfers" className="m-0 flex-1 min-h-0 overflow-hidden">
            <StockTransfersTab
              selectedBranch={selectedBranch}
              branches={branches}
              onBranchChange={setSelectedBranch}
              isSuperAdmin={isSuperAdmin}
              isMultiBranchAdmin={isMultiBranchAdmin}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
