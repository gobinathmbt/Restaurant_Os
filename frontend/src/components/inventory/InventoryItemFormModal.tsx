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
import { useToast } from '@/hooks/use-toast';
import { inventoryServices, supplierServices } from '@/api/services';

interface InventoryItemFormModalProps {
  open: boolean;
  onClose: () => void;
  item: any | null;
  branchId: string;
  onSuccess: () => void;
}

interface Supplier {
  _id: string;
  name: string;
}

export default function InventoryItemFormModal({ 
  open, 
  onClose, 
  item, 
  branchId,
  onSuccess 
}: InventoryItemFormModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    type: 'raw_material',
    category: '',
    unit: 'kg',
    currentStock: 0,
    minimumStock: 0,
    maximumStock: 0,
    reorderPoint: 0,
    costPrice: 0,
    supplier: '',
    expiryDate: '',
    batchNumber: '',
    sku: '',
    barcode: ''
  });

  useEffect(() => {
    if (open) {
      fetchSuppliers();
    }
  }, [open]);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        type: item.type || 'raw_material',
        category: item.category || '',
        unit: item.unit || 'kg',
        currentStock: item.currentStock || 0,
        minimumStock: item.minimumStock || 0,
        maximumStock: item.maximumStock || 0,
        reorderPoint: item.reorderPoint || 0,
        costPrice: item.costPrice || 0,
        supplier: item.supplier?._id || item.supplier || '',
        expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : '',
        batchNumber: item.batchNumber || '',
        sku: item.sku || '',
        barcode: item.barcode || ''
      });
    } else {
      setFormData({
        name: '',
        type: 'raw_material',
        category: '',
        unit: 'kg',
        currentStock: 0,
        minimumStock: 0,
        maximumStock: 0,
        reorderPoint: 0,
        costPrice: 0,
        supplier: '',
        expiryDate: '',
        batchNumber: '',
        sku: '',
        barcode: ''
      });
    }
  }, [item, open]);

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

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.type) {
      toast({
        title: "Validation Error",
        description: "Type is required",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.unit) {
      toast({
        title: "Validation Error",
        description: "Unit is required",
        variant: "destructive",
      });
      return false;
    }

    if (formData.currentStock < 0) {
      toast({
        title: "Validation Error",
        description: "Current stock cannot be negative",
        variant: "destructive",
      });
      return false;
    }

    if (formData.minimumStock < 0) {
      toast({
        title: "Validation Error",
        description: "Minimum stock cannot be negative",
        variant: "destructive",
      });
      return false;
    }

    if (formData.maximumStock > 0 && formData.maximumStock < formData.minimumStock) {
      toast({
        title: "Validation Error",
        description: "Maximum stock must be greater than or equal to minimum stock",
        variant: "destructive",
      });
      return false;
    }

    if (formData.costPrice < 0) {
      toast({
        title: "Validation Error",
        description: "Cost price cannot be negative",
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
      
      const submitData: any = {
        name: formData.name.trim(),
        type: formData.type,
        category: formData.category.trim(),
        unit: formData.unit,
        minimumStock: formData.minimumStock,
        maximumStock: formData.maximumStock || undefined,
        reorderPoint: formData.reorderPoint || undefined,
        costPrice: formData.costPrice || undefined,
        supplier: formData.supplier || undefined,
        expiryDate: formData.expiryDate || undefined,
        batchNumber: formData.batchNumber.trim() || undefined,
        sku: formData.sku.trim() || undefined,
        barcode: formData.barcode.trim() || undefined
      };

      // Only include currentStock for new items
      if (!item) {
        submitData.initialStock = formData.currentStock;
      }

      if (item) {
        await inventoryServices.updateInventoryItem(item._id, submitData);
        toast({
          title: "Success",
          description: "Inventory item updated successfully",
          variant: "success",
        });
      } else {
        await inventoryServices.createInventoryItem(branchId, submitData);
        toast({
          title: "Success",
          description: "Inventory item created successfully",
          variant: "success",
        });
      }
      
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || `Failed to ${item ? 'update' : 'create'} inventory item`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="inventory-item-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Tomatoes"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw_material">Raw Material</SelectItem>
                      <SelectItem value="finished_good">Finished Good</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Vegetables"
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unit *</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData({ ...formData, unit: value })}
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

            {/* Stock Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Stock Information</h3>
              <div className="grid grid-cols-2 gap-4">
                {!item && (
                  <div>
                    <Label htmlFor="currentStock">Initial Stock *</Label>
                    <Input
                      id="currentStock"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.currentStock}
                      onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      required
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="minimumStock">Minimum Stock *</Label>
                  <Input
                    id="minimumStock"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.minimumStock}
                    onChange={(e) => setFormData({ ...formData, minimumStock: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
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
                    value={formData.maximumStock}
                    onChange={(e) => setFormData({ ...formData, maximumStock: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="reorderPoint">Reorder Point</Label>
                  <Input
                    id="reorderPoint"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.reorderPoint}
                    onChange={(e) => setFormData({ ...formData, reorderPoint: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Pricing & Supplier */}
            <div className="space-y-4">
              <h3 className="font-semibold">Pricing & Supplier</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="costPrice">Cost Price</Label>
                  <Input
                    id="costPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="supplier">Supplier</Label>
                  <Select
                    value={formData.supplier}
                    onValueChange={(value) => setFormData({ ...formData, supplier: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier._id} value={supplier._id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="space-y-4">
              <h3 className="font-semibold">Additional Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="batchNumber">Batch Number</Label>
                  <Input
                    id="batchNumber"
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    placeholder="e.g., BATCH-2024-001"
                  />
                </div>
                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="e.g., VEG-TOM-001"
                  />
                </div>
                <div>
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="e.g., 1234567890123"
                  />
                </div>
              </div>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="inventory-item-form" disabled={loading}>
            {loading ? 'Saving...' : item ? 'Update Item' : 'Create Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
