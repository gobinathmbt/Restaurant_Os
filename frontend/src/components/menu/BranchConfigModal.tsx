import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Clock, Search, X, CheckCircle2, XCircle } from 'lucide-react';
import type { BranchModifier, BranchModifierOption, AddOnMenuItem } from '@/types/menu';
import { menuItemBranchServices } from '@/api/services';
import { useToast } from '@/hooks/use-toast';

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
  // NEW: Branch-specific modifiers
  modifiers?: BranchModifier[];
  // NEW: Branch-specific add-ons (MenuItem IDs)
  addOns?: string[];
}

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface BranchConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: Branch;
  config: BranchConfig;
  onChange: (config: BranchConfig) => void;
  isEditable?: boolean;
  // NEW: Props for add-on management
  menuItemId?: string;
  menuItemBranchId?: string;
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

const CHANNELS = [
  { value: 'dine_in', label: 'Dine In' },
  { value: 'takeaway', label: 'Takeaway' },
  { value: 'online', label: 'Online' },
  { value: 'delivery', label: 'Delivery' },
];

export default function BranchConfigModal({
  isOpen,
  onClose,
  branch,
  config,
  onChange,
  isEditable = true,
  menuItemId,
  menuItemBranchId,
}: BranchConfigModalProps) {
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState<BranchConfig>(config);
  
  // Add-on management state
  const [availableAddOns, setAvailableAddOns] = useState<AddOnMenuItem[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<AddOnMenuItem[]>([]);
  const [addOnSearchTerm, setAddOnSearchTerm] = useState('');
  const [isLoadingAddOns, setIsLoadingAddOns] = useState(false);
  const [showAddOnSearch, setShowAddOnSearch] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
    console.log( isOpen, menuItemBranchId, branch._id)
    // Load available add-ons if menuItemBranchId is provided
    if (isOpen && menuItemBranchId && branch._id) {
      fetchAvailableAddOns();
    }
  }, [config, isOpen, menuItemBranchId, branch._id]);

  const fetchAvailableAddOns = async () => {
    if (!menuItemBranchId) return;
    
    try {
      setIsLoadingAddOns(true);
      const response = await menuItemBranchServices.getAvailableAddOns(
        menuItemBranchId,
        { branchId: branch._id, search: addOnSearchTerm }
      );
      
      const addOns = response.data.data || [];
      setAvailableAddOns(addOns);
      
      // Load currently selected add-ons details
      if (localConfig.addOns && localConfig.addOns.length > 0) {
        const selected = addOns.filter((addOn: AddOnMenuItem) => 
          localConfig.addOns?.includes(addOn._id)
        );
        setSelectedAddOns(selected);
      }
    } catch (error: any) {
      const status = error.response?.status || error.status;
      const message = error.response?.data?.message || error.message;
      
      if (status === 404) {
        toast({
          title: 'Not Found',
          description: message || 'Menu item branch configuration not found',
          variant: 'destructive',
        });
      } else if (status === 403) {
        toast({
          title: 'Access Denied',
          description: message || 'You do not have permission to access this branch',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: message || 'Failed to load available add-ons',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoadingAddOns(false);
    }
  };

  // Debounced search for add-ons
  useEffect(() => {
    if (showAddOnSearch && menuItemBranchId) {
      const timer = setTimeout(() => {
        fetchAvailableAddOns();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [addOnSearchTerm, showAddOnSearch]);

  const handleSave = () => {
    // Validate modifiers
    if (localConfig.modifiers && localConfig.modifiers.length > 0) {
      for (const modifier of localConfig.modifiers) {
        if (!modifier.name || modifier.name.trim() === '') {
          toast({
            title: 'Validation Error',
            description: 'All modifiers must have a name',
            variant: 'destructive',
          });
          return;
        }
        
        if (!modifier.options || modifier.options.length === 0) {
          toast({
            title: 'Validation Error',
            description: `Modifier "${modifier.name}" must have at least one option`,
            variant: 'destructive',
          });
          return;
        }
        
        for (const option of modifier.options) {
          if (!option.name || option.name.trim() === '') {
            toast({
              title: 'Validation Error',
              description: `All options in modifier "${modifier.name}" must have a name`,
              variant: 'destructive',
            });
            return;
          }
          
          if (option.price < 0) {
            toast({
              title: 'Validation Error',
              description: `Option "${option.name}" in modifier "${modifier.name}" cannot have a negative price`,
              variant: 'destructive',
            });
            return;
          }
        }
      }
    }
    
    onChange(localConfig);
    onClose();
  };

  const handleChannelToggle = (channel: string) => {
    const newChannels = localConfig.channels.includes(channel)
      ? localConfig.channels.filter((c) => c !== channel)
      : [...localConfig.channels, channel];
    setLocalConfig({ ...localConfig, channels: newChannels });
  };

  const addTimeBasedPricing = () => {
    setLocalConfig({
      ...localConfig,
      timeBasedPricing: [
        ...localConfig.timeBasedPricing,
        {
          name: '',
          startTime: '09:00',
          endTime: '17:00',
          days: [],
          price: localConfig.price,
          isActive: true,
        },
      ],
    });
  };

  const removeTimeBasedPricing = (index: number) => {
    setLocalConfig({
      ...localConfig,
      timeBasedPricing: localConfig.timeBasedPricing.filter((_, i) => i !== index),
    });
  };

  const updateTimeBasedPricing = (index: number, field: string, value: any) => {
    const newPricing = [...localConfig.timeBasedPricing];
    newPricing[index] = { ...newPricing[index], [field]: value };
    setLocalConfig({ ...localConfig, timeBasedPricing: newPricing });
  };

  const toggleTimeBasedPricingDay = (pricingIndex: number, day: string) => {
    const pricing = localConfig.timeBasedPricing[pricingIndex];
    const newDays = pricing.days.includes(day)
      ? pricing.days.filter((d) => d !== day)
      : [...pricing.days, day];
    updateTimeBasedPricing(pricingIndex, 'days', newDays);
  };

  const addAvailabilitySchedule = () => {
    setLocalConfig({
      ...localConfig,
      availability: {
        schedule: [
          ...localConfig.availability.schedule,
          {
            startTime: '09:00',
            endTime: '22:00',
            days: [],
          },
        ],
      },
    });
  };

  const removeAvailabilitySchedule = (index: number) => {
    setLocalConfig({
      ...localConfig,
      availability: {
        schedule: localConfig.availability.schedule.filter((_, i) => i !== index),
      },
    });
  };

  const updateAvailabilitySchedule = (index: number, field: string, value: any) => {
    const newSchedule = [...localConfig.availability.schedule];
    newSchedule[index] = { ...newSchedule[index], [field]: value };
    setLocalConfig({
      ...localConfig,
      availability: { schedule: newSchedule },
    });
  };

  const toggleAvailabilityDay = (scheduleIndex: number, day: string) => {
    const schedule = localConfig.availability.schedule[scheduleIndex];
    const newDays = schedule.days.includes(day)
      ? schedule.days.filter((d) => d !== day)
      : [...schedule.days, day];
    updateAvailabilitySchedule(scheduleIndex, 'days', newDays);
  };

  // Modifier management functions
  const addModifier = () => {
    setLocalConfig({
      ...localConfig,
      modifiers: [
        ...(localConfig.modifiers || []),
        { name: '', options: [] },
      ],
    });
  };

  const removeModifier = (index: number) => {
    setLocalConfig({
      ...localConfig,
      modifiers: (localConfig.modifiers || []).filter((_, i) => i !== index),
    });
  };

  const updateModifier = (index: number, field: string, value: any) => {
    const newModifiers = [...(localConfig.modifiers || [])];
    newModifiers[index] = { ...newModifiers[index], [field]: value };
    setLocalConfig({ ...localConfig, modifiers: newModifiers });
  };

  const addModifierOption = (modifierIndex: number) => {
    const newModifiers = [...(localConfig.modifiers || [])];
    newModifiers[modifierIndex].options.push({ name: '', price: 0 });
    setLocalConfig({ ...localConfig, modifiers: newModifiers });
  };

  const removeModifierOption = (modifierIndex: number, optionIndex: number) => {
    const newModifiers = [...(localConfig.modifiers || [])];
    newModifiers[modifierIndex].options = newModifiers[modifierIndex].options.filter(
      (_, i) => i !== optionIndex
    );
    setLocalConfig({ ...localConfig, modifiers: newModifiers });
  };

  const updateModifierOption = (
    modifierIndex: number,
    optionIndex: number,
    field: string,
    value: any
  ) => {
    const newModifiers = [...(localConfig.modifiers || [])];
    newModifiers[modifierIndex].options[optionIndex] = {
      ...newModifiers[modifierIndex].options[optionIndex],
      [field]: value,
    };
    setLocalConfig({ ...localConfig, modifiers: newModifiers });
  };

  // Add-on management functions
  const handleAddOnSelect = (addOn: AddOnMenuItem) => {
    // Prevent self-reference
    if (menuItemId && addOn._id === menuItemId) {
      toast({
        title: 'Invalid Selection',
        description: 'A menu item cannot be added as an add-on to itself',
        variant: 'destructive',
      });
      return;
    }
    
    if (!localConfig.addOns?.includes(addOn._id)) {
      setLocalConfig({
        ...localConfig,
        addOns: [...(localConfig.addOns || []), addOn._id],
      });
      setSelectedAddOns([...selectedAddOns, addOn]);
      
      toast({
        title: 'Add-on Added',
        description: `${addOn.name} has been added as an add-on`,
        variant: 'success',
      });
    }
    setShowAddOnSearch(false);
    setAddOnSearchTerm('');
  };

  const handleAddOnRemove = (addOnId: string) => {
    const addOn = selectedAddOns.find(a => a._id === addOnId);
    setLocalConfig({
      ...localConfig,
      addOns: (localConfig.addOns || []).filter(id => id !== addOnId),
    });
    setSelectedAddOns(selectedAddOns.filter(addOn => addOn._id !== addOnId));
    
    if (addOn) {
      toast({
        title: 'Add-on Removed',
        description: `${addOn.name} has been removed from add-ons`,
        variant: 'success',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Configure: {branch.name} ({branch.code})
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Basic Configuration */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Basic Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Price (₹)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={localConfig.price}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={!isEditable}
                  />
                </div>
                <div>
                  <Label htmlFor="preparationTime">Preparation Time (min)</Label>
                  <Input
                    id="preparationTime"
                    type="number"
                    min="0"
                    value={localConfig.preparationTime}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        preparationTime: parseInt(e.target.value) || 0,
                      })
                    }
                    disabled={!isEditable}
                  />
                </div>
                <div>
                  <Label htmlFor="displayOrder">Display Order</Label>
                  <Input
                    id="displayOrder"
                    type="number"
                    min="0"
                    value={localConfig.displayOrder}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        displayOrder: parseInt(e.target.value) || 0,
                      })
                    }
                    disabled={!isEditable}
                  />
                </div>
                <div>
                  <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    min="0"
                    value={localConfig.lowStockThreshold || ''}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        lowStockThreshold: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="Optional"
                    disabled={!isEditable}
                  />
                </div>
                <div>
                  <Label htmlFor="taxRateOverride">Tax Rate Override (%)</Label>
                  <Input
                    id="taxRateOverride"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={localConfig.taxRateOverride || ''}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        taxRateOverride: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="Optional"
                    disabled={!isEditable}
                  />
                </div>
              </div>
            </div>

            {/* Status Toggles */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Status</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isAvailable"
                    checked={localConfig.isAvailable}
                    onCheckedChange={(checked) =>
                      setLocalConfig({
                        ...localConfig,
                        isAvailable: checked as boolean,
                      })
                    }
                    disabled={!isEditable}
                  />
                  <Label htmlFor="isAvailable" className="cursor-pointer">
                    Available
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requiresKitchen"
                    checked={localConfig.requiresKitchen}
                    onCheckedChange={(checked) =>
                      setLocalConfig({
                        ...localConfig,
                        requiresKitchen: checked as boolean,
                      })
                    }
                    disabled={!isEditable}
                  />
                  <Label htmlFor="requiresKitchen" className="cursor-pointer">
                    Requires Kitchen
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="outOfStock"
                    checked={localConfig.outOfStock}
                    onCheckedChange={(checked) =>
                      setLocalConfig({
                        ...localConfig,
                        outOfStock: checked as boolean,
                      })
                    }
                    disabled={!isEditable}
                  />
                  <Label htmlFor="outOfStock" className="cursor-pointer">
                    Out of Stock
                  </Label>
                </div>
              </div>
            </div>

            {/* Channels */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Sales Channels</h3>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((channel) => (
                  <Badge
                    key={channel.value}
                    variant={
                      localConfig.channels.includes(channel.value)
                        ? 'default'
                        : 'outline'
                    }
                    className="cursor-pointer"
                    onClick={() => isEditable && handleChannelToggle(channel.value)}
                  >
                    {channel.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Modifiers - Branch Specific */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Modifiers (Branch-Specific)</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addModifier}
                  disabled={!isEditable}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Modifier
                </Button>
              </div>
              {(localConfig.modifiers || []).map((modifier, modifierIndex) => (
                <div
                  key={modifierIndex}
                  className="border rounded-lg p-3 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={modifier.name}
                      onChange={(e) =>
                        updateModifier(modifierIndex, 'name', e.target.value)
                      }
                      placeholder="Modifier name (e.g., Size)"
                      disabled={!isEditable}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeModifier(modifierIndex)}
                      disabled={!isEditable}
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
                          disabled={!isEditable}
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
                          disabled={!isEditable}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            removeModifierOption(modifierIndex, optionIndex)
                          }
                          disabled={!isEditable}
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
                      disabled={!isEditable}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add-ons - Menu Item Based (Branch Specific) */}
            {menuItemBranchId && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Add-ons (Branch-Specific)</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddOnSearch(!showAddOnSearch)}
                    disabled={!isEditable}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Menu Item
                  </Button>
                </div>

                {/* Add-on Search */}
                {showAddOnSearch && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={addOnSearchTerm}
                          onChange={(e) => setAddOnSearchTerm(e.target.value)}
                          placeholder="Search menu items..."
                          className="pl-9"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowAddOnSearch(false);
                          setAddOnSearchTerm('');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Available Add-ons List */}
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {isLoadingAddOns ? (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          Loading menu items...
                        </div>
                      ) : availableAddOns.length === 0 ? (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          No menu items found
                        </div>
                      ) : (
                        availableAddOns
                          .filter(addOn => !localConfig.addOns?.includes(addOn._id))
                          .map((addOn) => (
                            <div
                              key={addOn._id}
                              className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer"
                              onClick={() => handleAddOnSelect(addOn)}
                            >
                              <div className="flex-1">
                                <p className="font-medium text-sm">{addOn.name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>₹{addOn.basePrice.toFixed(2)}</span>
                                  {addOn.hasRecipe ? (
                                    <Badge variant="outline" className="text-xs">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Has Recipe
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      No Recipe
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddOnSelect(addOn);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                )}

                {/* Selected Add-ons */}
                {selectedAddOns.length > 0 && (
                  <div className="space-y-2">
                    {selectedAddOns.map((addOn) => (
                      <div
                        key={addOn._id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{addOn.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>₹{addOn.basePrice.toFixed(2)}</span>
                            {addOn.hasRecipe ? (
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Has Recipe
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                <XCircle className="h-3 w-3 mr-1" />
                                No Recipe
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddOnRemove(addOn._id)}
                          disabled={!isEditable}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedAddOns.length === 0 && !showAddOnSearch && (
                  <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg">
                    No add-ons configured. Click "Add Menu Item" to add add-ons.
                  </div>
                )}
              </div>
            )}

            {/* Time-Based Pricing */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Time-Based Pricing</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTimeBasedPricing}
                  disabled={!isEditable}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
              {localConfig.timeBasedPricing.map((pricing, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={pricing.name}
                      onChange={(e) =>
                        updateTimeBasedPricing(index, 'name', e.target.value)
                      }
                      placeholder="Pricing name (e.g., Lunch Special)"
                      className="flex-1"
                      disabled={!isEditable}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTimeBasedPricing(index)}
                      disabled={!isEditable}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Start Time</Label>
                      <Input
                        type="time"
                        value={pricing.startTime}
                        onChange={(e) =>
                          updateTimeBasedPricing(index, 'startTime', e.target.value)
                        }
                        disabled={!isEditable}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">End Time</Label>
                      <Input
                        type="time"
                        value={pricing.endTime}
                        onChange={(e) =>
                          updateTimeBasedPricing(index, 'endTime', e.target.value)
                        }
                        disabled={!isEditable}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Price (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={pricing.price}
                        onChange={(e) =>
                          updateTimeBasedPricing(
                            index,
                            'price',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        disabled={!isEditable}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Days</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {DAYS_OF_WEEK.map((day) => (
                        <Badge
                          key={day.value}
                          variant={
                            pricing.days.includes(day.value) ? 'default' : 'outline'
                          }
                          className="cursor-pointer text-xs"
                          onClick={() =>
                            isEditable && toggleTimeBasedPricingDay(index, day.value)
                          }
                        >
                          {day.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`pricing-active-${index}`}
                      checked={pricing.isActive}
                      onCheckedChange={(checked) =>
                        updateTimeBasedPricing(index, 'isActive', checked as boolean)
                      }
                      disabled={!isEditable}
                    />
                    <Label
                      htmlFor={`pricing-active-${index}`}
                      className="cursor-pointer text-sm"
                    >
                      Active
                    </Label>
                  </div>
                </div>
              ))}
            </div>

            {/* Availability Schedule */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Availability Schedule</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAvailabilitySchedule}
                  disabled={!isEditable}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
              {localConfig.availability.schedule.map((schedule, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Schedule {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAvailabilitySchedule(index)}
                      disabled={!isEditable}
                      className="ml-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Start Time</Label>
                      <Input
                        type="time"
                        value={schedule.startTime}
                        onChange={(e) =>
                          updateAvailabilitySchedule(index, 'startTime', e.target.value)
                        }
                        disabled={!isEditable}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">End Time</Label>
                      <Input
                        type="time"
                        value={schedule.endTime}
                        onChange={(e) =>
                          updateAvailabilitySchedule(index, 'endTime', e.target.value)
                        }
                        disabled={!isEditable}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Days</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {DAYS_OF_WEEK.map((day) => (
                        <Badge
                          key={day.value}
                          variant={
                            schedule.days.includes(day.value) ? 'default' : 'outline'
                          }
                          className="cursor-pointer text-xs"
                          onClick={() =>
                            isEditable && toggleAvailabilityDay(index, day.value)
                          }
                        >
                          {day.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!isEditable}>
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
