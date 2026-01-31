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
import { useToast } from '@/hooks/use-toast';
import { inventoryServices } from '@/api/services';
import { AlertCircle } from 'lucide-react';

interface StockAdjustmentFormModalProps {
  open: boolean;
  onClose: () => void;
  branchId: string;
  onSuccess: () => void;
}

interface InventoryItem {
  _id: string;
  name: string;
  currentStock: number;
  unit: string;
}

export default function StockAdjustmentFormModal({ 
  open, 
  onClose, 
  branchId,
  onSuccess 
}: StockAdjustmentFormModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    inventoryItemId: '',
    adjustmentType: 'increase',
    quantity: 0,
    reason: 'count_correction',
    notes: ''
  });

  useEffect(() => {
    if (open) {
      fetchInventoryItems();
      resetForm();
    }
  }, [open, branchId]);

  const resetForm = () => {
    setFormData({
      inventoryItemId: '',
      adjustmentType: 'increase',
      quantity: 0,
      reason: 'count_correction',
      notes: ''
    });
    setSelectedItem(null);
  };

  const fetchInventoryItems = async () => {
    try {
      const response = await inventoryServices.getInventoryItems(branchId, { limit: 1000 });
      setInventoryItems(response.data.data.items || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch inventory items",
        variant: "destructive",
      });
    }
  };

  const handleItemChange = (itemId: string) => {
    const item = inventoryItems.find(i => i._id === itemId);
    setSelectedItem(item || null);
    setFormData({ ...formData, inventoryItemId: itemId });
  };

  const calculateNewStock = () => {
    if (!selectedItem) return 0;
    
    const currentStock = selectedItem.currentStock;
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
      
      const submitData = {
        inventoryItemId: formData.inventoryItemId,
        adjustmentType: formData.adjustmentType,
        quantity: formData.quantity,
        reason: formData.reason,
        notes: formData.notes.trim() || undefined
      };

      await inventoryServices.createStockAdjustment(branchId, submitData);
      toast({
        title: "Success",
        description: "Stock adjustment created successfully",
        variant: "success",
      });
      
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create stock adjustment",
        variant: "destructive",
      });
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
          <form id="stock-adjustment-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Inventory Item Selection */}
            <div className="space-y-4">
              <h3 className="font-semibold">Item Selection</h3>
              <div>
                <Label htmlFor="inventoryItem">Inventory Item *</Label>
                <Select
                  value={formData.inventoryItemId}
                  onValueChange={handleItemChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select inventory item" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryItems.map((item) => (
                      <SelectItem key={item._id} value={item._id}>
                        {item.name} (Current: {item.currentStock} {item.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Current Stock Display */}
              {selectedItem && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Current Stock</span>
                      <p className="text-2xl font-bold">
                        {selectedItem.currentStock} {selectedItem.unit}
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
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
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
                    placeholder="0"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="reason">Reason *</Label>
                  <Select
                    value={formData.reason}
                    onValueChange={(value) => setFormData({ ...formData, reason: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
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

            {/* New Stock Preview */}
            {selectedItem && (
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
                placeholder="Additional notes about this adjustment..."
                rows={3}
              />
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="stock-adjustment-form" disabled={loading || willBeNegative}>
            {loading ? 'Creating...' : 'Create Adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
