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
import { inventoryServices, supplierServices, inventoryItemBranchServices, branchServices } from '@/api/services';
import BranchSearch from '@/components/common/BranchSearch';
import CategorySubcategorySearch from '@/components/common/CategorySubcategorySearch';
import InventoryBranchConfigModal from './InventoryBranchConfigModal';
import { cn } from '@/lib/utils';

interface InventoryItemFormModalProps {
  open: boolean;
  onClose: () => void;
  item: any | null;
  branchId: string;
  onSuccess: () => void;
}

interface Supplier {
  _id: string;
  name: string;
}

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface BranchConfig {
  currentStock: number;
  minimumStock: number;
  maximumStock?: number;
  reorderPoint?: number;
  costPrice?: number;
  lastPurchasePrice?: number;
  lastPurchaseDate?: Date;
  supplier?: string;
  storageLocation?: string;
  batchNumber?: string;
  expiryDate?: Date;
  branchSKU?: string;
  branchBarcode?: string;
  isActive: boolean;
  isAvailable: boolean;
  notes?: string;
}

export default function InventoryItemFormModal({ 
  open, 
  onClose, 
  item, 
  branchId,
  onSuccess 
}: InventoryItemFormModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeTab, setActiveTab] = useState('basic');
  
  // Multi-branch and single category/subcategory selection state
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  
  // Branch configuration state
  const [branchConfigs, setBranchConfigs] = useState<Map<string, BranchConfig>>(new Map());
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedBranchForConfig, setSelectedBranchForConfig] = useState<string | null>(null);
  const [copiedConfig, setCopiedConfig] = useState<BranchConfig | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'raw_material',
    unit: 'kg',
    sku: '',
    barcode: '',
    description: ''
  });


  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');
  const isMultiBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) > 1;
  const isSingleBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) === 1;

  // Create default branch config
  const createDefaultBranchConfig = (): BranchConfig => ({
    currentStock: 0,
    minimumStock: 0,
    isActive: true,
    isAvailable: true,
  });

  // Check if user can edit a branch
  const canEditBranch = (branchId: string): boolean => {
    if (user?.role === 'company_super_admin_primary' || user?.role === 'company_super_admin_secondary') {
      return true; // Super admin can edit all
    }
    return user?.branchIds?.includes(branchId) || false;
  };

  // Handle branch selection changes
  const handleBranchSelectionChange = (newSelectedBranches: string[]) => {
    setSelectedBranches(newSelectedBranches);
    
    const newConfigs = new Map(branchConfigs);
    newSelectedBranches.forEach((branchId) => {
      if (!newConfigs.has(branchId)) {
        newConfigs.set(branchId, createDefaultBranchConfig());
      }
    });
    
    Array.from(newConfigs.keys()).forEach((branchId) => {
      if (!newSelectedBranches.includes(branchId) && canEditBranch(branchId)) {
        newConfigs.delete(branchId);
      }
    });
    
    setBranchConfigs(newConfigs);
  };

  // Handle branch config changes
  const handleBranchConfigChange = (branchId: string, config: BranchConfig) => {
    const newConfigs = new Map(branchConfigs);
    newConfigs.set(branchId, config);
    setBranchConfigs(newConfigs);
  };

  // Open config modal
  const handleOpenConfigModal = (branchId: string) => {
    setSelectedBranchForConfig(branchId);
    setConfigModalOpen(true);
  };

  // Copy/Paste functions
  const handleCopyConfig = (branchId: string) => {
    const config = branchConfigs.get(branchId);
    if (config) {
      setCopiedConfig({ ...config });
      toast({ title: 'Configuration Copied', variant: 'success' });
    }
  };

  const handlePasteConfig = (branchId: string) => {
    if (copiedConfig) {
      const newConfigs = new Map(branchConfigs);
      newConfigs.set(branchId, { ...copiedConfig });
      setBranchConfigs(newConfigs);
      toast({ title: 'Configuration Pasted', variant: 'success' });
    }
  };

  const handlePasteToAll = () => {
    if (!copiedConfig) return;
    
    const newConfigs = new Map(branchConfigs);
    Array.from(branchConfigs.keys()).forEach((branchId) => {
      if (canEditBranch(branchId)) {
        newConfigs.set(branchId, { ...copiedConfig });
      }
    });
    setBranchConfigs(newConfigs);
    
    const editableCount = Array.from(branchConfigs.keys()).filter(id => canEditBranch(id)).length;
    toast({
      title: 'Configuration Pasted to All Editable Branches',
      description: `Applied to ${editableCount} branches`,
      variant: 'success',
    });
  };

  useEffect(() => {
    if (open) {
      fetchSuppliers();
      fetchBranches();
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
      
      // Populate ALL branch configurations (including non-accessible ones)
      if (item.branches && item.branches.length > 0) {
        const allBranchIds = item.branches.map((b: any) => b.branch._id);
        
        // For BranchSearch, only show accessible branches
        const accessibleBranchIds = allBranchIds.filter((id: string) => canEditBranch(id));
        setSelectedBranches(accessibleBranchIds);
        
        // But store configs for ALL branches
        const configs = new Map<string, BranchConfig>();
        item.branches.forEach((branchConfig: any) => {
          configs.set(branchConfig.branch._id, {
            currentStock: branchConfig.currentStock || 0,
            minimumStock: branchConfig.minimumStock || 0,
            maximumStock: branchConfig.maximumStock,
            reorderPoint: branchConfig.reorderPoint,
            costPrice: branchConfig.costPrice,
            lastPurchasePrice: branchConfig.lastPurchasePrice,
            lastPurchaseDate: branchConfig.lastPurchaseDate,
            supplier: branchConfig.supplier?._id,
            storageLocation: branchConfig.storageLocation,
            batchNumber: branchConfig.batchNumber,
            expiryDate: branchConfig.expiryDate,
            branchSKU: branchConfig.branchSKU,
            branchBarcode: branchConfig.branchBarcode,
            isActive: branchConfig.isActive !== undefined ? branchConfig.isActive : true,
            isAvailable: branchConfig.isAvailable !== undefined ? branchConfig.isAvailable : true,
            notes: branchConfig.notes,
          });
        });
        setBranchConfigs(configs);
      } else {
        setSelectedBranches([]);
        setBranchConfigs(new Map());
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
      
      // Don't pre-populate branches - let user select them manually
      // This ensures CategorySubcategorySearch works correctly
      setSelectedBranches([]);
      setSelectedCategories([]);
      setSelectedSubcategories([]);
      setBranchConfigs(new Map());
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

  const fetchBranches = async () => {
    try {
      const response = await branchServices.getBranches({ limit: 100, isActive: true });
      const allBranches = response.data.data.branches || [];
      
      // Filter branches based on user role
      let availableBranches = allBranches;
      if (!isSuperAdmin) {
        availableBranches = allBranches.filter((branch: Branch) => 
          user?.branchIds?.includes(branch._id)
        );
      }
      
      setBranches(availableBranches);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch branches",
        variant: "destructive",
      });
    }
  };

  const handleBranchesChange = (branchIds: string[]) => {
    handleBranchSelectionChange(branchIds);
    
    // If all branches are cleared, clear categories and subcategories
    if (branchIds.length === 0) {
      setSelectedCategories([]);
      setSelectedSubcategories([]);
    }
    // Note: CategorySubcategorySearch component will handle filtering of invalid categories
    // when branches change through its own useEffect
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

    // Validate at least one branch selected
    if (selectedBranches.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one branch must be selected",
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

    const invalidBranches = selectedBranches.filter(id => !isValidObjectId(id));
    if (invalidBranches.length > 0) {
      toast({
        title: "Validation Error",
        description: "Invalid branch IDs detected. Please reselect branches.",
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
        
        // Handle branch updates
        const originalBranchIds = item.branches?.map((b: any) => b.branch._id) || [];
        const currentBranchIds = selectedBranches;
        
        // Remove branches
        const branchesToRemove = originalBranchIds.filter(
          (id: string) => !currentBranchIds.includes(id) && canEditBranch(id)
        );
        
        for (const branchId of branchesToRemove) {
          try {
            await inventoryItemBranchServices.deleteBranchConfig(item._id, branchId);
          } catch (error) {
            console.error(`Failed to remove branch ${branchId}:`, error);
          }
        }
        
        // Update or create branch configurations
        const branchesToUpdate = currentBranchIds.filter((id: string) => canEditBranch(id));
        
        if (branchesToUpdate.length > 0) {
          const branchConfigsArray = branchesToUpdate.map((branchId) => ({
            branchId,
            ...branchConfigs.get(branchId),
          }));
          
          await inventoryItemBranchServices.updateInventoryItemBranches(item._id, branchConfigsArray);
        }
        
        toast({ title: 'Success', description: 'Inventory item updated', variant: 'success' });
      } else {
        // Create new item with branches
        const branchConfigsArray = selectedBranches.map((branchId) => ({
          branchId,
          ...branchConfigs.get(branchId),
        }));

        response = await inventoryServices.createInventoryItemWithBranches({
          inventoryItemData: submitData,
          branchConfigs: branchConfigsArray,
        });
        
        // Check for auto-assignment information in response
        const autoAssignments = response?.data?.data?.autoAssignments;
        
        if (autoAssignments && (autoAssignments.categories?.length > 0 || autoAssignments.subcategories?.length > 0)) {
          // Build notification message for auto-assignments
          const assignmentMessages: string[] = [];
          
          if (autoAssignments.categories?.length > 0) {
            autoAssignments.categories.forEach((cat: any) => {
              const branchList = cat.branchNames?.join(', ') || 'selected branches';
              assignmentMessages.push(`Category "${cat.categoryName}" was automatically assigned to: ${branchList}`);
            });
          }
          
          if (autoAssignments.subcategories?.length > 0) {
            autoAssignments.subcategories.forEach((subcat: any) => {
              const branchList = subcat.branchNames?.join(', ') || 'selected branches';
              assignmentMessages.push(`Subcategory "${subcat.subcategoryName}" was automatically assigned to: ${branchList}`);
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
      
      if (errorData?.error?.code === 'CATEGORY_BRANCH_MISMATCH' && errorData?.error?.details?.dependencies) {
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
                <TabsTrigger value="assignment">Branch & Category</TabsTrigger>
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
                    Stock levels, pricing, supplier, and other operational details are configured per branch in the next tab.
                  </p>
                </div>
              </TabsContent>

              {/* Branch & Category Assignment Tab */}
              <TabsContent value="assignment" className="space-y-6 mt-4" forceMount={true}>
                <div className={cn("space-y-4", activeTab !== 'assignment' && "hidden")}>
                  <div>
                    <h3 className="font-semibold">Assign Branches *</h3>
                    <p className="text-sm text-muted-foreground">
                      Select which branches this inventory item belongs to
                    </p>
                  </div>

                  <BranchSearch
                    selectedBranchIds={selectedBranches}
                    onBranchesChange={handleBranchesChange}
                    placeholder="Select branches..."
                    showSelectAll={isSuperAdmin}
                  />
                  
                  {item && item.branches && item.branches.length > selectedBranches.length && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p className="text-amber-600">
                        Note: This item is also available in {item.branches.length - selectedBranches.length} other branch{item.branches.length - selectedBranches.length !== 1 ? 'es' : ''} (shown below as read-only).
                      </p>
                    </div>
                  )}
                </div>

                {/* Branch Configuration */}
                {branchConfigs.size > 0 && (
                  <div className={cn("border-t pt-6 space-y-4", activeTab !== 'assignment' && "hidden")}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">
                        Branch Configuration
                        {item && branchConfigs.size > selectedBranches.length && (
                          <span className="text-sm font-normal text-muted-foreground ml-2">
                            (Showing all {branchConfigs.size} branches)
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
                          Paste to All Editable Branches
                        </Button>
                      )}
                    </div>
                    <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                      {Array.from(branchConfigs.keys()).map((branchId) => {
                        // Look up branch from fetched branches list OR from item.branches
                        const branch = branches.find((b) => b._id === branchId) || 
                                       item?.branches?.find((b: any) => b.branch._id === branchId)?.branch;
                        const config = branchConfigs.get(branchId);
                        if (!branch || !config) return null;
                        
                        const isEditable = canEditBranch(branchId);
                        
                        return (
                          <div
                            key={branchId}
                            className={`flex items-center justify-between p-3 hover:bg-muted/50 ${!isEditable ? 'bg-muted/30' : ''}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{branch.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {branch.code}
                                </Badge>
                                {!isEditable && (
                                  <Badge variant="secondary" className="text-xs">
                                    Read Only
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Stock: {config.currentStock} • Min: {config.minimumStock}
                                {!isEditable && ' • No edit permission'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenConfigModal(branchId)}
                                disabled={loading}
                                title={isEditable ? "Configure branch settings" : "View branch settings (read-only)"}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                              {isEditable && (
                                <>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopyConfig(branchId)}
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
                      Select category and subcategory for this item. Categories are filtered based on selected branches.
                    </p>
                  </div>

                  <CategorySubcategorySearch
                    selectedCategoryIds={selectedCategories}
                    selectedSubcategoryIds={selectedSubcategories}
                    onCategoriesChange={handleCategoriesChange}
                    branchIds={selectedBranches}
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
      
      {/* Branch Configuration Modal */}
      {selectedBranchForConfig && (() => {
        const branch = branches.find((b) => b._id === selectedBranchForConfig) ||
                       item?.branches?.find((b: any) => b.branch._id === selectedBranchForConfig)?.branch;
        const config = branchConfigs.get(selectedBranchForConfig);
        
        if (!branch || !config) return null;
        
        return (
          <InventoryBranchConfigModal
            isOpen={configModalOpen}
            onClose={() => {
              setConfigModalOpen(false);
              setSelectedBranchForConfig(null);
            }}
            branch={branch}
            config={config}
            onChange={(config) => handleBranchConfigChange(selectedBranchForConfig, config)}
            isEditable={canEditBranch(selectedBranchForConfig)}
            suppliers={suppliers}
          />
        );
      })()}
    </Dialog>
  );
}
