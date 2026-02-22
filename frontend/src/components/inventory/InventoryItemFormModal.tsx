import { useState, useEffect } from 'react';
import { Copy, ClipboardPaste, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { inventoryServices, supplierServices, inventoryItemLocationServices, locationServices } from '@/api/services';
import LocationSearch from '@/components/common/BranchSearch';
import CategorySubcategorySearch from '@/components/common/CategorySubcategorySearch';
import InventoryLocationConfigModal from './InventoryLocationConfigModal';
import { cn } from '@/lib/utils';

interface InventoryItemFormModalProps {
  open: boolean;
  onClose: () => void;
  item: any | null;
  locationId: string;
  onSuccess: () => void;
}

interface Supplier {
  _id: string;
  name: string;
}

interface Location {
  _id: string;
  name: string;
  code: string;
}

interface LocationConfig {
  availableQuantity: number;
  reservedQuantity: number;
  inTransitQuantity: number;
  minimumStock: number;
  maximumStock?: number;
  reorderPoint?: number;
  costingMethod: 'FIFO' | 'WEIGHTED_AVERAGE' | 'STANDARD_COST';
  standardCost?: number;
  lastPurchasePrice?: number;
  lastPurchaseDate?: Date;
  supplier?: string;
  storageLocation?: string;
  isActive: boolean;
  notes?: string;
}

export default function InventoryItemFormModal({ 
  open, 
  onClose, 
  item, 
  locationId,
  onSuccess 
}: InventoryItemFormModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeTab, setActiveTab] = useState('basic');
  
  // Multi-location and single category/subcategory selection state
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  
  // Location configuration state
  const [locationConfigs, setLocationConfigs] = useState<Map<string, LocationConfig>>(new Map());
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedLocationForConfig, setSelectedLocationForConfig] = useState<string | null>(null);
  const [copiedConfig, setCopiedConfig] = useState<LocationConfig | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'raw_material',
    unit: 'kg',
    sku: '',
    barcode: '',
    description: ''
  });


  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');
  const isMultiLocationAdmin = user?.role === 'company_admin' && (user?.locationIds?.length || 0) > 1;
  const isSingleLocationAdmin = user?.role === 'company_admin' && (user?.locationIds?.length || 0) === 1;

  // Create default location config
  const createDefaultLocationConfig = (): LocationConfig => ({
    availableQuantity: 0,
    reservedQuantity: 0,
    inTransitQuantity: 0,
    minimumStock: 0,
    costingMethod: 'FIFO',
    isActive: true,
  });

  // Check if user can edit a location
  const canEditLocation = (locationId: string): boolean => {
    if (user?.role === 'company_super_admin_primary' || user?.role === 'company_super_admin_secondary') {
      return true; // Super admin can edit all
    }
    return user?.locationIds?.includes(locationId) || false;
  };

  // Handle location selection changes
  const handleLocationSelectionChange = (newSelectedLocations: string[]) => {
    setSelectedLocations(newSelectedLocations);
    
    const newConfigs = new Map(locationConfigs);
    newSelectedLocations.forEach((locationId) => {
      if (!newConfigs.has(locationId)) {
        newConfigs.set(locationId, createDefaultLocationConfig());
      }
    });
    
    Array.from(newConfigs.keys()).forEach((locationId) => {
      if (!newSelectedLocations.includes(locationId) && canEditLocation(locationId)) {
        newConfigs.delete(locationId);
      }
    });
    
    setLocationConfigs(newConfigs);
  };

  // Handle location config changes
  const handleLocationConfigChange = (locationId: string, config: LocationConfig) => {
    const newConfigs = new Map(locationConfigs);
    newConfigs.set(locationId, config);
    setLocationConfigs(newConfigs);
  };

  // Open config modal
  const handleOpenConfigModal = (locationId: string) => {
    setSelectedLocationForConfig(locationId);
    setConfigModalOpen(true);
  };

  // Copy/Paste functions
  const handleCopyConfig = (locationId: string) => {
    const config = locationConfigs.get(locationId);
    if (config) {
      setCopiedConfig({ ...config });
      toast({ title: 'Configuration Copied', variant: 'success' });
    }
  };

  const handlePasteConfig = (locationId: string) => {
    if (copiedConfig) {
      const newConfigs = new Map(locationConfigs);
      newConfigs.set(locationId, { ...copiedConfig });
      setLocationConfigs(newConfigs);
      toast({ title: 'Configuration Pasted', variant: 'success' });
    }
  };

  const handlePasteToAll = () => {
    if (!copiedConfig) return;
    
    const newConfigs = new Map(locationConfigs);
    Array.from(locationConfigs.keys()).forEach((locationId) => {
      if (canEditLocation(locationId)) {
        newConfigs.set(locationId, { ...copiedConfig });
      }
    });
    setLocationConfigs(newConfigs);
    
    const editableCount = Array.from(locationConfigs.keys()).filter(id => canEditLocation(id)).length;
    toast({
      title: 'Configuration Pasted to All Editable Locations',
      description: `Applied to ${editableCount} locations`,
      variant: 'success',
    });
  };

  useEffect(() => {
    if (open) {
      fetchSuppliers();
      fetchLocations();
    }
  }, [open]);

  useEffect(() => {
    if (item) {
      // Set form data - only global fields
      setFormData({
        name: item.name || '',
        type: item.type || 'raw_material',
        unit: item.unit || 'kg',
        sku: item.sku || '',
        barcode: item.barcode || '',
        description: item.description || ''
      });
      
      // Populate ALL location configurations (including non-accessible ones)
      if (item.locations && item.locations.length > 0) {
        const allLocationIds = item.locations.map((l: any) => l.location._id);
        
        // For LocationSearch, only show accessible locations
        const accessibleLocationIds = allLocationIds.filter((id: string) => canEditLocation(id));
        setSelectedLocations(accessibleLocationIds);
        
        // But store configs for ALL locations
        const configs = new Map<string, LocationConfig>();
        item.locations.forEach((locationConfig: any) => {
          configs.set(locationConfig.location._id, {
            availableQuantity: locationConfig.availableQuantity || 0,
            reservedQuantity: locationConfig.reservedQuantity || 0,
            inTransitQuantity: locationConfig.inTransitQuantity || 0,
            minimumStock: locationConfig.minimumStock || 0,
            maximumStock: locationConfig.maximumStock,
            reorderPoint: locationConfig.reorderPoint,
            costingMethod: locationConfig.costingMethod || 'FIFO',
            standardCost: locationConfig.standardCost,
            lastPurchasePrice: locationConfig.lastPurchasePrice,
            lastPurchaseDate: locationConfig.lastPurchaseDate,
            supplier: locationConfig.supplier?._id,
            storageLocation: locationConfig.storageLocation,
            isActive: locationConfig.isActive !== undefined ? locationConfig.isActive : true,
            notes: locationConfig.notes,
          });
        });
        setLocationConfigs(configs);
      } else {
        setSelectedLocations([]);
        setLocationConfigs(new Map());
      }
      
      // Set category selection - handle both ObjectId and populated object formats
      if (item.category) {
        const categoryId = typeof item.category === 'string' ? item.category : item.category._id;
        setSelectedCategories([categoryId]);
      } else {
        setSelectedCategories([]);
      }
      
      // Set subcategory selection - handle both ObjectId and populated object formats
      if (item.subcategory) {
        const subcategoryId = typeof item.subcategory === 'string' ? item.subcategory : item.subcategory._id;
        setSelectedSubcategories([subcategoryId]);
      } else {
        setSelectedSubcategories([]);
      }
    } else {
      // Reset form for new item
      setFormData({
        name: '',
        type: 'raw_material',
        unit: 'kg',
        sku: '',
        barcode: '',
        description: ''
      });
      
      // Don't pre-populate locations - let user select them manually
      // This ensures CategorySubcategorySearch works correctly
      setSelectedLocations([]);
      setSelectedCategories([]);
      setSelectedSubcategories([]);
      setLocationConfigs(new Map());
    }
  }, [item, open]);

  const fetchSuppliers = async () => {
    try {
      const response = await supplierServices.getSuppliers({ limit: 100, isActive: true });
      setSuppliers(response.data.data.suppliers || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch suppliers",
        variant: "destructive",
      });
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await locationServices.getLocations({ limit: 100, isActive: true });
      const allLocations = response.data.data.locations || [];
      
      // Filter locations based on user role
      let availableLocations = allLocations;
      if (!isSuperAdmin) {
        availableLocations = allLocations.filter((location: Location) => 
          user?.locationIds?.includes(location._id)
        );
      }
      
      setLocations(availableLocations);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch locations",
        variant: "destructive",
      });
    }
  };

  const handleLocationsChange = (locationIds: string[]) => {
    handleLocationSelectionChange(locationIds);
    
    // If all locations are cleared, clear categories and subcategories
    if (locationIds.length === 0) {
      setSelectedCategories([]);
      setSelectedSubcategories([]);
    }
    // Note: CategorySubcategorySearch component will handle filtering of invalid categories
    // when locations change through its own useEffect
  };

  const handleCategoriesChange = (categoryIds: string[], subcategoryIds: string[]) => {
    setSelectedCategories(categoryIds);
    setSelectedSubcategories(subcategoryIds);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive",
      });
      setActiveTab('basic');
      return false;
    }

    if (!formData.type) {
      toast({
        title: "Validation Error",
        description: "Type is required",
        variant: "destructive",
      });
      setActiveTab('basic');
      return false;
    }

    if (!formData.unit) {
      toast({
        title: "Validation Error",
        description: "Unit is required",
        variant: "destructive",
      });
      setActiveTab('basic');
      return false;
    }

    // Validate at least one location selected
    if (selectedLocations.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one location must be selected",
        variant: "destructive",
      });
      setActiveTab('assignment');
      return false;
    }

    // Validate at least one category selected
    if (selectedCategories.length === 0) {
      toast({
        title: "Validation Error",
        description: "Category is required",
        variant: "destructive",
      });
      setActiveTab('assignment');
      return false;
    }

    // Validate ObjectId format (24 hex characters)
    const isValidObjectId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

    const invalidLocations = selectedLocations.filter(id => !isValidObjectId(id));
    if (invalidLocations.length > 0) {
      toast({
        title: "Validation Error",
        description: "Invalid location IDs detected. Please reselect locations.",
        variant: "destructive",
      });
      setActiveTab('assignment');
      return false;
    }

    const invalidCategories = selectedCategories.filter(id => !isValidObjectId(id));
    if (invalidCategories.length > 0) {
      toast({
        title: "Validation Error",
        description: "Invalid category ID detected. Please reselect category.",
        variant: "destructive",
      });
      setActiveTab('assignment');
      return false;
    }

    const invalidSubcategories = selectedSubcategories.filter(id => !isValidObjectId(id));
    if (invalidSubcategories.length > 0) {
      toast({
        title: "Validation Error",
        description: "Invalid subcategory ID detected. Please reselect subcategory.",
        variant: "destructive",
      });
      setActiveTab('assignment');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      const submitData: any = {
        name: formData.name.trim(),
        type: formData.type,
        unit: formData.unit,
        sku: formData.sku.trim() || undefined,
        barcode: formData.barcode.trim() || undefined,
        description: formData.description.trim() || undefined,
        // Backend expects single category and subcategory (take first from array)
        category: selectedCategories[0],
        subcategory: selectedSubcategories.length > 0 ? selectedSubcategories[0] : undefined,
      };

      let response;
      if (item) {
        // Update existing item
        await inventoryServices.updateInventoryItem(item._id, submitData);
        
        // Handle location updates
        const originalLocationIds = item.locations?.map((l: any) => l.location._id) || [];
        const currentLocationIds = selectedLocations;
        
        // Remove locations
        const locationsToRemove = originalLocationIds.filter(
          (id: string) => !currentLocationIds.includes(id) && canEditLocation(id)
        );
        
        for (const locationId of locationsToRemove) {
          try {
            await inventoryItemLocationServices.deleteLocationConfig(item._id, locationId);
          } catch (error) {
            console.error(`Failed to remove location ${locationId}:`, error);
          }
        }
        
        // Update or create location configurations
        const locationsToUpdate = currentLocationIds.filter((id: string) => canEditLocation(id));
        
        if (locationsToUpdate.length > 0) {
          const locationConfigsArray = locationsToUpdate.map((locationId) => ({
            locationId,
            ...locationConfigs.get(locationId),
          }));
          
          await inventoryItemLocationServices.bulkUpdateLocationConfigs(item._id, locationConfigsArray);
        }
        
        toast({ title: 'Success', description: 'Inventory item updated', variant: 'success' });
      } else {
        // Create new item with locations
        const locationConfigsArray = selectedLocations.map((locationId) => ({
          locationId,
          ...locationConfigs.get(locationId),
        }));

        response = await inventoryServices.createInventoryItemWithLocations({
          inventoryItemData: submitData,
          locationConfigs: locationConfigsArray,
        });
        
        // Check for auto-assignment information in response
        const autoAssignments = response?.data?.data?.autoAssignments;
        
        if (autoAssignments && (autoAssignments.categories?.length > 0 || autoAssignments.subcategories?.length > 0)) {
          // Build notification message for auto-assignments
          const assignmentMessages: string[] = [];
          
          if (autoAssignments.categories?.length > 0) {
            autoAssignments.categories.forEach((cat: any) => {
              const locationList = cat.locationNames?.join(', ') || 'selected locations';
              assignmentMessages.push(`Category "${cat.categoryName}" was automatically assigned to: ${locationList}`);
            });
          }
          
          if (autoAssignments.subcategories?.length > 0) {
            autoAssignments.subcategories.forEach((subcat: any) => {
              const locationList = subcat.locationNames?.join(', ') || 'selected locations';
              assignmentMessages.push(`Subcategory "${subcat.subcategoryName}" was automatically assigned to: ${locationList}`);
            });
          }
          
          if (assignmentMessages.length > 0) {
            toast({
              title: "Success with Auto-assignments",
              description: (
                <div className="space-y-1">
                  <p>Inventory item created successfully</p>
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <p className="font-semibold text-xs mb-1">Auto-assignments:</p>
                    {assignmentMessages.map((msg, idx) => (
                      <p key={idx} className="text-xs">{msg}</p>
                    ))}
                  </div>
                </div>
              ),
              variant: "success",
            });
          }
        } else {
          toast({ title: 'Success', description: 'Inventory item created', variant: 'success' });
        }
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      // Handle validation errors with dependency information
      const errorData = error.response?.data;
      
      if (errorData?.error?.code === 'CATEGORY_LOCATION_MISMATCH' && errorData?.error?.details?.dependencies) {
        const details = errorData.error.details;
        const dependencies = details.dependencies;
        
        const dependencyMessages: string[] = [];
        
        if (dependencies.items?.count > 0) {
          const examples = dependencies.items.examples?.slice(0, 5).map((item: any) => item.name).join(', ') || '';
          dependencyMessages.push(`${dependencies.items.count} item(s)${examples ? `: ${examples}` : ''}`);
        }
        
        if (dependencies.suppliers?.count > 0) {
          const examples = dependencies.suppliers.examples?.slice(0, 5).map((sup: any) => sup.name).join(', ') || '';
          dependencyMessages.push(`${dependencies.suppliers.count} supplier(s)${examples ? `: ${examples}` : ''}`);
        }
        
        toast({
          title: "Validation Error",
          description: (
            <div className="space-y-1">
              <p>{errorData.error.message}</p>
              {dependencyMessages.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <p className="font-semibold text-xs mb-1">Dependencies found:</p>
                  {dependencyMessages.map((msg, idx) => (
                    <p key={idx} className="text-xs">{msg}</p>
                  ))}
                </div>
              )}
            </div>
          ),
          variant: "destructive",
        });
      } else {
        const errorMessage = errorData?.message || errorData?.error?.message || `Failed to ${item ? 'update' : 'create'} inventory item`;
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="inventory-item-form" onSubmit={handleSubmit}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="assignment">Location & Category</TabsTrigger>
              </TabsList>

              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Tomatoes"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="raw_material">Raw Material</SelectItem>
                        <SelectItem value="finished_good">Finished Good</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="unit">Unit *</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(value) => setFormData({ ...formData, unit: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Kilogram (kg)</SelectItem>
                        <SelectItem value="gram">Gram (g)</SelectItem>
                        <SelectItem value="liter">Liter (L)</SelectItem>
                        <SelectItem value="ml">Milliliter (ml)</SelectItem>
                        <SelectItem value="piece">Piece</SelectItem>
                        <SelectItem value="dozen">Dozen</SelectItem>
                        <SelectItem value="packet">Packet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sku">SKU (Optional)</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="e.g., VEG-TOM-001"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Global Stock Keeping Unit
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="barcode">Barcode (Optional)</Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="e.g., 1234567890123"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Global barcode number
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the item"
                  />
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md text-sm">
                  <p className="font-medium mb-1 text-blue-900 dark:text-blue-100">ℹ️ Note:</p>
                  <p className="text-blue-800 dark:text-blue-200">
                    Stock levels, pricing, supplier, and other operational details are configured per location in the next tab.
                  </p>
                </div>
              </TabsContent>

              {/* Location & Category Assignment Tab */}
              <TabsContent value="assignment" className="space-y-6 mt-4" forceMount={true}>
                <div className={cn("space-y-4", activeTab !== 'assignment' && "hidden")}>
                  <div>
                    <h3 className="font-semibold">Assign Locations *</h3>
                    <p className="text-sm text-muted-foreground">
                      Select which locations this inventory item belongs to
                    </p>
                  </div>

                  <LocationSearch
                    selectedLocationIds={selectedLocations}
                    onLocationsChange={handleLocationsChange}
                    placeholder="Select locations..."
                    showSelectAll={isSuperAdmin}
                  />
                  
                  {item && item.locations && item.locations.length > selectedLocations.length && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p className="text-amber-600">
                        Note: This item is also available in {item.locations.length - selectedLocations.length} other location{item.locations.length - selectedLocations.length !== 1 ? 's' : ''} (shown below as read-only).
                      </p>
                    </div>
                  )}
                </div>

                {/* Location Configuration */}
                {locationConfigs.size > 0 && (
                  <div className={cn("border-t pt-6 space-y-4", activeTab !== 'assignment' && "hidden")}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">
                        Location Configuration
                        {item && locationConfigs.size > selectedLocations.length && (
                          <span className="text-sm font-normal text-muted-foreground ml-2">
                            (Showing all {locationConfigs.size} locations)
                          </span>
                        )}
                      </h3>
                      {copiedConfig && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handlePasteToAll}
                          disabled={loading}
                        >
                          <ClipboardPaste className="h-4 w-4 mr-2" />
                          Paste to All Editable Locations
                        </Button>
                      )}
                    </div>
                    <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                      {Array.from(locationConfigs.keys()).map((locationId) => {
                        // Look up location from fetched locations list OR from item.locations
                        const location = locations.find((l) => l._id === locationId) || 
                                       item?.locations?.find((l: any) => l.location._id === locationId)?.location;
                        const config = locationConfigs.get(locationId);
                        if (!location || !config) return null;
                        
                        const isEditable = canEditLocation(locationId);
                        const totalQuantity = config.availableQuantity + config.reservedQuantity + config.inTransitQuantity;
                        
                        return (
                          <div
                            key={locationId}
                            className={`flex items-center justify-between p-3 hover:bg-muted/50 ${!isEditable ? 'bg-muted/30' : ''}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{location.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {location.code}
                                </Badge>
                                {!isEditable && (
                                  <Badge variant="secondary" className="text-xs">
                                    Read Only
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Available: {config.availableQuantity} • Reserved: {config.reservedQuantity} • In-Transit: {config.inTransitQuantity} • Total: {totalQuantity}
                                {!isEditable && ' • No edit permission'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenConfigModal(locationId)}
                                disabled={loading}
                                title={isEditable ? "Configure location settings" : "View location settings (read-only)"}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                              {isEditable && (
                                <>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopyConfig(locationId)}
                                    disabled={loading}
                                    title="Copy configuration"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  {copiedConfig && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handlePasteConfig(locationId)}
                                      disabled={loading}
                                      title="Paste configuration"
                                    >
                                      <ClipboardPaste className="h-4 w-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handlePasteConfig(branchId)}
                                      disabled={loading}
                                      title="Paste configuration"
                                    >
                                      <ClipboardPaste className="h-4 w-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className={cn("border-t pt-6 space-y-4", activeTab !== 'assignment' && "hidden")}>
                  <div>
                    <h3 className="font-semibold">Assign Categories & Subcategories *</h3>
                    <p className="text-sm text-muted-foreground">
                      Select category and subcategory for this item. Categories are filtered based on selected locations.
                    </p>
                  </div>

                  <CategorySubcategorySearch
                    selectedCategoryIds={selectedCategories}
                    selectedSubcategoryIds={selectedSubcategories}
                    onCategoriesChange={handleCategoriesChange}
                    locationIds={selectedLocations}
                    required={true}
                    isCategoryMulti={false}
                    isSubcategoryMulti={false}
                  />
                </div>
              </TabsContent>

            </Tabs>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="inventory-item-form" disabled={loading}>
            {loading ? 'Saving...' : item ? 'Update Item' : 'Create Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
      
      {/* Location Configuration Modal */}
      {selectedLocationForConfig && (() => {
        const location = locations.find((l) => l._id === selectedLocationForConfig) ||
                       item?.locations?.find((l: any) => l.location._id === selectedLocationForConfig)?.location;
        const config = locationConfigs.get(selectedLocationForConfig);
        
        if (!location || !config) return null;
        
        return (
          <InventoryLocationConfigModal
            isOpen={configModalOpen}
            onClose={() => {
              setConfigModalOpen(false);
              setSelectedLocationForConfig(null);
            }}
            location={location}
            config={config}
            onChange={(config) => handleLocationConfigChange(selectedLocationForConfig, config)}
            isEditable={canEditLocation(selectedLocationForConfig)}
            suppliers={suppliers}
          />
        );
      })()}
    </Dialog>
  );
}
