import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Power, MapPin, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { branchServices } from '@/api/services';
import BranchFormModal from '@/components/company/BranchFormModal';
import DeleteConfirmDialog from '@/components/company/DeleteConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useLoading } from '@/contexts/LoadingContext';

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
  createdBy?: {
    name: string;
    email: string;
  };
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
  const [pagination, setPagination] = useState({
    currentPage: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  const canManageBranches = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');

  useEffect(() => {
    fetchBranches();
  }, [pagination.currentPage, searchTerm]);

  const fetchBranches = async () => {
    try {
      setLocalLoading(true);
      const response = await branchServices.getBranches({
        page: pagination.currentPage,
        limit: pagination.limit,
        search: searchTerm || undefined
      });

      setBranches(response.data.data.branches);
      setPagination(response.data.data.pagination);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Branches</h1>
          <p className="text-muted-foreground mt-1">
            Manage your restaurant branches
          </p>
        </div>
        {canManageBranches && (
          <Button onClick={handleCreateBranch}>
            <Plus className="h-4 w-4 mr-2" />
            Add Branch
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search branches..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Branches Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : branches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No branches found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm ? 'Try adjusting your search' : 'Get started by creating your first branch'}
            </p>
            {canManageBranches && !searchTerm && (
              <Button onClick={handleCreateBranch}>
                <Plus className="h-4 w-4 mr-2" />
                Add Branch
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <Card key={branch._id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl">{branch.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Code: {branch.code}
                    </p>
                  </div>
                  <Badge variant={branch.isActive ? 'default' : 'secondary'}>
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Address */}
                {branch.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="text-sm">
                      {branch.address.street && <p>{branch.address.street}</p>}
                      <p>
                        {[branch.address.city, branch.address.state, branch.address.pincode]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Contact */}
                <div className="space-y-2">
                  {branch.contact?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{branch.contact.phone}</span>
                    </div>
                  )}
                  {branch.contact?.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{branch.contact.email}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {canManageBranches && (
                  <div className="flex items-center gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditBranch(branch)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(branch)}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteBranch(branch)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.currentPage === 1}
            onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.currentPage === pagination.totalPages}
            onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
          >
            Next
          </Button>
        </div>
      )}

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
    </div>
  );
}
