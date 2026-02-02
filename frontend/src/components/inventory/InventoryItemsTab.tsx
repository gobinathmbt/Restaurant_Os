import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableHeader, TableCell, TableHead, TableRow } from '@/components/ui/table';
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
import BranchSearch from '@/components/common/BranchSearch';
import CategorySubcategorySearch from '@/components/common/CategorySubcategorySearch';

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
  const [itemsCategoryFilter, setItemsCategoryFilter] = useState('');
  const [itemsBranchFilter, setItemsBranchFilter] = useState<string[]>([]);
  const [itemsCategoryIdsFilter, setItemsCategoryIdsFilter] = useState<string[]>([]);
  const [itemsSubcategoryIdsFilter, setItemsSubcategoryIdsFilter] = useState<string[]>([]);
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

  useEffect(() => {
    if (selectedBranch) {
      fetchItems();
      fetchCategories();
      fetchAlertCounts();
    }
  }, [selectedBranch, itemsPage, itemsRowsPerPage, itemsSearch, itemsTypeFilter, itemsCategoryFilter, itemsBranchFilter, itemsCategoryIdsFilter, itemsSubcategoryIdsFilter]);

  const fetchItems = async () => {
    if (!selectedBranch) return;
    
    try {
      setItemsLoading(true);
      
      // Determine which branch IDs to send
      let branchIdParam = selectedBranch;
      if (itemsBranchFilter.length > 0) {
        // If branch filter is active, use filtered branches
        branchIdParam = itemsBranchFilter.join(',');
      }
      
      // Build params object
      const params: any = {
        page: itemsPage,
        limit: itemsRowsPerPage,
        search: itemsSearch || undefined,
        type: itemsTypeFilter || undefined,
        category: itemsCategoryFilter || undefined,
      };
      
      // Add category/subcategory filters if present
      if (itemsCategoryIdsFilter.length > 0) {
        params.categoryId = itemsCategoryIdsFilter.join(',');
      }
      if (itemsSubcategoryIdsFilter.length > 0) {
        params.subcategoryId = itemsSubcategoryIdsFilter.join(',');
      }
      
      const response = await inventoryServices.getInventoryItems(branchIdParam, params);

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

  const handleLowStockClick = () => {
    setItemsTypeFilter('');
    setItemsCategoryFilter('');
    setItemsSearch('');
    setItemsBranchFilter([]);
    setItemsCategoryIdsFilter([]);
    setItemsSubcategoryIdsFilter([]);
    setItemsPage(1);
  };

  const handleExpiringClick = () => {
    setItemsTypeFilter('');
    setItemsCategoryFilter('');
    setItemsSearch('');
    setItemsBranchFilter([]);
    setItemsCategoryIdsFilter([]);
    setItemsSubcategoryIdsFilter([]);
    setItemsPage(1);
  };

  const handleCategoryFilterChange = (categoryIds: string[], subcategoryIds: string[]) => {
    setItemsCategoryIdsFilter(categoryIds);
    setItemsSubcategoryIdsFilter(subcategoryIds);
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
      <div className="h-full flex flex-col bg-background">
        {/* Fixed Header */}
        <div className="bg-background border-b flex-shrink-0">
          <div className="px-6 py-3">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Stats Chips */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="px-3 py-1 text-sm">
                  Total Items: {itemsTotalCount}
                </Badge>
                <Badge 
                  variant="destructive" 
                  className="px-3 py-1 text-sm bg-red-100 text-red-800 cursor-pointer hover:opacity-80"
                  onClick={handleLowStockClick}
                >
                  Low Stock: {lowStockCount}
                </Badge>
                <Badge 
                  variant="default" 
                  className="px-3 py-1 text-sm bg-orange-100 text-orange-800 cursor-pointer hover:opacity-80"
                  onClick={handleExpiringClick}
                >
                  Expiring Soon: {expiringCount}
                </Badge>
              </div>

              {/* Search */}
              <div className="flex-1 max-w-xs">
                <Input
                  placeholder="Search items..."
                  value={itemsSearch}
                  onChange={(e) => setItemsSearch(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                {(isSuperAdmin || isMultiBranchAdmin) && (
                  <>
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
                    
                    {/* Multi-branch filter */}
                    <BranchSearch
                      selectedBranchIds={itemsBranchFilter}
                      onBranchesChange={setItemsBranchFilter}
                      placeholder="Filter by branches..."
                      showSelectAll={false}
                      className="w-64"
                    />
                  </>
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
                
                {/* Category/Subcategory filter */}
                <CategorySubcategorySearch
                  selectedCategoryIds={itemsCategoryIdsFilter}
                  selectedSubcategoryIds={itemsSubcategoryIdsFilter}
                  onCategoriesChange={handleCategoryFilterChange}
                  branchIds={itemsBranchFilter.length > 0 ? itemsBranchFilter : (selectedBranch === 'all' ? [] : [selectedBranch])}
                  className="w-64"
                />
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={fetchItems}
                disabled={itemsLoading}
                className="h-9 w-9"
              >
                <RefreshCw className={`h-4 w-4 ${itemsLoading ? 'animate-spin' : ''}`} />
              </Button>

              {/* Add Button */}
              <Button
                variant="default"
                size="icon"
                onClick={handleCreateItem}
                className="h-9 w-9"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {itemsLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No inventory items found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {itemsSearch || itemsTypeFilter || itemsCategoryFilter
                  ? 'Try adjusting your filters'
                  : 'Get started by adding your first inventory item'}
              </p>
              {!itemsSearch && !itemsTypeFilter && !itemsCategoryFilter && (
                <Button onClick={handleCreateItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 border-b">
                <TableRow>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Fixed Footer with Pagination */}
        <div className="bg-background border-t py-3 px-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            {/* Left: Rows per page */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Rows:</Label>
              <Select
                value={itemsRowsPerPage.toString()}
                onValueChange={(value) => {
                  setItemsRowsPerPage(parseInt(value));
                  setItemsPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Center: Pagination */}
            {itemsTotalPages > 0 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => itemsPage > 1 && setItemsPage(itemsPage - 1)}
                  disabled={itemsPage <= 1}
                  className="h-8 px-3"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-3">
                  Page {itemsPage} of {itemsTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => itemsPage < itemsTotalPages && setItemsPage(itemsPage + 1)}
                  disabled={itemsPage >= itemsTotalPages}
                  className="h-8 px-3"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Right: Total count */}
            <div className="text-sm text-muted-foreground">
              Total: {itemsTotalCount}
            </div>
          </div>
        </div>
      </div>

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
