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
import { Plus, Trash2, Eye, ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import StockViewModal from './StockViewModal';
import SupplierDropdown from '@/components/common/SupplierDropdown';
import InventoryItemDropdown from '@/components/common/InventoryItemDropdown';

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

interface BranchConfig {
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  lastPurchasePrice?: number;
  lastPurchaseDate?: string;
  supplier?: {
    _id: string;
    name: string;
  };
}

interface InventoryItem {
  _id: string;
  name: string;
  unit: string;
  category?: string | { _id: string; name: string };
  subcategory?: string | { _id: string; name: string };
  branchConfig?: BranchConfig;
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
  const [inventoryItemsCache, setInventoryItemsCache] = useState<Map<string, InventoryItem>>(new Map());
  const [capacityErrors, setCapacityErrors] = useState<Map<number, string>>(new Map());
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

  // Fetch branches first, then auto-select
  useEffect(() => {
    if (open && branches.length > 0) {
      if (branchId && branchId !== 'all') {
        setSelectedBranch(branchId);
      } else if (isSingleBranchAdmin && user?.branchIds && user.branchIds.length === 1) {
        setSelectedBranch(user.branchIds[0]);
      }
    }
  }, [open, branches, branchId, isSingleBranchAdmin, user?.branchIds]);

  const resetForm = () => {
    setActiveTab('basic');
    // Don't reset selectedBranch here - let the useEffect handle it
    setInventoryItemsCache(new Map());
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
    setInventoryItemsCache(new Map());
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

  const handleLineItemChange = (index: number, field: keyof LineItem, value: any, item?: InventoryItem) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    // Auto-fill unit when inventory item is selected
    if (field === 'inventoryItem' && item) {
      updatedItems[index].unit = item.unit;
      // Add item to cache
      setInventoryItemsCache((prevCache) => {
        const newCache = new Map(prevCache);
        newCache.set(item._id, item);
        return newCache;
      });
    }

    // Calculate total price when quantity or unit price changes
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? parseFloat(value) || 0 : updatedItems[index].quantity;
      const unitPrice =
        field === 'unitPrice' ? parseFloat(value) || 0 : updatedItems[index].unitPrice;
      updatedItems[index].totalPrice = quantity * unitPrice;
    }

    setLineItems(updatedItems);

    // Validate capacity when quantity or item changes
    if ((field === 'quantity' || field === 'inventoryItem') && updatedItems[index].inventoryItem) {
      const validation = validateCapacity(
        updatedItems[index].inventoryItem,
        updatedItems[index].quantity
      );
      setCapacityErrors((prevErrors) => {
        const newErrors = new Map(prevErrors);
        if (!validation.valid && validation.error) {
          newErrors.set(index, validation.error);
        } else {
          newErrors.delete(index);
        }
        return newErrors;
      });
    }
  };

  const handleItemsLoaded = (items: InventoryItem[]) => {
    // Update cache with loaded items
    setInventoryItemsCache((prevCache) => {
      const newCache = new Map(prevCache);
      items.forEach((item) => {
        newCache.set(item._id, item);
      });
      return newCache;
    });
  };

  const validateCapacity = (itemId: string, quantity: number): { valid: boolean; error?: string } => {
    const item = inventoryItemsCache.get(itemId);
    if (!item?.branchConfig) {
      return { valid: true }; // Can't validate without cache data
    }

    const { currentStock, maximumStock } = item.branchConfig;
    if (maximumStock <= 0) {
      return { valid: true }; // No max stock set
    }

    const currentStockNum = Number(currentStock) || 0;
    const maximumStockNum = Number(maximumStock) || 0;
    const quantityNum = Number(quantity) || 0;
    const projectedStock = currentStockNum + quantityNum;
    
    if (projectedStock > maximumStockNum) {
      const excess = projectedStock - maximumStockNum;
      return {
        valid: false,
        error: `Exceeds capacity by ${excess.toFixed(2)} ${item.unit}. Max: ${maximumStockNum.toFixed(2)}, Current: ${currentStockNum.toFixed(2)}, Projected: ${projectedStock.toFixed(2)}`,
      };
    }

    return { valid: true };
  };

  const validateAllCapacities = (): boolean => {
    const errors = new Map<number, string>();
    let hasErrors = false;

    lineItems.forEach((item, index) => {
      if (item.inventoryItem && item.quantity > 0) {
        const validation = validateCapacity(item.inventoryItem, item.quantity);
        if (!validation.valid && validation.error) {
          errors.set(index, validation.error);
          hasErrors = true;
        }
      }
    });

    setCapacityErrors(errors);
    return !hasErrors;
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

    // Validate capacity for all items
    if (!validateAllCapacities()) {
      const errorCount = capacityErrors.size;
      const itemsText = errorCount === 1 ? 'item exceeds' : 'items exceed';
      toast({
        title: 'Capacity Exceeded',
        description: `${errorCount} ${itemsText} maximum stock capacity. Please review the highlighted items.`,
        variant: 'destructive',
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
        locationId: selectedBranch,
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

      await inventoryServices.createGRN(submitData);
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
      const errorDetails = error.response?.data?.errors || [];
      
      if (status === 400) {
        // For capacity validation errors, show detailed error list
        const description = errorDetails.length > 0 
          ? `${errorMessage}\n\n${errorDetails.join('\n')}`
          : errorMessage;
        
        toast({
          title: 'Validation Error',
          description,
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
                      <div className="mt-2">
                        <SupplierDropdown
                          branchId={selectedBranch}
                          value={formData.supplierId}
                          onChange={(supplierId) => setFormData({ ...formData, supplierId })}
                          disabled={!selectedBranch || loading}
                          placeholder={!selectedBranch ? "Select branch first" : "Select supplier"}
                        />
                      </div>
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
                      {lineItems.map((item, index) => {
                        const hasCapacityError = capacityErrors.has(index);
                        return (
                        <div key={index} className={`p-4 border rounded-lg space-y-3 ${hasCapacityError ? 'border-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10' : 'bg-background'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Item {index + 1}</span>
                              {hasCapacityError && (
                                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                              )}
                            </div>
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

                          {hasCapacityError && (
                            <div className="flex items-start gap-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-md">
                              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                              <div className="text-xs text-yellow-800 dark:text-yellow-200">
                                <div className="font-semibold">Capacity Warning</div>
                                <div className="mt-1">{capacityErrors.get(index)}</div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-3">
                              <Label>Inventory Item *</Label>
                              <div className="mt-1">
                                <InventoryItemDropdown
                                  locationId={selectedBranch}
                                  value={item.inventoryItem}
                                  onChange={(itemId, selectedItem) =>
                                    handleLineItemChange(index, 'inventoryItem', itemId, selectedItem)
                                  }
                                  onItemsLoaded={handleItemsLoaded}
                                  disabled={!selectedBranch || loading}
                                  placeholder={!selectedBranch ? "Select branch first" : "Select item"}
                                />
                              </div>
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
                      );
                      })}
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
          inventoryItemsCache={
            new Map(
              Array.from(inventoryItemsCache.entries()).filter(
                ([_, item]) => item.branchConfig !== undefined
              ) as [string, InventoryItem & { branchConfig: BranchConfig }][]
            )
          }
        />
      )}
    </Dialog>
  );
}
