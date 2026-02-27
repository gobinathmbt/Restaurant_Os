import { useState, useEffect } from 'react';
import { Eye, Truck, Package } from 'lucide-react';
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
  requestedBy: {
    _id: string;
    name: string;
  };
  requestDate: string;
  items: Array<{
    inventoryItem: {
      _id: string;
      name: string;
    };
    sentQuantity: number;
    unit: string;
  }>;
}

interface TransfersToExecuteTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
  onItemsUpdate?: () => void;
}

export default function TransfersToExecuteTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
  onItemsUpdate,
}: TransfersToExecuteTabProps) {
  const { toast } = useToast();

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    if (selectedBranch) {
      fetchTransfers();
    }
  }, [selectedBranch, page, rowsPerPage, search]);

  const fetchTransfers = async () => {
    if (!selectedBranch) return;
    
    try {
      setLoading(true);
      const response = await inventoryServices.getStockTransfers(selectedBranch, {
        page,
        limit: rowsPerPage,
        search: search || undefined,
        status: 'approved', // Only show approved transfers ready for shipment
      });

      setTransfers(response.data.data.transfers || []);
      setTotalCount(response.data.data.pagination.total);
      setTotalPages(response.data.data.pagination.pages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch transfers',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShipTransfer = async (transferId: string) => {
    try {
      // Call the ship transfer API endpoint
      await inventoryServices.shipTransfer(transferId);
      toast({
        title: "Success",
        description: "Transfer marked as shipped successfully",
      });
      fetchTransfers();
      if (onItemsUpdate) {
        onItemsUpdate();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to ship transfer',
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
      approved: { className: 'bg-blue-100 text-blue-800', label: 'Ready to Ship' },
      in_transit: { className: 'bg-purple-100 text-purple-800', label: 'In Transit' },
      completed: { className: 'bg-green-100 text-green-800', label: 'Completed' },
      cancelled: { className: 'bg-gray-100 text-gray-800', label: 'Cancelled' }
    };

    const config = statusConfig[status] || { className: 'bg-gray-100 text-gray-800', label: status };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const tableHeaders = (
    <>
      <TableHead className="w-16">S.No</TableHead>
      <TableHead>Transfer Number</TableHead>
      <TableHead>From Location</TableHead>
      <TableHead>To Location</TableHead>
      <TableHead>Items Count</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Request Date</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </>
  );

  const tableBody = transfers.map((transfer, index) => (
    <TableRow key={transfer._id}>
      <TableCell className="font-medium text-muted-foreground">
        {(page - 1) * rowsPerPage + index + 1}
      </TableCell>
      <TableCell>
        <p className="font-medium">{transfer.transferNumber}</p>
      </TableCell>
      <TableCell>{transfer.destinationLocation?.name || '-'}</TableCell>
      <TableCell>{transfer.sourceLocation?.name || '-'}</TableCell>
      <TableCell>{transfer.items?.length || 0} items</TableCell>
      <TableCell>{getStatusBadge(transfer.status)}</TableCell>
      <TableCell>{formatDate(transfer.requestDate)}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleShipTransfer(transfer._id)}
            className="text-blue-600 hover:text-blue-700"
          >
            <Truck className="h-4 w-4" />
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
    </div>
  );

  return (
    <DataTableLayout
      statChips={[
        { label: 'Ready to Ship', value: totalCount, bgColor: 'bg-blue-100', textColor: 'text-blue-800' }
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
              icon: <Package className="h-16 w-16" />,
              title: 'No transfers to execute',
              description: search
                ? 'Try adjusting your search'
                : 'All approved transfers have been shipped',
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
      onRefresh={fetchTransfers}
      storagePrefix="transfers-to-execute"
    />
  );
}
