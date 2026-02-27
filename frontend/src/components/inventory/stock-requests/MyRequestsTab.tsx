import { useState, useEffect } from 'react';
import { Plus, Eye, X, Package } from 'lucide-react';
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
import StockRequestFormModal from '../StockRequestFormModal';
import StockRequestViewModal from '../StockRequestViewModal';
import DataTableLayout from '@/components/common/DataTableLayout';

interface Branch {
  _id: string;
  name: string;
  code: string;
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

interface MyRequestsTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
  onItemsUpdate?: () => void;
  user?: {
    role: string;
    branchIds: string[];
    warehouseIds: string[];
  };
}

export default function MyRequestsTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
  onItemsUpdate,
  user,
}: MyRequestsTabProps) {
  const { toast } = useToast();

  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  useEffect(() => {
    if (selectedBranch) {
      fetchRequests();
    }
  }, [selectedBranch, page, rowsPerPage, search, statusFilter, priorityFilter]);

  const fetchRequests = async () => {
    if (!selectedBranch) return;
    
    try {
      setLoading(true);
      const response = await inventoryServices.getStockRequests(selectedBranch, {
        page,
        limit: rowsPerPage,
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      });

      setRequests(response.data.data.requests || []);
      setTotalCount(response.data.data.pagination.total);
      setTotalPages(response.data.data.pagination.pages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch stock requests',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      await inventoryServices.cancelStockRequest(requestId, {
        cancellationReason: 'Cancelled by requester'
      });
      toast({
        title: "Success",
        description: "Request cancelled successfully",
      });
      fetchRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to cancel request',
        variant: "destructive",
      });
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

  const tableHeaders = (
    <>
      <TableHead className="w-16">S.No</TableHead>
      <TableHead>Request Number</TableHead>
      <TableHead>From Location</TableHead>
      <TableHead>To Location</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Priority</TableHead>
      <TableHead>Expected Delivery</TableHead>
      <TableHead>Date</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </>
  );

  const tableBody = requests.map((request, index) => (
    <TableRow key={request._id}>
      <TableCell className="font-medium text-muted-foreground">
        {(page - 1) * rowsPerPage + index + 1}
      </TableCell>
      <TableCell>
        <p className="font-medium">{request.requestNumber}</p>
      </TableCell>
      <TableCell>{request.destinationLocation?.name || '-'}</TableCell>
      <TableCell>{request.sourceLocation?.name || '-'}</TableCell>
      <TableCell>{getStatusBadge(request.status)}</TableCell>
      <TableCell>{getPriorityBadge(request.priority)}</TableCell>
      <TableCell>{formatDate(request.expectedDeliveryDate)}</TableCell>
      <TableCell>{formatDate(request.requestDate)}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedRequest(request);
              setIsViewOpen(true);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {request.status === 'pending' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCancelRequest(request._id)}
              className="text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  ));

  const filterComponent = (
    <div className="flex items-center gap-2">
      {(isSuperAdmin || isMultiBranchAdmin) && (
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
      )}
      <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
        <SelectTrigger className="w-40 h-9">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
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
          { label: 'Total Requests', value: totalCount }
        ]}
        searchValue={search}
        searchPlaceholder="Search requests..."
        onSearchChange={setSearch}
        filterConfig={{ component: filterComponent }}
        tableHeaders={tableHeaders}
        tableBody={tableBody}
        isLoading={loading}
        emptyState={
          requests.length === 0 && !loading
            ? {
                icon: <Package className="h-16 w-16" />,
                title: 'No requests found',
                description: search || statusFilter || priorityFilter
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first stock request',
                action: !search && !statusFilter && !priorityFilter ? (
                  <Button onClick={() => setIsFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Request
                  </Button>
                ) : undefined
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
        actionButtons={[
          {
            icon: <Plus className="h-4 w-4" />,
            tooltip: 'Create Request',
            onClick: () => setIsFormOpen(true),
            variant: 'default'
          }
        ]}
        storagePrefix="my-requests"
      />

      <StockRequestFormModal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        currentBranchId={selectedBranch}
        onSuccess={() => {
          setIsFormOpen(false);
          fetchRequests();
        }}
        user={user || { role: '', branchIds: [], warehouseIds: [] }}
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
    </>
  );
}
