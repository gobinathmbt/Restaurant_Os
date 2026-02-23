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
import { useToast } from '@/hooks/use-toast';
import { Loader2, Package, Building2, FileText, Bell, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
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
}

export default function StockAdjustmentViewModal({ 
  open, 
  onClose, 
  adjustmentId, 
  branchId 
}: StockAdjustmentViewModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [adjustmentDetails, setAdjustmentDetails] = useState<StockAdjustmentDetails | null>(null);
  const [resendingInApp, setResendingInApp] = useState(false);

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
        newStock: firstItem?.adjustedQuantity || 0,
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

  return (
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
  );
}
