import jsPDF from 'jspdf';

interface GRNDetails {
  _id: string;
  grnNumber: string;
  branch?: {
    _id: string;
    name: string;
    code: string;
    address?: string | {
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
  locationId?: {
    _id: string;
    name: string;
    code: string;
    type?: string;
    address?: string | {
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
  supplier?: {
    _id: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string | {
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
  receivedBy?: {
    _id: string;
    name: string;
    email?: string;
  } | string;
  items: Array<{
    inventoryItem?: {
      _id: string;
      name: string;
      type?: string;
      unit?: string;
      sku?: string;
    };
    itemName?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    batchNumber?: string;
    expiryDate?: string;
  }>;
  totalAmount?: number;
  status: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  notes?: string;
  createdAt: string;
}

/**
 * PDF Generator Service for GRN receipts
 * Follows email template theme (green, black, white)
 * Supports both light and dark theme colors
 */
class PDFGeneratorService {
  // Detect current theme from DOM
  private getCurrentTheme(): 'light' | 'dark' {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }

  // Get theme-appropriate colors
  private getThemeColors(theme: 'light' | 'dark') {
    if (theme === 'dark') {
      return {
        primary: '#10b981', // Green
        primaryDark: '#059669', // Darker green
        headerBg: '#000000', // Black header
        contentBg: '#1a1a1a', // Dark background
        cardBg: '#262626', // Slightly lighter for cards
        text: '#f5f5f5', // Light text
        textSecondary: '#a3a3a3', // Gray text
        border: '#404040', // Border color
        tableBg: '#2a2a2a', // Table background
        tableHeaderBg: '#333333', // Table header
        accentBg: '#064e3b', // Dark green accent
        accentText: '#6ee7b7', // Light green text
      };
    } else {
      return {
        primary: '#16a34a', // Darker green for light mode
        primaryDark: '#15803d', // Even darker green
        headerBg: '#1f2937', // Dark gray header
        contentBg: '#ffffff', // White background
        cardBg: '#f9fafb', // Light gray for cards
        text: '#111827', // Dark text
        textSecondary: '#6b7280', // Gray text
        border: '#e5e7eb', // Light border
        tableBg: '#f3f4f6', // Light table background
        tableHeaderBg: '#e5e7eb', // Light table header
        accentBg: '#d1fae5', // Light green accent
        accentText: '#065f46', // Dark green text
      };
    }
  }

  // Helper to safely convert color to RGB array for jsPDF
  private hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      return [0, 0, 0]; // Default to black if invalid
    }
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ];
  }

  // Helper to safely set fill color
  private setFillColorSafe(doc: any, hex: string) {
    const rgb = this.hexToRgb(hex);
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  }

  // Helper to safely set text color
  private setTextColorSafe(doc: any, hex: string) {
    const rgb = this.hexToRgb(hex);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  }

  // Helper to safely set draw color
  private setDrawColorSafe(doc: any, hex: string) {
    const rgb = this.hexToRgb(hex);
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  }

  /**
   * Generate GRN PDF document
   * @param grnDetails - Complete GRN details
   * @returns PDF as Blob
   */
  async generateGRNPDF(grnDetails: GRNDetails): Promise<Blob> {
    // Safe accessors for potentially null fields
    const supplierName = grnDetails.supplier?.name || 'Supplier';
    const supplierContact = grnDetails.supplier?.contactPerson || '';
    const supplierPhone = grnDetails.supplier?.phone || '';
    const supplierEmail = grnDetails.supplier?.email || '';
    const branchName = grnDetails.branch?.name || grnDetails.locationId?.name || 'Branch';
    const branchCode = grnDetails.branch?.code || grnDetails.locationId?.code || '';
    const receivedByName = (typeof grnDetails.receivedBy === 'object') ? (grnDetails.receivedBy?.name || 'Receiver') : 'Receiver';
    const safeItems = Array.isArray(grnDetails.items) ? grnDetails.items : [];
    const safeTotalAmount = grnDetails.totalAmount ?? 0;

    // Detect current theme and get appropriate colors
    const theme = this.getCurrentTheme();
    const colors = this.getThemeColors(theme);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    let yPos = margin;

    // Helper function to check if we need a new page
    const checkPageBreak = (requiredSpace: number) => {
      if (yPos + requiredSpace > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
        return true;
      }
      return false;
    };

    // Header with theme-appropriate background
    const headerRgb = this.hexToRgb(colors.headerBg);
    doc.setFillColor(headerRgb[0], headerRgb[1], headerRgb[2]);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Logo area (emoji as text)
    doc.setFontSize(24);
    const primaryRgb = this.hexToRgb(colors.primary);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('🍽️', margin, 20);
    
    // Company name
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    const whiteRgb = theme === 'dark' ? [255, 255, 255] : [249, 250, 251];
    doc.setTextColor(whiteRgb[0], whiteRgb[1], whiteRgb[2]);
    doc.text('RestaurantOS', margin + 15, 20);
    
    // Title
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Goods Receipt Note', margin, 38);
    
    // Subtitle
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('GRN Receipt', margin, 45);

    yPos = 60;

    // GRN Summary Box (theme-appropriate background)
    doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.roundedRect(margin, yPos, contentWidth, 45, 3, 3, 'F');
    
    doc.setTextColor(255, 255, 255); // White text on primary background
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const summaryY = yPos + 8;
    const labelX = margin + 5;
    const valueX = pageWidth - margin - 5;
    
    // GRN Number
    doc.text('GRN Number:', labelX, summaryY);
    doc.setFont('helvetica', 'bold');
    doc.text(grnDetails.grnNumber || '', valueX, summaryY, { align: 'right' });
    
    // Date
    doc.setFont('helvetica', 'normal');
    doc.text('Date:', labelX, summaryY + 7);
    doc.setFont('helvetica', 'bold');
    const formattedDate = new Date(grnDetails.receivedDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.text(formattedDate, valueX, summaryY + 7, { align: 'right' });
    
    // Supplier
    doc.setFont('helvetica', 'normal');
    doc.text('Supplier:', labelX, summaryY + 14);
    doc.setFont('helvetica', 'bold');
    doc.text(supplierName, valueX, summaryY + 14, { align: 'right' });
    
    // Branch
    doc.setFont('helvetica', 'normal');
    doc.text('Branch:', labelX, summaryY + 21);
    doc.setFont('helvetica', 'bold');
    doc.text(branchName, valueX, summaryY + 21, { align: 'right' });
    
    // Total Amount (larger)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Amount:', labelX, summaryY + 32);
    doc.setFont('helvetica', 'bold');
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(safeTotalAmount);
    doc.text(formattedAmount, valueX, summaryY + 32, { align: 'right' });

    yPos += 55;

    // Supplier Information Section
    checkPageBreak(40);
    const cardBgRgb = this.hexToRgb(colors.cardBg);
    doc.setFillColor(cardBgRgb[0], cardBgRgb[1], cardBgRgb[2]);
    doc.roundedRect(margin, yPos, contentWidth, 8, 2, 2, 'F');
    const textRgb = this.hexToRgb(colors.text);
    doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('📋 Supplier Information', margin + 3, yPos + 5.5);
    
    yPos += 12;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    const detailLabelX = margin + 3;
    const detailValueX = margin + 50;
    
    const textSecondaryRgb = this.hexToRgb(colors.textSecondary);
    doc.setTextColor(textSecondaryRgb[0], textSecondaryRgb[1], textSecondaryRgb[2]);
    doc.text('Supplier Name:', detailLabelX, yPos);
    doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(supplierName, detailValueX, yPos);
    
    if (supplierContact) {
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textSecondaryRgb[0], textSecondaryRgb[1], textSecondaryRgb[2]);
      doc.text('Contact Person:', detailLabelX, yPos);
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(supplierContact, detailValueX, yPos);
    }
    
    if (supplierPhone) {
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textSecondaryRgb[0], textSecondaryRgb[1], textSecondaryRgb[2]);
      doc.text('Phone:', detailLabelX, yPos);
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(supplierPhone, detailValueX, yPos);
    }
    
    if (supplierEmail) {
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textSecondaryRgb[0], textSecondaryRgb[1], textSecondaryRgb[2]);
      doc.text('Email:', detailLabelX, yPos);
      doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(supplierEmail, detailValueX, yPos);
    }

    yPos += 12;

    // GRN Details Section
    checkPageBreak(40);
    this.setFillColorSafe(doc, colors.cardBg);
    doc.roundedRect(margin, yPos, contentWidth, 8, 2, 2, 'F');
    this.setTextColorSafe(doc, colors.text);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('📦 GRN Details', margin + 3, yPos + 5.5);
    
    yPos += 12;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    this.setTextColorSafe(doc, colors.textSecondary);
    doc.text('GRN Number:', detailLabelX, yPos);
    this.setTextColorSafe(doc, colors.text);
    doc.setFont('helvetica', 'bold');
    doc.text(grnDetails.grnNumber || '', detailValueX, yPos);
    
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    this.setTextColorSafe(doc, colors.textSecondary);
    doc.text('Received Date:', detailLabelX, yPos);
    this.setTextColorSafe(doc, colors.text);
    doc.setFont('helvetica', 'bold');
    doc.text(formattedDate, detailValueX, yPos);
    
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    this.setTextColorSafe(doc, colors.textSecondary);
    doc.text('Received By:', detailLabelX, yPos);
    this.setTextColorSafe(doc, colors.text);
    doc.setFont('helvetica', 'bold');
    doc.text(receivedByName, detailValueX, yPos);
    
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    this.setTextColorSafe(doc, colors.textSecondary);
    doc.text('Branch:', detailLabelX, yPos);
    this.setTextColorSafe(doc, colors.text);
    doc.setFont('helvetica', 'bold');
    doc.text(`${branchName}${branchCode ? ` (${branchCode})` : ''}`, detailValueX, yPos);
    
    if (grnDetails.invoiceNumber) {
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      this.setTextColorSafe(doc, colors.textSecondary);
      doc.text('Invoice Number:', detailLabelX, yPos);
      this.setTextColorSafe(doc, colors.text);
      doc.setFont('helvetica', 'bold');
      doc.text(grnDetails.invoiceNumber, detailValueX, yPos);
    }
    
    if (grnDetails.invoiceDate) {
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      this.setTextColorSafe(doc, colors.textSecondary);
      doc.text('Invoice Date:', detailLabelX, yPos);
      this.setTextColorSafe(doc, colors.text);
      doc.setFont('helvetica', 'bold');
      const invoiceDate = new Date(grnDetails.invoiceDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      doc.text(invoiceDate, detailValueX, yPos);
    }

    yPos += 12;

    // Line Items Table
    checkPageBreak(60);
    this.setFillColorSafe(doc, colors.cardBg);
    doc.roundedRect(margin, yPos, contentWidth, 8, 2, 2, 'F');
    this.setTextColorSafe(doc, colors.text);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('📋 Line Items', margin + 3, yPos + 5.5);
    
    yPos += 12;

    // Table header
    const tableStartY = yPos;
    const colWidths = {
      item: 70,
      qty: 20,
      unit: 25,
      unitPrice: 30,
      total: 30,
    };
    
    this.setFillColorSafe(doc, colors.tableHeaderBg);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    this.setTextColorSafe(doc, colors.textSecondary);
    
    let xPos = margin + 2;
    doc.text('ITEM', xPos, yPos + 5.5);
    xPos += colWidths.item;
    doc.text('QTY', xPos, yPos + 5.5, { align: 'right' });
    xPos += colWidths.qty;
    doc.text('UNIT', xPos, yPos + 5.5);
    xPos += colWidths.unit;
    doc.text('UNIT PRICE', xPos, yPos + 5.5, { align: 'right' });
    xPos += colWidths.unitPrice;
    doc.text('TOTAL', xPos, yPos + 5.5, { align: 'right' });
    
    yPos += 10;

    // Table rows
    doc.setFont('helvetica', 'normal');
    this.setTextColorSafe(doc, colors.text);
    doc.setFontSize(8);
    
    for (const item of safeItems) {
      checkPageBreak(10);
      
      const itemName = item.inventoryItem?.name || item.inventoryItem?.sku || 'Item';
      const itemQty = item.quantity ?? 0;
      const itemUnit = item.unit || '';
      const itemUnitPrice = item.unitPrice ?? 0;
      const itemTotalPrice = item.totalPrice ?? 0;

      xPos = margin + 2;
      doc.text(itemName, xPos, yPos + 4, { maxWidth: colWidths.item - 4 });
      xPos += colWidths.item;
      doc.text(itemQty.toString(), xPos, yPos + 4, { align: 'right' });
      xPos += colWidths.qty;
      doc.text(itemUnit, xPos, yPos + 4);
      xPos += colWidths.unit;
      doc.text(itemUnitPrice.toFixed(2), xPos, yPos + 4, { align: 'right' });
      xPos += colWidths.unitPrice;
      doc.text(itemTotalPrice.toFixed(2), xPos, yPos + 4, { align: 'right' });
      
      // Draw bottom border
      this.setDrawColorSafe(doc, colors.border);
      doc.line(margin, yPos + 7, pageWidth - margin, yPos + 7);
      
      yPos += 8;
    }

    // Total row
    yPos += 2;
    this.setFillColorSafe(doc, colors.tableBg);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Total Amount:', pageWidth - margin - colWidths.total - 5, yPos + 5.5, { align: 'right' });
    doc.text(formattedAmount, pageWidth - margin - 2, yPos + 5.5, { align: 'right' });

    yPos += 12;

    // Notes section (if exists)
    if (grnDetails.notes) {
      checkPageBreak(20);
      this.setFillColorSafe(doc, colors.accentBg);
      doc.roundedRect(margin, yPos, contentWidth, 15, 2, 2, 'F');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      this.setTextColorSafe(doc, colors.text);
      doc.text('Notes:', margin + 3, yPos + 5);
      
      doc.setFont('helvetica', 'normal');
      this.setTextColorSafe(doc, colors.accentText);
      const notesLines = doc.splitTextToSize(grnDetails.notes, contentWidth - 10);
      doc.text(notesLines, margin + 3, yPos + 10);
      
      yPos += 20;
    }

    // Footer
    const footerY = pageHeight - 20;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    this.setTextColorSafe(doc, colors.textSecondary);
    doc.text(
      `© ${new Date().getFullYear()} RestaurantOS. All rights reserved.`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
    doc.text(
      `Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      pageWidth / 2,
      footerY + 4,
      { align: 'center' }
    );

    // Convert to Blob
    const pdfBlob = doc.output('blob');
    return pdfBlob;
  }

  /**
   * Download GRN PDF
   * @param grnDetails - Complete GRN details
   * @param filename - Optional custom filename
   */
  async downloadGRNPDF(grnDetails: GRNDetails, filename?: string): Promise<void> {
    const pdfBlob = await this.generateGRNPDF(grnDetails);
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `GRN-${grnDetails.grnNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Print GRN PDF
   * @param grnDetails - Complete GRN details
   */
  async printGRNPDF(grnDetails: GRNDetails): Promise<void> {
    const pdfBlob = await this.generateGRNPDF(grnDetails);
    const url = URL.createObjectURL(pdfBlob);
    
    // Open in new window for printing
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }
}

export default new PDFGeneratorService();
