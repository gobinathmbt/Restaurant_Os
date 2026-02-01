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
import { Label } from '@/components/ui/label';

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
  } | string;
}

interface CategorySubcategorySearchProps {
  selectedCategoryIds: string[];
  selectedSubcategoryIds: string[];
  onCategoriesChange: (categoryIds: string[], subcategoryIds: string[]) => void;
  branchIds: string[];
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

export default function CategorySubcategorySearch({
  selectedCategoryIds,
  selectedSubcategoryIds,
  onCategoriesChange,
  branchIds,
  disabled = false,
  className = '',
  required = false,
}: CategorySubcategorySearchProps) {
  const { toast } = useToast();
  
  // Main Categories
  const [mainCategoriesOpen, setMainCategoriesOpen] = useState(false);
  const [mainCategoriesLoading, setMainCategoriesLoading] = useState(false);
  const [mainCategoriesSearch, setMainCategoriesSearch] = useState('');
  const [initialMainCategories, setInitialMainCategories] = useState<Category[]>([]);
  const [searchMainCategories, setSearchMainCategories] = useState<Category[]>([]);
  
  // Subcategories
  const [subcategoriesOpen, setSubcategoriesOpen] = useState(false);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);
  const [subcategoriesSearch, setSubcategoriesSearch] = useState('');
  const [initialSubcategories, setInitialSubcategories] = useState<Category[]>([]);
  const [searchSubcategories, setSearchSubcategories] = useState<Category[]>([]);

  const displayMainCategories = mainCategoriesSearch ? searchMainCategories : initialMainCategories;
  const displaySubcategories = subcategoriesSearch ? searchSubcategories : initialSubcategories;

  // When branches change, filter out categories that don't belong to the new branch selection
  useEffect(() => {
    if (branchIds.length > 0) {
      // Filter selected main categories - remove those not belonging to current branches
      const validMainCategories = selectedCategoryIds.filter(catId => {
        const category = [...initialMainCategories, ...searchMainCategories].find(c => c._id === catId);
        if (!category) return true; // Keep if we don't have the data yet (will be validated on submit)
        
        const categoryBranchIds = category.branchIds?.map((b: any) => 
          typeof b === 'string' ? b : b._id
        ) || [];
        
        return branchIds.some(branchId => categoryBranchIds.includes(branchId));
      });

      // Filter selected subcategories - remove those not belonging to current branches
      const validSubcategories = selectedSubcategoryIds.filter(subcatId => {
        const subcategory = [...initialSubcategories, ...searchSubcategories].find(c => c._id === subcatId);
        if (!subcategory) return true; // Keep if we don't have the data yet
        
        const subcategoryBranchIds = subcategory.branchIds?.map((b: any) => 
          typeof b === 'string' ? b : b._id
        ) || [];
        
        return branchIds.some(branchId => subcategoryBranchIds.includes(branchId));
      });

      // Update selections if any were filtered out
      if (validMainCategories.length !== selectedCategoryIds.length || 
          validSubcategories.length !== selectedSubcategoryIds.length) {
        
        const removedCategories = selectedCategoryIds.length - validMainCategories.length;
        const removedSubcategories = selectedSubcategoryIds.length - validSubcategories.length;
        
        if (removedCategories > 0 || removedSubcategories > 0) {
          toast({
            title: 'Categories Updated',
            description: `Removed ${removedCategories} categor${removedCategories !== 1 ? 'ies' : 'y'} and ${removedSubcategories} subcategor${removedSubcategories !== 1 ? 'ies' : 'y'} that don't belong to selected branches`,
            variant: 'default',
          });
        }
        
        onCategoriesChange(validMainCategories, validSubcategories);
      }

      // Reset cached data to refetch for new branches
      setInitialMainCategories([]);
      setSearchMainCategories([]);
      setInitialSubcategories([]);
      setSearchSubcategories([]);
      setMainCategoriesSearch('');
      setSubcategoriesSearch('');
    }
  }, [branchIds.join(',')]);

