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
import { inventoryItemBranchServices } from '@/api/services';
import { useToast } from '@/hooks/use-toast';

interface BranchConfig {
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  lastPurchasePrice?: number;
  lastPurchaseDate?: string;
  supplier?: {
    _id: string;
    name: string;
  };
}

interface InventoryItem {
  _id: string;
  name: string;
  unit: string;
  category?: string | { _id: string; name: string };
  subcategory?: string | { _id: string; name: string };
  branchConfig?: BranchConfig;
}

interface InventoryItemDropdownProps {
  branchId: string;
  value: string;
  onChange: (itemId: string, item: InventoryItem) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onItemsLoaded?: (items: InventoryItem[]) => void;
}

export default function InventoryItemDropdown({
  branchId,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select inventory item...',
  className = '',
  onItemsLoaded,
}: InventoryItemDropdownProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Fetch initial items when dropdown opens
  useEffect(() => {
    if (open && branchId && !searchQuery) {
      fetchItems('');
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
      fetchItems(searchQuery);
    }, 300);

    setSearchTimeout(timeout);

    // Cleanup
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [searchQuery, branchId]);

  const fetchItems = async (search: string) => {
    try {
      setLoading(true);
      const params: any = {
        limit: 100,
        isActive: true,
      };

      if (search) {
        params.search = search;
      }

      const response = await inventoryItemBranchServices.getInventoryItemsForBranch(
        branchId,
        params
      );
      const fetchedItems = response.data.data.items || [];

      setItems(fetchedItems);

      // Call onItemsLoaded callback to pass full item data to parent
      if (onItemsLoaded) {
        onItemsLoaded(fetchedItems);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch inventory items',
        variant: 'destructive',
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = useCallback(
    (itemId: string) => {
      const selectedItem = items.find((item) => item._id === itemId);
      if (selectedItem) {
        onChange(itemId, selectedItem);
        setOpen(false);
      }
    },
    [items, onChange]
  );

  const selectedItem = items.find((item) => item._id === value);

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
            {selectedItem ? `${selectedItem.name} (${selectedItem.unit})` : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-full p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search inventory items..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandEmpty>
              {loading
                ? 'Searching...'
                : searchQuery
                  ? `No items found matching "${searchQuery}"`
                  : 'No inventory items available for this branch'}
            </CommandEmpty>
            <CommandList>
              <CommandGroup>
                {loading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Loading inventory items...
                  </div>
                ) : (
                  items.map((item) => (
                    <CommandItem
                      key={item._id}
                      value={item._id}
                      onSelect={() => handleSelect(item._id)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === item._id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {item.name} ({item.unit})
                        </span>
                        {(item.category || item.subcategory) && (
                          <span className="text-xs text-muted-foreground">
                            {[
                              typeof item.category === 'object' && item.category?.name ? item.category.name : item.category,
                              typeof item.subcategory === 'object' && item.subcategory?.name ? item.subcategory.name : item.subcategory
                            ].filter(Boolean).join(' • ')}
                          </span>
                        )}
                        {item.branchConfig && (
                          <span className="text-xs text-muted-foreground">
                            Stock: {item.branchConfig.currentStock} {item.unit}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
              {items.length >= 100 && !loading && (
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
