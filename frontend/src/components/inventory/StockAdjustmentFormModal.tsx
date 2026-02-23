import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { inventoryServices } from '@/api/services';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, Zap, Clock } from 'lucide-react';
import InventoryItemDropdown from '@/components/common/InventoryItemDropdown';
import BranchSearch from '@/components/common/BranchSearch';

interface StockAdjustmentFormModalProps {
  open: boolean;
  onClose: () => void;
  branchId?: string;
  onSuccess: () => void;
}

interface BranchConfig {
  currentStock: number;
  minimumStock: number;
  maximumStock?: number;
  lastPurchasePrice?: number;
  lastPurchaseDate?: string;
}

interface InventoryItem {
  _id: string;
  name: string;
  unit: string;
  category?: string | { _id: string; name: string };
  subcategory?: string | { _id: string; name: string };
  branchConfig?: BranchConfig;
}

export default function StockAdjustmentFormModal({ 
  open, 
  onClose, 
  branchId,
  onSuccess 
}: StockAdjustmentFormModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Determine if user is super admin
  const isSuperAdmin = user?.role === 'company_super_admin_primary' || user?.role === 'company_super_admin_secondary';
  
  // Branch state - using array for BranchSearch compatibility
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  
  // Inventory items cache for capacity validation
  const [inventoryItemsCache, setInventoryItemsCache] = useState<Map<string, InventoryItem>>(new Map());
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  
  // Capacity error state
  const [capacityError, setCapacityError] = useState<string>('');
  
  const [formData, setFormData] = useState({
    inventoryItemId: '',
    adjustmentType: 'increase',
    quantity: 0,
    reason: 'count_correction',
    notes: ''
  });

  // Reset form on modal open/close
  useEffect(() => {
    if (open) {
      // Reset form fields but not branch (BranchSearch will handle auto-selection)
      setFormData({
        inventoryItemId: '',
        adjustmentType: 'increase',
        quantity: 0,
        reason: 'count_correction',
        notes: ''
      });
      setSelectedItem(null);
      setInventoryItemsCache(new Map());
      setCapacityError('');
    } else {
      // Clear branch selection when modal closes (so auto-select works on next open)
      setSelectedBranchIds([]);
    }
  }, [open]);

  // Set branch from prop if provided (for pre-selection from parent)
  useEffect(() => {
    if (branchId && branchId !== 'all' && open) {
      setSelectedBranchIds([branchId]);
    }
  }, [branchId, open]);

  const resetForm = () => {
    setFormData({
      inventoryItemId: '',
      adjustmentType: 'increase',
      quantity: 0,
      reason: 'count_correction',
      notes: ''
    });
    setSelectedItem(null);
    setInventoryItemsCache(new Map());
    setCapacityError('');
    // Don't reset branch - let BranchSearch handle auto-selection
  };

  // Clear form data when branch changes
  const handleBranchChange = (branchIds: string[]) => {
    setSelectedBranchIds(branchIds);
    setFormData({
      inventoryItemId: '',
      adjustmentType: 'increase',
      quantity: 0,
      reason: 'count_correction',
      notes: ''
    });
    setSelectedItem(null);
    setInventoryItemsCache(new Map());
    setCapacityError('');
  };

  // Get selected branch ID (first element since single-select)
  const selectedBranch = selectedBranchIds[0] || '';

  // Validate capacity when quantity or adjustmentType changes
  useEffect(() => {
    if (formData.inventoryItemId && formData.quantity > 0) {
      const validation = validateCapacity(
        formData.inventoryItemId,
        formData.quantity,
        formData.adjustmentType
      );
      
      if (!validation.valid && validation.error) {
        setCapacityError(validation.error);
      } else {
        setCapacityError('');
      }
    } else {
      setCapacityError('');
    }
  }, [formData.quantity, formData.adjustmentType, formData.inventoryItemId, inventoryItemsCache]);

  // Handle items loaded from InventoryItemDropdown
  const handleItemsLoaded = (items: InventoryItem[]) => {
    const cache = new Map<string, InventoryItem>();
    items.forEach(item => {
      cache.set(item._id, item);
    });
    setInventoryItemsCache(cache);
  };

  // Handle inventory item selection
  const handleItemChange = (itemId: string, item: InventoryItem) => {
    setSelectedItem(item);
    setFormData({ ...formData, inventoryItemId: itemId });
  };

  // Validate capacity for increase and correction adjustments
  const validateCapacity = (itemId: string, quantity: number, type: string) => {
    // Validate for increase and correction types
    if (type !== 'increase' && type !== 'correction') {
      return { valid: true };
    }

    // Get item from cache
    const item = inventoryItemsCache.get(itemId);
    if (!item?.branchConfig) {
      return { valid: true };
    }

    // Extract stock values
    const { currentStock, maximumStock } = item.branchConfig;

    // If no maximum stock or maximum stock <= 0, no validation needed
    if (!maximumStock || maximumStock <= 0) {
      return { valid: true };
    }

    // Calculate projected stock
    let projectedStock: number;
    if (type === 'increase') {
      projectedStock = currentStock + quantity;
    } else if (type === 'correction') {
      projectedStock = quantity;
    } else {
      return { valid: true };
    }

    // Check if projected stock exceeds maximum
    if (projectedStock > maximumStock) {
      const excess = projectedStock - maximumStock;
      return {
        valid: false,
        error: `Exceeds capacity by ${excess.toFixed(2)} ${item.unit}. Current: ${currentStock.toFixed(2)}, Max: ${maximumStock.toFixed(2)}, Projected: ${projectedStock.toFixed(2)}`
      };
    }

    return { valid: true };
  };

  const calculateNewStock = () => {
    if (!selectedItem?.branchConfig) return 0;
    
    const currentStock = selectedItem.branchConfig.currentStock;
    const quantity = formData.quantity;
    
    switch (formData.adjustmentType) {
      case 'increase':
        return currentStock + quantity;
      case 'decrease':
        return currentStock - quantity;
      case 'correction':
        return quantity;
      default:
        return currentStock;
    }
  };

  const validateForm = () => {
    if (!formData.inventoryItemId) {
      toast({
        title: "Validation Error",
        description: "Inventory item is required",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.adjustmentType) {
      toast({
        title: "Validation Error",
        description: "Adjustment type is required",
        variant: "destructive",
      });
      return false;
    }

    if (formData.quantity <= 0 && formData.adjustmentType !== 'correction') {
      toast({
        title: "Validation Error",
        description: "Quantity must be greater than 0",
        variant: "destructive",
      });
      return false;
    }

    if (formData.adjustmentType === 'correction' && formData.quantity < 0) {
      toast({
        title: "Validation Error",
        description: "Correction quantity cannot be negative",
        variant: "destructive",
      });
      return false;
    }

    // Check for capacity errors
    if (capacityError) {
      toast({
        title: "Capacity Exceeded",
        description: capacityError,
        variant: "destructive",
      });
      return false;
    }

    const newStock = calculateNewStock();
    if (newStock < 0) {
      toast({
        title: "Validation Error",
        description: "Adjustment would result in negative stock. Please adjust the quantity.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.reason) {
      toast({
        title: "Validation Error",
        description: "Reason is required",
        variant: "destructive",
      });
      return false;
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
      
      // Map frontend adjustment types to backend enum values
      // Backend now uses: 'increase', 'decrease', 'correction'
      const adjustmentTypeMap = {
        'increase': 'increase',
        'decrease': 'decrease',
        'correction': 'correction'
      };

      const submitData = {
        locationId: selectedBranch,
        adjustmentType: adjustmentTypeMap[formData.adjustmentType as keyof typeof adjustmentTypeMap] || 'correction',
        items: [{
          inventoryItem: formData.inventoryItemId,
          currentQuantity: 0, // Will be filled by backend
          adjustedQuantity: formData.quantity,
          quantityDelta: formData.quantity, // Positive or negative
          reason: formData.reason,
          notes: formData.notes.trim() || undefined
        }],
        notes: formData.notes.trim() || undefined
      };

      await inventoryServices.createStockAdjustment(submitData);
      toast({
        title: "Success",
        description: "Stock adjustment created successfully",
        variant: "success",
      });
      
      onSuccess();
    } catch (error: any) {
      // Handle branch access denial (403)
      if (error.response?.status === 403) {
        toast({
          title: "Access Denied",
          description: error.response?.data?.message || "You do not have access to this branch",
          variant: "destructive",
        });
      }
      // Handle capacity validation errors (400)
      else if (error.response?.status === 400 && error.response?.data?.message?.includes('capacity')) {
        toast({
          title: "Capacity Exceeded",
          description: error.response.data.message,
          variant: "destructive",
        });
      }
      // Handle other validation errors (400)
      else if (error.response?.status === 400) {
        toast({
          title: "Validation Error",
          description: error.response?.data?.message || "Invalid request data",
          variant: "destructive",
        });
      }
      // Handle all other errors
      else {
        toast({
          title: "Error",
          description: error.response?.data?.message || "Failed to create stock adjustment",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const newStock = calculateNewStock();
  const willBeNegative = newStock < 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Stock Adjustment</DialogTitle>
        </DialogHeader>

        <DialogBody>
          {/* Informational Banner - Auto-Approval for Super Admins */}
          {isSuperAdmin && (
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-900 dark:text-blue-100">Auto-Approval Enabled</AlertTitle>
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                As a super admin, this adjustment will be automatically approved and stock will be deducted immediately upon creation.
              </AlertDescription>
            </Alert>
          )}

          {/* Informational Banner - Approval Required for Company Admins */}
          {!isSuperAdmin && (
            <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <AlertTitle className="text-yellow-900 dark:text-yellow-100">Approval Required</AlertTitle>
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                This adjustment will be submitted for approval. A super admin must approve it before stock is deducted.
              </AlertDescription>
            </Alert>
          )}

          <form id="stock-adjustment-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Branch Selection Section */}
            <div className="space-y-4">
              <h3 className="font-semibold">Branch Selection</h3>
              <div>
                <Label htmlFor="branch">Branch *</Label>
                <BranchSearch
                  selectedBranchIds={selectedBranchIds}
                  onBranchesChange={handleBranchChange}
                  disabled={loading}
                  placeholder="Select branch"
                  singleSelect={true}
                  autoSelectSingleBranch={true}
                />
              </div>
            </div>

            {/* Inventory Item Selection */}
            <div className="space-y-4">
              <h3 className="font-semibold">Item Selection</h3>
              <div>
                <Label htmlFor="inventoryItem">Inventory Item *</Label>
                <InventoryItemDropdown
                  locationId={selectedBranch}
                  value={formData.inventoryItemId}
                  onChange={handleItemChange}
                  onItemsLoaded={handleItemsLoaded}
                  disabled={!selectedBranch}
                  placeholder={!selectedBranch ? "Select branch first" : "Select inventory item"}
                />
              </div>

              {/* Current Stock Display */}
              {selectedItem?.branchConfig && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Current Stock</span>
                      <p className="text-2xl font-bold">
                        {selectedItem.branchConfig.currentStock} {selectedItem.unit}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Item Name</span>
                      <p className="text-lg font-semibold">{selectedItem.name}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Adjustment Details */}
            <div className="space-y-4">
              <h3 className="font-semibold">Adjustment Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="adjustmentType">Adjustment Type *</Label>
                  <Select
                    value={formData.adjustmentType}
                    onValueChange={(value) => setFormData({ ...formData, adjustmentType: value })}
                    disabled={!selectedBranch}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!selectedBranch ? "Select branch first" : "Select type"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="increase">Increase</SelectItem>
                      <SelectItem value="decrease">Decrease</SelectItem>
                      <SelectItem value="correction">Correction</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.adjustmentType === 'correction' 
                      ? 'Set stock to exact quantity' 
                      : `${formData.adjustmentType === 'increase' ? 'Add to' : 'Subtract from'} current stock`}
                  </p>
                </div>

                <div>
                  <Label htmlFor="quantity">
                    {formData.adjustmentType === 'correction' ? 'New Stock Quantity *' : 'Quantity *'}
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.quantity || ''}
                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                    placeholder={!selectedBranch ? "Select branch first" : "0"}
                    disabled={!selectedBranch}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="reason">Reason *</Label>
                  <Select
                    value={formData.reason}
                    onValueChange={(value) => setFormData({ ...formData, reason: value })}
                    disabled={!selectedBranch}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!selectedBranch ? "Select branch first" : "Select reason"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="damaged">Damaged</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="theft">Theft</SelectItem>
                      <SelectItem value="wastage">Wastage</SelectItem>
                      <SelectItem value="count_correction">Count Correction</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Capacity Error Display */}
            {capacityError && (
              <div className="p-4 bg-destructive/10 border-2 border-destructive rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-destructive mb-1">Maximum Capacity Exceeded</h4>
                    <p className="text-sm text-destructive/90">{capacityError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* New Stock Preview */}
            {selectedItem?.branchConfig && (
              <div className={`p-4 rounded-lg border-2 ${willBeNegative ? 'bg-destructive/10 border-destructive' : 'bg-primary/5 border-primary/20'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">New Stock After Adjustment</span>
                    {willBeNegative && (
                      <div className="flex items-center gap-2 mt-1 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-xs">Warning: Stock will be negative!</span>
                      </div>
                    )}
                  </div>
                  <span className={`text-3xl font-bold ${willBeNegative ? 'text-destructive' : 'text-primary'}`}>
                    {newStock.toFixed(2)} {selectedItem.unit}
                  </span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={!selectedBranch ? "Select branch first" : "Additional notes about this adjustment..."}
                disabled={!selectedBranch}
                rows={3}
              />
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="stock-adjustment-form" disabled={loading || willBeNegative || !!capacityError}>
            {loading ? 'Creating...' : 'Create Adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
