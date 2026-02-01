import { useState, useEffect } from 'react';
import { GripVertical, Edit, Trash, Power,Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { categoryServices } from '@/api/services';
import { cn } from '@/lib/utils';
import CategoryFormModal from './CategoryFormModal';
import DeleteConfirmDialog from '@/components/company/DeleteConfirmDialog';

interface Category {
  _id: string;
  name: string;
  description?: string;
  type: string;
  color: string;
  displayOrder: number;
  branchId?: {
    _id: string;
    name: string;
  };
  parent?: {
    _id: string;
    name: string;
  } | string;
  isActive: boolean;
}

interface ManageSubcategoriesModalProps {
  open: boolean;
  onClose: () => void;
  parentCategory: Category | null;
  branchId: string;
}

export default function ManageSubcategoriesModal({
  open,
  onClose,
  parentCategory,
  branchId
}: ManageSubcategoriesModalProps) {
  const { toast } = useToast();
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [draggedItem, setDraggedItem] = useState<Category | null>(null);
  
  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState<Category | null>(null);
  
  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; subcategory: Category | null }>({
    open: false,
    subcategory: null
  });

  useEffect(() => {
    if (open && parentCategory) {
      fetchSubcategories();
    }
  }, [open, parentCategory]);

  const fetchSubcategories = async () => {
    if (!parentCategory) return;
    
    try {
      setLoading(true);
      const response = await categoryServices.getSubcategories(parentCategory._id);
      
      const subs = response.data.data.categories || [];
      // Sort by display order
      subs.sort((a: Category, b: Category) => a.displayOrder - b.displayOrder);
      setSubcategories(subs);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch subcategories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubcategory = () => {
    setSelectedSubcategory(null);
    setIsFormOpen(true);
  };

  const handleEditSubcategory = (subcategory: Category) => {
    setSelectedSubcategory(subcategory);
    setIsFormOpen(true);
  };

  const handleDeleteSubcategory = (subcategory: Category) => {
    setDeleteDialog({ open: true, subcategory });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.subcategory) return;

    try {
      setLoading(true);
      await categoryServices.permanentlyDeleteCategory(deleteDialog.subcategory._id);
      toast({
        title: "Success",
        description: "Subcategory permanently deleted successfully",
        variant: "success",
      });
      setDeleteDialog({ open: false, subcategory: null });
      fetchSubcategories(); // Refresh list
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to delete subcategory',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (subcategory: Category) => {
    try {
      setLoading(true);
      await categoryServices.toggleCategoryStatus(subcategory._id);
      toast({
        title: "Success",
        description: `Subcategory ${subcategory.isActive ? 'deactivated' : 'activated'} successfully`,
        variant: "success",
      });
      fetchSubcategories(); // Refresh list
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to toggle subcategory status',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedSubcategory(null);
    fetchSubcategories(); // Refresh list
  };

  const handleDragStart = (e: React.DragEvent, subcategory: Category) => {
    setDraggedItem(subcategory);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetSubcategory: Category) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem._id === targetSubcategory._id) {
      setDraggedItem(null);
      return;
    }

    const draggedIndex = subcategories.findIndex(s => s._id === draggedItem._id);
    const targetIndex = subcategories.findIndex(s => s._id === targetSubcategory._id);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItem(null);
      return;
    }

    // Reorder locally
    const reordered = [...subcategories];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    // Update display orders
    const updates = reordered.map((sub, index) => ({
      categoryId: sub._id,
      displayOrder: index
    }));

    try {
      setLoading(true);
      await categoryServices.reorderCategories(updates);
      toast({
        title: "Success",
        description: "Subcategories reordered successfully",
        variant: "success",
      });
      setSubcategories(reordered);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to reorder subcategories",
        variant: "destructive",
      });
      // Revert on error
      fetchSubcategories();
    } finally {
      setLoading(false);
      setDraggedItem(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Manage Subcategories - {parentCategory?.name}
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="overflow-y-auto">
            <div className="space-y-2">
              {/* Add Subcategory Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleAddSubcategory}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Subcategory
              </Button>

              {/* Subcategories List */}
              {loading && subcategories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading subcategories...
                </div>
              ) : subcategories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No subcategories yet</p>
                  <p className="text-sm mt-2">Click "Add Subcategory" to create one</p>
                </div>
              ) : (
                <div className="space-y-2 mt-4">
                  {subcategories.map((subcategory) => (
                    <div
                      key={subcategory._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, subcategory)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, subcategory)}
                      className={cn(
                        "flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors group",
                        draggedItem?._id === subcategory._id && "opacity-50"
                      )}
                    >
                      {/* Drag Handle */}
                      <div className="cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                      </div>

                      {/* Color Indicator */}
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: subcategory.color }}
                      />

                      {/* Name and Description */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{subcategory.name}</div>
                        {subcategory.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {subcategory.description}
                          </p>
                        )}
                      </div>

                      {/* Type Badge */}
                      <Badge variant="outline" className="flex-shrink-0">
                        {subcategory.type === 'both' ? 'Both' : 
                         subcategory.type === 'raw_material' ? 'Raw' : 'Finished'}
                      </Badge>

                      {/* Status Badge */}
                      <Badge 
                        variant={subcategory.isActive ? 'default' : 'secondary'}
                        className="flex-shrink-0"
                      >
                        {subcategory.isActive ? 'Active' : 'Inactive'}
                      </Badge>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(subcategory)}
                          title={subcategory.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <Power className={`h-4 w-4 ${subcategory.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditSubcategory(subcategory)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSubcategory(subcategory)}
                          title="Permanently delete"
                        >
                          <Trash className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Form Modal */}
      <CategoryFormModal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedSubcategory(null);
        }}
        category={selectedSubcategory}
        branchId={branchId}
        onSuccess={handleFormSuccess}
        parentCategory={parentCategory}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, subcategory: null })}
        onConfirm={confirmDelete}
        title="Permanently Delete Subcategory"
        description={`Are you sure you want to permanently delete "${deleteDialog.subcategory?.name}"? This action cannot be undone and will remove the subcategory from the database.`}
      />
    </>
  );
}
