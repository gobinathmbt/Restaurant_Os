import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Clock } from 'lucide-react';

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
  isAvailable: boolean;
  preparationTime: number;
  requiresKitchen: boolean;
  outOfStock: boolean;
  lowStockThreshold?: number;
  taxRateOverride?: number;
  displayOrder: number;
  channels: string[];
  timeBasedPricing: TimeBasedPricing[];
  availability: {
    schedule: AvailabilitySchedule[];
  };
}

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface BranchConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: Branch;
  config: BranchConfig;
  onChange: (config: BranchConfig) => void;
  isEditable?: boolean;
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

const CHANNELS = [
  { value: 'dine_in', label: 'Dine In' },
  { value: 'takeaway', label: 'Takeaway' },
  { value: 'online', label: 'Online' },
  { value: 'delivery', label: 'Delivery' },
];

export default function BranchConfigModal({
  isOpen,
  onClose,
  branch,
  config,
  onChange,
  isEditable = true,
}: BranchConfigModalProps) {
  const [localConfig, setLocalConfig] = useState<BranchConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config, isOpen]);

  const handleSave = () => {
    onChange(localConfig);
    onClose();
  };

  const handleChannelToggle = (channel: string) => {
    const newChannels = localConfig.channels.includes(channel)
      ? localConfig.channels.filter((c) => c !== channel)
      : [...localConfig.channels, channel];
    setLocalConfig({ ...localConfig, channels: newChannels });
  };

  const addTimeBasedPricing = () => {
    setLocalConfig({
      ...localConfig,
      timeBasedPricing: [
        ...localConfig.timeBasedPricing,
        {
          name: '',
          startTime: '09:00',
          endTime: '17:00',
          days: [],
          price: localConfig.price,
          isActive: true,
        },
      ],
    });
  };

  const removeTimeBasedPricing = (index: number) => {
    setLocalConfig({
      ...localConfig,
      timeBasedPricing: localConfig.timeBasedPricing.filter((_, i) => i !== index),
    });
  };

  const updateTimeBasedPricing = (index: number, field: string, value: any) => {
    const newPricing = [...localConfig.timeBasedPricing];
    newPricing[index] = { ...newPricing[index], [field]: value };
    setLocalConfig({ ...localConfig, timeBasedPricing: newPricing });
  };

  const toggleTimeBasedPricingDay = (pricingIndex: number, day: string) => {
    const pricing = localConfig.timeBasedPricing[pricingIndex];
    const newDays = pricing.days.includes(day)
      ? pricing.days.filter((d) => d !== day)
      : [...pricing.days, day];
    updateTimeBasedPricing(pricingIndex, 'days', newDays);
  };

  const addAvailabilitySchedule = () => {
    setLocalConfig({
      ...localConfig,
      availability: {
        schedule: [
          ...localConfig.availability.schedule,
          {
            startTime: '09:00',
            endTime: '22:00',
            days: [],
          },
        ],
      },
    });
  };

  const removeAvailabilitySchedule = (index: number) => {
    setLocalConfig({
      ...localConfig,
      availability: {
        schedule: localConfig.availability.schedule.filter((_, i) => i !== index),
      },
    });
  };

  const updateAvailabilitySchedule = (index: number, field: string, value: any) => {
    const newSchedule = [...localConfig.availability.schedule];
    newSchedule[index] = { ...newSchedule[index], [field]: value };
    setLocalConfig({
      ...localConfig,
      availability: { schedule: newSchedule },
    });
  };

  const toggleAvailabilityDay = (scheduleIndex: number, day: string) => {
    const schedule = localConfig.availability.schedule[scheduleIndex];
    const newDays = schedule.days.includes(day)
      ? schedule.days.filter((d) => d !== day)
      : [...schedule.days, day];
    updateAvailabilitySchedule(scheduleIndex, 'days', newDays);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Configure: {branch.name} ({branch.code})
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Basic Configuration */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Basic Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Price (₹)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={localConfig.price}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={!isEditable}
                  />
                </div>
                <div>
                  <Label htmlFor="preparationTime">Preparation Time (min)</Label>
                  <Input
                    id="preparationTime"
                    type="number"
                    min="0"
                    value={localConfig.preparationTime}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        preparationTime: parseInt(e.target.value) || 0,
                      })
                    }
                    disabled={!isEditable}
                  />
                </div>
                <div>
                  <Label htmlFor="displayOrder">Display Order</Label>
                  <Input
                    id="displayOrder"
                    type="number"
                    min="0"
                    value={localConfig.displayOrder}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        displayOrder: parseInt(e.target.value) || 0,
                      })
                    }
                    disabled={!isEditable}
                  />
                </div>
                <div>
                  <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    min="0"
                    value={localConfig.lowStockThreshold || ''}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        lowStockThreshold: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="Optional"
                    disabled={!isEditable}
                  />
                </div>
                <div>
                  <Label htmlFor="taxRateOverride">Tax Rate Override (%)</Label>
                  <Input
                    id="taxRateOverride"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={localConfig.taxRateOverride || ''}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        taxRateOverride: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="Optional"
                    disabled={!isEditable}
                  />
                </div>
              </div>
            </div>

            {/* Status Toggles */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Status</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isAvailable"
                    checked={localConfig.isAvailable}
                    onCheckedChange={(checked) =>
                      setLocalConfig({
                        ...localConfig,
                        isAvailable: checked as boolean,
                      })
                    }
                    disabled={!isEditable}
                  />
                  <Label htmlFor="isAvailable" className="cursor-pointer">
                    Available
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requiresKitchen"
                    checked={localConfig.requiresKitchen}
                    onCheckedChange={(checked) =>
                      setLocalConfig({
                        ...localConfig,
                        requiresKitchen: checked as boolean,
                      })
                    }
                    disabled={!isEditable}
                  />
                  <Label htmlFor="requiresKitchen" className="cursor-pointer">
                    Requires Kitchen
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="outOfStock"
                    checked={localConfig.outOfStock}
                    onCheckedChange={(checked) =>
                      setLocalConfig({
                        ...localConfig,
                        outOfStock: checked as boolean,
                      })
                    }
                    disabled={!isEditable}
                  />
                  <Label htmlFor="outOfStock" className="cursor-pointer">
                    Out of Stock
                  </Label>
                </div>
              </div>
            </div>

            {/* Channels */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Sales Channels</h3>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((channel) => (
                  <Badge
                    key={channel.value}
                    variant={
                      localConfig.channels.includes(channel.value)
                        ? 'default'
                        : 'outline'
                    }
                    className="cursor-pointer"
                    onClick={() => isEditable && handleChannelToggle(channel.value)}
                  >
                    {channel.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Time-Based Pricing */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Time-Based Pricing</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTimeBasedPricing}
                  disabled={!isEditable}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
              {localConfig.timeBasedPricing.map((pricing, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={pricing.name}
                      onChange={(e) =>
                        updateTimeBasedPricing(index, 'name', e.target.value)
                      }
                      placeholder="Pricing name (e.g., Lunch Special)"
                      className="flex-1"
                      disabled={!isEditable}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTimeBasedPricing(index)}
                      disabled={!isEditable}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Start Time</Label>
                      <Input
                        type="time"
                        value={pricing.startTime}
                        onChange={(e) =>
                          updateTimeBasedPricing(index, 'startTime', e.target.value)
                        }
                        disabled={!isEditable}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">End Time</Label>
                      <Input
                        type="time"
                        value={pricing.endTime}
                        onChange={(e) =>
                          updateTimeBasedPricing(index, 'endTime', e.target.value)
                        }
                        disabled={!isEditable}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Price (₹)</Label>
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
                        disabled={!isEditable}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Days</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {DAYS_OF_WEEK.map((day) => (
                        <Badge
                          key={day.value}
                          variant={
                            pricing.days.includes(day.value) ? 'default' : 'outline'
                          }
                          className="cursor-pointer text-xs"
                          onClick={() =>
                            isEditable && toggleTimeBasedPricingDay(index, day.value)
                          }
                        >
                          {day.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`pricing-active-${index}`}
                      checked={pricing.isActive}
                      onCheckedChange={(checked) =>
                        updateTimeBasedPricing(index, 'isActive', checked as boolean)
                      }
                      disabled={!isEditable}
                    />
                    <Label
                      htmlFor={`pricing-active-${index}`}
                      className="cursor-pointer text-sm"
                    >
                      Active
                    </Label>
                  </div>
                </div>
              ))}
            </div>

            {/* Availability Schedule */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Availability Schedule</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAvailabilitySchedule}
                  disabled={!isEditable}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
              {localConfig.availability.schedule.map((schedule, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Schedule {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAvailabilitySchedule(index)}
                      disabled={!isEditable}
                      className="ml-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Start Time</Label>
                      <Input
                        type="time"
                        value={schedule.startTime}
                        onChange={(e) =>
                          updateAvailabilitySchedule(index, 'startTime', e.target.value)
                        }
                        disabled={!isEditable}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">End Time</Label>
                      <Input
                        type="time"
                        value={schedule.endTime}
                        onChange={(e) =>
                          updateAvailabilitySchedule(index, 'endTime', e.target.value)
                        }
                        disabled={!isEditable}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Days</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {DAYS_OF_WEEK.map((day) => (
                        <Badge
                          key={day.value}
                          variant={
                            schedule.days.includes(day.value) ? 'default' : 'outline'
                          }
                          className="cursor-pointer text-xs"
                          onClick={() =>
                            isEditable && toggleAvailabilityDay(index, day.value)
                          }
                        >
                          {day.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!isEditable}>
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
