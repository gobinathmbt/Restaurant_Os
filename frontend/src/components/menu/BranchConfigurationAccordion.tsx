import { Lock, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';

interface Branch {
  _id: string;
  name: string;
  code: string;
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

interface BranchConfigurationAccordionProps {
  branch: Branch;
  config: BranchConfig;
  isEditable: boolean;
  onChange: (config: BranchConfig) => void;
  onCopyToOthers: () => void;
}

const SALES_CHANNELS = [
  { value: 'dine_in', label: 'Dine In' },
  { value: 'takeaway', label: 'Takeaway' },
  { value: 'online', label: 'Online' },
];

export default function BranchConfigurationAccordion({
  branch,
  config,
  isEditable,
  onChange,
  onCopyToOthers,
}: BranchConfigurationAccordionProps) {
  const handleFieldChange = (field: keyof BranchConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const toggleChannel = (channel: string) => {
    if (!isEditable) return;
    
    const newChannels = config.channels.includes(channel)
      ? config.channels.filter((c) => c !== channel)
      : [...config.channels, channel];
    
    handleFieldChange('channels', newChannels);
  };

  const formatPrice = (price: number) => {
    return `₹${price.toFixed(2)}`;
  };

  const getAvailabilityStatus = () => {
    if (config.outOfStock) return 'Out of Stock';
    if (!config.isAvailable) return 'Unavailable';
    return 'Available';
  };

  const getAvailabilityBadgeVariant = () => {
    if (config.outOfStock || !config.isAvailable) return 'destructive';
    return 'default';
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value={branch._id}>
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center justify-between w-full pr-4">
            <div className="flex items-center gap-3">
              {!isEditable && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>You don't have permission to edit this branch</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <span className="font-medium">{branch.name}</span>
              {branch.code && (
                <span className="text-sm text-muted-foreground">({branch.code})</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={getAvailabilityBadgeVariant()}>
                {getAvailabilityStatus()}
              </Badge>
              <span className="text-sm font-semibold">{formatPrice(config.price)}</span>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-6 pt-4">
            {/* Copy to Other Branches Button - Only in editable mode */}
            {isEditable && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCopyToOthers}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Other Branches
                </Button>
              </div>
            )}

            {/* Pricing */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Pricing</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`price-${branch._id}`}>Branch Price (₹)</Label>
                  <Input
                    id={`price-${branch._id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={config.price}
                    onChange={(e) =>
                      handleFieldChange('price', parseFloat(e.target.value) || 0)
                    }
                    disabled={!isEditable}
                    className={!isEditable ? 'bg-muted cursor-not-allowed' : ''}
                  />
                </div>
                <div>
                  <Label htmlFor={`taxRate-${branch._id}`}>Tax Rate Override (%)</Label>
                  <Input
                    id={`taxRate-${branch._id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={config.taxRateOverride || ''}
                    onChange={(e) =>
                      handleFieldChange(
                        'taxRateOverride',
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                    disabled={!isEditable}
                    placeholder="Optional"
                    className={!isEditable ? 'bg-muted cursor-not-allowed' : ''}
                  />
                </div>
              </div>
            </div>

            {/* Availability */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Availability</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor={`isAvailable-${branch._id}`}
                    className={!isEditable ? 'text-muted-foreground' : 'cursor-pointer'}
                  >
                    Item is available
                  </Label>
                  <Switch
                    id={`isAvailable-${branch._id}`}
                    checked={config.isAvailable}
                    onCheckedChange={(checked) =>
                      handleFieldChange('isAvailable', checked)
                    }
                    disabled={!isEditable}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor={`outOfStock-${branch._id}`}
                    className={!isEditable ? 'text-muted-foreground' : 'cursor-pointer'}
                  >
                    Out of stock
                  </Label>
                  <Switch
                    id={`outOfStock-${branch._id}`}
                    checked={config.outOfStock}
                    onCheckedChange={(checked) =>
                      handleFieldChange('outOfStock', checked)
                    }
                    disabled={!isEditable}
                  />
                </div>
              </div>
            </div>

            {/* Operations */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Operations</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`prepTime-${branch._id}`}>
                    Preparation Time (minutes)
                  </Label>
                  <Input
                    id={`prepTime-${branch._id}`}
                    type="number"
                    min="0"
                    value={config.preparationTime}
                    onChange={(e) =>
                      handleFieldChange(
                        'preparationTime',
                        parseInt(e.target.value) || 0
                      )
                    }
                    disabled={!isEditable}
                    className={!isEditable ? 'bg-muted cursor-not-allowed' : ''}
                  />
                </div>
                <div className="flex items-center space-x-2 mt-8">
                  <Checkbox
                    id={`requiresKitchen-${branch._id}`}
                    checked={config.requiresKitchen}
                    onCheckedChange={(checked) =>
                      handleFieldChange('requiresKitchen', checked as boolean)
                    }
                    disabled={!isEditable}
                  />
                  <Label
                    htmlFor={`requiresKitchen-${branch._id}`}
                    className={
                      !isEditable
                        ? 'text-muted-foreground'
                        : 'cursor-pointer'
                    }
                  >
                    Requires kitchen
                  </Label>
                </div>
              </div>
            </div>

            {/* Inventory */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Inventory</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`lowStock-${branch._id}`}>
                    Low Stock Threshold
                  </Label>
                  <Input
                    id={`lowStock-${branch._id}`}
                    type="number"
                    min="0"
                    value={config.lowStockThreshold || ''}
                    onChange={(e) =>
                      handleFieldChange(
                        'lowStockThreshold',
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    disabled={!isEditable}
                    placeholder="Optional"
                    className={!isEditable ? 'bg-muted cursor-not-allowed' : ''}
                  />
                </div>
                <div>
                  <Label htmlFor={`displayOrder-${branch._id}`}>Display Order</Label>
                  <Input
                    id={`displayOrder-${branch._id}`}
                    type="number"
                    value={config.displayOrder}
                    onChange={(e) =>
                      handleFieldChange('displayOrder', parseInt(e.target.value) || 0)
                    }
                    disabled={!isEditable}
                    className={!isEditable ? 'bg-muted cursor-not-allowed' : ''}
                  />
                </div>
              </div>
            </div>

            {/* Sales Channels */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Sales Channels</h4>
              <div className="flex flex-wrap gap-4">
                {SALES_CHANNELS.map((channel) => (
                  <div key={channel.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${branch._id}-channel-${channel.value}`}
                      checked={config.channels.includes(channel.value)}
                      onCheckedChange={() => toggleChannel(channel.value)}
                      disabled={!isEditable}
                    />
                    <Label
                      htmlFor={`${branch._id}-channel-${channel.value}`}
                      className={
                        !isEditable
                          ? 'text-muted-foreground'
                          : 'cursor-pointer'
                      }
                    >
                      {channel.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
