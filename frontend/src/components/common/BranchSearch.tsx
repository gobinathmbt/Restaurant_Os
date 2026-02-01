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
}

export default function BranchSearch({
  selectedBranchIds,
  onBranchesChange,
  disabled = false,
  placeholder = 'Select branches...',
  showSelectAll = false,
  className = '',
}: BranchSearchProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Two separate states: one for initial load, one for search results
  const [initialBranches, setInitialBranches] = useState<Branch[]>([]);
  const [searchBranches, setSearchBranches] = useState<Branch[]>([]);
  
  // Determine which branches to display
  const displayBranches = searchQuery ? searchBranches : initialBranches;

  // Fetch initial branches on mount (limit 50)
  useEffect(() => {
    if (open && initialBranches.length === 0) {
      fetchInitialBranches();
    }
  }, [open]);

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
      setInitialBranches(response.data.data.branches || []);
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
      setSearchBranches(response.data.data.branches || []);
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
    const newSelection = selectedBranchIds.includes(branchId)
      ? selectedBranchIds.filter((id) => id !== branchId)
      : [...selectedBranchIds, branchId];
    onBranchesChange(newSelection);
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
              disabled={disabled}
            >
              {selectedBranchIds.length > 0
                ? `${selectedBranchIds.length} branch${selectedBranchIds.length > 1 ? 'es' : ''} selected`
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
                  {showSelectAll && displayBranches.length > 0 && (
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
      {selectedBranches.length > 0 && (
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
      <p className="text-sm text-muted-foreground">
        {selectedBranchIds.length > 0
          ? `${selectedBranchIds.length} branch${selectedBranchIds.length !== 1 ? 'es' : ''} selected`
          : 'Please select at least one branch'}
      </p>
    </div>
  );
}
