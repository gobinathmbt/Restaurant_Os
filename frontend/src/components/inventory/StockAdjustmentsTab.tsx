import { useState, useEffect } from 'react';
import { Plus, Eye, Package } from 'lucide-react';
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
import StockAdjustmentFormModal from '@/components/inventory/StockAdjustmentFormModal';
import DataTableLayout from '@/components/common/DataTableLayout';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface StockAdjustment {
  _id: string;
  adjustmentNumber: string;
  inventoryItem: {
    _id: string;
    name: string;
  };
  adjustmentType: string;
  quantity: number;
  reason: string;
  adjustedBy: {
    _id: string;
    name: string;
  };
  adjustmentDate: string;
}

interface StockAdjustmentsTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
  onItemsUpdate?: () => void;
}

export default function StockAdjustmentsTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
  onItemsUpdate,
}: StockAdjustmentsTabProps) {
  const { toast } = useToast();

  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(true);
  const [adjustmentsSearch, setAdjustmentsSearch] = useState('');
  const [adjustmentsPage, setAdjustmentsPage] = useState(1);
  const [adjustmentsRowsPerPage, setAdjustmentsRowsPerPage] = useState(10);
  const [adjustmentsTotalCount, setAdjustmentsTotalCount] = useState(0);
  const [adjustmentsTotalPages, setAdjustmentsTotalPages] = useState(0);
  const [isAdjustmentFormOpen, setIsAdjustmentFormOpen] = useState(false);

  useEffect(() => {
    if (selectedBranch) {
      fetchAdjustments();
    }
  }, [selectedBranch, adjustmentsPage, adjustmentsRowsPerPage, adjustmentsSearch]);

  const fetchAdjustments = async () => {
    if (!selectedBranch) return;
    
    try {
      setAdjustmentsLoading(true);
      const response = await inventoryServices.getStockAdjustments(selectedBranch, {
        page: adjustmentsPage,
        limit: adjustmentsRowsPerPage,
        search: adjustmentsSearch || undefined
      });

      setAdjustments(response.data.data.adjustments || []);
      setAdjustmentsTotalCount(response.data.data.pagination.total);
      setAdjustmentsTotalPages(response.data.data.pagination.totalPages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch stock adjustments',
        variant: "destructive",
      });
    } finally {
      setAdjustmentsLoading(false);
    }
  };

  const handleCreateAdjustment = () => {
    setIsAdjustmentFormOpen(true);
  };

  const handleAdjustmentFormSuccess = () => {
    setIsAdjustmentFormOpen(false);
    fetchAdjustments();
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

  const getAdjustmentTypeBadge = (type: string) => {
    const typeConfig: Record<string, { variant: any; label: string }> = {
      increase: { variant: 'default', label: 'Increase' },
      decrease: { variant: 'destructive', label: 'Decrease' },
      correction: { variant: 'secondary', label: 'Correction' }
    };

    const config = typeConfig[type] || { variant: 'secondary', label: type };
    return <Badge variant={config.variant} className={config.variant === 'default' ? 'bg-blue-100 text-blue-800' : ''}>{config.label}</Badge>;
  };

  return (
    <>
      <DataTableLayout
        statChips={[
          { label: 'Total Adjustments', value: adjustmentsTotalCount, variant: 'default' },
        ]}
        actionButtons={[
          {
            icon: <Plus className="h-4 w-4" />,
            tooltip: 'Create adjustment',
            onClick: handleCreateAdjustment,
            variant: 'default',
          },
        ]}
        searchValue={adjustmentsSearch}
        searchPlaceholder="Search adjustments..."
        onSearchChange={setAdjustmentsSearch}
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
            </div>
          )
        }}
        tableHeaders={
          <>
            <TableHead className="w-16">S.No</TableHead>
            <TableHead>Adjustment Number</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Adjusted By</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </>
        }
        tableBody={
          <>
            {adjustments.map((adjustment, index) => (
              <TableRow key={adjustment._id}>
                <TableCell className="font-medium text-muted-foreground">
                  {(adjustmentsPage - 1) * adjustmentsRowsPerPage + index + 1}
                </TableCell>
                <TableCell>
                  <p className="font-medium">{adjustment.adjustmentNumber}</p>
                </TableCell>
                <TableCell>{adjustment.inventoryItem?.name || '-'}</TableCell>
                <TableCell>{getAdjustmentTypeBadge(adjustment.adjustmentType)}</TableCell>
                <TableCell className="text-right font-medium">
                  {adjustment.quantity}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {adjustment.reason.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>{adjustment.adjustedBy?.name || '-'}</TableCell>
                <TableCell>{formatDate(adjustment.adjustmentDate)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </>
        }
        isLoading={adjustmentsLoading}
        emptyState={
          adjustments.length === 0
            ? {
                icon: <Package className="h-12 w-12" />,
                title: 'No adjustments found',
                description: adjustmentsSearch
                  ? 'Try adjusting your search'
                  : 'Get started by creating your first stock adjustment',
                action: !adjustmentsSearch ? (
                  <Button onClick={handleCreateAdjustment}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Adjustment
                  </Button>
                ) : undefined,
              }
            : undefined
        }
        currentPage={adjustmentsPage}
        totalPages={adjustmentsTotalPages}
        totalCount={adjustmentsTotalCount}
        rowsPerPage={adjustmentsRowsPerPage}
        onPageChange={setAdjustmentsPage}
        onRowsPerPageChange={setAdjustmentsRowsPerPage}
        onRefresh={fetchAdjustments}
        cookiePrefix="inventory-adjustments"
      />

      <StockAdjustmentFormModal
        open={isAdjustmentFormOpen}
        onClose={() => setIsAdjustmentFormOpen(false)}
        branchId={selectedBranch}
        onSuccess={handleAdjustmentFormSuccess}
      />
    </>
  );
}
