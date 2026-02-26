import { useState, useEffect } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { inventoryServices } from '@/api/services';

interface TransferItem {
  inventoryItem: {
    _id: string;
    name: string;
  };
  sentQuantity: number;
  unit: string;
}

interface StockTransfer {
  _id: string;
  transferNumber: string;
  items: TransferItem[];
}

interface ItemAcceptance {
  inventoryItem: string;
  expectedQuantity: number;
  receivedQuantity: number;
  damageQuantity: number;
  missingQuantity: number;
  excessQuantity: number;
  notes: string;
  unit: string;
}

interface StockAcceptanceModalProps {
  open: boolean;
  onClose: () => void;
  transfer: StockTransfer | null;
  onSuccess: () => void;
}

export default function StockAcceptanceModal({
  open,
  onClose,
  transfer,
  onSuccess,
}: StockAcceptanceModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [itemAcceptances, setItemAcceptances] = useState<ItemAcceptance[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && transfer) {
      // Initialize item acceptances with expected quantities
      const initialAcceptances: ItemAcceptance[] = transfer.items.map(item => ({
        inventoryItem: item.inventoryItem._id,
        expectedQuantity: item.sentQuantity,
        receivedQuantity: item.sentQuantity, // Default to expected
        damageQuantity: 0,
        missingQuantity: 0,
        excessQuantity: 0,
        notes: '',
        unit: item.unit,
      }));
      setItemAcceptances(initialAcceptances);
      setValidationErrors({});
    }
  }, [open, transfer]);

  const handleQuantityChange = (index: number, field: keyof ItemAcceptance, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newAcceptances = [...itemAcceptances];
    newAcceptances[index] = {
      ...newAcceptances[index],
      [field]: numValue,
    };
    setItemAcceptances(newAcceptances);
    
    // Clear validation error for this item
    const newErrors = { ...validationErrors };
    delete newErrors[`item-${index}`];
    setValidationErrors(newErrors);
  };

  const handleNotesChange = (index: number, value: string) => {
    const newAcceptances = [...itemAcceptances];
    newAcceptances[index] = {
      ...newAcceptances[index],
      notes: value,
    };
    setItemAcceptances(newAcceptances);
  };

  const validateAcceptances = (): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;

    itemAcceptances.forEach((acceptance, index) => {
      const { expectedQuantity, receivedQuantity, damageQuantity, missingQuantity, excessQuantity } = acceptance;
      
      // Validation: receivedQuantity = expectedQuantity - missingQuantity + excessQuantity
      const calculatedReceived = expectedQuantity - missingQuantity + excessQuantity;
      
      if (Math.abs(receivedQuantity - calculatedReceived) > 0.01) {
        errors[`item-${index}`] = `Received quantity must equal expected (${expectedQuantity}) - missing (${missingQuantity}) + excess (${excessQuantity}) = ${calculatedReceived}`;
        isValid = false;
      }

      // Ensure no negative quantities
      if (receivedQuantity < 0 || damageQuantity < 0 || missingQuantity < 0 || excessQuantity < 0) {
        errors[`item-${index}`] = 'Quantities cannot be negative';
        isValid = false;
      }

      // If there are exceptions (damage, missing, excess), notes should be provided
      if ((damageQuantity > 0 || missingQuantity > 0 || excessQuantity > 0) && !acceptance.notes.trim()) {
        errors[`item-${index}-notes`] = 'Please provide notes for exceptions';
        isValid = false;
      }
    });

    setValidationErrors(errors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!transfer) return;

    if (!validateAcceptances()) {
      toast({
        title: "Validation Error",
        description: "Please fix the validation errors before submitting",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Prepare acceptance data
      const acceptanceData = {
        items: itemAcceptances.map(acceptance => ({
          inventoryItem: acceptance.inventoryItem,
          receivedQuantity: acceptance.receivedQuantity,
          damage: acceptance.damageQuantity,
          missing: acceptance.missingQuantity,
          excess: acceptance.excessQuantity,
          notes: acceptance.notes,
        })),
      };

      // TODO: This API endpoint needs to be implemented in the backend (Task 6.2)
      // POST /api/v2/stock-transfers/:transferId/accept
      await inventoryServices.acceptStock(transfer._id, acceptanceData);

      toast({
        title: "Success",
        description: "Stock accepted successfully",
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to accept stock',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const hasExceptions = (acceptance: ItemAcceptance): boolean => {
    return acceptance.damageQuantity > 0 || acceptance.missingQuantity > 0 || acceptance.excessQuantity > 0;
  };

  if (!transfer) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Accept Stock - {transfer.transferNumber}</DialogTitle>
          <DialogDescription>
            Verify received quantities and record any exceptions (damage, missing, or excess items)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {transfer.items.map((item, index) => {
            const acceptance = itemAcceptances[index];
            if (!acceptance) return null;

            return (
              <div key={item.inventoryItem._id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{item.inventoryItem.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Expected: {item.sentQuantity} {item.unit}
                    </p>
                  </div>
                  {hasExceptions(acceptance) && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Has Exceptions
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor={`received-${index}`}>Received Quantity *</Label>
                    <Input
                      id={`received-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={acceptance.receivedQuantity}
                      onChange={(e) => handleQuantityChange(index, 'receivedQuantity', e.target.value)}
                      className={validationErrors[`item-${index}`] ? 'border-red-500' : ''}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`damage-${index}`}>Damage</Label>
                    <Input
                      id={`damage-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={acceptance.damageQuantity}
                      onChange={(e) => handleQuantityChange(index, 'damageQuantity', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`missing-${index}`}>Missing</Label>
                    <Input
                      id={`missing-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={acceptance.missingQuantity}
                      onChange={(e) => handleQuantityChange(index, 'missingQuantity', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`excess-${index}`}>Excess</Label>
                    <Input
                      id={`excess-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={acceptance.excessQuantity}
                      onChange={(e) => handleQuantityChange(index, 'excessQuantity', e.target.value)}
                    />
                  </div>

                  <div className="flex items-end">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Unit:</span>
                      <span className="ml-1 font-medium">{item.unit}</span>
                    </div>
                  </div>
                </div>

                {hasExceptions(acceptance) && (
                  <div>
                    <Label htmlFor={`notes-${index}`}>Exception Notes *</Label>
                    <Textarea
                      id={`notes-${index}`}
                      placeholder="Describe the damage, missing items, or excess items..."
                      value={acceptance.notes}
                      onChange={(e) => handleNotesChange(index, e.target.value)}
                      rows={2}
                      className={validationErrors[`item-${index}-notes`] ? 'border-red-500' : ''}
                    />
                    {validationErrors[`item-${index}-notes`] && (
                      <p className="text-sm text-red-500 mt-1">{validationErrors[`item-${index}-notes`]}</p>
                    )}
                  </div>
                )}

                {validationErrors[`item-${index}`] && (
                  <p className="text-sm text-red-500">{validationErrors[`item-${index}`]}</p>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Check className="h-4 w-4 mr-2" />
            {loading ? 'Accepting...' : 'Accept Stock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
