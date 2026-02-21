import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, X, MapPin, Warehouse, ChefHat, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { locationServices } from '@/api/services';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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
}

interface LocationSelectorProps {
  selectedLocationIds: string[];
  onLocationsChange: (locationIds: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  showSelectAll?: boolean;
  className?: string;
  singleSelect?: boolean;
  autoSelectSingleLocation?: boolean;
  filterByCapability?: 'canProcureDirectly' | 'canDispatchStock' | 'canReceiveStock' | 'isProductionUnit' | 'allowsCustomerOrders';
}

export default function LocationSelector({
  selectedLocationIds,
  onLocationsChange,
  disabled = false,
  placeholder = 'Select locations...',
  showSelectAll = false,
  className = '',
  singleSelect = false,
  autoSelectSingleLocation = false,
  filterByCapability,
}: LocationSelectorProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Two separate states: one for initial load, one for search results
  const [initialLocations, setInitialLocations] = useState<Location[]>([]);
  const [searchLocations, setSearchLocations] = useState<Location[]>([]);
  
  // Determine which locations to display
  const displayLocations = searchQuery ? searchLocations : initialLocations;

  // Get user's accessible location IDs (support both locationIds and branchIds for backward compatibility)
  const userAccessibleLocationIds = user?.locationIds || user?.branchIds || [];
  
  // Check if user is single-location admin
  const isSingleLocationAdmin = user?.role === 'company_admin' && userAccessibleLocationIds.length === 1;
  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');

  // Fetch initial locations on mount (limit 50)
  useEffect(() => {
    if (open && initialLocations.length === 0) {
      fetchInitialLocations();
    }
  }, [open]);

  // Auto-select single location for single-location admins (runs on mount and when user changes)
  useEffect(() => {
    if (autoSelectSingleLocation && isSingleLocationAdmin && userAccessibleLocationIds.length === 1) {
      const userLocationId = userAccessibleLocationIds[0];
      // Only update if not already selected
      if (selectedLocationIds.length === 0 || selectedLocationIds[0] !== userLocationId) {
        onLocationsChange([userLocationId]);
        // Fetch initial locations to populate the display name
        if (initialLocations.length === 0) {
          fetchInitialLocations();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectSingleLocation, userAccessibleLocationIds]);

  // Fetch locations when search query changes (direct API call, no debounce)
  useEffect(() => {
    if (searchQuery) {
      fetchSearchLocations(searchQuery);
    }
  }, [searchQuery]);

  const fetchInitialLocations = async () => {
    try {
      setLoading(true);
      const response = await locationServices.getLocations({
        limit: 50,
        isActive: true,
        capability: filterByCapability,
      });
      let locations = response.data.data.locations || [];
      
      // Filter locations based on user role (support both locationIds and branchIds)
      if (!isSuperAdmin && userAccessibleLocationIds.length > 0) {
        locations = locations.filter((location: Location) => userAccessibleLocationIds.includes(location._id));
      }
      
      setInitialLocations(locations);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch locations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSearchLocations = async (search: string) => {
    try {
      setLoading(true);
      const response = await locationServices.getLocations({
        limit: 50,
        isActive: true,
        search,
        capability: filterByCapability,
      });
      let locations = response.data.data.locations || [];
      
      // Filter locations based on user role (support both locationIds and branchIds)
      if (!isSuperAdmin && userAccessibleLocationIds.length > 0) {
        locations = locations.filter((location: Location) => userAccessibleLocationIds.includes(location._id));
      }
      
      setSearchLocations(locations);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to search locations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLocationToggle = (locationId: string) => {
    if (singleSelect) {
      // Single select mode: replace selection and close popover
      onLocationsChange([locationId]);
      setOpen(false);
    } else {
      // Multi-select mode: toggle selection
      const newSelection = selectedLocationIds.includes(locationId)
        ? selectedLocationIds.filter((id) => id !== locationId)
        : [...selectedLocationIds, locationId];
      onLocationsChange(newSelection);
    }
  };

  const handleRemoveLocation = (locationId: string) => {
    onLocationsChange(selectedLocationIds.filter((id) => id !== locationId));
  };

  const handleSelectAll = () => {
    if (selectedLocationIds.length === displayLocations.length) {
      onLocationsChange([]);
    } else {
      onLocationsChange(displayLocations.map((l) => l._id));
    }
  };

  // Get selected locations from both initial and search results
  const getSelectedLocations = (): Location[] => {
    const allLocations = [...initialLocations];
    
    // Add search locations that aren't already in initial locations
    searchLocations.forEach((searchLocation) => {
      if (!allLocations.find((l) => l._id === searchLocation._id)) {
        allLocations.push(searchLocation);
      }
    });

    return allLocations.filter((location) => selectedLocationIds.includes(location._id));
  };

  const selectedLocations = getSelectedLocations();

  // Get location type icon
  const getLocationTypeIcon = (type: string) => {
    switch (type) {
      case 'branch':
        return <Store className="h-3 w-3" />;
      case 'warehouse':
        return <Warehouse className="h-3 w-3" />;
      case 'central_kitchen':
        return <ChefHat className="h-3 w-3" />;
      case 'cloud_kitchen':
        return <ChefHat className="h-3 w-3" />;
      default:
        return <MapPin className="h-3 w-3" />;
    }
  };

  // Get location type badge color
  const getLocationTypeBadgeVariant = (type: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (type) {
      case 'branch':
        return 'default'; // blue
      case 'warehouse':
        return 'secondary'; // purple
      case 'central_kitchen':
        return 'outline'; // orange
      case 'cloud_kitchen':
        return 'outline'; // teal
      default:
        return 'default';
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
  const getCapabilityIcons = (capabilities: Location['capabilities']) => {
    const icons = [];
    if (capabilities.canProcureDirectly) {
      icons.push(
        <span key="procure" className="text-xs text-muted-foreground" title="Can Procure Directly">
          📦
        </span>
      );
    }
    if (capabilities.canDispatchStock) {
      icons.push(
        <span key="dispatch" className="text-xs text-muted-foreground" title="Can Dispatch Stock">
          📤
        </span>
      );
    }
    if (capabilities.canReceiveStock) {
      icons.push(
        <span key="receive" className="text-xs text-muted-foreground" title="Can Receive Stock">
          📥
        </span>
      );
    }
    if (capabilities.isProductionUnit) {
      icons.push(
        <span key="production" className="text-xs text-muted-foreground" title="Production Unit">
          🏭
        </span>
      );
    }
    if (capabilities.allowsCustomerOrders) {
      icons.push(
        <span key="orders" className="text-xs text-muted-foreground" title="Allows Customer Orders">
          🛒
        </span>
      );
    }
    return icons;
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-label={placeholder}
              className="w-full justify-between"
              disabled={disabled || (autoSelectSingleLocation && isSingleLocationAdmin)}
            >
              {selectedLocationIds.length > 0
                ? singleSelect
                  ? selectedLocations[0]?.name || placeholder
                  : `${selectedLocationIds.length} location${selectedLocationIds.length > 1 ? 's' : ''} selected`
                : placeholder}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-full p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search locations..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                aria-label="Search locations"
              />
              <CommandEmpty>
                {loading
                  ? 'Searching...'
                  : searchQuery
                    ? `No locations found matching "${searchQuery}"`
                    : 'No locations available'}
              </CommandEmpty>
              <CommandList>
                <CommandGroup>
                  {showSelectAll && !singleSelect && displayLocations.length > 0 && (
                    <CommandItem 
                      onSelect={handleSelectAll} 
                      className="font-medium"
                      aria-label={`Select all ${displayLocations.length} locations`}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedLocationIds.length === displayLocations.length
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      Select All ({displayLocations.length})
                    </CommandItem>
                  )}
                  {loading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Loading locations...
                    </div>
                  ) : (
                    displayLocations.map((location) => (
                      <CommandItem
                        key={location._id}
                        value={`${location.name} ${location.code}`}
                        onSelect={() => handleLocationToggle(location._id)}
                        aria-label={`${location.name} (${location.code})`}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedLocationIds.includes(location._id) ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{location.name}</span>
                            <Badge 
                              variant={getLocationTypeBadgeVariant(location.type)} 
                              className="flex items-center gap-1 text-xs shrink-0"
                            >
                              {getLocationTypeIcon(location.type)}
                              {getLocationTypeDisplay(location.type)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{location.code}</span>
                            <div className="flex items-center gap-1">
                              {getCapabilityIcons(location.capabilities)}
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
                {displayLocations.length >= 50 && !loading && (
                  <div className="px-2 py-1.5 text-xs text-amber-600 border-t">
                    {searchQuery
                      ? 'Showing first 50 results. Refine your search for more specific results.'
                      : 'Showing first 50 locations. Use search to find more.'}
                  </div>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected Locations Display */}
      {!singleSelect && selectedLocations.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/50">
          {selectedLocations.map((location) => (
            <Badge key={location._id} variant="secondary" className="gap-1 flex items-center">
              {getLocationTypeIcon(location.type)}
              <span>{location.name} ({location.code})</span>
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => !disabled && handleRemoveLocation(location._id)}
                aria-label={`Remove ${location.name}`}
              />
            </Badge>
          ))}
        </div>
      )}

      {/* Info message */}
      {!singleSelect && (
        <p className="text-sm text-muted-foreground">
          {selectedLocationIds.length > 0
            ? `${selectedLocationIds.length} location${selectedLocationIds.length !== 1 ? 's' : ''} selected`
            : 'Please select at least one location'}
        </p>
      )}
      
      {/* Single-location admin info */}
      {autoSelectSingleLocation && isSingleLocationAdmin && (
        <p className="text-xs text-muted-foreground">
          Location is automatically selected based on your access
        </p>
      )}
    </div>
  );
}
