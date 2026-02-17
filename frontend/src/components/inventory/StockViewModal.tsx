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
import { ArrowUp, ArrowDown, Minus, AlertTriangle } from 'lucide-react';

interface LineItem {
  inventoryItem: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

interface BranchConfig {
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  lastPurchasePrice?: number;
  lastPurchaseDate?: string;
  supplier?: {
    _id: string;
    name: string;
  };
}

interface InventoryItem {
  _id: string;
  name: string;
  unit: string;
  branchConfig: BranchConfig;
}

interface StockViewModalProps {
  open: boolean;
  onClose: () => void;
  branchId: string;
  lineItems: LineItem[];
  inventoryItemsCache: Map<string, InventoryItem>;
}

interface StockLevel {
  inventoryItemId: string;
  itemName: string;
  currentStock: number;
  unit: string;
  maximumStock: number;
  lastPurchasePrice?: number;
}

export default function StockViewModal({ 
  open, 
  onClose, 
  branchId, 
  lineItems, 
  inventoryItemsCache 
}: StockViewModalProps) {
  const { toast } = useToast();
  const [stockLevels, setStockLevels] = useState<Map<string, StockLevel>>(new Map());

  useEffect(() => {
    if (open && lineItems.length > 0) {
      loadStockLevelsFromCache();
    }
  }, [open, lineItems, inventoryItemsCache]);

  const loadStockLevelsFromCache = () => {
    try {
      // Extract unique inventory item IDs from line items
      const itemIds = lineItems
        .filter((item) => item.inventoryItem)
        .map((item) => item.inventoryItem);

      if (itemIds.length === 0) {
        setStockLevels(new Map());
        return;
      }

      // Create a map of inventory item ID to stock level from cache
      const stockMap = new Map<string, StockLevel>();
      itemIds.forEach((itemId) => {
        const cachedItem = inventoryItemsCache.get(itemId);
        if (cachedItem) {
          stockMap.set(itemId, {
            inventoryItemId: itemId,
            itemName: cachedItem.name,
            currentStock: cachedItem.branchConfig.currentStock || 0,
            unit: cachedItem.unit,
            maximumStock: cachedItem.branchConfig.maximumStock || 0,
            lastPurchasePrice: cachedItem.branchConfig.lastPurchasePrice,
          });
        }
      });

      setStockLevels(stockMap);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load stock levels from cache',
        variant: 'destructive',
      });
      setStockLevels(new Map());
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

  const getLastPurchasePrice = (itemId: string): number | undefined => {
    const stockLevel = stockLevels.get(itemId);
    return stockLevel?.lastPurchasePrice;
  };

  const calculatePriceChange = (currentPrice: number, lastPrice?: number): {
    percentage: number;
    direction: 'up' | 'down' | 'neutral';
  } | null => {
    if (lastPrice === undefined || lastPrice === null) {
      return null;
    }

    if (lastPrice === 0) {
      return { percentage: 0, direction: 'neutral' };
    }

    const difference = currentPrice - lastPrice;
    const percentage = (difference / lastPrice) * 100;

    let direction: 'up' | 'down' | 'neutral' = 'neutral';
    if (currentPrice > lastPrice) {
      direction = 'up';
    } else if (currentPrice < lastPrice) {
      direction = 'down';
    }

    return { percentage, direction };
  };

  const renderPriceComparison = (currentPrice: number, lastPrice?: number) => {
    const priceChange = calculatePriceChange(currentPrice, lastPrice);

    if (!priceChange) {
      return (
        <div className="text-sm text-muted-foreground italic">
          First Purchase
        </div>
      );
    }

    const { percentage, direction } = priceChange;

    if (direction === 'neutral') {
      return (
        <div className="flex items-center gap-1 text-sm">
          <Minus className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">No change</span>
        </div>
      );
    }

    const isIncrease = direction === 'up';
    const colorClass = isIncrease 
      ? 'text-red-600 dark:text-red-400' 
      : 'text-green-600 dark:text-green-400';
    const Icon = isIncrease ? ArrowUp : ArrowDown;

    return (
      <div className={`flex items-center gap-1 text-sm font-medium ${colorClass}`}>
        <Icon className="h-4 w-4" />
        <span>{Math.abs(percentage).toFixed(1)}%</span>
      </div>
    );
  };

  const getMaximumStock = (itemId: string): number => {
    const stockLevel = stockLevels.get(itemId);
    return stockLevel?.maximumStock || 0;
  };

  const checkCapacityExceeded = (itemId: string, receivingQuantity: number): boolean => {
    const currentStock = getCurrentStock(itemId);
    const maxStock = getMaximumStock(itemId);
    const projectedStock = currentStock + receivingQuantity;
    
    return maxStock > 0 && projectedStock > maxStock;
  };

  const renderCapacityWarning = (itemId: string, receivingQuantity: number, unit: string) => {
    const currentStock = getCurrentStock(itemId);
    const maxStock = getMaximumStock(itemId);
    const projectedStock = currentStock + receivingQuantity;
    const isExceeded = checkCapacityExceeded(itemId, receivingQuantity);

    if (!isExceeded || maxStock === 0) {
      return null;
    }

    const excess = projectedStock - maxStock;

    return (
      <div className="flex items-start gap-2 mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-yellow-800 dark:text-yellow-200">
          <div className="font-semibold">Capacity Warning</div>
          <div className="mt-1">
            Projected stock ({projectedStock.toFixed(2)} {unit}) exceeds maximum capacity ({maxStock.toFixed(2)} {unit}) by {excess.toFixed(2)} {unit}
          </div>
        </div>
      </div>
    );
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
          {validLineItems.length === 0 ? (
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
                    <TableHead className="text-right">Projected Stock</TableHead>
                    <TableHead className="text-right">Max Stock</TableHead>
                    <TableHead className="text-right">Last Price</TableHead>
                    <TableHead className="text-right">Current Price</TableHead>
                    <TableHead className="text-right">Price Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validLineItems.map((item, index) => {
                    const quantityNum = Number(item.quantity) || 0;
                    const currentStock = getCurrentStock(item.inventoryItem);
                    const projectedStock = calculateNewStock(item.inventoryItem, quantityNum);
                    const maxStock = getMaximumStock(item.inventoryItem);
                    const unit = getUnit(item.inventoryItem, item.unit);
                    const lastPrice = getLastPurchasePrice(item.inventoryItem);
                    const isCapacityExceeded = checkCapacityExceeded(item.inventoryItem, quantityNum);

                    return (
                      <TableRow key={index} className={isCapacityExceeded ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}>
                        <TableCell>
                          <div className="font-medium flex items-center gap-2">
                            {isCapacityExceeded && (
                              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                            )}
                            <div>
                              {getItemName(item.inventoryItem)}
                              {renderCapacityWarning(item.inventoryItem, quantityNum, unit)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {currentStock.toFixed(2)} {unit}
                        </TableCell>
                        <TableCell className="text-right text-blue-600 dark:text-blue-400 font-semibold">
                          +{quantityNum.toFixed(2)} {unit}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${
                          isCapacityExceeded 
                            ? 'text-yellow-600 dark:text-yellow-500' 
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          {projectedStock.toFixed(2)} {unit}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {maxStock > 0 ? `${maxStock.toFixed(2)} ${unit}` : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          {lastPrice !== undefined 
                            ? `$${lastPrice.toFixed(2)}` 
                            : <span className="text-muted-foreground italic">N/A</span>
                          }
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${(Number(item.unitPrice) || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {renderPriceComparison(Number(item.unitPrice) || 0, lastPrice)}
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
