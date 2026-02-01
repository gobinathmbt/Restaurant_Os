import { useState, useEffect } from 'react';
import { Plus, Edit, Settings, Power, Trash, Package } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { categoryServices } from '@/api/services';
import CategoryFormModal from '@/components/inventory/CategoryFormModal';
import ManageSubcategoriesModal from '@/components/inventory/ManageSubcategoriesModal';
import DeleteConfirmDialog from '@/components/company/DeleteConfirmDialog';
import { useLoading } from '@/contexts/LoadingContext';
import DataTableLayout from '@/components/common/DataTableLayout';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface Category {
  _id: string;
  name: string;
  description?: string;
  type: string;
  color: string;
  displayOrder: number;
  branchIds: Array<{
    _id: string;
    name: string;
    code: string;
  }>;
  parent?: {
    _id: string;
    name: string;
  } | string;
  isActive: boolean;
  editableBranches?: Array<{
    _id: string;
    name: string;
    code: string;
  }>;
  canEdit?: boolean;
}

interface CategoriesTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
}

export default function CategoriesTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
}: CategoriesTabProps) {
  const { setLoading, setLoadingMessage } = useLoading();
  const { toast } = useToast();

  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesSearch, setCategoriesSearch] = useState('');
  const [categoriesTypeFilter, setCategoriesTypeFilter] = useState('');
  const [categoriesStatusFilter, setCategoriesStatusFilter] = useState('');
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [categoriesRowsPerPage, setCategoriesRowsPerPage] = useState(10);
  const [categoriesTotalCount, setCategoriesTotalCount] = useState(0);
  const [categoriesTotalPages, setCategoriesTotalPages] = useState(0);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isManageSubcategoriesOpen, setIsManageSubcategoriesOpen] = useState(false);
  const [categoryForSubcategoryManagement, setCategoryForSubcategoryManagement] = useState<Category | null>(null);
  const [categoryDeleteDialog, setCategoryDeleteDialog] = useState<{ open: boolean; category: Category | null }>({
    open: false,
    category: null
  });

  useEffect(() => {
    if (selectedBranch) {
      fetchCategoryList();
    }
  }, [selectedBranch, categoriesPage, categoriesRowsPerPage, categoriesSearch, categoriesTypeFilter, categoriesStatusFilter]);

  const fetchCategoryList = async () => {
    if (!selectedBranch) return;
    
    try {
      setCategoriesLoading(true);
      const params: any = {
        page: categoriesPage,
        limit: categoriesRowsPerPage,
        search: categoriesSearch || undefined,
        type: categoriesTypeFilter || undefined,
        isActive: categoriesStatusFilter || undefined,
        parentId: 'null' // Only fetch main categories
      };

      // Only add branchId filter if not "all" (for super admins)
      if (selectedBranch !== 'all') {
        params.branchId = selectedBranch;
      }

      const response = await categoryServices.getCategories(params);

      setCategoryList(response.data.data.categories || []);
      setCategoriesTotalCount(response.data.data.pagination.total);
      setCategoriesTotalPages(response.data.data.pagination.pages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch categories',
        variant: "destructive",
      });
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleCreateCategory = () => {
    setSelectedCategory(null);
    setIsCategoryFormOpen(true);
  };

  const handleManageSubcategories = (category: Category) => {
    setCategoryForSubcategoryManagement(category);
    setIsManageSubcategoriesOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setIsCategoryFormOpen(true);
  };

  const handleDeleteCategory = (category: Category) => {
    setCategoryDeleteDialog({ open: true, category });
  };

  const confirmDeleteCategory = async () => {
    if (!categoryDeleteDialog.category) return;

    try {
      setLoading(true);
      setLoadingMessage('Deleting category...');
      await categoryServices.permanentlyDeleteCategory(categoryDeleteDialog.category._id);
      toast({
        title: "Success",
        description: "Category permanently deleted successfully",
        variant: "success",
      });
      fetchCategoryList();
      setCategoryDeleteDialog({ open: false, category: null });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to delete category',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCategoryStatus = async (category: Category) => {
    try {
      setLoading(true);
      setLoadingMessage(`${category.isActive ? 'Deactivating' : 'Activating'} category...`);
      await categoryServices.toggleCategoryStatus(category._id);
      toast({
        title: "Success",
        description: `Category ${category.isActive ? 'deactivated' : 'activated'} successfully`,
        variant: "success",
      });
      fetchCategoryList();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to toggle category status',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryFormSuccess = () => {
    setIsCategoryFormOpen(false);
    setSelectedCategory(null);
    fetchCategoryList();
  };

  const handleSubcategoryManagementClose = () => {
    setIsManageSubcategoriesOpen(false);
    setCategoryForSubcategoryManagement(null);
  };

  const activeCategories = categoryList.filter((c) => c.isActive).length;
  const inactiveCategories = categoryList.filter((c) => !c.isActive).length;

  return (
    <>
      <div className="h-full flex flex-col">
        <DataTableLayout
          statChips={[
            { label: 'Total', value: categoriesTotalCount, variant: 'default' },
            { label: 'Active', value: activeCategories,  variant: 'default' },
            { label: 'Inactive', value: inactiveCategories,  variant: 'default' },
          ]}
          actionButtons={[
            {
              icon: <Plus className="h-4 w-4" />,
              tooltip: 'Add new category',
              onClick: handleCreateCategory,
              variant: 'default',
            },
          ]}
          searchValue={categoriesSearch}
          searchPlaceholder="Search categories..."
          onSearchChange={setCategoriesSearch}
          filterConfig={{
            component: (
              <div className="flex items-center gap-2">
                {(isSuperAdmin || isMultiBranchAdmin) && (
                  <Select value={selectedBranch} onValueChange={onBranchChange}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {isSuperAdmin && (
                        <SelectItem value="all">All Branches</SelectItem>
                      )}
                      {branches.map((branch) => (
                        <SelectItem key={branch._id} value={branch._id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={categoriesTypeFilter || "all"} onValueChange={(value) => setCategoriesTypeFilter(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="raw_material">Raw Material</SelectItem>
                    <SelectItem value="finished_good">Finished Good</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoriesStatusFilter || "all"} onValueChange={(value) => setCategoriesStatusFilter(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ),
          }}
          tableHeaders={
            <>
              <TableHead className="w-16">S.No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </>
          }
          tableBody={
            <>
              {categoryList.map((category, index) => (
                <TableRow key={category._id}>
                  <TableCell className="font-medium text-muted-foreground">
                    {(categoriesPage - 1) * categoriesRowsPerPage + index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium">{category.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {category.description || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {category.type === 'both' ? 'Both' : 
                       category.type === 'raw_material' ? 'Raw Material' : 'Finished Good'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {category.branchIds && category.branchIds.length > 0 ? (
                        category.branchIds.slice(0, 3).map((branch) => (
                          <Badge key={branch._id} variant="secondary" className="text-xs">
                            {branch.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">No branches</span>
                      )}
                      {category.branchIds && category.branchIds.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{category.branchIds.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-xs text-muted-foreground">{category.color}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={category.isActive ? 'default' : 'secondary'}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleManageSubcategories(category)}
                        title="Manage subcategories"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleCategoryStatus(category)}
                        title={category.isActive ? 'Deactivate' : 'Activate'}
                        disabled={!category.canEdit}
                      >
                        <Power className={`h-4 w-4 ${category.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCategory(category)}
                        title="Edit"
                        disabled={!category.canEdit}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCategory(category)}
                        title="Permanently delete"
                        disabled={!category.canEdit}
                      >
                        <Trash className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </>
          }
          isLoading={categoriesLoading}
          emptyState={
            categoryList.length === 0
              ? {
                  icon: <Package className="h-12 w-12" />,
                  title: 'No categories found',
                  description:
                    categoriesSearch || categoriesTypeFilter
                      ? 'Try adjusting your filters'
                      : 'Get started by adding your first category',
                  action:
                    !categoriesSearch && !categoriesTypeFilter ? (
                      <Button onClick={handleCreateCategory}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Category
                      </Button>
                    ) : undefined,
                }
              : undefined
          }
          currentPage={categoriesPage}
          totalPages={categoriesTotalPages}
          totalCount={categoriesTotalCount}
          rowsPerPage={categoriesRowsPerPage}
          onPageChange={setCategoriesPage}
          onRowsPerPageChange={(rows) => {
            setCategoriesRowsPerPage(rows);
            setCategoriesPage(1);
          }}
          onRefresh={fetchCategoryList}
          cookiePrefix="categories"
        />
      </div>

      <CategoryFormModal
        open={isCategoryFormOpen}
        onClose={() => {
          setIsCategoryFormOpen(false);
          setSelectedCategory(null);
        }}
        category={selectedCategory}
        branchId={selectedBranch}
        onSuccess={handleCategoryFormSuccess}
        parentCategory={null}
      />

      <ManageSubcategoriesModal
        open={isManageSubcategoriesOpen}
        onClose={handleSubcategoryManagementClose}
        parentCategory={categoryForSubcategoryManagement}
        branchId={selectedBranch}
      />

      <DeleteConfirmDialog
        open={categoryDeleteDialog.open}
        onClose={() => setCategoryDeleteDialog({ open: false, category: null })}
        onConfirm={confirmDeleteCategory}
        title="Permanently Delete Category"
        description={`Are you sure you want to permanently delete "${categoryDeleteDialog.category?.name}"? This action cannot be undone and will remove the category from the database.`}
      />
    </>
  );
}
