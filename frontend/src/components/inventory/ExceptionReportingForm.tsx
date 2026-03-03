import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle, Package } from 'lucide-react';
import ItemVerificationRow from './ItemVerificationRow';

// Generate UUID v4 using crypto API
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

interface TransferItem {
  inventoryItem: {
    _id: string;
    name: string;
  };
  sentQuantity: number;
  unit: string;
}

interface Exception {
  type: 'damage' | 'missing' | 'excess';
  inventoryItem: string;
  quantity: number;
  unit: string;
  description?: string;
}

interface ExceptionReportingFormProps {
  transferId: string;
  transferItems: TransferItem[];
  onSubmitExceptions: (exceptions: Exception[]) => Promise<void>;
}

export default function ExceptionReportingForm({
  transferId,
  transferItems,
  onSubmitExceptions
}: ExceptionReportingFormProps) {
  const { toast } = useToast();
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddException = (exception: Exception) => {
    setExceptions((prev) => [...prev, exception]);
    setError('');
  };

  const handleRemoveException = (index: number) => {
    setExceptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      // Allow submission with zero exceptions (means everything is correct)
      await onSubmitExceptions(exceptions);

      toast({
        title: 'Success',
        description: exceptions.length > 0 
          ? `${exceptions.length} exception(s) reported successfully`
          : 'Goods received and verified - no exceptions',
        variant: 'success'
      });

      // Clear exceptions after successful submission
      setExceptions([]);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to submit exceptions';
      setError(errorMessage);
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getExceptionSummary = () => {
    const summary = {
      damage: 0,
      missing: 0,
      excess: 0
    };

    exceptions.forEach((ex) => {
      summary[ex.type]++;
    });

    return summary;
  };

  const summary = getExceptionSummary();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Report Exceptions</h3>
          <p className="text-sm text-muted-foreground">
            Verify each item and report any discrepancies
          </p>
        </div>
        {exceptions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Exceptions: {exceptions.length}</span>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* No Exceptions Message */}
      {exceptions.length === 0 && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-green-900 mb-1">No Exceptions</h4>
              <p className="text-sm text-green-700">
                If all items are received correctly with no discrepancies, click "Confirm Receipt" to complete the verification.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Exception Summary */}
      {exceptions.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-900 mb-2">Exceptions to Report</h4>
              <div className="flex gap-4 text-sm">
                {summary.damage > 0 && (
                  <span className="text-yellow-700">
                    <span className="font-semibold">{summary.damage}</span> Damaged
                  </span>
                )}
                {summary.missing > 0 && (
                  <span className="text-yellow-700">
                    <span className="font-semibold">{summary.missing}</span> Missing
                  </span>
                )}
                {summary.excess > 0 && (
                  <span className="text-yellow-700">
                    <span className="font-semibold">{summary.excess}</span> Excess
                  </span>
                )}
              </div>
              
              {/* List of exceptions */}
              <div className="mt-3 space-y-2">
                {exceptions.map((ex, index) => {
                  const item = transferItems.find((i) => i.inventoryItem._id === ex.inventoryItem);
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-white rounded border border-yellow-300"
                    >
                      <div className="flex-1">
                        <span className="font-medium">{item?.inventoryItem.name}</span>
                        <span className="text-muted-foreground mx-2">•</span>
                        <span className="capitalize">{ex.type}</span>
                        <span className="text-muted-foreground mx-2">•</span>
                        <span className="font-semibold">{ex.quantity} {ex.unit}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveException(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Verification Rows */}
      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <Package className="h-5 w-5" />
          Verify Items
        </h4>
        {transferItems.map((item) => (
          <ItemVerificationRow
            key={item.inventoryItem._id}
            item={item}
            allItems={transferItems}
            onReportException={handleAddException}
          />
        ))}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="min-w-[200px]"
          variant={exceptions.length === 0 ? "default" : "destructive"}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Submitting...
            </>
          ) : exceptions.length === 0 ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm Receipt (No Exceptions)
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 mr-2" />
              Submit {exceptions.length} Exception(s)
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
