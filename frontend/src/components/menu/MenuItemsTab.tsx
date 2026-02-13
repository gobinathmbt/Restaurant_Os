import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Image as ImageIcon, Settings, UtensilsCrossed } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { menuItemBranchServices, menuCategoryServices, menuItemServices } from '@/api/services';
import { useLoading } from '@/contexts/LoadingContext';
import { useAuth } from '@/contexts/AuthContext';
import DataTableLayout from '@/components/common/DataTableLayout';
import MenuItemFormModal from '@/components/menu/MenuItemFormModal';
import BranchConfigModal from '@/components/menu/BranchConfigModal';
import ImageGalleryModal from '@/components/menu/ImageGalleryModal';
import { ProxiedImage } from '@/components/common/ProxiedImage';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface MenuCategory {
  _id: string;
  name: string;
  color?: string;
}

interface ModifierOption {
  name: string;
  price: number;
}

interface Modifier {
  name: string;
  options: ModifierOption[];
}

interface AddOn {
  name: string;
  price: number;
}

interface TimeBasedPricing {
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
  price: number;
  isActive: boolean;
}

interface AvailabilitySchedule {
  startTime: string;
  endTime: string;
  days: string[];
}

interface MergedMenuItem {
  _id: string;
  name: string;
  description?: string;
  category: MenuCategory;
  basePrice: number;
  images: Array<{
    url: string;
    displayOrder: number;
  }>;
  isVeg: boolean;
  spiceLevel: string;
  modifiers: Modifier[];
  addOns: AddOn[];
  tags: string[];
  hsnCode?: string;
  branchConfig: {
    price: number;
    effectivePrice: number;
    timeBasedPricing: TimeBasedPricing[];
    isAvailable: boolean;
    availability: {
      schedule: AvailabilitySchedule[];
    };
    outOfStock: boolean;
    preparationTime: number;
    requiresKitchen: boolean;
    lowStockThreshold?: number;
    taxRateOverride?: number;
    displayOrder: number;
    channels: string[];
    // NEW: Branch-specific modifiers and add-ons
    modifiers?: Modifier[];
    addOns?: string[]; // Array of MenuItem IDs (new format)
  };
  branches?: Array<{
    _id: string;
    branch: {
      _id: string;
      name: string;
      code: string;
    };
    price: number;
    isAvailable: boolean;
    preparationTime: number;
    requiresKitchen: boolean;
    outOfStock: boolean;
    lowStockThreshold?: number;
    taxRateOverride?: number;
    displayOrder: number;
    channels: string[];
    timeBasedPricing: TimeBasedPricing[];
    availability: {
      schedule: AvailabilitySchedule[];
    };
  }>;
  isActive: boolean;
}

interface MenuItemsTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
}

