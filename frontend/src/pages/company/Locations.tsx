import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Archive, MapPin, Warehouse, ChefHat, Store } from 'lucide-react';
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
import { locationServices } from '@/api/services';
import DataTableLayout from '@/components/common/DataTableLayout';
import { getStorage, setStorage } from '@/utils/storage';
import LocationFormModal from '@/components/inventory/LocationFormModal';

interface Location {
  _id: string;
  name: string;
  code: string;
  type: 'branch' | 'warehouse' | 'central_kitchen' | 'cloud_kitchen';
  capabilities: {
    canProcureDirectly: boolean;
    canDispatchStock: boolean;
    canReceiveStock: boolean;
    isProductionUnit: boolean;
    allowsCustomerOrders: boolean;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_PREFIX = 'locations_tab';

export default function LocationsTab() {
  const { toast } = useToast();

  // State management
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const saved = getStorage<number>(`${STORAGE_PREFIX}_rows_per_page`);
    return saved || 10;
  });
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filter states
  const [filterType, setFilterType] = useState<string>(() => {
    const saved = getStorage<string>(`${STORAGE_PREFIX}_filter_type`);
    return saved || 'all';
  });
  const [filterStatus, setFilterStatus] = useState<string>(() => {
    const saved = getStorage<string>(`${STORAGE_PREFIX}_filter_status`);
    return saved || 'all';
  });

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [locationToArchive, setLocationToArchive] = useState<Location | null>(null);

