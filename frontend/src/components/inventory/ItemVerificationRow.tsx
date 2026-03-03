import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

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

interface ItemVerificationRowProps {
  item: TransferItem;
  allItems: TransferItem[]; // All items in the transfer for excess selection
  onReportException: (exception: Exception) => void;
}

export default function ItemVerificationRow({ item, allItems, onReportException }: ItemVerificationRowProps) {
  const [exceptionType, setExceptionType] = useState<'damage' | 'missing' | 'excess' | ''>('');
  const [selectedItemId, setSelectedItemId] = useState<string>(item.inventoryItem._id);
  const [quantity, setQuantity] = useState<string>('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [reported, setReported] = useState(false);

  // Get the currently selected item details
  const selectedItem = allItems.find(i => i.inventoryItem._id === selectedItemId) || item;

  const handleClear = () => {
    setExceptionType('');
    setSelectedItemId(item.inventoryItem._id);
    setQuantity('');
    setDescription('');
    setError('');
  };

  const handleAddException = () => {
    setError('');

    // Validation
    if (!exceptionType) {
      setError('Please select an exception type');
      return;
    }

    const qty = parseFloat(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      setError('Please enter a valid quantity greater than 0');
      return;
    }

    // For damage and missing, quantity cannot exceed sent quantity
    // For excess, any quantity is allowed
    if ((exceptionType === 'damage' || exceptionType === 'missing') && qty > selectedItem.sentQuantity) {
      setError(`Quantity cannot exceed sent quantity (${selectedItem.sentQuantity} ${selectedItem.unit})`);
      return;
    }

    // Create exception
    const exception: Exception = {
      type: exceptionType,
      inventoryItem: selectedItemId,
      quantity: qty,
      unit: selectedItem.unit,
      description: description.trim() || undefined
    };

    onReportException(exception);

    // Reset form
    handleClear();
    setReported(true);

    // Reset reported state after 2 seconds
    setTimeout(() => setReported(false), 2000);
  };

  return (
    <div className="p-4 border rounded-lg bg-card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-medium text-lg">{item.inventoryItem.name}</h4>
          <p className="text-sm text-muted-foreground">
            Sent: <span className="font-semibold">{item.sentQuantity} {item.unit}</span>
          </p>
        </div>
        {reported && (
          <div className="flex items-center text-green-600">
            <CheckCircle className="h-5 w-5 mr-1" />
            <span className="text-sm font-medium">Exception Added</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <Label htmlFor={`exception-type-${item.inventoryItem._id}`}>Exception Type</Label>
          <Select value={exceptionType} onValueChange={(value: any) => {
            setExceptionType(value);
            setError('');
          }}>
            <SelectTrigger id={`exception-type-${item.inventoryItem._id}`}>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="damage">Damage</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
              <SelectItem value="excess">Excess</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Show item selector for excess type */}
        {exceptionType === 'excess' && (
          <div>
            <Label htmlFor={`item-select-${item.inventoryItem._id}`}>Item</Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger id={`item-select-${item.inventoryItem._id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allItems.map((transferItem) => (
                  <SelectItem key={transferItem.inventoryItem._id} value={transferItem.inventoryItem._id}>
                    {transferItem.inventoryItem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className={exceptionType === 'excess' ? '' : 'md:col-span-2'}>
          <Label htmlFor={`quantity-${item.inventoryItem._id}`}>
            Quantity
            {exceptionType === 'excess' && (
              <span className="text-xs text-muted-foreground ml-1">(any amount)</span>
            )}
          </Label>
          <Input
            id={`quantity-${item.inventoryItem._id}`}
            type="number"
            step="0.000001"
            min="0"
            max={exceptionType === 'excess' ? undefined : selectedItem.sentQuantity}
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setError('');
            }}
            placeholder="Enter quantity"
          />
        </div>

        <div className="flex items-end gap-2">
          <Button
            type="button"
            onClick={handleAddException}
            disabled={!exceptionType || !quantity}
            className="flex-1"
          >
            Add Exception
          </Button>
          {(exceptionType || quantity || description) && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleClear}
              title="Clear"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <Label htmlFor={`description-${item.inventoryItem._id}`}>Description (Optional)</Label>
        <Textarea
          id={`description-${item.inventoryItem._id}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add any notes about this exception..."
          rows={2}
          className="mt-1"
        />
      </div>

      {error && (
        <div className="mt-3 flex items-center text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mr-1" />
          {error}
        </div>
      )}
    </div>
  );
}
