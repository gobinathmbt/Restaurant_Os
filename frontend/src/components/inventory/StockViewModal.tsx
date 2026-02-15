import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { inventoryItemBranchServices } from '@/api/services';
import { Loader2 } from 'lucide-react';

interface LineItem {
  inventoryItem: string;
  quantity: number;
  unit: string;
}

interface StockViewModalProps {
  open: boolean;
  onClose: () => void;
  branchId: string;
  lineItems: LineItem[];
}

interface StockLevel {
  inventoryItemId: string;
  itemName: string;
  currentStock: number;
  unit: string;
}

export default function StockViewModal({ open, onClose, branchId, lineItems }: StockViewModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stockLevels, setStockLevels] = useState<Map<string, StockLevel>>(new Map());

  useEffect(() => {
    if (open && branchId && lineItems.length > 0) {
      fetchStockLevels();
    }
  }, [open, branchId, lineItems]);

  const fetchStockLevels = async () => {
    try {
      setLoading(true);
      
      // Extract unique inventory item IDs from line items
      const itemIds = lineItems
        .filter((item) => item.inventoryItem)
        .map((item) => item.inventoryItem);

      if (itemIds.length === 0) {
        setStockLevels(new Map());
        return;
      }

      // Fetch inventory item branch data for all items
      const response = await inventoryItemBranchServices.getInventoryItemBranchesByIds(
        branchId,
        itemIds
      );

      const items = response.data.data.items || [];
      
      // Create a map of inventory item ID to stock level
      const stockMap = new Map<string, StockLevel>();
      items.forEach((item: any) => {
        stockMap.set(item.inventoryItem._id, {
          inventoryItemId: item.inventoryItem._id,
          itemName: item.inventoryItem.name,
          currentStock: item.quantity || 0,
          unit: item.inventoryItem.unit,
        });
      });

      setStockLevels(stockMap);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to fetch stock levels',
        variant: 'destructive',
      });
      setStockLevels(new Map());
    } finally {
      setLoading(false);
    }
  };

  const calculateNewStock = (itemId: string, grnQuantity: number): number => {
    const stockLevel = stockLevels.get(itemId);
    if (!stockLevel) return grnQuantity;
    return stockLevel.currentStock + grnQuantity;
  };

  const getItemName = (itemId: string): string => {
    const stockLevel = stockLevels.get(itemId);
    return stockLevel?.itemName || 'Unknown Item';
  };

  const getCurrentStock = (itemId: string): number => {
    const stockLevel = stockLevels.get(itemId);
    return stockLevel?.currentStock || 0;
  };

  const getUnit = (itemId: string, fallbackUnit: string): string => {
    const stockLevel = stockLevels.get(itemId);
    return stockLevel?.unit || fallbackUnit;
  };

  // Filter out line items without inventory item selected
  const validLineItems = lineItems.filter((item) => item.inventoryItem);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Current Stock Levels</DialogTitle>
        </DialogHeader>

        <DialogBody>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading stock levels...</span>
            </div>
          ) : validLineItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items to display. Please add items to the GRN first.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">GRN Quantity</TableHead>
                    <TableHead className="text-right">New Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validLineItems.map((item, index) => {
                    const currentStock = getCurrentStock(item.inventoryItem);
                    const newStock = calculateNewStock(item.inventoryItem, item.quantity);
                    const unit = getUnit(item.inventoryItem, item.unit);

                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {getItemName(item.inventoryItem)}
                        </TableCell>
                        <TableCell className="text-right">
                          {currentStock.toFixed(2)} {unit}
                        </TableCell>
                        <TableCell className="text-right text-blue-600 font-semibold">
                          +{item.quantity.toFixed(2)} {unit}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">
                          {newStock.toFixed(2)} {unit}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
