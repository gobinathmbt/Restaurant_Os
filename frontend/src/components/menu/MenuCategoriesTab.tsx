import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { menuCategoryServices } from '@/api/services';
import DataTableLayout from '@/components/common/DataTableLayout';
import MenuCategoryFormModal from './MenuCategoryFormModal';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface MenuCategory {
  _id: string;
  name: string;
  description?: string;
  branchIds: string[] | any[];
  displayOrder: number;
  isActive: boolean;
  color: string;
  icon?: string;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface MenuCategoriesTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
}

export default function MenuCategoriesTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
}: MenuCategoriesTabProps) {
  const { toast } = useToast();

  // State
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Infinite scroll
  const [infiniteScrollPage, setInfiniteScrollPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [paginationEnabled, setPaginationEnabled] = useState(true);

  // Stats
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<MenuCategory | null>(null);

  // Fetch categories when dependencies change
  useEffect(() => {
    if (paginationEnabled) {
      fetchCategories();
    } else {
      setCategories([]);
      setInfiniteScrollPage(1);
      setHasMore(true);
      fetchCategoriesInfinite(1, true);
    }
  }, [currentPage, rowsPerPage, searchValue, paginationEnabled]);

  const fetchCategories = async () => {
    try {
      setIsLoadingCategories(true);

      const params: any = {
        page: currentPage,
        limit: rowsPerPage,
        search: searchValue || undefined,
        branchId: selectedBranch !== 'all' ? selectedBranch : undefined,
      };

      const response = await menuCategoryServices.getMenuCategories(params);

      const fetchedCategories = response.data.data.categories || [];
      setCategories(fetchedCategories);
      setTotalCount(response.data.data.pagination.total);
      setTotalPages(response.data.data.pagination.pages);

      // Calculate stats
      const active = fetchedCategories.filter((cat: MenuCategory) => cat.isActive).length;
      const inactive = fetchedCategories.filter((cat: MenuCategory) => !cat.isActive).length;
      setActiveCount(active);
      setInactiveCount(inactive);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to fetch categories',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const fetchCategoriesInfinite = async (page: number, reset: boolean = false) => {
    try {
      if (reset) {
        setIsLoadingCategories(true);
      } else {
        setIsLoadingMore(true);
      }

      const params: any = {
        page: page,
        limit: 20,
        search: searchValue || undefined,
        branchId: selectedBranch !== 'all' ? selectedBranch : undefined,
      };

      const response = await menuCategoryServices.getMenuCategories(params);

      const fetchedCategories = response.data.data.categories || [];
      const pagination = response.data.data.pagination;

      if (reset) {
        setCategories(fetchedCategories);
      } else {
        setCategories((prev) => [...prev, ...fetchedCategories]);
      }

      setTotalCount(pagination.total);
      setTotalPages(pagination.pages);
      setHasMore(page < pagination.pages);

      // Calculate stats
      const allCategories = reset ? fetchedCategories : [...categories, ...fetchedCategories];
      const active = allCategories.filter((cat: MenuCategory) => cat.isActive).length;
      const inactive = allCategories.filter((cat: MenuCategory) => !cat.isActive).length;
      setActiveCount(active);
      setInactiveCount(inactive);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to fetch categories',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingCategories(false);
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && !paginationEnabled) {
      const nextPage = infiniteScrollPage + 1;
      setInfiniteScrollPage(nextPage);
      fetchCategoriesInfinite(nextPage, false);
    }
  };

  const handleAddCategory = () => {
    setSelectedCategory(null);
    setIsFormModalOpen(true);
  };

  const handleEditCategory = (category: MenuCategory) => {
    setSelectedCategory(category);
    setIsFormModalOpen(true);
  };

  const handleDeleteCategory = (category: MenuCategory) => {
    setCategoryToDelete(category);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;

    try {
      await menuCategoryServices.deleteMenuCategory(categoryToDelete._id);
      
      toast({
        title: 'Success',
        variant:'success',
        description: 'Category deleted successfully',
      });

      // Refresh the list
      handleRefresh();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete category',
        variant: 'destructive',
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setCategoryToDelete(null);
    }
  };

  const handleFormSuccess = () => {
    setIsFormModalOpen(false);
    setSelectedCategory(null);
    handleRefresh();
  };

  const handleRefresh = () => {
    if (paginationEnabled) {
      fetchCategories();
    } else {
      setCategories([]);
      setInfiniteScrollPage(1);
      setHasMore(true);
      fetchCategoriesInfinite(1, true);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <DataTableLayout
        statChips={[
          { label: 'Total Categories', value: totalCount, variant: 'default' },
          { label: 'Active', value: activeCount, variant: 'default' },
          { label: 'Inactive', value: inactiveCount, variant: 'secondary' },
        ]}
        actionButtons={[
          {
            icon: <Plus className="h-4 w-4" />,
            tooltip: 'Add category',
            onClick: handleAddCategory,
            variant: 'default',
          },
        ]}
        searchValue={searchValue}
        searchPlaceholder="Search categories..."
        onSearchChange={setSearchValue}
        filterConfig={{
          component: (
            <div className="flex items-center gap-2">
              {(isSuperAdmin || isMultiBranchAdmin) && branches.length > 0 && (
                <Select value={selectedBranch} onValueChange={onBranchChange}>
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch._id} value={branch._id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ),
        }}
        tableHeaders={
          <>
            <TableHead className="w-16">S.No</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-center">Item Count</TableHead>
            <TableHead className="text-center">Display Order</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </>
        }
        tableBody={
          <>
            {categories.map((category, index) => {
              const serialNumber = paginationEnabled
                ? (currentPage - 1) * rowsPerPage + index + 1
                : index + 1;

              return (
                <TableRow key={category._id}>
                  <TableCell className="font-medium text-muted-foreground">
                    {serialNumber}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium">{category.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {category.description || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">
                      {category.itemCount || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm">{category.displayOrder}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={category.isActive ? 'default' : 'secondary'}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCategory(category)}
                        title="Edit category"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCategory(category)}
                        title="Delete category"
                        disabled={category.itemCount && category.itemCount > 0}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </>
        }
        isLoading={isLoadingCategories}
        emptyState={
          categories.length === 0
            ? {
                icon: <FolderOpen className="h-12 w-12" />,
                title: 'No categories found',
                description: searchValue
                  ? 'Try adjusting your search'
                  : 'Get started by adding your first category',
                action: !searchValue ? (
                  <Button onClick={handleAddCategory}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                ) : undefined,
              }
            : undefined
        }
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={(rows) => {
          setRowsPerPage(rows);
          setCurrentPage(1);
        }}
        onRefresh={handleRefresh}
        storagePrefix="menu-categories"
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onPaginationChange={(enabled) => setPaginationEnabled(enabled)}
      />

      {/* Form Modal */}
      <MenuCategoryFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedCategory(null);
        }}
        category={selectedCategory}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the category "{categoryToDelete?.name}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteDialogOpen(false);
              setCategoryToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
