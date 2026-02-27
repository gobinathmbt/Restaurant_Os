import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { inventoryServices } from '@/api/services';
import { CheckCircle, AlertTriangle, Package, Trash2, Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ExecutionStage {
  stage: string;
  timestamp: string;
  updatedBy?: {
    _id: string;
    name: string;
  };
  updatedByName?: string;
  notes?: string;
}

interface StockTransfer {
  _id: string;
  transferNumber: string;
  destinationLocation: {
    _id: string;
    name: string;
  };
  sourceLocation: {
    _id: string;
    name: string;
  };
  status: string;
  priority: string;
  executionStages?: ExecutionStage[];
  items: Array<{
    inventoryItem: {
      _id: string;
      name: string;
    };
    sentQuantity: number;
    unit: string;
    notes?: string;
  }>;
  requestDate: string;
  expectedDeliveryDate?: string;
  notes?: string;
}

interface Exception {
  inventoryItem: string;
  itemName: string;
  exceptionType: 'damaged' | 'missing' | 'excess';
  quantity: number;
  notes: string;
}

interface StockAcceptanceModalProps {
  open: boolean;
  onClose: () => void;
  transfer: StockTransfer | null;
  onSuccess: () => void;
}

export default function StockAcceptanceModal({
  open,
  onClose,
  transfer,
  onSuccess
}: StockAcceptanceModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [acceptanceNotes, setAcceptanceNotes] = useState('');

  useEffect(() => {
    if (transfer && open) {
      setExceptions([]);
      setAcceptanceNotes('');
    }
  }, [transfer, open]);

  if (!transfer) return null;

  const addException = () => {
    if (transfer.items.length === 0) return;
    
    setExceptions([
      ...exceptions,
      {
        inventoryItem: transfer.items[0].inventoryItem._id,
        itemName: transfer.items[0].inventoryItem.name,
        exceptionType: 'damaged',
        quantity: 0,
        notes: ''
      }
    ]);
  };

  const removeException = (index: number) => {
    setExceptions(exceptions.filter((_, i) => i !== index));
  };

  const updateException = (index: number, field: keyof Exception, value: any) => {
    const updated = [...exceptions];
    updated[index] = { ...updated[index], [field]: value };
    
    // Update item name when item changes
    if (field === 'inventoryItem') {
      const item = transfer.items.find(i => i.inventoryItem._id === value);
      if (item) {
        updated[index].itemName = item.inventoryItem.name;
      }
    }
    
    setExceptions(updated);
  };

  const handleAccept = async () => {
    // Validate exceptions
    for (const exception of exceptions) {
      if (exception.quantity <= 0) {
        toast({
          title: "Validation Error",
          description: "Exception quantity must be greater than 0",
          variant: "destructive",
        });
        return;
      }
      if (!exception.notes.trim()) {
        toast({
          title: "Validation Error",
          description: "Exception notes are required",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setLoading(true);

      await inventoryServices.acceptStock(transfer._id, {
        exceptions: exceptions.length > 0 ? exceptions.map(e => ({
          inventoryItem: e.inventoryItem,
          exceptionType: e.exceptionType,
          quantity: e.quantity,
          notes: e.notes
        })) : undefined,
        notes: acceptanceNotes.trim() || undefined
      });

      toast({
        title: "Success",
        description: "Stock accepted successfully",
        variant: "success",
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to accept stock",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getExceptionTypeBadge = (type: string) => {
    const config: Record<string, { className: string; label: string }> = {
      damaged: { className: 'bg-red-100 text-red-800', label: 'Damaged' },
      missing: { className: 'bg-orange-100 text-orange-800', label: 'Missing' },
      excess: { className: 'bg-blue-100 text-blue-800', label: 'Excess' }
    };
    const c = config[type] || { className: 'bg-gray-100 text-gray-800', label: type };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  const currentStage = transfer.executionStages && transfer.executionStages.length > 0
    ? transfer.executionStages[transfer.executionStages.length - 1].stage
    : null;

  const canAccept = currentStage === 'GOODS_RECEIVED_CONFIRMED';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Accept Stock Transfer</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Transfer Info */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Transfer Number</Label>
                  <p className="font-semibold">{transfer.transferNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">From Location</Label>
                  <p className="font-medium">{transfer.destinationLocation.name}</p>
                </div>
              </div>
            </div>

            {!canAccept && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <p className="text-yellow-900 font-medium">
                    Transfer must be at "Goods Received Confirmed" stage before acceptance
                  </p>
                </div>
                <p className="text-sm text-yellow-700 mt-2">
                  Current stage: {currentStage ? currentStage.replace(/_/g, ' ') : 'Unknown'}
                </p>
              </div>
            )}

            {/* Items List */}
            <div>
              <h3 className="font-semibold mb-3">Items to Accept</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium">Item</th>
                      <th className="text-right p-3 text-sm font-medium">Quantity</th>
                      <th className="text-right p-3 text-sm font-medium">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfer.items.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-3">{item.inventoryItem.name}</td>
                        <td className="p-3 text-right font-medium">{item.sentQuantity}</td>
                        <td className="p-3 text-right text-muted-foreground">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Exceptions Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Exceptions (Optional)</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addException}
                  disabled={!canAccept}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Exception
                </Button>
              </div>

              {exceptions.length === 0 ? (
                <div className="p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No exceptions recorded</p>
                  <p className="text-xs mt-1">All items received in good condition</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {exceptions.map((exception, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-red-50">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                          <span className="font-medium text-red-900">Exception #{index + 1}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeException(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Item *</Label>
                          <Select
                            value={exception.inventoryItem}
                            onValueChange={(value) => updateException(index, 'inventoryItem', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {transfer.items.map((item) => (
                                <SelectItem key={item.inventoryItem._id} value={item.inventoryItem._id}>
                                  {item.inventoryItem.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Exception Type *</Label>
                          <Select
                            value={exception.exceptionType}
                            onValueChange={(value) => updateException(index, 'exceptionType', value as any)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="damaged">Damaged</SelectItem>
                              <SelectItem value="missing">Missing</SelectItem>
                              <SelectItem value="excess">Excess</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Quantity *</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={exception.quantity}
                            onChange={(e) => updateException(index, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                        </div>

                        <div>
                          <Label>Type</Label>
                          <div className="mt-2">
                            {getExceptionTypeBadge(exception.exceptionType)}
                          </div>
                        </div>

                        <div className="col-span-2">
                          <Label>Notes *</Label>
                          <Textarea
                            value={exception.notes}
                            onChange={(e) => updateException(index, 'notes', e.target.value)}
                            placeholder="Describe the exception..."
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Acceptance Notes */}
            <div>
              <Label>Acceptance Notes (Optional)</Label>
              <Textarea
                value={acceptanceNotes}
                onChange={(e) => setAcceptanceNotes(e.target.value)}
                placeholder="Add any notes about this stock acceptance..."
                rows={3}
                disabled={!canAccept}
              />
            </div>

            {canAccept && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="text-green-900 font-medium">
                    Ready to accept stock transfer
                  </p>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  This will update inventory at your location and complete the transfer
                </p>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAccept}
            disabled={loading || !canAccept}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {loading ? 'Accepting...' : 'Accept Stock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
