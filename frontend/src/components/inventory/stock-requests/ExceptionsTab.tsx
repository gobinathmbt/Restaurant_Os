import { useState, useEffect } from 'react';
import { Eye, AlertTriangle, CheckCircle } from 'lucide-react';
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
import DataTableLayout from '@/components/common/DataTableLayout';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface Exception {
  _id: string;
  type: 'damage' | 'missing' | 'excess';
  inventoryItem: {
    _id: string;
    name: string;
  };
  quantity: number;
  unit: string;
  description?: string;
  reportedBy: {
    _id: string;
    name: string;
  };
  reportedAt: string;
  resolved: boolean;
  resolutionNotes?: string;
}

interface StockTransfer {
  _id: string;
  transferNumber: string;
  destinationLocation: {
    _id: string;
    name: string;
  };
  sourceLocation: {
    _id: string;
    name: string;
  };
  status: string;
  exceptions: Exception[];
}

interface ExceptionRow {
  transferId: string;
  transferNumber: string;
  destinationLocation: string;
  sourceLocation: string;
  exception: Exception;
}

interface ExceptionsTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
  onItemsUpdate?: () => void;
}

export default function ExceptionsTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
  onItemsUpdate,
}: ExceptionsTabProps) {
  const { toast } = useToast();

  const [exceptionRows, setExceptionRows] = useState<ExceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    if (selectedBranch) {
      fetchExceptions();
    }
  }, [selectedBranch, page, rowsPerPage, search, typeFilter, resolvedFilter]);

  const fetchExceptions = async () => {
    if (!selectedBranch) return;
    
    try {
      setLoading(true);
      
      // Fetch all transfers (exceptions are nested, so we need all transfers to filter)
      const response = await inventoryServices.getStockTransfers(selectedBranch, {
        page: 1,
        limit: 500, // Reasonable limit for exception filtering
        search: search || undefined,
      });

      const transfers = response.data.data.transfers || [];

      // Filter transfers with exceptions and flatten to exception rows
      const rows: ExceptionRow[] = [];
      
      transfers.forEach((transfer: StockTransfer) => {
        if (transfer.exceptions && transfer.exceptions.length > 0) {
          transfer.exceptions.forEach((exception: Exception) => {
            // Apply filters
            if (typeFilter && exception.type !== typeFilter) return;
            if (resolvedFilter === 'resolved' && !exception.resolved) return;
            if (resolvedFilter === 'unresolved' && exception.resolved) return;

            rows.push({
              transferId: transfer._id,
              transferNumber: transfer.transferNumber,
              destinationLocation: transfer.destinationLocation?.name || '-',
              sourceLocation: transfer.sourceLocation?.name || '-',
              exception
            });
          });
        }
      });

      // Sort by reported date (newest first)
      rows.sort((a, b) => {
        const dateA = new Date(a.exception.reportedAt).getTime();
        const dateB = new Date(b.exception.reportedAt).getTime();
        return dateB - dateA;
      });

      // Paginate
      const startIndex = (page - 1) * rowsPerPage;
      const endIndex = startIndex + rowsPerPage;
      const paginatedRows = rows.slice(startIndex, endIndex);

      setExceptionRows(paginatedRows);
      setTotalCount(rows.length);
      setTotalPages(Math.ceil(rows.length / rowsPerPage));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch exceptions',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkResolved = async (transferId: string, exceptionId: string) => {
    try {
      // TODO: Implement API call to mark exception as resolved
      // await inventoryServices.resolveException(transferId, exceptionId);
      
      toast({
        title: "Info",
        description: "Exception resolution feature coming soon",
      });
      // fetchExceptions();
      // if (onItemsUpdate) {
      //   onItemsUpdate();
      // }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to resolve exception',
        variant: "destructive",
      });
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

  const getExceptionTypeBadge = (type: string) => {
    const typeConfig: Record<string, { className: string; label: string }> = {
      damage: { className: 'bg-red-100 text-red-800', label: 'Damage' },
      missing: { className: 'bg-orange-100 text-orange-800', label: 'Missing' },
      excess: { className: 'bg-blue-100 text-blue-800', label: 'Excess' }
    };

    const config = typeConfig[type] || { className: 'bg-gray-100 text-gray-800', label: type };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getStatusBadge = (resolved: boolean) => {
    if (resolved) {
      return <Badge className="bg-green-100 text-green-800">Resolved</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
  };

  const tableHeaders = (
    <>
      <TableHead className="w-16">S.No</TableHead>
      <TableHead>Transfer Number</TableHead>
      <TableHead>Exception Type</TableHead>
      <TableHead>Item</TableHead>
      <TableHead>Quantity</TableHead>
      <TableHead>Reported By</TableHead>
      <TableHead>Reported At</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </>
  );

  const tableBody = exceptionRows.map((row, index) => (
    <TableRow key={`${row.transferId}-${row.exception._id}`}>
      <TableCell className="font-medium text-muted-foreground">
        {(page - 1) * rowsPerPage + index + 1}
      </TableCell>
      <TableCell>
        <p className="font-medium">{row.transferNumber}</p>
        <p className="text-xs text-muted-foreground">
          {row.destinationLocation} → {row.sourceLocation}
        </p>
      </TableCell>
      <TableCell>{getExceptionTypeBadge(row.exception.type)}</TableCell>
      <TableCell>
        <p className="font-medium">{row.exception.inventoryItem?.name || '-'}</p>
        {row.exception.description && (
          <p className="text-xs text-muted-foreground">{row.exception.description}</p>
        )}
      </TableCell>
      <TableCell>
        {row.exception.quantity} {row.exception.unit}
      </TableCell>
      <TableCell>{row.exception.reportedBy?.name || '-'}</TableCell>
      <TableCell>{formatDate(row.exception.reportedAt)}</TableCell>
      <TableCell>{getStatusBadge(row.exception.resolved)}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // TODO: Open transfer view modal
              toast({
                title: "View Details",
                description: `Opening details for ${row.transferNumber}`,
              });
            }}
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {!row.exception.resolved && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleMarkResolved(row.transferId, row.exception._id)}
              className="text-green-600 hover:text-green-700"
              title="Mark Resolved"
            >
              <CheckCircle className="h-4 w-4" />
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
          <SelectItem value="damage">Damage</SelectItem>
          <SelectItem value="missing">Missing</SelectItem>
          <SelectItem value="excess">Excess</SelectItem>
        </SelectContent>
      </Select>
      <Select value={resolvedFilter || "all"} onValueChange={(value) => setResolvedFilter(value === "all" ? "" : value)}>
        <SelectTrigger className="w-40 h-9">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="unresolved">Pending</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const unresolvedCount = exceptionRows.filter(row => !row.exception.resolved).length;

  return (
    <>
      <DataTableLayout
        statChips={[
          { label: 'Total Exceptions', value: totalCount },
          { label: 'Pending', value: unresolvedCount, bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' }
        ]}
        searchValue={search}
        searchPlaceholder="Search exceptions..."
        onSearchChange={setSearch}
        filterConfig={{ component: filterComponent }}
        tableHeaders={tableHeaders}
        tableBody={tableBody}
        isLoading={loading}
        emptyState={
          exceptionRows.length === 0 && !loading
            ? {
                icon: <AlertTriangle className="h-16 w-16" />,
                title: 'No exceptions found',
                description: search || typeFilter || resolvedFilter
                  ? 'Try adjusting your filters'
                  : 'No stock transfer exceptions recorded',
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
        onRefresh={fetchExceptions}
        storagePrefix="exceptions"
      />
    </>
  );
}
