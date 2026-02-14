import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { recipeServices, inventoryServices, menuItemServices } from '@/api/services';
import { Plus, Trash2 } from 'lucide-react';

interface RecipeFormModalProps {
  open: boolean;
  onClose: () => void;
  recipe: any | null;
  onSuccess: () => void;
}

interface InventoryItem {
  _id: string;
  name: string;
  unit: string;
  costPrice?: number;
}

interface Ingredient {
  rawMaterial: string;
  quantity: number;
  unit: string;
  cost?: number;
}

interface PreparationStep {
  stepNumber: number;
  description: string;
}

export default function RecipeFormModal({
  open,
  onClose,
  recipe,
  onSuccess,
}: RecipeFormModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rawMaterials, setRawMaterials] = useState<InventoryItem[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<InventoryItem[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    finishedGood: '',
    yieldQuantity: 1,
    yieldUnit: 'piece',
    preparationTime: 0,
    cookingTime: 0,
    notes: '',
  });
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    {
      rawMaterial: '',
      quantity: 0,
      unit: '',
      cost: 0,
    },
  ]);
  const [preparationSteps, setPreparationSteps] = useState<PreparationStep[]>([
    {
      stepNumber: 1,
      description: '',
    },
  ]);

  useEffect(() => {
    if (open) {
      fetchInventoryItems();
      if (!recipe) {
        resetForm();
      }
    }
  }, [open]);

  useEffect(() => {
    if (recipe && open) {
      setFormData({
        name: recipe.name || '',
        finishedGood: recipe.finishedGood?._id || recipe.finishedGood || '',
        yieldQuantity: recipe.yield?.quantity || 1,
        yieldUnit: recipe.yield?.unit || 'piece',
        preparationTime: recipe.preparationTime || 0,
        cookingTime: recipe.cookingTime || 0,
        notes: recipe.notes || '',
      });

      if (recipe.ingredients && recipe.ingredients.length > 0) {
        setIngredients(
          recipe.ingredients.map((ing: any) => ({
            rawMaterial: ing.rawMaterial?._id || ing.rawMaterial || '',
            quantity: ing.quantity || 0,
            unit: ing.unit || '',
            cost: ing.rawMaterial?.costPrice || 0,
          }))
        );
      }

      if (recipe.preparationSteps && recipe.preparationSteps.length > 0) {
        setPreparationSteps(
          recipe.preparationSteps.map((step: any) => ({
            stepNumber: step.stepNumber || 0,
            description: step.description || '',
          }))
        );
      }
    }
  }, [recipe, open]);

  const resetForm = () => {
    setFormData({
      name: '',
      finishedGood: '',
      yieldQuantity: 1,
      yieldUnit: 'piece',
      preparationTime: 0,
      cookingTime: 0,
      notes: '',
    });
    setIngredients([
      {
        rawMaterial: '',
        quantity: 0,
        unit: '',
        cost: 0,
      },
    ]);
    setPreparationSteps([
      {
        stepNumber: 1,
        description: '',
      },
    ]);
  };

  const fetchInventoryItems = async () => {
    try {
      const params: any = {
        limit: 1000,
      };
      // Fetch finished goods from inventory items
      const menuresponse = await menuItemServices.getMenuItems(params);
      const inventoryresponse = await inventoryServices.getInventoryItems(params);

      const items = menuresponse.data.data.menuItems || [];
      setFinishedGoods(
        items.map((item: any) => ({
          _id: item._id,
          name: item.name,
        }))
      );

      const allItems = inventoryresponse.data.data.items || [];
      setRawMaterials(allItems);
      
    } catch (err) {
      // If that fails, we'll just set empty arrays and show a warning
      setRawMaterials([]);
      setFinishedGoods([]);
      toast({
        title: 'Warning',
        description: 'Could not fetch inventory items. Please ensure items exist in your branches.',
        variant: 'default',
      });
    }
  };

  const handleIngredientChange = (index: number, field: keyof Ingredient, value: any) => {
    const updatedIngredients = [...ingredients];
    updatedIngredients[index] = { ...updatedIngredients[index], [field]: value };

    // Auto-fill unit and cost when raw material is selected
    if (field === 'rawMaterial') {
      const selectedItem = rawMaterials.find((item) => item._id === value);
      if (selectedItem) {
        updatedIngredients[index].unit = selectedItem.unit;
        updatedIngredients[index].cost = selectedItem.costPrice || 0;
      }
    }

    setIngredients(updatedIngredients);
  };

  const addIngredient = () => {
    setIngredients([
      ...ingredients,
      {
        rawMaterial: '',
        quantity: 0,
        unit: '',
        cost: 0,
      },
    ]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
    }
  };

  const handleStepChange = (index: number, value: string) => {
    const updatedSteps = [...preparationSteps];
    updatedSteps[index] = { ...updatedSteps[index], description: value };
    setPreparationSteps(updatedSteps);
  };

  const addStep = () => {
    setPreparationSteps([
      ...preparationSteps,
      {
        stepNumber: preparationSteps.length + 1,
        description: '',
      },
    ]);
  };

  const removeStep = (index: number) => {
    if (preparationSteps.length > 1) {
      const updatedSteps = preparationSteps.filter((_, i) => i !== index);
      // Renumber steps
      updatedSteps.forEach((step, i) => {
        step.stepNumber = i + 1;
      });
      setPreparationSteps(updatedSteps);
    }
  };

  const calculateCostPerUnit = () => {
    const totalCost = ingredients.reduce((sum, ing) => {
      return sum + ing.quantity * (ing.cost || 0);
    }, 0);
    return formData.yieldQuantity > 0 ? totalCost / formData.yieldQuantity : 0;
  };

  const calculateTotalTime = () => {
    return formData.preparationTime + formData.cookingTime;
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Recipe name is required',
        variant: 'destructive',
      });
      return false;
    }

    if (!formData.finishedGood) {
      toast({
        title: 'Validation Error',
        description: 'Finished good is required',
        variant: 'destructive',
      });
      return false;
    }

    if (formData.yieldQuantity <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Yield quantity must be greater than 0',
        variant: 'destructive',
      });
      return false;
    }

    if (ingredients.length === 0 || ingredients.every((ing) => !ing.rawMaterial)) {
      toast({
        title: 'Validation Error',
        description: 'At least one ingredient is required',
        variant: 'destructive',
      });
      return false;
    }

    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      if (ing.rawMaterial) {
        if (ing.quantity <= 0) {
          toast({
            title: 'Validation Error',
            description: `Ingredient ${i + 1}: Quantity must be greater than 0`,
            variant: 'destructive',
          });
          return false;
        }
      }
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

      const submitData = {
        name: formData.name.trim(),
        finishedGood: formData.finishedGood,
        ingredients: ingredients
          .filter((ing) => ing.rawMaterial)
          .map((ing) => ({
            rawMaterial: ing.rawMaterial,
            quantity: ing.quantity,
            unit: ing.unit,
          })),
        yield: {
          quantity: formData.yieldQuantity,
          unit: formData.yieldUnit,
        },
        preparationSteps: preparationSteps
          .filter((step) => step.description.trim())
          .map((step, index) => ({
            stepNumber: index + 1,
            description: step.description.trim(),
          })),
        preparationTime: formData.preparationTime || undefined,
        cookingTime: formData.cookingTime || undefined,
        notes: formData.notes.trim() || undefined,
      };

      if (recipe) {
        await recipeServices.updateRecipe(recipe._id, submitData);
        toast({
          title: 'Success',
          description: 'Recipe updated successfully',
          variant: 'success',
        });
      } else {
        await recipeServices.createRecipe(submitData);
        toast({
          title: 'Success',
          description: 'Recipe created successfully',
          variant: 'success',
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description:
          error.response?.data?.message || `Failed to ${recipe ? 'update' : 'create'} recipe`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{recipe ? 'Edit Recipe' : 'Add Recipe'}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="recipe-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Recipe Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Margherita Pizza"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="finishedGood">Finished Good *</Label>
                  <Select
                    value={formData.finishedGood}
                    onValueChange={(value) => setFormData({ ...formData, finishedGood: value })}
                  >
                    <SelectTrigger>
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
              </div>
            </div>

            {/* Ingredients */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Ingredients *</h3>
                <Button type="button" size="sm" onClick={addIngredient}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Ingredient
                </Button>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {ingredients.map((ingredient, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Ingredient {index + 1}</span>
                      {ingredients.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeIngredient(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-2">
                        <Label>Raw Material *</Label>
                        <Select
                          value={ingredient.rawMaterial}
                          onValueChange={(value) =>
                            handleIngredientChange(index, 'rawMaterial', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select raw material" />
                          </SelectTrigger>
                          <SelectContent>
                            {rawMaterials.map((item) => (
                              <SelectItem key={item._id} value={item._id}>
                                {item.name} ({item.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Quantity *</Label>
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
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <Label>Unit</Label>
                        <Input
                          value={ingredient.unit}
                          readOnly
                          placeholder="Auto-filled"
                          className="bg-muted"
                        />
                      </div>

                      <div className="col-span-4">
                        <Label>Cost (per unit)</Label>
                        <Input
                          value={ingredient.cost ? `₹${ingredient.cost.toFixed(2)}` : '-'}
                          readOnly
                          className="bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Yield */}
            <div className="space-y-4">
              <h3 className="font-semibold">Yield</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="yieldQuantity">Yield Quantity *</Label>
                  <Input
                    id="yieldQuantity"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={formData.yieldQuantity}
                    onChange={(e) =>
                      setFormData({ ...formData, yieldQuantity: parseFloat(e.target.value) || 1 })
                    }
                    placeholder="1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="yieldUnit">Yield Unit *</Label>
                  <Select
                    value={formData.yieldUnit}
                    onValueChange={(value) => setFormData({ ...formData, yieldUnit: value })}
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
              </div>
            </div>

            {/* Preparation Steps */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Preparation Steps</h3>
                <Button type="button" size="sm" onClick={addStep}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Step
                </Button>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {preparationSteps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {step.stepNumber}
                    </div>
                    <div className="flex-1">
                      <Input
                        value={step.description}
                        onChange={(e) => handleStepChange(index, e.target.value)}
                        placeholder={`Step ${step.stepNumber} description`}
                      />
                    </div>
                    {preparationSteps.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStep(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Time & Cost */}
            <div className="space-y-4">
              <h3 className="font-semibold">Time & Cost</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="preparationTime">Preparation Time (minutes)</Label>
                  <Input
                    id="preparationTime"
                    type="number"
                    min="0"
                    value={formData.preparationTime || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, preparationTime: parseInt(e.target.value) || 0 })
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="cookingTime">Cooking Time (minutes)</Label>
                  <Input
                    id="cookingTime"
                    type="number"
                    min="0"
                    value={formData.cookingTime || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, cookingTime: parseInt(e.target.value) || 0 })
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Calculated Fields */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
                <div>
                  <Label className="text-muted-foreground">Total Time</Label>
                  <p className="text-lg font-semibold">{calculateTotalTime()} minutes</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Cost Per Unit</Label>
                  <p className="text-lg font-semibold text-primary">
                    ₹{calculateCostPerUnit().toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about the recipe..."
                rows={3}
              />
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="recipe-form" disabled={loading}>
            {loading ? 'Saving...' : recipe ? 'Update Recipe' : 'Create Recipe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
