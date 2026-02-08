import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { menuCategoryServices } from '@/api/services';
import { useAuth } from '@/contexts/AuthContext';
import BranchSearch from '@/components/common/BranchSearch';

interface MenuCategory {
  _id: string;
  name: string;
  description?: string;
  branchIds: string[] | any[];
  displayOrder: number;
  isActive: boolean;
  color: string;
  icon?: string;
}

interface MenuCategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: MenuCategory | null;
  onSuccess: () => void;
}

export default function MenuCategoryFormModal({
  isOpen,
  onClose,
  category,
  onSuccess,
}: MenuCategoryFormModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    displayOrder: 0,
    color: '#6366f1',
    icon: '',
  });

  // Determine user's branch access
  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');
  const isMultiBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) > 1;
  const isSingleBranchAdmin = user?.role === 'company_admin' && (user?.branchIds?.length || 0) === 1;

  useEffect(() => {
    if (category && isOpen) {
      setFormData({
        name: category.name || '',
        description: category.description || '',
        displayOrder: category.displayOrder || 0,
        color: category.color || '#6366f1',
        icon: category.icon || '',
      });

      // Set selected branches
      if (category.branchIds) {
        const branchIdStrings = category.branchIds.map((b: any) =>
          typeof b === 'string' ? b : b._id
        );
        setSelectedBranches(branchIdStrings);
      } else {
        setSelectedBranches([]);
      }
    } else if (!category && isOpen) {
      resetForm();
    }
  }, [category, isOpen]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      displayOrder: 0,
      color: '#6366f1',
      icon: '',
    });
    setSelectedBranches([]);
  };

  const handleBranchesChange = (branchIds: string[]) => {
    setSelectedBranches(branchIds);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return false;
    }

    if (formData.name.trim().length > 100) {
      toast({
        title: 'Validation Error',
        description: 'Category name must not exceed 100 characters',
        variant: 'destructive',
      });
      return false;
    }

    if (formData.description && formData.description.trim().length > 500) {
      toast({
        title: 'Validation Error',
        description: 'Description must not exceed 500 characters',
        variant: 'destructive',
      });
      return false;
    }

    if (selectedBranches.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'At least one branch must be selected',
        variant: 'destructive',
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
        branchIds: selectedBranches,
        displayOrder: formData.displayOrder,
        color: formData.color,
        icon: formData.icon.trim() || undefined,
      };

      if (category) {
        await menuCategoryServices.updateMenuCategory(category._id, submitData);
        toast({
          title: 'Success',
          variant: 'success',
          description: 'Category updated successfully',
        });
      } else {
        await menuCategoryServices.createMenuCategory(submitData);
        toast({
          title: 'Success',
          variant: 'success',
          description: 'Category created successfully',
        });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      // Handle branch removal validation errors (400 Bad Request)
      if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || '';
        
        // Check if this is a branch removal validation error
        if (errorMessage.includes('Cannot remove branch') && errorMessage.includes('menu items are using this category')) {
          toast({
            title: 'Cannot Remove Branch',
            description: errorMessage,
            variant: 'destructive',
          });
          return; // Prevent form submission
        }
      }

      // Handle other errors
      toast({
        title: 'Error',
        description:
          error.response?.data?.message || `Failed to ${category ? 'update' : 'create'} category`,
        variant: 'destructive',
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{category ? 'Edit Menu Category' : 'Add Menu Category'}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="menu-category-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Appetizers, Main Course, Desserts"
                required
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.name.length}/100 characters
              </p>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.description.length}/500 characters
              </p>
            </div>

            <div>
              <Label>Branches *</Label>
              <BranchSearch
                selectedBranchIds={selectedBranches}
                onBranchesChange={handleBranchesChange}
                disabled={loading}
                showSelectAll={isSuperAdmin}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Select branches where this category will be available
              </p>
            </div>

            <div>
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                value={formData.displayOrder}
                onChange={(e) =>
                  setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })
                }
                placeholder="0"
                min={0}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lower numbers appear first in the menu
              </p>
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
              <p className="text-xs text-muted-foreground mt-1">
                This color will be used to identify the category in the menu
              </p>
            </div>

            <div>
              <Label htmlFor="icon">Icon (Optional)</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="e.g., utensils, pizza, coffee"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Icon name from Lucide icons library (optional)
              </p>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="menu-category-form" disabled={loading}>
            {loading ? 'Saving...' : category ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
