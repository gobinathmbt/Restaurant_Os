import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { inventoryServices } from '@/api/services';
import ExceptionCard from './ExceptionCard';
import ImpactPreviewModal from './ImpactPreviewModal';

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

interface ExceptionResolutionModalProps {
  transfer: StockTransfer;
  onClose: () => void;
  onResolved: () => void;
}

export default function ExceptionResolutionModal({
  transfer,
  onClose,
  onResolved,
}: ExceptionResolutionModalProps) {
  const { toast } = useToast();
  const [selectedExceptionId, setSelectedExceptionId] = useState<string | null>(null);
  const [resolutionAction, setResolutionAction] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [isResolving, setIsResolving] = useState(false);
  const [impactPreview, setImpactPreview] = useState<any>(null);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [currentTransfer, setCurrentTransfer] = useState<StockTransfer>(transfer);

  const unresolvedExceptions = currentTransfer.exceptions.filter(ex => !ex.resolved);

  useEffect(() => {
    // Auto-select first unresolved exception
    if (unresolvedExceptions.length > 0 && !selectedExceptionId) {
      setSelectedExceptionId(unresolvedExceptions[0]._id);
    }
  }, [unresolvedExceptions, selectedExceptionId]);

  const handleResolve = async () => {
    if (!selectedExceptionId || !resolutionAction) {
      toast({
        title: "Error",
        description: "Please select a resolution action",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsResolving(true);

      const response = await inventoryServices.resolveException(
        currentTransfer._id,
        selectedExceptionId,
        {
          resolutionAction: resolutionAction as any,
          resolutionNotes: resolutionNotes || undefined,
        }
      );

      toast({
        title: "Success",
        description: "Exception resolved successfully",
      });

      // Update current transfer with the response
      const updatedTransfer = response.data.data.transfer;
      setCurrentTransfer(updatedTransfer);

      // Check if this was the last exception
      const remainingUnresolved = updatedTransfer.exceptions.filter((ex: Exception) => !ex.resolved);
      
      if (remainingUnresolved.length === 0) {
        // All exceptions resolved - load impact preview
        await loadImpactPreview();
      } else {
        // More exceptions to resolve - select next one
        setSelectedExceptionId(remainingUnresolved[0]._id);
        setResolutionAction('');
        setResolutionNotes('');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to resolve exception',
        variant: "destructive",
      });
    } finally {
      setIsResolving(false);
    }
  };

  const loadImpactPreview = async () => {
    try {
      const response = await inventoryServices.getImpactPreview(currentTransfer._id);
      setImpactPreview(response.data.data);
      setShowImpactModal(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to load impact preview',
        variant: "destructive",
      });
    }
  };

  const handleImpactModalClose = () => {
    setShowImpactModal(false);
    onResolved();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-2xl font-semibold">Resolve Exceptions</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Transfer #{currentTransfer.transferNumber} • {currentTransfer.sourceLocation.name} → {currentTransfer.destinationLocation.name}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {unresolvedExceptions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-lg font-medium text-green-600">All exceptions resolved!</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Click "Close" to view the impact preview
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900">
                    {unresolvedExceptions.length} exception{unresolvedExceptions.length !== 1 ? 's' : ''} remaining
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Resolve each exception individually to complete the transfer
                  </p>
                </div>

                {unresolvedExceptions.map((exception) => (
                  <ExceptionCard
                    key={exception._id}
                    exception={exception}
                    isSelected={selectedExceptionId === exception._id}
                    onSelect={() => setSelectedExceptionId(exception._id)}
                    resolutionAction={selectedExceptionId === exception._id ? resolutionAction : ''}
                    onResolutionActionChange={setResolutionAction}
                    resolutionNotes={selectedExceptionId === exception._id ? resolutionNotes : ''}
                    onResolutionNotesChange={setResolutionNotes}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Close
            </Button>
            {unresolvedExceptions.length > 0 && (
              <Button
                onClick={handleResolve}
                disabled={!selectedExceptionId || !resolutionAction || isResolving}
              >
                {isResolving ? 'Resolving...' : 'Resolve Exception'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {showImpactModal && impactPreview && (
        <ImpactPreviewModal
          impactPreview={impactPreview}
          onClose={handleImpactModalClose}
        />
      )}
    </>
  );
}