  // Infinite scroll states
  const [infiniteScrollPage, setInfiniteScrollPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [paginationEnabled, setPaginationEnabled] = useState(true);

  // Fetch locations on mount and when filters change
  useEffect(() => {
    if (paginationEnabled) {
      fetchLocations();
    } else {
      setLocations([]); 
      setInfiniteScrollPage(1);
      setHasMore(true);
      fetchLocationsInfinite(1, true);
    }
  }, [currentPage, rowsPerPage, searchValue, filterType, filterStatus, paginationEnabled]);

  // Save filter preferences to sessionStorage
  useEffect(() => {
    setStorage(`${STORAGE_PREFIX}_filter_type`, filterType);
  }, [filterType]);

  useEffect(() => {
    setStorage(`${STORAGE_PREFIX}_filter_status`, filterStatus);
  }, [filterStatus]);

  useEffect(() => {
    setStorage(`${STORAGE_PREFIX}_rows_per_page`, rowsPerPage);
  }, [rowsPerPage]);

  const fetchLocations = async () => {
    try {
      setIsLoading(true);
      const response = await locationServices.getLocations({
        page: currentPage,
        limit: rowsPerPage,
        search: searchValue || undefined,
        type: filterType !== 'all' ? filterType : undefined,
        isActive: filterStatus !== 'all' ? filterStatus === 'active' : undefined,
      });
      const locationsData = Array.isArray(response.data.data.data) ? response.data.data.data : [];
      setLocations(locationsData);
      setTotalCount(response.data.data.pagination?.totalRecords || 0);
      setTotalPages(response.data.data.pagination?.totalPages || 0);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to fetch locations',
        variant: 'destructive',
      });
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocationsInfinite = async (page: number, reset: boolean = false) => {
    try {
      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const response = await locationServices.getLocations({
        page: page,
        limit: 20,
        search: searchValue || undefined,
        type: filterType !== 'all' ? filterType : undefined,
        isActive: filterStatus !== 'all' ? filterStatus === 'active' : undefined,
      });

      const fetchedLocations = Array.isArray(response.data.data.data) ? response.data.data.data : [];
      const pagination = response.data.data.pagination;

      if (reset) {
        setLocations(fetchedLocations);
      } else {
        setLocations((prev) => [...(Array.isArray(prev) ? prev : []), ...fetchedLocations]);
      }

      setTotalCount(pagination?.totalRecords || 0);
      setTotalPages(pagination?.totalPages || 0);
      setHasMore(page < (pagination?.totalPages || 0));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to fetch locations',
        variant: 'destructive',
      });
      if (reset) {
        setLocations([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && !paginationEnabled) {
      const nextPage = infiniteScrollPage + 1;
      setInfiniteScrollPage(nextPage);
      fetchLocationsInfinite(nextPage, false);
    }
  };

  const handleCreateLocation = () => {
    setSelectedLocationId('');
    setIsFormOpen(true);
  };

  const handleEditLocation = (locationId: string) => {
    setSelectedLocationId(locationId);
    setIsFormOpen(true);
  };

  const handleArchiveClick = (location: Location) => {
    setLocationToArchive(location);
    setIsArchiveDialogOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (!locationToArchive) return;

    try {
      await locationServices.archiveLocation(locationToArchive._id);
      toast({
        title: 'Success',
        description: `Location "${locationToArchive.name}" has been archived successfully`,
      });
      setIsArchiveDialogOpen(false);
      setLocationToArchive(null);
      handleRefresh();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to archive location',
        variant: 'destructive',
      });
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedLocationId('');
    handleRefresh();
  };

  const handleRefresh = () => {
    if (paginationEnabled) {
      fetchLocations();
    } else {
      setLocations([]);
      setInfiniteScrollPage(1);
      setHasMore(true);
      fetchLocationsInfinite(1, true);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRowsPerPageChange = (rows: number) => {
    setRowsPerPage(rows);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    setCurrentPage(1);
  };

  const handlePaginationChange = (enabled: boolean) => {
    setPaginationEnabled(enabled);
    if (enabled) {
      setCurrentPage(1);
    }
  };

  // Get location type icon
  const getLocationTypeIcon = (type: string) => {
    switch (type) {
      case 'branch':
        return <Store className="h-4 w-4" />;
      case 'warehouse':
        return <Warehouse className="h-4 w-4" />;
      case 'central_kitchen':
        return <ChefHat className="h-4 w-4" />;
      case 'cloud_kitchen':
        return <ChefHat className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
  };

  // Get location type badge variant
  const getLocationTypeBadgeColor = (type: string): string => {
    switch (type) {
      case 'branch':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'warehouse':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'central_kitchen':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'cloud_kitchen':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  // Get location type display name
  const getLocationTypeDisplay = (type: string) => {
    switch (type) {
      case 'branch':
        return 'Branch';
      case 'warehouse':
        return 'Warehouse';
      case 'central_kitchen':
        return 'Central Kitchen';
      case 'cloud_kitchen':
        return 'Cloud Kitchen';
      default:
        return type;
    }
  };

  // Get capability icons
  const getCapabilityBadges = (capabilities: Location['capabilities']) => {
    const badges = [];
    if (capabilities.canProcureDirectly) {
      badges.push(
        <TooltipProvider key="procure">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                📦
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Can Procure Directly</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    if (capabilities.canDispatchStock) {
      badges.push(
        <TooltipProvider key="dispatch">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                📤
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Can Dispatch Stock</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    if (capabilities.canReceiveStock) {
      badges.push(
        <TooltipProvider key="receive">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                📥
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Can Receive Stock</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    if (capabilities.isProductionUnit) {
      badges.push(
        <TooltipProvider key="production">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                🏭
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Production Unit</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    if (capabilities.allowsCustomerOrders) {
      badges.push(
        <TooltipProvider key="orders">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                🛒
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Allows Customer Orders</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return badges;
  };

  // Calculate stat chips
  const statChips = useMemo(() => {
    const locationsArray = Array.isArray(locations) ? locations : [];
    const activeCount = locationsArray.filter((l) => l.isActive).length;
    const branchCount = locationsArray.filter((l) => l.type === 'branch').length;
    const warehouseCount = locationsArray.filter((l) => l.type === 'warehouse').length;
    const centralKitchenCount = locationsArray.filter((l) => l.type === 'central_kitchen').length;
    const cloudKitchenCount = locationsArray.filter((l) => l.type === 'cloud_kitchen').length;

    return [
      { label: 'Total', value: totalCount, variant: 'default' as const },
      { label: 'Active', value: activeCount, variant: 'default' as const },
      { label: 'Branches', value: branchCount, variant: 'outline' as const },
      { label: 'Warehouses', value: warehouseCount, variant: 'outline' as const },
      { label: 'Central Kitchens', value: centralKitchenCount, variant: 'outline' as const },
      { label: 'Cloud Kitchens', value: cloudKitchenCount, variant: 'outline' as const },
    ];
  }, [locations, totalCount]);

  // Action buttons
  const actionButtons = [
    {
      icon: <Plus className="h-4 w-4" />,
      tooltip: 'Create Location',
      onClick: handleCreateLocation,
      variant: 'default' as const,
    },
  ];

  // Filter component
  const filterConfig = {
    component: (
      <div className="flex items-center gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-9 w-[180px]" aria-label="Filter by location type">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="branch">Branch</SelectItem>
            <SelectItem value="warehouse">Warehouse</SelectItem>
            <SelectItem value="central_kitchen">Central Kitchen</SelectItem>
            <SelectItem value="cloud_kitchen">Cloud Kitchen</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by status">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    ),
  };

  // Table headers
  const tableHeaders = (
    <>
      <TableHead className="w-16">S.No</TableHead>
      <TableHead>Name</TableHead>
      <TableHead>Code</TableHead>
      <TableHead>Type</TableHead>
      <TableHead>Capabilities</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </>
  );

  // Table body
  const tableBody = (Array.isArray(locations) ? locations : []).map((location, index) => {
    // Calculate serial number based on pagination mode
    const serialNumber = paginationEnabled 
      ? (currentPage - 1) * rowsPerPage + index + 1
      : index + 1;
    
    return (
    <TableRow key={location._id}>
      <TableCell className="font-medium text-muted-foreground">
        {serialNumber}
      </TableCell>
      <TableCell className="font-medium">{location.name}</TableCell>
      <TableCell>
        <code className="text-xs bg-muted px-2 py-1 rounded">{location.code}</code>
      </TableCell>
      <TableCell>
        <Badge className={`flex items-center gap-1 w-fit ${getLocationTypeBadgeColor(location.type)}`}>
          {getLocationTypeIcon(location.type)}
          {getLocationTypeDisplay(location.type)}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 flex-wrap">
          {getCapabilityBadges(location.capabilities)}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={location.isActive ? 'default' : 'secondary'}>
          {location.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditLocation(location._id)}
                  className="h-8 w-8"
                  aria-label={`Edit ${location.name}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit Location</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleArchiveClick(location)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label={`Archive ${location.name}`}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Archive Location</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </TableCell>
    </TableRow>
    );
  });

  // Empty state
  const emptyState = {
    icon: <MapPin className="h-12 w-12" />,
    title: 'No locations found',
    description: searchValue
      ? `No locations match your search "${searchValue}"`
      : 'Get started by creating your first location',
    action: !searchValue ? (
      <Button onClick={handleCreateLocation}>
        <Plus className="mr-2 h-4 w-4" />
        Create Location
      </Button>
    ) : undefined,
  };

  return (
    <>
        <div className="h-[calc(100vh-4rem)] -m-6 flex flex-col overflow-hidden">

      <DataTableLayout
        statChips={statChips}
        actionButtons={actionButtons}
        searchValue={searchValue}
        searchPlaceholder="Search locations by name or code..."
        onSearchChange={handleSearchChange}
        filterConfig={filterConfig}
        tableHeaders={tableHeaders}
        tableBody={tableBody}
        isLoading={isLoading}
        emptyState={locations.length === 0 ? emptyState : undefined}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        rowsPerPage={rowsPerPage}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
        onRefresh={handleRefresh}
        storagePrefix={STORAGE_PREFIX}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onPaginationChange={handlePaginationChange}
      />

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive "{locationToArchive?.name}"?
              <br />
              <br />
              <strong>Location Code:</strong> {locationToArchive?.code}
              <br />
              <strong>Type:</strong> {locationToArchive && getLocationTypeDisplay(locationToArchive.type)}
              <br />
              <br />
              This action will deactivate the location. You can reactivate it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Location Form Modal */}
      <LocationFormModal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedLocationId('');
        }}
        locationId={selectedLocationId}
        onSuccess={handleFormSuccess}
      />
      </div>
    </>
  );
}
