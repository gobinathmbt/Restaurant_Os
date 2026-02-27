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
import { inventoryServices, branchServices } from '@/api/services';
import { Plus, Trash2, AlertCircle } from 'lucide-react';

interface StockTransferFormModalProps {
  open: boolean;
  onClose: () => void;
  currentBranchId: string;
  onSuccess: () => void;
}

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface InventoryItem {
  _id: string;
  name: string;
  currentStock: number;
  unit: string;
}

interface LineItem {
  inventoryItem: string;
  quantity: number;
  unit: string;
  availableStock: number;
}

export default function StockTransferFormModal({ 
  open, 
  onClose, 
  currentBranchId,
  onSuccess 
}: StockTransferFormModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [formData, setFormData] = useState({
    destinationLocation: currentBranchId,
    sourceLocation: '',
    notes: ''
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      inventoryItem: '',
      quantity: 0,
      unit: '',
      availableStock: 0
    }
  ]);

  useEffect(() => {
    if (open) {
      fetchBranches();
      resetForm();
    }
  }, [open, currentBranchId]);

  useEffect(() => {
    if (formData.destinationLocation) {
      fetchInventoryItems(formData.destinationLocation);
    }
  }, [formData.destinationLocation]);

  const resetForm = () => {
    setFormData({
      destinationLocation: currentBranchId,
      sourceLocation: '',
      notes: ''
    });
    setLineItems([
      {
        inventoryItem: '',
        quantity: 0,
        unit: '',
        availableStock: 0
      }
    ]);
  };

  const fetchBranches = async () => {
    try {
      const response = await branchServices.getBranches({ limit: 100, isActive: true });
      setBranches(response.data.data.branches || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch branches",
        variant: "destructive",
      });
    }
  };

  const fetchInventoryItems = async (branchId: string) => {
    try {
      const response = await inventoryServices.getInventoryItems({ branchId, limit: 1000 });
      setInventoryItems(response.data.data.items || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch inventory items",
        variant: "destructive",
      });
    }
  };

  const handleLineItemChange = (index: number, field: keyof LineItem, value: any) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    // Auto-fill unit and available stock when inventory item is selected
    if (field === 'inventoryItem') {
      const selectedItem = inventoryItems.find(item => item._id === value);
      if (selectedItem) {
        updatedItems[index].unit = selectedItem.unit;
        updatedItems[index].availableStock = selectedItem.currentStock;
      }
    }

    setLineItems(updatedItems);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        inventoryItem: '',
        quantity: 0,
        unit: '',
        availableStock: 0
      }
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const validateForm = () => {
    if (!formData.destinationLocation) {
      toast({
        title: "Validation Error",
        description: "From branch is required",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.sourceLocation) {
      toast({
        title: "Validation Error",
        description: "To branch is required",
        variant: "destructive",
      });
      return false;
    }

    if (formData.destinationLocation === formData.sourceLocation) {
      toast({
        title: "Validation Error",
        description: "From branch and to branch cannot be the same",
        variant: "destructive",
      });
      return false;
    }

    if (lineItems.length === 0 || lineItems.every(item => !item.inventoryItem)) {
      toast({
        title: "Validation Error",
        description: "At least one line item is required",
        variant: "destructive",
      });
      return false;
    }

    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      if (item.inventoryItem) {
        if (item.quantity <= 0) {
          toast({
            title: "Validation Error",
            description: `Line item ${i + 1}: Quantity must be greater than 0`,
            variant: "destructive",
          });
          return false;
        }
        if (item.quantity > item.availableStock) {
          toast({
            title: "Validation Error",
            description: `Line item ${i + 1}: Quantity exceeds available stock (${item.availableStock} ${item.unit})`,
            variant: "destructive",
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
        destinationLocation: formData.destinationLocation,
        sourceLocation: formData.sourceLocation,
        notes: formData.notes.trim() || undefined,
        items: lineItems
          .filter(item => item.inventoryItem)
          .map(item => ({
            inventoryItem: item.inventoryItem,
            sentQuantity: item.quantity,
            unit: item.unit
          }))
      };

      await inventoryServices.createStockTransfer(submitData);
      toast({
        title: "Success",
        description: "Stock transfer request created successfully",
        variant: "success",
      });
      
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create stock transfer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAvailableToBranches = () => {
    return branches.filter(branch => branch._id !== formData.destinationLocation);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create Stock Transfer</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="stock-transfer-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Branch Selection */}
            <div className="space-y-4">
              <h3 className="font-semibold">Branch Selection</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="destinationLocation">From Branch *</Label>
                  <Select
                    value={formData.destinationLocation}
                    onValueChange={(value) => {
                      setFormData({ ...formData, destinationLocation: value });
                      // Reset line items when from branch changes
                      setLineItems([{
                        inventoryItem: '',
                        quantity: 0,
                        unit: '',
                        availableStock: 0
                      }]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select from branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch._id} value={branch._id}>
                          {branch.name} ({branch.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sourceLocation">To Branch *</Label>
                  <Select
                    value={formData.sourceLocation}
                    onValueChange={(value) => setFormData({ ...formData, sourceLocation: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select to branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableToBranches().map((branch) => (
                        <SelectItem key={branch._id} value={branch._id}>
                          {branch.name} ({branch.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Items to Transfer *</h3>
                <Button type="button" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {lineItems.map((item, index) => {
                  const isOverStock = item.quantity > item.availableStock && item.inventoryItem;
                  
                  return (
                    <div key={index} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Item {index + 1}</span>
                        {lineItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-4">
                          <Label>Inventory Item *</Label>
                          <Select
                            value={item.inventoryItem}
                            onValueChange={(value) => handleLineItemChange(index, 'inventoryItem', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                            <SelectContent>
                              {inventoryItems.map((invItem) => (
                                <SelectItem key={invItem._id} value={invItem._id}>
                                  {invItem.name} (Available: {invItem.currentStock} {invItem.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label>Available Stock</Label>
                          <Input
                            value={item.availableStock ? `${item.availableStock} ${item.unit}` : '-'}
                            readOnly
                            className="bg-muted"
                          />
                        </div>
                        
                        <div>
                          <Label>Quantity *</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            max={item.availableStock}
                            value={item.quantity || ''}
                            onChange={(e) => handleLineItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className={isOverStock ? 'border-destructive' : ''}
                          />
                        </div>
                        
                        <div>
                          <Label>Unit</Label>
                          <Input
                            value={item.unit || '-'}
                            readOnly
                            className="bg-muted"
                          />
                        </div>

                        {isOverStock && (
                          <div className="col-span-4 flex items-center gap-2 text-destructive text-sm">
                            <AlertCircle className="h-4 w-4" />
                            <span>Quantity exceeds available stock!</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this transfer..."
                rows={3}
              />
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="stock-transfer-form" disabled={loading}>
            {loading ? 'Creating...' : 'Create Transfer Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
