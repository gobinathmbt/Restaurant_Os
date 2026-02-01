import { useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getStorage, setStorage } from '@/utils/storage';

interface StatChip {
  label: string;
  value: string | number;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  bgColor?: string;
  textColor?: string;
  onClick?: () => void;
}

interface ActionButton {
  icon: ReactNode;
  tooltip: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  className?: string;
  disabled?: boolean;
}

interface FilterConfig {
  component: ReactNode;
}

interface DataTableLayoutProps {
  // Header
  title?: string;
  subtitle?: string;
  statChips?: StatChip[];
  actionButtons?: ActionButton[];

  // Search & Filters
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  filterConfig?: FilterConfig;

  // Table
  tableHeaders: ReactNode;
  tableBody: ReactNode;
  isLoading?: boolean;
  emptyState?: {
    icon?: ReactNode;
    title: string;
    description: string;
    action?: ReactNode;
  };

  // Pagination
  currentPage: number;
  totalPages: number;
  totalCount: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;

  // Refresh
  onRefresh?: () => void;

  // Storage settings
  storagePrefix?: string;

  // Infinite scroll
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onPaginationChange?: (enabled: boolean) => void;
}

export default function DataTableLayout({
  title,
  subtitle,
  statChips = [],
  actionButtons = [],
  searchValue = '',
  searchPlaceholder = 'Search...',
  onSearchChange,
  filterConfig,
  tableHeaders,
  tableBody,
  isLoading = false,
  emptyState,
  currentPage,
  totalPages,
  totalCount,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  onRefresh,
  storagePrefix = 'datatable',
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  onPaginationChange,
}: DataTableLayoutProps) {
  const [paginationEnabled, setPaginationEnabled] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const storageName = `${storagePrefix}_pagination_enabled`;

  // Load pagination setting from sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized) {
      const savedPaginationState = getStorage<boolean>(storageName);
      if (savedPaginationState !== null) {
        setPaginationEnabled(savedPaginationState);
      }
      setIsInitialized(true);
    }
  }, [storageName, isInitialized]);

  const handlePaginationToggle = (checked: boolean) => {
    setPaginationEnabled(checked);
    setStorage(storageName, checked);
    if (checked) {
      onPageChange(1);
    }
    if (onPaginationChange) {
      onPaginationChange(checked);
    }
  };

  // Infinite scroll implementation
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && !isLoadingMore && hasMore && onLoadMore) {
        onLoadMore();
      }
    },
    [isLoadingMore, hasMore, onLoadMore]
  );

  useEffect(() => {
    if (!paginationEnabled && sentinelRef.current && onLoadMore) {
      observerRef.current = new IntersectionObserver(handleIntersection, {
        root: scrollContainerRef.current,
        rootMargin: '100px',
        threshold: 0.1,
      });

      observerRef.current.observe(sentinelRef.current);

      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      };
    }
  }, [paginationEnabled, handleIntersection, onLoadMore]);

  const getPaginationItems = () => {
    if (totalPages <= 1) return null;
    const items = [];

    // Always show first page
    if (totalPages > 0) {
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            onClick={() => onPageChange(1)}
            isActive={currentPage === 1}
            className={`cursor-pointer ${
              currentPage === 1 ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''
            }`}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );
    }

    // Show ellipsis if needed
    if (currentPage > 4 && totalPages > 6) {
      items.push(
        <PaginationItem key="start-ellipsis">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    // Show pages around current page
    const start = Math.max(2, currentPage - 2);
    const end = Math.min(totalPages - 1, currentPage + 2);

    for (let i = start; i <= end; i++) {
      if (i !== 1 && i !== totalPages) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              onClick={() => onPageChange(i)}
              isActive={currentPage === i}
              className={`cursor-pointer ${
                currentPage === i ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''
              }`}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    }

    // Show ellipsis if needed
    if (currentPage < totalPages - 3 && totalPages > 6) {
      items.push(
        <PaginationItem key="end-ellipsis">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    // Always show last page
    if (totalPages > 1) {
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink
            onClick={() => onPageChange(totalPages)}
            isActive={currentPage === totalPages}
            className={`cursor-pointer ${
              currentPage === totalPages
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : ''
            }`}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  const getPageOptions = () => {
    const options = [];
    for (let i = 1; i <= totalPages; i++) {
      options.push(
        <SelectItem key={i} value={i.toString()}>
          {i}
        </SelectItem>
      );
    }
    return options;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Fixed Header */}
      <div className="bg-background border-b flex-shrink-0">
        {/* Single Row: Stats, Search, Filters, and Actions */}
        <div className="px-6 py-3">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Stats Chips */}
            {statChips.length > 0 && (
              <div className="flex items-center gap-2">
                {statChips.map((chip, index) => (
                  <Badge
                    key={index}
                    variant={chip.variant || 'outline'}
                    className={`px-3 py-1 text-sm ${chip.bgColor || ''} ${
                      chip.textColor || ''
                    } ${chip.onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
                    onClick={chip.onClick}
                  >
                    {chip.label}: {chip.value}
                  </Badge>
                ))}
              </div>
            )}

            {/* Search */}
            {onSearchChange && (
              <div className="flex-1 max-w-xs">
                <Input
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="h-9"
                />
              </div>
            )}

            {/* Filter */}
            {filterConfig && (
              <div className="flex items-center">
                {filterConfig.component}
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Refresh Button */}
            {onRefresh && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={onRefresh}
                      disabled={isLoading}
                      className="h-9 w-9"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh Data</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Action Buttons */}
            {actionButtons.length > 0 && (
              <>
                {actionButtons.map((button, index) => (
                  <TooltipProvider key={index}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={button.variant || 'default'}
                          size="icon"
                          onClick={button.onClick}
                          disabled={button.disabled}
                          className={`h-9 w-9 ${button.className || ''}`}
                        >
                          {button.icon}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{button.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content Area - Scrollable for infinite scroll, fixed for pagination */}
      <div 
        ref={scrollContainerRef}
        className={`flex-1 min-h-0 ${!paginationEnabled ? 'overflow-y-auto' : ''}`}
      >
        <div className={`${paginationEnabled ? 'h-full' : ''} flex flex-col`}>
          {isLoading && paginationEnabled ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : emptyState ? (
            <div className="flex flex-col items-center justify-center h-full p-8">
              {emptyState.icon && (
                <div className="mb-4 text-muted-foreground">
                  {emptyState.icon}
                </div>
              )}
              <h3 className="text-lg font-semibold mb-2">{emptyState.title}</h3>
              <p className="text-muted-foreground text-center mb-4">
                {emptyState.description}
              </p>
              {emptyState.action}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 border-b">
                  <TableRow>{tableHeaders}</TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && !paginationEnabled ? (
                    <TableRow>
                      <TableCell colSpan={100} className="h-24 text-center">
                        <div className="flex justify-center items-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableBody
                  )}
                </TableBody>
              </Table>
              
              {/* Infinite scroll sentinel and loading indicator */}
              {!paginationEnabled && (
                <div ref={sentinelRef} className="py-4">
                  {isLoadingMore && (
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
                    </div>
                  )}
                  {!hasMore && !isLoadingMore && totalCount > 0 && (
                    <div className="text-center text-sm text-muted-foreground">
                      All {totalCount} items loaded
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Fixed Footer with Pagination */}
      <div className="bg-background border-t py-3 px-6 flex-shrink-0">
        {/* Mobile Layout */}
        <div className="flex sm:hidden items-center justify-between gap-2">
          {/* Pagination Toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="pagination-mobile"
              checked={paginationEnabled}
              onCheckedChange={(checked) =>
                handlePaginationToggle(checked as boolean)
              }
              className="h-4 w-4"
            />
            <Label
              htmlFor="pagination-mobile"
              className="text-xs text-muted-foreground cursor-pointer"
            >
              Pages
            </Label>
          </div>

          {/* Navigation */}
          {paginationEnabled && totalPages > 0 && (
            <>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  {currentPage}/{totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    currentPage < totalPages && onPageChange(currentPage + 1)
                  }
                  disabled={currentPage >= totalPages}
                  className="h-7 px-2"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>

              {/* Go to Page */}
              <Select
                value={currentPage.toString()}
                onValueChange={(value) => onPageChange(parseInt(value))}
              >
                <SelectTrigger className="h-7 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>{getPageOptions()}</SelectContent>
              </Select>
            </>
          )}
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center justify-between">
          {/* Left: Pagination Controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="pagination"
                checked={paginationEnabled}
                onCheckedChange={(checked) =>
                  handlePaginationToggle(checked as boolean)
                }
                className="h-4 w-4"
              />
              <Label
                htmlFor="pagination"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Pagination
              </Label>
            </div>

            {paginationEnabled && (
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Rows:</Label>
                <Select
                  value={rowsPerPage.toString()}
                  onValueChange={(value) => onRowsPerPageChange(parseInt(value))}
                >
                  <SelectTrigger className="h-8 w-20 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Center: Pagination */}
          {paginationEnabled && totalPages > 0 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
                    className={
                      currentPage <= 1
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>

                {totalPages === 1 ? (
                  <PaginationItem>
                    <PaginationLink
                      isActive={true}
                      className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      1
                    </PaginationLink>
                  </PaginationItem>
                ) : (
                  getPaginationItems()
                )}

                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      currentPage < totalPages && onPageChange(currentPage + 1)
                    }
                    className={
                      currentPage >= totalPages
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}

          {/* Right: Go to Page & Total */}
          <div className="flex items-center gap-4">
            {paginationEnabled && totalPages > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Go:</Label>
                  <Select
                    value={currentPage.toString()}
                    onValueChange={(value) => onPageChange(parseInt(value))}
                  >
                    <SelectTrigger className="h-8 w-16 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{getPageOptions()}</SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
