import { useState, useEffect } from 'react';
import { Plus, Edit, Settings, Power, Trash, Package, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableHeader, TableCell, TableHead, TableRow } from '@/components/ui/table';
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
      setCategoriesTotalPages(response.data.data.pagination.totalPages);
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

  return (
    <>
      <div className="h-full flex flex-col bg-background">
        {/* Fixed Header */}
        <div className="bg-background border-b flex-shrink-0">
          <div className="px-6 py-3">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Stats Chips */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="px-3 py-1 text-sm">
                  Total Categories: {categoriesTotalCount}
                </Badge>
              </div>

              {/* Search */}
              <div className="flex-1 max-w-xs">
                <Input
                  placeholder="Search categories..."
                  value={categoriesSearch}
                  onChange={(e) => setCategoriesSearch(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                {(isSuperAdmin || isMultiBranchAdmin) && (
                  <Select value={selectedBranch} onValueChange={onBranchChange}>
                    <SelectTrigger className="w-48 h-9">
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
                  <SelectTrigger className="w-40 h-9">
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
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue placeholder="All status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={fetchCategoryList}
                disabled={categoriesLoading}
                className="h-9 w-9"
              >
                <RefreshCw className={`h-4 w-4 ${categoriesLoading ? 'animate-spin' : ''}`} />
              </Button>

              {/* Add Button */}
              <Button
                variant="default"
                size="icon"
                onClick={handleCreateCategory}
                className="h-9 w-9"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {categoriesLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : categoryList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No categories found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {categoriesSearch || categoriesTypeFilter
                  ? 'Try adjusting your filters'
                  : 'Get started by adding your first category'}
              </p>
              {!categoriesSearch && !categoriesTypeFilter && (
                <Button onClick={handleCreateCategory}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 border-b">
                <TableRow>
                  <TableHead className="w-16">S.No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Branches</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
              </TableBody>
            </Table>
          )}
        </div>

        {/* Fixed Footer with Pagination */}
        <div className="bg-background border-t py-3 px-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            {/* Left: Rows per page */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Rows:</Label>
              <Select
                value={categoriesRowsPerPage.toString()}
                onValueChange={(value) => {
                  setCategoriesRowsPerPage(parseInt(value));
                  setCategoriesPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Center: Pagination */}
            {categoriesTotalPages > 0 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => categoriesPage > 1 && setCategoriesPage(categoriesPage - 1)}
                  disabled={categoriesPage <= 1}
                  className="h-8 px-3"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-3">
                  Page {categoriesPage} of {categoriesTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => categoriesPage < categoriesTotalPages && setCategoriesPage(categoriesPage + 1)}
                  disabled={categoriesPage >= categoriesTotalPages}
                  className="h-8 px-3"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Right: Total count */}
            <div className="text-sm text-muted-foreground">
              Total: {categoriesTotalCount}
            </div>
          </div>
        </div>
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
