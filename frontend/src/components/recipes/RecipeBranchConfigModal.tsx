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
import { Plus, Trash2, Check, ChevronsUpDown, RefreshCw, TrendingUp, TrendingDown, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inventoryItemBranchServices, menuItemBranchServices, menuItemServices } from '@/api/services';
import { useToast } from '@/hooks/use-toast';
import UnitConversionModal from './UnitConversionModal';

interface Ingredient {
  // can be stored as a branch-config id string or a populated object with _id
  inventoryItemBranch: string | { _id?: string };
  quantity: number;
  unit: string;
  conversionFactor?: number;
  overrideCostPerUnit?: number;
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

interface InventoryItemWithBranch {
  _id: string;
  name: string;
  unit: string;
  type: string;
  branchConfig: {
    _id: string;
    currentStock: number;
    minimumStock: number;
    costPrice?: number;
    isAvailable: boolean;
    isActive: boolean;
  };
  isActive: boolean;
}

interface RecipeBranchConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: Branch;
  config: RecipeBranchConfig;
  onChange: (config: RecipeBranchConfig) => void;
  isEditable?: boolean;
  menuItemId?: string; // ID of the finished good (menu item)
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
  menuItemId,
}: RecipeBranchConfigModalProps) {
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState<RecipeBranchConfig>(config);
  const [availableInventoryItems, setAvailableInventoryItems] = useState<InventoryItemWithBranch[]>([]);
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [showInventorySearch, setShowInventorySearch] = useState(false);
  
  // Menu item pricing state
  const [menuItemPrice, setMenuItemPrice] = useState<number | null>(null);
  const [isLoadingMenuPrice, setIsLoadingMenuPrice] = useState(false);
  const [priceSource, setPriceSource] = useState<'branch' | 'base' | null>(null);
  
  // Unit conversion modal state - for individual ingredient
  const [showUnitConversionModal, setShowUnitConversionModal] = useState(false);
  const [selectedIngredientIndex, setSelectedIngredientIndex] = useState<number | null>(null);

  // Fetch menu item price when modal opens
  useEffect(() => {
    if (isOpen && menuItemId && branch._id) {
      fetchMenuItemPrice();
    }
  }, [isOpen, menuItemId, branch._id]);

  const fetchMenuItemPrice = async () => {
    if (!menuItemId || !branch._id) return;

    try {
      setIsLoadingMenuPrice(true);
      
      // First try to get branch-specific price
      try {
        const branchResponse = await menuItemBranchServices.getMenuItemsForBranch(branch._id, {
          limit: 1000,
        });
        const items = branchResponse.data.data.menuItems || [];
        const menuItem = items.find((item: any) => item._id === menuItemId);
        
        if (menuItem && menuItem.branchConfig && menuItem.branchConfig.price) {
          setMenuItemPrice(menuItem.branchConfig.price);
          setPriceSource('branch');
          return;
        }
      } catch (error) {
        // If branch-specific fetch fails, fall through to base price
      }

      // If no branch-specific price, get base price
      const response = await menuItemServices.getMenuItemById(menuItemId);
      const menuItem = response.data.data.menuItem;
      
      if (menuItem && menuItem.basePrice) {
        setMenuItemPrice(menuItem.basePrice);
        setPriceSource('base');
      }
    } catch (error: any) {
      console.error('Error fetching menu item price:', error);
      // Don't show error toast, just silently fail
    } finally {
      setIsLoadingMenuPrice(false);
    }
  };

  // Initialize localConfig when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
    }
  }, [isOpen]); // Only reset when modal opens, not when config changes



  // Helper to resolve inventoryItemBranch id whether stored as string or object
  const resolveBranchId = (val: string | { _id?: string } | undefined | null) => {
    if (!val) return '';
    return typeof val === 'string' ? val : (val as any)._id || '';
  };

  // When modal opens, ensure we have details for ingredients that may not be in the paged list
  useEffect(() => {
    if (!isOpen) return;

    const fetchMissingIngredients = async () => {
      if (!localConfig || !localConfig.ingredients || localConfig.ingredients.length === 0) return;

      const missingIds = localConfig.ingredients
        .map((ing) => resolveBranchId(ing.inventoryItemBranch))
        .filter(Boolean)
        .filter((id) => !availableInventoryItems.some(item => item.branchConfig && item.branchConfig._id === id));

      if (missingIds.length === 0) return;

      try {
        // Fetch all missing ids in a single batch request
        const resp = await inventoryItemBranchServices.getInventoryItemBranchesByIds(branch._id, missingIds);
        const items = resp.data?.data?.items || [];
        const fetched: InventoryItemWithBranch[] = items.map((item: any) => ({
          _id: item.inventoryItem?._id || item._id,
          name: item.inventoryItem?.name || '',
          unit: item.inventoryItem?.unit || 'piece',
          type: item.inventoryItem?.type || 'raw_material',
          branchConfig: {
            _id: item._id,
            currentStock: item.currentStock || 0,
            minimumStock: item.minimumStock || 0,
            costPrice: item.costPrice,
            isAvailable: item.isAvailable || false,
            isActive: item.isActive || false,
          },
          isActive: item.inventoryItem?.isActive ?? true,
        }));

        if (fetched.length > 0) setAvailableInventoryItems((prev) => [...fetched, ...prev]);
      } catch (err) {
        // noop
      }
    };

    fetchMissingIngredients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
      console.error('❌ Error fetching inventory items:', error);
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

  // Fetch inventory items when modal opens so existing ingredients can be resolved
  useEffect(() => {
    if (isOpen && branch._id) {
      // Only fetch if we don't already have items or if config refers to items
      if (availableInventoryItems.length === 0) {
        fetchAvailableInventoryItems();
      }
    }
  }, [isOpen, branch._id]);

  // Debounced search for inventory items
  useEffect(() => {
    if (showInventorySearch && branch._id) {
      const timer = setTimeout(() => {
        fetchAvailableInventoryItems();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [inventorySearchTerm]);

  const handleInventoryItemSelect = (item: InventoryItemWithBranch) => {
    // Check if already added
    const isAlreadyAdded = localConfig.ingredients.some(
      (ing) => resolveBranchId(ing.inventoryItemBranch) === item.branchConfig._id
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
      inventoryItemBranch: item.branchConfig._id,
      quantity: 1,
      unit: item.unit,
    };

    // Use functional update to ensure state is updated correctly
    setLocalConfig((prev) => {
      const newState = {
        ...prev,
        ingredients: [...prev.ingredients, newIngredient],
      };
      return newState;
    });


    toast({
      title: 'Ingredient Added',
      description: `${item.name} has been added`,
      variant: 'success',
    });

    setShowInventorySearch(false);
  };

  const handleIngredientChange = (index: number, field: keyof Ingredient, value: any) => {
    setLocalConfig((prev) => {
      const updatedIngredients = [...prev.ingredients];
      updatedIngredients[index] = { ...updatedIngredients[index], [field]: value };
      return { ...prev, ingredients: updatedIngredients };
    });
  };

  const removeIngredient = (index: number) => {
    setLocalConfig((prev) => {
      const newIngredients = prev.ingredients.filter((_, i) => i !== index);
      return { ...prev, ingredients: newIngredients };
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
    for (let i = 0; i < localConfig.ingredients.length; i++) {
      const ingredient = localConfig.ingredients[i];
      
      // Check if override cost is set - this takes priority
      if (ingredient.overrideCostPerUnit !== undefined && ingredient.overrideCostPerUnit !== null) {
        const cost = ingredient.quantity * ingredient.overrideCostPerUnit;
        totalCost += cost;
        continue;
      }

      // Otherwise use inventory cost price
      const id = resolveBranchId(ingredient.inventoryItemBranch);
      const inventoryItem = availableInventoryItems.find(
        (item) => item.branchConfig._id === id
      );
            
      if (inventoryItem && inventoryItem.branchConfig.costPrice) {
        let effectiveCostPerUnit = inventoryItem.branchConfig.costPrice;
        const inventoryUnit = inventoryItem.unit.toLowerCase().trim();
        const recipeUnit = ingredient.unit.toLowerCase().trim();
        
        // If conversion factor is set, apply it
        if (ingredient.conversionFactor && ingredient.conversionFactor > 0) {
          effectiveCostPerUnit = inventoryItem.branchConfig.costPrice / ingredient.conversionFactor;
        } else if (inventoryUnit !== recipeUnit) {
          // Weight conversions
          if (inventoryUnit === 'kg' && recipeUnit === 'gram') {
            effectiveCostPerUnit = inventoryItem.branchConfig.costPrice / 1000;
          } else if (inventoryUnit === 'gram' && recipeUnit === 'kg') {
            effectiveCostPerUnit = inventoryItem.branchConfig.costPrice * 1000;
          }
          // Volume conversions
          else if (inventoryUnit === 'liter' && recipeUnit === 'ml') {
            effectiveCostPerUnit = inventoryItem.branchConfig.costPrice / 1000;
          } else if (inventoryUnit === 'ml' && recipeUnit === 'liter') {
            effectiveCostPerUnit = inventoryItem.branchConfig.costPrice * 1000;
          } else {
          }
        } else {
        }
        
        const cost = ingredient.quantity * effectiveCostPerUnit;
        totalCost += cost;
      } else {
      }
    }

    const costPerUnit = totalCost / localConfig.yield.quantity;
    return costPerUnit;
  };

  const handleUnitConversionApply = (conversionFactor?: number, overrideCost?: number) => {
    if (selectedIngredientIndex === null) {
      console.error('❌ No ingredient selected for conversion');
      return;
    }

    setLocalConfig((prev) => {
      const updatedIngredients = [...prev.ingredients];
      const currentIngredient = { ...updatedIngredients[selectedIngredientIndex] };
      
      // Only set conversionFactor if it's a valid number
      if (conversionFactor !== undefined && conversionFactor !== null && conversionFactor > 0) {
        currentIngredient.conversionFactor = conversionFactor;
      } else {
        // Remove conversionFactor if it's being cleared
        delete currentIngredient.conversionFactor;
      }
      
      // Only set overrideCostPerUnit if it's a valid number
      if (overrideCost !== undefined && overrideCost !== null && overrideCost >= 0) {
        currentIngredient.overrideCostPerUnit = overrideCost;
      } else {
        // Remove overrideCostPerUnit if it's being cleared
        delete currentIngredient.overrideCostPerUnit;
      }
      
      updatedIngredients[selectedIngredientIndex] = currentIngredient;

      return {
        ...prev,
        ingredients: updatedIngredients,
      };
    });

    toast({
      title: 'Conversion Applied',
      description: 'Unit conversion has been applied to the ingredient',
      variant: 'success',
    });
  };

  const openConversionModal = (index: number) => {
    setSelectedIngredientIndex(index);
    setShowUnitConversionModal(true);
  };

  const getIngredientDetails = (inventoryItemBranchId: string | { _id?: string }) => {
    const id = resolveBranchId(inventoryItemBranchId as any);
    return availableInventoryItems.find((item) => item.branchConfig._id === id);
  };

  const handleRecalculateCost = async () => {
    // Refresh inventory items to get latest costs
    await fetchAvailableInventoryItems();
    
    const newCost = calculateCost();
    setLocalConfig((prev) => ({
      ...prev,
      costPerUnit: newCost,
    }));

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
      console.error('❌ Validation failed');
      return;
    }
    
    // Calculate and update cost before saving
    const calculatedCost = calculateCost();
    
    // Normalize inventoryItemBranch to id strings before returning
    const normalizedIngredients = (localConfig.ingredients || []).map((ing, index) => {
      const normalized: any = {
        inventoryItemBranch: resolveBranchId(ing.inventoryItemBranch),
        quantity: ing.quantity,
        unit: ing.unit,
      };
      
      // Only include conversion factor if it's a valid number
      if (ing.conversionFactor !== undefined && ing.conversionFactor !== null && ing.conversionFactor > 0) {
        normalized.conversionFactor = ing.conversionFactor;
      }
      
      // Only include override cost if it's a valid number
      if (ing.overrideCostPerUnit !== undefined && ing.overrideCostPerUnit !== null && ing.overrideCostPerUnit >= 0) {
        normalized.overrideCostPerUnit = ing.overrideCostPerUnit;
      }
      
      return normalized;
    });

    const configToSave = {
      ...localConfig,
      ingredients: normalizedIngredients,
      costPerUnit: calculatedCost,
    } as RecipeBranchConfig;

    onChange(configToSave);
    onClose();
  };

  const totalTime = (localConfig.preparationTime || 0) + (localConfig.cookingTime || 0);
  const calculatedCost = calculateCost();

  return (
    <>
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
                                value={`${item.name} ${item.unit}`}
                                onSelect={() => handleInventoryItemSelect(item)}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    localConfig.ingredients.some(
                                      (ing) => ing.inventoryItemBranch === item.branchConfig._id
                                    )
                                      ? 'opacity-100'
                                      : 'opacity-0'
                                  )}
                                />
                                <div className="flex-1">
                                  <p className="font-medium text-sm">
                                    {item.name}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>Unit: {item.unit}</span>
                                    {item.branchConfig.costPrice && (
                                      <span>• Cost: ₹{item.branchConfig.costPrice.toFixed(2)}</span>
                                    )}
                                    <span>• Stock: {item.branchConfig.currentStock}</span>
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
                            {itemDetails?.name || 'Unknown Item'}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openConversionModal(index)}
                              disabled={!isEditable}
                              title="Smart Unit Conversion"
                            >
                              <Calculator className="h-4 w-4 text-blue-600" />
                            </Button>
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
                              value={(() => {
                                // Calculate cost with proper unit conversion
                                if (ingredient.overrideCostPerUnit !== undefined && ingredient.overrideCostPerUnit !== null) {
                                  return `₹${(ingredient.quantity * ingredient.overrideCostPerUnit).toFixed(2)}`;
                                }
                                
                                if (!itemDetails?.branchConfig.costPrice) {
                                  return 'N/A';
                                }
                                
                                let effectiveCostPerUnit = itemDetails.branchConfig.costPrice;
                                const inventoryUnit = itemDetails.unit.toLowerCase().trim();
                                const recipeUnit = ingredient.unit.toLowerCase().trim();
                                
                                // Apply conversion factor if set
                                if (ingredient.conversionFactor && ingredient.conversionFactor > 0) {
                                  effectiveCostPerUnit = itemDetails.branchConfig.costPrice / ingredient.conversionFactor;
                                } else if (inventoryUnit !== recipeUnit) {
                                  // Apply automatic conversion
                                  if (inventoryUnit === 'kg' && recipeUnit === 'gram') {
                                    effectiveCostPerUnit = itemDetails.branchConfig.costPrice / 1000;
                                  } else if (inventoryUnit === 'gram' && recipeUnit === 'kg') {
                                    effectiveCostPerUnit = itemDetails.branchConfig.costPrice * 1000;
                                  } else if (inventoryUnit === 'liter' && recipeUnit === 'ml') {
                                    effectiveCostPerUnit = itemDetails.branchConfig.costPrice / 1000;
                                  } else if (inventoryUnit === 'ml' && recipeUnit === 'liter') {
                                    effectiveCostPerUnit = itemDetails.branchConfig.costPrice * 1000;
                                  }
                                }
                                
                                return `₹${(ingredient.quantity * effectiveCostPerUnit).toFixed(2)}`;
                              })()}
                              readOnly
                              className="bg-muted"
                            />
                          </div>
                        </div>

                        {itemDetails?.branchConfig.costPrice && (
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex justify-between">
                              <span>Inventory cost:</span>
                              <span>₹{itemDetails.branchConfig.costPrice.toFixed(2)}/{itemDetails.unit}</span>
                            </div>
                            {ingredient.conversionFactor && (
                              <div className="flex justify-between text-blue-600 dark:text-blue-400">
                                <span>Conversion factor:</span>
                                <span>1 {itemDetails.unit} = {ingredient.conversionFactor} {ingredient.unit}</span>
                              </div>
                            )}
                            {ingredient.overrideCostPerUnit !== undefined && ingredient.overrideCostPerUnit !== null && (
                              <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium">
                                <span>Override cost:</span>
                                <span>₹{ingredient.overrideCostPerUnit.toFixed(2)}/{ingredient.unit}</span>
                              </div>
                            )}
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
                      setLocalConfig((prev) => ({
                        ...prev,
                        yield: {
                          ...prev.yield,
                          quantity: parseFloat(e.target.value) || 0,
                        },
                      }))
                    }
                    disabled={!isEditable}
                  />
                </div>
                <div>
                  <Label htmlFor="yieldUnit">Unit</Label>
                  <Select
                    value={localConfig.yield.unit}
                    onValueChange={(value) =>
                      setLocalConfig((prev) => ({
                        ...prev,
                        yield: { ...prev.yield, unit: value },
                      }))
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
                      setLocalConfig((prev) => ({
                        ...prev,
                        preparationTime: parseInt(e.target.value) || 0,
                      }))
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
                      setLocalConfig((prev) => ({
                        ...prev,
                        cookingTime: parseInt(e.target.value) || 0,
                      }))
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

            {/* Cost Breakdown & Profit Analysis */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Cost Breakdown & Profit Analysis</h3>
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

              <div className="border rounded-lg p-4 space-y-4 bg-primary/5">
                {/* Ingredient Costs */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Ingredient Costs:</Label>
                  {localConfig.ingredients.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No ingredients added</p>
                  ) : (
                    <div className="space-y-1">
                      {localConfig.ingredients.map((ingredient, index) => {
                        const itemDetails = getIngredientDetails(ingredient.inventoryItemBranch);
                        let cost = 0;
                        let costNote = '';
                        
                        // Calculate cost based on override or conversion
                        if (ingredient.overrideCostPerUnit !== undefined && ingredient.overrideCostPerUnit !== null) {
                          cost = ingredient.quantity * ingredient.overrideCostPerUnit;
                          costNote = ' (Override)';
                        } else if (itemDetails?.branchConfig.costPrice) {
                          let effectiveCostPerUnit = itemDetails.branchConfig.costPrice;
                          
                          if (ingredient.conversionFactor && ingredient.conversionFactor > 0) {
                            effectiveCostPerUnit = itemDetails.branchConfig.costPrice / ingredient.conversionFactor;
                            costNote = ' (Manual Conv.)';
                          } else if (itemDetails.unit !== ingredient.unit) {
                            // Check for automatic conversion
                            const invUnit = itemDetails.unit.toLowerCase();
                            const recUnit = ingredient.unit.toLowerCase();
                            if ((invUnit === 'kg' && recUnit === 'gram') || 
                                (invUnit === 'liter' && recUnit === 'ml')) {
                              effectiveCostPerUnit = itemDetails.branchConfig.costPrice / 1000;
                              costNote = ' (Auto Conv.)';
                            } else if ((invUnit === 'gram' && recUnit === 'kg') || 
                                       (invUnit === 'ml' && recUnit === 'liter')) {
                              effectiveCostPerUnit = itemDetails.branchConfig.costPrice * 1000;
                              costNote = ' (Auto Conv.)';
                            }
                          }
                          
                          cost = ingredient.quantity * effectiveCostPerUnit;
                        }
                        
                        return (
                          <div key={index} className="flex justify-between text-sm">
                            <span>
                              {itemDetails?.name || 'Unknown'} ({ingredient.quantity}{' '}
                              {ingredient.unit})
                              {costNote && (
                                <span className={
                                  costNote.includes('Override') 
                                    ? 'text-amber-600 dark:text-amber-400 text-xs ml-1'
                                    : 'text-blue-600 dark:text-blue-400 text-xs ml-1'
                                }>
                                  {costNote}
                                </span>
                              )}
                            </span>
                            <span>
                              {itemDetails?.branchConfig.costPrice || ingredient.overrideCostPerUnit ? `₹${cost.toFixed(2)}` : 'N/A'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Total Cost & Yield */}
                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Total Ingredient Cost:</span>
                    <span className="font-medium">
                      ₹
                      {localConfig.ingredients
                        .reduce((sum, ing) => {
                          const itemDetails = getIngredientDetails(ing.inventoryItemBranch);
                          return sum + (itemDetails?.branchConfig.costPrice ? ing.quantity * itemDetails.branchConfig.costPrice : 0);
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

                {/* Profit/Loss Analysis */}
                {menuItemPrice !== null && calculatedCost > 0 && (
                  <div className="border-t pt-3 space-y-3">
                    <Label className="text-xs text-muted-foreground">
                      Profit/Loss Analysis:
                    </Label>
                    
                    {/* Menu Item Price */}
                    <div className="bg-background rounded-lg p-3 space-y-2 border">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium">Menu Item Price:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">₹{menuItemPrice.toFixed(2)}</span>
                          <Badge variant="outline" className="text-xs">
                            {priceSource === 'branch' ? 'Branch Price' : 'Base Price'}
                          </Badge>
                        </div>
                      </div>
                      
                      {priceSource === 'base' && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Using base price. Branch-specific price not set.
                        </p>
                      )}
                    </div>

                    {/* Profit/Loss Calculation */}
                    {(() => {
                      const profit = menuItemPrice - calculatedCost;
                      const profitPercentage = (profit / menuItemPrice) * 100;
                      const isProfit = profit > 0;
                      
                      return (
                        <div className={`rounded-lg p-4 border-2 ${
                          isProfit 
                            ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' 
                            : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                        }`}>
                          <div className="space-y-3">
                            {/* Profit/Loss Amount */}
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                {isProfit ? (
                                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                                ) : (
                                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                                )}
                                <span className={`font-semibold ${
                                  isProfit 
                                    ? 'text-green-700 dark:text-green-300' 
                                    : 'text-red-700 dark:text-red-300'
                                }`}>
                                  {isProfit ? 'Profit' : 'Loss'} Per Unit:
                                </span>
                              </div>
                              <span className={`text-2xl font-bold ${
                                isProfit 
                                  ? 'text-green-700 dark:text-green-300' 
                                  : 'text-red-700 dark:text-red-300'
                              }`}>
                                {isProfit ? '+' : ''}₹{profit.toFixed(2)}
                              </span>
                            </div>

                            {/* Profit/Loss Percentage */}
                            <div className="flex justify-between items-center">
                              <span className={`font-medium ${
                                isProfit 
                                  ? 'text-green-700 dark:text-green-300' 
                                  : 'text-red-700 dark:text-red-300'
                              }`}>
                                {isProfit ? 'Profit' : 'Loss'} Margin:
                              </span>
                              <span className={`text-xl font-bold ${
                                isProfit 
                                  ? 'text-green-700 dark:text-green-300' 
                                  : 'text-red-700 dark:text-red-300'
                              }`}>
                                {isProfit ? '+' : ''}{profitPercentage.toFixed(2)}%
                              </span>
                            </div>

                            {/* Breakdown */}
                            <div className="border-t border-current/20 pt-2 space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Selling Price:</span>
                                <span className="font-medium">₹{menuItemPrice.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Cost Price:</span>
                                <span className="font-medium">₹{calculatedCost.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-semibold">
                                <span>{isProfit ? 'Net Profit:' : 'Net Loss:'}</span>
                                <span>{isProfit ? '+' : ''}₹{profit.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Loading state for menu price */}
                {isLoadingMenuPrice && (
                  <div className="border-t pt-3">
                    <p className="text-sm text-muted-foreground text-center">
                      Loading menu item price...
                    </p>
                  </div>
                )}

                {/* No menu price available */}
                {!isLoadingMenuPrice && menuItemPrice === null && menuItemId && (
                  <div className="border-t pt-3">
                    <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                      Menu item price not available. Profit/loss analysis cannot be calculated.
                    </p>
                  </div>
                )}
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
                    setLocalConfig((prev) => ({
                      ...prev,
                      isActive: checked as boolean,
                    }))
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
                  setLocalConfig((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
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

    {/* Unit Conversion Modal */}
    {selectedIngredientIndex !== null && (
      <UnitConversionModal
        isOpen={showUnitConversionModal}
        onClose={() => {
          setShowUnitConversionModal(false);
          setSelectedIngredientIndex(null);
        }}
        ingredient={localConfig.ingredients[selectedIngredientIndex]}
        ingredientName={getIngredientDetails(localConfig.ingredients[selectedIngredientIndex].inventoryItemBranch)?.name || 'Unknown'}
        inventoryUnit={getIngredientDetails(localConfig.ingredients[selectedIngredientIndex].inventoryItemBranch)?.unit || 'piece'}
        inventoryPrice={getIngredientDetails(localConfig.ingredients[selectedIngredientIndex].inventoryItemBranch)?.branchConfig.costPrice || 0}
        branchId={branch._id}
        onApply={handleUnitConversionApply}
      />
    )}
    </>
  );
}
