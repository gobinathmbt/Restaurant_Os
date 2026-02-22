import { useState, useEffect, useCallback } from 'react';
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
import DataTableLayout from '@/components/common/DataTableLayout';
import GRNFormModal from '@/components/inventory/GRNFormModal';
import GRNViewModal from '@/components/inventory/GRNViewModal';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface GRN {
  _id: string;
  grnNumber: string;
  branch: string | {
    _id: string;
    name: string;
    code: string;
  };
  supplier: {
    _id: string;
    name: string;
  };
  receivedBy?: {
    _id: string;
    name: string;
    email?: string;
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
  const [isLoadingGrns, setIsLoadingGrns] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isGrnFormOpen, setIsGrnFormOpen] = useState(false);
  const [isGrnViewOpen, setIsGrnViewOpen] = useState(false);
  const [selectedGrnId, setSelectedGrnId] = useState<string>('');
  const [selectedGrnBranchId, setSelectedGrnBranchId] = useState<string>('');

  // Infinite scroll
  const [infiniteScrollPage, setInfiniteScrollPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [paginationEnabled, setPaginationEnabled] = useState(true);

  // Set default branch to "all" for super admin and multi-branch admin
  useEffect(() => {
    if (!selectedBranch && branches.length > 0) {
      if (isSuperAdmin || isMultiBranchAdmin) {
        onBranchChange('all');
      }
    }
  }, [branches, selectedBranch, isSuperAdmin, isMultiBranchAdmin, onBranchChange]);

  const fetchGRNs = useCallback(async () => {
    if (!selectedBranch) return;
    
    try {
      setIsLoadingGrns(true);
      const response = await inventoryServices.getGRNs(selectedBranch, {
        page: currentPage,
        limit: rowsPerPage,
        search: searchValue || undefined
      });

      setGrns(response.data.data.grns || []);
      setTotalCount(response.data.data.pagination.total);
      setTotalPages(response.data.data.pagination.pages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch GRNs',
        variant: "destructive",
      });
    } finally {
      setIsLoadingGrns(false);
    }
  }, [selectedBranch, currentPage, rowsPerPage, searchValue, toast]);

  const fetchGRNsInfinite = useCallback(async (page: number, reset: boolean = false) => {
    if (!selectedBranch) return;

    try {
      if (reset) {
        setIsLoadingGrns(true);
      } else {
        setIsLoadingMore(true);
      }

      const response = await inventoryServices.getGRNs(selectedBranch, {
        page: page,
        limit: 20,
        search: searchValue || undefined
      });

      const fetchedGrns = response.data.data.grns || [];
      const pagination = response.data.data.pagination;

      if (reset) {
        setGrns(fetchedGrns);
      } else {
        setGrns((prev) => [...prev, ...fetchedGrns]);
      }

      setTotalCount(pagination.total);
      setTotalPages(pagination.pages);
      setHasMore(page < pagination.pages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to fetch GRNs',
        variant: "destructive",
      });
    } finally {
      setIsLoadingGrns(false);
      setIsLoadingMore(false);
    }
  }, [selectedBranch, searchValue, toast]);

  useEffect(() => {
    if (selectedBranch) {
      if (paginationEnabled) {
        fetchGRNs();
      } else {
        setGrns([]);
        setInfiniteScrollPage(1);
        setHasMore(true);
        fetchGRNsInfinite(1, true);
      }
    }
  }, [selectedBranch, currentPage, rowsPerPage, searchValue, paginationEnabled, fetchGRNs, fetchGRNsInfinite]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && !paginationEnabled) {
      const nextPage = infiniteScrollPage + 1;
      setInfiniteScrollPage(nextPage);
      fetchGRNsInfinite(nextPage, false);
    }
  };

  const handleCreateGRN = () => {
    setIsGrnFormOpen(true);
  };

  const handleViewGRN = (grnId: string, branchId: string) => {
    setSelectedGrnId(grnId);
    setSelectedGrnBranchId(branchId);
    setIsGrnViewOpen(true);
  };

  const handleGrnFormSuccess = () => {
    setIsGrnFormOpen(false);
    handleRefresh();
    if (onItemsUpdate) {
      onItemsUpdate();
    }
  };

  const handleRefresh = useCallback(() => {
    // Refresh works for all branches now
    if (!selectedBranch) {
      return;
    }
    
    if (paginationEnabled) {
      fetchGRNs();
    } else {
      setGrns([]);
      setInfiniteScrollPage(1);
      setHasMore(true);
      fetchGRNsInfinite(1, true);
    }
  }, [selectedBranch, paginationEnabled, fetchGRNs, fetchGRNsInfinite]);

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
    <div className="h-full flex flex-col">
      <DataTableLayout
        statChips={[
          { label: 'Total GRNs', value: totalCount, variant: 'default' },
        ]}
        actionButtons={[
          {
            icon: <Plus className="h-4 w-4" />,
            tooltip: 'Create GRN',
            onClick: handleCreateGRN,
            variant: 'default',
          },
        ]}
        searchValue={searchValue}
        searchPlaceholder="Search GRNs..."
        onSearchChange={setSearchValue}
        filterConfig={{
          component: (
            <div className="flex items-center gap-2">
              {(isSuperAdmin || isMultiBranchAdmin) && branches.length > 0 && (
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
          ),
        }}
        tableHeaders={
          <>
            <TableHead className="w-16">S.No</TableHead>
            <TableHead>GRN Number</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Received By</TableHead>
            <TableHead>Received Date</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </>
        }
        tableBody={
          <>
            {grns.map((grn, index) => {
              const serialNumber = paginationEnabled
                ? (currentPage - 1) * rowsPerPage + index + 1
                : index + 1;

              return (
                <TableRow key={grn._id}>
                  <TableCell className="font-medium text-muted-foreground">
                    {serialNumber}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{grn.grnNumber}</p>
                  </TableCell>
                  <TableCell>{grn.supplier?.name || '-'}</TableCell>
                  <TableCell>{grn.receivedBy?.name || '-'}</TableCell>
                  <TableCell>{formatDate(grn.receivedDate)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(grn.totalAmount)}
                  </TableCell>
                  <TableCell>{getStatusBadge(grn.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="View GRN details"
                      onClick={() => {
                        if (!grn._id) return;
                        const branchId = typeof grn.branch === 'string' 
                          ? grn.branch 
                          : (grn.branch?._id || selectedBranch);
                        if (branchId) {
                          handleViewGRN(grn._id, branchId);
                        }
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </>
        }
        isLoading={isLoadingGrns}
        emptyState={
          grns.length === 0
            ? {
                icon: <Package className="h-12 w-12" />,
                title: 'No GRNs found',
                description:
                  searchValue
                    ? 'Try adjusting your search'
                    : 'Get started by creating your first GRN',
                action: !searchValue && selectedBranch !== 'all' ? (
                  <Button onClick={handleCreateGRN}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create GRN
                  </Button>
                ) : undefined,
              }
            : undefined
        }
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={(rows) => {
          setRowsPerPage(rows);
          setCurrentPage(1);
        }}
        onRefresh={handleRefresh}
        storagePrefix="grn"
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onPaginationChange={(enabled) => setPaginationEnabled(enabled)}
      />

      <GRNFormModal
        open={isGrnFormOpen}
        onClose={() => setIsGrnFormOpen(false)}
        branchId={selectedBranch !== 'all' ? selectedBranch : undefined}
        onSuccess={handleGrnFormSuccess}
      />

      <GRNViewModal
        open={isGrnViewOpen}
        onClose={() => setIsGrnViewOpen(false)}
        grnId={selectedGrnId}
        branchId={selectedGrnBranchId}
      />
    </div>
  );
}
