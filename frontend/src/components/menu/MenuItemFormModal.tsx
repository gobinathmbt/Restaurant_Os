import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Settings, Copy, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/contexts/LoadingContext';
import { menuItemServices, menuItemBranchServices } from '@/api/services';
import BranchSearch from '@/components/common/BranchSearch';
import BranchConfigModal from './BranchConfigModal';

interface MenuCategory {
  _id: string;
  name: string;
  color?: string;
}

interface Branch {
  _id: string;
  name: string;
  code: string;
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

interface BranchConfig {
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
  modifiers?: any[];
  addOns?: string[];
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

interface MenuItem {
  _id: string;
  name: string;
  description?: string;
  category: string;
  basePrice: number;
  isVeg: boolean;
  spiceLevel: string;
  modifiers: Modifier[];
  addOns: AddOn[];
  tags: string[];
  hsnCode?: string;
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
}

interface MenuItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem?: MenuItem | null;
  onSuccess: () => void;
  categories: MenuCategory[];
  branches: Branch[];
  userBranchIds: string[] | null;
}

export default function MenuItemFormModal({
  isOpen,
  onClose,
  menuItem,
  onSuccess,
  categories,
  branches,
  userBranchIds,
}: MenuItemFormModalProps) {
  const { toast } = useToast();
  const { setLoading: setGlobalLoading, setLoadingMessage } = useLoading();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    basePrice: 0,
    isVeg: true,
    spiceLevel: 'none',
    modifiers: [] as Modifier[],
    addOns: [] as AddOn[],
    tags: [] as string[],
    hsnCode: '',
  });

  const [tagInput, setTagInput] = useState('');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [branchConfigs, setBranchConfigs] = useState<Map<string, BranchConfig>>(new Map());
  
  // Branch config modal state
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedBranchForConfig, setSelectedBranchForConfig] = useState<string | null>(null);
  
  // Copy/paste state
  const [copiedConfig, setCopiedConfig] = useState<BranchConfig | null>(null);

  // Helper function to create default branch config
  const createDefaultBranchConfig = (basePrice: number): BranchConfig => ({
    price: basePrice,
    isAvailable: true,
    preparationTime: 15,
    requiresKitchen: true,
    outOfStock: false,
    lowStockThreshold: undefined,
    taxRateOverride: undefined,
    displayOrder: 0,
    channels: ['dine_in', 'takeaway', 'online'],
    timeBasedPricing: [],
    availability: {
      schedule: [],
    },
    modifiers: [],
    addOns: [],
  });

  // Handle branch selection changes
  const handleBranchSelectionChange = (newSelectedBranches: string[]) => {
    setSelectedBranches(newSelectedBranches);
    
    // Initialize configs for newly selected branches
    const newConfigs = new Map(branchConfigs);
    newSelectedBranches.forEach((branchId) => {
      if (!newConfigs.has(branchId)) {
        newConfigs.set(branchId, createDefaultBranchConfig(formData.basePrice));
      }
    });
    
    // Remove configs for deselected branches (only editable ones)
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

  // Open config modal for a branch
  const handleOpenConfigModal = (branchId: string) => {
    setSelectedBranchForConfig(branchId);
    setConfigModalOpen(true);
  };

  // Handle copy configuration
  const handleCopyConfig = (branchId: string) => {
    const config = branchConfigs.get(branchId);
    if (config) {
      setCopiedConfig({ ...config });
      toast({
        title: 'Configuration Copied',
        description: 'You can now paste this configuration to other branches',
        variant: 'success',
      });
    }
  };

  // Handle paste configuration
  const handlePasteConfig = (branchId: string) => {
    if (copiedConfig) {
      const newConfigs = new Map(branchConfigs);
      newConfigs.set(branchId, { ...copiedConfig });
      setBranchConfigs(newConfigs);
      toast({
        title: 'Configuration Pasted',
        description: 'Configuration has been applied to this branch',
        variant: 'success',
      });
    }
  };

  // Handle paste to all branches
  const handlePasteToAll = () => {
    if (!copiedConfig) return;
    
    const newConfigs = new Map(branchConfigs);
    // Only paste to editable branches
    Array.from(branchConfigs.keys()).forEach((branchId) => {
      if (canEditBranch(branchId)) {
        newConfigs.set(branchId, { ...copiedConfig });
      }
    });
    setBranchConfigs(newConfigs);
    
    const editableCount = Array.from(branchConfigs.keys()).filter(id => canEditBranch(id)).length;
    toast({
      title: 'Configuration Pasted to All Editable Branches',
      description: `Configuration applied to ${editableCount} editable branch${editableCount !== 1 ? 'es' : ''}`,
      variant: 'success',
    });
  };

  // Check if user can edit a specific branch
  const canEditBranch = (branchId: string): boolean => {
    // Super admin (null userBranchIds) can edit all branches
    if (userBranchIds === null) return true;
    // Branch managers can only edit their assigned branches
    return userBranchIds.includes(branchId);
  };

  useEffect(() => {
    if (menuItem) {
      setFormData({
        name: menuItem.name || '',
        description: menuItem.description || '',
        category: menuItem.category || '',
        basePrice: menuItem.basePrice || 0,
        isVeg: menuItem.isVeg !== undefined ? menuItem.isVeg : true,
        spiceLevel: menuItem.spiceLevel || 'none',
        modifiers: menuItem.modifiers || [],
        addOns: menuItem.addOns || [],
        tags: menuItem.tags || [],
        hsnCode: menuItem.hsnCode || '',
      });
      
      // Populate ALL branch configurations (including non-accessible ones)
      if (menuItem.branches && menuItem.branches.length > 0) {
        const allBranchIds = menuItem.branches.map(b => b.branch._id);
        
        // For BranchSearch, only show accessible branches
        const accessibleBranchIds = allBranchIds.filter(id => canEditBranch(id));
        setSelectedBranches(accessibleBranchIds);
        
        // But store configs for ALL branches (for display purposes)
        const configs = new Map<string, BranchConfig>();
        menuItem.branches.forEach(branchConfig => {
          configs.set(branchConfig.branch._id, {
            price: branchConfig.price,
            isAvailable: branchConfig.isAvailable,
            preparationTime: branchConfig.preparationTime,
            requiresKitchen: branchConfig.requiresKitchen,
            outOfStock: branchConfig.outOfStock,
            lowStockThreshold: branchConfig.lowStockThreshold,
            taxRateOverride: branchConfig.taxRateOverride,
            displayOrder: branchConfig.displayOrder,
            channels: branchConfig.channels,
            timeBasedPricing: branchConfig.timeBasedPricing,
            availability: branchConfig.availability,
            modifiers: (branchConfig as any).modifiers || [],
            addOns: (branchConfig as any).addOns || [],
          });
        });
        setBranchConfigs(configs);
      }
    } else {
      // Reset form for new menu item
      setFormData({
        name: '',
        description: '',
        category: '',
        basePrice: 0,
        isVeg: true,
        spiceLevel: 'none',
        modifiers: [],
        addOns: [],
        tags: [],
        hsnCode: '',
      });
      setSelectedBranches([]);
      setBranchConfigs(new Map());
    }
    setTagInput('');
  }, [menuItem, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.category || formData.basePrice <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Name, category, and base price are required',
        variant: 'destructive',
      });
      return;
    }

    if (formData.name.length > 200) {
      toast({
        title: 'Validation Error',
        description: 'Name must be 200 characters or less',
        variant: 'destructive',
      });
      return;
    }

    // Validate at least one branch is selected
    if (selectedBranches.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one branch',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      setGlobalLoading(true);
      setLoadingMessage(
        menuItem 
          ? 'Updating menu item and branch configurations...' 
          : 'Creating menu item with branch configurations...'
      );

      if (menuItem) {
        // Update existing menu item
        await menuItemServices.updateMenuItem(menuItem._id, formData);
        
        // Handle branch updates
        const originalBranchIds = menuItem.branches?.map(b => b.branch._id) || [];
        const currentBranchIds = selectedBranches;
        
        // Find branches to remove (in original but not in current)
        const branchesToRemove = originalBranchIds.filter(
          id => !currentBranchIds.includes(id) && canEditBranch(id)
        );
        
        // Find branches to add or update (in current selection)
        const branchesToUpdate = currentBranchIds.filter(id => canEditBranch(id));
        
        // Delete removed branches
        for (const branchId of branchesToRemove) {
          try {
            await menuItemBranchServices.deleteBranchConfig(menuItem._id, branchId);
          } catch (error) {
            console.error(`Failed to remove branch ${branchId}:`, error);
          }
        }
        
        // Update or create branch configurations
        if (branchesToUpdate.length > 0) {
          const branchConfigsArray = branchesToUpdate.map((branchId) => ({
            branchId,
            ...branchConfigs.get(branchId),
          }));
          
          console.log('=== Updating branch configurations ===');
          console.log('branchConfigsArray:', branchConfigsArray);
          branchConfigsArray.forEach((config, index) => {
            console.log(`Branch ${index} config:`, {
              branchId: config.branchId,
              modifiers: config.modifiers,
              addOns: config.addOns
            });
          });
          
          await menuItemBranchServices.updateMenuItemBranches(menuItem._id, branchConfigsArray);
        }
        
        toast({
          title: 'Success',
          description: 'Menu item and branch configurations updated successfully',
          variant: 'success',
        });
      } else {
        // Create new menu item with branch assignments
        const branchConfigsArray = selectedBranches.map((branchId) => ({
          branchId,
          ...branchConfigs.get(branchId),
        }));

        console.log('=== Creating menu item with branch configurations ===');
        console.log('branchConfigsArray:', branchConfigsArray);
        branchConfigsArray.forEach((config, index) => {
          console.log(`Branch ${index} config:`, {
            branchId: config.branchId,
            modifiers: config.modifiers,
            addOns: config.addOns
          });
        });

        await menuItemServices.createMenuItemWithBranches({
          menuItemData: formData,
          branchConfigs: branchConfigsArray,
        });
        
        toast({
          title: 'Success',
          description: 'Menu item created successfully with branch configurations',
          variant: 'success',
        });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      // Extract error message from response
      const errorMessage = error.message || 
        error.response?.data?.message || 
        error.data?.message ||
        `Failed to ${menuItem ? 'update' : 'create'} menu item`;
      
      // Handle specific error types based on HTTP status codes
      const status = error.status || error.response?.status;
      
      if (status === 403) {
        // Authorization error - user lacks permission
        toast({
          title: 'Access Denied',
          description: errorMessage || 'You do not have permission to access one or more selected branches',
          variant: 'destructive',
        });
      } else if (status === 400) {
        // Validation error - invalid input or constraint violation
        toast({
          title: 'Validation Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } else if (status === 404) {
        // Not found error - resource doesn't exist
        toast({
          title: 'Not Found',
          description: errorMessage || 'The requested resource was not found',
          variant: 'destructive',
        });
      } else {
        // Generic error for other status codes
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
      
      console.error('Menu item operation error:', error);
    } finally {
      setLoading(false);
      setGlobalLoading(false);
      setLoadingMessage(undefined);
    }
  };

  // Tag management
  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag),
    });
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {menuItem ? 'Edit Menu Item' : 'Create New Menu Item'}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="menu-item-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Chicken Tikka Masala"
                    maxLength={200}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Tender chicken in creamy tomato sauce"
                    rows={3}
                    maxLength={1000}
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                    disabled={loading}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category._id} value={category._id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="basePrice">Base Price (₹) *</Label>
                  <Input
                    id="basePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.basePrice}
                    onChange={(e) => {
                      const newBasePrice = parseFloat(e.target.value) || 0;
                      setFormData({
                        ...formData,
                        basePrice: newBasePrice,
                      });
                      // Update all branch configs with new base price if they haven't been customized
                      const newConfigs = new Map(branchConfigs);
                      selectedBranches.forEach((branchId) => {
                        const config = newConfigs.get(branchId);
                        if (config && config.price === formData.basePrice) {
                          newConfigs.set(branchId, { ...config, price: newBasePrice });
                        }
                      });
                      setBranchConfigs(newConfigs);
                    }}
                    placeholder="12.99"
                    disabled={loading}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Dietary & Spice */}
            <div className="space-y-4">
              <h3 className="font-semibold">Dietary & Spice Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isVeg"
                    checked={formData.isVeg}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isVeg: checked as boolean })
                    }
                    disabled={loading}
                  />
                  <Label htmlFor="isVeg" className="cursor-pointer">
                    Vegetarian
                  </Label>
                </div>
                <div>
                  <Label htmlFor="spiceLevel">Spice Level</Label>
                  <Select
                    value={formData.spiceLevel}
                    onValueChange={(value) =>
                      setFormData({ ...formData, spiceLevel: value })
                    }
                    disabled={loading}
                  >
                    <SelectTrigger id="spiceLevel">
                      <SelectValue placeholder="Select spice level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Spice</SelectItem>
                      <SelectItem value="mild">Mild</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hot">Hot</SelectItem>
                      <SelectItem value="extra_hot">Extra Hot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Branch Selection - For both new and edit menu items */}
            <div className="space-y-4">
              <h3 className="font-semibold">Branch Assignment *</h3>
              <BranchSearch
                selectedBranchIds={selectedBranches}
                onBranchesChange={handleBranchSelectionChange}
                disabled={loading}
                placeholder="Select branches for this menu item..."
                showSelectAll={true}
              />
              {menuItem && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Select branches you have access to. You can add or remove them.</p>
                  {menuItem.branches && menuItem.branches.length > selectedBranches.length && (
                    <p className="text-amber-600">
                      Note: This item is also available in {menuItem.branches.length - selectedBranches.length} other branch{menuItem.branches.length - selectedBranches.length !== 1 ? 'es' : ''} (shown below as read-only).
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Branch Configuration - Show ALL branches including non-accessible ones */}
            {branchConfigs.size > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    Branch Configuration
                    {menuItem && branchConfigs.size > selectedBranches.length && (
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
                <div className="border rounded-lg divide-y">
                  {Array.from(branchConfigs.keys()).map((branchId) => {
                    const branch = branches.find((b) => b._id === branchId) || 
                                   menuItem?.branches?.find(b => b.branch._id === branchId)?.branch;
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
                            Price: ₹{config.price.toFixed(2)} • 
                            {config.isAvailable ? ' Available' : ' Unavailable'} • 
                            {config.channels.length} channels
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
                {copiedConfig && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ClipboardPaste className="h-4 w-4" />
                    <span>Configuration copied. Click paste icon to apply to editable branches.</span>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            <div className="space-y-4">
              <h3 className="font-semibold">Tags</h3>
              <div className="flex items-center gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder="Add tag (press Enter)"
                  disabled={loading}
                />
                <Button type="button" variant="outline" onClick={addTag} disabled={loading}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <div
                      key={tag}
                      className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-destructive"
                        disabled={loading}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* HSN Code */}
            <div className="space-y-4">
              <h3 className="font-semibold">Additional Information</h3>
              <div>
                <Label htmlFor="hsnCode">HSN Code</Label>
                <Input
                  id="hsnCode"
                  value={formData.hsnCode}
                  onChange={(e) =>
                    setFormData({ ...formData, hsnCode: e.target.value })
                  }
                  placeholder="10061010"
                  disabled={loading}
                />
              </div>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" form="menu-item-form" disabled={loading}>
            {loading
              ? 'Saving...'
              : menuItem
              ? 'Update Menu Item'
              : 'Create Menu Item'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Branch Configuration Modal */}
      {selectedBranchForConfig && (() => {
        const branch = branches.find((b) => b._id === selectedBranchForConfig) ||
                       menuItem?.branches?.find((b) => b.branch._id === selectedBranchForConfig)?.branch;
        const config = branchConfigs.get(selectedBranchForConfig);
        
        // Only render if we have both branch and config
        if (!branch || !config) return null;
        
        // Find the MenuItemBranch ID if editing an existing menu item
        const menuItemBranchId = menuItem?.branches?.find(
          (b) => b.branch._id === selectedBranchForConfig
        )?._id;

        return (
          <BranchConfigModal
            isOpen={configModalOpen}
            onClose={() => {
              setConfigModalOpen(false);
              setSelectedBranchForConfig(null);
            }}
            branch={branch}
            config={config}
            onChange={(config) => handleBranchConfigChange(selectedBranchForConfig, config)}
            isEditable={canEditBranch(selectedBranchForConfig)}
            menuItemId={menuItem?._id}
            menuItemBranchId={menuItemBranchId}
          />
        );
      })()}
    </Dialog>
  );
}
