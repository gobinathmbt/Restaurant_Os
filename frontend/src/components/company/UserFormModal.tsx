import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { userServices, branchServices } from '@/api/services';
import { useAuth } from '@/contexts/AuthContext';

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  user: any | null;
  onSuccess: () => void;
}

interface Branch {
  _id: string;
  name: string;
  code: string;
}

export default function UserFormModal({ open, onClose, user, onSuccess }: UserFormModalProps) {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    branchIds: [] as string[]
  });

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
    if (open) {
      fetchBranches();
    }
  }, [open]);

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

  const fetchBranches = async () => {
    try {
      const response = await branchServices.getBranches({ limit: 100 });
      setBranches(response.data.data.branches);
    } catch (error: any) {
      toast.error('Failed to fetch branches');
    }
  };

  const handleBranchToggle = (branchId: string) => {
    setFormData(prev => ({
      ...prev,
      branchIds: prev.branchIds.includes(branchId)
        ? prev.branchIds.filter(id => id !== branchId)
        : [...prev.branchIds, branchId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.role) {
      toast.error('Name, email, and role are required');
      return;
    }

    if (!user && !formData.password) {
      toast.error('Password is required for new users');
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
        toast.success('User updated successfully');
      } else {
        await userServices.createUser(submitData);
        toast.success('User created successfully');
      }
      
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Failed to ${user ? 'update' : 'create'} user`);
    } finally {
      setLoading(false);
    }
  };

  const allowedRoles = getAllowedRoles();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Create New User'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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
            </div>
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
              <h3 className="font-semibold">Branch Access</h3>
              <p className="text-sm text-muted-foreground">
                Select which branches this user can access
              </p>
              {branches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No branches available</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-4">
                  {branches.map((branch) => (
                    <div key={branch._id} className="flex items-center space-x-2">
                      <Checkbox
                        id={branch._id}
                        checked={formData.branchIds.includes(branch._id)}
                        onCheckedChange={() => handleBranchToggle(branch._id)}
                      />
                      <label
                        htmlFor={branch._id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {branch.name} ({branch.code})
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : user ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
