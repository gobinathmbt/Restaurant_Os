import { Button } from '@/components/ui/button';
import { TableHead, TableCell, TableRow } from '@/components/ui/table';
import ExceptionSummaryBadges from './ExceptionSummaryBadges';

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

interface TransfersWithExceptionsTableProps {
  transfers: StockTransfer[];
  onSelectTransfer: (transfer: StockTransfer) => void;
  renderHeadersOnly?: boolean;
  page?: number;
  rowsPerPage?: number;
}

export default function TransfersWithExceptionsTable({
  transfers,
  onSelectTransfer,
  renderHeadersOnly = false,
  page = 1,
  rowsPerPage = 10,
}: TransfersWithExceptionsTableProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFirstReportedDate = (exceptions: Exception[]) => {
    if (!exceptions || exceptions.length === 0) return '-';
    const sortedExceptions = [...exceptions].sort((a, b) => 
      new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime()
    );
    return formatDate(sortedExceptions[0].reportedAt);
  };

  if (renderHeadersOnly) {
    return (
      <>
        <TableHead className="w-16">S.No</TableHead>
        <TableHead>Transfer #</TableHead>
        <TableHead>From</TableHead>
        <TableHead>To</TableHead>
        <TableHead>Exceptions</TableHead>
        <TableHead>Reported Date</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </>
    );
  }

  return (
    <>
      {transfers.map((transfer, index) => (
        <TableRow key={transfer._id}>
          <TableCell className="font-medium text-muted-foreground">
            {(page - 1) * rowsPerPage + index + 1}
          </TableCell>
          <TableCell>
            <p className="font-medium">{transfer.transferNumber}</p>
          </TableCell>
          <TableCell>
            <p className="text-sm">{transfer.sourceLocation?.name || '-'}</p>
          </TableCell>
          <TableCell>
            <p className="text-sm">{transfer.destinationLocation?.name || '-'}</p>
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-2">
              <ExceptionSummaryBadges exceptions={transfer.exceptions} />
              {transfer.unresolvedExceptionCount > 0 && (
                <span className="text-xs font-semibold text-yellow-700">
                  {transfer.unresolvedExceptionCount} unresolved
                </span>
              )}
            </div>
          </TableCell>
          <TableCell>
            {getFirstReportedDate(transfer.exceptions)}
          </TableCell>
          <TableCell className="text-right">
            <Button
              variant="default"
              size="sm"
              onClick={() => onSelectTransfer(transfer)}
            >
              Resolve
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
