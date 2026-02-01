import { useState } from 'react';
import { ChevronDown, ChevronRight, Edit, Trash2, FolderPlus, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Category {
  _id: string;
  name: string;
  description?: string;
  type: string;
  color: string;
  displayOrder: number;
  parent?: {
    _id: string;
    name: string;
  } | string;
  isActive: boolean;
  subcategories?: Category[];
}

interface CategoryTreeViewProps {
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onAddSubcategory: (category: Category) => void;
  onReorder: (updates: Array<{ categoryId: string; displayOrder: number }>) => void;
}

interface CategoryNodeProps {
  category: Category;
  level: number;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onAddSubcategory: (category: Category) => void;
  onDragStart: (e: React.DragEvent, category: Category, level: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetCategory: Category, level: number) => void;
  isDragging: boolean;
}

const CategoryNode = ({
  category,
  level,
  onEdit,
  onDelete,
  onAddSubcategory,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging
}: CategoryNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasSubcategories = category.subcategories && category.subcategories.length > 0;

  return (
    <div className="w-full">
      <div
        draggable
        onDragStart={(e) => onDragStart(e, category, level)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, category, level)}
        className={cn(
          "flex items-center gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors group",
          isDragging && "opacity-50",
          level > 0 && "ml-8"
        )}
        style={{ marginLeft: level > 0 ? `${level * 2}rem` : 0 }}
      >
        {/* Drag Handle */}
        <div className="cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Expand/Collapse Button */}
        {hasSubcategories ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <div className="w-6" />
        )}

        {/* Color Indicator */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.color }}
        />

        {/* Category Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{category.name}</span>
            {hasSubcategories && (
              <Badge variant="secondary" className="text-xs">
                {category.subcategories!.length}
              </Badge>
            )}
          </div>
          {category.description && (
            <p className="text-xs text-muted-foreground truncate">
              {category.description}
            </p>
          )}
        </div>

        {/* Type Badge */}
        <Badge variant="outline" className="flex-shrink-0">
          {category.type === 'both' ? 'Both' : 
           category.type === 'raw_material' ? 'Raw Material' : 'Finished Good'}
        </Badge>

        {/* Status Badge */}
        <Badge 
          variant={category.isActive ? 'default' : 'secondary'}
          className="flex-shrink-0"
        >
          {category.isActive ? 'Active' : 'Inactive'}
        </Badge>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {level === 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddSubcategory(category)}
              title="Add subcategory"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(category)}
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(category)}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Subcategories */}
      {hasSubcategories && isExpanded && (
        <div className="mt-2 space-y-2">
          {category.subcategories!.map((subcategory) => (
            <CategoryNode
              key={subcategory._id}
              category={subcategory}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSubcategory={onAddSubcategory}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              isDragging={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function CategoryTreeView({
  categories,
  onEdit,
  onDelete,
  onAddSubcategory,
  onReorder
}: CategoryTreeViewProps) {
  const [draggedItem, setDraggedItem] = useState<{ category: Category; level: number } | null>(null);

  const handleDragStart = (e: React.DragEvent, category: Category, level: number) => {
    setDraggedItem({ category, level });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetCategory: Category, targetLevel: number) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.category._id === targetCategory._id) {
      setDraggedItem(null);
      return;
    }

    // Only allow reordering within the same level (same parent)
    if (draggedItem.level !== targetLevel) {
      setDraggedItem(null);
      return;
    }

    // Get all categories at the same level
    const sameLevelCategories = categories.filter(cat => {
      const draggedParent = typeof draggedItem.category.parent === 'object' 
        ? draggedItem.category.parent?._id 
        : draggedItem.category.parent;
      const catParent = typeof cat.parent === 'object' 
        ? cat.parent?._id 
        : cat.parent;
      return (draggedParent || null) === (catParent || null);
    });

    // Find indices
    const draggedIndex = sameLevelCategories.findIndex(c => c._id === draggedItem.category._id);
    const targetIndex = sameLevelCategories.findIndex(c => c._id === targetCategory._id);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItem(null);
      return;
    }

    // Reorder
    const reordered = [...sameLevelCategories];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    // Create updates with new display orders
    const updates = reordered.map((cat, index) => ({
      categoryId: cat._id,
      displayOrder: index
    }));

    onReorder(updates);
    setDraggedItem(null);
  };

  if (categories.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No categories found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {categories.map((category) => (
        <CategoryNode
          key={category._id}
          category={category}
          level={0}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddSubcategory={onAddSubcategory}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          isDragging={draggedItem?.category._id === category._id}
        />
      ))}
    </div>
  );
}
