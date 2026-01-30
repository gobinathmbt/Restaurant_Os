import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Power, MapPin, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { branchServices } from '@/api/services';
import BranchFormModal from '@/components/company/BranchFormModal';
import DeleteConfirmDialog from '@/components/company/DeleteConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useLoading } from '@/contexts/LoadingContext';
import DataTableLayout from '@/components/common/DataTableLayout';

interface Branch {
  _id: string;
  name: string;
  code: string;
  address: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  contact: {
    phone?: string;
    email?: string;
  };
  gstNumber?: string;
  fssaiLicense?: string;
  isActive: boolean;
  createdAt: string;
}

export default function Branches() {
  const { user } = useAuth();
  const { setLoading, setLoadingMessage } = useLoading();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLocalLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; branch: Branch | null }>({
    open: false,
    branch: null
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const canManageBranches = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');

  useEffect(() => {
    fetchBranches();
  }, [currentPage, rowsPerPage, searchTerm]);

  const fetchBranches = async () => {
    try {
      setLocalLoading(true);
      const response = await branchServices.getBranches({
        page: currentPage,
        limit: rowsPerPage,
        search: searchTerm || undefined
      });

      setBranches(response.data.data.branches);
      setTotalCount(response.data.data.pagination.total);
      setTotalPages(response.data.data.pagination.totalPages);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch branches');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleCreateBranch = () => {
    setSelectedBranch(null);
    setIsFormOpen(true);
  };

  const handleEditBranch = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsFormOpen(true);
  };

  const handleDeleteBranch = (branch: Branch) => {
    setDeleteDialog({ open: true, branch });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.branch) return;

    try {
      setLoading(true);
      setLoadingMessage('Deleting branch...');
      await branchServices.deleteBranch(deleteDialog.branch._id);
      toast.success('Branch deleted successfully');
      fetchBranches();
      setDeleteDialog({ open: false, branch: null });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete branch');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (branch: Branch) => {
    try {
      setLoading(true);
      setLoadingMessage(`${branch.isActive ? 'Deactivating' : 'Activating'} branch...`);
      await branchServices.toggleBranchStatus(branch._id);
      toast.success(`Branch ${branch.isActive ? 'deactivated' : 'activated'} successfully`);
      fetchBranches();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update branch status');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedBranch(null);
    fetchBranches();
  };

  const activeBranches = branches.filter((b) => b.isActive).length;
  const inactiveBranches = branches.filter((b) => !b.isActive).length;

  return (
    <>
      <DataTableLayout
        statChips={[
          { label: 'Total', value: totalCount, variant: 'default' },
          { label: 'Active', value: activeBranches, variant: 'default', bgColor: 'bg-green-100 text-green-800' },
          { label: 'Inactive', value: inactiveBranches, variant: 'secondary' },
        ]}
        actionButtons={
          canManageBranches
            ? [
                {
                  icon: <Plus className="h-4 w-4" />,
                  tooltip: 'Add new branch',
                  onClick: handleCreateBranch,
                  variant: 'default',
                },
              ]
            : []
        }
        searchValue={searchTerm}
        searchPlaceholder="Search branches..."
        onSearchChange={setSearchTerm}
        tableHeaders={
          <>
            <TableHead className="w-16">S.No</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Status</TableHead>
            {canManageBranches && <TableHead className="text-right">Actions</TableHead>}
          </>
        }
        tableBody={
          <>
            {branches.map((branch, index) => (
              <TableRow key={branch._id}>
                <TableCell className="font-medium text-muted-foreground">
                  {(currentPage - 1) * rowsPerPage + index + 1}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{branch.name}</p>
                    <p className="text-sm text-muted-foreground">Code: {branch.code}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="text-sm">
                      {branch.address?.street && <p>{branch.address.street}</p>}
                      <p>
                        {[branch.address?.city, branch.address?.state, branch.address?.pincode]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {branch.contact?.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {branch.contact.phone}
                      </div>
                    )}
                    {branch.contact?.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {branch.contact.email}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={branch.isActive ? 'default' : 'secondary'}>
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                {canManageBranches && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditBranch(branch)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(branch)}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBranch(branch)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </>
        }
        isLoading={loading}
        emptyState={
          branches.length === 0
            ? {
                icon: <MapPin className="h-12 w-12" />,
                title: 'No branches found',
                description: searchTerm
                  ? 'Try adjusting your search'
                  : 'Get started by creating your first branch',
                action:
                  canManageBranches && !searchTerm ? (
                    <Button onClick={handleCreateBranch}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Branch
                    </Button>
                  ) : undefined,
              }
            : undefined
        }
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={setRowsPerPage}
        onRefresh={fetchBranches}
        cookiePrefix="branches"
      />

      {/* Modals */}
      <BranchFormModal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedBranch(null);
        }}
        branch={selectedBranch}
        onSuccess={handleFormSuccess}
      />

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, branch: null })}
        onConfirm={confirmDelete}
        title="Delete Branch"
        description={`Are you sure you want to delete "${deleteDialog.branch?.name}"? This action cannot be undone.`}
      />
    </>
  );
}
