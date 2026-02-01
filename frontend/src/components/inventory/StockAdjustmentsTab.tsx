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
import StockAdjustmentFormModal from '@/components/inventory/StockAdjustmentFormModal';

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
      <div className="h-full flex flex-col bg-background">
        {/* Fixed Header */}
        <div className="bg-background border-b flex-shrink-0">
          <div className="px-6 py-3">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Stats Chips */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="px-3 py-1 text-sm">
                  Total Adjustments: {adjustmentsTotalCount}
                </Badge>
              </div>

              {/* Search */}
              <div className="flex-1 max-w-xs">
                <Input
                  placeholder="Search adjustments..."
                  value={adjustmentsSearch}
                  onChange={(e) => setAdjustmentsSearch(e.target.value)}
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
                onClick={fetchAdjustments}
                disabled={adjustmentsLoading}
                className="h-9 w-9"
              >
                <RefreshCw className={`h-4 w-4 ${adjustmentsLoading ? 'animate-spin' : ''}`} />
              </Button>

              {/* Add Button */}
              <Button
                variant="default"
                size="icon"
                onClick={handleCreateAdjustment}
                className="h-9 w-9"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {adjustmentsLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : adjustments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No adjustments found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {adjustmentsSearch
                  ? 'Try adjusting your search'
                  : 'Get started by creating your first stock adjustment'}
              </p>
              {!adjustmentsSearch && (
                <Button onClick={handleCreateAdjustment}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Adjustment
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 border-b">
                <TableRow>
                  <TableHead className="w-16">S.No</TableHead>
                  <TableHead>Adjustment Number</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Adjusted By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                value={adjustmentsRowsPerPage.toString()}
                onValueChange={(value) => {
                  setAdjustmentsRowsPerPage(parseInt(value));
                  setAdjustmentsPage(1);
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
            {adjustmentsTotalPages > 0 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => adjustmentsPage > 1 && setAdjustmentsPage(adjustmentsPage - 1)}
                  disabled={adjustmentsPage <= 1}
                  className="h-8 px-3"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-3">
                  Page {adjustmentsPage} of {adjustmentsTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => adjustmentsPage < adjustmentsTotalPages && setAdjustmentsPage(adjustmentsPage + 1)}
                  disabled={adjustmentsPage >= adjustmentsTotalPages}
                  className="h-8 px-3"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Right: Total count */}
            <div className="text-sm text-muted-foreground">
              Total: {adjustmentsTotalCount}
            </div>
          </div>
        </div>
      </div>

      <StockAdjustmentFormModal
        open={isAdjustmentFormOpen}
        onClose={() => setIsAdjustmentFormOpen(false)}
        branchId={selectedBranch}
        onSuccess={handleAdjustmentFormSuccess}
      />
    </>
  );
}
