import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { inventoryServices } from '@/api/services';
import { ArrowRight, Package, RefreshCw, CheckCircle } from 'lucide-react';
import ExecutionStageTimeline from './ExecutionStageTimeline';
import { useAuth } from '@/contexts/AuthContext';

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
  executionStages?: ExecutionStage[]; // Made optional
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

interface StockTransferDetailModalProps {
  open: boolean;
  onClose: () => void;
  transfer: StockTransfer | null;
  onSuccess: () => void;
}

// Stage transition map
const STAGE_TRANSITIONS: Record<string, string[]> = {
  PROCESS_STARTED: ['PREPARING_STOCK'],
  PREPARING_STOCK: ['LOADING_INTO_VEHICLE'],
  LOADING_INTO_VEHICLE: ['DISPATCHED'],
  DISPATCHED: ['IN_TRANSIT'],
  IN_TRANSIT: ['ARRIVED_AT_DESTINATION'],
  ARRIVED_AT_DESTINATION: ['UNLOADING'],
  UNLOADING: ['GOODS_RECEIVED_CONFIRMED'],
  GOODS_RECEIVED_CONFIRMED: ['PROCESS_COMPLETED'],
  PROCESS_COMPLETED: []
};

const STAGE_LABELS: Record<string, string> = {
  PROCESS_STARTED: 'Process Started',
  PREPARING_STOCK: 'Preparing Stock',
  LOADING_INTO_VEHICLE: 'Loading into Vehicle',
  DISPATCHED: 'Dispatched',
  IN_TRANSIT: 'In Transit',
  ARRIVED_AT_DESTINATION: 'Arrived at Destination',
  UNLOADING: 'Unloading',
  GOODS_RECEIVED_CONFIRMED: 'Goods Received Confirmed',
  PROCESS_COMPLETED: 'Process Completed'
};

