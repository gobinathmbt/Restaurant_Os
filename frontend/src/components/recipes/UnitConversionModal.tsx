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
import { Badge } from '@/components/ui/badge';
import { Calculator, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { unitConversionServices } from '@/api/services';

interface Ingredient {
  inventoryItemBranch: string | { _id?: string };
  quantity: number;
  unit: string;
  conversionFactor?: number;
  overrideCostPerUnit?: number;
}

interface ConversionResult {
  inventoryItemBranch: string;
  inventoryItemName: string;
  quantity: number;
  unit: string;
  inventoryUnit: string;
  inventoryPrice: number;
  conversionFactor: number;
  convertedPrice: number;
  totalCost: number;
  conversionMethod: 'automatic' | 'manual' | 'direct';
  isCompatible: boolean;
  suggestion: {
    factor: number | null;
    confidence: string;
    method: string;
    description: string;
  };
  currentConversionFactor?: number;
  currentOverrideCost?: number;
}

interface UnitConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredient: Ingredient;
  ingredientName: string;
  inventoryUnit: string;
  inventoryPrice: number;
  branchId: string;
  onApply: (conversionFactor?: number, overrideCost?: number) => void;
}

export default function UnitConversionModal({
  isOpen,
  onClose,
  ingredient,
  ingredientName,
  inventoryUnit,
  inventoryPrice,
  branchId,
  onApply,
}: UnitConversionModalProps) {
  const { toast } = useToast();
  const [conversion, setConversion] = useState<ConversionResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [conversionFactor, setConversionFactor] = useState<number | undefined>(ingredient.conversionFactor);
  const [overrideCost, setOverrideCost] = useState<number | undefined>(ingredient.overrideCostPerUnit);

  // Resolve inventoryItemBranch ID
  const resolveBranchId = (val: string | { _id?: string } | undefined | null) => {
    if (!val) return '';
    return typeof val === 'string' ? val : (val as any)._id || '';
  };

  // Reset state when modal opens or ingredient changes
  useEffect(() => {
    if (isOpen) {
      setConversionFactor(ingredient.conversionFactor);
      setOverrideCost(ingredient.overrideCostPerUnit);
      calculateConversion();
    }
  }, [isOpen, ingredient]);

  const calculateConversion = async () => {
    try {
      setIsCalculating(true);
      const response = await unitConversionServices.calculateSmartConversions({
        ingredients: [{
          inventoryItemBranch: resolveBranchId(ingredient.inventoryItemBranch),
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          conversionFactor: ingredient.conversionFactor,
          overrideCostPerUnit: ingredient.overrideCostPerUnit,
        }],
        branchId,
      });
      setConversion(response.data.data.conversions[0]);
    } catch (error: any) {
      console.error('❌ Error calculating conversion:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to calculate conversion',
        variant: 'destructive',
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleConversionFactorChange = (value: string) => {
    
    if (value === '') {
      setConversionFactor(undefined);
      return;
    }

    const numValue = parseFloat(value);
    
    if (isNaN(numValue) || numValue <= 0) {
      return;
    }
    setConversionFactor(numValue);
  };

  const handleOverrideCostChange = (value: string) => {
    
    if (value === '') {
      setOverrideCost(undefined);
      return;
    }

    const numValue = parseFloat(value);    

    if (isNaN(numValue) || numValue < 0) {
      return;
    }

    setOverrideCost(numValue);
  };

  const handleApply = () => {

    onApply(conversionFactor, overrideCost);
    
    toast({
      title: 'Conversion Applied',
      description: 'Unit conversion settings have been updated. Remember to save the configuration.',
      variant: 'success',
    });
    
    onClose();
  };

  const handleRecalculate = () => {
    calculateConversion();
  };

  const getConversionBadge = (conversionMethod: string) => {
    if (conversionMethod === 'automatic') {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Auto
        </Badge>
      );
    } else if (conversionMethod === 'manual') {
      return (
        <Badge variant="default" className="bg-blue-500">
          <Calculator className="h-3 w-3 mr-1" />
          Manual
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-600">
          <AlertCircle className="h-3 w-3 mr-1" />
          Direct
        </Badge>
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby="conversion-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Smart Unit Conversion: {ingredientName}
          </DialogTitle>
          <p id="conversion-description" className="text-sm text-muted-foreground">
            Configure unit conversion and cost settings for this ingredient
          </p>
        </DialogHeader>

        <DialogBody>
          {isCalculating ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Calculating conversion...</p>
            </div>
          ) : !conversion ? (
            <div className="py-12 text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Unable to load conversion data</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Info Banner */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm space-y-1">
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      How Unit Conversion Works:
                    </p>
                    <ul className="text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                      <li>
                        <strong>Auto:</strong> System automatically converts compatible units (kg ↔ gram, liter ↔ ml)
                      </li>
                      <li>
                        <strong>Manual:</strong> Enter custom conversion factor for incompatible units (e.g., 1 kg tomato = 5 pieces)
                      </li>
                      <li>
                        <strong>Override Cost:</strong> Set a specific cost per unit instead of using calculated price
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Conversion Details */}
              <div className="border rounded-lg p-4 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{ingredientName}</h4>
                    <p className="text-sm text-muted-foreground">
                      Recipe needs: {conversion.quantity} {conversion.unit}
                    </p>
                  </div>
                  {getConversionBadge(conversion.conversionMethod)}
                </div>

                {/* Current Values */}
                <div className="grid grid-cols-2 gap-4 bg-muted/50 rounded-lg p-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Inventory Unit</Label>
                    <p className="font-medium">{conversion.inventoryUnit}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Inventory Price</Label>
                    <p className="font-medium">₹{conversion.inventoryPrice.toFixed(2)}/{conversion.inventoryUnit}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Recipe Unit</Label>
                    <p className="font-medium">{conversion.unit}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Converted Price</Label>
                    <p className="font-medium">₹{conversion.convertedPrice.toFixed(2)}/{conversion.unit}</p>
                  </div>
                </div>

                {/* Conversion Suggestion */}
                {conversion.suggestion && (
                  <div className={`rounded-lg p-3 text-sm ${
                    conversion.suggestion.confidence === 'high'
                      ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
                      : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800'
                  }`}>
                    <p className={
                      conversion.suggestion.confidence === 'high'
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-amber-700 dark:text-amber-300'
                    }>
                      {conversion.suggestion.description}
                    </p>
                  </div>
                )}

                {/* Manual Inputs */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="conversionFactor" className="text-sm">
                          Manual Conversion Factor
                        </Label>
                        {conversionFactor !== undefined && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConversionFactor(undefined)}
                            className="h-6 text-xs"
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground block mb-1">
                        (1 {conversion.inventoryUnit} = ? {conversion.unit})
                      </span>
                      <Input
                        id="conversionFactor"
                        type="number"
                        min="0"
                        step="0.01"
                        value={conversionFactor || ''}
                        onChange={(e) => handleConversionFactorChange(e.target.value)}
                        placeholder={conversion.suggestion.factor?.toString() || 'Enter factor'}
                      />
                      {conversion.suggestion.factor && !conversionFactor && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          ✓ Auto: {conversion.suggestion.factor} (leave empty to use automatic)
                        </p>
                      )}
                      {conversionFactor && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Manual factor will override automatic conversion
                        </p>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="overrideCost" className="text-sm">
                          Override Cost Per Unit
                        </Label>
                        {overrideCost !== undefined && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setOverrideCost(undefined)}
                            className="h-6 text-xs"
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground block mb-1">
                        (₹ per {conversion.unit})
                      </span>
                      <Input
                        id="overrideCost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={overrideCost !== undefined ? overrideCost : ''}
                        onChange={(e) => handleOverrideCostChange(e.target.value)}
                        placeholder="Optional"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Leave empty to use calculated price
                      </p>
                    </div>
                  </div>

                  {/* Show what will be saved */}
                  {(conversionFactor !== undefined || overrideCost !== undefined) && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded p-2 text-xs">
                      <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Changes to be applied:</p>
                      <ul className="text-blue-700 dark:text-blue-300 space-y-0.5">
                        {conversionFactor !== undefined && (
                          <li>• Conversion Factor: {conversionFactor}</li>
                        )}
                        {overrideCost !== undefined && (
                          <li>• Override Cost: ₹{overrideCost.toFixed(2)}/{conversion.unit}</li>
                        )}
                      </ul>
                    </div>
                  )}
                  
                  {/* Show when using automatic conversion */}
                  {conversionFactor === undefined && overrideCost === undefined && conversion.conversionMethod === 'automatic' && (
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded p-2 text-xs">
                      <p className="text-green-700 dark:text-green-300">
                        ✓ Using automatic conversion: 1 {conversion.inventoryUnit} = {conversion.conversionFactor} {conversion.unit}
                      </p>
                    </div>
                  )}
                </div>

                {/* Cost Summary */}
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Cost for this Ingredient:</span>
                    <span className="text-lg font-bold text-primary">
                      ₹{conversion.totalCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={isCalculating || !conversion}
          >
            <Calculator className="h-4 w-4 mr-2" />
            Apply Conversion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
