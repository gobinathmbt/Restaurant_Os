import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface Supplier {
  _id: string;
  name: string;
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

interface InventoryBranchConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: Branch;
  config: BranchConfig;
  onChange: (config: BranchConfig) => void;
  isEditable: boolean;
  suppliers?: Supplier[];
}

export default function InventoryBranchConfigModal({
  isOpen,
  onClose,
  branch,
  config,
  onChange,
  isEditable,
  suppliers = [],
}: InventoryBranchConfigModalProps) {
  const [localConfig, setLocalConfig] = useState<BranchConfig>(config);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setLocalConfig(config);
    setValidationErrors({});
  }, [config, isOpen]);

  const validateConfig = (newConfig: BranchConfig): Record<string, string> => {
    const errors: Record<string, string> = {};

    // Validate maximumStock >= minimumStock
    if (newConfig.maximumStock !== undefined && newConfig.maximumStock < newConfig.minimumStock) {
      errors.maximumStock = 'Maximum stock must be greater than or equal to minimum stock';
    }

    // Validate currentStock <= maximumStock
    if (newConfig.maximumStock !== undefined && newConfig.currentStock > newConfig.maximumStock) {
      errors.currentStock = 'Current stock cannot exceed maximum stock';
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

    // Validate expiryDate not in past
    if (newConfig.expiryDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiry = new Date(newConfig.expiryDate);
      expiry.setHours(0, 0, 0, 0);
      if (expiry < today) {
        errors.expiryDate = 'Expiry date cannot be in the past';
      }
    }

    // Validate price decimal places (max 2)
    if (newConfig.costPrice !== undefined) {
      const decimals = (newConfig.costPrice.toString().split('.')[1] || '').length;
      if (decimals > 2) {
        errors.costPrice = 'Price cannot have more than 2 decimal places';
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

  const handleChange = (field: keyof BranchConfig, value: any) => {
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

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditable ? 'Configure' : 'View'}: {branch.name} ({branch.code})
          </DialogTitle>
          {!isEditable && (
            <p className="text-sm text-muted-foreground">
              Read-only view - You don't have permission to edit this branch
            </p>
          )}
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Stock Management */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Stock Management</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="currentStock">Current Stock *</Label>
                  <Input
                    id="currentStock"
                    type="number"
                    min="0"
                    step="0.01"
                    value={localConfig.currentStock}
                    onChange={(e) => handleChange('currentStock', parseFloat(e.target.value) || 0)}
                    disabled={!isEditable}
                    required
                    className={validationErrors.currentStock ? 'border-red-500' : ''}
                  />
                  {validationErrors.currentStock && (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.currentStock}</p>
                  )}
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

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Pricing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="costPrice">Cost Price (₹)</Label>
                  <Input
                    id="costPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={localConfig.costPrice || ''}
                    onChange={(e) => handleChange('costPrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                    disabled={!isEditable}
                    className={validationErrors.costPrice ? 'border-red-500' : ''}
                  />
                  {validationErrors.costPrice && (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.costPrice}</p>
                  )}
                </div>
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

            {/* Storage & Batch Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Storage & Batch Information</h3>
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <Label htmlFor="batchNumber">Batch Number</Label>
                  <Input
                    id="batchNumber"
                    value={localConfig.batchNumber || ''}
                    onChange={(e) => handleChange('batchNumber', e.target.value || undefined)}
                    disabled={!isEditable}
                  />
                </div>
                <div>
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    min={getTodayDate()}
                    value={formatDate(localConfig.expiryDate)}
                    onChange={(e) => handleChange('expiryDate', e.target.value ? new Date(e.target.value) : undefined)}
                    disabled={!isEditable}
                    className={validationErrors.expiryDate ? 'border-red-500' : ''}
                  />
                  {validationErrors.expiryDate && (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.expiryDate}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Branch-Specific Identifiers */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Branch-Specific Identifiers</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="branchSKU">Branch SKU</Label>
                  <Input
                    id="branchSKU"
                    value={localConfig.branchSKU || ''}
                    onChange={(e) => handleChange('branchSKU', e.target.value || undefined)}
                    disabled={!isEditable}
                  />
                </div>
                <div>
                  <Label htmlFor="branchBarcode">Branch Barcode</Label>
                  <Input
                    id="branchBarcode"
                    value={localConfig.branchBarcode || ''}
                    onChange={(e) => handleChange('branchBarcode', e.target.value || undefined)}
                    disabled={!isEditable}
                  />
                </div>
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
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isAvailable"
                    checked={localConfig.isAvailable}
                    onCheckedChange={(checked) => handleChange('isAvailable', checked as boolean)}
                    disabled={!isEditable}
                  />
                  <Label htmlFor="isAvailable" className="cursor-pointer">
                    Available
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
