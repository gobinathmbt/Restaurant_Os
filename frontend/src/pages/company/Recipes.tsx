import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Package } from 'lucide-react';
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
import { recipeServices, inventoryServices } from '@/api/services';
import RecipeFormModal from '@/components/inventory/RecipeFormModal';
import DeleteConfirmDialog from '@/components/company/DeleteConfirmDialog';
import { useLoading } from '@/contexts/LoadingContext';
import DataTableLayout from '@/components/common/DataTableLayout';

interface Recipe {
  _id: string;
  name: string;
  finishedGood: {
    _id: string;
    name: string;
  };
  ingredients: Array<{
    rawMaterial: {
      _id: string;
      name: string;
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
  version: number;
  isActive: boolean;
  totalTime?: number;
}

interface FinishedGood {
  _id: string;
  name: string;
}

export default function Recipes() {
  const { setLoading, setLoadingMessage } = useLoading();
  const { toast } = useToast();

  // State
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [finishedGoodFilter, setFinishedGoodFilter] = useState('');
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; recipe: Recipe | null }>({
    open: false,
    recipe: null
  });

  // Fetch recipes on mount and when filters change
  useEffect(() => {
    fetchRecipes();
  }, [page, rowsPerPage, search, finishedGoodFilter]);

  // Fetch finished goods for filter
  useEffect(() => {
    fetchFinishedGoods();
  }, []);

  const fetchRecipes = async () => {
    try {
      setRecipesLoading(true);
      const response = await recipeServices.getRecipes({
        page,
        limit: rowsPerPage,
        search: search || undefined,
        finishedGood: finishedGoodFilter || undefined
      });

      setRecipes(response.data.data.recipes || []);
      setTotalCount(response.data.data.pagination.total);
      setTotalPages(response.data.data.pagination.totalPages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch recipes',
        variant: "destructive",
      });
    } finally {
      setRecipesLoading(false);
    }
  };

  const fetchFinishedGoods = async () => {
    try {
      // Fetch finished goods from inventory items
      const response = await inventoryServices.getInventoryItems('', {
        limit: 1000,
        type: 'finished_good'
      });
      const items = response.data.data.items || [];
      setFinishedGoods(items.map((item: any) => ({
        _id: item._id,
        name: item.name
      })));
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
        title: "Success",
        description: "Recipe deleted successfully",
        variant: "success",
      });
      fetchRecipes();
      setDeleteDialog({ open: false, recipe: null });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to delete recipe',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedRecipe(null);
    fetchRecipes();
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
        statChips={[
          { label: 'Total Recipes', value: totalCount, variant: 'default' },
        ]}
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
          )
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
            {recipes.map((recipe, index) => (
              <TableRow key={recipe._id}>
                <TableCell className="font-medium text-muted-foreground">
                  {(page - 1) * rowsPerPage + index + 1}
                </TableCell>
                <TableCell>
                  <p className="font-medium">{recipe.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Yield: {recipe.yield?.quantity} {recipe.yield?.unit}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {recipe.finishedGood?.name || '-'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">
                    {recipe.ingredients?.length || 0} items
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(recipe.costPerUnit)}
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {formatTime(recipe.preparationTime)}
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {formatTime(recipe.cookingTime)}
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
            ))}
          </>
        }
        isLoading={recipesLoading}
        emptyState={
          recipes.length === 0
            ? {
              icon: <Package className="h-12 w-12" />,
              title: 'No recipes found',
              description: search || finishedGoodFilter
                ? 'Try adjusting your filters'
                : 'Get started by adding your first recipe',
              action: !search && !finishedGoodFilter ? (
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
        onRowsPerPageChange={setRowsPerPage}
        onRefresh={fetchRecipes}
        cookiePrefix="recipes"
      />

      {/* Recipe Form Modal */}
      <RecipeFormModal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedRecipe(null);
        }}
        recipe={selectedRecipe}
        onSuccess={handleFormSuccess}
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
