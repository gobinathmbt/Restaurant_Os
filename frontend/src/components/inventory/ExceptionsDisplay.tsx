import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Package, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Exception {
  _id: string;
  type: 'damage' | 'missing' | 'excess';
  inventoryItem: {
    _id: string;
    name: string;
  };
  quantity: number;
  unit: string;
  severity?: 'low' | 'medium' | 'high';
  description?: string;
  reportedBy: {
    _id: string;
    name: string;
  };
  reportedAt: string;
  resolved: boolean;
  resolutionAction?: 'confirm_damage' | 'return_to_source' | 'accept_excess' | 'reject_excess';
  resolvedBy?: {
    _id: string;
    name: string;
  };
  resolvedAt?: string;
  resolutionNotes?: string;
}

interface ExceptionsDisplayProps {
  exceptions: Exception[];
  readOnly?: boolean;
}

export default function ExceptionsDisplay({ exceptions, readOnly = false }: ExceptionsDisplayProps) {
  if (!exceptions || exceptions.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No exceptions reported</p>
      </div>
    );
  }

  const getExceptionTypeBadge = (type: string) => {
    const config = {
      damage: { className: 'bg-red-100 text-red-800', label: 'Damage' },
      missing: { className: 'bg-orange-100 text-orange-800', label: 'Missing' },
      excess: { className: 'bg-blue-100 text-blue-800', label: 'Excess' }
    };

    const { className, label } = config[type as keyof typeof config] || { 
      className: 'bg-gray-100 text-gray-800', 
      label: type 
    };

    return <Badge className={className}>{label}</Badge>;
  };

  const getSeverityBadge = (severity?: string) => {
    if (!severity) return null;

    const config = {
      high: { className: 'bg-red-100 text-red-800 border-red-300', label: 'High Severity' },
      medium: { className: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'Medium Severity' },
      low: { className: 'bg-green-100 text-green-800 border-green-300', label: 'Low Severity' }
    };

    const { className, label } = config[severity as keyof typeof config] || { 
      className: 'bg-gray-100 text-gray-800 border-gray-300', 
      label: severity 
    };

    return <Badge variant="outline" className={className}>{label}</Badge>;
  };

  const getResolutionActionLabel = (action?: string) => {
    const labels = {
      confirm_damage: 'Damage Confirmed',
      return_to_source: 'Returned to Source',
      accept_excess: 'Excess Accepted',
      reject_excess: 'Excess Rejected'
    };

    return labels[action as keyof typeof labels] || action;
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'MMM dd, yyyy HH:mm');
    } catch {
      return date;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Exceptions</h3>
        <span className="text-sm text-muted-foreground">
          {exceptions.filter((e) => !e.resolved).length} unresolved of {exceptions.length} total
        </span>
      </div>

      <div className="space-y-3">
        {exceptions.map((exception) => (
          <Card key={exception._id} className="p-4">
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getExceptionTypeBadge(exception.type)}
                    {getSeverityBadge(exception.severity)}
                    {exception.resolved ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Resolved
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Unresolved
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-semibold text-lg">{exception.inventoryItem.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Quantity: <span className="font-semibold">{exception.quantity} {exception.unit}</span>
                  </p>
                </div>
              </div>

              {/* Description */}
              {exception.description && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">{exception.description}</p>
                </div>
              )}

              <Separator />

              {/* Reported By */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Reported by:</span>
                  <span className="font-medium text-foreground">{exception.reportedBy.name}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(exception.reportedAt)}</span>
                </div>
              </div>

              {/* Resolution Details */}
              {exception.resolved && (
                <>
                  <Separator />
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-green-900">Resolution</span>
                      {exception.resolutionAction && (
                        <Badge className="bg-green-100 text-green-800">
                          {getResolutionActionLabel(exception.resolutionAction)}
                        </Badge>
                      )}
                    </div>

                    {exception.resolutionNotes && (
                      <p className="text-sm text-green-800">{exception.resolutionNotes}</p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-green-700">
                      {exception.resolvedBy && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>Resolved by:</span>
                          <span className="font-medium">{exception.resolvedBy.name}</span>
                        </div>
                      )}
                      {exception.resolvedAt && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(exception.resolvedAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
