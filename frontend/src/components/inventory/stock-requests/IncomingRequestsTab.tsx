import { useState, useEffect } from 'react';
import { Eye, Package, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableHead, TableCell, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { inventoryServices } from '@/api/services';
import StockRequestViewModal from '../StockRequestViewModal';
import StockTransferDetailModal from '../StockTransferDetailModal';
import DataTableLayout from '@/components/common/DataTableLayout';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

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

interface StockRequest {
  _id: string;
  requestNumber: string;
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
  requestedBy: {
    _id: string;
    name: string;
  };
  requestDate: string;
  expectedDeliveryDate: string;
  executionStages?: ExecutionStage[];
  transferId?: string;
  createdTransferId?: string | any; // Can be string ID or populated object
  items: Array<{
    inventoryItem: {
      _id: string;
      name: string;
    };
    requestedQuantity: number;
    approvedQuantity?: number;
    unit: string;
  }>;
}

interface IncomingRequestsTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
  onItemsUpdate?: () => void;
}

export default function IncomingRequestsTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
  onItemsUpdate,
}: IncomingRequestsTabProps) {
  const { toast } = useToast();

  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('approved');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isTransferDetailOpen, setIsTransferDetailOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);

  useEffect(() => {
    if (selectedBranch) {
      fetchRequests();
    }
  }, [selectedBranch, page, rowsPerPage, search, statusFilter, priorityFilter]);

  const fetchRequests = async () => {
    if (!selectedBranch) return;
    
    try {
      setLoading(true);
      
      // Use the original stock requests API
      const response = await inventoryServices.getStockRequests(selectedBranch, {
        page,
        limit: rowsPerPage,
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      });

      // Get requests and enrich with transfer data if available
      const requestsData = response.data.data.requests || [];
      
      // For approved requests, fetch transfer details to get execution stages
      const enrichedRequests = await Promise.all(
        requestsData.map(async (request: any) => {
          // Check if request has a createdTransferId (populated from backend)
          if (request.status === 'approved' && request.createdTransferId) {
            try {
              // If createdTransferId is populated as an object, use it directly
              if (typeof request.createdTransferId === 'object' && request.createdTransferId._id) {
                return {
                  ...request,
                  transferId: request.createdTransferId._id,
                  executionStages: request.createdTransferId.executionStages || []
                };
              }
              
              // Otherwise, fetch the transfer details
              const transferResponse = await inventoryServices.getTransferById(request.createdTransferId);
              return {
                ...request,
                transferId: request.createdTransferId,
                executionStages: transferResponse.data.data.transfer?.executionStages || []
              };
            } catch (error) {
              console.error(`Failed to fetch transfer for request ${request._id}:`, error);
              return {
                ...request,
                transferId: request.createdTransferId,
                executionStages: []
              };
            }
          }
          
          return {
            ...request,
            executionStages: []
          };
        })
      );

      setRequests(enrichedRequests);
      setTotalCount(response.data.data.pagination.total);
      setTotalPages(response.data.data.pagination.pages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch incoming requests',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; label: string }> = {
      pending: { className: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      approved: { className: 'bg-green-100 text-green-800', label: 'Approved' },
      rejected: { className: 'bg-red-100 text-red-800', label: 'Rejected' },
      cancelled: { className: 'bg-gray-100 text-gray-800', label: 'Cancelled' },
      completed: { className: 'bg-blue-100 text-blue-800', label: 'Completed' }
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

  const canAcceptRequest = (request: StockRequest): boolean => {
    // Can accept if status is approved and not yet started
    return request.status === 'approved' && 
           (!request.executionStages || request.executionStages.length === 0);
  };

  const handleAcceptRequest = async (request: StockRequest) => {
    try {
      setLoading(true);
      
      // Start the transfer by updating to PREPARING_STOCK stage
      const transferId = request.transferId || request.createdTransferId;
      
      await inventoryServices.updateTransferStage(transferId, {
        stage: 'PREPARING_STOCK',
        notes: 'Transfer accepted and processing started'
      });

      toast({
        title: "Success",
        description: "Transfer accepted and moved to processing",
        variant: "success",
      });

      fetchRequests();
      if (onItemsUpdate) {
        onItemsUpdate();
      }
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

  const handleViewTransferDetails = (request: StockRequest) => {
    const transfer = {
      _id: request.transferId || request._id,
      transferNumber: request.requestNumber,
      destinationLocation: request.destinationLocation,
      sourceLocation: request.sourceLocation,
      status: request.status,
      priority: request.priority,
      executionStages: request.executionStages,
      items: request.items.map(item => ({
        inventoryItem: item.inventoryItem,
        sentQuantity: item.approvedQuantity || item.requestedQuantity,
        unit: item.unit,
        notes: undefined
      })),
      requestDate: request.requestDate,
      expectedDeliveryDate: request.expectedDeliveryDate,
      notes: undefined
    };
    
    setSelectedTransfer(transfer);
    setIsTransferDetailOpen(true);
  };

  const tableHeaders = (
    <>
      <TableHead className="w-16">S.No</TableHead>
      <TableHead>Request Number</TableHead>
      <TableHead>Transfer Route</TableHead>
      <TableHead>Items Count</TableHead>
      <TableHead>Priority</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Expected Delivery</TableHead>
      <TableHead>Date</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </>
  );

  const tableBody = requests.map((request, index) => {
    const canAccept = canAcceptRequest(request);
    
    return (
    <TableRow key={request._id}>
      <TableCell className="font-medium text-muted-foreground">
        {(page - 1) * rowsPerPage + index + 1}
      </TableCell>
      <TableCell>
        <p className="font-medium">{request.requestNumber}</p>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="text-sm">{request.sourceLocation?.name || '-'}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{request.destinationLocation?.name || '-'}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{request.items?.length || 0} items</Badge>
      </TableCell>
      <TableCell>{getPriorityBadge(request.priority)}</TableCell>
      <TableCell>{getStatusBadge(request.status)}</TableCell>
      <TableCell>{formatDate(request.expectedDeliveryDate)}</TableCell>
      <TableCell>{formatDate(request.requestDate)}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewTransferDetails(request)}
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

  const filterComponent = (
    <div className="flex items-center gap-2">
      {(isSuperAdmin || isMultiBranchAdmin) && (
        <Select value={selectedBranch} onValueChange={onBranchChange}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {isSuperAdmin && (
              <SelectItem value="all">All Locations</SelectItem>
            )}
            {branches.map((branch) => (
              <SelectItem key={branch._id} value={branch._id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
        <SelectTrigger className="w-40 h-9">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>
      <Select value={priorityFilter || "all"} onValueChange={(value) => setPriorityFilter(value === "all" ? "" : value)}>
        <SelectTrigger className="w-40 h-9">
          <SelectValue placeholder="All priorities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="normal">Normal</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <>
      <DataTableLayout
        statChips={[
          { label: 'Incoming Requests', value: totalCount }
        ]}
        searchValue={search}
        searchPlaceholder="Search incoming requests..."
        onSearchChange={setSearch}
        filterConfig={{ component: filterComponent }}
        tableHeaders={tableHeaders}
        tableBody={tableBody}
        isLoading={loading}
        emptyState={
          requests.length === 0 && !loading
            ? {
                icon: <Package className="h-16 w-16" />,
                title: 'No incoming requests',
                description: search || statusFilter || priorityFilter
                  ? 'Try adjusting your filters'
                  : 'No approved requests are waiting to be accepted',
              }
            : undefined
        }
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        rowsPerPage={rowsPerPage}
        onPageChange={setPage}
        onRowsPerPageChange={(rows) => {
          setRowsPerPage(rows);
          setPage(1);
        }}
        onRefresh={fetchRequests}
        storagePrefix="incoming-requests"
      />

      <StockRequestViewModal
        open={isViewOpen}
        onClose={() => {
          setIsViewOpen(false);
          setSelectedRequest(null);
        }}
        request={selectedRequest}
        onSuccess={() => {
          setIsViewOpen(false);
          setSelectedRequest(null);
          fetchRequests();
          if (onItemsUpdate) {
            onItemsUpdate();
          }
        }}
      />

      <StockTransferDetailModal
        open={isTransferDetailOpen}
        onClose={() => {
          setIsTransferDetailOpen(false);
          setSelectedTransfer(null);
        }}
        transfer={selectedTransfer}
        onSuccess={() => {
          setIsTransferDetailOpen(false);
          setSelectedTransfer(null);
          fetchRequests();
          if (onItemsUpdate) {
            onItemsUpdate();
          }
        }}
      />
    </>
  );
}
