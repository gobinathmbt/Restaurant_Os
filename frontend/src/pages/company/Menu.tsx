import { useState, useEffect } from 'react';
import { UtensilsCrossed } from 'lucide-react';
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
import { STORAGE_KEYS } from '@/utils/storage';
import { useTabStorage } from '@/hooks/useStorage';
import MenuItemsTab from '@/components/menu/MenuItemsTab';
import MenuCategoriesTab from '@/components/menu/MenuCategoriesTab';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

export default function Menu() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  
  // Use storage hook to persist active tab per browser tab (sessionStorage)
  const [activeTab, setActiveTab] = useTabStorage(STORAGE_KEYS.MENU_ACTIVE_TAB, 'items');

  // Determine user's branch access
  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');
  const isMultiBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) > 1;
  const isSingleBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) === 1;

  // Fetch branches on mount
  useEffect(() => {
    fetchBranches();
  }, []);

  // Auto-select branch for single-branch admins and multi-branch admins
  useEffect(() => {
    if (isSingleBranchAdmin && user?.branchIds && user.branchIds.length === 1) {
      setSelectedBranch(user.branchIds[0]);
    } else if (isMultiBranchAdmin && user?.branchIds && user.branchIds.length > 1 && !selectedBranch) {
      // For multi-branch company admins, default to "all" branches
      setSelectedBranch('all');
    } else if (isSuperAdmin && !selectedBranch && branches.length > 0) {
      // For super admins, default to "all" branches
      setSelectedBranch('all');
    }
  }, [isSingleBranchAdmin, isMultiBranchAdmin, isSuperAdmin, user?.branchIds, selectedBranch, branches]);

  const fetchBranches = async () => {
    try {
      const response = await branchServices.getBranches({ limit: 100, isActive: true });
      const allBranches = response.data.data.branches || [];
      // Filter branches based on user role
      let availableBranches = allBranches;
      if (isMultiBranchAdmin || isSingleBranchAdmin) {
        availableBranches = allBranches.filter((branch: Branch) => 
          user?.branchIds?.includes(branch._id)
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

  if (!selectedBranch && !isSingleBranchAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-8">
        <UtensilsCrossed className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Select a Branch</h3>
        <p className="text-muted-foreground text-center mb-4">
          Please select a branch to view menu
        </p>
        {(isSuperAdmin || isMultiBranchAdmin) && branches.length > 0 && (
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              {(isSuperAdmin || isMultiBranchAdmin) && (
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

  return (
    <div className="h-[calc(100vh-4rem)] -m-6 flex flex-col overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="mx-6 mt-6 mb-0 grid w-full grid-cols-2 lg:w-auto flex-shrink-0">
          <TabsTrigger value="items">Menu Items</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="m-0 flex-1 min-h-0 overflow-hidden">
          <MenuItemsTab
            selectedBranch={selectedBranch}
            branches={branches}
            onBranchChange={setSelectedBranch}
            isSuperAdmin={isSuperAdmin}
            isMultiBranchAdmin={isMultiBranchAdmin}
          />
        </TabsContent>

        <TabsContent value="categories" className="m-0 flex-1 min-h-0 overflow-hidden">
          <MenuCategoriesTab
            selectedBranch={selectedBranch}
            branches={branches}
            onBranchChange={setSelectedBranch}
            isSuperAdmin={isSuperAdmin}
            isMultiBranchAdmin={isMultiBranchAdmin}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
