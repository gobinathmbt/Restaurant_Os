import { Check, Circle, Clock, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { inventoryServices } from '@/api/services';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

interface ExecutionStage {
  stage: string;
  timestamp: string;
  updatedBy?: {
    _id: string;
    name: string;
  };
  updatedByName?: string;
  notes?: string;
}

interface ExecutionStageTimelineProps {
  executionStages: ExecutionStage[];
  className?: string;
  transferId?: string;
  sourceLocationId?: string;
  onStageUpdate?: () => void;
}

const STAGE_DEFINITIONS = [
  { key: 'PROCESS_STARTED', label: 'Process Started', description: 'Transfer initiated' },
  { key: 'PREPARING_STOCK', label: 'Preparing Stock', description: 'Items being prepared' },
  { key: 'LOADING_INTO_VEHICLE', label: 'Loading', description: 'Loading into vehicle' },
  { key: 'DISPATCHED', label: 'Dispatched', description: 'Vehicle dispatched' },
  { key: 'IN_TRANSIT', label: 'In Transit', description: 'On the way' },
  { key: 'ARRIVED_AT_DESTINATION', label: 'Arrived', description: 'Reached destination' },
  { key: 'UNLOADING', label: 'Unloading', description: 'Unloading items' },
  { key: 'GOODS_RECEIVED_CONFIRMED', label: 'Goods Received', description: 'Receipt confirmed' },
  { key: 'PROCESS_COMPLETED', label: 'Completed', description: 'Process completed' },
];

export default function ExecutionStageTimeline({
  executionStages,
  className,
  transferId,
  sourceLocationId,
  onStageUpdate,
}: ExecutionStageTimelineProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isStarting, setIsStarting] = useState(false);

  const isSuperAdmin = ['company_super_admin_primary', 'company_super_admin_secondary'].includes(user?.role || '');

  // Check if user has access to source location
  const hasSourceAccess = () => {
    if (isSuperAdmin) return true;
    if (!sourceLocationId) return false;

    const userLocationIds = [
      ...(user?.branchIds || []),
      ...(user?.warehouseIds || [])
    ];

    return userLocationIds.includes(sourceLocationId);
  };

  // Create a map of completed stages
  const completedStagesMap = new Map<string, ExecutionStage>();
  executionStages.forEach(stage => {
    completedStagesMap.set(stage.stage, stage);
  });

  // Get current stage (last completed stage)
  const currentStage = executionStages.length > 0 
    ? executionStages[executionStages.length - 1].stage 
    : null;

  // Find current stage index
  const currentStageIndex = STAGE_DEFINITIONS.findIndex(
    stage => stage.key === currentStage
  );

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStageStatus = (stageKey: string, index: number): 'completed' | 'current' | 'pending' => {
    if (completedStagesMap.has(stageKey)) {
      // If this is PROCESS_COMPLETED stage, it should always show as completed (green), not current
      if (stageKey === 'PROCESS_COMPLETED') {
        return 'completed';
      }
      // Otherwise, if it's the current (last) stage, show as current (blue)
      return stageKey === currentStage ? 'current' : 'completed';
    }
    return 'pending';
  };

  const getStageIcon = (status: 'completed' | 'current' | 'pending') => {
    switch (status) {
      case 'completed':
        return <Check className="h-5 w-5 text-white" />;
      case 'current':
        return <Clock className="h-5 w-5 text-white" />;
      case 'pending':
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStageColor = (status: 'completed' | 'current' | 'pending') => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'current':
        return 'bg-blue-500';
      case 'pending':
        return 'bg-gray-200';
    }
  };

  // Check if PROCESS_STARTED stage already exists
  const hasProcessStarted = executionStages.some(stage => stage.stage === 'PROCESS_STARTED');

  const handleStartWork = async () => {
    if (!transferId) return;
    
    // Prevent duplicate calls if already starting or already started
    if (isStarting || hasProcessStarted) {
      return;
    }
    
    try {
      setIsStarting(true);
      
      await inventoryServices.updateTransferStage(transferId, {
        stage: 'PROCESS_STARTED',
        notes: 'Transfer process started by source location'
      });

      toast({
        title: "Success",
        description: "Work started successfully",
        variant: "success",
      });

      if (onStageUpdate) {
        onStageUpdate();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to start work",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Execution Timeline</CardTitle>
        <CardDescription>
          Track the progress of stock transfer through all stages
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasProcessStarted ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-gray-100 p-4 mb-4">
              <Play className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No stages yet</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {hasSourceAccess() 
                ? 'Click "Start Work" to begin the transfer process'
                : 'Waiting for source location to start the transfer process'}
            </p>
            {transferId && hasSourceAccess() && (
              <Button
                onClick={handleStartWork}
                disabled={isStarting}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="h-4 w-4 mr-2" />
                {isStarting ? 'Starting...' : 'Start Work'}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="relative">
              {/* Vertical line connecting stages */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

              <div className="space-y-6">
                {STAGE_DEFINITIONS.map((stageDef, index) => {
                  const status = getStageStatus(stageDef.key, index);
                  const stageData = completedStagesMap.get(stageDef.key);

                  return (
                    <div key={stageDef.key} className="relative flex gap-4">
                      {/* Stage icon */}
                      <div className={cn(
                        'relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-4 border-background',
                        getStageColor(status)
                      )}>
                        {getStageIcon(status)}
                      </div>

                      {/* Stage content */}
                      <div className="flex-1 pb-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className={cn(
                                'font-semibold',
                                status === 'current' && 'text-blue-600',
                                status === 'completed' && 'text-green-600',
                                status === 'pending' && 'text-muted-foreground'
                              )}>
                                {stageDef.label}
                              </h4>
                              {status === 'current' && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                                  Current
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {stageDef.description}
                            </p>

                            {stageData && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    {formatDate(stageData.timestamp)}
                                  </span>
                                </div>
                                {(stageData.updatedBy?.name || stageData.updatedByName) && (
                                  <div className="text-sm text-muted-foreground">
                                    Updated by: <span className="font-medium">
                                      {stageData.updatedBy?.name || stageData.updatedByName}
                                    </span>
                                  </div>
                                )}
                                {stageData.notes && (
                                  <div className="mt-2 p-2 bg-muted rounded-md">
                                    <p className="text-sm text-muted-foreground">
                                      <span className="font-medium">Notes:</span> {stageData.notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Progress indicator */}
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm text-muted-foreground">
                  {executionStages.length} of {STAGE_DEFINITIONS.length} stages completed
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(executionStages.length / STAGE_DEFINITIONS.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
