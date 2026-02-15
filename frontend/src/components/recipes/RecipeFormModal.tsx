import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Settings, Copy, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/contexts/LoadingContext';
import { recipeServices, recipeBranchServices, menuItemServices } from '@/api/services';
import BranchSearch from '@/components/common/BranchSearch';
import RecipeBranchConfigModal from './RecipeBranchConfigModal';

interface MenuItem {
  _id: string;
  name: string;
}

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface PreparationStep {
  stepNumber: number;
  description: string;
}

interface Ingredient {
  // may be a branch-config id string or a populated object when coming from API
  inventoryItemBranch: string | { _id?: string };
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

interface Recipe {
  _id: string;
  name: string;
  finishedGood: MenuItem | string;
  preparationSteps: PreparationStep[];
  version: number;
  isActive: boolean;
  notes?: string;
  branches?: Array<{
    _id: string;
    branch: {
      _id: string;
      name: string;
      code: string;
    };
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
  }>;
}

interface RecipeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe?: Recipe | null;
  onSuccess: () => void;
  branches: Branch[];
  userBranchIds: string[] | null;
}

export default function RecipeFormModal({
  isOpen,
  onClose,
  recipe,
  onSuccess,
  branches,
  userBranchIds,
}: RecipeFormModalProps) {
  const { toast } = useToast();
  const { setLoading: setGlobalLoading, setLoadingMessage } = useLoading();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  const [formData, setFormData] = useState({
    name: '',
    finishedGood: '',
    preparationSteps: [] as PreparationStep[],
    notes: '',
  });

  const [finishedGoods, setFinishedGoods] = useState<MenuItem[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [branchConfigs, setBranchConfigs] = useState<Map<string, RecipeBranchConfig>>(new Map());
  
  // Branch config modal state
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedBranchForConfig, setSelectedBranchForConfig] = useState<string | null>(null);
  
  // Copy/paste state
  const [copiedConfig, setCopiedConfig] = useState<RecipeBranchConfig | null>(null);

  // Helper function to create default branch config
  const createDefaultBranchConfig = (): RecipeBranchConfig => ({
    ingredients: [],
    yield: {
      quantity: 1,
      unit: 'piece',
    },
    preparationTime: 0,
    cookingTime: 0,
    costPerUnit: 0,
    isActive: true,
    notes: '',
  });

  // Check if user can edit a specific branch
  const canEditBranch = (branchId: string): boolean => {
    // Super admin (null userBranchIds) can edit all branches
    if (userBranchIds === null) return true;
    // Branch managers can only edit their assigned branches
    return userBranchIds.includes(branchId);
  };

  // Fetch finished goods (menu items)
  useEffect(() => {
    if (isOpen) {
      fetchFinishedGoods();
    }
  }, [isOpen]);

  // Sync finishedGood in form AFTER finished goods are loaded
  // This ensures Select sees both the value AND the matching item in the list atomically
  useEffect(() => {
    if (recipe && recipe.finishedGood && finishedGoods.length > 0) {
      const fgId = typeof recipe.finishedGood === 'string' ? recipe.finishedGood : recipe.finishedGood._id || '';
      setFormData((prev) => ({
        ...prev,
        finishedGood: fgId,
      }));
    }
  }, [finishedGoods, recipe]);

  const fetchFinishedGoods = async () => {
    try {
      const response = await menuItemServices.getMenuItems({ limit: 1000 });
      const items = response.data.data.menuItems || [];
            // (in case it's not in the first 1000 items)
      let finalItems = items;
      if (recipe && recipe.finishedGood) {
        const fgId = typeof recipe.finishedGood === 'string' ? recipe.finishedGood : recipe.finishedGood._id || '';
        const exists = items.some((it: any) => it._id === fgId);
        
        if (!exists && fgId) {
          try {
            const single = await menuItemServices.getMenuItemById(fgId);
            const menuItem = single.data?.data?.menuItem;
            if (menuItem) {
              finalItems = [menuItem, ...items];
            }
          } catch (err) {
            // ignore fetch errors for single item
          }
        }
      }
      
      // Just update items; formData.finishedGood will be synced by separate useEffect after items load
      setFinishedGoods(finalItems);
    } catch (error: any) {
      toast({
        title: 'Warning',
        description: 'Could not fetch menu items',
        variant: 'default',
      });
    }
  };

  // Initialize form data when recipe changes
  useEffect(() => {
    if (recipe) {
      setFormData({
        name: recipe.name || '',
        finishedGood: '', // Will be set by second useEffect after finished goods load
        preparationSteps: recipe.preparationSteps || [],
        notes: recipe.notes || '',
      });
      
      // Populate ALL branch configurations (including non-accessible ones)
      if (recipe.branches && recipe.branches.length > 0) {
        const allBranchIds = recipe.branches.map(b => b.branch._id);
        
        // For BranchSearch, only show accessible branches
        const accessibleBranchIds = allBranchIds.filter(id => canEditBranch(id));
        setSelectedBranches(accessibleBranchIds);
        
        // But store configs for ALL branches (for display purposes)
        // Normalize ingredient.inventoryItemBranch to the branch-specific id string
        const configs = new Map<string, RecipeBranchConfig>();
        recipe.branches.forEach(branchConfig => {
          const normalizedIngredients = (branchConfig.ingredients || []).map((ing: any) => ({
            inventoryItemBranch: typeof ing.inventoryItemBranch === 'string'
              ? ing.inventoryItemBranch
              : ing.inventoryItemBranch?._id || ing.inventoryItemBranch?.branchConfig?._id || '',
            quantity: ing.quantity,
            unit: ing.unit,
          }));

          configs.set(branchConfig.branch._id, {
            ingredients: normalizedIngredients,
            yield: branchConfig.yield || { quantity: 1, unit: 'piece' },
            preparationTime: branchConfig.preparationTime,
            cookingTime: branchConfig.cookingTime,
            costPerUnit: branchConfig.costPerUnit,
            isActive: branchConfig.isActive,
            notes: branchConfig.notes || '',
          });
        });
        setBranchConfigs(configs);
      }
    } else {
      // Reset form for new recipe
      setFormData({
        name: '',
        finishedGood: '',
        preparationSteps: [{ stepNumber: 1, description: '' }],
        notes: '',
      });
      setSelectedBranches([]);
      setBranchConfigs(new Map());
    }
    setActiveTab('basic');
  }, [recipe, isOpen]);

  // Handle branch selection changes
  const handleBranchSelectionChange = (newSelectedBranches: string[]) => {
    setSelectedBranches(newSelectedBranches);
    
    // Initialize configs for newly selected branches
    const newConfigs = new Map(branchConfigs);
    newSelectedBranches.forEach((branchId) => {
      if (!newConfigs.has(branchId)) {
        newConfigs.set(branchId, createDefaultBranchConfig());
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
  const handleBranchConfigChange = (branchId: string, config: RecipeBranchConfig) => {
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

  // Preparation steps management
  const handleStepChange = (index: number, value: string) => {
    const updatedSteps = [...formData.preparationSteps];
    updatedSteps[index] = { ...updatedSteps[index], description: value };
    setFormData({ ...formData, preparationSteps: updatedSteps });
  };

  const addStep = () => {
    setFormData({
      ...formData,
      preparationSteps: [
        ...formData.preparationSteps,
        {
          stepNumber: formData.preparationSteps.length + 1,
          description: '',
        },
      ],
    });
  };

  const removeStep = (index: number) => {
    if (formData.preparationSteps.length > 1) {
      const updatedSteps = formData.preparationSteps.filter((_, i) => i !== index);
      // Renumber steps
      updatedSteps.forEach((step, i) => {
        step.stepNumber = i + 1;
      });
      setFormData({ ...formData, preparationSteps: updatedSteps });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.finishedGood) {
      toast({
        title: 'Validation Error',
        description: 'Name and finished good are required',
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
        recipe 
          ? 'Updating recipe and branch configurations...' 
          : 'Creating recipe with branch configurations...'
      );

      // Prepare recipe data
      const recipeData = {
        name: formData.name.trim(),
        finishedGood: formData.finishedGood,
        preparationSteps: formData.preparationSteps
          .filter((step) => step.description.trim())
          .map((step, index) => ({
            stepNumber: index + 1,
            description: step.description.trim(),
          })),
        notes: formData.notes.trim() || undefined,
      };

      if (recipe) {
        // Update existing recipe
        await recipeServices.updateRecipe(recipe._id, recipeData);
        
        // Handle branch updates
        const originalBranchIds = recipe.branches?.map(b => b.branch._id) || [];
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
            await recipeBranchServices.deleteRecipeBranch(recipe._id, branchId);
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
          
          await recipeBranchServices.bulkUpdateRecipeBranches(recipe._id, branchConfigsArray);
        }
        
        toast({
          title: 'Success',
          description: 'Recipe and branch configurations updated successfully',
          variant: 'success',
        });
      } else {
        // Create new recipe with branch assignments
        const branchConfigsArray = selectedBranches.map((branchId) => ({
          branch: branchId, // Backend expects 'branch', not 'branchId'
          ...branchConfigs.get(branchId),
        }));

        await recipeServices.createRecipeWithBranches({
          recipeData,
          branchConfigs: branchConfigsArray,
        });
        
        toast({
          title: 'Success',
          description: 'Recipe created successfully with branch configurations',
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
        `Failed to ${recipe ? 'update' : 'create'} recipe`;
      
      // Handle specific error types based on HTTP status codes
      const status = error.status || error.response?.status;
      
      if (status === 403) {
        toast({
          title: 'Access Denied',
          description: errorMessage || 'You do not have permission to access one or more selected branches',
          variant: 'destructive',
        });
      } else if (status === 400) {
        toast({
          title: 'Validation Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } else if (status === 404) {
        toast({
          title: 'Not Found',
          description: errorMessage || 'The requested resource was not found',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
      
      console.error('Recipe operation error:', error);
    } finally {
      setLoading(false);
      setGlobalLoading(false);
      setLoadingMessage(undefined);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {recipe ? 'Edit Recipe' : 'Create New Recipe'}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="branches">Branch Assignment</TabsTrigger>
            </TabsList>

            <form id="recipe-form" onSubmit={handleSubmit}>
              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-6 mt-6">
                {/* Recipe Name */}
                <div>
                  <Label htmlFor="name">Recipe Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Margherita Pizza"
                    maxLength={200}
                    disabled={loading}
                    required
                  />
                </div>

                {/* Finished Good */}
                <div>
                  
                  <Label htmlFor="finishedGood">Finished Good *</Label>
                  <Select
                    value={formData.finishedGood || ''}
                    onValueChange={(value) =>
                      setFormData({ ...formData, finishedGood: value })
                    }
                    disabled={loading}
                  >
                    
                    <SelectTrigger id="finishedGood">
                      <SelectValue placeholder="Select finished good" />
                    </SelectTrigger>
                    <SelectContent>
                      {finishedGoods.map((item) => (
                        <SelectItem key={item._id} value={item._id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Preparation Steps */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Preparation Steps</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addStep}
                      disabled={loading}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Step
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {formData.preparationSteps.map((step, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {step.stepNumber}
                        </div>
                        <div className="flex-1">
                          <Input
                            value={step.description}
                            onChange={(e) => handleStepChange(index, e.target.value)}
                            placeholder={`Step ${step.stepNumber} description`}
                            disabled={loading}
                          />
                        </div>
                        {formData.preparationSteps.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeStep(index)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Additional notes about the recipe..."
                    rows={3}
                    disabled={loading}
                  />
                </div>
              </TabsContent>

              {/* Branch Assignment Tab */}
              <TabsContent value="branches" className="space-y-6 mt-6">
                {/* Branch Selection */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Branch Assignment *</h3>
                  <BranchSearch
                    selectedBranchIds={selectedBranches}
                    onBranchesChange={handleBranchSelectionChange}
                    disabled={loading}
                    placeholder="Select branches for this recipe..."
                    showSelectAll={true}
                  />
                  {recipe && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Select branches you have access to. You can add or remove them.</p>
                      {recipe.branches && recipe.branches.length > selectedBranches.length && (
                        <p className="text-amber-600">
                          Note: This recipe is also available in {recipe.branches.length - selectedBranches.length} other branch{recipe.branches.length - selectedBranches.length !== 1 ? 'es' : ''} (shown below as read-only).
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Branch Configuration */}
                {branchConfigs.size > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">
                        Branch Configuration
                        {recipe && branchConfigs.size > selectedBranches.length && (
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
                                       recipe?.branches?.find(b => b.branch._id === branchId)?.branch;
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
                                Cost: {config.costPerUnit ? `₹${config.costPerUnit.toFixed(2)}` : 'N/A'} • 
                                {config.isActive ? ' Active' : ' Inactive'} • 
                                {config.ingredients.length} ingredient{config.ingredients.length !== 1 ? 's' : ''}
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
              </TabsContent>
            </form>
          </Tabs>
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
          <Button type="submit" form="recipe-form" disabled={loading}>
            {loading
              ? 'Saving...'
              : recipe
              ? 'Update Recipe'
              : 'Create Recipe'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Branch Configuration Modal */}
      {selectedBranchForConfig && (() => {
        const branch = branches.find((b) => b._id === selectedBranchForConfig) ||
                       recipe?.branches?.find((b) => b.branch._id === selectedBranchForConfig)?.branch;
        const config = branchConfigs.get(selectedBranchForConfig);
        
        // Only render if we have both branch and config
        if (!branch || !config) return null;

        return (
          <RecipeBranchConfigModal
            isOpen={configModalOpen}
            onClose={() => {
              setConfigModalOpen(false);
              setSelectedBranchForConfig(null);
            }}
            branch={branch}
            config={config}
            onChange={(config) => handleBranchConfigChange(selectedBranchForConfig!, config)}
            isEditable={canEditBranch(selectedBranchForConfig!)}
          />
        );
      })()}
    </Dialog>
  );
}
