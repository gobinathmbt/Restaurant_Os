import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { categoryServices } from '@/api/services';

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
}

interface CategoryFormModalProps {
  open: boolean;
  onClose: () => void;
  category: Category | null;
  branchId: string;
  onSuccess: () => void;
  parentCategory?: Category | null;
}

export default function CategoryFormModal({
  open,
  onClose,
  category,
  branchId,
  onSuccess,
  parentCategory
}: CategoryFormModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'both',
    color: '#6366f1'
  });

  useEffect(() => {
    if (category && open) {
      setFormData({
        name: category.name || '',
        description: category.description || '',
        type: category.type || 'both',
        color: category.color || '#6366f1'
      });
    } else if (!category && open) {
      resetForm();
    }
  }, [category, open, parentCategory]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'both',
      color: '#6366f1'
    });
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name is required",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const submitData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        branchId,
        type: formData.type,
        color: formData.color,
        parent: parentCategory?._id || null
      };

      if (category) {
        await categoryServices.updateCategory(category._id, submitData);
        toast({
          title: "Success",
          description: "Category updated successfully",
          variant: "success",
        });
      } else {
        await categoryServices.createCategory(submitData);
        toast({
          title: "Success",
          description: parentCategory 
            ? `Subcategory added to ${parentCategory.name}` 
            : "Category created successfully",
          variant: "success",
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || `Failed to ${category ? 'update' : 'create'} category`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const colorOptions = [
    { value: '#6366f1', label: 'Indigo' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#ef4444', label: 'Red' },
    { value: '#f97316', label: 'Orange' },
    { value: '#eab308', label: 'Yellow' },
    { value: '#22c55e', label: 'Green' },
    { value: '#14b8a6', label: 'Teal' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#3b82f6', label: 'Blue' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {category 
              ? 'Edit Category' 
              : parentCategory 
                ? `Add Subcategory to ${parentCategory.name}` 
                : 'Add Category'}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
            {parentCategory && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Parent Category: <span className="font-medium text-foreground">{parentCategory.name}</span>
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Vegetables, Dairy, Meat"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both (Raw Material & Finished Good)</SelectItem>
                  <SelectItem value="raw_material">Raw Material Only</SelectItem>
                  <SelectItem value="finished_good">Finished Good Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Select
                  value={formData.color}
                  onValueChange={(value) => setFormData({ ...formData, color: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: option.value }}
                          />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" disabled={loading}>
            {loading ? 'Saving...' : category ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
