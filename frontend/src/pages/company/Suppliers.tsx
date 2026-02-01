import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Package, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supplierServices, branchServices } from '@/api/services';
import SupplierFormModal from '@/components/inventory/SupplierFormModal';
import DeleteConfirmDialog from '@/components/company/DeleteConfirmDialog';
import { useLoading } from '@/contexts/LoadingContext';
import { useAuth } from '@/contexts/AuthContext';
import DataTableLayout from '@/components/common/DataTableLayout';
import { Star } from 'lucide-react';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface Supplier {
  _id: string;
  name: string;
  branchIds: Branch[];
  contactPerson?: string;
  phone: string;
  email?: string;
  rating?: number;
  categories: string[];
  isActive: boolean;
  performanceMetrics?: {
    totalOrders: number;
    totalPurchaseValue: number;
    onTimeDeliveries: number;
    lateDeliveries: number;
    qualityIssues: number;
  };
  onTimeDeliveryRate?: number;
  averageOrderValue?: number;
}

export default function Suppliers() {
  const { user } = useAuth();
  const { setLoading, setLoadingMessage } = useLoading();
  const { toast } = useToast();

  // State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; supplier: Supplier | null }>({
    open: false,
    supplier: null
  });

  // Determine user's branch access
  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');
  const isMultiBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) > 1;
  const isSingleBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) === 1;

  // Fetch branches on mount
  useEffect(() => {
    fetchBranches();
  }, []);

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
        title: "Error",
        description: "Failed to fetch branches",
        variant: "destructive",
      });
    }
  };

  // Fetch suppliers on mount and when filters change
  useEffect(() => {
    fetchSuppliers();
  }, [page, rowsPerPage, search, categoryFilter, branchFilter]);

  const fetchSuppliers = async () => {
    try {
      setSuppliersLoading(true);
      const response = await supplierServices.getSuppliers({
        page,
        limit: rowsPerPage,
        search: search || undefined,
        category: categoryFilter || undefined,
        branchId: branchFilter || undefined,
        isActive: true
      });

      const fetchedSuppliers = response.data.data.suppliers || [];
      setSuppliers(fetchedSuppliers);
      setTotalCount(response.data.data.pagination.total);
      setTotalPages(response.data.data.pagination.totalPages);

      // Extract unique categories
      const allCategories = new Set<string>();
      fetchedSuppliers.forEach((supplier: Supplier) => {
        supplier.categories?.forEach((cat: string) => allCategories.add(cat));
      });
      setCategories(Array.from(allCategories).sort());
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch suppliers',
        variant: "destructive",
      });
    } finally {
      setSuppliersLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedSupplier(null);
    setIsFormOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsFormOpen(true);
  };

  const handleDelete = (supplier: Supplier) => {
    setDeleteDialog({ open: true, supplier });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.supplier) return;

    try {
      setLoading(true);
      setLoadingMessage('Deleting supplier...');
      await supplierServices.deleteSupplier(deleteDialog.supplier._id);
      toast({
        title: "Success",
        description: "Supplier deleted successfully",
        variant: "success",
      });
      fetchSuppliers();
      setDeleteDialog({ open: false, supplier: null });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to delete supplier',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (supplier: Supplier) => {
    try {
      setLoading(true);
      setLoadingMessage(`${supplier.isActive ? 'Deactivating' : 'Activating'} supplier...`);
      await supplierServices.toggleSupplierStatus(supplier._id);
      toast({
        title: "Success",
        description: `Supplier ${supplier.isActive ? 'deactivated' : 'activated'} successfully`,
        variant: "success",
      });
      fetchSuppliers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to toggle supplier status',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedSupplier(null);
    fetchSuppliers();
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '-';
    return `₹${amount.toFixed(2)}`;
  };

  const formatPercentage = (value?: number) => {
    if (value === undefined || value === null) return '-';
    return `${value.toFixed(1)}%`;
  };

  const renderStarRating = (rating?: number) => {
    if (!rating) return <span className="text-muted-foreground">-</span>;
    
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
        <span className="ml-1 text-xs text-muted-foreground">{rating}/5</span>
      </div>
    );
  };

  return (
    <>
      <DataTableLayout
        statChips={[
          { label: 'Total Suppliers', value: totalCount, variant: 'default' },
        ]}
        actionButtons={[
          {
            icon: <Plus className="h-4 w-4" />,
            tooltip: 'Add supplier',
            onClick: handleCreate,
            variant: 'default',
          },
        ]}
        searchValue={search}
        searchPlaceholder="Search suppliers..."
        onSearchChange={setSearch}
        filterConfig={{
          component: (
            <div className="flex items-center gap-2">
              {(isSuperAdmin || isMultiBranchAdmin) && branches.length > 0 && (
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch._id} value={branch._id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48 h-9">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        }}
        tableHeaders={
          <>
            <TableHead className="w-16">S.No</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Branches</TableHead>
            <TableHead>Contact Person</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Categories</TableHead>
            <TableHead className="text-right">On-Time Delivery</TableHead>
            <TableHead className="text-right">Avg Order Value</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </>
        }
        tableBody={
          <>
            {suppliers.map((supplier, index) => (
              <TableRow key={supplier._id}>
                <TableCell className="font-medium text-muted-foreground">
                  {(page - 1) * rowsPerPage + index + 1}
                </TableCell>
                <TableCell>
                  <p className="font-medium">{supplier.name}</p>
                </TableCell>
                <TableCell>
                  {supplier.branchIds && supplier.branchIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {supplier.branchIds.slice(0, 2).map((branch, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {branch.name}
                        </Badge>
                      ))}
                      {supplier.branchIds.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{supplier.branchIds.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {supplier.contactPerson || <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell>{supplier.phone}</TableCell>
                <TableCell>
                  {supplier.email || <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell>
                  {renderStarRating(supplier.rating)}
                </TableCell>
                <TableCell>
                  {supplier.categories && supplier.categories.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {supplier.categories.slice(0, 2).map((category, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {category}
                        </Badge>
                      ))}
                      {supplier.categories.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{supplier.categories.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatPercentage(supplier.onTimeDeliveryRate)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(supplier.averageOrderValue)}
                </TableCell>
                <TableCell>
                  <Badge variant={supplier.isActive ? 'default' : 'secondary'}>
                    {supplier.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(supplier)}
                      title="Edit supplier"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleStatus(supplier)}
                      title={supplier.isActive ? 'Deactivate supplier' : 'Activate supplier'}
                    >
                      <Power className={`h-4 w-4 ${supplier.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(supplier)}
                      title="Delete supplier"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </>
        }
        isLoading={suppliersLoading}
        emptyState={
          suppliers.length === 0
            ? {
                icon: <Package className="h-12 w-12" />,
                title: 'No suppliers found',
                description: search || categoryFilter || branchFilter
                  ? 'Try adjusting your filters'
                  : 'Get started by adding your first supplier',
                action: !search && !categoryFilter && !branchFilter ? (
                  <Button onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Supplier
                  </Button>
                ) : undefined,
              }
            : undefined
        }
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        rowsPerPage={rowsPerPage}
        onPageChange={setPage}
        onRowsPerPageChange={setRowsPerPage}
        onRefresh={fetchSuppliers}
        cookiePrefix="suppliers"
      />

      {/* Supplier Form Modal */}
      <SupplierFormModal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedSupplier(null);
        }}
        supplier={selectedSupplier}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, supplier: null })}
        onConfirm={confirmDelete}
        title="Delete Supplier"
        description={`Are you sure you want to delete the supplier "${deleteDialog.supplier?.name}"? This action cannot be undone.`}
      />
    </>
  );
}
