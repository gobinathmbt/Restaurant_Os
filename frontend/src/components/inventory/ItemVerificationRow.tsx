import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle } from 'lucide-react';

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
  onReportException: (exception: Exception) => void;
}

export default function ItemVerificationRow({ item, onReportException }: ItemVerificationRowProps) {
  const [exceptionType, setExceptionType] = useState<'damage' | 'missing' | 'excess' | ''>('');
  const [quantity, setQuantity] = useState<string>('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [reported, setReported] = useState(false);

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

    if (qty > item.sentQuantity) {
      setError(`Quantity cannot exceed sent quantity (${item.sentQuantity} ${item.unit})`);
      return;
    }

    // Create exception
    const exception: Exception = {
      type: exceptionType,
      inventoryItem: item.inventoryItem._id,
      quantity: qty,
      unit: item.unit,
      description: description.trim() || undefined
    };

    onReportException(exception);

    // Reset form
    setExceptionType('');
    setQuantity('');
    setDescription('');
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor={`exception-type-${item.inventoryItem._id}`}>Exception Type</Label>
          <Select value={exceptionType} onValueChange={(value: any) => setExceptionType(value)}>
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

        <div>
          <Label htmlFor={`quantity-${item.inventoryItem._id}`}>Quantity</Label>
          <Input
            id={`quantity-${item.inventoryItem._id}`}
            type="number"
            step="0.000001"
            min="0"
            max={item.sentQuantity}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Enter quantity"
          />
        </div>

        <div className="flex items-end">
          <Button
            type="button"
            onClick={handleAddException}
            disabled={!exceptionType || !quantity}
            className="w-full"
          >
            Add Exception
          </Button>
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