  // Load initial categories when branches are available
  useEffect(() => {
    if (branchIds.length > 0 && initialMainCategories.length === 0) {
      fetchInitialMainCategories();
    }
  }, [branchIds]);

  // Load initial subcategories when selected main categories exist
  useEffect(() => {
    if (branchIds.length > 0 && selectedCategoryIds.length > 0 && initialSubcategories.length === 0) {
      fetchInitialSubcategories();
    }
  }, [branchIds, selectedCategoryIds]);

  // Also fetch when popover opens (for lazy loading)
  useEffect(() => {
    if (mainCategoriesOpen && initialMainCategories.length === 0 && branchIds.length > 0) {
      fetchInitialMainCategories();
    }
  }, [mainCategoriesOpen, branchIds]);

  useEffect(() => {
    if (subcategoriesOpen && initialSubcategories.length === 0 && branchIds.length > 0 && selectedCategoryIds.length > 0) {
      fetchInitialSubcategories();
    }
  }, [subcategoriesOpen, branchIds, selectedCategoryIds]);

  useEffect(() => {
    if (mainCategoriesSearch && branchIds.length > 0) {
      fetchSearchMainCategories(mainCategoriesSearch);
    }
  }, [mainCategoriesSearch, branchIds]);

  useEffect(() => {
    if (subcategoriesSearch && branchIds.length > 0 && selectedCategoryIds.length > 0) {
      fetchSearchSubcategories(subcategoriesSearch);
    }
  }, [subcategoriesSearch, branchIds, selectedCategoryIds]);

