import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';
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

interface SupplierCategoryFilterProps {
  selectedBranchId: string;
  selectedCategoryId: string;
  selectedSubcategoryId: string;
  onCategoryChange: (categoryId: string) => void;
  onSubcategoryChange: (subcategoryId: string) => void;
  className?: string;
}

export default function SupplierCategoryFilter({
  selectedBranchId,
  selectedCategoryId,
  selectedSubcategoryId,
  onCategoryChange,
  onSubcategoryChange,
  className = '',
}: SupplierCategoryFilterProps) {
  const { toast } = useToast();
  
  const [mainCategories, setMainCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);

  // Fetch main categories when branch changes
  useEffect(() => {
    if (selectedBranchId && selectedBranchId !== 'all') {
      fetchMainCategories(selectedBranchId);
    } else if (selectedBranchId === 'all') {
      // Fetch all categories across all branches
      fetchAllMainCategories();
    } else {
      // No branch selected - clear everything
      setMainCategories([]);
      setSubcategories([]);
      onCategoryChange('all');
      onSubcategoryChange('all');
    }
  }, [selectedBranchId]);

  // Fetch subcategories when category changes
  useEffect(() => {
    if (selectedCategoryId && selectedCategoryId !== 'all') {
      fetchSubcategories(selectedCategoryId);
    } else {
      // No category selected or "all" selected - clear subcategories
      setSubcategories([]);
      onSubcategoryChange('all');
    }
  }, [selectedCategoryId]);

  const fetchMainCategories = async (branchId: string) => {
    try {
      setCategoriesLoading(true);
      
      const response = await categoryServices.getCategories({
        limit: 1000,
        isActive: 'true',
        parentId: 'null',
        branchId: branchId,
      });
      
      const categories = response.data.data.categories || [];
      setMainCategories(categories);
      
      // Reset selections if current category is not in the new list
      if (selectedCategoryId !== 'all' && !categories.find((c: Category) => c._id === selectedCategoryId)) {
        onCategoryChange('all');
        onSubcategoryChange('all');
      }
    } catch (error: any) {
      console.error('Failed to fetch main categories:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch categories',
        variant: 'destructive',
      });
      setMainCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchAllMainCategories = async () => {
    try {
      setCategoriesLoading(true);
      
      const response = await categoryServices.getCategories({
        limit: 1000,
        isActive: 'true',
        parentId: 'null',
      });
      
      const categories = response.data.data.categories || [];
      setMainCategories(categories);
    } catch (error: any) {
      console.error('Failed to fetch all main categories:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch categories',
        variant: 'destructive',
      });
      setMainCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchSubcategories = async (categoryId: string) => {
    try {
      setSubcategoriesLoading(true);
      
      const response = await categoryServices.getSubcategories(categoryId);
      const subcats = response.data.data.categories || [];
      
      // Filter by branch if a specific branch is selected
      let filteredSubcats = subcats;
      if (selectedBranchId && selectedBranchId !== 'all') {
        filteredSubcats = subcats.filter((subcat: Category) => {
          if (!subcat.branchIds) return false;
          const subcatBranchIds = subcat.branchIds.map((b: any) => 
            typeof b === 'string' ? b : b._id
          );
          return subcatBranchIds.includes(selectedBranchId);
        });
      }
      
      setSubcategories(filteredSubcats);
      
      // Reset subcategory selection if current subcategory is not in the new list
      if (selectedSubcategoryId !== 'all' && !filteredSubcats.find((s: Category) => s._id === selectedSubcategoryId)) {
        onSubcategoryChange('all');
      }
    } catch (error: any) {
      console.error('Failed to fetch subcategories:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch subcategories',
        variant: 'destructive',
      });
      setSubcategories([]);
    } finally {
      setSubcategoriesLoading(false);
    }
  };

  const handleCategoryChange = (value: string) => {
    onCategoryChange(value);
    // Subcategories will be fetched by the useEffect
  };

  const handleSubcategoryChange = (value: string) => {
    onSubcategoryChange(value);
  };

  const handleClearCategory = () => {
    onCategoryChange('all');
    onSubcategoryChange('all');
  };

  const handleClearSubcategory = () => {
    onSubcategoryChange('all');
  };

  const selectedCategory = mainCategories.find(c => c._id === selectedCategoryId);
  const selectedSubcategory = subcategories.find(s => s._id === selectedSubcategoryId);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Main Category Filter */}
      <div className="flex items-center gap-2">
        <Select 
          value={selectedCategoryId} 
          onValueChange={handleCategoryChange}
          disabled={!selectedBranchId || categoriesLoading}
        >
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder={categoriesLoading ? "Loading..." : "All categories"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {mainCategories.map((category) => (
              <SelectItem key={category._id} value={category._id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  <span>{category.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {selectedCategory && selectedCategoryId !== 'all' && (
          <Badge variant="secondary" className="gap-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: selectedCategory.color }}
            />
            {selectedCategory.name}
            <X
              className="h-3 w-3 cursor-pointer hover:text-destructive"
              onClick={handleClearCategory}
            />
          </Badge>
        )}
      </div>

      {/* Subcategory Filter */}
      <div className="flex items-center gap-2">
        <Select 
          value={selectedSubcategoryId} 
          onValueChange={handleSubcategoryChange}
          disabled={!selectedCategoryId || selectedCategoryId === 'all' || subcategoriesLoading}
        >
          <SelectTrigger className="w-48 h-9">
            <SelectValue 
              placeholder={
                !selectedCategoryId || selectedCategoryId === 'all' 
                  ? "Select category first" 
                  : subcategoriesLoading 
                    ? "Loading..." 
                    : "All subcategories"
              } 
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subcategories</SelectItem>
            {subcategories.map((subcategory) => (
              <SelectItem key={subcategory._id} value={subcategory._id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: subcategory.color }}
                  />
                  <span>{subcategory.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {selectedSubcategory && selectedSubcategoryId !== 'all' && (
          <Badge variant="secondary" className="gap-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: selectedSubcategory.color }}
            />
            {selectedSubcategory.name}
            <X
              className="h-3 w-3 cursor-pointer hover:text-destructive"
              onClick={handleClearSubcategory}
            />
          </Badge>
        )}
      </div>
    </div>
  );
}
