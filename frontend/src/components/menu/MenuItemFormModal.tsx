import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/contexts/LoadingContext';
import { menuItemServices } from '@/api/services';
import BranchSelectionComponent from './BranchSelectionComponent';
import BranchConfigurationAccordion from './BranchConfigurationAccordion';

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
    
    // Remove configs for deselected branches
    Array.from(newConfigs.keys()).forEach((branchId) => {
      if (!newSelectedBranches.includes(branchId)) {
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

  // Handle copy to all branches
  const handleCopyToAllBranches = (sourceBranchId: string) => {
    const sourceConfig = branchConfigs.get(sourceBranchId);
    if (!sourceConfig) return;
    
    const newConfigs = new Map(branchConfigs);
    selectedBranches.forEach((branchId) => {
      if (branchId !== sourceBranchId) {
        newConfigs.set(branchId, { ...sourceConfig });
      }
    });
    setBranchConfigs(newConfigs);
    
    toast({
      title: 'Success',
      description: 'Configuration copied to all other branches',
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

    // Validate at least one branch is selected for new menu items
    if (!menuItem && selectedBranches.length === 0) {
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
          ? 'Updating menu item...' 
          : 'Creating menu item with branch configurations...'
      );

      if (menuItem) {
        // Update existing menu item
        await menuItemServices.updateMenuItem(menuItem._id, formData);
        toast({
          title: 'Success',
          description: 'Menu item updated successfully',
          variant: 'success',
        });
      } else {
        // Create new menu item with branch assignments
        const branchConfigsArray = selectedBranches.map((branchId) => ({
          branchId,
          ...branchConfigs.get(branchId),
        }));

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

  // Modifier management
  const addModifier = () => {
    setFormData({
      ...formData,
      modifiers: [...formData.modifiers, { name: '', options: [] }],
    });
  };

  const removeModifier = (index: number) => {
    const newModifiers = formData.modifiers.filter((_, i) => i !== index);
    setFormData({ ...formData, modifiers: newModifiers });
  };

  const updateModifier = (index: number, field: string, value: any) => {
    const newModifiers = [...formData.modifiers];
    newModifiers[index] = { ...newModifiers[index], [field]: value };
    setFormData({ ...formData, modifiers: newModifiers });
  };

  const addModifierOption = (modifierIndex: number) => {
    const newModifiers = [...formData.modifiers];
    newModifiers[modifierIndex].options.push({ name: '', price: 0 });
    setFormData({ ...formData, modifiers: newModifiers });
  };

  const removeModifierOption = (modifierIndex: number, optionIndex: number) => {
    const newModifiers = [...formData.modifiers];
    newModifiers[modifierIndex].options = newModifiers[modifierIndex].options.filter(
      (_, i) => i !== optionIndex
    );
    setFormData({ ...formData, modifiers: newModifiers });
  };

  const updateModifierOption = (
    modifierIndex: number,
    optionIndex: number,
    field: string,
    value: any
  ) => {
    const newModifiers = [...formData.modifiers];
    newModifiers[modifierIndex].options[optionIndex] = {
      ...newModifiers[modifierIndex].options[optionIndex],
      [field]: value,
    };
    setFormData({ ...formData, modifiers: newModifiers });
  };

  // Add-on management
  const addAddOn = () => {
    setFormData({
      ...formData,
      addOns: [...formData.addOns, { name: '', price: 0 }],
    });
  };

  const removeAddOn = (index: number) => {
    const newAddOns = formData.addOns.filter((_, i) => i !== index);
    setFormData({ ...formData, addOns: newAddOns });
  };

  const updateAddOn = (index: number, field: string, value: any) => {
    const newAddOns = [...formData.addOns];
    newAddOns[index] = { ...newAddOns[index], [field]: value };
    setFormData({ ...formData, addOns: newAddOns });
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

            {/* Branch Selection - Only for new menu items */}
            {!menuItem && (
              <div className="space-y-4">
                <h3 className="font-semibold">Branch Assignment *</h3>
                <BranchSelectionComponent
                  branches={branches}
                  selectedBranches={selectedBranches}
                  onChange={handleBranchSelectionChange}
                  userBranchIds={userBranchIds}
                />
              </div>
            )}

            {/* Branch Configuration - Only for new menu items with selected branches */}
            {!menuItem && selectedBranches.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Branch Configuration</h3>
                <div className="space-y-2">
                  {selectedBranches.map((branchId) => {
                    const branch = branches.find((b) => b._id === branchId);
                    const config = branchConfigs.get(branchId);
                    if (!branch || !config) return null;
                    
                    return (
                      <BranchConfigurationAccordion
                        key={branchId}
                        branch={branch}
                        config={config}
                        isEditable={canEditBranch(branchId)}
                        onChange={(newConfig) => handleBranchConfigChange(branchId, newConfig)}
                        onCopyToOthers={() => handleCopyToAllBranches(branchId)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modifiers */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Modifiers</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addModifier}
                  disabled={loading}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Modifier
                </Button>
              </div>
              {formData.modifiers.map((modifier, modifierIndex) => (
                <div
                  key={modifierIndex}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={modifier.name}
                      onChange={(e) =>
                        updateModifier(modifierIndex, 'name', e.target.value)
                      }
                      placeholder="Modifier name (e.g., Spice Level)"
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeModifier(modifierIndex)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="ml-4 space-y-2">
                    {modifier.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <Input
                          value={option.name}
                          onChange={(e) =>
                            updateModifierOption(
                              modifierIndex,
                              optionIndex,
                              'name',
                              e.target.value
                            )
                          }
                          placeholder="Option name"
                          className="flex-1"
                          disabled={loading}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={option.price}
                          onChange={(e) =>
                            updateModifierOption(
                              modifierIndex,
                              optionIndex,
                              'price',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="Price"
                          className="w-32"
                          disabled={loading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            removeModifierOption(modifierIndex, optionIndex)
                          }
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addModifierOption(modifierIndex)}
                      disabled={loading}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add-ons */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Add-ons</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAddOn}
                  disabled={loading}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Add-on
                </Button>
              </div>
              {formData.addOns.map((addOn, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={addOn.name}
                    onChange={(e) => updateAddOn(index, 'name', e.target.value)}
                    placeholder="Add-on name (e.g., Extra Rice)"
                    className="flex-1"
                    disabled={loading}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addOn.price}
                    onChange={(e) =>
                      updateAddOn(index, 'price', parseFloat(e.target.value) || 0)
                    }
                    placeholder="Price"
                    className="w-32"
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAddOn(index)}
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

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
    </Dialog>
  );
}
