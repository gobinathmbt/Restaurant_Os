import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Package, Building2, FileText, Bell, TrendingUp, TrendingDown, RefreshCw, CheckCircle2, XCircle, FileEdit, Clock } from 'lucide-react';
import api from '@/api/services';

interface StockAdjustmentDetails {
  _id: string;
  adjustmentNumber: string;
  locationId?: {
    _id: string;
    name: string;
    code: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      pincode?: string;
      country?: string;
    };
  };
  branch?: {
    _id: string;
    name: string;
    code: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      pincode?: string;
      country?: string;
    };
  };
  items: Array<{
    inventoryItem: {
      _id: string;
      name: string;
      unit: string;
      type?: string;
      sku?: string;
    };
    currentQuantity: number;
    adjustedQuantity: number;
    quantityDelta: number;
    reason: string;
    notes?: string;
  }>;
  adjustmentType: string;
  status: string;
  createdBy: {
    _id: string;
    name: string;
    email?: string;
  };
  approvedBy?: {
    _id: string;
    name: string;
    email?: string;
  };
  rejectedBy?: {
    _id: string;
    name: string;
    email?: string;
  };
  createdDate: string;
  approvedDate?: string;
  rejectedDate?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  
  // Computed fields for display
  inventoryItem?: {
    _id: string;
    name: string;
    unit: string;
    type?: string;
    sku?: string;
  };
  quantity?: number;
  previousStock?: number;
  newStock?: number;
  reason?: string;
  adjustedBy?: {
    _id: string;
    name: string;
    email?: string;
  };
  adjustmentDate?: string;
}

interface StockAdjustmentViewModalProps {
  open: boolean;
  onClose: () => void;
  adjustmentId: string;
  branchId: string;
  userRole?: string;
  onAdjustmentUpdated?: () => void;
}

