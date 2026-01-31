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
import { inventoryServices, supplierServices } from '@/api/services';
import { Plus, Trash2 } from 'lucide-react';

interface GRNFormModalProps {
  open: boolean;
  onClose: () => void;
  branchId: string;
  onSuccess: () => void;
}

interface Supplier {
  _id: string;
  name: string;
}

interface InventoryItem {
  _id: string;
  name: string;
  unit: string;
}

interface LineItem {
  inventoryItem: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  batchNumber: string;
  expiryDate: string;
}

export default function GRNFormModal({ 
  open, 
  onClose, 
  branchId,
  onSuccess 
}: GRNFormModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [formData, setFormData] = useState({
    supplierId: '',
    receivedDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    invoiceDate: '',
    notes: ''
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      inventoryItem: '',
      quantity: 0,
      unit: '',
      unitPrice: 0,
      totalPrice: 0,
      batchNumber: '',
      expiryDate: ''
    }
  ]);

  useEffect(() => {
    if (open) {
      fetchSuppliers();
      fetchInventoryItems();
      resetForm();
    }
  }, [open, branchId]);

  const resetForm = () => {
    setFormData({
      supplierId: '',
      receivedDate: new Date().toISOString().split('T')[0],
      invoiceNumber: '',
      invoiceDate: '',
      notes: ''
    });
    setLineItems([
      {
        inventoryItem: '',
        quantity: 0,
        unit: '',
        unitPrice: 0,
        totalPrice: 0,
        batchNumber: '',
        expiryDate: ''
      }
    ]);
  };

  const fetchSuppliers = async () => {
    try {
      const response = await supplierServices.getSuppliers({ limit: 100, isActive: true });
      setSuppliers(response.data.data.suppliers || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch suppliers",
        variant: "destructive",
      });
    }
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

  const handleLineItemChange = (index: number, field: keyof LineItem, value: any) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    // Auto-fill unit when inventory item is selected
    if (field === 'inventoryItem') {
      const selectedItem = inventoryItems.find(item => item._id === value);
      if (selectedItem) {
        updatedItems[index].unit = selectedItem.unit;
      }
    }

    // Calculate total price when quantity or unit price changes
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? parseFloat(value) || 0 : updatedItems[index].quantity;
      const unitPrice = field === 'unitPrice' ? parseFloat(value) || 0 : updatedItems[index].unitPrice;
      updatedItems[index].totalPrice = quantity * unitPrice;
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
        unitPrice: 0,
        totalPrice: 0,
        batchNumber: '',
        expiryDate: ''
      }
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const calculateGrandTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const validateForm = () => {
    if (!formData.supplierId) {
      toast({
        title: "Validation Error",
        description: "Supplier is required",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.receivedDate) {
      toast({
        title: "Validation Error",
        description: "Received date is required",
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
        if (item.unitPrice < 0) {
          toast({
            title: "Validation Error",
            description: `Line item ${i + 1}: Unit price cannot be negative`,
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
        supplierId: formData.supplierId,
        receivedDate: formData.receivedDate,
        invoiceNumber: formData.invoiceNumber.trim() || undefined,
        invoiceDate: formData.invoiceDate || undefined,
        notes: formData.notes.trim() || undefined,
        items: lineItems
          .filter(item => item.inventoryItem)
          .map(item => ({
            inventoryItem: item.inventoryItem,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            batchNumber: item.batchNumber.trim() || undefined,
            expiryDate: item.expiryDate || undefined
          }))
      };

      await inventoryServices.createGRN(branchId, submitData);
      toast({
        title: "Success",
        description: "GRN created successfully",
        variant: "success",
      });
      
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create GRN",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Create Goods Receipt Note</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="grn-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier">Supplier *</Label>
                  <Select
                    value={formData.supplierId}
                    onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier._id} value={supplier._id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="receivedDate">Received Date *</Label>
                  <Input
                    id="receivedDate"
                    type="date"
                    value={formData.receivedDate}
                    onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="invoiceNumber">Invoice Number</Label>
                  <Input
                    id="invoiceNumber"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    placeholder="e.g., INV-2024-001"
                  />
                </div>
                <div>
                  <Label htmlFor="invoiceDate">Invoice Date</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Line Items *</h3>
                <Button type="button" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {lineItems.map((item, index) => (
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
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-3">
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
                                {invItem.name} ({invItem.unit})
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
                          value={item.quantity || ''}
                          onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      
                      <div>
                        <Label>Unit</Label>
                        <Input
                          value={item.unit}
                          readOnly
                          placeholder="Auto-filled"
                          className="bg-muted"
                        />
                      </div>
                      
                      <div>
                        <Label>Unit Price *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice || ''}
                          onChange={(e) => handleLineItemChange(index, 'unitPrice', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div>
                        <Label>Total Price</Label>
                        <Input
                          value={item.totalPrice.toFixed(2)}
                          readOnly
                          className="bg-muted font-semibold"
                        />
                      </div>
                      
                      <div>
                        <Label>Batch Number</Label>
                        <Input
                          value={item.batchNumber}
                          onChange={(e) => handleLineItemChange(index, 'batchNumber', e.target.value)}
                          placeholder="e.g., BATCH-001"
                        />
                      </div>
                      
                      <div>
                        <Label>Expiry Date</Label>
                        <Input
                          type="date"
                          value={item.expiryDate}
                          onChange={(e) => handleLineItemChange(index, 'expiryDate', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grand Total */}
              <div className="flex justify-end items-center gap-4 p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
                <span className="text-lg font-semibold">Grand Total:</span>
                <span className="text-2xl font-bold text-primary">
                  ₹{calculateGrandTotal().toFixed(2)}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="grn-form" disabled={loading}>
            {loading ? 'Creating...' : 'Create GRN'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
