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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { inventoryServices, branchServices } from '@/api/services';
import { Plus, Trash2, Eye, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import StockViewModal from './StockViewModal';

interface GRNFormModalProps {
  open: boolean;
  onClose: () => void;
  branchId?: string;
  onSuccess: () => void;
}

interface Branch {
  _id: string;
  name: string;
  code: string;
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

export default function GRNFormModal({ open, onClose, branchId, onSuccess }: GRNFormModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedLineItemIndex, setSelectedLineItemIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    supplierId: '',
    receivedDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    invoiceDate: '',
    notes: '',
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      inventoryItem: '',
      quantity: 0,
      unit: '',
      unitPrice: 0,
      totalPrice: 0,
      batchNumber: '',
      expiryDate: '',
    },
  ]);

  // Determine user's branch access
  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');
  const isMultiBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) > 1;
  const isSingleBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) === 1;

  useEffect(() => {
    if (open) {
      fetchBranches();
      resetForm();
    }
  }, [open]);

  // Auto-select branch for single-branch admins or use provided branchId
  useEffect(() => {
    if (open) {
      if (branchId) {
        setSelectedBranch(branchId);
      } else if (isSingleBranchAdmin && user?.branchIds && user.branchIds.length === 1) {
        setSelectedBranch(user.branchIds[0]);
      }
    }
  }, [open, branchId, isSingleBranchAdmin, user?.branchIds]);

  // Load data when branch is selected
  useEffect(() => {
    if (selectedBranch) {
      fetchSuppliersForBranch(selectedBranch);
      fetchInventoryItemsForBranch(selectedBranch);
    }
  }, [selectedBranch]);

  const resetForm = () => {
    setActiveTab('basic');
    setSelectedBranch(branchId || '');
    setSuppliers([]);
    setInventoryItems([]);
    setFormData({
      supplierId: '',
      receivedDate: new Date().toISOString().split('T')[0],
      invoiceNumber: '',
      invoiceDate: '',
      notes: '',
    });
    setLineItems([
      {
        inventoryItem: '',
        quantity: 0,
        unit: '',
        unitPrice: 0,
        totalPrice: 0,
        batchNumber: '',
        expiryDate: '',
      },
    ]);
  };

  const fetchBranches = async () => {
    try {
      const response = await branchServices.getBranches({ limit: 100, isActive: true });
      const allBranches = response.data.data.branches || [];
      
      // Filter branches based on user role
      let availableBranches = allBranches;
      if (isMultiBranchAdmin || isSingleBranchAdmin) {
        availableBranches = allBranches.filter((branch: Branch) => 
          user?.branchIds?.includes(branch._id)
        );
      }
      
      setBranches(availableBranches);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch branches',
        variant: 'destructive',
      });
    }
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranch(branchId);
    // Clear previous data when branch changes
    setSuppliers([]);
    setInventoryItems([]);
    setFormData({
      ...formData,
      supplierId: '',
    });
    setLineItems([
      {
        inventoryItem: '',
        quantity: 0,
        unit: '',
        unitPrice: 0,
        totalPrice: 0,
        batchNumber: '',
        expiryDate: '',
      },
    ]);
  };

  const fetchSuppliersForBranch = async (branchId: string) => {
    try {
      setLoading(true);
      const response = await inventoryServices.getSuppliersForBranch(branchId);
      setSuppliers(response.data.data.suppliers || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch suppliers for selected branch',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryItemsForBranch = async (branchId: string) => {
    try {
      setLoading(true);
      const response = await inventoryServices.getInventoryItemsForBranch(branchId);
      setInventoryItems(response.data.data.items || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch inventory items for selected branch',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLineItemChange = (index: number, field: keyof LineItem, value: any) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    // Auto-fill unit when inventory item is selected
    if (field === 'inventoryItem') {
      const selectedItem = inventoryItems.find((item) => item._id === value);
      if (selectedItem) {
        updatedItems[index].unit = selectedItem.unit;
      }
    }

    // Calculate total price when quantity or unit price changes
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? parseFloat(value) || 0 : updatedItems[index].quantity;
      const unitPrice =
        field === 'unitPrice' ? parseFloat(value) || 0 : updatedItems[index].unitPrice;
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
        expiryDate: '',
      },
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

  const handleViewStock = (index: number) => {
    const item = lineItems[index];
    if (!selectedBranch) {
      toast({
        title: 'Branch Required',
        description: 'Please select a branch first',
        variant: 'destructive',
      });
      return;
    }

    if (!item.inventoryItem) {
      toast({
        title: 'Item Required',
        description: 'Please select an inventory item first',
        variant: 'destructive',
      });
      return;
    }

    setSelectedLineItemIndex(index);
    setShowStockModal(true);
  };

  const validateBasicInfo = () => {
    if (!selectedBranch) {
      toast({
        title: 'Validation Error',
        description: 'Branch selection is required',
        variant: 'destructive',
      });
      return false;
    }

    if (!formData.receivedDate) {
      toast({
        title: 'Validation Error',
        description: 'Received date is required',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const handleNextTab = () => {
    if (activeTab === 'basic') {
      if (validateBasicInfo()) {
        setActiveTab('items');
      }
    }
  };

  const validateForm = () => {
    if (!validateBasicInfo()) {
      return false;
    }

    if (!formData.supplierId) {
      toast({
        title: 'Validation Error',
        description: 'Supplier is required',
        variant: 'destructive',
      });
      return false;
    }

    if (lineItems.length === 0 || lineItems.every((item) => !item.inventoryItem)) {
      toast({
        title: 'Validation Error',
        description: 'At least one line item is required',
        variant: 'destructive',
      });
      return false;
    }

    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      if (item.inventoryItem) {
        if (item.quantity <= 0) {
          toast({
            title: 'Validation Error',
            description: `Line item ${i + 1}: Quantity must be greater than 0`,
            variant: 'destructive',
          });
          return false;
        }
        if (item.unitPrice < 0) {
          toast({
            title: 'Validation Error',
            description: `Line item ${i + 1}: Unit price cannot be negative`,
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
        supplierId: formData.supplierId,
        receivedDate: formData.receivedDate,
        invoiceNumber: formData.invoiceNumber.trim() || undefined,
        invoiceDate: formData.invoiceDate || undefined,
        notes: formData.notes.trim() || undefined,
        items: lineItems
          .filter((item) => item.inventoryItem)
          .map((item) => ({
            inventoryItem: item.inventoryItem,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            batchNumber: item.batchNumber.trim() || undefined,
            expiryDate: item.expiryDate || undefined,
          })),
      };

      await inventoryServices.createGRN(selectedBranch, submitData);
      toast({
        title: 'Success',
        description: 'GRN created successfully',
        variant: 'success',
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      // Handle different error types
      const status = error.response?.status;
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create GRN';
      
      if (status === 400) {
        toast({
          title: 'Validation Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } else if (status === 403) {
        toast({
          title: 'Access Denied',
          description: errorMessage || 'You do not have permission to create GRN for this branch',
          variant: 'destructive',
        });
      } else if (status === 404) {
        toast({
          title: 'Not Found',
          description: errorMessage || 'Branch, supplier, or inventory item not found',
          variant: 'destructive',
        });
      } else if (error.code === 'ERR_NETWORK' || !error.response) {
        toast({
          title: 'Network Error',
          description: 'Unable to connect to the server. Please check your connection and try again.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedBranchName = branches.find(b => b._id === selectedBranch)?.name;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create Goods Receipt Note</DialogTitle>
          {selectedBranchName && (
            <p className="text-sm text-muted-foreground">Branch: {selectedBranchName}</p>
          )}
        </DialogHeader>

        <DialogBody className="overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Information</TabsTrigger>
              <TabsTrigger value="items" disabled={!selectedBranch}>
                Items & Supplier
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 overflow-y-auto max-h-[calc(90vh-250px)]">
              <TabsContent value="basic" className="space-y-6 mt-0">
                <form id="grn-basic-form" className="space-y-6">
                  {/* Branch Selection */}
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <h3 className="font-semibold text-lg">Branch Selection</h3>
                    <div>
                      <Label htmlFor="branch" className="text-base">Branch *</Label>
                      <Select
                        value={selectedBranch}
                        onValueChange={handleBranchChange}
                        disabled={isSingleBranchAdmin}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch._id} value={branch._id}>
                              {branch.name} ({branch.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!selectedBranch && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Please select a branch to continue
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Receipt Information */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg">Receipt Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="receivedDate" className="text-base">Received Date *</Label>
                        <Input
                          id="receivedDate"
                          type="date"
                          value={formData.receivedDate}
                          onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                          disabled={!selectedBranch}
                          required
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="invoiceDate" className="text-base">Invoice Date</Label>
                        <Input
                          id="invoiceDate"
                          type="date"
                          value={formData.invoiceDate}
                          onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                          disabled={!selectedBranch}
                          className="mt-2"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="invoiceNumber" className="text-base">Invoice Number</Label>
                        <Input
                          id="invoiceNumber"
                          value={formData.invoiceNumber}
                          onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                          placeholder="e.g., INV-2024-001"
                          disabled={!selectedBranch}
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="items" className="space-y-6 mt-0">
                <form id="grn-items-form" onSubmit={handleSubmit} className="space-y-6">
                  {/* Supplier Selection */}
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <h3 className="font-semibold text-lg">Supplier</h3>
                    <div>
                      <Label htmlFor="supplier" className="text-base">Supplier *</Label>
                      <Select
                        value={formData.supplierId}
                        onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                        disabled={!selectedBranch || loading}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder={!selectedBranch ? "Select branch first" : "Select supplier"} />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.length === 0 && selectedBranch ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              No suppliers available for this branch
                            </div>
                          ) : (
                            suppliers.map((supplier) => (
                              <SelectItem key={supplier._id} value={supplier._id}>
                                {supplier.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">Line Items *</h3>
                      <Button 
                        type="button" 
                        size="sm" 
                        onClick={addLineItem}
                        disabled={!selectedBranch}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Item
                      </Button>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {lineItems.map((item, index) => (
                        <div key={index} className="p-4 border rounded-lg space-y-3 bg-background">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Item {index + 1}</span>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewStock(index)}
                                disabled={!item.inventoryItem}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View Stock
                              </Button>
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
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-3">
                              <Label>Inventory Item *</Label>
                              <Select
                                value={item.inventoryItem}
                                onValueChange={(value) =>
                                  handleLineItemChange(index, 'inventoryItem', value)
                                }
                                disabled={!selectedBranch || loading}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={!selectedBranch ? "Select branch first" : "Select item"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {inventoryItems.length === 0 && selectedBranch ? (
                                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                      No inventory items available for this branch
                                    </div>
                                  ) : (
                                    inventoryItems.map((invItem) => (
                                      <SelectItem key={invItem._id} value={invItem._id}>
                                        {invItem.name} ({invItem.unit})
                                      </SelectItem>
                                    ))
                                  )}
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
                                disabled={!selectedBranch}
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
                                disabled={!selectedBranch}
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
                                onChange={(e) =>
                                  handleLineItemChange(index, 'batchNumber', e.target.value)
                                }
                                placeholder="e.g., BATCH-001"
                                disabled={!selectedBranch}
                              />
                            </div>

                            <div>
                              <Label>Expiry Date</Label>
                              <Input
                                type="date"
                                value={item.expiryDate}
                                onChange={(e) =>
                                  handleLineItemChange(index, 'expiryDate', e.target.value)
                                }
                                disabled={!selectedBranch}
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
                  <div className="p-4 border rounded-lg">
                    <Label htmlFor="notes" className="text-base">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes..."
                      rows={3}
                      disabled={!selectedBranch}
                      className="mt-2"
                    />
                  </div>
                </form>
              </TabsContent>
            </div>
          </Tabs>
        </DialogBody>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div>
              {activeTab === 'items' && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setActiveTab('basic')}
                  disabled={loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              {activeTab === 'basic' ? (
                <Button type="button" onClick={handleNextTab} disabled={!selectedBranch}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button type="submit" form="grn-items-form" disabled={loading}>
                  {loading ? 'Creating...' : 'Create GRN'}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Stock View Modal */}
      {selectedLineItemIndex !== null && (
        <StockViewModal
          open={showStockModal}
          onClose={() => {
            setShowStockModal(false);
            setSelectedLineItemIndex(null);
          }}
          branchId={selectedBranch}
          lineItems={[lineItems[selectedLineItemIndex]]}
        />
      )}
    </Dialog>
  );
}
