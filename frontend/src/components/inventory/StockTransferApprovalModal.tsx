import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { inventoryServices } from '@/api/services';
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react';

interface StockTransferApprovalModalProps {
  open: boolean;
  onClose: () => void;
  transfer: any | null;
  onSuccess: () => void;
}

export default function StockTransferApprovalModal({ 
  open, 
  onClose, 
  transfer,
  onSuccess 
}: StockTransferApprovalModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleApprove = async () => {
    if (!transfer) return;

    try {
      setLoading(true);
      await inventoryServices.approveStockTransfer(transfer._id);
      toast({
        title: "Success",
        description: "Stock transfer approved successfully",
        variant: "success",
      });
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to approve stock transfer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!transfer) return;

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
      await inventoryServices.rejectStockTransfer(transfer._id, rejectionReason.trim());
      toast({
        title: "Success",
        description: "Stock transfer rejected",
        variant: "success",
      });
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to reject stock transfer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; label: string }> = {
      pending: { variant: 'default', label: 'Pending' },
      approved: { variant: 'default', label: 'Approved' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      completed: { variant: 'default', label: 'Completed' },
      cancelled: { variant: 'secondary', label: 'Cancelled' }
    };

    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  if (!transfer) return null;

  const isPending = transfer.status === 'pending';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Stock Transfer Details</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Transfer Header */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Transfer Number</span>
                  <p className="text-lg font-semibold">{transfer.transferNumber}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Status</span>
                  <div className="mt-1">{getStatusBadge(transfer.status)}</div>
                </div>
              </div>
            </div>

            {/* Branch Transfer */}
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-3">Transfer Route</h3>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="text-sm text-muted-foreground">From Branch</span>
                  <p className="text-lg font-semibold">
                    {transfer.destinationLocation?.name || 'Unknown'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {transfer.destinationLocation?.code || ''}
                  </p>
                </div>
                <ArrowRight className="h-8 w-8 text-primary mx-4" />
                <div className="flex-1 text-right">
                  <span className="text-sm text-muted-foreground">To Branch</span>
                  <p className="text-lg font-semibold">
                    {transfer.sourceLocation?.name || 'Unknown'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {transfer.sourceLocation?.code || ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Request Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Requested By</span>
                <p className="font-medium">
                  {transfer.requestedBy?.name || 'Unknown'}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Request Date</span>
                <p className="font-medium">
                  {formatDate(transfer.requestDate)}
                </p>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <h3 className="font-semibold mb-3">Items</h3>
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
                    {transfer.items?.map((item: any, index: number) => (
                      <tr key={index} className="border-t">
                        <td className="p-3">
                          {item.inventoryItem?.name || 'Unknown Item'}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {item.quantity}
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          {item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            {transfer.notes && (
              <div>
                <Label>Notes</Label>
                <div className="p-3 bg-muted rounded-lg mt-1">
                  <p className="text-sm">{transfer.notes}</p>
                </div>
              </div>
            )}

            {/* Approval/Rejection Information */}
            {transfer.status === 'approved' && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-900">Approved</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-green-700">Approved By:</span>
                    <p className="font-medium text-green-900">
                      {transfer.approvedBy?.name || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <span className="text-green-700">Approved Date:</span>
                    <p className="font-medium text-green-900">
                      {formatDate(transfer.approvedDate)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {transfer.status === 'rejected' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="font-semibold text-red-900">Rejected</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-red-700">Rejected By:</span>
                      <p className="font-medium text-red-900">
                        {transfer.rejectedBy?.name || 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <span className="text-red-700">Rejected Date:</span>
                      <p className="font-medium text-red-900">
                        {formatDate(transfer.rejectedDate)}
                      </p>
                    </div>
                  </div>
                  {transfer.rejectionReason && (
                    <div>
                      <span className="text-red-700">Reason:</span>
                      <p className="font-medium text-red-900 mt-1">
                        {transfer.rejectionReason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rejection Input */}
            {isPending && showRejectInput && (
              <div>
                <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                  rows={3}
                  className="mt-1"
                />
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          {isPending ? (
            <>
              {showRejectInput ? (
                <>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowRejectInput(false);
                      setRejectionReason('');
                    }} 
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={handleReject} 
                    disabled={loading}
                  >
                    {loading ? 'Rejecting...' : 'Confirm Rejection'}
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose} 
                    disabled={loading}
                  >
                    Close
                  </Button>
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={() => setShowRejectInput(true)} 
                    disabled={loading}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleApprove} 
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {loading ? 'Approving...' : 'Approve'}
                  </Button>
                </>
              )}
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
