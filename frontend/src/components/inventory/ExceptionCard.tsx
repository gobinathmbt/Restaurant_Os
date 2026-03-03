import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Package, PackageMinus, PackagePlus } from 'lucide-react';

interface Exception {
  _id: string;
  type: 'damage' | 'missing' | 'excess';
  inventoryItem: {
    _id: string;
    name: string;
  };
  quantity: number;
  unit: string;
  severity: 'low' | 'medium' | 'high';
  description?: string;
  reportedBy: {
    _id: string;
    name: string;
  };
  reportedAt: string;
  resolved: boolean;
}

interface ExceptionCardProps {
  exception: Exception;
  isSelected: boolean;
  onSelect: () => void;
  resolutionAction: string;
  onResolutionActionChange: (action: string) => void;
  resolutionNotes: string;
  onResolutionNotesChange: (notes: string) => void;
}

export default function ExceptionCard({
  exception,
  isSelected,
  onSelect,
  resolutionAction,
  onResolutionActionChange,
  resolutionNotes,
  onResolutionNotesChange,
}: ExceptionCardProps) {
  const getExceptionIcon = () => {
    switch (exception.type) {
      case 'damage':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'missing':
        return <PackageMinus className="h-5 w-5 text-orange-600" />;
      case 'excess':
        return <PackagePlus className="h-5 w-5 text-blue-600" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  const getExceptionTypeBadge = () => {
    const config = {
      damage: { className: 'bg-red-100 text-red-800', label: 'Damage' },
      missing: { className: 'bg-orange-100 text-orange-800', label: 'Missing' },
      excess: { className: 'bg-blue-100 text-blue-800', label: 'Excess' }
    };
    const { className, label } = config[exception.type];
    return <Badge className={className}>{label}</Badge>;
  };

  const getSeverityBadge = () => {
    const config = {
      high: { className: 'bg-red-100 text-red-800', label: 'High' },
      medium: { className: 'bg-yellow-100 text-yellow-800', label: 'Medium' },
      low: { className: 'bg-green-100 text-green-800', label: 'Low' }
    };
    const { className, label } = config[exception.severity];
    return <Badge className={className}>{label}</Badge>;
  };

  const getAvailableActions = () => {
    switch (exception.type) {
      case 'damage':
        return [
          { value: 'confirm_damage', label: 'Confirm Damage', description: 'Item is damaged and will not be added to destination inventory' }
        ];
      case 'missing':
        return [
          { value: 'return_to_source', label: 'Return to Source', description: 'Item was not sent and will remain in source inventory' }
        ];
      case 'excess':
        return [
          { value: 'accept_excess', label: 'Accept Excess', description: 'Accept the extra items and add to destination inventory' },
          { value: 'reject_excess', label: 'Reject Excess', description: 'Reject the extra items, they will not be added to inventory' }
        ];
      default:
        return [];
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const availableActions = getAvailableActions();

  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {getExceptionIcon()}
          <div>
            <div className="flex items-center gap-2 mb-1">
              {getExceptionTypeBadge()}
              {getSeverityBadge()}
            </div>
            <h3 className="font-semibold text-lg">{exception.inventoryItem.name}</h3>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">
            {exception.quantity} {exception.unit}
          </p>
        </div>
      </div>

      {/* Description */}
      {exception.description && (
        <div className="mb-3 p-3 bg-gray-50 rounded border border-gray-200">
          <p className="text-sm text-gray-700">{exception.description}</p>
        </div>
      )}

      {/* Reported Info */}
      <div className="mb-4 text-sm text-muted-foreground">
        <p>
          Reported by <span className="font-medium">{exception.reportedBy.name}</span> on{' '}
          {formatDate(exception.reportedAt)}
        </p>
      </div>

      {/* Resolution Actions - Only show when selected */}
      {isSelected && (
        <div className="space-y-4 pt-4 border-t">
          <div>
            <Label className="text-base font-semibold mb-3 block">Resolution Action</Label>
            <RadioGroup value={resolutionAction} onValueChange={onResolutionActionChange}>
              <div className="space-y-3">
                {availableActions.map((action) => (
                  <div
                    key={action.value}
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                      resolutionAction === action.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <RadioGroupItem value={action.value} id={action.value} className="mt-1" />
                    <div className="flex-1">
                      <Label
                        htmlFor={action.value}
                        className="font-medium cursor-pointer"
                      >
                        {action.label}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {action.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="resolutionNotes" className="text-base font-semibold mb-2 block">
              Resolution Notes (Optional)
            </Label>
            <Textarea
              id="resolutionNotes"
              placeholder="Add any notes about this resolution..."
              value={resolutionNotes}
              onChange={(e) => onResolutionNotesChange(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
