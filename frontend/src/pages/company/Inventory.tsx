import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, CheckCircle, XCircle, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { inventoryServices, branchServices } from '@/api/services';
import InventoryItemFormModal from '@/components/inventory/InventoryItemFormModal';
import GRNFormModal from '@/components/inventory/GRNFormModal';
import StockAdjustmentFormModal from '@/components/inventory/StockAdjustmentFormModal';
import StockTransferFormModal from '@/components/inventory/StockTransferFormModal';
import StockTransferApprovalModal from '@/components/inventory/StockTransferApprovalModal';
import DeleteConfirmDialog from '@/components/company/DeleteConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useLoading } from '@/contexts/LoadingContext';
import DataTableLayout from '@/components/common/DataTableLayout';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface InventoryItem {
  _id: string;
  name: string;
  type: 'raw_material' | 'finished_good';
  category: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  maximumStock?: number;
  costPrice?: number;
  supplier?: {
    _id: string;
    name: string;
  };
  expiryDate?: string;
  isLowStock: boolean;
  isExpiringSoon: boolean;
  isActive: boolean;
}

interface GRN {
  _id: string;
  grnNumber: string;
  supplier: {
    _id: string;
    name: string;
  };
  receivedDate: string;
  totalAmount: number;
  status: string;
}

interface StockAdjustment {
  _id: string;
  adjustmentNumber: string;
  inventoryItem: {
    _id: string;
    name: string;
  };
  adjustmentType: string;
  quantity: number;
  reason: string;
  adjustedBy: {
    _id: string;
    name: string;
  };
  adjustmentDate: string;
}

interface StockTransfer {
  _id: string;
  transferNumber: string;
  fromBranch: {
    _id: string;
    name: string;
  };
  toBranch: {
    _id: string;
    name: string;
  };
  status: string;
  requestedBy: {
    _id: string;
    name: string;
  };
  requestDate: string;
}

