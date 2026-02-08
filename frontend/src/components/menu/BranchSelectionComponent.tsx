import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface BranchSelectionComponentProps {
  branches: Branch[];
  selectedBranches: string[];
  onChange: (branchIds: string[]) => void;
  userBranchIds: string[] | null; // null for super admin
  disabled?: boolean;
  className?: string;
}

export default function BranchSelectionComponent({
  branches,
  selectedBranches,
  onChange,
  userBranchIds,
  disabled = false,
  className = '',
}: BranchSelectionComponentProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter branches based on user access
  const accessibleBranches = useMemo(() => {
    // Super admin (userBranchIds is null) can see all branches
    if (userBranchIds === null) {
      return branches;
    }
    
    // Filter to only show branches the user has access to
    return branches.filter((branch) => userBranchIds.includes(branch._id));
  }, [branches, userBranchIds]);

  // Filter branches based on search query
  const filteredBranches = useMemo(() => {
    if (!searchQuery.trim()) {
      return accessibleBranches;
    }

    const query = searchQuery.toLowerCase();
    return accessibleBranches.filter(
      (branch) =>
        branch.name.toLowerCase().includes(query) ||
        branch.code.toLowerCase().includes(query)
    );
  }, [accessibleBranches, searchQuery]);

  // Handle branch toggle
  const handleBranchToggle = (branchId: string) => {
    if (disabled) return;

    const newSelection = selectedBranches.includes(branchId)
      ? selectedBranches.filter((id) => id !== branchId)
      : [...selectedBranches, branchId];
    
    onChange(newSelection);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (disabled) return;

    // Select all filtered branches (or all accessible if no search)
    const branchIdsToSelect = filteredBranches.map((b) => b._id);
    onChange(branchIdsToSelect);
  };

  // Handle clear all
  const handleClearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  // Remove a specific branch
  const handleRemoveBranch = (branchId: string) => {
    if (disabled) return;
    onChange(selectedBranches.filter((id) => id !== branchId));
  };

  // Get selected branch objects for display
  const selectedBranchObjects = useMemo(() => {
    return branches.filter((branch) => selectedBranches.includes(branch._id));
  }, [branches, selectedBranches]);

  // Check if all filtered branches are selected
  const allFilteredSelected = useMemo(() => {
    if (filteredBranches.length === 0) return false;
    return filteredBranches.every((branch) => selectedBranches.includes(branch._id));
  }, [filteredBranches, selectedBranches]);

  return (
    <div className={cn('space-y-3', className)}>
      <Label>Select Branches *</Label>

      {/* Search and action buttons */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by branch name or code..."
            className="pl-9"
            disabled={disabled}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
          disabled={disabled || filteredBranches.length === 0 || allFilteredSelected}
        >
          Select All
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClearAll}
          disabled={disabled || selectedBranches.length === 0}
        >
          Clear All
        </Button>
      </div>

      {/* Branch list with checkboxes */}
      <div className="border rounded-md">
        <ScrollArea className="h-[200px]">
          <div className="p-3 space-y-2">
            {filteredBranches.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {searchQuery
                  ? `No branches found matching "${searchQuery}"`
                  : accessibleBranches.length === 0
                  ? 'No branches available'
                  : 'No branches to display'}
              </div>
            ) : (
              filteredBranches.map((branch) => (
                <div
                  key={branch._id}
                  className={cn(
                    'flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Checkbox
                    id={`branch-${branch._id}`}
                    checked={selectedBranches.includes(branch._id)}
                    onCheckedChange={() => handleBranchToggle(branch._id)}
                    disabled={disabled}
                  />
                  <Label
                    htmlFor={`branch-${branch._id}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{branch.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {branch.code}
                      </span>
                    </div>
                  </Label>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Selected count and badges */}
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          {selectedBranches.length > 0 ? (
            <span>
              {selectedBranches.length} branch{selectedBranches.length !== 1 ? 'es' : ''} selected
            </span>
          ) : (
            <span>No branches selected</span>
          )}
        </div>

        {/* Selected branches display */}
        {selectedBranchObjects.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/50">
            {selectedBranchObjects.map((branch) => (
              <Badge key={branch._id} variant="secondary" className="gap-1">
                {branch.name} ({branch.code})
                {!disabled && (
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => handleRemoveBranch(branch._id)}
                  />
                )}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Info message */}
      {userBranchIds !== null && accessibleBranches.length < branches.length && (
        <p className="text-xs text-muted-foreground">
          Showing {accessibleBranches.length} of {branches.length} branches based on your access
        </p>
      )}
    </div>
  );
}
