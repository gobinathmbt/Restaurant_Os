import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { MyRequestsTab, PendingApprovalsTab, TransfersToExecuteTab } from './stock-requests';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface StockTransfersTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
  onItemsUpdate?: () => void;
}

export default function StockTransfersTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
  onItemsUpdate,
}: StockTransfersTabProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('my-requests');

  // Determine which tabs to show based on user role
  const isSuperAdminRole = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');
  const isWarehouseAdmin = user?.role === 'warehouse_admin';
  const isBranchAdmin = user?.role === 'company_admin';

  // Set default tab based on role
  useEffect(() => {
    if (isSuperAdminRole || isWarehouseAdmin) {
      setActiveTab('pending-approvals');
    } else {
      setActiveTab('my-requests');
    }
  }, [isSuperAdminRole, isWarehouseAdmin]);

  return (
    <div className="h-full flex flex-col bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="mx-6 mt-6 mb-0 grid w-full lg:w-auto flex-shrink-0" style={{ gridTemplateColumns: `repeat(${isBranchAdmin ? 1 : isWarehouseAdmin ? 2 : 2}, minmax(0, 1fr))` }}>
          {isBranchAdmin && (
            <TabsTrigger value="my-requests">My Requests</TabsTrigger>
          )}
          {(isSuperAdminRole || isWarehouseAdmin) && (
            <TabsTrigger value="pending-approvals">Pending Approvals</TabsTrigger>
          )}
          {isWarehouseAdmin && (
            <TabsTrigger value="transfers-to-execute">Transfers to Execute</TabsTrigger>
          )}
        </TabsList>

        {isBranchAdmin && (
          <TabsContent value="my-requests" className="m-0 flex-1 min-h-0 overflow-hidden">
            <MyRequestsTab
              selectedBranch={selectedBranch}
              branches={branches}
              onBranchChange={onBranchChange}
              isSuperAdmin={isSuperAdmin}
              isMultiBranchAdmin={isMultiBranchAdmin}
              onItemsUpdate={onItemsUpdate}
            />
          </TabsContent>
        )}

        {(isSuperAdminRole || isWarehouseAdmin) && (
          <TabsContent value="pending-approvals" className="m-0 flex-1 min-h-0 overflow-hidden">
            <PendingApprovalsTab
              selectedBranch={selectedBranch}
              branches={branches}
              onBranchChange={onBranchChange}
              isSuperAdmin={isSuperAdmin}
              isMultiBranchAdmin={isMultiBranchAdmin}
              onItemsUpdate={onItemsUpdate}
            />
          </TabsContent>
        )}

        {isWarehouseAdmin && (
          <TabsContent value="transfers-to-execute" className="m-0 flex-1 min-h-0 overflow-hidden">
            <TransfersToExecuteTab
              selectedBranch={selectedBranch}
              branches={branches}
              onBranchChange={onBranchChange}
              isSuperAdmin={isSuperAdmin}
              isMultiBranchAdmin={isMultiBranchAdmin}
              onItemsUpdate={onItemsUpdate}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