  const fetchInitialMainCategories = async () => {
    try {
      setMainCategoriesLoading(true);
      const response = await categoryServices.getCategories({
        limit: 50,
        isActive: 'true',
        parentId: 'null',
        branchId: branchIds.length === 1 ? branchIds[0] : undefined,
      });
      
      let categories = response.data.data.categories || [];
      
      if (branchIds.length > 1) {
        categories = categories.filter((cat: Category) => 
          cat.branchIds && cat.branchIds.some((b: any) => 
            branchIds.includes(typeof b === 'string' ? b : b._id)
          )
        );
      }
      
      setInitialMainCategories(categories);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch main categories',
        variant: 'destructive',
      });
    } finally {
      setMainCategoriesLoading(false);
    }
  };

  const fetchInitialSubcategories = async () => {
    try {
      setSubcategoriesLoading(true);
      
      // Fetch subcategories for selected main categories
      const subcatPromises = selectedCategoryIds.map(catId =>
        categoryServices.getSubcategories(catId)
      );
      
      const responses = await Promise.all(subcatPromises);
      let allSubcategories: Category[] = [];
      
      responses.forEach(response => {
        const subcats = response.data.data.categories || [];
        allSubcategories = [...allSubcategories, ...subcats];
      });
      
      // Remove duplicates
      const uniqueSubcats = allSubcategories.filter((cat, index, self) =>
        index === self.findIndex((c) => c._id === cat._id)
      );
      
      // Filter by branches
      let filteredSubcats = uniqueSubcats.filter((cat: Category) => cat.parent);
      
      if (branchIds.length > 1) {
        filteredSubcats = filteredSubcats.filter((cat: Category) => 
          cat.branchIds && cat.branchIds.some((b: any) => 
            branchIds.includes(typeof b === 'string' ? b : b._id)
          )
        );
      }
      
      setInitialSubcategories(filteredSubcats.slice(0, 1000));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch subcategories',
        variant: 'destructive',
      });
    } finally {
      setSubcategoriesLoading(false);
    }
  };

  const fetchSearchMainCategories = async (search: string) => {
    try {
      setMainCategoriesLoading(true);
      const response = await categoryServices.getCategories({
        limit: 50,
        isActive: 'true',
        search,
        parentId: 'null',
        branchId: branchIds.length === 1 ? branchIds[0] : undefined,
      });
      
      let categories = response.data.data.categories || [];
      
      if (branchIds.length > 1) {
        categories = categories.filter((cat: Category) => 
          cat.branchIds && cat.branchIds.some((b: any) => 
            branchIds.includes(typeof b === 'string' ? b : b._id)
          )
        );
      }
      
      setSearchMainCategories(categories);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to search main categories',
        variant: 'destructive',
      });
    } finally {
      setMainCategoriesLoading(false);
    }
  };

  const fetchSearchSubcategories = async (search: string) => {
    try {
      setSubcategoriesLoading(true);
      
      const subcatPromises = selectedCategoryIds.map(catId =>
        categoryServices.getCategories({
          limit: 1000,
          isActive: 'true',
          search,
          parentId: catId,
        })
      );
      
      const responses = await Promise.all(subcatPromises);
      let allSubcategories: Category[] = [];
      
      responses.forEach(response => {
        const subcats = response.data.data.categories || [];
        allSubcategories = [...allSubcategories, ...subcats];
      });
      
      const uniqueSubcats = allSubcategories.filter((cat, index, self) =>
        index === self.findIndex((c) => c._id === cat._id)
      );
      
      let filteredSubcats = uniqueSubcats.filter((cat: Category) => cat.parent);
      
      if (branchIds.length > 1) {
        filteredSubcats = filteredSubcats.filter((cat: Category) => 
          cat.branchIds && cat.branchIds.some((b: any) => 
            branchIds.includes(typeof b === 'string' ? b : b._id)
          )
        );
      }
      
      setSearchSubcategories(filteredSubcats);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to search subcategories',
        variant: 'destructive',
      });
    } finally {
      setSubcategoriesLoading(false);
    }
  };

  const handleCategoryToggle = (categoryId: string, isSubcategory: boolean) => {
    if (isSubcategory) {
      const subcategory = [...initialSubcategories, ...searchSubcategories].find(c => c._id === categoryId);
      
      // Validate subcategory belongs to selected main categories
      if (subcategory) {
        const parentId = typeof subcategory.parent === 'string' ? subcategory.parent : subcategory.parent?._id;
        if (parentId && !selectedCategoryIds.includes(parentId)) {
          toast({
            title: 'Invalid Selection',
            description: `This subcategory belongs to a main category that is not selected. Please select the parent category first.`,
            variant: 'destructive',
          });
          return;
        }

        // Validate subcategory belongs to selected branches
        const subcategoryBranchIds = subcategory.branchIds?.map((b: any) => 
          typeof b === 'string' ? b : b._id
        ) || [];
        
        const belongsToBranches = branchIds.some(branchId => subcategoryBranchIds.includes(branchId));
        if (!belongsToBranches) {
          toast({
            title: 'Invalid Selection',
            description: `This subcategory doesn't belong to any of the selected branches.`,
            variant: 'destructive',
          });
          return;
        }
      }

      const newSelection = selectedSubcategoryIds.includes(categoryId)
        ? selectedSubcategoryIds.filter((id) => id !== categoryId)
        : [...selectedSubcategoryIds, categoryId];
      onCategoriesChange(selectedCategoryIds, newSelection);
    } else {
      const category = [...initialMainCategories, ...searchMainCategories].find(c => c._id === categoryId);
      
      // Validate category belongs to selected branches
      if (category) {
        const categoryBranchIds = category.branchIds?.map((b: any) => 
          typeof b === 'string' ? b : b._id
        ) || [];
        
        const belongsToBranches = branchIds.some(branchId => categoryBranchIds.includes(branchId));
        if (!belongsToBranches) {
          toast({
            title: 'Invalid Selection',
            description: `This category doesn't belong to any of the selected branches.`,
            variant: 'destructive',
          });
          return;
        }
      }

      const isRemoving = selectedCategoryIds.includes(categoryId);
      const newSelection = isRemoving
        ? selectedCategoryIds.filter((id) => id !== categoryId)
        : [...selectedCategoryIds, categoryId];
      
      // If removing a main category, also remove its subcategories
      let newSubcategorySelection = selectedSubcategoryIds;
      if (isRemoving) {
        // Find and remove subcategories that belong to this main category
        const subcatsToRemove = [...initialSubcategories, ...searchSubcategories]
          .filter(subcat => {
            const parentId = typeof subcat.parent === 'string' ? subcat.parent : subcat.parent?._id;
            return parentId === categoryId;
          })
          .map(subcat => subcat._id);
        
        newSubcategorySelection = selectedSubcategoryIds.filter(id => !subcatsToRemove.includes(id));
        
        if (subcatsToRemove.length > 0) {
          toast({
            title: 'Categories Updated',
            description: `Removed ${subcatsToRemove.length} subcategor${subcatsToRemove.length !== 1 ? 'ies' : 'y'} belonging to this category`,
            variant: 'default',
          });
        }
        
        // Reset subcategories cache if no main categories left
        if (newSelection.length === 0) {
          setInitialSubcategories([]);
          setSearchSubcategories([]);
        }
      }
      
      onCategoriesChange(newSelection, newSubcategorySelection);
    }
  };

  const handleRemoveCategory = (categoryId: string, isSubcategory: boolean) => {
    if (isSubcategory) {
      onCategoriesChange(selectedCategoryIds, selectedSubcategoryIds.filter((id) => id !== categoryId));
    } else {
      // When removing a main category, also remove its subcategories
      const subcatsToRemove = [...initialSubcategories, ...searchSubcategories]
        .filter(subcat => {
          const parentId = typeof subcat.parent === 'string' ? subcat.parent : subcat.parent?._id;
          return parentId === categoryId;
        })
        .map(subcat => subcat._id);
      
      const newMainCategories = selectedCategoryIds.filter((id) => id !== categoryId);
      const newSubcategories = selectedSubcategoryIds.filter((id) => !subcatsToRemove.includes(id));
      
      onCategoriesChange(newMainCategories, newSubcategories);
      
      // Reset subcategories cache if no main categories left
      if (newMainCategories.length === 0) {
        setInitialSubcategories([]);
        setSearchSubcategories([]);
      }
    }
  };

  const getSelectedCategories = (): Category[] => {
    const allCategories = [...initialMainCategories, ...initialSubcategories];
    
    [...searchMainCategories, ...searchSubcategories].forEach((searchCategory) => {
      if (!allCategories.find((c) => c._id === searchCategory._id)) {
        allCategories.push(searchCategory);
      }
    });

    return allCategories.filter((category) => 
      selectedCategoryIds.includes(category._id) || selectedSubcategoryIds.includes(category._id)
    );
  };

  // Helper to check if a category belongs to selected branches
  const isCategoryValidForBranches = (category: Category): boolean => {
    if (!category.branchIds || branchIds.length === 0) return true;
    
    const categoryBranchIds = category.branchIds.map((b: any) => 
      typeof b === 'string' ? b : b._id
    );
    
    return branchIds.some(branchId => categoryBranchIds.includes(branchId));
  };

  // Helper to check if a subcategory belongs to selected main categories
  const isSubcategoryValidForCategories = (subcategory: Category): boolean => {
    if (!subcategory.parent || selectedCategoryIds.length === 0) return true;
    
    const parentId = typeof subcategory.parent === 'string' ? subcategory.parent : subcategory.parent._id;
    return selectedCategoryIds.includes(parentId);
  };

  const selectedCategories = getSelectedCategories();
  const selectedMainCategories = selectedCategories.filter(c => !c.parent);
  const selectedSubcategories = selectedCategories.filter(c => c.parent);

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
    <div className={cn('space-y-4', className)}>
      {/* Main Categories */}
      <div className="space-y-2">
        <Label>Main Categories {required && <span className="text-red-500">*</span>}</Label>
        <Popover open={mainCategoriesOpen} onOpenChange={setMainCategoriesOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={mainCategoriesOpen}
              className="w-full justify-between"
              disabled={disabled}
            >
              {selectedMainCategories.length > 0
                ? `${selectedMainCategories.length} main categor${selectedMainCategories.length > 1 ? 'ies' : 'y'} selected`
                : 'Select main categories...'}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-full p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search main categories..."
                value={mainCategoriesSearch}
                onValueChange={setMainCategoriesSearch}
              />
              <CommandEmpty>
                {mainCategoriesLoading ? 'Searching...' : 'No main categories found'}
              </CommandEmpty>
              <CommandList>
                <CommandGroup>
                  {mainCategoriesLoading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Loading main categories...
                    </div>
                  ) : (
                    displayMainCategories.map((category) => (
                      <CommandItem
                        key={category._id}
                        value={`${category.name}`}
                        onSelect={() => handleCategoryToggle(category._id, false)}
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
                            <span className="text-xs text-muted-foreground">
                              {category.type === 'both' ? 'Both' : 
                               category.type === 'raw_material' ? 'Raw Material' : 'Finished Good'}
                            </span>
                          </div>
                        </div>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectedMainCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/50">
            {selectedMainCategories.map((category) => {
              const isValid = isCategoryValidForBranches(category);
              return (
                <Badge 
                  key={category._id} 
                  variant={isValid ? "secondary" : "destructive"} 
                  className="gap-1"
                  title={isValid ? '' : 'This category does not belong to selected branches'}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                  {!isValid && <span className="text-xs ml-1">⚠️</span>}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => !disabled && handleRemoveCategory(category._id, false)}
                  />
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      {/* Subcategories */}
      <div className="space-y-2">
        <Label>Subcategories {required && <span className="text-red-500">*</span>}</Label>
        <Popover open={subcategoriesOpen} onOpenChange={setSubcategoriesOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={subcategoriesOpen}
              className="w-full justify-between"
              disabled={disabled || selectedCategoryIds.length === 0}
            >
              {selectedSubcategories.length > 0
                ? `${selectedSubcategories.length} subcategor${selectedSubcategories.length > 1 ? 'ies' : 'y'} selected`
                : selectedCategoryIds.length === 0
                  ? 'Select main categories first...'
                  : 'Select subcategories...'}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-full p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search subcategories..."
                value={subcategoriesSearch}
                onValueChange={setSubcategoriesSearch}
              />
              <CommandEmpty>
                {subcategoriesLoading ? 'Searching...' : 'No subcategories found'}
              </CommandEmpty>
              <CommandList>
                <CommandGroup>
                  {subcategoriesLoading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Loading subcategories...
                    </div>
                  ) : (
                    displaySubcategories.map((category) => (
                      <CommandItem
                        key={category._id}
                        value={`${category.name}`}
                        onSelect={() => handleCategoryToggle(category._id, true)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedSubcategoryIds.includes(category._id) ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: category.color }}
                          />
                          <div className="flex flex-col flex-1">
                            <span className="font-medium">{category.name}</span>
                            <span className="text-xs text-muted-foreground">
                              Parent: {typeof category.parent === 'string' ? category.parent : category.parent?.name}
                            </span>
                          </div>
                        </div>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectedSubcategories.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/50">
            {selectedSubcategories.map((category) => {
              const isValidForBranches = isCategoryValidForBranches(category);
              const isValidForCategories = isSubcategoryValidForCategories(category);
              const isValid = isValidForBranches && isValidForCategories;
              
              let errorMessage = '';
              if (!isValidForBranches) errorMessage = 'Does not belong to selected branches';
              else if (!isValidForCategories) errorMessage = 'Parent category not selected';
              
              return (
                <Badge 
                  key={category._id} 
                  variant={isValid ? "secondary" : "destructive"} 
                  className="gap-1"
                  title={errorMessage}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                  <span className="text-xs opacity-70">
                    ({typeof category.parent === 'string' ? category.parent : category.parent?.name})
                  </span>
                  {!isValid && <span className="text-xs ml-1">⚠️</span>}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => !disabled && handleRemoveCategory(category._id, true)}
                  />
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {(selectedMainCategories.length > 0 || selectedSubcategories.length > 0)
          ? `${selectedMainCategories.length} main + ${selectedSubcategories.length} sub = ${selectedMainCategories.length + selectedSubcategories.length} total selected`
          : required 
            ? 'Please select at least one main category and one subcategory (required)'
            : 'Select categories and subcategories for this supplier'}
      </p>
    </div>
  );
}
