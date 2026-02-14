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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Plus, Trash2, Check, ChevronsUpDown, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inventoryItemBranchServices } from '@/api/services';
import { useToast } from '@/hooks/use-toast';

interface Ingredient {
  inventoryItemBranch: string;
  quantity: number;
  unit: string;
}

interface RecipeBranchConfig {
  ingredients: Ingredient[];
  yield: {
    quantity: number;
    unit: string;
  };
  preparationTime?: number;
  cookingTime?: number;
  costPerUnit?: number;
  isActive: boolean;
  notes?: string;
}

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface InventoryItemBranch {
  _id: string;
  inventoryItem: {
    _id: string;
    name: string;
    unit: string;
  };
  costPrice?: number;
  currentStock: number;
  isActive: boolean;
}

interface RecipeBranchConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: Branch;
  config: RecipeBranchConfig;
  onChange: (config: RecipeBranchConfig) => void;
  isEditable?: boolean;
}

const UNIT_OPTIONS = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'gram', label: 'Gram (g)' },
  { value: 'liter', label: 'Liter (L)' },
  { value: 'ml', label: 'Milliliter (ml)' },
  { value: 'piece', label: 'Piece' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'packet', label: 'Packet' },
  { value: 'serving', label: 'Serving' },
];

export default function RecipeBranchConfigModal({
  isOpen,
  onClose,
  branch,
  config,
  onChange,
  isEditable = true,
}: RecipeBranchConfigModalProps) {
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState<RecipeBranchConfig>(config);
  const [availableInventoryItems, setAvailableInventoryItems] = useState<InventoryItemBranch[]>([]);
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [showInventorySearch, setShowInventorySearch] = useState(false);

  // Initialize localConfig when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
    }
  }, [isOpen, config]);

  // Recalculate cost when ingredients or yield change
  useEffect(() => {
    if (isOpen && availableInventoryItems.length > 0) {
      const newCost = calculateCost();
      if (newCost !== localConfig.costPerUnit) {
        setLocalConfig((prev) => ({
          ...prev,
          costPerUnit: newCost,
        }));
      }
    }
  }, [localConfig.ingredients, localConfig.yield, availableInventoryItems, isOpen]);

  // Fetch available inventory items for the branch
  const fetchAvailableInventoryItems = async () => {
    if (!branch._id) {
      return;
    }

    try {
      setIsLoadingInventory(true);
      const response = await inventoryItemBranchServices.getInventoryItemsForBranch(
        branch._id,
        { 
          search: inventorySearchTerm,
          limit: 100,
          isActive: true
        }
      );

      const items = response.data.data.items || [];
      setAvailableInventoryItems(items);
    } catch (error: any) {
      console.error('Error fetching inventory items:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load inventory items',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingInventory(false);
    }
  };

  // Fetch inventory items when search is opened
  useEffect(() => {
    if (showInventorySearch && branch._id) {
      if (availableInventoryItems.length === 0) {
        fetchAvailableInventoryItems();
      }
    }
  }, [showInventorySearch]);

  // Debounced search for inventory items
  useEffect(() => {
    if (showInventorySearch && branch._id) {
      const timer = setTimeout(() => {
        fetchAvailableInventoryItems();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [inventorySearchTerm]);

  const handleInventoryItemSelect = (item: InventoryItemBranch) => {
    // Check if already added
    const isAlreadyAdded = localConfig.ingredients.some(
      (ing) => ing.inventoryItemBranch === item._id
    );

    if (isAlreadyAdded) {
      toast({
        title: 'Already Added',
        description: 'This ingredient is already in the recipe',
        variant: 'default',
      });
      return;
    }

    // Add new ingredient
    const newIngredient: Ingredient = {
      inventoryItemBranch: item._id,
      quantity: 1,
      unit: item.inventoryItem.unit,
    };

    setLocalConfig({
      ...localConfig,
      ingredients: [...localConfig.ingredients, newIngredient],
    });

    toast({
      title: 'Ingredient Added',
      description: `${item.inventoryItem.name} has been added`,
      variant: 'success',
    });

    setShowInventorySearch(false);
  };

  const handleIngredientChange = (index: number, field: keyof Ingredient, value: any) => {
    const updatedIngredients = [...localConfig.ingredients];
    updatedIngredients[index] = { ...updatedIngredients[index], [field]: value };
    setLocalConfig({ ...localConfig, ingredients: updatedIngredients });
  };

  const removeIngredient = (index: number) => {
    setLocalConfig({
      ...localConfig,
      ingredients: localConfig.ingredients.filter((_, i) => i !== index),
    });
  };

  const calculateCost = () => {
    if (!localConfig.ingredients || localConfig.ingredients.length === 0) {
      return 0;
    }

    if (!localConfig.yield || !localConfig.yield.quantity || localConfig.yield.quantity === 0) {
      return 0;
    }

    let totalCost = 0;
    for (const ingredient of localConfig.ingredients) {
      const inventoryItem = availableInventoryItems.find(
        (item) => item._id === ingredient.inventoryItemBranch
      );
      if (inventoryItem && inventoryItem.costPrice) {
        totalCost += ingredient.quantity * inventoryItem.costPrice;
      }
    }

    return totalCost / localConfig.yield.quantity;
  };

  const getIngredientDetails = (inventoryItemBranchId: string) => {
    return availableInventoryItems.find((item) => item._id === inventoryItemBranchId);
  };

  const handleRecalculateCost = async () => {
    // Refresh inventory items to get latest costs
    await fetchAvailableInventoryItems();
    
    const newCost = calculateCost();
    setLocalConfig({
      ...localConfig,
      costPerUnit: newCost,
    });

    toast({
      title: 'Cost Recalculated',
      description: `New cost per unit: ₹${newCost.toFixed(2)}`,
      variant: 'success',
    });
  };

  const validateForm = () => {
    if (localConfig.ingredients.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'At least one ingredient is required',
        variant: 'destructive',
      });
      return false;
    }

    for (let i = 0; i < localConfig.ingredients.length; i++) {
      const ing = localConfig.ingredients[i];
      
      if (!ing.inventoryItemBranch) {
        toast({
          title: 'Validation Error',
          description: `Ingredient ${i + 1}: Inventory item is required`,
          variant: 'destructive',
        });
        return false;
      }

      if (ing.quantity <= 0) {
        toast({
          title: 'Validation Error',
          description: `Ingredient ${i + 1}: Quantity must be greater than 0`,
          variant: 'destructive',
        });
        return false;
      }

      if (!ing.unit || ing.unit.trim() === '') {
        toast({
          title: 'Validation Error',
          description: `Ingredient ${i + 1}: Unit is required`,
          variant: 'destructive',
        });
        return false;
      }
    }

    if (!localConfig.yield.quantity || localConfig.yield.quantity <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Yield quantity must be greater than 0',
        variant: 'destructive',
      });
      return false;
    }

    if (!localConfig.yield.unit || localConfig.yield.unit.trim() === '') {
      toast({
        title: 'Validation Error',
        description: 'Yield unit is required',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    // Calculate and update cost before saving
    const calculatedCost = calculateCost();
    const configToSave = {
      ...localConfig,
      costPerUnit: calculatedCost,
    };

    onChange(configToSave);
    onClose();
  };

  const totalTime = (localConfig.preparationTime || 0) + (localConfig.cookingTime || 0);
  const calculatedCost = calculateCost();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Configure Recipe: {branch.name} ({branch.code})
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Ingredients Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Ingredients</h3>
                <Popover open={showInventorySearch} onOpenChange={setShowInventorySearch}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!isEditable}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Ingredient
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search inventory items..."
                        value={inventorySearchTerm}
                        onValueChange={setInventorySearchTerm}
                      />
                      <CommandEmpty>
                        {isLoadingInventory
                          ? 'Searching...'
                          : inventorySearchTerm
                            ? `No items found matching "${inventorySearchTerm}"`
                            : 'No inventory items available'}
                      </CommandEmpty>
                      <CommandList>
                        <CommandGroup>
                          {isLoadingInventory ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              Loading inventory items...
                            </div>
                          ) : (
                            availableInventoryItems.map((item) => (
                              <CommandItem
                                key={item._id}
                                value={`${item.inventoryItem.name} ${item.inventoryItem.unit}`}
                                onSelect={() => handleInventoryItemSelect(item)}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    localConfig.ingredients.some(
                                      (ing) => ing.inventoryItemBranch === item._id
                                    )
                                      ? 'opacity-100'
                                      : 'opacity-0'
                                  )}
                                />
                                <div className="flex-1">
                                  <p className="font-medium text-sm">
                                    {item.inventoryItem.name}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>Unit: {item.inventoryItem.unit}</span>
                                    {item.costPrice && (
                                      <span>• Cost: ₹{item.costPrice.toFixed(2)}</span>
                                    )}
                                    <span>• Stock: {item.currentStock}</span>
                                  </div>
                                </div>
                              </CommandItem>
                            ))
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {localConfig.ingredients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  No ingredients added yet. Click "Add Ingredient" to start.
                </div>
              ) : (
                <div className="space-y-3">
                  {localConfig.ingredients.map((ingredient, index) => {
                    const itemDetails = getIngredientDetails(ingredient.inventoryItemBranch);
                    return (
                      <div key={index} className="border rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {itemDetails?.inventoryItem.name || 'Unknown Item'}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeIngredient(index)}
                            disabled={!isEditable}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Quantity</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={ingredient.quantity || ''}
                              onChange={(e) =>
                                handleIngredientChange(
                                  index,
                                  'quantity',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              disabled={!isEditable}
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Unit</Label>
                            <Select
                              value={ingredient.unit}
                              onValueChange={(value) =>
                                handleIngredientChange(index, 'unit', value)
                              }
                              disabled={!isEditable}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UNIT_OPTIONS.map((unit) => (
                                  <SelectItem key={unit.value} value={unit.value}>
                                    {unit.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs">Cost</Label>
                            <Input
                              value={
                                itemDetails?.costPrice
                                  ? `₹${(ingredient.quantity * itemDetails.costPrice).toFixed(2)}`
                                  : 'N/A'
                              }
                              readOnly
                              className="bg-muted"
                            />
                          </div>
                        </div>

                        {itemDetails?.costPrice && (
                          <div className="text-xs text-muted-foreground">
                            Cost per unit: ₹{itemDetails.costPrice.toFixed(2)}/{itemDetails.inventoryItem.unit}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Yield Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Yield</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="yieldQuantity">Quantity</Label>
                  <Input
                    id="yieldQuantity"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={localConfig.yield.quantity || ''}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        yield: {
                          ...localConfig.yield,
                          quantity: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    disabled={!isEditable}
                  />
                </div>
                <div>
                  <Label htmlFor="yieldUnit">Unit</Label>
                  <Select
                    value={localConfig.yield.unit}
                    onValueChange={(value) =>
                      setLocalConfig({
                        ...localConfig,
                        yield: { ...localConfig.yield, unit: value },
                      })
                    }
                    disabled={!isEditable}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Timing Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Timing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="preparationTime">Preparation Time (minutes)</Label>
                  <Input
                    id="preparationTime"
                    type="number"
                    min="0"
                    value={localConfig.preparationTime || ''}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        preparationTime: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="0"
                    disabled={!isEditable}
                  />
                </div>
                <div>
                  <Label htmlFor="cookingTime">Cooking Time (minutes)</Label>
                  <Input
                    id="cookingTime"
                    type="number"
                    min="0"
                    value={localConfig.cookingTime || ''}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        cookingTime: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="0"
                    disabled={!isEditable}
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Total Time: {totalTime} minutes
              </div>
            </div>

            {/* Cost Display */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Cost Breakdown</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRecalculateCost}
                  disabled={!isEditable}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recalculate
                </Button>
              </div>

              <div className="border rounded-lg p-4 space-y-3 bg-primary/5">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Ingredient Costs:</Label>
                  {localConfig.ingredients.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No ingredients added</p>
                  ) : (
                    <div className="space-y-1">
                      {localConfig.ingredients.map((ingredient, index) => {
                        const itemDetails = getIngredientDetails(ingredient.inventoryItemBranch);
                        const cost = itemDetails?.costPrice
                          ? ingredient.quantity * itemDetails.costPrice
                          : 0;
                        return (
                          <div key={index} className="flex justify-between text-sm">
                            <span>
                              {itemDetails?.inventoryItem.name || 'Unknown'} ({ingredient.quantity}{' '}
                              {ingredient.unit})
                            </span>
                            <span>
                              {itemDetails?.costPrice ? `₹${cost.toFixed(2)}` : 'N/A'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Total Cost:</span>
                    <span className="font-medium">
                      ₹
                      {localConfig.ingredients
                        .reduce((sum, ing) => {
                          const itemDetails = getIngredientDetails(ing.inventoryItemBranch);
                          return sum + (itemDetails?.costPrice ? ing.quantity * itemDetails.costPrice : 0);
                        }, 0)
                        .toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Yield:</span>
                    <span>
                      {localConfig.yield.quantity} {localConfig.yield.unit}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-primary">
                    <span>Cost Per Unit:</span>
                    <span>
                      {calculatedCost > 0 ? `₹${calculatedCost.toFixed(2)}` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Status</h3>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  checked={localConfig.isActive}
                  onCheckedChange={(checked) =>
                    setLocalConfig({
                      ...localConfig,
                      isActive: checked as boolean,
                    })
                  }
                  disabled={!isEditable}
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Notes</h3>
              <Input
                value={localConfig.notes || ''}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    notes: e.target.value,
                  })
                }
                placeholder="Branch-specific notes..."
                disabled={!isEditable}
              />
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
