import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface Exception {
  _id: string;
  type: 'damage' | 'missing' | 'excess';
  quantity: number;
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
}

interface ExceptionSummaryBadgesProps {
  exceptions: Exception[];
}

export default function ExceptionSummaryBadges({ exceptions }: ExceptionSummaryBadgesProps) {
  if (!exceptions || exceptions.length === 0) {
    return <span className="text-sm text-muted-foreground">No exceptions</span>;
  }

  // Count exceptions by type
  const damageCount = exceptions.filter(ex => ex.type === 'damage').length;
  const missingCount = exceptions.filter(ex => ex.type === 'missing').length;
  const excessCount = exceptions.filter(ex => ex.type === 'excess').length;

  // Check for high severity unresolved exceptions
  const hasHighSeverity = exceptions.some(ex => ex.severity === 'high' && !ex.resolved);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {damageCount > 0 && (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          Damage: {damageCount}
        </Badge>
      )}
      {missingCount > 0 && (
        <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
          Missing: {missingCount}
        </Badge>
      )}
      {excessCount > 0 && (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          Excess: {excessCount}
        </Badge>
      )}
      {hasHighSeverity && (
        <div className="flex items-center gap-1 text-red-600" title="High severity exception">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs font-semibold">HIGH</span>
        </div>
      )}
    </div>
  );
}
