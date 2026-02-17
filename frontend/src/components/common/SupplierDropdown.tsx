import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inventoryServices } from '@/api/services';
import { useToast } from '@/hooks/use-toast';

interface Supplier {
  _id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
}

interface SupplierDropdownProps {
  branchId: string;
  value: string;
  onChange: (supplierId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function SupplierDropdown({
  branchId,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select supplier...',
  className = '',
}: SupplierDropdownProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Fetch initial suppliers when dropdown opens
  useEffect(() => {
    if (open && branchId && !searchQuery) {
      fetchSuppliers('');
    }
  }, [open, branchId]);

  // Debounced search effect
  useEffect(() => {
    if (!branchId) return;

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for debounced search (300ms)
    const timeout = setTimeout(() => {
      fetchSuppliers(searchQuery);
    }, 300);

    setSearchTimeout(timeout);

    // Cleanup
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [searchQuery, branchId]);

  const fetchSuppliers = async (search: string) => {
    try {
      setLoading(true);
      const response = await inventoryServices.getSuppliersForBranch(branchId);
      let fetchedSuppliers = response.data.data.suppliers || [];

      // Apply client-side search filtering if search query exists
      if (search) {
        const lowerSearch = search.toLowerCase();
        fetchedSuppliers = fetchedSuppliers.filter((supplier: Supplier) =>
          supplier.name.toLowerCase().includes(lowerSearch) ||
          supplier.contactPerson?.toLowerCase().includes(lowerSearch) ||
          supplier.phone?.includes(search) ||
          supplier.email?.toLowerCase().includes(lowerSearch)
        );
      }

      // Limit to 100 results
      setSuppliers(fetchedSuppliers.slice(0, 100));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch suppliers',
        variant: 'destructive',
      });
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = useCallback((supplierId: string) => {
    onChange(supplierId);
    setOpen(false);
  }, [onChange]);

  const selectedSupplier = suppliers.find((s) => s._id === value);

  return (
    <div className={cn('w-full', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || !branchId}
          >
            {selectedSupplier ? selectedSupplier.name : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-full p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search suppliers..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandEmpty>
              {loading
                ? 'Searching...'
                : searchQuery
                  ? `No suppliers found matching "${searchQuery}"`
                  : 'No suppliers available for this branch'}
            </CommandEmpty>
            <CommandList>
              <CommandGroup>
                {loading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Loading suppliers...
                  </div>
                ) : (
                  suppliers.map((supplier) => (
                    <CommandItem
                      key={supplier._id}
                      value={supplier._id}
                      onSelect={() => handleSelect(supplier._id)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === supplier._id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{supplier.name}</span>
                        {supplier.contactPerson && (
                          <span className="text-xs text-muted-foreground">
                            {supplier.contactPerson}
                            {supplier.phone && ` • ${supplier.phone}`}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
              {suppliers.length >= 100 && !loading && (
                <div className="px-2 py-1.5 text-xs text-amber-600 dark:text-amber-400 border-t">
                  Showing first 100 results. Refine your search for more specific results.
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
