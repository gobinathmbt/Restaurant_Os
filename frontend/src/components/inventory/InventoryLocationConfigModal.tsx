import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Location {
  _id: string;
  name: string;
  code: string;
}

interface Supplier {
  _id: string;
  name: string;
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

interface InventoryLocationConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: Location;
  config: LocationConfig;
  onChange: (config: LocationConfig) => void;
  isEditable: boolean;
  suppliers?: Supplier[];
}

export default function InventoryLocationConfigModal({
  isOpen,
  onClose,
  location,
  config,
  onChange,
  isEditable,
  suppliers = [],
}: InventoryLocationConfigModalProps) {
  const [localConfig, setLocalConfig] = useState<LocationConfig>(config);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setLocalConfig(config);
    setValidationErrors({});
  }, [config, isOpen]);

  const validateConfig = (newConfig: LocationConfig): Record<string, string> => {
    const errors: Record<string, string> = {};

    // Validate maximumStock >= minimumStock
    if (newConfig.maximumStock !== undefined && newConfig.maximumStock < newConfig.minimumStock) {
      errors.maximumStock = 'Maximum stock must be greater than or equal to minimum stock';
    }

    // Validate availableQuantity <= maximumStock
    if (newConfig.maximumStock !== undefined && newConfig.availableQuantity > newConfig.maximumStock) {
      errors.availableQuantity = 'Available quantity cannot exceed maximum stock';
    }

    // Validate reorderPoint between minimumStock and maximumStock
    if (newConfig.reorderPoint !== undefined) {
      if (newConfig.reorderPoint < newConfig.minimumStock) {
        errors.reorderPoint = 'Reorder point should be greater than or equal to minimum stock';
      }
      if (newConfig.maximumStock !== undefined && newConfig.reorderPoint > newConfig.maximumStock) {
        errors.reorderPoint = 'Reorder point should be less than or equal to maximum stock';
      }
    }

    // Validate price decimal places (max 2)
    if (newConfig.standardCost !== undefined) {
      const decimals = (newConfig.standardCost.toString().split('.')[1] || '').length;
      if (decimals > 2) {
        errors.standardCost = 'Price cannot have more than 2 decimal places';
      }
    }
    if (newConfig.lastPurchasePrice !== undefined) {
      const decimals = (newConfig.lastPurchasePrice.toString().split('.')[1] || '').length;
      if (decimals > 2) {
        errors.lastPurchasePrice = 'Price cannot have more than 2 decimal places';
      }
    }

    return errors;
  };

  const handleChange = (field: keyof LocationConfig, value: any) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    
    // Validate the new config
    const errors = validateConfig(newConfig);
    setValidationErrors(errors);
    
    // Only propagate changes if there are no validation errors
    if (isEditable && Object.keys(errors).length === 0) {
      onChange(newConfig);
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditable ? 'Configure' : 'View'}: {location.name} ({location.code})
          </DialogTitle>
          {!isEditable && (
            <p className="text-sm text-muted-foreground">
              Read-only view - You don't have permission to edit this location
            </p>
          )}
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Stock Management - Three-State Quantities */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Stock Management</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="availableQuantity">Available Quantity *</Label>
                  <Input
                    id="availableQuantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={localConfig.availableQuantity}
                    onChange={(e) => handleChange('availableQuantity', parseFloat(e.target.value) || 0)}
                    disabled={!isEditable}
                    required
                    className={validationErrors.availableQuantity ? 'border-red-500' : ''}
                  />
                  {validationErrors.availableQuantity && (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.availableQuantity}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Stock available for use
                  </p>
                </div>
                <div>
                  <Label htmlFor="reservedQuantity">Reserved Quantity</Label>
                  <Input
                    id="reservedQuantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={localConfig.reservedQuantity}
                    onChange={(e) => handleChange('reservedQuantity', parseFloat(e.target.value) || 0)}
                    disabled={!isEditable}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Stock reserved for orders
                  </p>
                </div>
                <div>
                  <Label htmlFor="inTransitQuantity">In-Transit Quantity</Label>
                  <Input
                    id="inTransitQuantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={localConfig.inTransitQuantity}
                    onChange={(e) => handleChange('inTransitQuantity', parseFloat(e.target.value) || 0)}
                    disabled={!isEditable}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Stock being transferred
                  </p>
                </div>
                <div>
                  <Label htmlFor="totalQuantity">Total Quantity</Label>
                  <Input
                    id="totalQuantity"
                    type="number"
                    value={localConfig.availableQuantity + localConfig.reservedQuantity + localConfig.inTransitQuantity}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Sum of all quantities
                  </p>
                </div>
                <div>
                  <Label htmlFor="minimumStock">Minimum Stock *</Label>
                  <Input
                    id="minimumStock"
                    type="number"
                    min="0"
                    step="0.01"
                    value={localConfig.minimumStock}
                    onChange={(e) => handleChange('minimumStock', parseFloat(e.target.value) || 0)}
                    disabled={!isEditable}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="maximumStock">Maximum Stock</Label>
                  <Input
                    id="maximumStock"
                    type="number"
                    min="0"
                    step="0.01"
                    value={localConfig.maximumStock || ''}
                    onChange={(e) => handleChange('maximumStock', e.target.value ? parseFloat(e.target.value) : undefined)}
                    disabled={!isEditable}
                    className={validationErrors.maximumStock ? 'border-red-500' : ''}
                  />
                  {validationErrors.maximumStock && (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.maximumStock}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="reorderPoint">Reorder Point</Label>
                  <Input
                    id="reorderPoint"
                    type="number"
                    min="0"
                    step="0.01"
                    value={localConfig.reorderPoint || ''}
                    onChange={(e) => handleChange('reorderPoint', e.target.value ? parseFloat(e.target.value) : undefined)}
                    disabled={!isEditable}
                    className={validationErrors.reorderPoint ? 'border-red-500' : ''}
                  />
                  {validationErrors.reorderPoint && (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.reorderPoint}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Costing Method */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Costing Method</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="costingMethod">Costing Method *</Label>
                  <Select
                    value={localConfig.costingMethod}
                    onValueChange={(value) => handleChange('costingMethod', value)}
                    disabled={!isEditable}
                  >
                    <SelectTrigger id="costingMethod">
                      <SelectValue placeholder="Select costing method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIFO">FIFO (First In, First Out)</SelectItem>
                      <SelectItem value="WEIGHTED_AVERAGE">Weighted Average</SelectItem>
                      <SelectItem value="STANDARD_COST">Standard Cost</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Method used for inventory valuation
                  </p>
                </div>
                {localConfig.costingMethod === 'STANDARD_COST' && (
                  <div>
                    <Label htmlFor="standardCost">Standard Cost (₹)</Label>
                    <Input
                      id="standardCost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={localConfig.standardCost || ''}
                      onChange={(e) => handleChange('standardCost', e.target.value ? parseFloat(e.target.value) : undefined)}
                      disabled={!isEditable}
                      className={validationErrors.standardCost ? 'border-red-500' : ''}
                    />
                    {validationErrors.standardCost && (
                      <p className="text-xs text-red-500 mt-1">{validationErrors.standardCost}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Pricing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lastPurchasePrice">Last Purchase Price (₹)</Label>
                  <Input
                    id="lastPurchasePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={localConfig.lastPurchasePrice || ''}
                    onChange={(e) => handleChange('lastPurchasePrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                    disabled={!isEditable}
                    className={validationErrors.lastPurchasePrice ? 'border-red-500' : ''}
                  />
                  {validationErrors.lastPurchasePrice && (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.lastPurchasePrice}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="lastPurchaseDate">Last Purchase Date</Label>
                  <Input
                    id="lastPurchaseDate"
                    type="date"
                    value={formatDate(localConfig.lastPurchaseDate)}
                    onChange={(e) => handleChange('lastPurchaseDate', e.target.value ? new Date(e.target.value) : undefined)}
                    disabled={!isEditable}
                  />
                </div>
              </div>
            </div>

            {/* Supplier */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Supplier</h3>
              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Select
                  value={localConfig.supplier || 'none'}
                  onValueChange={(value) => handleChange('supplier', value === 'none' ? undefined : value)}
                  disabled={!isEditable}
                >
                  <SelectTrigger id="supplier">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier._id} value={supplier._id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Storage Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Storage Information</h3>
              <div>
                <Label htmlFor="storageLocation">Storage Location</Label>
                <Input
                  id="storageLocation"
                  value={localConfig.storageLocation || ''}
                  onChange={(e) => handleChange('storageLocation', e.target.value || undefined)}
                  placeholder="e.g., Shelf A-3"
                  disabled={!isEditable}
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Status</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isActive"
                    checked={localConfig.isActive}
                    onCheckedChange={(checked) => handleChange('isActive', checked as boolean)}
                    disabled={!isEditable}
                  />
                  <Label htmlFor="isActive" className="cursor-pointer">
                    Active
                  </Label>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Notes</h3>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={localConfig.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value || undefined)}
                  placeholder="Additional notes..."
                  rows={3}
                  maxLength={500}
                  disabled={!isEditable}
                />
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
