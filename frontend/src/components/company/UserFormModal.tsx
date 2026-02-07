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
import { useToast } from '@/hooks/use-toast';
import { userServices } from '@/api/services';
import { useAuth } from '@/contexts/AuthContext';
import BranchSearch from '@/components/common/BranchSearch';

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  user: any | null;
  onSuccess: () => void;
}

export default function UserFormModal({ open, onClose, user, onSuccess }: UserFormModalProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    branchIds: [] as string[]
  });

  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');
  const isMultiBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) > 1;
  const isSingleBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) === 1;

  // Determine allowed roles based on current user's role
  const getAllowedRoles = () => {
    const roleMap: Record<string, { value: string; label: string }[]> = {
      company_super_admin_primary: [
        { value: 'company_super_admin_secondary', label: 'Super Admin (Secondary)' },
        { value: 'company_admin', label: 'Admin' },
        { value: 'employee', label: 'Employee' }
      ],
      company_super_admin_secondary: [
        { value: 'company_admin', label: 'Admin' },
        { value: 'employee', label: 'Employee' }
      ],
      company_admin: [
        { value: 'employee', label: 'Employee' }
      ]
    };

    return roleMap[currentUser?.role || ''] || [];
  };

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        password: '',
        role: user.role || 'employee',
        branchIds: user.branchIds || []
      });
    } else {
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'employee',
        branchIds: []
      });
    }
  }, [user, open]);

  const handleBranchesChange = (branchIds: string[]) => {
    setFormData(prev => ({
      ...prev,
      branchIds
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.role) {
      toast({
        title: "Validation Error",
        description: "Name, email, and role are required",
        variant: "destructive",
      });
      return;
    }

    if (!user && !formData.password) {
      toast({
        title: "Validation Error",
        description: "Password is required for new users",
        variant: "destructive",
      });
      return;
    }

    // Validate branch selection for company_admin and employee
    if ((formData.role === 'company_admin' || formData.role === 'employee') && formData.branchIds.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one branch must be selected for this role",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const submitData: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        branchIds: formData.branchIds
      };

      // Only include password if it's provided
      if (formData.password) {
        submitData.password = formData.password;
      }

      if (user) {
        await userServices.updateUser(user._id, submitData);
        toast({
          title: "Success",
          description: "User updated successfully",
          variant: "success",
        });
      } else {
        await userServices.createUser(submitData);
        toast({
          title: "Success",
          description: "User created successfully",
          variant: "success",
        });
      }
      
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || `Failed to ${user ? 'update' : 'create'} user`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const allowedRoles = getAllowedRoles();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Create New User'}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="user-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  required
                />
              </div>
            </div>
            {/* Only show password field for primary admin or when creating new user */}
            {(currentUser?.role === 'company_super_admin_primary' || !user) && (
              <div>
                <Label htmlFor="password">
                  Password {user ? '(leave blank to keep current)' : '*'}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  required={!user}
                />
                {user && currentUser?.role === 'company_super_admin_primary' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Only primary admin can update passwords
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Role */}
          <div className="space-y-4">
            <h3 className="font-semibold">Role & Access</h3>
            <div>
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {allowedRoles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                You can only assign roles that are at or below your permission level
              </p>
            </div>
          </div>

          {/* Branch Access */}
          {(formData.role === 'company_admin' || formData.role === 'employee') && (
            <div className="space-y-4">
              <h3 className="font-semibold">Branch Access *</h3>
              <p className="text-sm text-muted-foreground">
                Select which branches this user can access (required)
              </p>
              <BranchSearch
                selectedBranchIds={formData.branchIds}
                onBranchesChange={handleBranchesChange}
                placeholder="Select branches..."
                showSelectAll={isSuperAdmin}
              />
            </div>
          )}
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" disabled={loading}>
            {loading ? 'Saving...' : user ? 'Update User' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
