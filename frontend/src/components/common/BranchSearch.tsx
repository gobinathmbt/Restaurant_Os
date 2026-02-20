import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { branchServices } from '@/api/services';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface BranchSearchProps {
  selectedBranchIds: string[];
  onBranchesChange: (branchIds: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  showSelectAll?: boolean;
  className?: string;
  singleSelect?: boolean;
  autoSelectSingleBranch?: boolean;
}

export default function BranchSearch({
  selectedBranchIds,
  onBranchesChange,
  disabled = false,
  placeholder = 'Select branches...',
  showSelectAll = false,
  className = '',
  singleSelect = false,
  autoSelectSingleBranch = false,
}: BranchSearchProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Two separate states: one for initial load, one for search results
  const [initialBranches, setInitialBranches] = useState<Branch[]>([]);
  const [searchBranches, setSearchBranches] = useState<Branch[]>([]);
  
  // Determine which branches to display
  const displayBranches = searchQuery ? searchBranches : initialBranches;

  // Check if user is single-branch admin
  const isSingleBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) === 1;

  // Fetch initial branches on mount (limit 50)
  useEffect(() => {
    if (open && initialBranches.length === 0) {
      fetchInitialBranches();
    }
  }, [open]);

  // Auto-select single branch for single-branch admins (runs on mount and when user changes)
  useEffect(() => {
    if (autoSelectSingleBranch && isSingleBranchAdmin && user?.branchIds && user.branchIds.length === 1) {
      const userBranchId = user.branchIds[0];
      // Only update if not already selected
      if (selectedBranchIds.length === 0 || selectedBranchIds[0] !== userBranchId) {
        onBranchesChange([userBranchId]);
        // Fetch initial branches to populate the display name
        if (initialBranches.length === 0) {
          fetchInitialBranches();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectSingleBranch, user?.branchIds]);

  // Fetch branches when search query changes (direct API call, no debounce)
  useEffect(() => {
    if (searchQuery) {
      fetchSearchBranches(searchQuery);
    }
  }, [searchQuery]);

  const fetchInitialBranches = async () => {
    try {
      setLoading(true);
      const response = await branchServices.getBranches({
        limit: 50,
        isActive: true,
      });
      let branches = response.data.data.branches || [];
      
      // Filter branches based on user role
      const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');
      if (!isSuperAdmin && user?.branchIds) {
        branches = branches.filter((branch: Branch) => user.branchIds?.includes(branch._id));
      }
      
      setInitialBranches(branches);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch branches',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSearchBranches = async (search: string) => {
    try {
      setLoading(true);
      const response = await branchServices.getBranches({
        limit: 50,
        isActive: true,
        search,
      });
      let branches = response.data.data.branches || [];
      
      // Filter branches based on user role
      const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');
      if (!isSuperAdmin && user?.branchIds) {
        branches = branches.filter((branch: Branch) => user.branchIds?.includes(branch._id));
      }
      
      setSearchBranches(branches);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to search branches',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBranchToggle = (branchId: string) => {
    if (singleSelect) {
      // Single select mode: replace selection and close popover
      onBranchesChange([branchId]);
      setOpen(false);
    } else {
      // Multi-select mode: toggle selection
      const newSelection = selectedBranchIds.includes(branchId)
        ? selectedBranchIds.filter((id) => id !== branchId)
        : [...selectedBranchIds, branchId];
      onBranchesChange(newSelection);
    }
  };

  const handleRemoveBranch = (branchId: string) => {
    onBranchesChange(selectedBranchIds.filter((id) => id !== branchId));
  };

  const handleSelectAll = () => {
    if (selectedBranchIds.length === displayBranches.length) {
      onBranchesChange([]);
    } else {
      onBranchesChange(displayBranches.map((b) => b._id));
    }
  };

  // Get selected branches from both initial and search results
  const getSelectedBranches = (): Branch[] => {
    const allBranches = [...initialBranches];
    
    // Add search branches that aren't already in initial branches
    searchBranches.forEach((searchBranch) => {
      if (!allBranches.find((b) => b._id === searchBranch._id)) {
        allBranches.push(searchBranch);
      }
    });

    return allBranches.filter((branch) => selectedBranchIds.includes(branch._id));
  };

  const selectedBranches = getSelectedBranches();

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
              disabled={disabled || (autoSelectSingleBranch && isSingleBranchAdmin)}
            >
              {selectedBranchIds.length > 0
                ? singleSelect
                  ? selectedBranches[0]?.name || placeholder
                  : `${selectedBranchIds.length} branch${selectedBranchIds.length > 1 ? 'es' : ''} selected`
                : placeholder}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-full p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search branches..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandEmpty>
                {loading
                  ? 'Searching...'
                  : searchQuery
                    ? `No branches found matching "${searchQuery}"`
                    : 'No branches available'}
              </CommandEmpty>
              <CommandList>
                <CommandGroup>
                  {showSelectAll && !singleSelect && displayBranches.length > 0 && (
                    <CommandItem onSelect={handleSelectAll} className="font-medium">
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedBranchIds.length === displayBranches.length
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      Select All ({displayBranches.length})
                    </CommandItem>
                  )}
                  {loading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Loading branches...
                    </div>
                  ) : (
                    displayBranches.map((branch) => (
                      <CommandItem
                        key={branch._id}
                        value={`${branch.name} ${branch.code}`}
                        onSelect={() => handleBranchToggle(branch._id)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedBranchIds.includes(branch._id) ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{branch.name}</span>
                          <span className="text-xs text-muted-foreground">{branch.code}</span>
                        </div>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
                {displayBranches.length >= 50 && !loading && (
                  <div className="px-2 py-1.5 text-xs text-amber-600 border-t">
                    {searchQuery
                      ? 'Showing first 50 results. Refine your search for more specific results.'
                      : 'Showing first 50 branches. Use search to find more.'}
                  </div>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected Branches Display */}
      {!singleSelect && selectedBranches.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/50">
          {selectedBranches.map((branch) => (
            <Badge key={branch._id} variant="secondary" className="gap-1">
              {branch.name} ({branch.code})
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => !disabled && handleRemoveBranch(branch._id)}
              />
            </Badge>
          ))}
        </div>
      )}

      {/* Info message */}
      {!singleSelect && (
        <p className="text-sm text-muted-foreground">
          {selectedBranchIds.length > 0
            ? `${selectedBranchIds.length} branch${selectedBranchIds.length !== 1 ? 'es' : ''} selected`
            : 'Please select at least one branch'}
        </p>
      )}
      
      {/* Single-branch admin info */}
      {autoSelectSingleBranch && isSingleBranchAdmin && (
        <p className="text-xs text-muted-foreground">
          Branch is automatically selected based on your access
        </p>
      )}
    </div>
  );
}