export default function StockAdjustmentViewModal({ 
  open, 
  onClose, 
  adjustmentId, 
  branchId,
  userRole,
  onAdjustmentUpdated
}: StockAdjustmentViewModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [adjustmentDetails, setAdjustmentDetails] = useState<StockAdjustmentDetails | null>(null);
  const [resendingInApp, setResendingInApp] = useState(false);
  
  // Approval/rejection state
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Role checks
  const isSuperAdmin = userRole === 'company_super_admin_primary' || userRole === 'company_super_admin_secondary';
  const canApproveOrReject = adjustmentDetails?.status === 'pending_approval' && isSuperAdmin;

  useEffect(() => {
    if (open && adjustmentId && branchId) {
      fetchAdjustmentDetails();
    }
  }, [open, adjustmentId, branchId]);

  const fetchAdjustmentDetails = async () => {
    setLoading(true);
    try {
      const response = await api.inventory.getStockAdjustmentDetails(branchId, adjustmentId);
      const adjustment = response.data.data.adjustment;
      
      // Get first item for display
      const firstItem = adjustment.items?.[0];
      
      // Transform the API response to match the component's expected structure
      const transformedDetails: StockAdjustmentDetails = {
        ...adjustment,
        // Computed fields for backward compatibility
        branch: adjustment.locationId || adjustment.branch || {
          _id: '',
          name: '',
          code: '',
        },
        inventoryItem: firstItem?.inventoryItem || {
          _id: '',
          name: '',
          unit: '',
        },
        quantity: firstItem?.quantityDelta || firstItem?.adjustedQuantity || 0,
        previousStock: firstItem?.currentQuantity || 0,
        newStock: (firstItem?.currentQuantity || 0) + (firstItem?.quantityDelta || 0),
        reason: firstItem?.reason || '',
        adjustedBy: adjustment.createdBy || {
          _id: '',
          name: 'Unknown',
        },
        adjustmentDate: adjustment.createdDate,
      };
      
      setAdjustmentDetails(transformedDetails);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to fetch adjustment details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendInAppNotifications = async () => {
    if (!adjustmentDetails) return;
    
    setResendingInApp(true);
    try {
      const response = await api.inventory.resendStockAdjustmentInAppNotifications(branchId, adjustmentId);
      toast({
        title: 'Success',
        description: response.data.message || 'In-app notifications sent successfully',
        variant: 'success',
      });
    } catch (error: any) {
      console.error('Error resending in-app notifications:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to resend in-app notifications',
        variant: 'destructive',
      });
    } finally {
      setResendingInApp(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAdjustmentTypeIcon = (type: string) => {
    switch (type) {
      case 'increase':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'decrease':
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      case 'correction':
        return <RefreshCw className="h-5 w-5 text-blue-600" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  const getAdjustmentTypeBadge = (type: string) => {
    const typeConfig: Record<string, { variant: any; label: string; className: string }> = {
      increase: { variant: 'default', label: 'Increase', className: 'bg-green-100 text-green-800' },
      decrease: { variant: 'destructive', label: 'Decrease', className: 'bg-red-100 text-red-800' },
      correction: { variant: 'secondary', label: 'Correction', className: 'bg-blue-100 text-blue-800' }
    };

    const config = typeConfig[type] || { variant: 'secondary', label: type, className: '' };
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const getReasonLabel = (reason: string) => {
    const reasonLabels: Record<string, string> = {
      damaged: 'Damaged',
      expired: 'Expired',
      theft: 'Theft',
      wastage: 'Wastage',
      count_correction: 'Count Correction',
      other: 'Other'
    };
    return reasonLabels[reason] || reason;
  };

  const handleApprove = () => {
    // Open approval dialog
    setShowApprovalDialog(true);
  };

  const handleConfirmApproval = async () => {
    if (!adjustmentDetails) return;
    
    setApproving(true);
    try {
      await api.inventory.approveStockAdjustment(branchId, adjustmentDetails._id);
      toast({
        title: 'Success',
        description: 'Stock adjustment approved successfully',
        variant: 'success',
      });
      
      // Close approval dialog
      setShowApprovalDialog(false);
      
      // Refresh the adjustment details
      await fetchAdjustmentDetails();
      
      // Notify parent component
      if (onAdjustmentUpdated) {
        onAdjustmentUpdated();
      }
    } catch (error: any) {
      console.error('Error approving adjustment:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to approve adjustment',
        variant: 'destructive',
      });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!adjustmentDetails) return;
    
    // Validate rejection reason
    if (rejectionReason.trim().length < 10) {
      toast({
        title: 'Validation Error',
        description: 'Rejection reason must be at least 10 characters',
        variant: 'destructive',
      });
      return;
    }
    
    setRejecting(true);
    try {
      await api.inventory.rejectStockAdjustment(branchId, adjustmentDetails._id, { rejectionReason: rejectionReason.trim() });
      toast({
        title: 'Success',
        description: 'Stock adjustment rejected successfully',
        variant: 'success',
      });
      
      // Close reject dialog
      setShowRejectDialog(false);
      setRejectionReason('');
      
      // Refresh the adjustment details
      await fetchAdjustmentDetails();
      
      // Notify parent component
      if (onAdjustmentUpdated) {
        onAdjustmentUpdated();
      }
    } catch (error: any) {
      console.error('Error rejecting adjustment:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to reject adjustment',
        variant: 'destructive',
      });
    } finally {
      setRejecting(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock Adjustment Details
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : adjustmentDetails ? (
            <div className="space-y-6">
              {/* Adjustment Summary Card */}
              <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg p-6 shadow-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm opacity-90">Adjustment Number</p>
                    <p className="text-lg font-bold">{adjustmentDetails.adjustmentNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-90">Date</p>
                    <p className="text-lg font-bold">{formatDate(adjustmentDetails.adjustmentDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-90">Type</p>
                    <div className="mt-1">
                      {getAdjustmentTypeBadge(adjustmentDetails.adjustmentType)}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm opacity-90">Quantity</p>
                    <p className="text-2xl font-bold">
                      {adjustmentDetails.adjustmentType === 'increase' && '+'}
                      {adjustmentDetails.adjustmentType === 'decrease' && '-'}
                      {adjustmentDetails.quantity} {adjustmentDetails.inventoryItem.unit}
                    </p>
                  </div>
                </div>
              </div>

              {/* Branch and Item Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Branch Details */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5 text-primary" />
                    Branch Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Branch Name:</span>
                      <span className="font-medium">{adjustmentDetails.branch.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Branch Code:</span>
                      <span className="font-medium">{adjustmentDetails.branch.code}</span>
                    </div>
                    {adjustmentDetails.branch.address && typeof adjustmentDetails.branch.address === 'object' && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Address:</span>
                        <span className="font-medium text-right">
                          {[
                            adjustmentDetails.branch.address.street,
                            adjustmentDetails.branch.address.city,
                            adjustmentDetails.branch.address.state,
                            adjustmentDetails.branch.address.pincode,
                            adjustmentDetails.branch.address.country
                          ].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Item Details */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5 text-primary" />
                    Item Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Item Name:</span>
                      <span className="font-medium">{adjustmentDetails.inventoryItem.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unit:</span>
                      <span className="font-medium">{adjustmentDetails.inventoryItem.unit}</span>
                    </div>
                    {adjustmentDetails.inventoryItem.sku && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">SKU:</span>
                        <span className="font-medium">{adjustmentDetails.inventoryItem.sku}</span>
                      </div>
                    )}
                    {adjustmentDetails.inventoryItem.type && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-medium capitalize">{adjustmentDetails.inventoryItem.type}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Adjustment Details */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  Adjustment Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Adjustment Number:</span>
                    <span className="font-medium">{adjustmentDetails.adjustmentNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Adjustment Date:</span>
                    <span className="font-medium">{formatDate(adjustmentDetails.adjustmentDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Adjusted By:</span>
                    <span className="font-medium">{adjustmentDetails.adjustedBy.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reason:</span>
                    <Badge variant="outline">{getReasonLabel(adjustmentDetails.reason)}</Badge>
                  </div>
                </div>
              </div>

              {/* Stock Changes */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-lg">
                  {getAdjustmentTypeIcon(adjustmentDetails.adjustmentType)}
                  Stock Changes
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Previous Stock</p>
                    <p className="text-2xl font-bold">{adjustmentDetails.previousStock} {adjustmentDetails.inventoryItem.unit}</p>
                  </div>
                  <div className="text-center p-4 bg-primary/10 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Adjustment</p>
                    <p className="text-2xl font-bold text-primary">
                      {adjustmentDetails.adjustmentType === 'increase' && '+'}
                      {adjustmentDetails.adjustmentType === 'decrease' && '-'}
                      {adjustmentDetails.adjustmentType === 'correction' && '='}
                      {adjustmentDetails.quantity} {adjustmentDetails.inventoryItem.unit}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">New Stock</p>
                    <p className="text-2xl font-bold text-green-700">{adjustmentDetails.newStock} {adjustmentDetails.inventoryItem.unit}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {adjustmentDetails.notes && (
                <div className="border-l-4 border-primary bg-primary/5 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground">{adjustmentDetails.notes}</p>
                </div>
              )}

              {/* Status Timeline */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-lg mb-4">Status Timeline</h3>
                <div className="relative space-y-6 pl-8">
                  {/* Created Milestone */}
                  <div className="relative">
                    <div className="absolute -left-8 top-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 border-2 border-blue-500">
                      <FileEdit className="h-4 w-4 text-blue-600" />
                    </div>
                    {(adjustmentDetails.status === 'pending_approval' || adjustmentDetails.status === 'approved' || adjustmentDetails.status === 'rejected') && (
                      <div className="absolute -left-4 top-8 w-0.5 h-full bg-gray-300"></div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-blue-700">Created</span>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                          {formatDate(adjustmentDetails.createdDate)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Created by <span className="font-medium text-foreground">{adjustmentDetails.createdBy.name}</span>
                        {adjustmentDetails.createdBy.email && (
                          <span className="text-xs"> ({adjustmentDetails.createdBy.email})</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Pending Approval Milestone */}
                  {adjustmentDetails.status === 'pending_approval' && (
                    <div className="relative">
                      <div className="absolute -left-8 top-0 flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 border-2 border-yellow-500 animate-pulse">
                        <Clock className="h-4 w-4 text-yellow-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-yellow-700">Pending Approval</span>
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                            Awaiting Review
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Waiting for super admin approval
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Approved Milestone */}
                  {adjustmentDetails.status === 'approved' && adjustmentDetails.approvedBy && (
                    <div className="relative">
                      <div className="absolute -left-8 top-0 flex items-center justify-center w-8 h-8 rounded-full bg-green-100 border-2 border-green-500">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-green-700">Approved</span>
                          {adjustmentDetails.approvedDate && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                              {formatDate(adjustmentDetails.approvedDate)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Approved by <span className="font-medium text-foreground">{adjustmentDetails.approvedBy.name}</span>
                          {adjustmentDetails.approvedBy.email && (
                            <span className="text-xs"> ({adjustmentDetails.approvedBy.email})</span>
                          )}
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Stock has been adjusted
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Rejected Milestone */}
                  {adjustmentDetails.status === 'rejected' && adjustmentDetails.rejectedBy && (
                    <div className="relative">
                      <div className="absolute -left-8 top-0 flex items-center justify-center w-8 h-8 rounded-full bg-red-100 border-2 border-red-500">
                        <XCircle className="h-4 w-4 text-red-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-red-700">Rejected</span>
                          {adjustmentDetails.rejectedDate && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                              {formatDate(adjustmentDetails.rejectedDate)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Rejected by <span className="font-medium text-foreground">{adjustmentDetails.rejectedBy.name}</span>
                          {adjustmentDetails.rejectedBy.email && (
                            <span className="text-xs"> ({adjustmentDetails.rejectedBy.email})</span>
                          )}
                        </p>
                        {adjustmentDetails.rejectionReason && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
                            <p className="font-medium text-red-900 mb-1">Rejection Reason:</p>
                            <p className="text-red-700">{adjustmentDetails.rejectionReason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No adjustment details available
            </div>
          )}
        </DialogBody>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 justify-between w-full">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <div className="flex flex-wrap gap-2">
            {canApproveOrReject && (
              <>
                <Button
                  variant="default"
                  onClick={handleApprove}
                  disabled={approving || rejecting}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  {approving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={approving || rejecting}
                  size="sm"
                >
                  {rejecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </>
                  )}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              onClick={handleResendInAppNotifications}
              disabled={!adjustmentDetails || resendingInApp}
              size="sm"
            >
              {resendingInApp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Bell className="mr-2 h-4 w-4" />
                  Send In-App
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Approval Confirmation Dialog */}
    <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Approve Stock Adjustment
          </DialogTitle>
        </DialogHeader>
        
        <DialogBody>
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>Are you sure you want to approve this adjustment?</strong>
              </p>
              <p className="text-sm text-green-700 mt-2">
                This action will immediately deduct the stock from inventory and cannot be undone.
              </p>
            </div>
            
            {adjustmentDetails && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Adjustment Number:</span>
                  <span className="font-medium">{adjustmentDetails.adjustmentNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium">{adjustmentDetails.locationId?.name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Items:</span>
                  <span className="font-medium">{adjustmentDetails.items?.length || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium">{adjustmentDetails.adjustmentType}</span>
                </div>
              </div>
            )}
          </div>
        </DialogBody>
        
        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowApprovalDialog(false)}
            disabled={approving}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleConfirmApproval}
            disabled={approving}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {approving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm Approval
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Rejection Reason Dialog */}
    <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Reject Stock Adjustment
          </DialogTitle>
        </DialogHeader>
        
        <DialogBody>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                The creator will be notified about this rejection with your reason.
              </p>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="rejectionReason" className="text-sm font-medium">
                Rejection Reason <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="rejectionReason"
                placeholder="Please provide a detailed reason for rejecting this adjustment (minimum 10 characters)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                maxLength={500}
                className="resize-none"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {rejectionReason.length < 10 
                    ? `${10 - rejectionReason.length} more characters required` 
                    : 'Minimum length met'}
                </span>
                <span>{rejectionReason.length}/500</span>
              </div>
            </div>
          </div>
        </DialogBody>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowRejectDialog(false);
              setRejectionReason('');
            }}
            disabled={rejecting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={rejecting || rejectionReason.trim().length < 10}
          >
            {rejecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rejecting...
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
