import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, AlertOctagon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Exception {
  _id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
}

interface TransferStatusBadgeProps {
  status: string;
  unresolvedExceptionCount?: number;
  exceptions?: Exception[];
}

export default function TransferStatusBadge({
  status,
  unresolvedExceptionCount = 0,
  exceptions = [],
}: TransferStatusBadgeProps) {
  const hasHighSeverity = exceptions.some(ex => ex.severity === 'high' && !ex.resolved);

  // Exception-related statuses
  if (status === 'exception_fix_in_progress') {
    return (
      <div className="flex items-center gap-2">
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Exceptions Reported
        </Badge>
        {unresolvedExceptionCount > 0 && (
          <span className="text-xs font-semibold text-yellow-700">
            {unresolvedExceptionCount} unresolved
          </span>
        )}
        {hasHighSeverity && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1 text-red-600">
                  <AlertOctagon className="h-4 w-4" />
                  <span className="text-xs font-semibold">HIGH</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Contains high severity exceptions</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  if (status === 'exception_escalated') {
    return (
      <div className="flex items-center gap-2">
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 animate-pulse">
          <AlertOctagon className="h-3 w-3 mr-1" />
          ESCALATED
        </Badge>
        {unresolvedExceptionCount > 0 && (
          <span className="text-xs font-semibold text-red-700">
            {unresolvedExceptionCount} unresolved
          </span>
        )}
      </div>
    );
  }

  if (status === 'exception_fix_complete') {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        <CheckCircle className="h-3 w-3 mr-1" />
        Exceptions Resolved - Ready to Complete
      </Badge>
    );
  }

  if (status === 'force_completed') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Force Completed
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Transfer was force completed by super admin</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Return null for non-exception statuses
  return null;
}
