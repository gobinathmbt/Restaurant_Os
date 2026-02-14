import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
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
import { recipeServices, menuItemServices, branchServices } from '@/api/services';
import RecipeFormModal from '@/components/recipes/RecipeFormModal';
import DeleteConfirmDialog from '@/components/company/DeleteConfirmDialog';
import { useLoading } from '@/contexts/LoadingContext';
import { useAuth } from '@/contexts/AuthContext';
import DataTableLayout from '@/components/common/DataTableLayout';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface Recipe {
  _id: string;
  name: string;
  finishedGood: {
    _id: string;
    name: string;
  };
  ingredients?: Array<{
    rawMaterial: {
      _id: string;
      name: string;
    };
    quantity: number;
    unit: string;
  }>;
  yield?: {
    quantity: number;
    unit: string;
  };
  preparationTime?: number;
  cookingTime?: number;
  costPerUnit?: number;
  version: number;
  isActive: boolean;
  totalTime?: number;
  preparationSteps: Array<{
    stepNumber: number;
    description: string;
  }>;
  notes?: string;
  branches?: Array<{
    _id: string;
    branch: {
      _id: string;
      name: string;
      code: string;
    };
    ingredients: Array<{
      inventoryItemBranch: string | {
        _id: string;
        inventoryItem: {
          name: string;
        };
      };
      quantity: number;
      unit: string;
    }>;
    yield: {
      quantity: number;
      unit: string;
    };
    preparationTime?: number;
    cookingTime?: number;
    costPerUnit?: number;
    isActive: boolean;
    notes?: string;
  }>;
  branchConfig?: {
    ingredients: Array<{
      inventoryItemBranch: {
        _id: string;
        inventoryItem: {
          name: string;
        };
      };
      quantity: number;
      unit: string;
    }>;
    yield: {
      quantity: number;
      unit: string;
    };
    preparationTime?: number;
    cookingTime?: number;
    costPerUnit?: number;
    isActive: boolean;
    notes?: string;
  };
}

interface FinishedGood {
  _id: string;
  name: string;
}

