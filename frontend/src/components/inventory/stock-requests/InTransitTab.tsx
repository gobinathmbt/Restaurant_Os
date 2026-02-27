import { useState, useEffect } from 'react';
import { Eye, RefreshCw, Truck, Package } from 'lucide-react';
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

interface ExecutionStage {
  stage: string;
  timestamp: string;
  updatedBy: {
    _id: string;
    name: string;
  };
  updatedByName?: string;
  notes?: string;
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
  priority: string;
  executionStages: ExecutionStage[];
  items: Array<{
    inventoryItem: {
      _id: string;
      name: string;
    };
    sentQuantity: number;
    unit: string;
  }>;
  requestDate: string;
  expectedDeliveryDate?: string;
}

interface InTransitTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
  userRole: string;
  userBranchIds?: string[];
  userWarehouseIds?: string[];
}

export default function InTransitTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
  userRole,
  userBranchIds = [],
  userWarehouseIds = [],
}: InTransitTabProps) {
  const { toast } = useToast();

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

  // Active execution stages (excluding PROCESS_STARTED and PROCESS_COMPLETED)
  const activeStages = [
    'PREPARING_STOCK',
    'LOADING_INTO_VEHICLE',
    'DISPATCHED',
    'IN_TRANSIT',
    'ARRIVED_AT_DESTINATION',
    'UNLOADING',
    'GOODS_RECEIVED_CONFIRMED'
  ];

  useEffect(() => {
    if (selectedBranch) {
      fetchInTransitTransfers();
    }
  }, [selectedBranch, page, rowsPerPage, search, stageFilter]);

  const fetchInTransitTransfers = async () => {
    if (!selectedBranch) return;
    
    try {
      setLoading(true);
      
      // Fetch all transfers and filter for in-transit ones
      const response = await inventoryServices.getStockTransfers(selectedBranch, {
        page,
        limit: rowsPerPage,
        search: search || undefined,
        status: 'approved', // In-transit transfers have approved status
      });

      // Filter transfers that have active execution stages
      const inTransitTransfers = (response.data.data.transfers || []).filter(
        (transfer: StockTransfer) => {
          if (!transfer.executionStages || transfer.executionStages.length === 0) {
            return false;
          }
          
          // Get the latest stage
          const latestStage = transfer.executionStages[transfer.executionStages.length - 1];
          
          // Check if latest stage is in active stages
          const isInTransit = activeStages.includes(latestStage.stage);
          
          // Apply stage filter if set
          if (stageFilter && isInTransit) {
            return latestStage.stage === stageFilter;
          }
          
          return isInTransit;
        }
      );

      setTransfers(inTransitTransfers);
      setTotalCount(inTransitTransfers.length);
      setTotalPages(Math.ceil(inTransitTransfers.length / rowsPerPage));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch in-transit transfers',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStage = (transfer: StockTransfer): ExecutionStage | null => {
    if (!transfer.executionStages || transfer.executionStages.length === 0) {
      return null;
    }
    return transfer.executionStages[transfer.executionStages.length - 1];
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

  const getStageBadge = (stage: string) => {
    const stageConfig: Record<string, { className: string; label: string }> = {
      PREPARING_STOCK: { className: 'bg-blue-100 text-blue-800', label: 'Preparing' },
      LOADING_INTO_VEHICLE: { className: 'bg-indigo-100 text-indigo-800', label: 'Loading' },
      DISPATCHED: { className: 'bg-purple-100 text-purple-800', label: 'Dispatched' },
      IN_TRANSIT: { className: 'bg-yellow-100 text-yellow-800', label: 'In Transit' },
      ARRIVED_AT_DESTINATION: { className: 'bg-orange-100 text-orange-800', label: 'Arrived' },
      UNLOADING: { className: 'bg-cyan-100 text-cyan-800', label: 'Unloading' },
      GOODS_RECEIVED_CONFIRMED: { className: 'bg-green-100 text-green-800', label: 'Received' }
    };

    const config = stageConfig[stage] || { className: 'bg-gray-100 text-gray-800', label: stage };
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

  const canUpdateStage = (transfer: StockTransfer): boolean => {
    if (isSuperAdmin) return true;
    
    const currentStage = getCurrentStage(transfer);
    if (!currentStage) return false;

    // Sender stages: PREPARING_STOCK to IN_TRANSIT
    const senderStages = ['PREPARING_STOCK', 'LOADING_INTO_VEHICLE', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION'];
    // Destination stages: UNLOADING, GOODS_RECEIVED_CONFIRMED
    const destinationStages = ['UNLOADING', 'GOODS_RECEIVED_CONFIRMED'];

    const userLocationIds = [...userBranchIds, ...userWarehouseIds];
    const isSender = userLocationIds.includes(transfer.destinationLocation._id);
    const isDestination = userLocationIds.includes(transfer.sourceLocation._id);

    if (senderStages.includes(currentStage.stage) && isSender) {
      return true;
    }

    if (destinationStages.includes(currentStage.stage) && isDestination) {
      return true;
    }

    return false;
  };

  const handleViewDetails = (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    // TODO: Open transfer view modal with execution stage timeline
    toast({
      title: "View Details",
      description: `Opening details for ${transfer.transferNumber}`,
    });
  };

  const handleUpdateStage = (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    // TODO: Open stage update modal
    toast({
      title: "Update Stage",
      description: `Opening stage update for ${transfer.transferNumber}`,
    });
  };

  const tableHeaders = (
    <>
      <TableHead className="w-16">S.No</TableHead>
      <TableHead>Transfer Number</TableHead>
      <TableHead>From Location</TableHead>
      <TableHead>To Location</TableHead>
      <TableHead>Current Stage</TableHead>
      <TableHead>Priority</TableHead>
      <TableHead>Last Updated</TableHead>
      <TableHead>Items</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </>
  );

  const tableBody = transfers.map((transfer, index) => {
    const currentStage = getCurrentStage(transfer);
    
    return (
      <TableRow key={transfer._id}>
        <TableCell className="font-medium text-muted-foreground">
          {(page - 1) * rowsPerPage + index + 1}
        </TableCell>
        <TableCell>
          <p className="font-medium">{transfer.transferNumber}</p>
        </TableCell>
        <TableCell>{transfer.destinationLocation?.name || '-'}</TableCell>
        <TableCell>{transfer.sourceLocation?.name || '-'}</TableCell>
        <TableCell>
          {currentStage ? getStageBadge(currentStage.stage) : '-'}
        </TableCell>
        <TableCell>{getPriorityBadge(transfer.priority)}</TableCell>
        <TableCell>
          {currentStage ? formatDate(currentStage.timestamp) : '-'}
        </TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground">
            {transfer.items.length} item{transfer.items.length !== 1 ? 's' : ''}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewDetails(transfer)}
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {canUpdateStage(transfer) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleUpdateStage(transfer)}
                title="Update Stage"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
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
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            {(isSuperAdmin || isMultiBranchAdmin) && (
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
      <Select value={stageFilter || "all"} onValueChange={(value) => setStageFilter(value === "all" ? "" : value)}>
        <SelectTrigger className="w-48 h-9">
          <SelectValue placeholder="All stages" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stages</SelectItem>
          <SelectItem value="PREPARING_STOCK">Preparing</SelectItem>
          <SelectItem value="LOADING_INTO_VEHICLE">Loading</SelectItem>
          <SelectItem value="DISPATCHED">Dispatched</SelectItem>
          <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
          <SelectItem value="ARRIVED_AT_DESTINATION">Arrived</SelectItem>
          <SelectItem value="UNLOADING">Unloading</SelectItem>
          <SelectItem value="GOODS_RECEIVED_CONFIRMED">Received</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <>
      <DataTableLayout
        statChips={[
          { label: 'In-Transit Transfers', value: totalCount }
        ]}
        searchValue={search}
        searchPlaceholder="Search transfers..."
        onSearchChange={setSearch}
        filterConfig={{ component: filterComponent }}
        tableHeaders={tableHeaders}
        tableBody={tableBody}
        isLoading={loading}
        emptyState={
          transfers.length === 0 && !loading
            ? {
                icon: <Truck className="h-16 w-16" />,
                title: 'No in-transit transfers',
                description: search || stageFilter
                  ? 'Try adjusting your filters'
                  : 'All transfers are either pending or completed',
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
        onRefresh={fetchInTransitTransfers}
        storagePrefix="in-transit-transfers"
      />
    </>
  );
}
