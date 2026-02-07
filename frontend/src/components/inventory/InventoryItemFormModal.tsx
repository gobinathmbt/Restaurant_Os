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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { inventoryServices, supplierServices } from '@/api/services';
import BranchSearch from '@/components/common/BranchSearch';
import CategorySubcategorySearch from '@/components/common/CategorySubcategorySearch';
import { cn } from '@/lib/utils';

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
  const [activeTab, setActiveTab] = useState('basic');
  
  // Multi-branch and single category/subcategory selection state
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'raw_material',
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
      // Set form data
      setFormData({
        name: item.name || '',
        type: item.type || 'raw_material',
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
      
      // Set branch selection - handle both array and populated object formats
      if (item.branchIds) {
        const branchIds = Array.isArray(item.branchIds) 
          ? item.branchIds.map((b: any) => typeof b === 'string' ? b : b._id)
          : [];
        setSelectedBranches(branchIds);
      } else {
        setSelectedBranches([]);
      }
      
      // Set category selection - handle both ObjectId and populated object formats
      if (item.category) {
        const categoryId = typeof item.category === 'string' ? item.category : item.category._id;
        setSelectedCategories([categoryId]);
      } else {
        setSelectedCategories([]);
      }
      
      // Set subcategory selection - handle both ObjectId and populated object formats
      if (item.subcategory) {
        const subcategoryId = typeof item.subcategory === 'string' ? item.subcategory : item.subcategory._id;
        setSelectedSubcategories([subcategoryId]);
      } else {
        setSelectedSubcategories([]);
      }
    } else {
      // Reset form for new item
      setFormData({
        name: '',
        type: 'raw_material',
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
      
      // Don't pre-populate branches - let user select them manually
      // This ensures CategorySubcategorySearch works correctly
      setSelectedBranches([]);
      setSelectedCategories([]);
      setSelectedSubcategories([]);
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

  const handleBranchesChange = (branchIds: string[]) => {
    setSelectedBranches(branchIds);
    
    // If all branches are cleared, clear categories and subcategories
    if (branchIds.length === 0) {
      setSelectedCategories([]);
      setSelectedSubcategories([]);
    }
    // Note: CategorySubcategorySearch component will handle filtering of invalid categories
    // when branches change through its own useEffect
  };

  const handleCategoriesChange = (categoryIds: string[], subcategoryIds: string[]) => {
    setSelectedCategories(categoryIds);
    setSelectedSubcategories(subcategoryIds);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive",
      });
      setActiveTab('basic');
      return false;
    }

    if (!formData.type) {
      toast({
        title: "Validation Error",
        description: "Type is required",
        variant: "destructive",
      });
      setActiveTab('basic');
      return false;
    }

    if (!formData.unit) {
      toast({
        title: "Validation Error",
        description: "Unit is required",
        variant: "destructive",
      });
      setActiveTab('basic');
      return false;
    }

    if (formData.currentStock < 0) {
      toast({
        title: "Validation Error",
        description: "Current stock cannot be negative",
        variant: "destructive",
      });
      setActiveTab('basic');
      return false;
    }

    if (formData.minimumStock < 0) {
      toast({
        title: "Validation Error",
        description: "Minimum stock cannot be negative",
        variant: "destructive",
      });
      setActiveTab('basic');
      return false;
    }

    if (formData.maximumStock > 0 && formData.maximumStock < formData.minimumStock) {
      toast({
        title: "Validation Error",
        description: "Maximum stock must be greater than or equal to minimum stock",
        variant: "destructive",
      });
      setActiveTab('basic');
      return false;
    }

    if (formData.costPrice < 0) {
      toast({
        title: "Validation Error",
        description: "Cost price cannot be negative",
        variant: "destructive",
      });
      setActiveTab('details');
      return false;
    }

    // Validate at least one branch selected
    if (selectedBranches.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one branch must be selected",
        variant: "destructive",
      });
      setActiveTab('assignment');
      return false;
    }

    // Validate at least one category selected
    if (selectedCategories.length === 0) {
      toast({
        title: "Validation Error",
        description: "Category is required",
        variant: "destructive",
      });
      setActiveTab('assignment');
      return false;
    }

    // Validate ObjectId format (24 hex characters)
    const isValidObjectId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

    const invalidBranches = selectedBranches.filter(id => !isValidObjectId(id));
    if (invalidBranches.length > 0) {
      toast({
        title: "Validation Error",
        description: "Invalid branch IDs detected. Please reselect branches.",
        variant: "destructive",
      });
      setActiveTab('assignment');
      return false;
    }

    const invalidCategories = selectedCategories.filter(id => !isValidObjectId(id));
    if (invalidCategories.length > 0) {
      toast({
        title: "Validation Error",
        description: "Invalid category ID detected. Please reselect category.",
        variant: "destructive",
      });
      setActiveTab('assignment');
      return false;
    }

    const invalidSubcategories = selectedSubcategories.filter(id => !isValidObjectId(id));
    if (invalidSubcategories.length > 0) {
      toast({
        title: "Validation Error",
        description: "Invalid subcategory ID detected. Please reselect subcategory.",
        variant: "destructive",
      });
      setActiveTab('assignment');
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
        unit: formData.unit,
        minimumStock: formData.minimumStock,
        maximumStock: formData.maximumStock || undefined,
        reorderPoint: formData.reorderPoint || undefined,
        costPrice: formData.costPrice || undefined,
        supplier: formData.supplier || undefined,
        expiryDate: formData.expiryDate || undefined,
        batchNumber: formData.batchNumber.trim() || undefined,
        sku: formData.sku.trim() || undefined,
        barcode: formData.barcode.trim() || undefined,
        branchIds: selectedBranches,
        // Backend expects single category and subcategory (take first from array)
        category: selectedCategories[0],
        subcategory: selectedSubcategories.length > 0 ? selectedSubcategories[0] : undefined,
      };

      // Only include currentStock for new items
      if (!item) {
        submitData.initialStock = formData.currentStock;
      }

      let response;
      if (item) {
        response = await inventoryServices.updateInventoryItem(item._id, submitData);
      } else {
        response = await inventoryServices.createInventoryItem(branchId, submitData);
      }

      // Check for auto-assignment information in response
      const autoAssignments = response.data?.data?.autoAssignments;
      
      if (autoAssignments && (autoAssignments.categories?.length > 0 || autoAssignments.subcategories?.length > 0)) {
        // Build notification message for auto-assignments
        const assignmentMessages: string[] = [];
        
        if (autoAssignments.categories?.length > 0) {
          autoAssignments.categories.forEach((cat: any) => {
            const branchList = cat.branchNames?.join(', ') || 'selected branches';
            assignmentMessages.push(`Category "${cat.categoryName}" was automatically assigned to: ${branchList}`);
          });
        }
        
        if (autoAssignments.subcategories?.length > 0) {
          autoAssignments.subcategories.forEach((subcat: any) => {
            const branchList = subcat.branchNames?.join(', ') || 'selected branches';
            assignmentMessages.push(`Subcategory "${subcat.subcategoryName}" was automatically assigned to: ${branchList}`);
          });
        }
        
        toast({
          title: "Success",
          description: (
            <div className="space-y-1">
              <p>{item ? 'Inventory item updated successfully' : 'Inventory item created successfully'}</p>
              {assignmentMessages.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <p className="font-semibold text-xs mb-1">Auto-assignments:</p>
                  {assignmentMessages.map((msg, idx) => (
                    <p key={idx} className="text-xs">{msg}</p>
                  ))}
                </div>
              )}
            </div>
          ),
          variant: "success",
        });
      } else {
        toast({
          title: "Success",
          description: item ? 'Inventory item updated successfully' : 'Inventory item created successfully',
          variant: "success",
        });
      }
      
      onSuccess();
    } catch (error: any) {
      // Handle validation errors with dependency information
      const errorData = error.response?.data;
      
      if (errorData?.error?.code === 'CATEGORY_BRANCH_MISMATCH' && errorData?.error?.details?.dependencies) {
        const details = errorData.error.details;
        const dependencies = details.dependencies;
        
        const dependencyMessages: string[] = [];
        
        if (dependencies.items?.count > 0) {
          const examples = dependencies.items.examples?.slice(0, 5).map((item: any) => item.name).join(', ') || '';
          dependencyMessages.push(`${dependencies.items.count} item(s)${examples ? `: ${examples}` : ''}`);
        }
        
        if (dependencies.suppliers?.count > 0) {
          const examples = dependencies.suppliers.examples?.slice(0, 5).map((sup: any) => sup.name).join(', ') || '';
          dependencyMessages.push(`${dependencies.suppliers.count} supplier(s)${examples ? `: ${examples}` : ''}`);
        }
        
        toast({
          title: "Validation Error",
          description: (
            <div className="space-y-1">
              <p>{errorData.error.message}</p>
              {dependencyMessages.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <p className="font-semibold text-xs mb-1">Dependencies found:</p>
                  {dependencyMessages.map((msg, idx) => (
                    <p key={idx} className="text-xs">{msg}</p>
                  ))}
                </div>
              )}
            </div>
          ),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: errorData?.message || errorData?.error?.message || `Failed to ${item ? 'update' : 'create'} inventory item`,
          variant: "destructive",
        });
      }
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
          <form id="inventory-item-form" onSubmit={handleSubmit}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="assignment">Branch & Category</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>

              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-4 mt-4">
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
              </TabsContent>

              {/* Branch & Category Assignment Tab */}
              <TabsContent value="assignment" className="space-y-6 mt-4" forceMount={true}>
                <div className={cn("space-y-4", activeTab !== 'assignment' && "hidden")}>
                  <div>
                    <h3 className="font-semibold">Assign Branches *</h3>
                    <p className="text-sm text-muted-foreground">
                      Select which branches this inventory item belongs to
                    </p>
                  </div>

                  <BranchSearch
                    selectedBranchIds={selectedBranches}
                    onBranchesChange={handleBranchesChange}
                    placeholder="Select branches..."
                    showSelectAll={false}
                  />
                </div>

                <div className={cn("border-t pt-6 space-y-4", activeTab !== 'assignment' && "hidden")}>
                  <div>
                    <h3 className="font-semibold">Assign Categories & Subcategories *</h3>
                    <p className="text-sm text-muted-foreground">
                      Select category and subcategory for this item. Categories are filtered based on selected branches.
                    </p>
                  </div>

                  <CategorySubcategorySearch
                    selectedCategoryIds={selectedCategories}
                    selectedSubcategoryIds={selectedSubcategories}
                    onCategoriesChange={handleCategoriesChange}
                    branchIds={selectedBranches}
                    required={true}
                    isCategoryMulti={false}
                    isSubcategoryMulti={false}
                  />
                </div>
              </TabsContent>

              {/* Additional Details Tab */}
              <TabsContent value="details" className="space-y-4 mt-4">
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
                          <SelectItem value="null">None</SelectItem>
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
              </TabsContent>
            </Tabs>
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
