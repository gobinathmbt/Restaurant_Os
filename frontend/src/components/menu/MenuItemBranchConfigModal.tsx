import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { menuItemBranchServices } from '@/api/services';

interface MenuItem {
  _id: string;
  name: string;
  basePrice: number;
}

interface Branch {
  _id: string;
  name: string;
}

interface TimeBasedPricing {
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
  price: number;
  isActive: boolean;
}

interface AvailabilitySchedule {
  startTime: string;
  endTime: string;
  days: string[];
}

interface BranchConfig {
  price: number;
  timeBasedPricing: TimeBasedPricing[];
  isAvailable: boolean;
  availability: {
    schedule: AvailabilitySchedule[];
  };
  preparationTime: number;
  requiresKitchen: boolean;
  outOfStock: boolean;
  lowStockThreshold?: number;
  taxRateOverride?: number;
  displayOrder: number;
  channels: string[];
}

interface MenuItemBranchConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem;
  branch: Branch;
  branchConfig?: BranchConfig | null;
  onSuccess: () => void;
}

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const SALES_CHANNELS = [
  { value: 'dine_in', label: 'Dine In' },
  { value: 'takeaway', label: 'Takeaway' },
  { value: 'online', label: 'Online' },
];

export default function MenuItemBranchConfigModal({
  isOpen,
  onClose,
  menuItem,
  branch,
  branchConfig,
  onSuccess,
}: MenuItemBranchConfigModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<BranchConfig>({
    price: menuItem.basePrice,
    timeBasedPricing: [],
    isAvailable: true,
    availability: {
      schedule: [],
    },
    preparationTime: 15,
    requiresKitchen: true,
    outOfStock: false,
    lowStockThreshold: undefined,
    taxRateOverride: undefined,
    displayOrder: 0,
    channels: ['dine_in', 'takeaway', 'online'],
  });

  useEffect(() => {
    if (branchConfig) {
      setFormData({
        price: branchConfig.price || menuItem.basePrice,
        timeBasedPricing: branchConfig.timeBasedPricing || [],
        isAvailable: branchConfig.isAvailable !== undefined ? branchConfig.isAvailable : true,
        availability: branchConfig.availability || { schedule: [] },
        preparationTime: branchConfig.preparationTime || 15,
        requiresKitchen: branchConfig.requiresKitchen !== undefined ? branchConfig.requiresKitchen : true,
        outOfStock: branchConfig.outOfStock || false,
        lowStockThreshold: branchConfig.lowStockThreshold,
        taxRateOverride: branchConfig.taxRateOverride,
        displayOrder: branchConfig.displayOrder || 0,
        channels: branchConfig.channels || ['dine_in', 'takeaway', 'online'],
      });
    } else {
      // Reset form for new branch config
      setFormData({
        price: menuItem.basePrice,
        timeBasedPricing: [],
        isAvailable: true,
        availability: {
          schedule: [],
        },
        preparationTime: 15,
        requiresKitchen: true,
        outOfStock: false,
        lowStockThreshold: undefined,
        taxRateOverride: undefined,
        displayOrder: 0,
        channels: ['dine_in', 'takeaway', 'online'],
      });
    }
  }, [branchConfig, menuItem, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (formData.price < 0) {
      toast({
        title: 'Validation Error',
        description: 'Price must be non-negative',
        variant: 'destructive',
      });
      return;
    }

    if (formData.preparationTime < 0) {
      toast({
        title: 'Validation Error',
        description: 'Preparation time must be positive',
        variant: 'destructive',
      });
      return;
    }

    if (formData.taxRateOverride !== undefined && (formData.taxRateOverride < 0 || formData.taxRateOverride > 100)) {
      toast({
        title: 'Validation Error',
        description: 'Tax rate must be between 0 and 100',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      if (branchConfig) {
        await menuItemBranchServices.updateBranchConfig(menuItem._id, branch._id, formData);
        toast({
          title: 'Success',
          description: 'Branch configuration updated successfully',
          variant: 'success',
        });
      } else {
        await menuItemBranchServices.createBranchConfig(menuItem._id, branch._id, formData);
        toast({
          title: 'Success',
          description: 'Branch configuration created successfully',
          variant: 'success',
        });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description:
          error.response?.data?.message ||
          `Failed to ${branchConfig ? 'update' : 'create'} branch configuration`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Time-based pricing management
  const addTimeBasedPricing = () => {
    setFormData({
      ...formData,
      timeBasedPricing: [
        ...formData.timeBasedPricing,
        {
          name: '',
          startTime: '00:00',
          endTime: '23:59',
          days: [],
          price: formData.price,
          isActive: true,
        },
      ],
    });
  };

  const removeTimeBasedPricing = (index: number) => {
    const newPricing = formData.timeBasedPricing.filter((_, i) => i !== index);
    setFormData({ ...formData, timeBasedPricing: newPricing });
  };

  const updateTimeBasedPricing = (index: number, field: string, value: any) => {
    const newPricing = [...formData.timeBasedPricing];
    newPricing[index] = { ...newPricing[index], [field]: value };
    setFormData({ ...formData, timeBasedPricing: newPricing });
  };

  const toggleTimeBasedPricingDay = (pricingIndex: number, day: string) => {
    const newPricing = [...formData.timeBasedPricing];
    const days = newPricing[pricingIndex].days;
    if (days.includes(day)) {
      newPricing[pricingIndex].days = days.filter((d) => d !== day);
    } else {
      newPricing[pricingIndex].days = [...days, day];
    }
    setFormData({ ...formData, timeBasedPricing: newPricing });
  };

  // Availability schedule management
  const addAvailabilitySchedule = () => {
    setFormData({
      ...formData,
      availability: {
        schedule: [
          ...formData.availability.schedule,
          {
            startTime: '00:00',
            endTime: '23:59',
            days: [],
          },
        ],
      },
    });
  };

  const removeAvailabilitySchedule = (index: number) => {
    const newSchedule = formData.availability.schedule.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      availability: { schedule: newSchedule },
    });
  };

  const updateAvailabilitySchedule = (index: number, field: string, value: any) => {
    const newSchedule = [...formData.availability.schedule];
    newSchedule[index] = { ...newSchedule[index], [field]: value };
    setFormData({
      ...formData,
      availability: { schedule: newSchedule },
    });
  };

  const toggleAvailabilityDay = (scheduleIndex: number, day: string) => {
    const newSchedule = [...formData.availability.schedule];
    const days = newSchedule[scheduleIndex].days;
    if (days.includes(day)) {
      newSchedule[scheduleIndex].days = days.filter((d) => d !== day);
    } else {
      newSchedule[scheduleIndex].days = [...days, day];
    }
    setFormData({
      ...formData,
      availability: { schedule: newSchedule },
    });
  };

  // Sales channels management
  const toggleChannel = (channel: string) => {
    if (formData.channels.includes(channel)) {
      setFormData({
        ...formData,
        channels: formData.channels.filter((c) => c !== channel),
      });
    } else {
      setFormData({
        ...formData,
        channels: [...formData.channels, channel],
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {branchConfig ? 'Edit' : 'Configure'} Branch Settings - {menuItem.name} ({branch.name})
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="branch-config-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="font-semibold">Pricing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Branch Price (₹) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="14.99"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Base price: ₹{menuItem.basePrice}
                  </p>
                </div>
              </div>
            </div>

            {/* Time-Based Pricing */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Time-Based Pricing</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTimeBasedPricing}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Time-Based Price
                </Button>
              </div>
              {formData.timeBasedPricing.map((pricing, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={pricing.name}
                      onChange={(e) =>
                        updateTimeBasedPricing(index, 'name', e.target.value)
                      }
                      placeholder="Pricing name (e.g., Happy Hour)"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTimeBasedPricing(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={pricing.startTime}
                        onChange={(e) =>
                          updateTimeBasedPricing(index, 'startTime', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={pricing.endTime}
                        onChange={(e) =>
                          updateTimeBasedPricing(index, 'endTime', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label>Price (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={pricing.price}
                        onChange={(e) =>
                          updateTimeBasedPricing(
                            index,
                            'price',
                            parseFloat(e.target.value) || 0
                          )
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Days</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <div key={day} className="flex items-center space-x-2">
                          <Checkbox
                            id={`pricing-${index}-${day}`}
                            checked={pricing.days.includes(day)}
                            onCheckedChange={() =>
                              toggleTimeBasedPricingDay(index, day)
                            }
                          />
                          <Label
                            htmlFor={`pricing-${index}-${day}`}
                            className="cursor-pointer text-sm capitalize"
                          >
                            {day.slice(0, 3)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`pricing-active-${index}`}
                      checked={pricing.isActive}
                      onCheckedChange={(checked) =>
                        updateTimeBasedPricing(index, 'isActive', checked)
                      }
                    />
                    <Label
                      htmlFor={`pricing-active-${index}`}
                      className="cursor-pointer"
                    >
                      Active
                    </Label>
                  </div>
                </div>
              ))}
            </div>

            {/* Availability */}
            <div className="space-y-4">
              <h3 className="font-semibold">Availability</h3>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isAvailable"
                  checked={formData.isAvailable}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isAvailable: checked as boolean })
                  }
                />
                <Label htmlFor="isAvailable" className="cursor-pointer">
                  Item is available
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="outOfStock"
                  checked={formData.outOfStock}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, outOfStock: checked as boolean })
                  }
                />
                <Label htmlFor="outOfStock" className="cursor-pointer">
                  Out of stock
                </Label>
              </div>
            </div>

            {/* Availability Schedule */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Availability Schedule</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAvailabilitySchedule}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Schedule
                </Button>
              </div>
              {formData.availability.schedule.map((schedule, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={schedule.startTime}
                          onChange={(e) =>
                            updateAvailabilitySchedule(
                              index,
                              'startTime',
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={schedule.endTime}
                          onChange={(e) =>
                            updateAvailabilitySchedule(
                              index,
                              'endTime',
                              e.target.value
                            )
                          }
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAvailabilitySchedule(index)}
                      className="mt-6"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div>
                    <Label>Days</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <div key={day} className="flex items-center space-x-2">
                          <Checkbox
                            id={`schedule-${index}-${day}`}
                            checked={schedule.days.includes(day)}
                            onCheckedChange={() =>
                              toggleAvailabilityDay(index, day)
                            }
                          />
                          <Label
                            htmlFor={`schedule-${index}-${day}`}
                            className="cursor-pointer text-sm capitalize"
                          >
                            {day.slice(0, 3)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Operations */}
            <div className="space-y-4">
              <h3 className="font-semibold">Operations</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="preparationTime">Preparation Time (minutes) *</Label>
                  <Input
                    id="preparationTime"
                    type="number"
                    min="0"
                    value={formData.preparationTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        preparationTime: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="15"
                    required
                  />
                </div>
                <div className="flex items-center space-x-2 mt-8">
                  <Checkbox
                    id="requiresKitchen"
                    checked={formData.requiresKitchen}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        requiresKitchen: checked as boolean,
                      })
                    }
                  />
                  <Label htmlFor="requiresKitchen" className="cursor-pointer">
                    Requires kitchen
                  </Label>
                </div>
              </div>
            </div>

            {/* Inventory */}
            <div className="space-y-4">
              <h3 className="font-semibold">Inventory</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    min="0"
                    value={formData.lowStockThreshold || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        lowStockThreshold: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            {/* Tax & Display */}
            <div className="space-y-4">
              <h3 className="font-semibold">Tax & Display</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="taxRateOverride">Tax Rate Override (%)</Label>
                  <Input
                    id="taxRateOverride"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.taxRateOverride || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        taxRateOverride: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="displayOrder">Display Order</Label>
                  <Input
                    id="displayOrder"
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        displayOrder: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Sales Channels */}
            <div className="space-y-4">
              <h3 className="font-semibold">Sales Channels</h3>
              <div className="flex flex-wrap gap-4">
                {SALES_CHANNELS.map((channel) => (
                  <div key={channel.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`channel-${channel.value}`}
                      checked={formData.channels.includes(channel.value)}
                      onCheckedChange={() => toggleChannel(channel.value)}
                    />
                    <Label
                      htmlFor={`channel-${channel.value}`}
                      className="cursor-pointer"
                    >
                      {channel.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" form="branch-config-form" disabled={loading}>
            {loading
              ? 'Saving...'
              : branchConfig
              ? 'Update Configuration'
              : 'Create Configuration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