export default function StockTransferDetailModal({
  open,
  onClose,
  transfer,
  onSuccess
}: StockTransferDetailModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showStageUpdate, setShowStageUpdate] = useState(false);
  const [stageNotes, setStageNotes] = useState('');
  const [nextStage, setNextStage] = useState<string | null>(null);

  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');

  useEffect(() => {
    if (transfer && open) {
      setShowStageUpdate(false);
      setStageNotes('');
      setNextStage(null);
    }
  }, [transfer, open]);

  if (!transfer) return null;

  const canAcceptTransfer = (): boolean => {
    // Can accept if status is approved and not yet started
    return transfer.status === 'approved' && 
           (!transfer.executionStages || transfer.executionStages.length === 0);
  };

  const handleAcceptTransfer = async () => {
    try {
      setLoading(true);

      await inventoryServices.updateTransferStage(transfer._id, {
        stage: 'PREPARING_STOCK',
        notes: 'Transfer accepted and processing started'
      });

      toast({
        title: "Success",
        description: "Transfer accepted and moved to processing",
        variant: "success",
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to accept transfer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStage = (): ExecutionStage | null => {
    if (!transfer || !transfer.executionStages || transfer.executionStages.length === 0) {
      return null;
    }
    return transfer.executionStages[transfer.executionStages.length - 1];
  };

  const getNextStages = (): string[] => {
    const currentStage = getCurrentStage();
    if (!currentStage) return [];
    return STAGE_TRANSITIONS[currentStage.stage] || [];
  };

  const canUpdateStage = (): boolean => {
    if (isSuperAdmin) return true;

    const currentStage = getCurrentStage();
    if (!currentStage) return false;

    // NOTE: Field naming in model is swapped:
    // - transfer.destinationLocation = actual SOURCE (warehouse sending stock)
    // - transfer.sourceLocation = actual DESTINATION (branch receiving stock)
    
    // Sender stages: PREPARING_STOCK to ARRIVED_AT_DESTINATION
    // These are done by the SOURCE location (warehouse/branch that has stock)
    // In model: destinationLocation
    const senderStages = ['PREPARING_STOCK', 'LOADING_INTO_VEHICLE', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION'];
    
    // Receiver stages: UNLOADING, GOODS_RECEIVED_CONFIRMED
    // These are done by the DESTINATION location (branch receiving stock)
    // In model: sourceLocation
    const receiverStages = ['UNLOADING', 'GOODS_RECEIVED_CONFIRMED'];

    const userLocationIds = [
      ...(user?.branchIds || []),
      ...(user?.warehouseIds || [])
    ];

    // Check if user has access to actual SOURCE location (destinationLocation in model)
    const isSenderUser = userLocationIds.includes(transfer.destinationLocation._id);
    
    // Check if user has access to actual DESTINATION location (sourceLocation in model)
    const isReceiverUser = userLocationIds.includes(transfer.sourceLocation._id);

    if (senderStages.includes(currentStage.stage) && isSenderUser) {
      return true;
    }

    if (receiverStages.includes(currentStage.stage) && isReceiverUser) {
      return true;
    }

    return false;
  };

  const handleUpdateStage = async () => {
    if (!nextStage) {
      toast({
        title: "Validation Error",
        description: "Please select a stage to update to",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      await inventoryServices.updateTransferStage(transfer._id, {
        stage: nextStage,
        notes: stageNotes.trim() || undefined
      });

      toast({
        title: "Success",
        description: `Transfer stage updated to ${STAGE_LABELS[nextStage]}`,
        variant: "success",
      });

      setShowStageUpdate(false);
      setStageNotes('');
      setNextStage(null);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to update stage",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig: Record<string, { className: string; label: string }> = {
      urgent: { className: 'bg-red-100 text-red-800', label: 'Urgent' },
      high: { className: 'bg-orange-100 text-orange-800', label: 'High' },
      normal: { className: 'bg-blue-100 text-blue-800', label: 'Normal' },
      low: { className: 'bg-gray-100 text-gray-800', label: 'Low' }
    };

    const config = priorityConfig[priority] || { className: 'bg-gray-100 text-gray-800', label: priority };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const currentStage = getCurrentStage();
  const nextStages = getNextStages();
  const canUpdate = canUpdateStage();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stock Transfer Details</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Transfer Header */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <Label className="text-muted-foreground">Transfer Number</Label>
                <p className="font-semibold text-lg">{transfer.transferNumber}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Priority</Label>
                <div className="mt-1">{getPriorityBadge(transfer.priority)}</div>
              </div>
            </div>

            {/* Location Details */}
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-3">Transfer Route</h3>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-muted-foreground">Source (From)</Label>
                  <p className="font-medium text-lg">{transfer.sourceLocation.name}</p>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                </div>
                <ArrowRight className="h-8 w-8 text-primary mx-4" />
                <div className="flex-1 text-right">
                  <Label className="text-muted-foreground">Destination (To)</Label>
                  <p className="font-medium text-lg">{transfer.destinationLocation.name}</p>
                  <p className="text-sm text-muted-foreground">Receiver</p>
                </div>
              </div>
            </div>

            {/* Items */}
            <div>
              <h3 className="font-semibold mb-3">Items</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium">Item</th>
                      <th className="text-right p-3 text-sm font-medium">Quantity</th>
                      <th className="text-right p-3 text-sm font-medium">Unit</th>
                      <th className="text-left p-3 text-sm font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfer.items.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-3">{item.inventoryItem.name}</td>
                        <td className="p-3 text-right font-medium">{item.sentQuantity}</td>
                        <td className="p-3 text-right text-muted-foreground">{item.unit}</td>
                        <td className="p-3 text-sm text-muted-foreground">{item.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Execution Timeline */}
            {transfer.executionStages && transfer.executionStages.length > 0 && (
              <ExecutionStageTimeline executionStages={transfer.executionStages} />
            )}

            {/* Stage Update Section */}
            {canAcceptTransfer() && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-green-900">Ready to accept and start processing</p>
                    <p className="text-sm text-green-700">
                      Click accept to start the transfer execution process
                    </p>
                  </div>
                  <Button
                    onClick={handleAcceptTransfer}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accept & Start
                  </Button>
                </div>
              </div>
            )}

            {canUpdate && nextStages.length > 0 && !showStageUpdate && !canAcceptTransfer() && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-blue-900">Ready to update stage</p>
                    <p className="text-sm text-blue-700">
                      Current: {currentStage ? STAGE_LABELS[currentStage.stage] : 'Unknown'}
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowStageUpdate(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Update Stage
                  </Button>
                </div>
              </div>
            )}

            {/* Stage Update Form */}
            {showStageUpdate && (
              <div className="p-4 border-2 border-blue-300 rounded-lg bg-blue-50">
                <h3 className="font-semibold mb-4 text-blue-900">Update Execution Stage</h3>
                
                <div className="space-y-4">
                  <div>
                    <Label>Select Next Stage *</Label>
                    <div className="mt-2 space-y-2">
                      {nextStages.map((stage) => (
                        <div
                          key={stage}
                          className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                            nextStage === stage
                              ? 'border-blue-500 bg-blue-100'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                          onClick={() => setNextStage(stage)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{STAGE_LABELS[stage]}</span>
                            {nextStage === stage && (
                              <CheckCircle className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Notes (Optional)</Label>
                    <Textarea
                      value={stageNotes}
                      onChange={(e) => setStageNotes(e.target.value)}
                      placeholder="Add any notes about this stage transition..."
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Transfer Notes */}
            {transfer.notes && (
              <div>
                <Label className="text-muted-foreground">Transfer Notes</Label>
                <div className="mt-1 p-3 bg-muted rounded-lg">
                  <p className="text-sm">{transfer.notes}</p>
                </div>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          {showStageUpdate ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowStageUpdate(false);
                  setStageNotes('');
                  setNextStage(null);
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleUpdateStage}
                disabled={loading || !nextStage}
              >
                {loading ? 'Updating...' : 'Confirm Stage Update'}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
