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
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supplierServices, branchServices } from '@/api/services';
import { Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchSearch, setBranchSearch] = useState('');
  const [branchSelectorOpen, setBranchSelectorOpen] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    // Basic Info
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    rating: 0,
    categories: '',
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

  // Fetch branches on mount and when search changes
  useEffect(() => {
    if (open) {
      fetchBranches();
    }
  }, [open, branchSearch]);

  const fetchBranches = async () => {
    try {
      setBranchesLoading(true);
      const response = await branchServices.getBranches({ 
        limit: 100, 
        isActive: true,
        search: branchSearch || undefined
      });
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
        title: "Error",
        description: "Failed to fetch branches",
        variant: "destructive",
      });
    } finally {
      setBranchesLoading(false);
    }
  };

  // Debounce branch search
  useEffect(() => {
    if (!open) return;

    const timeoutId = setTimeout(() => {
      if (branchSearch !== '') {
        fetchBranches();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [branchSearch, open]);

  useEffect(() => {
    if (supplier && open) {
      setFormData({
        // Basic Info
        name: supplier.name || '',
        contactPerson: supplier.contactPerson || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        rating: supplier.rating || 0,
        categories: supplier.categories?.join(', ') || '',
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
      categories: '',
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
    setBranchSearch('');
    setActiveTab('basic');
  };

  const handleBranchToggle = (branchId: string) => {
    setSelectedBranches(prev => {
      if (prev.includes(branchId)) {
        return prev.filter(id => id !== branchId);
      } else {
        return [...prev, branchId];
      }
    });
  };

  const handleSelectAllBranches = () => {
    if (selectedBranches.length === branches.length) {
      setSelectedBranches([]);
    } else {
      setSelectedBranches(branches.map(b => b._id));
    }
  };

  const getSelectedBranches = () =>
    branches.filter(b => selectedBranches.includes(b._id));

  const handleRemoveBranch = (branchId: string) => {
    setSelectedBranches(prev => prev.filter(id => id !== branchId));
  };


  const validateForm = () => {
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
      setActiveTab('basic');
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

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const submitData: any = {
        name: formData.name.trim(),
        branchIds: selectedBranches,
        contactPerson: formData.contactPerson.trim() || undefined,
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        rating: formData.rating || undefined,
        categories: formData.categories
          ? formData.categories.split(',').map(c => c.trim()).filter(c => c)
          : [],
        notes: formData.notes.trim() || undefined,
        address: {
          street: formData.street.trim() || undefined,
          city: formData.city.trim() || undefined,
          state: formData.state.trim() || undefined,
          zipCode: formData.zipCode.trim() || undefined,
          country: formData.country.trim() || undefined
        },
        gstNumber: formData.gstNumber.trim() || undefined,
        panNumber: formData.panNumber.trim() || undefined,
        paymentTerms: formData.paymentTerms,
        customPaymentTerms: formData.paymentTerms === 'custom'
          ? formData.customPaymentTerms.trim() || undefined
          : undefined,
        creditLimit: formData.creditLimit || 0,
        bankDetails: {
          accountName: formData.accountName.trim() || undefined,
          accountNumber: formData.accountNumber.trim() || undefined,
          bankName: formData.bankName.trim() || undefined,
          ifscCode: formData.ifscCode.trim() || undefined,
          branch: formData.bankBranch.trim() || undefined
        }
      };

      if (supplier) {
        await supplierServices.updateSupplier(supplier._id, submitData);
        toast({
          title: "Success",
          description: "Supplier updated successfully",
          variant: "success",
        });
      } else {
        await supplierServices.createSupplier(submitData);
        toast({
          title: "Success",
          description: "Supplier created successfully",
          variant: "success",
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || `Failed to ${supplier ? 'update' : 'create'} supplier`,
        variant: "destructive",
      });
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
              <TabsList className={`grid w-full ${supplier ? 'grid-cols-6' : 'grid-cols-5'}`}>
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="branches">Branches</TabsTrigger>
                <TabsTrigger value="address">Address</TabsTrigger>
                <TabsTrigger value="legal">Legal</TabsTrigger>
                <TabsTrigger value="bank">Bank Details</TabsTrigger>
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
                  <div>
                    <Label htmlFor="categories">Categories</Label>
                    <Input
                      id="categories"
                      value={formData.categories}
                      onChange={(e) => setFormData({ ...formData, categories: e.target.value })}
                      placeholder="e.g., Vegetables, Dairy, Meat (comma-separated)"
                    />
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

              {/* Branches Tab */}
              <TabsContent value="branches" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <h3 className="font-semibold">Assign Branches *</h3>
                  <p className="text-sm text-muted-foreground">
                    Select which branches this supplier can serve
                  </p>

                  <div className="space-y-3">
                    <Popover open={branchSelectorOpen} onOpenChange={setBranchSelectorOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={branchSelectorOpen}
                          className="w-full justify-between"
                        >
                          {selectedBranches.length > 0
                            ? `${selectedBranches.length} branch${selectedBranches.length > 1 ? "es" : ""} selected`
                            : "Select branches..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent className="w-full p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput 
                            placeholder="Search branches..." 
                            value={branchSearch}
                            onValueChange={setBranchSearch}
                          />
                          <CommandEmpty>
                            {branchesLoading 
                              ? 'Loading branches...' 
                              : branchSearch 
                                ? `No branches found matching "${branchSearch}"`
                                : 'No branches available'}
                          </CommandEmpty>
                          <CommandList>
                            <CommandGroup>
                              {branchesLoading ? (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                  Loading branches...
                                </div>
                              ) : (
                                branches.map((branch) => (
                                  <CommandItem
                                    key={branch._id}
                                    value={`${branch.name} ${branch.code}`}
                                    onSelect={() => handleBranchToggle(branch._id)}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedBranches.includes(branch._id)
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{branch.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {branch.code}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))
                              )}
                            </CommandGroup>
                            {branches.length >= 100 && !branchSearch && !branchesLoading && (
                              <div className="px-2 py-1.5 text-xs text-amber-600 border-t">
                                Showing first 100 branches. Use search to find more.
                              </div>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {/* Selected Branch Chips */}
                    {selectedBranches.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/50">
                        {getSelectedBranches().map((branch) => (
                          <Badge key={branch._id} variant="secondary" className="gap-1">
                            {branch.name} ({branch.code})
                            <X
                              className="h-3 w-3 cursor-pointer hover:text-destructive"
                              onClick={() => handleRemoveBranch(branch._id)}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Info message */}
                    <p className="text-sm text-muted-foreground">
                      {selectedBranches.length > 0 
                        ? `${selectedBranches.length} branch${selectedBranches.length !== 1 ? 'es' : ''} selected`
                        : 'Please select at least one branch'}
                    </p>
                  </div>
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

              {/* Bank Details Tab */}
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
