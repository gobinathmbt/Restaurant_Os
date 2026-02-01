import { useState, useEffect } from 'react';
import { Plus, Eye, CheckCircle, XCircle, Package, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableHeader, TableCell, TableHead, TableRow } from '@/components/ui/table';
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
      <div className="h-full flex flex-col bg-background">
        {/* Fixed Header */}
        <div className="bg-background border-b flex-shrink-0">
          <div className="px-6 py-3">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Stats Chips */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="px-3 py-1 text-sm">
                  Total Transfers: {transfersTotalCount}
                </Badge>
              </div>

              {/* Search */}
              <div className="flex-1 max-w-xs">
                <Input
                  placeholder="Search transfers..."
                  value={transfersSearch}
                  onChange={(e) => setTransfersSearch(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Filters */}
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

              {/* Spacer */}
              <div className="flex-1" />

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={fetchTransfers}
                disabled={transfersLoading}
                className="h-9 w-9"
              >
                <RefreshCw className={`h-4 w-4 ${transfersLoading ? 'animate-spin' : ''}`} />
              </Button>

              {/* Add Button */}
              <Button
                variant="default"
                size="icon"
                onClick={handleCreateTransfer}
                className="h-9 w-9"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {transfersLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : transfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No transfers found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {transfersSearch || transfersStatusFilter
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first stock transfer'}
              </p>
              {!transfersSearch && !transfersStatusFilter && (
                <Button onClick={handleCreateTransfer}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Transfer
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 border-b">
                <TableRow>
                  <TableHead className="w-16">S.No</TableHead>
                  <TableHead>Transfer Number</TableHead>
                  <TableHead>From Branch</TableHead>
                  <TableHead>To Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
              </TableBody>
            </Table>
          )}
        </div>

        {/* Fixed Footer with Pagination */}
        <div className="bg-background border-t py-3 px-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            {/* Left: Rows per page */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Rows:</Label>
              <Select
                value={transfersRowsPerPage.toString()}
                onValueChange={(value) => {
                  setTransfersRowsPerPage(parseInt(value));
                  setTransfersPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Center: Pagination */}
            {transfersTotalPages > 0 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => transfersPage > 1 && setTransfersPage(transfersPage - 1)}
                  disabled={transfersPage <= 1}
                  className="h-8 px-3"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-3">
                  Page {transfersPage} of {transfersTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => transfersPage < transfersTotalPages && setTransfersPage(transfersPage + 1)}
                  disabled={transfersPage >= transfersTotalPages}
                  className="h-8 px-3"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Right: Total count */}
            <div className="text-sm text-muted-foreground">
              Total: {transfersTotalCount}
            </div>
          </div>
        </div>
      </div>

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
