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
import { inventoryServices, locationServices } from '@/api/services';
import { Plus, Trash2, AlertCircle, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StockRequestFormModalProps {
  open: boolean;
  onClose: () => void;
  currentBranchId: string;
  onSuccess: () => void;
}

interface Location {
  _id: string;
  name: string;
  code: string;
  type: string;
}

interface InventoryItem {
  _id: string;
  name: string;
  currentStock: number;
  unit: string;
}

interface LineItem {
  inventoryItem: string;
  requestedQuantity: number;
  unit: string;
  availableStock: number;
}

export default function StockRequestFormModal({ 
  open, 
  onClose, 
  currentBranchId,
  onSuccess 
}: StockRequestFormModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [formData, setFormData] = useState({
    fromLocation: '',
    toLocation: currentBranchId,
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    notes: ''
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      inventoryItem: '',
      requestedQuantity: 0,
      unit: '',
      availableStock: 0
    }
  ]);

  useEffect(() => {
    if (open) {
      fetchLocations();
      resetForm();
    }
  }, [open, currentBranchId]);

  useEffect(() => {
    if (formData.fromLocation) {
      fetchInventoryItems(formData.fromLocation);
    }
  }, [formData.fromLocation]);

  const resetForm = () => {
    setFormData({
      fromLocation: '',
      toLocation: currentBranchId,
      priority: 'normal',
      notes: ''
    });
    setLineItems([
      {
        inventoryItem: '',
        requestedQuantity: 0,
        unit: '',
        availableStock: 0
      }
    ]);
  };

  const fetchLocations = async () => {
    try {
      const response = await locationServices.getLocations({ limit: 100, isActive: true });
      // API returns: { success: true, data: { data: [...], pagination: {...} } }
      setLocations(response.data.data.data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch locations",
        variant: "destructive",
      });
    }
  };

  const fetchInventoryItems = async (locationId: string) => {
    try {
      const response = await inventoryServices.getInventoryItems({ branchId: locationId, limit: 1000 });
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
        requestedQuantity: 0,
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

  const calculateExpectedDeliveryDate = () => {
    const daysMap = {
      urgent: 1,
      high: 3,
      normal: 7,
      low: 14
    };
    const days = daysMap[formData.priority];
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig: Record<string, { className: string; label: string }> = {
      urgent: { className: 'bg-red-100 text-red-800', label: 'Urgent (1 day)' },
      high: { className: 'bg-orange-100 text-orange-800', label: 'High (3 days)' },
      normal: { className: 'bg-blue-100 text-blue-800', label: 'Normal (7 days)' },
      low: { className: 'bg-gray-100 text-gray-800', label: 'Low (14 days)' }
    };

    const config = priorityConfig[priority] || { className: 'bg-gray-100 text-gray-800', label: priority };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const validateForm = () => {
    if (!formData.fromLocation) {
      toast({
        title: "Validation Error",
        description: "From location is required",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.toLocation) {
      toast({
        title: "Validation Error",
        description: "To location is required",
        variant: "destructive",
      });
      return false;
    }

    if (formData.fromLocation === formData.toLocation) {
      toast({
        title: "Validation Error",
        description: "From location and to location cannot be the same",
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
        if (item.requestedQuantity <= 0) {
          toast({
            title: "Validation Error",
            description: `Line item ${i + 1}: Requested quantity must be greater than 0`,
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
        fromLocation: formData.fromLocation,
        toLocation: formData.toLocation,
        priority: formData.priority,
        notes: formData.notes.trim() || undefined,
        items: lineItems
          .filter(item => item.inventoryItem)
          .map(item => ({
            inventoryItem: item.inventoryItem,
            requestedQuantity: item.requestedQuantity,
            unit: item.unit
          }))
      };

      await inventoryServices.createStockRequest(submitData);
      toast({
        title: "Success",
        description: "Stock request created successfully",
        variant: "success",
      });
      
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create stock request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAvailableToLocations = () => {
    return locations.filter(location => location._id !== formData.fromLocation);
  };

  const getAvailableFromLocations = () => {
    return locations.filter(location => location._id !== formData.toLocation);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Stock Request</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="stock-request-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Location Selection */}
            <div className="space-y-4">
              <h3 className="font-semibold">Location Selection</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fromLocation">From Location *</Label>
                  <Select
                    value={formData.fromLocation}
                    onValueChange={(value) => {
                      setFormData({ ...formData, fromLocation: value });
                      // Reset line items when from location changes
                      setLineItems([{
                        inventoryItem: '',
                        requestedQuantity: 0,
                        unit: '',
                        availableStock: 0
                      }]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select from location" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableFromLocations().map((location) => (
                        <SelectItem key={location._id} value={location._id}>
                          {location.name} ({location.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="toLocation">To Location *</Label>
                  <Select
                    value={formData.toLocation}
                    onValueChange={(value) => setFormData({ ...formData, toLocation: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select to location" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableToLocations().map((location) => (
                        <SelectItem key={location._id} value={location._id}>
                          {location.name} ({location.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Priority Selection */}
            <div className="space-y-4">
              <h3 className="font-semibold">Priority & Delivery</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Priority *</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent (1 day)</SelectItem>
                      <SelectItem value="high">High (3 days)</SelectItem>
                      <SelectItem value="normal">Normal (7 days)</SelectItem>
                      <SelectItem value="low">Low (14 days)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Expected Delivery Date</Label>
                  <div className="flex items-center gap-2 h-10 px-3 py-2 border rounded-md bg-muted">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{calculateExpectedDeliveryDate()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Selected Priority:</span>
                {getPriorityBadge(formData.priority)}
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Items to Request *</h3>
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
                        <Label>Requested Quantity *</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.requestedQuantity || ''}
                          onChange={(e) => handleLineItemChange(index, 'requestedQuantity', parseFloat(e.target.value) || 0)}
                          placeholder="0"
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
                    </div>
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
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this request..."
                rows={3}
              />
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="stock-request-form" disabled={loading}>
            {loading ? 'Creating...' : 'Create Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
