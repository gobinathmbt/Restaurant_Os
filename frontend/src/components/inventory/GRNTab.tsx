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
import GRNFormModal from '@/components/inventory/GRNFormModal';
import DataTableLayout from '@/components/common/DataTableLayout';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface GRN {
  _id: string;
  grnNumber: string;
  supplier: {
    _id: string;
    name: string;
  };
  receivedDate: string;
  totalAmount: number;
  status: string;
}

interface GRNTabProps {
  selectedBranch: string;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
  isSuperAdmin: boolean;
  isMultiBranchAdmin: boolean;
  onItemsUpdate?: () => void;
}

export default function GRNTab({
  selectedBranch,
  branches,
  onBranchChange,
  isSuperAdmin,
  isMultiBranchAdmin,
  onItemsUpdate,
}: GRNTabProps) {
  const { toast } = useToast();

  const [grns, setGrns] = useState<GRN[]>([]);
  const [grnsLoading, setGrnsLoading] = useState(true);
  const [grnsSearch, setGrnsSearch] = useState('');
  const [grnsPage, setGrnsPage] = useState(1);
  const [grnsRowsPerPage, setGrnsRowsPerPage] = useState(10);
  const [grnsTotalCount, setGrnsTotalCount] = useState(0);
  const [grnsTotalPages, setGrnsTotalPages] = useState(0);
  const [isGrnFormOpen, setIsGrnFormOpen] = useState(false);

  useEffect(() => {
    if (selectedBranch) {
      fetchGRNs();
    }
  }, [selectedBranch, grnsPage, grnsRowsPerPage, grnsSearch]);

  const fetchGRNs = async () => {
    if (!selectedBranch) return;
    
    try {
      setGrnsLoading(true);
      const response = await inventoryServices.getGRNs(selectedBranch, {
        page: grnsPage,
        limit: grnsRowsPerPage,
        search: grnsSearch || undefined
      });

      setGrns(response.data.data.grns || []);
      setGrnsTotalCount(response.data.data.pagination.total);
      setGrnsTotalPages(response.data.data.pagination.totalPages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch GRNs',
        variant: "destructive",
      });
    } finally {
      setGrnsLoading(false);
    }
  };

  const handleCreateGRN = () => {
    setIsGrnFormOpen(true);
  };

  const handleGrnFormSuccess = () => {
    setIsGrnFormOpen(false);
    fetchGRNs();
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

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; label: string }> = {
      pending: { variant: 'default', label: 'Pending' },
      approved: { variant: 'default', label: 'Approved' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      completed: { variant: 'default', label: 'Completed' },
      cancelled: { variant: 'secondary', label: 'Cancelled' },
      received: { variant: 'default', label: 'Received' },
      verified: { variant: 'default', label: 'Verified' }
    };

    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant} className={config.variant === 'default' ? 'bg-green-100 text-green-800' : ''}>{config.label}</Badge>;
  };

  return (
    <>
      <DataTableLayout
        statChips={[
          { label: 'Total GRNs', value: grnsTotalCount, variant: 'default' },
        ]}
        actionButtons={[
          {
            icon: <Plus className="h-4 w-4" />,
            tooltip: 'Create GRN',
            onClick: handleCreateGRN,
            variant: 'default',
          },
        ]}
        searchValue={grnsSearch}
        searchPlaceholder="Search GRNs..."
        onSearchChange={setGrnsSearch}
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
            <TableHead>GRN Number</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Received Date</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </>
        }
        tableBody={
          <>
            {grns.map((grn, index) => (
              <TableRow key={grn._id}>
                <TableCell className="font-medium text-muted-foreground">
                  {(grnsPage - 1) * grnsRowsPerPage + index + 1}
                </TableCell>
                <TableCell>
                  <p className="font-medium">{grn.grnNumber}</p>
                </TableCell>
                <TableCell>{grn.supplier?.name || '-'}</TableCell>
                <TableCell>{formatDate(grn.receivedDate)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(grn.totalAmount)}
                </TableCell>
                <TableCell>{getStatusBadge(grn.status)}</TableCell>
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
        isLoading={grnsLoading}
        emptyState={
          grns.length === 0
            ? {
                icon: <Package className="h-12 w-12" />,
                title: 'No GRNs found',
                description: grnsSearch
                  ? 'Try adjusting your search'
                  : 'Get started by creating your first GRN',
                action: !grnsSearch ? (
                  <Button onClick={handleCreateGRN}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create GRN
                  </Button>
                ) : undefined,
              }
            : undefined
        }
        currentPage={grnsPage}
        totalPages={grnsTotalPages}
        totalCount={grnsTotalCount}
        rowsPerPage={grnsRowsPerPage}
        onPageChange={setGrnsPage}
        onRowsPerPageChange={setGrnsRowsPerPage}
        onRefresh={fetchGRNs}
        cookiePrefix="inventory-grns"
      />

      <GRNFormModal
        open={isGrnFormOpen}
        onClose={() => setIsGrnFormOpen(false)}
        branchId={selectedBranch}
        onSuccess={handleGrnFormSuccess}
      />
    </>
  );
}
