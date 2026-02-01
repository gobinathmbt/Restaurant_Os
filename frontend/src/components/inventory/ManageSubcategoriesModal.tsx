import { useState, useEffect } from 'react';
import { GripVertical, Edit, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { categoryServices } from '@/api/services';
import { cn } from '@/lib/utils';

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
  onAddSubcategory: () => void;
  onEditSubcategory: (subcategory: Category) => void;
  onDeleteSubcategory: (subcategory: Category) => void;
  onRefresh: () => void;
}

export default function ManageSubcategoriesModal({
  open,
  onClose,
  parentCategory,
  onAddSubcategory,
  onEditSubcategory,
  onDeleteSubcategory,
  onRefresh
}: ManageSubcategoriesModalProps) {
  const { toast } = useToast();
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [draggedItem, setDraggedItem] = useState<Category | null>(null);

  useEffect(() => {
    if (open && parentCategory) {
      fetchSubcategories();
    }
  }, [open, parentCategory]);

  const fetchSubcategories = async () => {
    if (!parentCategory) return;
    
    try {
      setLoading(true);
      const response = await categoryServices.getCategories({
        parentId: parentCategory._id,
        limit: 1000,
        isActive: true
      });
      
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
      onRefresh();
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
              onClick={onAddSubcategory}
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

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditSubcategory(subcategory)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteSubcategory(subcategory)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
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
  );
}