export default function Inventory() {
  const { user } = useAuth();
  const { setLoading, setLoadingMessage } = useLoading();
  const { toast } = useToast();

  // Branch management
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  
  // Active tab
  const [activeTab, setActiveTab] = useState('items');
  
  // Items tab state
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsSearch, setItemsSearch] = useState('');
  const [itemsTypeFilter, setItemsTypeFilter] = useState('');
  const [itemsCategoryFilter, setItemsCategoryFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsRowsPerPage, setItemsRowsPerPage] = useState(10);
  const [itemsTotalCount, setItemsTotalCount] = useState(0);
  const [itemsTotalPages, setItemsTotalPages] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemDeleteDialog, setItemDeleteDialog] = useState<{ open: boolean; item: InventoryItem | null }>({
    open: false,
    item: null
  });

  // GRN tab state
  const [grns, setGrns] = useState<GRN[]>([]);
  const [grnsLoading, setGrnsLoading] = useState(true);
  const [grnsSearch, setGrnsSearch] = useState('');
  const [grnsPage, setGrnsPage] = useState(1);
  const [grnsRowsPerPage, setGrnsRowsPerPage] = useState(10);
  const [grnsTotalCount, setGrnsTotalCount] = useState(0);
  const [grnsTotalPages, setGrnsTotalPages] = useState(0);
  const [isGrnFormOpen, setIsGrnFormOpen] = useState(false);

  // Stock Adjustment tab state
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(true);
  const [adjustmentsSearch, setAdjustmentsSearch] = useState('');
  const [adjustmentsPage, setAdjustmentsPage] = useState(1);
  const [adjustmentsRowsPerPage, setAdjustmentsRowsPerPage] = useState(10);
  const [adjustmentsTotalCount, setAdjustmentsTotalCount] = useState(0);
  const [adjustmentsTotalPages, setAdjustmentsTotalPages] = useState(0);
  const [isAdjustmentFormOpen, setIsAdjustmentFormOpen] = useState(false);

  // Stock Transfer tab state
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [transfersSearch, setTransfersSearch] = useState('');
  const [transfersStatusFilter, setTransfersStatusFilter] = useState('');
  const [transfersPage, setTransfersPage] = useState(1);
  const [transfersRowsPerPage, setTransfersRowsPerPage] = useState(10);
  const [transfersTotalCount, setTransfersTotalCount] = useState(0);
  const [transfersTotalPages, setTransfersTotalPages] = useState(0);
  const [isTransferFormOpen, setIsTransferFormOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [isTransferApprovalOpen, setIsTransferApprovalOpen] = useState(false);

  // Determine user's branch access
  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');
  const isMultiBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) > 1;
  const isSingleBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) === 1;

  // Fetch branches on mount
  useEffect(() => {
    fetchBranches();
  }, []);

  // Auto-select branch for single-branch admins
  useEffect(() => {
    if (isSingleBranchAdmin && user?.branchIds && user.branchIds.length === 1) {
      setSelectedBranch(user.branchIds[0]);
    }
  }, [isSingleBranchAdmin, user?.branchIds]);

  // Fetch data when branch or tab changes
  useEffect(() => {
    if (selectedBranch) {
      if (activeTab === 'items') {
        fetchItems();
        fetchCategories();
        fetchAlertCounts();
      } else if (activeTab === 'grn') {
        fetchGRNs();
      } else if (activeTab === 'adjustments') {
        fetchAdjustments();
      } else if (activeTab === 'transfers') {
        fetchTransfers();
      }
    }
  }, [selectedBranch, activeTab, itemsPage, itemsRowsPerPage, itemsSearch, itemsTypeFilter, itemsCategoryFilter,
      grnsPage, grnsRowsPerPage, grnsSearch,
      adjustmentsPage, adjustmentsRowsPerPage, adjustmentsSearch,
      transfersPage, transfersRowsPerPage, transfersSearch, transfersStatusFilter]);

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
      
      // Auto-select first branch for super admins if none selected
      if (isSuperAdmin && !selectedBranch && availableBranches.length > 0) {
        setSelectedBranch(availableBranches[0]._id);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch branches",
        variant: "destructive",
      });
    }
  };

  const fetchItems = async () => {
    if (!selectedBranch) return;
    
    try {
      setItemsLoading(true);
      const response = await inventoryServices.getInventoryItems(selectedBranch, {
        page: itemsPage,
        limit: itemsRowsPerPage,
        search: itemsSearch || undefined,
        type: itemsTypeFilter || undefined,
        category: itemsCategoryFilter || undefined
      });

      setItems(response.data.data.items || []);
      setItemsTotalCount(response.data.data.pagination.total);
      setItemsTotalPages(response.data.data.pagination.totalPages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch inventory items',
        variant: "destructive",
      });
    } finally {
      setItemsLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!selectedBranch) return;
    
    try {
      const response = await inventoryServices.getInventoryCategories(selectedBranch);
      setCategories(response.data.data.categories || []);
    } catch (error: any) {
      // Silently fail for categories
    }
  };

  const fetchAlertCounts = async () => {
    if (!selectedBranch) return;
    
    try {
      const [lowStockResponse, expiringResponse] = await Promise.all([
        inventoryServices.getLowStockItems(selectedBranch),
        inventoryServices.getExpiringItems(selectedBranch)
      ]);
      
      setLowStockCount(lowStockResponse.data.data.items?.length || 0);
      setExpiringCount(expiringResponse.data.data.items?.length || 0);
    } catch (error: any) {
      // Silently fail for alert counts
    }
  };

  const fetchGRNs = async () => {
    if (!selectedBranch) return;
    
    try {
      setGrnsLoading(true);
      const response = await inventoryServices.getGRNs(selectedBranch, {
        page: grnsPage,
        limit: grnsRowsPerPage,
        search: grnsSearch || undefined
      });

      setGrns(response.data.data.grns || []);
      setGrnsTotalCount(response.data.data.pagination.total);
      setGrnsTotalPages(response.data.data.pagination.totalPages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch GRNs',
        variant: "destructive",
      });
    } finally {
      setGrnsLoading(false);
    }
  };

  const fetchAdjustments = async () => {
    if (!selectedBranch) return;
    
    try {
      setAdjustmentsLoading(true);
      const response = await inventoryServices.getStockAdjustments(selectedBranch, {
        page: adjustmentsPage,
        limit: adjustmentsRowsPerPage,
        search: adjustmentsSearch || undefined
      });

      setAdjustments(response.data.data.adjustments || []);
      setAdjustmentsTotalCount(response.data.data.pagination.total);
      setAdjustmentsTotalPages(response.data.data.pagination.totalPages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch stock adjustments',
        variant: "destructive",
      });
    } finally {
      setAdjustmentsLoading(false);
    }
  };

  const fetchTransfers = async () => {
    if (!selectedBranch) return;
    
    try {
      setTransfersLoading(true);
      const response = await inventoryServices.getStockTransfers(selectedBranch, {
        page: transfersPage,
        limit: transfersRowsPerPage,
        search: transfersSearch || undefined,
        status: transfersStatusFilter || undefined
      });

      setTransfers(response.data.data.transfers || []);
      setTransfersTotalCount(response.data.data.pagination.total);
      setTransfersTotalPages(response.data.data.pagination.totalPages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch stock transfers',
        variant: "destructive",
      });
    } finally {
      setTransfersLoading(false);
    }
  };

  // Item handlers
  const handleCreateItem = () => {
    setSelectedItem(null);
    setIsItemFormOpen(true);
  };

  const handleEditItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsItemFormOpen(true);
  };

  const handleDeleteItem = (item: InventoryItem) => {
    setItemDeleteDialog({ open: true, item });
  };

  const confirmDeleteItem = async () => {
    if (!itemDeleteDialog.item) return;

    try {
      setLoading(true);
      setLoadingMessage('Deleting inventory item...');
      await inventoryServices.deleteInventoryItem(itemDeleteDialog.item._id);
      toast({
        title: "Success",
        description: "Inventory item deleted successfully",
        variant: "success",
      });
      fetchItems();
      fetchAlertCounts();
      setItemDeleteDialog({ open: false, item: null });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to delete inventory item',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleItemFormSuccess = () => {
    setIsItemFormOpen(false);
    setSelectedItem(null);
    fetchItems();
    fetchCategories();
    fetchAlertCounts();
  };

  // GRN handlers
  const handleCreateGRN = () => {
    setIsGrnFormOpen(true);
  };

  const handleGrnFormSuccess = () => {
    setIsGrnFormOpen(false);
    fetchGRNs();
    fetchItems(); // Refresh items as stock levels changed
    fetchAlertCounts();
  };

  // Adjustment handlers
  const handleCreateAdjustment = () => {
    setIsAdjustmentFormOpen(true);
  };

  const handleAdjustmentFormSuccess = () => {
    setIsAdjustmentFormOpen(false);
    fetchAdjustments();
    fetchItems(); // Refresh items as stock levels changed
    fetchAlertCounts();
  };

  // Transfer handlers
  const handleCreateTransfer = () => {
    setIsTransferFormOpen(true);
  };

  const handleViewTransfer = (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    setIsTransferApprovalOpen(true);
  };

  const handleTransferFormSuccess = () => {
    setIsTransferFormOpen(false);
    fetchTransfers();
  };

  const handleTransferApprovalSuccess = () => {
    setIsTransferApprovalOpen(false);
    setSelectedTransfer(null);
    fetchTransfers();
    fetchItems(); // Refresh items as stock levels changed
    fetchAlertCounts();
  };

  // Filter handlers
  const handleLowStockClick = () => {
    setItemsTypeFilter('');
    setItemsCategoryFilter('');
    setItemsSearch('');
    setItemsPage(1);
    // Note: We would need to add a lowStock filter to the API call
    // For now, this just clears other filters
  };

  const handleExpiringClick = () => {
    setItemsTypeFilter('');
    setItemsCategoryFilter('');
    setItemsSearch('');
    setItemsPage(1);
    // Note: We would need to add an expiring filter to the API call
    // For now, this just clears other filters
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; label: string }> = {
      pending: { variant: 'default', label: 'Pending' },
      approved: { variant: 'default', label: 'Approved' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      completed: { variant: 'default', label: 'Completed' },
      cancelled: { variant: 'secondary', label: 'Cancelled' },
      received: { variant: 'default', label: 'Received' },
      verified: { variant: 'default', label: 'Verified' }
    };

    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant} className={config.variant === 'default' ? 'bg-green-100 text-green-800' : ''}>{config.label}</Badge>;
  };

  const getAdjustmentTypeBadge = (type: string) => {
    const typeConfig: Record<string, { variant: any; label: string }> = {
      increase: { variant: 'default', label: 'Increase' },
      decrease: { variant: 'destructive', label: 'Decrease' },
      correction: { variant: 'secondary', label: 'Correction' }
    };

    const config = typeConfig[type] || { variant: 'secondary', label: type };
    return <Badge variant={config.variant} className={config.variant === 'default' ? 'bg-blue-100 text-blue-800' : ''}>{config.label}</Badge>;
  };

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
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
          {/* Fixed Header with Tabs */}
          <div className="bg-background border-b flex-shrink-0">
            <div className="px-6 py-3">
              <TabsList className="grid w-full max-w-2xl grid-cols-4">
                <TabsTrigger value="items">Items</TabsTrigger>
                <TabsTrigger value="grn">GRN</TabsTrigger>
                <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
                <TabsTrigger value="transfers">Transfers</TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Items Tab */}
          <TabsContent value="items" className="flex-1 m-0">
            <DataTableLayout
              statChips={[
                { label: 'Total Items', value: itemsTotalCount, variant: 'default' },
                { 
                  label: 'Low Stock', 
                  value: lowStockCount, 
                  variant: 'destructive',
                  bgColor: 'bg-red-100 text-red-800',
                  onClick: handleLowStockClick
                },
                { 
                  label: 'Expiring Soon', 
                  value: expiringCount, 
                  variant: 'default',
                  bgColor: 'bg-orange-100 text-orange-800',
                  onClick: handleExpiringClick
                },
              ]}
              actionButtons={[
                {
                  icon: <Plus className="h-4 w-4" />,
                  tooltip: 'Add inventory item',
                  onClick: handleCreateItem,
                  variant: 'default',
                },
              ]}
              searchValue={itemsSearch}
              searchPlaceholder="Search items..."
              onSearchChange={setItemsSearch}
              filterConfig={{
                component: (
                  <div className="flex items-center gap-2">
                    {(isSuperAdmin || isMultiBranchAdmin) && (
                      <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                        <SelectTrigger className="w-48 h-9">
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch._id} value={branch._id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Select value={itemsTypeFilter} onValueChange={setItemsTypeFilter}>
                      <SelectTrigger className="w-40 h-9">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All types</SelectItem>
                        <SelectItem value="raw_material">Raw Material</SelectItem>
                        <SelectItem value="finished_good">Finished Good</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={itemsCategoryFilter} onValueChange={setItemsCategoryFilter}>
                      <SelectTrigger className="w-40 h-9">
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              }}
              tableHeaders={
                <>
                  <TableHead className="w-16">S.No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead className="text-right">Min Stock</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Cost Price</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </>
              }

              tableBody={
                <>
                  {items.map((item, index) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {(itemsPage - 1) * itemsRowsPerPage + index + 1}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {(item.isLowStock || item.isExpiringSoon) && (
                            <div className="flex gap-1 mt-1">
                              {item.isLowStock && (
                                <Badge variant="destructive" className="text-xs">Low Stock</Badge>
                              )}
                              {item.isExpiringSoon && (
                                <Badge className="text-xs bg-orange-100 text-orange-800">Expiring Soon</Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.type === 'raw_material' ? 'Raw Material' : 'Finished Good'}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.category || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {item.currentStock}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.minimumStock}
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">
                        {item.costPrice ? formatCurrency(item.costPrice) : '-'}
                      </TableCell>
                      <TableCell>{item.supplier?.name || '-'}</TableCell>
                      <TableCell>
                        {item.expiryDate ? formatDate(item.expiryDate) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? 'default' : 'secondary'}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditItem(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              }
              isLoading={itemsLoading}
              emptyState={
                items.length === 0
                  ? {
                      icon: <Package className="h-12 w-12" />,
                      title: 'No inventory items found',
                      description: itemsSearch || itemsTypeFilter || itemsCategoryFilter
                        ? 'Try adjusting your filters'
                        : 'Get started by adding your first inventory item',
                      action: !itemsSearch && !itemsTypeFilter && !itemsCategoryFilter ? (
                        <Button onClick={handleCreateItem}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Item
                        </Button>
                      ) : undefined,
                    }
                  : undefined
              }
              currentPage={itemsPage}
              totalPages={itemsTotalPages}
              totalCount={itemsTotalCount}
              rowsPerPage={itemsRowsPerPage}
              onPageChange={setItemsPage}
              onRowsPerPageChange={setItemsRowsPerPage}
              onRefresh={fetchItems}
              cookiePrefix="inventory-items"
            />
          </TabsContent>

          {/* GRN Tab */}
          <TabsContent value="grn" className="flex-1 m-0">
            <DataTableLayout
              statChips={[
                { label: 'Total GRNs', value: grnsTotalCount, variant: 'default' },
              ]}
              actionButtons={[
                {
                  icon: <Plus className="h-4 w-4" />,
                  tooltip: 'Create GRN',
                  onClick: handleCreateGRN,
                  variant: 'default',
                },
              ]}
              searchValue={grnsSearch}
              searchPlaceholder="Search GRNs..."
              onSearchChange={setGrnsSearch}
              filterConfig={{
                component: (
                  <div className="flex items-center gap-2">
                    {(isSuperAdmin || isMultiBranchAdmin) && (
                      <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                        <SelectTrigger className="w-48 h-9">
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch._id} value={branch._id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )
              }}
              tableHeaders={
                <>
                  <TableHead className="w-16">S.No</TableHead>
                  <TableHead>GRN Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </>
              }
              tableBody={
                <>
                  {grns.map((grn, index) => (
                    <TableRow key={grn._id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {(grnsPage - 1) * grnsRowsPerPage + index + 1}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{grn.grnNumber}</p>
                      </TableCell>
                      <TableCell>{grn.supplier?.name || '-'}</TableCell>
                      <TableCell>{formatDate(grn.receivedDate)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(grn.totalAmount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(grn.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              }
              isLoading={grnsLoading}
              emptyState={
                grns.length === 0
                  ? {
                      icon: <Package className="h-12 w-12" />,
                      title: 'No GRNs found',
                      description: grnsSearch
                        ? 'Try adjusting your search'
                        : 'Get started by creating your first GRN',
                      action: !grnsSearch ? (
                        <Button onClick={handleCreateGRN}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create GRN
                        </Button>
                      ) : undefined,
                    }
                  : undefined
              }
              currentPage={grnsPage}
              totalPages={grnsTotalPages}
              totalCount={grnsTotalCount}
              rowsPerPage={grnsRowsPerPage}
              onPageChange={setGrnsPage}
              onRowsPerPageChange={setGrnsRowsPerPage}
              onRefresh={fetchGRNs}
              cookiePrefix="inventory-grns"
            />
          </TabsContent>

          {/* Stock Adjustments Tab */}
          <TabsContent value="adjustments" className="flex-1 m-0">
            <DataTableLayout
              statChips={[
                { label: 'Total Adjustments', value: adjustmentsTotalCount, variant: 'default' },
              ]}
              actionButtons={[
                {
                  icon: <Plus className="h-4 w-4" />,
                  tooltip: 'Create adjustment',
                  onClick: handleCreateAdjustment,
                  variant: 'default',
                },
              ]}
              searchValue={adjustmentsSearch}
              searchPlaceholder="Search adjustments..."
              onSearchChange={setAdjustmentsSearch}
              filterConfig={{
                component: (
                  <div className="flex items-center gap-2">
                    {(isSuperAdmin || isMultiBranchAdmin) && (
                      <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                        <SelectTrigger className="w-48 h-9">
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch._id} value={branch._id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )
              }}
              tableHeaders={
                <>
                  <TableHead className="w-16">S.No</TableHead>
                  <TableHead>Adjustment Number</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Adjusted By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </>
              }
              tableBody={
                <>
                  {adjustments.map((adjustment, index) => (
                    <TableRow key={adjustment._id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {(adjustmentsPage - 1) * adjustmentsRowsPerPage + index + 1}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{adjustment.adjustmentNumber}</p>
                      </TableCell>
                      <TableCell>{adjustment.inventoryItem?.name || '-'}</TableCell>
                      <TableCell>{getAdjustmentTypeBadge(adjustment.adjustmentType)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {adjustment.quantity}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {adjustment.reason.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{adjustment.adjustedBy?.name || '-'}</TableCell>
                      <TableCell>{formatDate(adjustment.adjustmentDate)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              }
              isLoading={adjustmentsLoading}
              emptyState={
                adjustments.length === 0
                  ? {
                      icon: <Package className="h-12 w-12" />,
                      title: 'No adjustments found',
                      description: adjustmentsSearch
                        ? 'Try adjusting your search'
                        : 'Get started by creating your first stock adjustment',
                      action: !adjustmentsSearch ? (
                        <Button onClick={handleCreateAdjustment}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Adjustment
                        </Button>
                      ) : undefined,
                    }
                  : undefined
              }
              currentPage={adjustmentsPage}
              totalPages={adjustmentsTotalPages}
              totalCount={adjustmentsTotalCount}
              rowsPerPage={adjustmentsRowsPerPage}
              onPageChange={setAdjustmentsPage}
              onRowsPerPageChange={setAdjustmentsRowsPerPage}
              onRefresh={fetchAdjustments}
              cookiePrefix="inventory-adjustments"
            />
          </TabsContent>

          {/* Stock Transfers Tab */}
          <TabsContent value="transfers" className="flex-1 m-0">
            <DataTableLayout
              statChips={[
                { label: 'Total Transfers', value: transfersTotalCount, variant: 'default' },
              ]}
              actionButtons={[
                {
                  icon: <Plus className="h-4 w-4" />,
                  tooltip: 'Create transfer',
                  onClick: handleCreateTransfer,
                  variant: 'default',
                },
              ]}
              searchValue={transfersSearch}
              searchPlaceholder="Search transfers..."
              onSearchChange={setTransfersSearch}
              filterConfig={{
                component: (
                  <div className="flex items-center gap-2">
                    {(isSuperAdmin || isMultiBranchAdmin) && (
                      <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                        <SelectTrigger className="w-48 h-9">
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch._id} value={branch._id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Select value={transfersStatusFilter} onValueChange={setTransfersStatusFilter}>
                      <SelectTrigger className="w-40 h-9">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )
              }}
              tableHeaders={
                <>
                  <TableHead className="w-16">S.No</TableHead>
                  <TableHead>Transfer Number</TableHead>
                  <TableHead>From Branch</TableHead>
                  <TableHead>To Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </>
              }
              tableBody={
                <>
                  {transfers.map((transfer, index) => (
                    <TableRow key={transfer._id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {(transfersPage - 1) * transfersRowsPerPage + index + 1}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{transfer.transferNumber}</p>
                      </TableCell>
                      <TableCell>{transfer.fromBranch?.name || '-'}</TableCell>
                      <TableCell>{transfer.toBranch?.name || '-'}</TableCell>
                      <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                      <TableCell>{transfer.requestedBy?.name || '-'}</TableCell>
                      <TableCell>{formatDate(transfer.requestDate)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewTransfer(transfer)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {transfer.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewTransfer(transfer)}
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewTransfer(transfer)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              }
              isLoading={transfersLoading}
              emptyState={
                transfers.length === 0
                  ? {
                      icon: <Package className="h-12 w-12" />,
                      title: 'No transfers found',
                      description: transfersSearch || transfersStatusFilter
                        ? 'Try adjusting your filters'
                        : 'Get started by creating your first stock transfer',
                      action: !transfersSearch && !transfersStatusFilter ? (
                        <Button onClick={handleCreateTransfer}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Transfer
                        </Button>
                      ) : undefined,
                    }
                  : undefined
              }
              currentPage={transfersPage}
              totalPages={transfersTotalPages}
              totalCount={transfersTotalCount}
              rowsPerPage={transfersRowsPerPage}
              onPageChange={setTransfersPage}
              onRowsPerPageChange={setTransfersRowsPerPage}
              onRefresh={fetchTransfers}
              cookiePrefix="inventory-transfers"
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Modals */}
      <InventoryItemFormModal
        open={isItemFormOpen}
        onClose={() => {
          setIsItemFormOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        branchId={selectedBranch}
        onSuccess={handleItemFormSuccess}
      />

      <GRNFormModal
        open={isGrnFormOpen}
        onClose={() => setIsGrnFormOpen(false)}
        branchId={selectedBranch}
        onSuccess={handleGrnFormSuccess}
      />

      <StockAdjustmentFormModal
        open={isAdjustmentFormOpen}
        onClose={() => setIsAdjustmentFormOpen(false)}
        branchId={selectedBranch}
        onSuccess={handleAdjustmentFormSuccess}
      />

      <StockTransferFormModal
        open={isTransferFormOpen}
        onClose={() => setIsTransferFormOpen(false)}
        currentBranchId={selectedBranch}
        onSuccess={handleTransferFormSuccess}
      />

      <StockTransferApprovalModal
        open={isTransferApprovalOpen}
        onClose={() => {
          setIsTransferApprovalOpen(false);
          setSelectedTransfer(null);
        }}
        transfer={selectedTransfer}
        onSuccess={handleTransferApprovalSuccess}
      />

      <DeleteConfirmDialog
        open={itemDeleteDialog.open}
        onClose={() => setItemDeleteDialog({ open: false, item: null })}
        onConfirm={confirmDeleteItem}
        title="Delete Inventory Item"
        description={`Are you sure you want to delete "${itemDeleteDialog.item?.name}"? This action cannot be undone.`}
      />
    </>
  );
}