export default function MenuItemsTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
}: MenuItemsTabProps) {
  const { setLoading, setLoadingMessage } = useLoading();
  const { toast } = useToast();
  const { user } = useAuth();

  // State
  const [menuItems, setMenuItems] = useState<MergedMenuItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  
  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MergedMenuItem | null>(null);
  console.log(selectedMenuItem)
  const [isBranchConfigModalOpen, setIsBranchConfigModalOpen] = useState(false);
  const [isImageGalleryOpen, setIsImageGalleryOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MergedMenuItem | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Infinite scroll
  const [infiniteScrollPage, setInfiniteScrollPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [paginationEnabled, setPaginationEnabled] = useState(true);

  // Stats
  const [activeCount, setActiveCount] = useState(0);
  const [unavailableCount, setUnavailableCount] = useState(0);

  // Fetch menu items when dependencies change
  useEffect(() => {
    if (selectedBranch) {
      if (paginationEnabled) {
        fetchMenuItems();
      } else {
        setMenuItems([]);
        setInfiniteScrollPage(1);
        setHasMore(true);
        fetchMenuItemsInfinite(1, true);
      }
    }
  }, [
    selectedBranch,
    currentPage,
    rowsPerPage,
    searchValue,
    categoryFilter,
    availabilityFilter,
    paginationEnabled,
  ]);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchMenuItems = async () => {
    if (!selectedBranch || !paginationEnabled) return;

    try {
      setIsLoadingItems(true);

      const params: any = {
        page: currentPage,
        limit: rowsPerPage,
        search: searchValue || undefined,
        categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
      };

      let response;
      if (selectedBranch === 'all') {
        // Fetch all menu items (global view without branch-specific data)
        response = await menuItemServices.getMenuItems(params);
        const items = response.data.data.menuItems || [];
        
        // Transform items to match MergedMenuItem structure with default branch config
        const transformedItems = items.map((item: any) => ({
          ...item,
          branchConfig: {
            price: item.basePrice,
            effectivePrice: item.basePrice,
            timeBasedPricing: [],
            isAvailable: true,
            availability: { schedule: [] },
            outOfStock: false,
            preparationTime: 15,
            requiresKitchen: true,
            displayOrder: 0,
            channels: ['dine_in', 'takeaway', 'online'],
          },
        }));
        
        setMenuItems(transformedItems);
        setTotalCount(response.data.data.pagination.total);
        setTotalPages(response.data.data.pagination.pages);
        
        // Calculate stats
        const active = transformedItems.filter((item: MergedMenuItem) => item.isActive).length;
        setActiveCount(active);
        setUnavailableCount(0); // No branch-specific availability in "all" view
      } else {
        // Fetch branch-specific menu items
        response = await menuItemBranchServices.getMenuItemsForBranch(
          selectedBranch,
          params
        );

        const items = response.data.data.menuItems || [];
        setMenuItems(items);
        setTotalCount(response.data.data.pagination.total);
        setTotalPages(response.data.data.pagination.pages);

        // Calculate stats
        const active = items.filter((item: MergedMenuItem) => item.isActive).length;
        const unavailable = items.filter(
          (item: MergedMenuItem) => !item.branchConfig.isAvailable || item.branchConfig.outOfStock
        ).length;
        setActiveCount(active);
        setUnavailableCount(unavailable);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to fetch menu items',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingItems(false);
    }
  };

  const fetchMenuItemsInfinite = async (page: number, reset: boolean = false) => {
    if (!selectedBranch) return;

    try {
      if (reset) {
        setIsLoadingItems(true);
      } else {
        setIsLoadingMore(true);
      }

      const params: any = {
        page: page,
        limit: 20,
        search: searchValue || undefined,
        categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
      };

      let response;
      let fetchedItems;
      
      if (selectedBranch === 'all') {
        // Fetch all menu items (global view without branch-specific data)
        response = await menuItemServices.getMenuItems(params);
        const items = response.data.data.menuItems || [];
        
        // Transform items to match MergedMenuItem structure with default branch config
        fetchedItems = items.map((item: any) => ({
          ...item,
          branchConfig: {
            price: item.basePrice,
            effectivePrice: item.basePrice,
            timeBasedPricing: [],
            isAvailable: true,
            availability: { schedule: [] },
            outOfStock: false,
            preparationTime: 15,
            requiresKitchen: true,
            displayOrder: 0,
            channels: ['dine_in', 'takeaway', 'online'],
          },
        }));
      } else {
        // Fetch branch-specific menu items
        response = await menuItemBranchServices.getMenuItemsForBranch(
          selectedBranch,
          params
        );
        fetchedItems = response.data.data.menuItems || [];
      }

      const pagination = response.data.data.pagination;

      if (reset) {
        setMenuItems(fetchedItems);
      } else {
        setMenuItems((prev) => [...prev, ...fetchedItems]);
      }

      setTotalCount(pagination.total);
      setTotalPages(pagination.pages);
      setHasMore(page < pagination.pages);

      // Calculate stats
      const allItems = reset ? fetchedItems : [...menuItems, ...fetchedItems];
      const active = allItems.filter((item: MergedMenuItem) => item.isActive).length;
      
      if (selectedBranch === 'all') {
        setActiveCount(active);
        setUnavailableCount(0); // No branch-specific availability in "all" view
      } else {
        const unavailable = allItems.filter(
          (item: MergedMenuItem) => !item.branchConfig.isAvailable || item.branchConfig.outOfStock
        ).length;
        setActiveCount(active);
        setUnavailableCount(unavailable);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to fetch menu items',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingItems(false);
      setIsLoadingMore(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await menuCategoryServices.getMenuCategories({
        limit: 1000,
        isActive: true,
      });
      setCategories(response.data.data.categories || []);
    } catch (error: any) {
      // Silently fail for categories
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && !paginationEnabled) {
      const nextPage = infiniteScrollPage + 1;
      setInfiniteScrollPage(nextPage);
      fetchMenuItemsInfinite(nextPage, false);
    }
  };

  const handleAddMenuItem = () => {
    setSelectedMenuItem(null);
    setIsFormModalOpen(true);
  };

  const handleEditMenuItem = async (item: MergedMenuItem) => {
    try {
      setLoading(true);
      setLoadingMessage('Loading menu item details...');
      
      // Fetch full menu item details with branch configurations
      const response = await menuItemServices.getMenuItemById(item._id);
      const menuItemWithBranches = response.data.data.menuItem;
      
      setSelectedMenuItem({
        ...item,
        branches: menuItemWithBranches.branches || []
      });
      setIsFormModalOpen(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load menu item details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleConfigureBranch = async (item: MergedMenuItem) => {
    try {
      setLoading(true);
      setLoadingMessage('Loading menu item details...');
      
      // Fetch full menu item details with branch configurations
      const response = await menuItemServices.getMenuItemById(item._id);
      const menuItemWithBranches = response.data.data.menuItem;
      
      setSelectedMenuItem({
        ...item,
        branches: menuItemWithBranches.branches || []
      });
      setIsBranchConfigModalOpen(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load menu item details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleManageImages = (item: MergedMenuItem) => {
    setSelectedMenuItem(item);
    setIsImageGalleryOpen(true);
  };

  const handleDeleteMenuItem = (item: MergedMenuItem) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      setLoading(true);
      setLoadingMessage('Deleting menu item...');

      await menuItemServices.deleteMenuItem(itemToDelete._id);

      toast({
        title: 'Success',
        description: 'Menu item deleted successfully',
      });

      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      handleRefresh();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete menu item',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleFormSuccess = () => {
    setIsFormModalOpen(false);
    setSelectedMenuItem(null);
    handleRefresh();
  };

  const handleBranchConfigSuccess = () => {
    setIsBranchConfigModalOpen(false);
    setSelectedMenuItem(null);
    handleRefresh();
  };

  const handleImageGalleryUpdate = () => {
    handleRefresh();
  };

  const handleRefresh = () => {
    if (paginationEnabled) {
      fetchMenuItems();
    } else {
      setMenuItems([]);
      setInfiniteScrollPage(1);
      setHasMore(true);
      fetchMenuItemsInfinite(1, true);
    }
  };

  const formatPrice = (price: number) => {
    return `₹${price.toFixed(2)}`;
  };

  const getSpiceLevelBadge = (level: string) => {
    const levels: Record<string, { label: string; variant: any }> = {
      none: { label: 'No Spice', variant: 'secondary' },
      mild: { label: 'Mild', variant: 'outline' },
      medium: { label: 'Medium', variant: 'default' },
      hot: { label: 'Hot', variant: 'destructive' },
      extra_hot: { label: 'Extra Hot', variant: 'destructive' },
    };
    return levels[level] || levels.none;
  };

  return (
    <div className="h-full flex flex-col">
      <DataTableLayout
        statChips={[
          { label: 'Total Items', value: totalCount, variant: 'default' },
          { label: 'Active', value: activeCount, variant: 'default' },
          { label: 'Unavailable', value: unavailableCount, variant: 'destructive' },
        ]}
        actionButtons={[
          {
            icon: <Plus className="h-4 w-4" />,
            tooltip: 'Add menu item',
            onClick: handleAddMenuItem,
            variant: 'default',
          },
        ]}
        searchValue={searchValue}
        searchPlaceholder="Search menu items..."
        onSearchChange={setSearchValue}
        filterConfig={{
          component: (
            <div className="flex items-center gap-2">
              {(isSuperAdmin || isMultiBranchAdmin) && branches.length > 0 && (
                <Select value={selectedBranch} onValueChange={onBranchChange}>
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch._id} value={branch._id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select
                value={categoryFilter}
                onValueChange={(value) => {
                  setCategoryFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-48 h-9">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category._id} value={category._id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={availabilityFilter}
                onValueChange={(value) => {
                  setAvailabilityFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="All items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ),
        }}
        tableHeaders={
          <>
            <TableHead className="w-16">S.No</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Spice Level</TableHead>
            <TableHead>Availability</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </>
        }
        tableBody={
          <>
            {menuItems
              .filter((item) => {
                if (availabilityFilter === 'available') {
                  return item.branchConfig.isAvailable && !item.branchConfig.outOfStock;
                }
                if (availabilityFilter === 'unavailable') {
                  return !item.branchConfig.isAvailable || item.branchConfig.outOfStock;
                }
                return true;
              })
              .map((item, index) => {
                const serialNumber = paginationEnabled
                  ? (currentPage - 1) * rowsPerPage + index + 1
                  : index + 1;

                const isAvailable =
                  item.branchConfig.isAvailable && !item.branchConfig.outOfStock;

                return (
                  <TableRow key={item._id}>
                    <TableCell className="font-medium text-muted-foreground">
                      {serialNumber}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.images && item.images.length > 0 ? (
                          <ProxiedImage
                            src={item.images[0]?.url}
                            alt={item.name}
                            className="w-10 h-10 rounded object-cover"
                            fallback="/placeholder.svg"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {item.description}
                            </p>
                          )}
                          {/* Branch-specific indicators */}
                          {selectedBranch !== 'all' && (
                            <div className="flex items-center gap-1 mt-1">
                              {item.branchConfig.modifiers && item.branchConfig.modifiers.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {item.branchConfig.modifiers.length} Modifier{item.branchConfig.modifiers.length !== 1 ? 's' : ''}
                                </Badge>
                              )}
                              {item.branchConfig.addOns && item.branchConfig.addOns.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {item.branchConfig.addOns.length} Add-on{item.branchConfig.addOns.length !== 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: item.category.color
                            ? `${item.category.color}20`
                            : undefined,
                          borderColor: item.category.color,
                          color: item.category.color,
                        }}
                      >
                        {item.category.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <p className="font-medium">
                          {formatPrice(item.branchConfig.effectivePrice)}
                        </p>
                        {item.branchConfig.price !== item.basePrice && (
                          <p className="text-xs text-muted-foreground">
                            Base: {formatPrice(item.basePrice)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isVeg ? 'default' : 'destructive'}>
                        {item.isVeg ? 'Veg' : 'Non-Veg'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.spiceLevel && item.spiceLevel !== 'none' && (
                        <Badge variant={getSpiceLevelBadge(item.spiceLevel).variant}>
                          {getSpiceLevelBadge(item.spiceLevel).label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={isAvailable ? 'default' : 'secondary'}>
                          {isAvailable ? 'Available' : 'Unavailable'}
                        </Badge>
                        {item.branchConfig.outOfStock && (
                          <Badge variant="destructive" className="text-xs">
                            Out of Stock
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? 'default' : 'secondary'}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditMenuItem(item)}
                          title="Edit menu item"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {selectedBranch !== 'all' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleConfigureBranch(item)}
                            title="Configure branch settings"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleManageImages(item)}
                          title="Manage images"
                        >
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMenuItem(item)}
                          title="Delete menu item"
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
        isLoading={isLoadingItems}
        emptyState={
          menuItems.length === 0
            ? {
                icon: <UtensilsCrossed className="h-12 w-12" />,
                title: 'No menu items found',
                description:
                  searchValue || categoryFilter !== 'all' || availabilityFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : selectedBranch === 'all'
                    ? 'No menu items have been created yet'
                    : 'Get started by adding your first menu item',
                action:
                  selectedBranch !== 'all' &&
                  !searchValue &&
                  categoryFilter === 'all' &&
                  availabilityFilter === 'all' ? (
                    <Button onClick={handleAddMenuItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Menu Item
                    </Button>
                  ) : undefined,
              }
            : undefined
        }
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={(rows) => {
          setRowsPerPage(rows);
          setCurrentPage(1);
        }}
        onRefresh={handleRefresh}
        storagePrefix="menu-items"
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onPaginationChange={(enabled) => setPaginationEnabled(enabled)}
      />

      {/* Menu Item Form Modal */}
      <MenuItemFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedMenuItem(null);
        }}
        menuItem={selectedMenuItem ? {
          _id: selectedMenuItem._id,
          name: selectedMenuItem.name,
          description: selectedMenuItem.description,
          category: typeof selectedMenuItem.category === 'string' 
            ? selectedMenuItem.category 
            : selectedMenuItem.category._id,
          basePrice: selectedMenuItem.basePrice,
          isVeg: selectedMenuItem.isVeg,
          spiceLevel: selectedMenuItem.spiceLevel,
          modifiers: selectedMenuItem.modifiers || [],
          addOns: selectedMenuItem.addOns || [],
          tags: selectedMenuItem.tags || [],
          hsnCode: selectedMenuItem.hsnCode,
          branches: selectedMenuItem.branches || [],
        } : null}
        onSuccess={handleFormSuccess}
        categories={categories}
        branches={branches}
        userBranchIds={isSuperAdmin ? null : (user?.branchIds || [])}
      />

      {/* Branch Configuration Modal */}
      {selectedMenuItem && selectedBranch && selectedBranch !== 'all' && (() => {
        
        const branch = branches.find((b) => b._id === selectedBranch);
        if (!branch) return null;
        
        // Find the MenuItemBranch ID from the branches array
        // This is the actual document ID we need for the API call
        const menuItemBranch = selectedMenuItem.branches?.find(
          (b) => b.branch._id === selectedBranch
        );
        const menuItemBranchId = menuItemBranch?._id;
        
        console.log('BranchConfigModal props:', {
          menuItemId: selectedMenuItem._id,
          branchId: selectedBranch,
          menuItemBranchId: menuItemBranchId,
          branch: branch
        });
        
        return (
          <BranchConfigModal
            isOpen={isBranchConfigModalOpen}
            onClose={() => {
              setIsBranchConfigModalOpen(false);
              setSelectedMenuItem(null);
            }}
            branch={branch}
            config={selectedMenuItem.branchConfig}
            onChange={async (config) => {
              console.log('=== MenuItemsTab onChange called ===');
              console.log('Config received:', config);
              console.log('Config.modifiers:', config.modifiers);
              console.log('Config.addOns:', config.addOns);
              
              // Update the branch configuration IMMEDIATELY
              try {
                console.log('Calling updateBranchConfig with:', {
                  menuItemId: selectedMenuItem._id,
                  branchId: selectedBranch,
                  config: config
                });
                
                setLoading(true);
                setLoadingMessage('Saving branch configuration...');
                
                const response = await menuItemBranchServices.updateBranchConfig(
                  selectedMenuItem._id,
                  selectedBranch,
                  config
                );
                
                console.log('updateBranchConfig successful, response:', response);
                
                toast({
                  title: 'Success',
                  description: 'Branch configuration updated successfully',
                  variant: 'success',
                });
                handleBranchConfigSuccess();
              } catch (error: any) {
                console.error('updateBranchConfig error:', error);
                toast({
                  title: 'Error',
                  description: error.response?.data?.message || 'Failed to update branch configuration',
                  variant: 'destructive',
                });
              } finally {
                setLoading(false);
                setLoadingMessage('');
              }
            }}
            isEditable={true}
            menuItemId={selectedMenuItem._id}
            menuItemBranchId={menuItemBranchId}
          />
        );
      })()}

      {/* Image Gallery Modal */}
      {selectedMenuItem && (
        <ImageGalleryModal
          isOpen={isImageGalleryOpen}
          onClose={() => {
            setIsImageGalleryOpen(false);
            setSelectedMenuItem(null);
          }}
          menuItemId={selectedMenuItem._id}
          images={selectedMenuItem.images || []}
          onUpdate={handleImageGalleryUpdate}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete "{itemToDelete?.name}" from the menu. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
