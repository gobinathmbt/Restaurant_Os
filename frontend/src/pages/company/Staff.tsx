import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Power, Mail, Shield } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { userServices } from '@/api/services';
import UserFormModal from '@/components/company/UserFormModal';
import DeleteConfirmDialog from '@/components/company/DeleteConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useLoading } from '@/contexts/LoadingContext';
import DataTableLayout from '@/components/common/DataTableLayout';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  branchIds: string[];
  isActive: boolean;
  profilePicture?: string;
  createdAt: string;
  lastLogin?: string;
}

const roleLabels: Record<string, string> = {
  company_super_admin_primary: 'Super Admin (Primary)',
  company_super_admin_secondary: 'Super Admin (Secondary)',
  company_admin: 'Admin',
  employee: 'Employee'
};

const roleColors: Record<string, string> = {
  company_super_admin_primary: 'bg-purple-500',
  company_super_admin_secondary: 'bg-blue-500',
  company_admin: 'bg-green-500',
  employee: 'bg-gray-500'
};

export default function Staff() {
  const { user: currentUser } = useAuth();
  const { setLoading, setLoadingMessage } = useLoading();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLocalLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const canManageUsers = ['company_super_admin_primary', 'company_super_admin_secondary', 'company_admin'].includes(currentUser?.role || '');

  useEffect(() => {
    fetchUsers();
  }, [currentPage, rowsPerPage, searchTerm, roleFilter]);

  const fetchUsers = async () => {
    try {
      setLocalLoading(true);
      const response = await userServices.getUsers({
        page: currentPage,
        limit: rowsPerPage,
        search: searchTerm || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined
      });

      setUsers(response.data.data.users);
      setTotalCount(response.data.data.pagination.total);
      setTotalPages(response.data.data.pagination.totalPages);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch users');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setIsFormOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setDeleteDialog({ open: true, user });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.user) return;

    try {
      setLoading(true);
      setLoadingMessage('Deleting user...');
      await userServices.deleteUser(deleteDialog.user._id);
      toast.success('User deleted successfully');
      fetchUsers();
      setDeleteDialog({ open: false, user: null });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      setLoading(true);
      setLoadingMessage(`${user.isActive ? 'Deactivating' : 'Activating'} user...`);
      await userServices.toggleUserStatus(user._id);
      toast.success(`User ${user.isActive ? 'deactivated' : 'activated'} successfully`);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update user status');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedUser(null);
    fetchUsers();
  };

  const activeUsers = users.filter((u) => u.isActive).length;
  const inactiveUsers = users.filter((u) => !u.isActive).length;

  return (
    <>
      <DataTableLayout
        statChips={[
          { label: 'Total', value: totalCount, variant: 'default' },
          { label: 'Active', value: activeUsers, variant: 'default', bgColor: 'bg-green-100 text-green-800' },
          { label: 'Inactive', value: inactiveUsers, variant: 'secondary' },
        ]}
        actionButtons={
          canManageUsers
            ? [
                {
                  icon: <Plus className="h-4 w-4" />,
                  tooltip: 'Add new user',
                  onClick: handleCreateUser,
                  variant: 'default',
                },
              ]
            : []
        }
        searchValue={searchTerm}
        searchPlaceholder="Search users..."
        onSearchChange={setSearchTerm}
        filterConfig={{
          component: (
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="company_super_admin_primary">Super Admin (Primary)</SelectItem>
                <SelectItem value="company_super_admin_secondary">Super Admin (Secondary)</SelectItem>
                <SelectItem value="company_admin">Admin</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
          ),
        }}
        tableHeaders={
          <>
            <TableHead className="w-16">S.No</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Login</TableHead>
            {canManageUsers && <TableHead className="text-right">Actions</TableHead>}
          </>
        }
        tableBody={
          <>
            {users.map((user, index) => (
              <TableRow key={user._id}>
                <TableCell className="font-medium text-muted-foreground">
                  {(currentPage - 1) * rowsPerPage + index + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={user.profilePicture} />
                      <AvatarFallback className={roleColors[user.role]}>
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {roleLabels[user.role]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? 'default' : 'secondary'}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.lastLogin
                    ? new Date(user.lastLogin).toLocaleDateString()
                    : 'Never'}
                </TableCell>
                {canManageUsers && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {user._id !== currentUser?._id && user.role !== 'company_super_admin_primary' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(user)}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </>
        }
        isLoading={loading}
        emptyState={
          users.length === 0
            ? {
                icon: <Shield className="h-12 w-12" />,
                title: 'No users found',
                description:
                  searchTerm || roleFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Get started by adding your first user',
                action:
                  canManageUsers && !searchTerm && roleFilter === 'all' ? (
                    <Button onClick={handleCreateUser}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
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
        onRefresh={fetchUsers}
        cookiePrefix="staff"
      />

      {/* Modals */}
      <UserFormModal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onSuccess={handleFormSuccess}
      />

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, user: null })}
        onConfirm={confirmDelete}
        title="Delete User"
        description={`Are you sure you want to delete "${deleteDialog.user?.name}"? This action cannot be undone.`}
      />
    </>
  );
}