export default function Recipes() {
  const { user } = useAuth();
  const { setLoading, setLoadingMessage } = useLoading();
  const { toast } = useToast();

  // Determine user's branch access
  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');
  const isMultiBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) > 1;
  const isSingleBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) === 1;

  // State
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [finishedGoodFilter, setFinishedGoodFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; recipe: Recipe | null }>({
    open: false,
    recipe: null,
  });

  // Infinite scroll state
  const [infiniteScrollPage, setInfiniteScrollPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [paginationEnabled, setPaginationEnabled] = useState(true);

  // Auto-select branch for single-branch admin
  useEffect(() => {
    if (isSingleBranchAdmin && user?.branchIds && user.branchIds.length === 1) {
      setBranchFilter(user.branchIds[0]);
    } else if (isMultiBranchAdmin && user?.branchIds && user.branchIds.length > 1 && !branchFilter) {
      // For multi-branch company admins, default to "all" branches
      setBranchFilter('all');
    } else if (isSuperAdmin && !branchFilter && branches.length > 0) {
      // For super admins, default to "all" branches
      setBranchFilter('all');
    }
  }, [isSingleBranchAdmin, isMultiBranchAdmin, isSuperAdmin, user?.branchIds, branchFilter, branches]);

  // Fetch branches on mount
  useEffect(() => {
    fetchBranches();
  }, []);

  // Fetch recipes on mount and when filters change
  useEffect(() => {
    if (paginationEnabled) {
      fetchRecipes();
    } else {
      // Reset for infinite scroll
      setRecipes([]);
      setInfiniteScrollPage(1);
      setHasMore(true);
      fetchRecipesInfinite(1, true);
    }
  }, [page, rowsPerPage, search, finishedGoodFilter, branchFilter, paginationEnabled]);

  // Fetch finished goods for filter
  useEffect(() => {
    fetchFinishedGoods();
  }, []);

  const fetchBranches = async () => {
    try {
      const response = await branchServices.getBranches({ limit: 1000 });
      const allBranches = response.data.data.branches || [];

      // Filter branches based on user role
      let availableBranches = allBranches;
      if (isMultiBranchAdmin || isSingleBranchAdmin) {
        availableBranches = allBranches.filter((branch: Branch) =>
          user?.branchIds?.includes(branch._id)
        );
      }

      setBranches(availableBranches);

      // Auto-select for super admins if none selected
      if (isSuperAdmin && !branchFilter && availableBranches.length > 0) {
        setBranchFilter('all');
      }
    } catch (error: any) {
      // Silently fail for branches
    }
  };

  const fetchRecipes = async () => {
    if (!paginationEnabled) return;

    try {
      setRecipesLoading(true);
      const params: any = {
        page,
        limit: rowsPerPage,
        search: search || undefined,
        finishedGood: finishedGoodFilter || undefined,
      };

      // Add branch filter if selected and not "all"
      if (branchFilter && branchFilter !== 'all') {
        params.branchId = branchFilter;
      }

      const response = await recipeServices.getRecipes(params);

      setRecipes(response.data.data.recipes || []);
      setTotalCount(response.data.data.pagination.total);
      setTotalPages(response.data.data.pagination.page);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to fetch recipes',
        variant: 'destructive',
      });
    } finally {
      setRecipesLoading(false);
    }
  };

  const fetchRecipesInfinite = async (page: number, reset: boolean = false) => {
    try {
      if (reset) {
        setRecipesLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const params: any = {
        page: page,
        limit: 20, // Fixed batch size for infinite scroll
        search: search || undefined,
        finishedGood: finishedGoodFilter || undefined,
      };

      // Add branch filter if selected and not "all"
      if (branchFilter && branchFilter !== 'all') {
        params.branchId = branchFilter;
      }

      const response = await recipeServices.getRecipes(params);

      const newRecipes = response.data.data.recipes || [];
      const pagination = response.data.data.pagination;

      if (reset) {
        setRecipes(newRecipes);
      } else {
        setRecipes((prev) => [...prev, ...newRecipes]);
      }

      setTotalCount(pagination.total);
      setTotalPages(pagination.page);
      setHasMore(page < pagination.page);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to fetch recipes',
        variant: 'destructive',
      });
    } finally {
      setRecipesLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && !paginationEnabled) {
      const nextPage = infiniteScrollPage + 1;
      setInfiniteScrollPage(nextPage);
      fetchRecipesInfinite(nextPage, false);
    }
  };

  const fetchFinishedGoods = async () => {
    try {
      const params: any = {
        limit: 1000,
      };
      // Fetch finished goods from inventory items
      const response = await menuItemServices.getMenuItems(params);
      const items = response.data.data.menuItems || [];
      setFinishedGoods(
        items.map((item: any) => ({
          _id: item._id,
          name: item.name,
        }))
      );
    } catch (error: any) {
      // Silently fail for finished goods
    }
  };

  const handleCreate = () => {
    setSelectedRecipe(null);
    setIsFormOpen(true);
  };

  const handleEdit = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setIsFormOpen(true);
  };

  const handleDelete = (recipe: Recipe) => {
    setDeleteDialog({ open: true, recipe });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.recipe) return;

    try {
      setLoading(true);
      setLoadingMessage('Deleting recipe...');
      await recipeServices.deleteRecipe(deleteDialog.recipe._id);
      toast({
        title: 'Success',
        description: 'Recipe deleted successfully',
        variant: 'success',
      });
      if (paginationEnabled) {
        fetchRecipes();
      } else {
        setRecipes([]);
        setInfiniteScrollPage(1);
        setHasMore(true);
        fetchRecipesInfinite(1, true);
      }
      setDeleteDialog({ open: false, recipe: null });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete recipe',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedRecipe(null);
    if (paginationEnabled) {
      fetchRecipes();
    } else {
      setRecipes([]);
      setInfiniteScrollPage(1);
      setHasMore(true);
      fetchRecipesInfinite(1, true);
    }
  };

  const formatTime = (minutes?: number) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '-';
    return `₹${amount.toFixed(2)}`;
  };

  return (
    <div className="h-[calc(100vh-4rem)] -m-6 flex flex-col overflow-hidden">
      <DataTableLayout
        statChips={[{ label: 'Total Recipes', value: totalCount, variant: 'default' }]}
        actionButtons={[
          {
            icon: <Plus className="h-4 w-4" />,
            tooltip: 'Add recipe',
            onClick: handleCreate,
            variant: 'default',
          },
        ]}
        searchValue={search}
        searchPlaceholder="Search recipes..."
        onSearchChange={setSearch}
        filterConfig={{
          component: (
            <div className="flex items-center gap-2">
              {(isSuperAdmin || isMultiBranchAdmin) && branches.length > 0 && (
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {(isSuperAdmin || isMultiBranchAdmin) && (
                      <SelectItem value="all">All Branches</SelectItem>
                    )}
                    {branches.map((branch) => (
                      <SelectItem key={branch._id} value={branch._id}>
                        {branch.name} ({branch.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={finishedGoodFilter} onValueChange={setFinishedGoodFilter}>
                <SelectTrigger className="w-48 h-9">
                  <SelectValue placeholder="All finished goods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All finished goods</SelectItem>
                  {finishedGoods.map((item) => (
                    <SelectItem key={item._id} value={item._id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ),
        }}
        tableHeaders={
          <>
            <TableHead className="w-16">S.No</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Finished Good</TableHead>
            <TableHead className="text-center">Ingredients</TableHead>
            <TableHead className="text-right">Cost Per Unit</TableHead>
            <TableHead className="text-center">Prep Time</TableHead>
            <TableHead className="text-center">Cook Time</TableHead>
            <TableHead className="text-center">Version</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </>
        }
        tableBody={
          <>
            {recipes.map((recipe, index) => {
              // Calculate serial number based on pagination mode
              const serialNumber = paginationEnabled
                ? (page - 1) * rowsPerPage + index + 1
                : index + 1;

              // Determine which data to display based on branch filter
              const displayData = branchFilter && branchFilter !== 'all' && recipe.branchConfig
                ? {
                    ingredients: recipe.branchConfig.ingredients || [],
                    yield: recipe.branchConfig.yield,
                    preparationTime: recipe.branchConfig.preparationTime,
                    cookingTime: recipe.branchConfig.cookingTime,
                    costPerUnit: recipe.branchConfig.costPerUnit,
                  }
                : {
                    ingredients: recipe.ingredients || [],
                    yield: recipe.yield,
                    preparationTime: recipe.preparationTime,
                    cookingTime: recipe.cookingTime,
                    costPerUnit: recipe.costPerUnit,
                  };

              return (
                <TableRow key={recipe._id}>
                  <TableCell className="font-medium text-muted-foreground">
                    {serialNumber}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{recipe.name}</p>
                    {displayData.yield && (
                      <p className="text-xs text-muted-foreground">
                        Yield: {displayData.yield.quantity} {displayData.yield.unit}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{recipe.finishedGood?.name || '-'}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{displayData.ingredients.length || 0} items</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(displayData.costPerUnit)}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {formatTime(displayData.preparationTime)}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {formatTime(displayData.cookingTime)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      v{recipe.version}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(recipe)}
                        title="Edit recipe"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(recipe)}
                        title="Delete recipe"
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
        isLoading={recipesLoading}
        emptyState={
          recipes.length === 0
            ? {
                icon: <Package className="h-12 w-12" />,
                title: 'No recipes found',
                description:
                  search || finishedGoodFilter || (branchFilter && branchFilter !== 'all')
                    ? 'Try adjusting your filters'
                    : 'Get started by adding your first recipe',
                action:
                  !search && !finishedGoodFilter && (!branchFilter || branchFilter === 'all') ? (
                    <Button onClick={handleCreate}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Recipe
                    </Button>
                  ) : undefined,
              }
            : undefined
        }
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        rowsPerPage={rowsPerPage}
        onPageChange={setPage}
        onRowsPerPageChange={(rows) => {
          setRowsPerPage(rows);
          setPage(1);
        }}
        onRefresh={() => {
          if (paginationEnabled) {
            fetchRecipes();
          } else {
            setRecipes([]);
            setInfiniteScrollPage(1);
            setHasMore(true);
            fetchRecipesInfinite(1, true);
          }
        }}
        storagePrefix="recipes"
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onPaginationChange={(enabled) => setPaginationEnabled(enabled)}
      />

      {/* Recipe Form Modal */}
      <RecipeFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedRecipe(null);
        }}
        recipe={selectedRecipe as any}
        onSuccess={handleFormSuccess}
        branches={branches}
        userBranchIds={isSuperAdmin ? null : user?.branchIds || []}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, recipe: null })}
        onConfirm={confirmDelete}
        title="Delete Recipe"
        description={`Are you sure you want to delete the recipe "${deleteDialog.recipe?.name}"? This action cannot be undone.`}
      />
    </div>
  );
}
