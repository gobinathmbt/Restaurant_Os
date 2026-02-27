import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { inventoryServices } from '@/api/services';
import { CheckCircle, XCircle, AlertTriangle, Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface StockRequest {
  _id: string;
  requestNumber: string;
  status: string;
  priority: string;
  destinationLocation: {
    _id: string;
    name: string;
  };
  sourceLocation: {
    _id: string;
    name: string;
  };
  items: Array<{
    inventoryItem: {
      _id: string;
      name: string;
    };
    requestedQuantity: number;
    approvedQuantity?: number;
    unit: string;
  }>;
  requestedBy: {
    _id: string;
    name: string;
  };
  requestDate: string;
  expectedDeliveryDate: string;
  notes?: string;
}

interface StockRequestViewModalProps {
  open: boolean;
  onClose: () => void;
  request: StockRequest | null;
  onSuccess: () => void;
}

export default function StockRequestViewModal({ 
  open, 
  onClose, 
  request,
  onSuccess 
}: StockRequestViewModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'view' | 'approve' | 'reject'>('view');
  const [approvalData, setApprovalData] = useState<Array<{
    inventoryItem: string;
    requestedQuantity: number;
    approvedQuantity: number;
    unit: string;
  }>>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');

  // Check if user can approve
  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');
  const isWarehouseAdmin = user?.role === 'warehouse_admin';
  const canApprove = (isSuperAdmin || isWarehouseAdmin) && request?.status === 'pending';

  useEffect(() => {
    if (request && open) {
      setMode('view');
      setApprovalData(request.items.map(item => ({
        inventoryItem: item.inventoryItem._id,
        requestedQuantity: item.requestedQuantity,
        approvedQuantity: item.requestedQuantity, // Default to full approval
        unit: item.unit
      })));
      setRejectionReason('');
      setApprovalNotes('');
    }
  }, [request, open]);

  const handleApprove = async () => {
    try {
      setLoading(true);
      
      await inventoryServices.approveStockRequest(request!._id, {
        items: approvalData.map(item => ({
          inventoryItem: item.inventoryItem,
          approvedQuantity: item.approvedQuantity
        })),
        notes: approvalNotes.trim() || undefined
      });

      toast({
        title: "Success",
        description: "Stock request approved successfully",
        variant: "success",
      });
      
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to approve request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Validation Error",
        description: "Rejection reason is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      await inventoryServices.rejectStockRequest(request!._id, {
        rejectionReason: rejectionReason.trim()
      });

      toast({
        title: "Success",
        description: "Stock request rejected",
        variant: "success",
      });
      
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to reject request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateApprovedQuantity = (index: number, value: number) => {
    const updated = [...approvalData];
    updated[index].approvedQuantity = value;
    setApprovalData(updated);
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

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; label: string }> = {
      pending: { className: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      approved: { className: 'bg-green-100 text-green-800', label: 'Approved' },
      rejected: { className: 'bg-red-100 text-red-800', label: 'Rejected' },
      cancelled: { className: 'bg-gray-100 text-gray-800', label: 'Cancelled' }
    };

    const config = statusConfig[status] || { className: 'bg-gray-100 text-gray-800', label: status };
    return <Badge className={config.className}>{config.label}</Badge>;
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

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'approve' ? 'Approve Stock Request' : mode === 'reject' ? 'Reject Stock Request' : 'Stock Request Details'}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Request Header */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <Label className="text-muted-foreground">Request Number</Label>
                <p className="font-semibold">{request.requestNumber}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">{getStatusBadge(request.status)}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Priority</Label>
                <div className="mt-1">{getPriorityBadge(request.priority)}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Expected Delivery</Label>
                <p className="font-medium">{formatDate(request.expectedDeliveryDate)}</p>
              </div>
            </div>

            {/* Location Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">From Location</Label>
                <p className="font-medium">{request.destinationLocation.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">To Location</Label>
                <p className="font-medium">{request.sourceLocation.name}</p>
              </div>
            </div>

            {/* Requester Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Requested By</Label>
                <p className="font-medium">{request.requestedBy.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Request Date</Label>
                <p className="font-medium">{formatDate(request.requestDate)}</p>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <Label className="text-lg font-semibold">Items</Label>
              
              {mode === 'approve' ? (
                <div className="space-y-3">
                  {approvalData.map((item, index) => {
                    const requestItem = request.items[index];
                    const isPartial = item.approvedQuantity < item.requestedQuantity;
                    
                    return (
                      <div key={index} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{requestItem.inventoryItem.name}</p>
                          {isPartial && (
                            <Badge className="bg-orange-100 text-orange-800">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Partial Approval
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label className="text-sm text-muted-foreground">Requested</Label>
                            <p className="font-medium">{item.requestedQuantity} {item.unit}</p>
                          </div>
                          <div>
                            <Label className="text-sm">Approved Quantity *</Label>
                            <Input
                              type="number"
                              min="0"
                              max={item.requestedQuantity}
                              step="0.01"
                              value={item.approvedQuantity}
                              onChange={(e) => updateApprovedQuantity(index, parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Backorder</Label>
                            <p className="font-medium text-orange-600">
                              {item.requestedQuantity - item.approvedQuantity} {item.unit}
                            </p>
                          </div>
                        </div>
                        
                        {isPartial && (
                          <div className="flex items-start gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded">
                            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>
                              A backorder will be created for the unfulfilled quantity ({item.requestedQuantity - item.approvedQuantity} {item.unit})
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  <div>
                    <Label>Approval Notes</Label>
                    <Textarea
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="Add notes about this approval..."
                      rows={3}
                    />
                  </div>
                </div>
              ) : mode === 'reject' ? (
                <div className="space-y-3">
                  <div className="p-4 border rounded-lg bg-red-50">
                    <Label className="text-red-800">Rejection Reason *</Label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Please provide a reason for rejecting this request..."
                      rows={4}
                      className="mt-2"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {request.items.map((item, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">{item.inventoryItem.name}</p>
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="text-muted-foreground">Requested Quantity</Label>
                          <p className="font-medium">{item.requestedQuantity} {item.unit}</p>
                        </div>
                        {item.approvedQuantity !== undefined && (
                          <div>
                            <Label className="text-muted-foreground">Approved Quantity</Label>
                            <p className="font-medium">{item.approvedQuantity} {item.unit}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            {request.notes && mode === 'view' && (
              <div>
                <Label className="text-muted-foreground">Notes</Label>
                <p className="mt-1 text-sm">{request.notes}</p>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          {mode === 'view' && (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              {canApprove && (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setMode('reject')}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setMode('approve')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </>
              )}
            </>
          )}
          
          {mode === 'approve' && (
            <>
              <Button type="button" variant="outline" onClick={() => setMode('view')} disabled={loading}>
                Back
              </Button>
              <Button type="button" onClick={handleApprove} disabled={loading}>
                {loading ? 'Approving...' : 'Confirm Approval'}
              </Button>
            </>
          )}
          
          {mode === 'reject' && (
            <>
              <Button type="button" variant="outline" onClick={() => setMode('view')} disabled={loading}>
                Back
              </Button>
              <Button type="button" variant="destructive" onClick={handleReject} disabled={loading}>
                {loading ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
