import { useState, useEffect } from 'react';
import { Eye, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { TableHead, TableCell, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { inventoryServices } from '@/api/services';
import StockRequestViewModal from '../StockRequestViewModal';
import DataTableLayout from '@/components/common/DataTableLayout';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface Transaction {
  _id: string;
  requestNumber?: string;
  transferNumber?: string;
  type: 'request' | 'transfer';
  fromLocation: {
    _id: string;
    name: string;
  };
  toLocation: {
    _id: string;
    name: string;
  };
  status: string;
  priority: string;
  requestDate?: string;
  transferDate?: string;
  items: Array<{
    inventoryItem: {
      _id: string;
      name: string;
    };
    requestedQuantity?: number;
    sentQuantity?: number;
    unit: string;
  }>;
}

interface AllTransactionsTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
  onItemsUpdate?: () => void;
}

export default function AllTransactionsTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
  onItemsUpdate,
}: AllTransactionsTabProps) {
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  useEffect(() => {
    if (selectedBranch) {
      fetchTransactions();
    }
  }, [selectedBranch, page, rowsPerPage, search, typeFilter, statusFilter, priorityFilter, locationFilter, dateFrom, dateTo]);

  const fetchTransactions = async () => {
    if (!selectedBranch) return;
    
    try {
      setLoading(true);
      
      // Fetch both requests and transfers
      const [requestsResponse, transfersResponse] = await Promise.all([
        inventoryServices.getStockRequests(selectedBranch, {
          page: 1,
          limit: 1000, // Get all for filtering
          search: search || undefined,
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
        inventoryServices.getStockTransfers(selectedBranch, {
          page: 1,
          limit: 1000, // Get all for filtering
          search: search || undefined,
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        })
      ]);

      const requests = (requestsResponse.data.data.requests || []).map((req: any) => ({
        ...req,
        type: 'request' as const
      }));

      const transfers = (transfersResponse.data.data.transfers || []).map((trans: any) => ({
        ...trans,
        type: 'transfer' as const
      }));

      let allTransactions = [...requests, ...transfers];

      // Apply type filter
      if (typeFilter) {
        allTransactions = allTransactions.filter(t => t.type === typeFilter);
      }

      // Apply location filter
      if (locationFilter) {
        allTransactions = allTransactions.filter(t => 
          t.fromLocation._id === locationFilter || t.toLocation._id === locationFilter
        );
      }

      // Sort by date (newest first)
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.requestDate || a.transferDate || 0).getTime();
        const dateB = new Date(b.requestDate || b.transferDate || 0).getTime();
        return dateB - dateA;
      });

      // Paginate
      const startIndex = (page - 1) * rowsPerPage;
      const endIndex = startIndex + rowsPerPage;
      const paginatedTransactions = allTransactions.slice(startIndex, endIndex);

      setTransactions(paginatedTransactions);
      setTotalCount(allTransactions.length);
      setTotalPages(Math.ceil(allTransactions.length / rowsPerPage));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch transactions',
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
      completed: { className: 'bg-blue-100 text-blue-800', label: 'Completed' },
      in_transit: { className: 'bg-purple-100 text-purple-800', label: 'In Transit' }
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

  const getTypeBadge = (type: string) => {
    const typeConfig: Record<string, { className: string; label: string }> = {
      request: { className: 'bg-indigo-100 text-indigo-800', label: 'Request' },
      transfer: { className: 'bg-cyan-100 text-cyan-800', label: 'Transfer' }
    };

    const config = typeConfig[type] || { className: 'bg-gray-100 text-gray-800', label: type };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const tableHeaders = (
    <>
      <TableHead className="w-16">S.No</TableHead>
      <TableHead>Number</TableHead>
      <TableHead>Type</TableHead>
      <TableHead>From Location</TableHead>
      <TableHead>To Location</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Priority</TableHead>
      <TableHead>Date</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </>
  );

  const tableBody = transactions.map((transaction, index) => (
    <TableRow key={transaction._id}>
      <TableCell className="font-medium text-muted-foreground">
        {(page - 1) * rowsPerPage + index + 1}
      </TableCell>
      <TableCell>
        <p className="font-medium">
          {transaction.requestNumber || transaction.transferNumber || '-'}
        </p>
      </TableCell>
      <TableCell>{getTypeBadge(transaction.type)}</TableCell>
      <TableCell>{transaction.fromLocation?.name || '-'}</TableCell>
      <TableCell>{transaction.toLocation?.name || '-'}</TableCell>
      <TableCell>{getStatusBadge(transaction.status)}</TableCell>
      <TableCell>{getPriorityBadge(transaction.priority)}</TableCell>
      <TableCell>
        {formatDate(transaction.requestDate || transaction.transferDate || '')}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedTransaction(transaction);
              setIsViewOpen(true);
            }}
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  ));

  const filterComponent = (
    <div className="flex items-center gap-2 flex-wrap">
      {(isSuperAdmin || isMultiBranchAdmin) && (
        <Select value={selectedBranch} onValueChange={onBranchChange}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            {isSuperAdmin && (
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
      <Select value={typeFilter || "all"} onValueChange={(value) => setTypeFilter(value === "all" ? "" : value)}>
        <SelectTrigger className="w-40 h-9">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="request">Request</SelectItem>
          <SelectItem value="transfer">Transfer</SelectItem>
        </SelectContent>
      </Select>
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
          <SelectItem value="completed">Completed</SelectItem>
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
      <Select value={locationFilter || "all"} onValueChange={(value) => setLocationFilter(value === "all" ? "" : value)}>
        <SelectTrigger className="w-48 h-9">
          <SelectValue placeholder="All locations" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All locations</SelectItem>
          {branches.map((branch) => (
            <SelectItem key={branch._id} value={branch._id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={dateFrom}
        onChange={(e) => setDateFrom(e.target.value)}
        placeholder="From date"
        className="w-40 h-9"
      />
      <Input
        type="date"
        value={dateTo}
        onChange={(e) => setDateTo(e.target.value)}
        placeholder="To date"
        className="w-40 h-9"
      />
    </div>
  );

  return (
    <>
      <DataTableLayout
        statChips={[
          { label: 'Total Transactions', value: totalCount }
        ]}
        searchValue={search}
        searchPlaceholder="Search transactions..."
        onSearchChange={setSearch}
        filterConfig={{ component: filterComponent }}
        tableHeaders={tableHeaders}
        tableBody={tableBody}
        isLoading={loading}
        emptyState={
          transactions.length === 0 && !loading
            ? {
                icon: <Package className="h-16 w-16" />,
                title: 'No transactions found',
                description: search || typeFilter || statusFilter || priorityFilter || locationFilter || dateFrom || dateTo
                  ? 'Try adjusting your filters'
                  : 'No stock requests or transfers yet',
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
        onRefresh={fetchTransactions}
        storagePrefix="all-transactions"
      />

      <StockRequestViewModal
        open={isViewOpen}
        onClose={() => {
          setIsViewOpen(false);
          setSelectedTransaction(null);
        }}
        request={selectedTransaction}
        onSuccess={() => {
          setIsViewOpen(false);
          setSelectedTransaction(null);
          fetchTransactions();
          if (onItemsUpdate) {
            onItemsUpdate();
          }
        }}
      />
    </>
  );
}
