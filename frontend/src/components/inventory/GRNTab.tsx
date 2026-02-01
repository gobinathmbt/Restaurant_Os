import { useState, useEffect } from 'react';
import { Plus, Eye, Package, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
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
import GRNFormModal from '@/components/inventory/GRNFormModal';

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
      <div className="h-full flex flex-col bg-background">
        {/* Fixed Header */}
        <div className="bg-background border-b flex-shrink-0">
          <div className="px-6 py-3">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Stats Chips */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="px-3 py-1 text-sm">
                  Total GRNs: {grnsTotalCount}
                </Badge>
              </div>

              {/* Search */}
              <div className="flex-1 max-w-xs">
                <Input
                  placeholder="Search GRNs..."
                  value={grnsSearch}
                  onChange={(e) => setGrnsSearch(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Filters */}
              {(isSuperAdmin || isMultiBranchAdmin) && (
                <div className="flex items-center gap-2">
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
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={fetchGRNs}
                disabled={grnsLoading}
                className="h-9 w-9"
              >
                <RefreshCw className={`h-4 w-4 ${grnsLoading ? 'animate-spin' : ''}`} />
              </Button>

              {/* Add Button */}
              <Button
                variant="default"
                size="icon"
                onClick={handleCreateGRN}
                className="h-9 w-9"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {grnsLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : grns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No GRNs found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {grnsSearch
                  ? 'Try adjusting your search'
                  : 'Get started by creating your first GRN'}
              </p>
              {!grnsSearch && (
                <Button onClick={handleCreateGRN}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create GRN
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 border-b">
                <TableRow>
                  <TableHead className="w-16">S.No</TableHead>
                  <TableHead>GRN Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                value={grnsRowsPerPage.toString()}
                onValueChange={(value) => {
                  setGrnsRowsPerPage(parseInt(value));
                  setGrnsPage(1);
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
            {grnsTotalPages > 0 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => grnsPage > 1 && setGrnsPage(grnsPage - 1)}
                  disabled={grnsPage <= 1}
                  className="h-8 px-3"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-3">
                  Page {grnsPage} of {grnsTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => grnsPage < grnsTotalPages && setGrnsPage(grnsPage + 1)}
                  disabled={grnsPage >= grnsTotalPages}
                  className="h-8 px-3"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Right: Total count */}
            <div className="text-sm text-muted-foreground">
              Total: {grnsTotalCount}
            </div>
          </div>
        </div>
      </div>

      <GRNFormModal
        open={isGrnFormOpen}
        onClose={() => setIsGrnFormOpen(false)}
        branchId={selectedBranch}
        onSuccess={handleGrnFormSuccess}
      />
    </>
  );
}
