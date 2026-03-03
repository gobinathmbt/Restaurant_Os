import { X, AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ItemImpact {
  inventoryItem: {
    _id: string;
    name: string;
  };
  sentQuantity: number;
  exceptions: Array<{
    type: string;
    quantity: number;
    resolutionAction: string;
  }>;
  netSourceChange: number;
  netDestinationChange: number;
  currentSourceQuantity: number;
  currentDestinationQuantity: number;
  projectedSourceQuantity: number;
  projectedDestinationQuantity: number;
}

interface ImpactPreview {
  transferId: string;
  sourceLocation: {
    _id: string;
    name: string;
  };
  destinationLocation: {
    _id: string;
    name: string;
  };
  itemImpacts: ItemImpact[];
  summary: {
    totalSourceReduction: number;
    totalDestinationAddition: number;
    itemsAffected: number;
  };
}

interface ImpactPreviewModalProps {
  impactPreview: ImpactPreview;
  onClose: () => void;
}

export default function ImpactPreviewModal({
  impactPreview,
  onClose,
}: ImpactPreviewModalProps) {
  const formatQuantity = (qty: number) => {
    return qty.toFixed(2);
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getChangeBadge = (change: number) => {
    if (change > 0) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <TrendingUp className="h-3 w-3 mr-1" />
          +{formatQuantity(change)}
        </Badge>
      );
    }
    if (change < 0) {
      return (
        <Badge className="bg-red-100 text-red-800">
          <TrendingDown className="h-3 w-3 mr-1" />
          {formatQuantity(change)}
        </Badge>
      );
    }
    return <Badge className="bg-gray-100 text-gray-800">No change</Badge>;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-semibold">Inventory Impact Preview</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Review the projected inventory changes before completion
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-blue-700 font-medium">Source Location</p>
                  <p className="text-sm font-semibold text-blue-900">{impactPreview.sourceLocation.name}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-blue-900">
                -{formatQuantity(impactPreview.summary.totalSourceReduction)}
              </p>
              <p className="text-xs text-blue-700 mt-1">Total reduction</p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-green-700 font-medium">Destination Location</p>
                  <p className="text-sm font-semibold text-green-900">{impactPreview.destinationLocation.name}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-green-900">
                +{formatQuantity(impactPreview.summary.totalDestinationAddition)}
              </p>
              <p className="text-xs text-green-700 mt-1">Total addition</p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-purple-700 font-medium">Items Affected</p>
                  <p className="text-sm font-semibold text-purple-900">Transfer Impact</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-purple-900">
                {impactPreview.summary.itemsAffected}
              </p>
              <p className="text-xs text-purple-700 mt-1">Items in transfer</p>
            </div>
          </div>

          {/* Warning Message */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-900">Important: Inventory Changes</p>
              <p className="text-sm text-yellow-800 mt-1">
                The inventory quantities shown below will be applied when the destination admin completes this transfer.
                Please review carefully to ensure all exception resolutions are correct.
              </p>
            </div>
          </div>

          {/* Impact Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Item</TableHead>
                  <TableHead className="font-semibold text-center">Sent Qty</TableHead>
                  <TableHead className="font-semibold text-center">Exceptions</TableHead>
                  <TableHead className="font-semibold text-center">Source Change</TableHead>
                  <TableHead className="font-semibold text-center">Destination Change</TableHead>
                  <TableHead className="font-semibold text-center">Projected Balances</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {impactPreview.itemImpacts.map((impact) => (
                  <TableRow key={impact.inventoryItem._id}>
                    <TableCell className="font-medium">
                      {impact.inventoryItem.name}
                    </TableCell>
                    <TableCell className="text-center">
                      {formatQuantity(impact.sentQuantity)}
                    </TableCell>
                    <TableCell>
                      {impact.exceptions.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {impact.exceptions.map((ex, idx) => (
                            <div key={idx} className="text-xs">
                              <Badge className="text-xs">
                                {ex.type}: {formatQuantity(ex.quantity)}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {getChangeBadge(impact.netSourceChange)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getChangeBadge(impact.netDestinationChange)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Source:</span>
                          <span className="font-medium">
                            {formatQuantity(impact.currentSourceQuantity)} → {' '}
                            <span className={getChangeColor(impact.netSourceChange)}>
                              {formatQuantity(impact.projectedSourceQuantity)}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Dest:</span>
                          <span className="font-medium">
                            {formatQuantity(impact.currentDestinationQuantity)} → {' '}
                            <span className={getChangeColor(impact.netDestinationChange)}>
                              {formatQuantity(impact.projectedDestinationQuantity)}
                            </span>
                          </span>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <Button onClick={onClose}>
            I Understand
          </Button>
        </div>
      </div>
    </div>
  );
}
