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
import { categoryServices } from '@/api/services';
import { useToast } from '@/hooks/use-toast';

interface Category {
  _id: string;
  name: string;
  color: string;
  type: string;
  branchIds?: Array<{
    _id: string;
    name: string;
  } | string>;
  parent?: {
    _id: string;
    name: string;
  };
}

interface CategorySearchProps {
  selectedCategoryIds: string[];
  onCategoriesChange: (categoryIds: string[]) => void;
  branchIds: string[]; // Required: categories filtered by branch permissions
  disabled?: boolean;
  placeholder?: string;
  showSelectAll?: boolean;
  className?: string;
  required?: boolean;
}

export default function CategorySearch({
  selectedCategoryIds,
  onCategoriesChange,
  branchIds,
  disabled = false,
  placeholder = 'Select categories...',
  showSelectAll = false,
  className = '',
  required = false,
}: CategorySearchProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Two separate states: one for initial load, one for search results
  const [initialCategories, setInitialCategories] = useState<Category[]>([]);
  const [searchCategories, setSearchCategories] = useState<Category[]>([]);
  
  // Determine which categories to display
  const displayCategories = searchQuery ? searchCategories : initialCategories;

  // Fetch initial categories on mount (limit 50)
  useEffect(() => {
    if (open && initialCategories.length === 0 && branchIds.length > 0) {
      fetchInitialCategories();
    }
  }, [open, branchIds]);

  // Fetch categories when search query changes (direct API call, no debounce)
  useEffect(() => {
    if (searchQuery && branchIds.length > 0) {
      fetchSearchCategories(searchQuery);
    }
  }, [searchQuery, branchIds]);

  const fetchInitialCategories = async () => {
    try {
      setLoading(true);
      const response = await categoryServices.getCategories({
        limit: 50,
        isActive: 'true',
        branchId: branchIds.length === 1 ? branchIds[0] : undefined,
      });
      
      let categories = response.data.data.categories || [];
      
      // If multiple branches, filter categories that belong to at least one of the branches
      if (branchIds.length > 1) {
        categories = categories.filter((cat: Category) => 
          cat.branchIds && cat.branchIds.some((b: any) => 
            branchIds.includes(typeof b === 'string' ? b : b._id)
          )
        );
      }
      
      setInitialCategories(categories);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch categories',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSearchCategories = async (search: string) => {
    try {
      setLoading(true);
      const response = await categoryServices.getCategories({
        limit: 200,
        isActive: 'true',
        search,
        branchId: branchIds.length === 1 ? branchIds[0] : undefined,
      });
      
      let categories = response.data.data.categories || [];
      
      // If multiple branches, filter categories that belong to at least one of the branches
      if (branchIds.length > 1) {
        categories = categories.filter((cat: Category) => 
          cat.branchIds && cat.branchIds.some((b: any) => 
            branchIds.includes(typeof b === 'string' ? b : b._id)
          )
        );
      }
      
      setSearchCategories(categories);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to search categories',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryToggle = (categoryId: string) => {
    const newSelection = selectedCategoryIds.includes(categoryId)
      ? selectedCategoryIds.filter((id) => id !== categoryId)
      : [...selectedCategoryIds, categoryId];
    onCategoriesChange(newSelection);
  };

  const handleRemoveCategory = (categoryId: string) => {
    onCategoriesChange(selectedCategoryIds.filter((id) => id !== categoryId));
  };

  const handleSelectAll = () => {
    if (selectedCategoryIds.length === displayCategories.length) {
      onCategoriesChange([]);
    } else {
      onCategoriesChange(displayCategories.map((c) => c._id));
    }
  };

  // Get selected categories from both initial and search results
  const getSelectedCategories = (): Category[] => {
    const allCategories = [...initialCategories];
    
    // Add search categories that aren't already in initial categories
    searchCategories.forEach((searchCategory) => {
      if (!allCategories.find((c) => c._id === searchCategory._id)) {
        allCategories.push(searchCategory);
      }
    });

    return allCategories.filter((category) => selectedCategoryIds.includes(category._id));
  };

  const selectedCategories = getSelectedCategories();

  // Show warning if no branches selected
  if (branchIds.length === 0) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="p-3 border rounded-md bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-800">
            Please select at least one branch first to load categories
          </p>
        </div>
      </div>
    );
  }

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
              {selectedCategoryIds.length > 0
                ? `${selectedCategoryIds.length} categor${selectedCategoryIds.length > 1 ? 'ies' : 'y'} selected`
                : placeholder}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-full p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search categories..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandEmpty>
                {loading
                  ? 'Searching...'
                  : searchQuery
                    ? `No categories found matching "${searchQuery}"`
                    : 'No categories available'}
              </CommandEmpty>
              <CommandList>
                <CommandGroup>
                  {showSelectAll && displayCategories.length > 0 && (
                    <CommandItem onSelect={handleSelectAll} className="font-medium">
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedCategoryIds.length === displayCategories.length
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      Select All ({displayCategories.length})
                    </CommandItem>
                  )}
                  {loading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Loading categories...
                    </div>
                  ) : (
                    displayCategories.map((category) => (
                      <CommandItem
                        key={category._id}
                        value={`${category.name}`}
                        onSelect={() => handleCategoryToggle(category._id)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedCategoryIds.includes(category._id) ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: category.color }}
                          />
                          <div className="flex flex-col flex-1">
                            <span className="font-medium">{category.name}</span>
                            <div className="flex items-center gap-2">
                              {category.parent && (
                                <span className="text-xs text-muted-foreground">
                                  Subcategory of: {category.parent.name}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {category.type === 'both' ? 'Both' : 
                                 category.type === 'raw_material' ? 'Raw Material' : 'Finished Good'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
                {displayCategories.length >= (searchQuery ? 200 : 50) && !loading && (
                  <div className="px-2 py-1.5 text-xs text-amber-600 border-t">
                    {searchQuery
                      ? 'Showing first 200 results. Refine your search for more specific results.'
                      : 'Showing first 50 categories. Use search to find more.'}
                  </div>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected Categories Display */}
      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/50">
          {selectedCategories.map((category) => (
            <Badge key={category._id} variant="secondary" className="gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {category.name}
              {category.parent && (
                <span className="text-xs opacity-70">({category.parent.name})</span>
              )}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => !disabled && handleRemoveCategory(category._id)}
              />
            </Badge>
          ))}
        </div>
      )}

      {/* Info message */}
      <p className="text-sm text-muted-foreground">
        {selectedCategoryIds.length > 0
          ? `${selectedCategoryIds.length} categor${selectedCategoryIds.length !== 1 ? 'ies' : 'y'} selected`
          : required 
            ? 'Please select at least one category (required)'
            : 'Select categories for this supplier'}
      </p>
    </div>
  );
}
