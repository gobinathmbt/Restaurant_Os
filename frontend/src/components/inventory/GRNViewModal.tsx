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
import { Printer, Download, Loader2, Package, Building2, FileText, Mail, Bell } from 'lucide-react';
import api, { inventoryServices } from '@/api/services';
import pdfGenerator from '@/services/pdfGenerator';

interface GRNDetails {
  _id: string;
  grnNumber: string;
  branch: {
    _id: string;
    name: string;
    code: string;
    address?:
      | string
      | {
          street?: string;
          city?: string;
          state?: string;
          pincode?: string;
          country?: string;
        };
    city?: string;
    state?: string;
    pincode?: string;
  };
  supplier: {
    _id: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?:
      | string
      | {
          street?: string;
          city?: string;
          state?: string;
          pincode?: string;
          country?: string;
        };
    city?: string;
    state?: string;
    pincode?: string;
    gstNumber?: string;
  };
  receivedDate: string;
  receivedBy: {
    _id: string;
    name: string;
    email?: string;
  };
  items: Array<{
    inventoryItem: {
      _id: string;
      name: string;
      type?: string;
      unit?: string;
      sku?: string;
    };
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    batchNumber?: string;
    expiryDate?: string;
  }>;
  totalAmount: number;
  status: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  notes?: string;
  createdAt: string;
}

interface GRNViewModalProps {
  open: boolean;
  onClose: () => void;
  grnId: string;
  branchId: string;
}

export default function GRNViewModal({ open, onClose, grnId, branchId }: GRNViewModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [grnDetails, setGrnDetails] = useState<GRNDetails | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [resendingInApp, setResendingInApp] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  useEffect(() => {
    if (open && grnId) {
      fetchGRNDetails();
    }
  }, [open, grnId]);

  const fetchGRNDetails = async () => {
    setLoading(true);
    try {
      const response = await api.inventory.getGRN(grnId);
      setGrnDetails(response.data.data.grn);
    } catch (error: any) {
      console.error('Error fetching GRN details:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to fetch GRN details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!grnDetails) return;

    setDownloading(true);
    try {
      await pdfGenerator.downloadGRNPDF(grnDetails);
      toast({
        title: 'Success',
        variant: 'success',
        description: 'GRN receipt downloaded successfully',
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to download GRN receipt',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    if (!grnDetails) return;

    setPrinting(true);
    try {
      await pdfGenerator.printGRNPDF(grnDetails);
    } catch (error) {
      console.error('Error printing PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to print GRN receipt',
        variant: 'destructive',
      });
    } finally {
      setPrinting(false);
    }
  };

  const handleResendInAppNotifications = async () => {
    if (!grnDetails) return;

    setResendingInApp(true);
    try {
      const response = await inventoryServices.resendGRNInAppNotifications(branchId, grnId);
      toast({
        title: 'Success',
        variant: 'success',
        description: response.data.message || 'In-app notifications sent successfully',
      });
    } catch (error: any) {
      console.error('Error resending in-app notifications:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to resend in-app notifications',
        variant: 'destructive',
      });
    } finally {
      setResendingInApp(false);
    }
  };

  const handleResendEmailNotifications = async () => {
    if (!grnDetails) return;

    setResendingEmail(true);
    try {
      // Always include supplier (true by default)
      const response = await inventoryServices.resendGRNEmailNotifications(branchId, grnId, true);
      toast({
        title: 'Success',
        variant: 'success',
        description: response.data.message || 'Email notifications sent successfully',
      });
    } catch (error: any) {
      console.error('Error resending email notifications:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to resend email notifications',
        variant: 'destructive',
      });
    } finally {
      setResendingEmail(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            GRN Details
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : grnDetails ? (
            <div className="space-y-6">
              {/* GRN Summary Card */}
              <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg p-6 shadow-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm opacity-90">GRN Number</p>
                    <p className="text-lg font-bold">{grnDetails.grnNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-90">Date</p>
                    <p className="text-lg font-bold">{formatDate(grnDetails.receivedDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-90">Supplier</p>
                    <p className="text-lg font-bold truncate">{grnDetails.supplier.name}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-90">Total Amount</p>
                    <p className="text-2xl font-bold">{formatCurrency(grnDetails.totalAmount)}</p>
                  </div>
                </div>
              </div>

              {/* Branch and Supplier Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Branch Details */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5 text-primary" />
                    Branch Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Branch Name:</span>
                      <span className="font-medium">{grnDetails.branch.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Branch Code:</span>
                      <span className="font-medium">{grnDetails.branch.code}</span>
                    </div>
                    {grnDetails.branch.address && typeof grnDetails.branch.address === 'object' && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Address:</span>
                        <span className="font-medium text-right">
                          {[
                            grnDetails.branch.address.street,
                            grnDetails.branch.address.city,
                            grnDetails.branch.address.state,
                            grnDetails.branch.address.pincode,
                            grnDetails.branch.address.country,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    )}
                    {grnDetails.branch.address && typeof grnDetails.branch.address === 'string' && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Address:</span>
                        <span className="font-medium text-right">{grnDetails.branch.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Supplier Details */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5 text-primary" />
                    Supplier Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Supplier Name:</span>
                      <span className="font-medium">{grnDetails.supplier.name}</span>
                    </div>
                    {grnDetails.supplier.contactPerson && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Contact Person:</span>
                        <span className="font-medium">{grnDetails.supplier.contactPerson}</span>
                      </div>
                    )}
                    {grnDetails.supplier.phone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone:</span>
                        <span className="font-medium">{grnDetails.supplier.phone}</span>
                      </div>
                    )}
                    {grnDetails.supplier.email && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium">{grnDetails.supplier.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* GRN Details */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  GRN Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GRN Number:</span>
                    <span className="font-medium">{grnDetails.grnNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Received Date:</span>
                    <span className="font-medium">{formatDate(grnDetails.receivedDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Received By:</span>
                    <span className="font-medium">{grnDetails.receivedBy.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium capitalize">{grnDetails.status}</span>
                  </div>
                  {grnDetails.invoiceNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invoice Number:</span>
                      <span className="font-medium">{grnDetails.invoiceNumber}</span>
                    </div>
                  )}
                  {grnDetails.invoiceDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invoice Date:</span>
                      <span className="font-medium">{formatDate(grnDetails.invoiceDate)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-3">
                  <h3 className="font-semibold">Line Items</h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grnDetails.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {item.inventoryItem?.name || 'Unknown Item'}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.totalPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted font-semibold">
                      <TableCell colSpan={4} className="text-right">
                        Total Amount:
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(grnDetails.totalAmount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Notes */}
              {grnDetails.notes && (
                <div className="border-l-4 border-primary bg-primary/5 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground">{grnDetails.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No GRN details available</div>
          )}
        </DialogBody>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 justify-between w-full">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleResendInAppNotifications}
              disabled={!grnDetails || resendingInApp}
              size="sm"
            >
              {resendingInApp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Bell className="mr-2 h-4 w-4" />
                  Send In-App
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleResendEmailNotifications}
              disabled={!grnDetails || resendingEmail}
              size="sm"
            >
              {resendingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Email
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={!grnDetails || printing}
              size="sm"
            >
              {printing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Printing...
                </>
              ) : (
                <>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </>
              )}
            </Button>
            <Button onClick={handleDownload} disabled={!grnDetails || downloading} size="sm">
              {downloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
