import { useState, useEffect } from 'react';
import { Plus, Eye, Package, FileEdit, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { inventoryServices } from '@/api/services';
import StockAdjustmentFormModal from '@/components/inventory/StockAdjustmentFormModal';
import StockAdjustmentViewModal from '@/components/inventory/StockAdjustmentViewModal';
import DataTableLayout from '@/components/common/DataTableLayout';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface StockAdjustment {
  _id: string;
  adjustmentNumber: string;
  locationId?: {
    _id: string;
    name: string;
    code: string;
  };
  branch?: string | {
    _id: string;
    name: string;
    code: string;
  };
  adjustmentType: string;
  items: Array<{
    inventoryItem: {
      _id: string;
      name: string;
      type: string;
      unit: string;
    };
    currentQuantity: number;
    adjustedQuantity: number;
    quantityDelta: number;
    reason: string;
    notes?: string;
  }>;
  status: string;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdDate: string;
  approvedBy?: {
    _id: string;
    name: string;
  };
  approvedDate?: string;
  rejectedBy?: {
    _id: string;
    name: string;
  };
  rejectedDate?: string;
  rejectionReason?: string;
  notes?: string;
}

interface StockAdjustmentsTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
  onItemsUpdate?: () => void;
}

export default function StockAdjustmentsTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
  onItemsUpdate,
}: StockAdjustmentsTabProps) {
  const { toast } = useToast();

  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(true);
  const [adjustmentsSearch, setAdjustmentsSearch] = useState('');
  const [adjustmentsPage, setAdjustmentsPage] = useState(1);
  const [adjustmentsRowsPerPage, setAdjustmentsRowsPerPage] = useState(10);
  const [adjustmentsTotalCount, setAdjustmentsTotalCount] = useState(0);
  const [adjustmentsTotalPages, setAdjustmentsTotalPages] = useState(0);
  const [isAdjustmentFormOpen, setIsAdjustmentFormOpen] = useState(false);
  const [isAdjustmentViewOpen, setIsAdjustmentViewOpen] = useState(false);
  const [selectedAdjustmentId, setSelectedAdjustmentId] = useState<string>('');
  const [selectedAdjustmentBranchId, setSelectedAdjustmentBranchId] = useState<string>('');
  
  // Approve/Reject state
  const [approvingId, setApprovingId] = useState<string>('');
  const [rejectingId, setRejectingId] = useState<string>('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [adjustmentToReject, setAdjustmentToReject] = useState<StockAdjustment | null>(null);

  // Set default branch to "all" for super admin and multi-branch admin
  useEffect(() => {
    if (!selectedBranch && branches.length > 0) {
      if (isSuperAdmin || isMultiBranchAdmin) {
        onBranchChange('all');
      }
    }
  }, [branches, selectedBranch, isSuperAdmin, isMultiBranchAdmin]);

  useEffect(() => {
    if (selectedBranch) {
      fetchAdjustments();
    }
  }, [selectedBranch, adjustmentsPage, adjustmentsRowsPerPage, adjustmentsSearch]);

  const fetchAdjustments = async () => {
    if (!selectedBranch) return;
    
    try {
      setAdjustmentsLoading(true);
      const response = await inventoryServices.getStockAdjustments({
        locationId: selectedBranch,
        page: adjustmentsPage,
        limit: adjustmentsRowsPerPage,
        search: adjustmentsSearch || undefined
      });

      setAdjustments(response.data.data.adjustments || []);
      setAdjustmentsTotalCount(response.data.data.pagination.total);
      setAdjustmentsTotalPages(response.data.data.pagination.pages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch stock adjustments',
        variant: "destructive",
      });
    } finally {
      setAdjustmentsLoading(false);
    }
  };

  const handleCreateAdjustment = () => {
    setIsAdjustmentFormOpen(true);
  };

  const handleViewAdjustment = (adjustmentId: string, branchId: string) => {
    setSelectedAdjustmentId(adjustmentId);
    setSelectedAdjustmentBranchId(branchId);
    setIsAdjustmentViewOpen(true);
  };

  const handleAdjustmentFormSuccess = () => {
    setIsAdjustmentFormOpen(false);
    fetchAdjustments();
    if (onItemsUpdate) {
      onItemsUpdate();
    }
  };

  const handleQuickApprove = async (adjustment: StockAdjustment) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to approve adjustment ${adjustment.adjustmentNumber}? This will deduct the stock immediately.`
    );
    
    if (!confirmed) return;
    
    setApprovingId(adjustment._id);
    try {
      const branchId = adjustment.locationId?._id || (typeof adjustment.branch === 'object' ? adjustment.branch._id : adjustment.branch) || selectedBranch;
      await inventoryServices.approveStockAdjustment(branchId, adjustment._id);
      toast({
        title: 'Success',
        description: 'Stock adjustment approved successfully',
        variant: 'success',
      });
      
      // Refresh the adjustments list
      await fetchAdjustments();
      
      // Notify parent component
      if (onItemsUpdate) {
        onItemsUpdate();
      }
    } catch (error: any) {
      console.error('Error approving adjustment:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to approve adjustment',
        variant: 'destructive',
      });
    } finally {
      setApprovingId('');
    }
  };

  const handleQuickReject = (adjustment: StockAdjustment) => {
    setAdjustmentToReject(adjustment);
    setShowRejectDialog(true);
  };

  const handleRejectConfirm = async () => {
    if (!adjustmentToReject) return;
    
    // Validate rejection reason
    if (rejectionReason.trim().length < 10) {
      toast({
        title: 'Validation Error',
        description: 'Rejection reason must be at least 10 characters',
        variant: 'destructive',
      });
      return;
    }
    
    setRejectingId(adjustmentToReject._id);
    try {
      const branchId = adjustmentToReject.locationId?._id || (typeof adjustmentToReject.branch === 'object' ? adjustmentToReject.branch._id : adjustmentToReject.branch) || selectedBranch;
      await inventoryServices.rejectStockAdjustment(branchId, adjustmentToReject._id, { rejectionReason: rejectionReason.trim() });
      toast({
        title: 'Success',
        description: 'Stock adjustment rejected successfully',
        variant: 'success',
      });
      
      // Close reject dialog and reset state
      setShowRejectDialog(false);
      setRejectionReason('');
      setAdjustmentToReject(null);
      
      // Refresh the adjustments list
      await fetchAdjustments();
      
      // Notify parent component
      if (onItemsUpdate) {
        onItemsUpdate();
      }
    } catch (error: any) {
      console.error('Error rejecting adjustment:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to reject adjustment',
        variant: 'destructive',
      });
    } finally {
      setRejectingId('');
    }
  };

  const handleRejectCancel = () => {
    setShowRejectDialog(false);
    setRejectionReason('');
    setAdjustmentToReject(null);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getAdjustmentTypeBadge = (type: string) => {
    const typeConfig: Record<string, { variant: any; label: string }> = {
      increase: { variant: 'default', label: 'Increase' },
      decrease: { variant: 'destructive', label: 'Decrease' },
      correction: { variant: 'secondary', label: 'Correction' }
    };

    const config = typeConfig[type] || { variant: 'secondary', label: type };
    return <Badge variant={config.variant} className={config.variant === 'default' ? 'bg-blue-100 text-blue-800' : ''}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; label: string; icon: any; className: string }> = {
      draft: { 
        variant: 'secondary', 
        label: 'Draft', 
        icon: FileEdit,
        className: 'bg-gray-100 text-gray-800 border-gray-300'
      },
      pending_approval: { 
        variant: 'outline', 
        label: 'Pending Approval', 
        icon: Clock,
        className: 'bg-yellow-50 text-yellow-800 border-yellow-300'
      },
      approved: { 
        variant: 'default', 
        label: 'Approved', 
        icon: CheckCircle,
        className: 'bg-green-100 text-green-800 border-green-300'
      },
      rejected: { 
        variant: 'destructive', 
        label: 'Rejected', 
        icon: XCircle,
        className: 'bg-red-100 text-red-800 border-red-300'
      }
    };

    const config = statusConfig[status] || { 
      variant: 'secondary', 
      label: status, 
      icon: FileEdit,
      className: 'bg-gray-100 text-gray-800 border-gray-300'
    };
    
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <>
      <DataTableLayout
        statChips={[
          {
            label: 'Total Adjustments',
            value: adjustmentsTotalCount,
            variant: 'outline',
          },
        ]}
        actionButtons={[
          {
            icon: <Plus className="h-4 w-4" />,
            tooltip: 'Create Adjustment',
            onClick: handleCreateAdjustment,
            variant: 'default',
          },
        ]}
        searchValue={adjustmentsSearch}
        searchPlaceholder="Search adjustments..."
        onSearchChange={setAdjustmentsSearch}
        filterConfig={
          (isSuperAdmin || isMultiBranchAdmin)
            ? {
                component: (
                  <Select value={selectedBranch} onValueChange={onBranchChange}>
                    <SelectTrigger className="w-48 h-9">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {(isSuperAdmin || isMultiBranchAdmin) && (
                        <SelectItem value="all">All Branches</SelectItem>
                      )}
                      {branches.map((branch) => (
                        <SelectItem key={branch._id} value={branch._id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ),
              }
            : undefined
        }
        tableHeaders={
          <>
            <TableHead className="w-16">S.No</TableHead>
            <TableHead>Adjustment Number</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Adjusted By</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </>
        }
        tableBody={
          <>
            {adjustments.map((adjustment, index) => {
              // Get first item for display (adjustments can have multiple items)
              const firstItem = adjustment.items?.[0];
              
              return (
              <TableRow key={adjustment._id}>
                <TableCell className="font-medium text-muted-foreground">
                  {(adjustmentsPage - 1) * adjustmentsRowsPerPage + index + 1}
                </TableCell>
                <TableCell>
                  <p className="font-medium">{adjustment.adjustmentNumber}</p>
                  {adjustment.items && adjustment.items.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      +{adjustment.items.length - 1} more item{adjustment.items.length > 2 ? 's' : ''}
                    </p>
                  )}
                </TableCell>
                <TableCell>{firstItem?.inventoryItem?.name || '-'}</TableCell>
                <TableCell>{getAdjustmentTypeBadge(adjustment.adjustmentType)}</TableCell>
                <TableCell className="text-right font-medium">
                  {firstItem?.adjustedQuantity || 0}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {firstItem?.reason?.replace(/_/g, ' ') || '-'}
                  </Badge>
                </TableCell>
                <TableCell>{getStatusBadge(adjustment.status)}</TableCell>
                <TableCell>{adjustment.createdBy?.name || '-'}</TableCell>
                <TableCell>{formatDate(adjustment.createdDate)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      title="View adjustment details"
                      onClick={() => {
                        const branchId = typeof adjustment.branch === 'string' ? adjustment.branch : adjustment.branch?._id;
                        const locationId = adjustment.locationId?._id || branchId || selectedBranch;
                        handleViewAdjustment(adjustment._id, locationId);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    {/* Show Approve button only for pending adjustments and super admins */}
                    {adjustment.status === 'pending_approval' && isSuperAdmin && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        title="Approve adjustment"
                        onClick={() => handleQuickApprove(adjustment)}
                        disabled={approvingId === adjustment._id || rejectingId === adjustment._id}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        {approvingId === adjustment._id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    
                    {/* Show Reject button only for pending adjustments and super admins */}
                    {adjustment.status === 'pending_approval' && isSuperAdmin && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        title="Reject adjustment"
                        onClick={() => handleQuickReject(adjustment)}
                        disabled={approvingId === adjustment._id || rejectingId === adjustment._id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {rejectingId === adjustment._id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </>
        }
        isLoading={adjustmentsLoading}
        emptyState={
          adjustments.length === 0 && !adjustmentsLoading
            ? {
                icon: <Package className="h-12 w-12" />,
                title: 'No adjustments found',
                description: adjustmentsSearch
                  ? 'Try adjusting your search'
                  : 'Get started by creating your first stock adjustment',
                action: !adjustmentsSearch ? (
                  <Button onClick={handleCreateAdjustment}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Adjustment
                  </Button>
                ) : undefined,
              }
            : undefined
        }
        currentPage={adjustmentsPage}
        totalPages={adjustmentsTotalPages}
        totalCount={adjustmentsTotalCount}
        rowsPerPage={adjustmentsRowsPerPage}
        onPageChange={setAdjustmentsPage}
        onRowsPerPageChange={(rows) => {
          setAdjustmentsRowsPerPage(rows);
          setAdjustmentsPage(1);
        }}
        onRefresh={fetchAdjustments}
        storagePrefix="stock-adjustments"
      />

      <StockAdjustmentFormModal
        open={isAdjustmentFormOpen}
        onClose={() => setIsAdjustmentFormOpen(false)}
        branchId={selectedBranch}
        onSuccess={handleAdjustmentFormSuccess}
      />

      <StockAdjustmentViewModal
        open={isAdjustmentViewOpen}
        onClose={() => setIsAdjustmentViewOpen(false)}
        adjustmentId={selectedAdjustmentId}
        branchId={selectedAdjustmentBranchId}
      />

      {/* Rejection Reason Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Stock Adjustment</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                You are about to reject adjustment <span className="font-semibold">{adjustmentToReject?.adjustmentNumber}</span>
              </p>
              <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                ⚠️ The creator will be notified of this rejection.
              </p>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="rejectionReason" className="text-sm font-medium">
                Rejection Reason <span className="text-red-500">*</span>
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
              <p className="text-xs text-muted-foreground text-right">
                {rejectionReason.length}/500 characters
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleRejectCancel}
              disabled={rejectingId !== ''}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={rejectionReason.trim().length < 10 || rejectingId !== ''}
            >
              {rejectingId !== '' ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Adjustment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
