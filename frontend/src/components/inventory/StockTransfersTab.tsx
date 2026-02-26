import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { 
  MyRequestsTab, 
  RequestsToMeTab, 
  InTransitTab,
  IncomingRequestsTab,
  PendingApprovalsTab, 
  AllTransactionsTab,
  ExceptionsTab
} from './stock-requests';

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
    if (isSuperAdminRole) {
      setActiveTab('pending-approvals');
    } else if (isWarehouseAdmin) {
      setActiveTab('incoming-requests');
    } else if (isBranchAdmin) {
      setActiveTab('my-requests');
    }
  }, [isSuperAdminRole, isWarehouseAdmin, isBranchAdmin]);

  // Calculate grid columns based on role
  const getGridColumns = () => {
    if (isSuperAdminRole) return 3; // Pending Approvals, All Transactions, Exceptions
    if (isWarehouseAdmin) return 2; // Incoming Requests, In-Transit
    if (isBranchAdmin) return 3; // My Requests, Requests To Me, In-Transit
    return 2;
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList 
          className="mx-6 mt-6 mb-0 grid w-full lg:w-auto flex-shrink-0" 
          style={{ gridTemplateColumns: `repeat(${getGridColumns()}, minmax(0, 1fr))` }}
        >
          {/* Branch Admin Tabs */}
          {isBranchAdmin && (
            <>
              <TabsTrigger value="my-requests">My Requests</TabsTrigger>
              <TabsTrigger value="requests-to-me">Requests To Me</TabsTrigger>
              <TabsTrigger value="in-transit">In-Transit/Processing</TabsTrigger>
            </>
          )}
          
          {/* Warehouse Admin Tabs */}
          {isWarehouseAdmin && (
            <>
              <TabsTrigger value="incoming-requests">Incoming Requests</TabsTrigger>
              <TabsTrigger value="in-transit">In-Transit/Processing</TabsTrigger>
            </>
          )}
          
          {/* Super Admin Tabs */}
          {isSuperAdminRole && (
            <>
              <TabsTrigger value="pending-approvals">Pending Approvals</TabsTrigger>
              <TabsTrigger value="all-transactions">All Transactions</TabsTrigger>
              <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Branch Admin Tab Contents */}
        {isBranchAdmin && (
          <>
            <TabsContent value="my-requests" className="m-0 flex-1 min-h-0 overflow-hidden">
              <MyRequestsTab
                selectedBranch={selectedBranch}
                branches={branches}
                onBranchChange={onBranchChange}
                isSuperAdmin={isSuperAdmin}
                isMultiBranchAdmin={isMultiBranchAdmin}
                onItemsUpdate={onItemsUpdate}
                user={{
                  role: user?.role || '',
                  branchIds: user?.branchIds || [],
                  warehouseIds: user?.warehouseIds || []
                }}
              />
            </TabsContent>
            <TabsContent value="requests-to-me" className="m-0 flex-1 min-h-0 overflow-hidden">
              <RequestsToMeTab
                selectedBranch={selectedBranch}
                branches={branches}
                onBranchChange={onBranchChange}
                isSuperAdmin={isSuperAdmin}
                isMultiBranchAdmin={isMultiBranchAdmin}
                onItemsUpdate={onItemsUpdate}
              />
            </TabsContent>
            <TabsContent value="in-transit" className="m-0 flex-1 min-h-0 overflow-hidden">
              <InTransitTab
                selectedBranch={selectedBranch}
                branches={branches}
                onBranchChange={onBranchChange}
                isSuperAdmin={isSuperAdmin}
                isMultiBranchAdmin={isMultiBranchAdmin}
                userRole={user?.role || ''}
                userBranchIds={user?.branchIds || []}
                userWarehouseIds={user?.warehouseIds || []}
              />
            </TabsContent>
          </>
        )}

        {/* Warehouse Admin Tab Contents */}
        {isWarehouseAdmin && (
          <>
            <TabsContent value="incoming-requests" className="m-0 flex-1 min-h-0 overflow-hidden">
              <IncomingRequestsTab
                selectedBranch={selectedBranch}
                branches={branches}
                onBranchChange={onBranchChange}
                isSuperAdmin={isSuperAdmin}
                isMultiBranchAdmin={isMultiBranchAdmin}
                onItemsUpdate={onItemsUpdate}
              />
            </TabsContent>
            <TabsContent value="in-transit" className="m-0 flex-1 min-h-0 overflow-hidden">
              <InTransitTab
                selectedBranch={selectedBranch}
                branches={branches}
                onBranchChange={onBranchChange}
                isSuperAdmin={isSuperAdmin}
                isMultiBranchAdmin={isMultiBranchAdmin}
                userRole={user?.role || ''}
                userBranchIds={user?.branchIds || []}
                userWarehouseIds={user?.warehouseIds || []}
              />
            </TabsContent>
          </>
        )}

        {/* Super Admin Tab Contents */}
        {isSuperAdminRole && (
          <>
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
            <TabsContent value="all-transactions" className="m-0 flex-1 min-h-0 overflow-hidden">
              <AllTransactionsTab
                selectedBranch={selectedBranch}
                branches={branches}
                onBranchChange={onBranchChange}
                isSuperAdmin={isSuperAdmin}
                isMultiBranchAdmin={isMultiBranchAdmin}
                onItemsUpdate={onItemsUpdate}
              />
            </TabsContent>
            <TabsContent value="exceptions" className="m-0 flex-1 min-h-0 overflow-hidden">
              <ExceptionsTab
                selectedBranch={selectedBranch}
                branches={branches}
                onBranchChange={onBranchChange}
                isSuperAdmin={isSuperAdmin}
                isMultiBranchAdmin={isMultiBranchAdmin}
                onItemsUpdate={onItemsUpdate}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
