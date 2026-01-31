import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { branchServices } from '@/api/services';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Building2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Branch {
  _id: string;
  branchName: string;
  branchCode: string;
  isActive: boolean;
}

interface BranchSelectorProps {
  selectedBranchId: string | null;
  onBranchChange: (branchId: string) => void;
  label?: string;
  className?: string;
}

export default function BranchSelector({
  selectedBranchId,
  onBranchChange,
  label = 'Select Branch',
  className = '',
}: BranchSelectorProps) {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBranches();
  }, [user]);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const response = await branchServices.getBranches({ isActive: true });

      if (response.data.success) {
        const allBranches = response.data.data.branches || [];
        
        // Filter branches based on user role
        let availableBranches: Branch[] = [];

        if (
          user?.role === 'company_super_admin_primary' ||
          user?.role === 'company_super_admin_secondary'
        ) {
          // Super admins can see all branches
          availableBranches = allBranches;
        } else if (user?.role === 'company_admin' && user?.branchIds) {
          // Company admins can only see their assigned branches
          availableBranches = allBranches.filter((branch) =>
            user.branchIds?.includes(branch._id)
          );
        }

        setBranches(availableBranches);

        // Auto-select branch for single-branch admins
        if (availableBranches.length === 1 && !selectedBranchId) {
          onBranchChange(availableBranches[0]._id);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch branches:', error);
      toast({
        title: 'Error',
        description: 'Failed to load branches. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBranchChange = (branchId: string) => {
    onBranchChange(branchId);
  };

  // If single branch admin, show read-only display
  if (branches.length === 1) {
    return (
      <div className={className}>
        <Label className="mb-2 flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          {label}
        </Label>
        <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm">
          {branches[0].branchName}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Label className="mb-2 flex items-center gap-2">
        <Building2 className="h-4 w-4" />
        {label}
      </Label>
      <Select
        value={selectedBranchId || ''}
        onValueChange={handleBranchChange}
        disabled={loading || branches.length === 0}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={loading ? 'Loading branches...' : 'Select a branch'} />
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch._id} value={branch._id}>
              {branch.branchName} ({branch.branchCode})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
