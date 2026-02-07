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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supplierServices } from '@/api/services';
import { Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import BranchSearch from '@/components/common/BranchSearch';
import CategorySubcategorySearch from '@/components/common/CategorySubcategorySearch';
import { cn } from '@/lib/utils';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface SupplierFormModalProps {
  open: boolean;
  onClose: () => void;
  supplier: any | null;
  onSuccess: () => void;
}

export default function SupplierFormModal({
  open,
  onClose,
  supplier,
  onSuccess
}: SupplierFormModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    // Basic Info
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    rating: 0,
    notes: '',
    // Address
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    // Legal
    gstNumber: '',
    panNumber: '',
    paymentTerms: 'net_30',
    customPaymentTerms: '',
    creditLimit: 0,
    // Bank Details
    accountName: '',
    accountNumber: '',
    bankName: '',
    ifscCode: '',
    bankBranch: ''
  });

  // Determine user's branch access
  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');
  const isMultiBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) > 1;
  const isSingleBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) === 1;

  useEffect(() => {
    if (supplier && open) {
      setFormData({
        // Basic Info
        name: supplier.name || '',
        contactPerson: supplier.contactPerson || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        rating: supplier.rating || 0,
        notes: supplier.notes || '',
        // Address
        street: supplier.address?.street || '',
        city: supplier.address?.city || '',
        state: supplier.address?.state || '',
        zipCode: supplier.address?.zipCode || '',
        country: supplier.address?.country || '',
        // Legal
        gstNumber: supplier.gstNumber || '',
        panNumber: supplier.panNumber || '',
        paymentTerms: supplier.paymentTerms || 'net_30',
        customPaymentTerms: supplier.customPaymentTerms || '',
        creditLimit: supplier.creditLimit || 0,
        // Bank Details
        accountName: supplier.bankDetails?.accountName || '',
        accountNumber: supplier.bankDetails?.accountNumber || '',
        bankName: supplier.bankDetails?.bankName || '',
        ifscCode: supplier.bankDetails?.ifscCode || '',
        bankBranch: supplier.bankDetails?.branch || ''
      });

      // Set selected branches
      if (supplier.branchIds) {
        const branchIdStrings = supplier.branchIds.map((b: any) =>
          typeof b === 'string' ? b : b._id
        );
        setSelectedBranches(branchIdStrings);
      } else {
        setSelectedBranches([]);
      }

      // Set selected categories
      if (supplier.categoryIds) {
        const categoryIdStrings = supplier.categoryIds.map((c: any) =>
          typeof c === 'string' ? c : c._id
        );
        setSelectedCategories(categoryIdStrings);
      } else {
        setSelectedCategories([]);
      }

      // Set selected subcategories
      if (supplier.subcategoryIds) {
        const subcategoryIdStrings = supplier.subcategoryIds.map((c: any) =>
          typeof c === 'string' ? c : c._id
        );
        setSelectedSubcategories(subcategoryIdStrings);
      } else {
        setSelectedSubcategories([]);
      }
    } else if (!supplier && open) {
      resetForm();
    }
  }, [supplier, open]);

  const resetForm = () => {
    setFormData({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      rating: 0,
      notes: '',
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
      gstNumber: '',
      panNumber: '',
      paymentTerms: 'net_30',
      customPaymentTerms: '',
      creditLimit: 0,
      accountName: '',
      accountNumber: '',
      bankName: '',
      ifscCode: '',
      bankBranch: ''
    });
    setSelectedBranches([]);
    setSelectedCategories([]);
    setSelectedSubcategories([]);
    setActiveTab('basic');
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


  const validateForm = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Supplier name is required",
        variant: "destructive",
      });
      setActiveTab('basic');
      return false;
    }

    if (!formData.phone.trim()) {
      toast({
        title: "Validation Error",
        description: "Phone number is required",
        variant: "destructive",
      });
      setActiveTab('basic');
      return false;
    }

    if (selectedBranches.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one branch must be selected",
        variant: "destructive",
      });
      setActiveTab('assignment');
      return false;
    }

    if (selectedCategories.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one main category must be selected",
        variant: "destructive",
      });
      setActiveTab('assignment');
      return false;
    }

    if (selectedSubcategories.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one subcategory must be selected",
        variant: "destructive",
      });
      setActiveTab('assignment');
      return false;
    }

    // Validate that all IDs are valid MongoDB ObjectIds (24 hex characters)
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
        description: "Invalid category IDs detected. Please reselect categories.",
        variant: "destructive",
      });
      setActiveTab('assignment');
      return false;
    }

    const invalidSubcategories = selectedSubcategories.filter(id => !isValidObjectId(id));
    if (invalidSubcategories.length > 0) {
      toast({
        title: "Validation Error",
        description: "Invalid subcategory IDs detected. Please reselect subcategories.",
        variant: "destructive",
      });
      setActiveTab('assignment');
      return false;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      setActiveTab('basic');
      return false;
    }

    if (formData.rating < 0 || formData.rating > 5) {
      toast({
        title: "Validation Error",
        description: "Rating must be between 0 and 5",
        variant: "destructive",
      });
      setActiveTab('basic');
      return false;
    }

    if (formData.creditLimit < 0) {
      toast({
        title: "Validation Error",
        description: "Credit limit cannot be negative",
        variant: "destructive",
      });
      setActiveTab('legal');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = await validateForm();
    if (!isValid) {
      return;
    }

    try {
      setLoading(true);

      // Build address object only if at least one field has a value
      const address: any = {};
      if (formData.street.trim()) address.street = formData.street.trim();
      if (formData.city.trim()) address.city = formData.city.trim();
      if (formData.state.trim()) address.state = formData.state.trim();
      if (formData.zipCode.trim()) address.zipCode = formData.zipCode.trim();
      if (formData.country.trim()) address.country = formData.country.trim();

      // Build bank details object only if at least one field has a value
      const bankDetails: any = {};
      if (formData.accountName.trim()) bankDetails.accountName = formData.accountName.trim();
      if (formData.accountNumber.trim()) bankDetails.accountNumber = formData.accountNumber.trim();
      if (formData.bankName.trim()) bankDetails.bankName = formData.bankName.trim();
      if (formData.ifscCode.trim()) bankDetails.ifscCode = formData.ifscCode.trim();
      if (formData.bankBranch.trim()) bankDetails.branch = formData.bankBranch.trim();

      const submitData: any = {
        name: formData.name.trim(),
        branchIds: selectedBranches,
        categoryIds: selectedCategories,
        subcategoryIds: selectedSubcategories,
        phone: formData.phone.trim(),
        paymentTerms: formData.paymentTerms,
        creditLimit: formData.creditLimit || 0,
      };

      // Add optional fields only if they have values
      if (formData.contactPerson.trim()) {
        submitData.contactPerson = formData.contactPerson.trim();
      }
      if (formData.email.trim()) {
        submitData.email = formData.email.trim();
      }
      if (formData.rating > 0) {
        submitData.rating = formData.rating;
      }
      if (formData.notes.trim()) {
        submitData.notes = formData.notes.trim();
      }
      if (formData.gstNumber.trim()) {
        submitData.gstNumber = formData.gstNumber.trim();
      }
      if (formData.panNumber.trim()) {
        submitData.panNumber = formData.panNumber.trim();
      }
      if (formData.paymentTerms === 'custom' && formData.customPaymentTerms.trim()) {
        submitData.customPaymentTerms = formData.customPaymentTerms.trim();
      }

      // Add address and bankDetails only if they have at least one field
      if (Object.keys(address).length > 0) {
        submitData.address = address;
      }
      if (Object.keys(bankDetails).length > 0) {
        submitData.bankDetails = bankDetails;
      }

      console.log('Submitting supplier data:', JSON.stringify(submitData, null, 2));

      let response;
      if (supplier) {
        response = await supplierServices.updateSupplier(supplier._id, submitData);
      } else {
        response = await supplierServices.createSupplier(submitData);
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
              <p>{supplier ? 'Supplier updated successfully' : 'Supplier created successfully'}</p>
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
          description: supplier ? 'Supplier updated successfully' : 'Supplier created successfully',
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
          description: errorData?.message || errorData?.error?.message || `Failed to ${supplier ? 'update' : 'create'} supplier`,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStarRating = () => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setFormData({ ...formData, rating: star })}
            className="focus:outline-none"
          >
            <Star
              className={`h-5 w-5 ${star <= formData.rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
                }`}
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">
          {formData.rating > 0 ? `${formData.rating}/5` : 'No rating'}
        </span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="supplier-form" onSubmit={handleSubmit}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className={`grid w-full ${supplier ? 'grid-cols-5' : 'grid-cols-4'}`}>
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="assignment">Branch & Categories</TabsTrigger>
                <TabsTrigger value="address">Address</TabsTrigger>
                <TabsTrigger value="legal">Legal</TabsTrigger>
                {supplier && <TabsTrigger value="performance">Performance</TabsTrigger>}
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., ABC Suppliers"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPerson">Contact Person</Label>
                    <Input
                      id="contactPerson"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      placeholder="e.g., John Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g., +91 9876543210"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g., contact@supplier.com"
                    />
                  </div>
                  <div>
                    <Label>Rating</Label>
                    {renderStarRating()}
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes about the supplier..."
                    rows={3}
                  />
                </div>
              </TabsContent>

              {/* Branch & Categories Tab - Combined */}
              <TabsContent value="assignment" className="space-y-6 mt-4" forceMount={true}>
                <div className={cn("space-y-4", activeTab !== 'assignment' && "hidden")}>
                  <div>
                    <h3 className="font-semibold">Assign Branches *</h3>
                    <p className="text-sm text-muted-foreground">
                      Select which branches this supplier can serve
                    </p>
                  </div>

                  <BranchSearch
                    selectedBranchIds={selectedBranches}
                    onBranchesChange={handleBranchesChange}
                    placeholder="Select branches..."
                    showSelectAll={isSuperAdmin}
                  />
                </div>

                <div className={cn("border-t pt-6 space-y-4", activeTab !== 'assignment' && "hidden")}>
                  <div>
                    <h3 className="font-semibold">Assign Categories & Subcategories *</h3>
                    <p className="text-sm text-muted-foreground">
                      Select which categories and subcategories this supplier provides. Categories are filtered based on selected branches.
                    </p>
                  </div>

                  <CategorySubcategorySearch
                    selectedCategoryIds={selectedCategories}
                    selectedSubcategoryIds={selectedSubcategories}
                    onCategoriesChange={handleCategoriesChange}
                    branchIds={selectedBranches}
                    required={true}
                  />
                </div>
              </TabsContent>


              {/* Address Tab */}
              <TabsContent value="address" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="street">Street</Label>
                    <Input
                      id="street"
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      placeholder="e.g., 123 Main Street"
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g., Mumbai"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="e.g., Maharashtra"
                    />
                  </div>
                  <div>
                    <Label htmlFor="zipCode">Zip Code</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                      placeholder="e.g., 400001"
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder="e.g., India"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Legal Tab */}
              <TabsContent value="legal" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gstNumber">GST Number</Label>
                    <Input
                      id="gstNumber"
                      value={formData.gstNumber}
                      onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                      placeholder="e.g., 22AAAAA0000A1Z5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="panNumber">PAN Number</Label>
                    <Input
                      id="panNumber"
                      value={formData.panNumber}
                      onChange={(e) => setFormData({ ...formData, panNumber: e.target.value })}
                      placeholder="e.g., AAAAA0000A"
                    />
                  </div>
                  <div>
                    <Label htmlFor="paymentTerms">Payment Terms</Label>
                    <Select
                      value={formData.paymentTerms}
                      onValueChange={(value) => setFormData({ ...formData, paymentTerms: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment terms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="net_7">Net 7 Days</SelectItem>
                        <SelectItem value="net_15">Net 15 Days</SelectItem>
                        <SelectItem value="net_30">Net 30 Days</SelectItem>
                        <SelectItem value="net_60">Net 60 Days</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.paymentTerms === 'custom' && (
                    <div>
                      <Label htmlFor="customPaymentTerms">Custom Payment Terms</Label>
                      <Input
                        id="customPaymentTerms"
                        value={formData.customPaymentTerms}
                        onChange={(e) => setFormData({ ...formData, customPaymentTerms: e.target.value })}
                        placeholder="e.g., 50% advance, 50% on delivery"
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="creditLimit">Credit Limit (₹)</Label>
                    <Input
                      id="creditLimit"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Bank Details Tab - Removed from tabs list but keeping content */}
              <TabsContent value="bank" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="accountName">Account Name</Label>
                    <Input
                      id="accountName"
                      value={formData.accountName}
                      onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                      placeholder="e.g., ABC Suppliers Pvt Ltd"
                    />
                  </div>
                  <div>
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input
                      id="accountNumber"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      placeholder="e.g., 1234567890"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input
                      id="bankName"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      placeholder="e.g., State Bank of India"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ifscCode">IFSC Code</Label>
                    <Input
                      id="ifscCode"
                      value={formData.ifscCode}
                      onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
                      placeholder="e.g., SBIN0001234"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="bankBranch">Branch</Label>
                    <Input
                      id="bankBranch"
                      value={formData.bankBranch}
                      onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })}
                      placeholder="e.g., Mumbai Main Branch"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Performance Tab - Only for existing suppliers */}
              {supplier && (
                <TabsContent value="performance" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-semibold mb-3">Performance Metrics</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground">Total Orders</Label>
                          <p className="text-lg font-semibold">
                            {supplier.performanceMetrics?.totalOrders || 0}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Total Purchase Value</Label>
                          <p className="text-lg font-semibold">
                            ₹{(supplier.performanceMetrics?.totalPurchaseValue || 0).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">On-Time Deliveries</Label>
                          <p className="text-lg font-semibold">
                            {supplier.performanceMetrics?.onTimeDeliveries || 0}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Late Deliveries</Label>
                          <p className="text-lg font-semibold">
                            {supplier.performanceMetrics?.lateDeliveries || 0}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Quality Issues</Label>
                          <p className="text-lg font-semibold">
                            {supplier.performanceMetrics?.qualityIssues || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
                      <h4 className="font-semibold mb-3">Calculated Metrics</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground">On-Time Delivery Rate</Label>
                          <p className="text-lg font-semibold text-primary">
                            {supplier.onTimeDeliveryRate?.toFixed(2) || 0}%
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Average Order Value</Label>
                          <p className="text-lg font-semibold text-primary">
                            ₹{(supplier.averageOrderValue || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Performance metrics are automatically updated based on GRN records and cannot be edited manually.
                    </p>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="supplier-form" disabled={loading}>
            {loading ? 'Saving...' : supplier ? 'Update Supplier' : 'Create Supplier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}