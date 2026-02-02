import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { inventoryServices } from '@/api/services';
import InventoryItemFormModal from '@/components/inventory/InventoryItemFormModal';
import DeleteConfirmDialog from '@/components/company/DeleteConfirmDialog';
import { useLoading } from '@/contexts/LoadingContext';
import SupplierCategoryFilter from '@/components/inventory/SupplierCategoryFilter';
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
  branchIds: Array<{
    _id: string;
    name: string;
    code: string;
  } | string>;
  category: {
    _id: string;
    name: string;
    color: string;
  } | string;
  subcategory?: {
    _id: string;
    name: string;
    color: string;
  } | string;
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

interface InventoryItemsTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
}

export default function InventoryItemsTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
}: InventoryItemsTabProps) {
  const { setLoading, setLoadingMessage } = useLoading();
  const { toast } = useToast();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsSearch, setItemsSearch] = useState('');
  const [itemsTypeFilter, setItemsTypeFilter] = useState('');
  const [itemsCategoryFilter, setItemsCategoryFilter] = useState('all');
  const [itemsSubcategoryFilter, setItemsSubcategoryFilter] = useState('all');
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

  // Infinite scroll state
  const [infiniteScrollPage, setInfiniteScrollPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [paginationEnabled, setPaginationEnabled] = useState(true);

  useEffect(() => {
    if (selectedBranch) {
      if (paginationEnabled) {
        fetchItems();
      } else {
        // Reset for infinite scroll
        setItems([]);
        setInfiniteScrollPage(1);
        setHasMore(true);
        fetchItemsInfinite(1, true);
      }
      fetchCategories();
      fetchAlertCounts();
    }
  }, [selectedBranch, itemsPage, itemsRowsPerPage, itemsSearch, itemsTypeFilter, itemsCategoryFilter, itemsSubcategoryFilter, paginationEnabled]);

  const fetchItems = async () => {
    if (!selectedBranch || !paginationEnabled) return;
    
    try {
      setItemsLoading(true);
      
      // Build params object
      const params: any = {
        page: itemsPage,
        limit: itemsRowsPerPage,
        search: itemsSearch || undefined,
        type: itemsTypeFilter || undefined,
        category: itemsCategoryFilter !== 'all' ? itemsCategoryFilter : undefined,
        subcategory: itemsSubcategoryFilter !== 'all' ? itemsSubcategoryFilter : undefined,
      };
      
      const response = await inventoryServices.getInventoryItems(selectedBranch, params);

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

  const fetchItemsInfinite = async (page: number, reset: boolean = false) => {
    if (!selectedBranch) return;
    
    try {
      if (reset) {
        setItemsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const params: any = {
        page: page,
        limit: 20, // Fixed batch size for infinite scroll
        search: itemsSearch || undefined,
        type: itemsTypeFilter || undefined,
        category: itemsCategoryFilter !== 'all' ? itemsCategoryFilter : undefined,
        subcategory: itemsSubcategoryFilter !== 'all' ? itemsSubcategoryFilter : undefined,
      };

      const response = await inventoryServices.getInventoryItems(selectedBranch, params);
      const fetchedItems = response.data.data.items || [];
      const pagination = response.data.data.pagination;

      if (reset) {
        setItems(fetchedItems);
      } else {
        setItems(prev => [...prev, ...fetchedItems]);
      }

      setItemsTotalCount(pagination.total);
      setItemsTotalPages(pagination.totalPages);
      setHasMore(page < pagination.totalPages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch inventory items',
        variant: "destructive",
      });
    } finally {
      setItemsLoading(false);
      setIsLoadingMore(false);
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

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && !paginationEnabled) {
      const nextPage = infiniteScrollPage + 1;
      setInfiniteScrollPage(nextPage);
      fetchItemsInfinite(nextPage, false);
    }
  };

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
      if (paginationEnabled) {
        fetchItems();
      } else {
        setItems([]);
        setInfiniteScrollPage(1);
        setHasMore(true);
        fetchItemsInfinite(1, true);
      }
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
    if (paginationEnabled) {
      fetchItems();
    } else {
      setItems([]);
      setInfiniteScrollPage(1);
      setHasMore(true);
      fetchItemsInfinite(1, true);
    }
    fetchCategories();
    fetchAlertCounts();
  };

  const handleLowStockClick = () => {
    setItemsTypeFilter('');
    setItemsCategoryFilter('all');
    setItemsSubcategoryFilter('all');
    setItemsSearch('');
    setItemsPage(1);
  };

  const handleExpiringClick = () => {
    setItemsTypeFilter('');
    setItemsCategoryFilter('all');
    setItemsSubcategoryFilter('all');
    setItemsSearch('');
    setItemsPage(1);
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

  return (
    <>
      <div className="h-full flex flex-col">
        <DataTableLayout
        statChips={[
          { label: 'Total Items', value: itemsTotalCount, variant: 'default' },
          { label: 'Low Stock', value: lowStockCount, variant: 'destructive' },
          { label: 'Expiring Soon', value: expiringCount, variant: 'default' },
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
                <Select value={selectedBranch} onValueChange={onBranchChange}>
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin && (
                      <SelectItem value="all">All Branches</SelectItem>
                    )}
                    {branches.map((branch) => (
                      <SelectItem key={branch._id} value={branch._id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={itemsTypeFilter || "all"} onValueChange={(value) => setItemsTypeFilter(value === "all" ? "" : value)}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="raw_material">Raw Material</SelectItem>
                  <SelectItem value="finished_good">Finished Good</SelectItem>
                </SelectContent>
              </Select>
              <SupplierCategoryFilter
                selectedBranchId={selectedBranch}
                selectedCategoryId={itemsCategoryFilter}
                selectedSubcategoryId={itemsSubcategoryFilter}
                onCategoryChange={setItemsCategoryFilter}
                onSubcategoryChange={setItemsSubcategoryFilter}
              />
            </div>
          )
        }}
        tableHeaders={
          <>
            <TableHead className="w-16">S.No</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Branches</TableHead>
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
            {items.map((item, index) => {
              // Calculate serial number based on pagination mode
              const serialNumber = paginationEnabled 
                ? (itemsPage - 1) * itemsRowsPerPage + index + 1
                : index + 1;

              // Helper function to get branch names
              const getBranchNames = () => {
                if (!item.branchIds || item.branchIds.length === 0) return [];
                return item.branchIds.map(branch => 
                  typeof branch === 'string' ? branch : branch.name
                );
              };

              // Helper function to format category path
              const getCategoryPath = () => {
                if (!item.category) return '-';
                
                const categoryName = typeof item.category === 'string' 
                  ? item.category 
                  : item.category.name;
                
                if (item.subcategory) {
                  const subcategoryName = typeof item.subcategory === 'string'
                    ? item.subcategory
                    : item.subcategory.name;
                  return `${categoryName} > ${subcategoryName}`;
                }
                
                return categoryName;
              };

              const branchNames = getBranchNames();
              const branchCount = item.branchIds?.length || 0;

              return (
                <TableRow key={item._id}>
                  <TableCell className="font-medium text-muted-foreground">
                    {serialNumber}
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
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="cursor-help">
                            {branchCount} branch{branchCount !== 1 ? 'es' : ''}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="max-w-xs">
                            {branchNames.length > 0 ? (
                              <ul className="list-disc list-inside">
                                {branchNames.map((name, idx) => (
                                  <li key={idx}>{name}</li>
                                ))}
                              </ul>
                            ) : (
                              <p>No branches assigned</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>{getCategoryPath()}</TableCell>
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
                        title="Edit item"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteItem(item)}
                        title="Delete item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </>
        }
        isLoading={itemsLoading}
        emptyState={
          items.length === 0
            ? {
              icon: <Package className="h-12 w-12" />,
              title: 'No inventory items found',
              description: itemsSearch || itemsTypeFilter || (itemsCategoryFilter !== 'all') || (itemsSubcategoryFilter !== 'all')
                ? 'Try adjusting your filters'
                : 'Get started by adding your first inventory item',
              action: !itemsSearch && !itemsTypeFilter && itemsCategoryFilter === 'all' && itemsSubcategoryFilter === 'all' ? (
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
        onRowsPerPageChange={(rows) => {
          setItemsRowsPerPage(rows);
          setItemsPage(1);
        }}
        onRefresh={() => {
          if (paginationEnabled) {
            fetchItems();
          } else {
            setItems([]);
            setInfiniteScrollPage(1);
            setHasMore(true);
            fetchItemsInfinite(1, true);
          }
          fetchAlertCounts();
        }}
        storagePrefix="inventory-items"
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onPaginationChange={(enabled) => setPaginationEnabled(enabled)}
      />

      {/* Item Form Modal */}
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={itemDeleteDialog.open}
        onClose={() => setItemDeleteDialog({ open: false, item: null })}
        onConfirm={confirmDeleteItem}
        title="Delete Inventory Item"
        description={`Are you sure you want to delete "${itemDeleteDialog.item?.name}"? This action cannot be undone.`}
      />
    </div>
    </>
  );
}
