import { useState, useEffect } from 'react';
import { Plus, Eye, CheckCircle, XCircle, Package } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { inventoryServices } from '@/api/services';
import StockTransferFormModal from '@/components/inventory/StockTransferFormModal';
import StockTransferApprovalModal from '@/components/inventory/StockTransferApprovalModal';
import DataTableLayout from '@/components/common/DataTableLayout';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface StockTransfer {
  _id: string;
  transferNumber: string;
  fromBranch: {
    _id: string;
    name: string;
  };
  toBranch: {
    _id: string;
    name: string;
  };
  status: string;
  requestedBy: {
    _id: string;
    name: string;
  };
  requestDate: string;
}

interface StockTransfersTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
  onItemsUpdate?: () => void;
}

export default function StockTransfersTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
  onItemsUpdate,
}: StockTransfersTabProps) {
  const { toast } = useToast();

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [transfersSearch, setTransfersSearch] = useState('');
  const [transfersStatusFilter, setTransfersStatusFilter] = useState('');
  const [transfersPage, setTransfersPage] = useState(1);
  const [transfersRowsPerPage, setTransfersRowsPerPage] = useState(10);
  const [transfersTotalCount, setTransfersTotalCount] = useState(0);
  const [transfersTotalPages, setTransfersTotalPages] = useState(0);
  const [isTransferFormOpen, setIsTransferFormOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [isTransferApprovalOpen, setIsTransferApprovalOpen] = useState(false);

  useEffect(() => {
    if (selectedBranch) {
      fetchTransfers();
    }
  }, [selectedBranch, transfersPage, transfersRowsPerPage, transfersSearch, transfersStatusFilter]);

  const fetchTransfers = async () => {
    if (!selectedBranch) return;
    
    try {
      setTransfersLoading(true);
      const response = await inventoryServices.getStockTransfers(selectedBranch, {
        page: transfersPage,
        limit: transfersRowsPerPage,
        search: transfersSearch || undefined,
        status: transfersStatusFilter || undefined
      });

      setTransfers(response.data.data.transfers || []);
      setTransfersTotalCount(response.data.data.pagination.total);
      setTransfersTotalPages(response.data.data.pagination.totalPages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch stock transfers',
        variant: "destructive",
      });
    } finally {
      setTransfersLoading(false);
    }
  };

  const handleCreateTransfer = () => {
    setIsTransferFormOpen(true);
  };

  const handleViewTransfer = (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    setIsTransferApprovalOpen(true);
  };

  const handleTransferFormSuccess = () => {
    setIsTransferFormOpen(false);
    fetchTransfers();
  };

  const handleTransferApprovalSuccess = () => {
    setIsTransferApprovalOpen(false);
    setSelectedTransfer(null);
    fetchTransfers();
    if (onItemsUpdate) {
      onItemsUpdate();
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
    const statusConfig: Record<string, { variant: any; label: string }> = {
      pending: { variant: 'default', label: 'Pending' },
      approved: { variant: 'default', label: 'Approved' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      completed: { variant: 'default', label: 'Completed' },
      cancelled: { variant: 'secondary', label: 'Cancelled' }
    };

    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant} className={config.variant === 'default' ? 'bg-green-100 text-green-800' : ''}>{config.label}</Badge>;
  };

  return (
    <>
      <DataTableLayout
        statChips={[
          { label: 'Total Transfers', value: transfersTotalCount, variant: 'default' },
        ]}
        actionButtons={[
          {
            icon: <Plus className="h-4 w-4" />,
            tooltip: 'Create transfer',
            onClick: handleCreateTransfer,
            variant: 'default',
          },
        ]}
        searchValue={transfersSearch}
        searchPlaceholder="Search transfers..."
        onSearchChange={setTransfersSearch}
        filterConfig={{
          component: (
            <div className="flex items-center gap-2">
              {(isSuperAdmin || isMultiBranchAdmin) && (
                <Select value={selectedBranch} onValueChange={onBranchChange}>
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch._id} value={branch._id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={transfersStatusFilter || "all"} onValueChange={(value) => setTransfersStatusFilter(value === "all" ? "" : value)}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )
        }}
        tableHeaders={
          <>
            <TableHead className="w-16">S.No</TableHead>
            <TableHead>Transfer Number</TableHead>
            <TableHead>From Branch</TableHead>
            <TableHead>To Branch</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Requested By</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </>
        }
        tableBody={
          <>
            {transfers.map((transfer, index) => (
              <TableRow key={transfer._id}>
                <TableCell className="font-medium text-muted-foreground">
                  {(transfersPage - 1) * transfersRowsPerPage + index + 1}
                </TableCell>
                <TableCell>
                  <p className="font-medium">{transfer.transferNumber}</p>
                </TableCell>
                <TableCell>{transfer.fromBranch?.name || '-'}</TableCell>
                <TableCell>{transfer.toBranch?.name || '-'}</TableCell>
                <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                <TableCell>{transfer.requestedBy?.name || '-'}</TableCell>
                <TableCell>{formatDate(transfer.requestDate)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewTransfer(transfer)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {transfer.status === 'pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewTransfer(transfer)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewTransfer(transfer)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </>
        }
        isLoading={transfersLoading}
        emptyState={
          transfers.length === 0
            ? {
                icon: <Package className="h-12 w-12" />,
                title: 'No transfers found',
                description: transfersSearch || transfersStatusFilter
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first stock transfer',
                action: !transfersSearch && !transfersStatusFilter ? (
                  <Button onClick={handleCreateTransfer}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Transfer
                  </Button>
                ) : undefined,
              }
            : undefined
        }
        currentPage={transfersPage}
        totalPages={transfersTotalPages}
        totalCount={transfersTotalCount}
        rowsPerPage={transfersRowsPerPage}
        onPageChange={setTransfersPage}
        onRowsPerPageChange={setTransfersRowsPerPage}
        onRefresh={fetchTransfers}
        cookiePrefix="inventory-transfers"
      />

      <StockTransferFormModal
        open={isTransferFormOpen}
        onClose={() => setIsTransferFormOpen(false)}
        currentBranchId={selectedBranch}
        onSuccess={handleTransferFormSuccess}
      />

      <StockTransferApprovalModal
        open={isTransferApprovalOpen}
        onClose={() => {
          setIsTransferApprovalOpen(false);
          setSelectedTransfer(null);
        }}
        transfer={selectedTransfer}
        onSuccess={handleTransferApprovalSuccess}
      />
    </>
  );
}
