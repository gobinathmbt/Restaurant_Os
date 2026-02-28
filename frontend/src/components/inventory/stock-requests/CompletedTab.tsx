import { useState, useEffect } from 'react';
import { Eye, Package, CheckCircle2, AlertTriangle } from 'lucide-react';
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

interface CompletedRequest {
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
  approvedBy?: {
    _id: string;
    name: string;
  };
  completedBy?: {
    _id: string;
    name: string;
  };
  requestDate: string;
  expectedDeliveryDate: string;
  completedDate: string;
  items: Array<{
    inventoryItem: {
      _id: string;
      name: string;
    };
    requestedQuantity: number;
    approvedQuantity?: number;
    unit: string;
  }>;
  transfer?: {
    _id: string;
    transferNumber: string;
    status: string;
    executionStages: Array<{
      stage: string;
      timestamp: string;
    }>;
    exceptions: Array<{
      type: string;
      quantity: number;
    }>;
  };
}

interface CompletedTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
}

export default function CompletedTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
}: CompletedTabProps) {
  const { toast } = useToast();

  const [requests, setRequests] = useState<CompletedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState<CompletedRequest | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [isTransferViewOpen, setIsTransferViewOpen] = useState(false);

  useEffect(() => {
    if (selectedBranch) {
      fetchCompletedRequests();
    }
  }, [selectedBranch, page, rowsPerPage, search]);

  const fetchCompletedRequests = async () => {
    if (!selectedBranch) return;
    
    try {
      setLoading(true);
      const response = await inventoryServices.getCompletedRequests({
        page,
        limit: rowsPerPage,
        search: search || undefined,
      });

      setRequests(response.data.data.requests || []);
      setTotalCount(response.data.data.pagination.total);
      setTotalPages(response.data.data.pagination.pages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch completed requests',
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

  const hasExceptions = (request: CompletedRequest) => {
    return request.transfer?.exceptions && request.transfer.exceptions.length > 0;
  };

  const tableHeaders = (
    <>
      <TableHead className="w-16">S.No</TableHead>
      <TableHead>Request Number</TableHead>
      <TableHead>Transfer Number</TableHead>
      <TableHead>From Location</TableHead>
      <TableHead>To Location</TableHead>
      <TableHead>Priority</TableHead>
      <TableHead>Completed Date</TableHead>
      <TableHead>Completed By</TableHead>
      <TableHead>Status</TableHead>
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
      <TableCell>
        {request.transfer ? (
          <Button
            variant="link"
            className="p-0 h-auto font-medium text-blue-600"
            onClick={async () => {
              try {
                const response = await inventoryServices.getStockTransferById(request.transfer!._id);
                setSelectedTransfer(response.data.data.transfer);
                setIsTransferViewOpen(true);
              } catch (error: any) {
                toast({
                  title: "Error",
                  description: "Failed to load transfer details",
                  variant: "destructive",
                });
              }
            }}
          >
            {request.transfer.transferNumber}
          </Button>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>{request.destinationLocation?.name || '-'}</TableCell>
      <TableCell>{request.sourceLocation?.name || '-'}</TableCell>
      <TableCell>{getPriorityBadge(request.priority)}</TableCell>
      <TableCell>{formatDate(request.completedDate)}</TableCell>
      <TableCell>{request.completedBy?.name || '-'}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
          {hasExceptions(request) && (
            <Badge className="bg-orange-100 text-orange-800">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {request.transfer!.exceptions.length} Exception(s)
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedRequest(request);
              setIsViewOpen(true);
            }}
            title="View Request Details"
          >
            <Eye className="h-4 w-4" />
          </Button>
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
    </div>
  );

  return (
    <>
      <DataTableLayout
        statChips={[
          { label: 'Total Completed', value: totalCount },
          { 
            label: 'With Exceptions', 
            value: requests.filter(r => hasExceptions(r)).length
          }
        ]}
        searchValue={search}
        searchPlaceholder="Search by request or transfer number..."
        onSearchChange={setSearch}
        filterConfig={{ component: filterComponent }}
        tableHeaders={tableHeaders}
        tableBody={tableBody}
        isLoading={loading}
        emptyState={
          requests.length === 0 && !loading
            ? {
                icon: <Package className="h-16 w-16" />,
                title: 'No completed requests found',
                description: search
                  ? 'Try adjusting your search'
                  : 'Completed stock requests will appear here'
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
        onRefresh={fetchCompletedRequests}
        storagePrefix="completed-requests"
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
          fetchCompletedRequests();
        }}
      />

      {selectedTransfer && (
        <StockTransferDetailModal
          open={isTransferViewOpen}
          onClose={() => {
            setIsTransferViewOpen(false);
            setSelectedTransfer(null);
          }}
          transfer={selectedTransfer}
          onSuccess={() => {
            setIsTransferViewOpen(false);
            setSelectedTransfer(null);
            fetchCompletedRequests();
          }}
        />
      )}
    </>
  );
}
