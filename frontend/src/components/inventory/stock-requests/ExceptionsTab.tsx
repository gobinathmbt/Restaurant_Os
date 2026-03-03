import { useState, useEffect } from 'react';
import { Eye, AlertTriangle } from 'lucide-react';
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
import ExceptionResolutionModal from '../ExceptionResolutionModal';
import TransfersWithExceptionsTable from '../TransfersWithExceptionsTable';

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
  severity: 'low' | 'medium' | 'high';
  description?: string;
  reportedBy: {
    _id: string;
    name: string;
  };
  reportedAt: string;
  resolved: boolean;
  resolutionAction?: string;
  resolvedBy?: {
    _id: string;
    name: string;
  };
  resolvedAt?: string;
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
  unresolvedExceptionCount: number;
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

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('exception_fix_in_progress');
  const [severityFilter, setSeverityFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);

  useEffect(() => {
    fetchTransfersWithExceptions();
  }, [page, rowsPerPage, statusFilter, severityFilter, resolvedFilter]);

  const fetchTransfersWithExceptions = async () => {
    try {
      setLoading(true);
      
      const response = await inventoryServices.getTransfersWithExceptions({
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        resolved: resolvedFilter ? resolvedFilter === 'resolved' : undefined,
        page,
        limit: rowsPerPage,
      });

      const transfersData = response.data.data.transfers || [];
      setTransfers(transfersData);
      setTotalCount(response.data.data.pagination?.total || transfersData.length);
      setTotalPages(response.data.data.pagination?.pages || Math.ceil(transfersData.length / rowsPerPage));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch transfers with exceptions',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTransfer = (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    setIsResolutionModalOpen(true);
  };

  const handleResolutionComplete = () => {
    setIsResolutionModalOpen(false);
    setSelectedTransfer(null);
    fetchTransfersWithExceptions();
    if (onItemsUpdate) {
      onItemsUpdate();
    }
  };

  const filterComponent = (
    <div className="flex items-center gap-2">
      <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
        <SelectTrigger className="w-48 h-9">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="exception_fix_in_progress">In Progress</SelectItem>
          <SelectItem value="exception_escalated">Escalated</SelectItem>
          <SelectItem value="exception_fix_complete">Resolved</SelectItem>
        </SelectContent>
      </Select>
      <Select value={severityFilter || "all"} onValueChange={(value) => setSeverityFilter(value === "all" ? "" : value)}>
        <SelectTrigger className="w-40 h-9">
          <SelectValue placeholder="All severities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All severities</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>
      <Select value={resolvedFilter || "all"} onValueChange={(value) => setResolvedFilter(value === "all" ? "" : value)}>
        <SelectTrigger className="w-40 h-9">
          <SelectValue placeholder="All resolutions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All resolutions</SelectItem>
          <SelectItem value="unresolved">Unresolved</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const unresolvedCount = transfers.reduce((sum, t) => sum + (t.unresolvedExceptionCount || 0), 0);
  const highSeverityCount = transfers.reduce((sum, t) => {
    const highSeverityExceptions = t.exceptions?.filter(ex => ex.severity === 'high' && !ex.resolved).length || 0;
    return sum + highSeverityExceptions;
  }, 0);

  return (
    <>
      <DataTableLayout
        statChips={[
          { label: 'Total Transfers', value: totalCount },
          { label: 'Unresolved Exceptions', value: unresolvedCount, bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
          { label: 'High Severity', value: highSeverityCount, bgColor: 'bg-red-100', textColor: 'text-red-800' }
        ]}
        searchValue={search}
        searchPlaceholder="Search transfers..."
        onSearchChange={setSearch}
        filterConfig={{ component: filterComponent }}
        tableHeaders={
          <TransfersWithExceptionsTable
            transfers={[]}
            onSelectTransfer={() => {}}
            renderHeadersOnly
          />
        }
        tableBody={
          <TransfersWithExceptionsTable
            transfers={transfers}
            onSelectTransfer={handleSelectTransfer}
            page={page}
            rowsPerPage={rowsPerPage}
          />
        }
        isLoading={loading}
        emptyState={
          transfers.length === 0 && !loading
            ? {
                icon: <AlertTriangle className="h-16 w-16" />,
                title: 'No exceptions found',
                description: statusFilter || severityFilter || resolvedFilter
                  ? 'Try adjusting your filters'
                  : 'No stock transfer exceptions requiring resolution',
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
        onRefresh={fetchTransfersWithExceptions}
        storagePrefix="exceptions"
      />

      {isResolutionModalOpen && selectedTransfer && (
        <ExceptionResolutionModal
          transfer={selectedTransfer}
          onClose={() => {
            setIsResolutionModalOpen(false);
            setSelectedTransfer(null);
          }}
          onResolved={handleResolutionComplete}
        />
      )}
    </>
  );
}
