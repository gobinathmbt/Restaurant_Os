import PDFDocument from 'pdfkit';
import { logger } from '../utils/logger.js';

class PDFGeneratorService {
  /**
   * Generate GRN PDF receipt
   * @param {Object} grnDetails - Complete GRN details
   * @returns {Promise<Buffer>} PDF as Buffer
   */
  async generateGRNPDF(grnDetails) {
    return new Promise((resolve, reject) => {
      try {
            const {
               grnNumber,
               branch,
               supplier,
               receivedDate,
               receivedBy,
               items,
               totalAmount,
               invoiceNumber,
               invoiceDate,
               notes
            } = grnDetails;

            // Safe accessors to avoid crashing when some refs are null
            const branchName = branch?.name || 'Branch';
            const branchCode = branch?.code || '';
            const branchAddress = (branch?.address)
               ? [branch.address.street, branch.address.city, branch.address.state, branch.address.pincode].filter(Boolean).join(', ')
               : '';

            const supplierName = supplier?.name || 'Supplier';
            const supplierContact = supplier?.contactPerson || '';
            const supplierPhone = supplier?.phone || '';
            const supplierEmail = supplier?.email || '';

            const receivedByName = receivedBy?.name || 'Receiver';

            const safeItems = Array.isArray(items) ? items : [];
            const safeTotalAmount = (totalAmount != null) ? totalAmount : 0;

        // Create PDF document
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50
        });

        // Buffer to store PDF
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Colors (green, black, white theme)
        const colors = {
          primary: '#10b981',
          dark: '#000000',
          gray: '#6b7280',
          lightGray: '#f3f4f6',
          white: '#ffffff'
        };

        // Header with logo and title
        doc.fontSize(28)
           .fillColor(colors.dark)
           .text('RestaurantOS', 50, 50);

        doc.fontSize(10)
           .fillColor(colors.gray)
           .text('Restaurant Management System', 50, 82);

        // GRN Title
        doc.fontSize(24)
           .fillColor(colors.primary)
           .text('Goods Receipt Note', 50, 120);

        // GRN Number Badge
        doc.roundedRect(400, 50, 145, 40, 5)
           .fillAndStroke(colors.primary, colors.primary);

        doc.fontSize(10)
           .fillColor(colors.white)
           .text('GRN NUMBER', 410, 58);

        doc.fontSize(14)
           .fillColor(colors.white)
           .font('Helvetica-Bold')
           .text(grnNumber, 410, 72);

        doc.font('Helvetica'); // Reset font

        // Horizontal line
        doc.moveTo(50, 170)
           .lineTo(545, 170)
           .strokeColor(colors.lightGray)
           .lineWidth(2)
           .stroke();

        // GRN Details Section
        let yPosition = 190;

        // Left column - Branch and Supplier
        doc.fontSize(12)
           .fillColor(colors.dark)
           .font('Helvetica-Bold')
           .text('Branch Information', 50, yPosition);

        yPosition += 20;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(colors.gray)
           .text('Branch:', 50, yPosition);

        doc.fillColor(colors.dark)
           .text(`${branchName}${branchCode ? ` (${branchCode})` : ''}`, 150, yPosition);

        yPosition += 15;
            if (branchAddress) {
               doc.fillColor(colors.gray)
                   .text('Address:', 50, yPosition);

               doc.fillColor(colors.dark)
                   .text(branchAddress, 150, yPosition, { width: 200 });

               yPosition += 30;
            } else {
               yPosition += 20;
            }

        // Supplier Information
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(colors.dark)
           .text('Supplier Information', 50, yPosition);

        yPosition += 20;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(colors.gray)
           .text('Supplier:', 50, yPosition);

        doc.fillColor(colors.dark)
           .text(supplierName, 150, yPosition);

        yPosition += 15;
        if (supplierContact) {
          doc.fillColor(colors.gray)
             .text('Contact:', 50, yPosition);

          doc.fillColor(colors.dark)
             .text(supplierContact, 150, yPosition);

          yPosition += 15;
        }

        if (supplierPhone) {
          doc.fillColor(colors.gray)
             .text('Phone:', 50, yPosition);

          doc.fillColor(colors.dark)
             .text(supplierPhone, 150, yPosition);

          yPosition += 15;
        }

        if (supplierEmail) {
          doc.fillColor(colors.gray)
             .text('Email:', 50, yPosition);

          doc.fillColor(colors.dark)
             .text(supplierEmail, 150, yPosition);

          yPosition += 15;
        }

        // Right column - GRN Details
        yPosition = 190;

        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(colors.dark)
           .text('GRN Details', 350, yPosition);

        yPosition += 20;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(colors.gray)
           .text('Received Date:', 350, yPosition);

        const formattedDate = new Date(receivedDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        doc.fillColor(colors.dark)
           .text(formattedDate, 450, yPosition);

        yPosition += 15;
        doc.fillColor(colors.gray)
           .text('Received By:', 350, yPosition);

        doc.fillColor(colors.dark)
           .text(receivedByName, 450, yPosition);

        yPosition += 15;
        if (invoiceNumber) {
          doc.fillColor(colors.gray)
             .text('Invoice Number:', 350, yPosition);

          doc.fillColor(colors.dark)
             .text(invoiceNumber, 450, yPosition);

          yPosition += 15;
        }

        if (invoiceDate) {
          doc.fillColor(colors.gray)
             .text('Invoice Date:', 350, yPosition);

          const formattedInvoiceDate = new Date(invoiceDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          doc.fillColor(colors.dark)
             .text(formattedInvoiceDate, 450, yPosition);

          yPosition += 15;
        }

        // Line Items Table
        yPosition = Math.max(yPosition, 380);
        yPosition += 20;

        // Table header
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(colors.dark)
           .text('Line Items', 50, yPosition);

        yPosition += 25;

        // Table header background
        doc.rect(50, yPosition, 495, 25)
           .fillAndStroke(colors.lightGray, colors.lightGray);

        // Table headers
        doc.fontSize(9)
           .fillColor(colors.dark)
           .font('Helvetica-Bold')
           .text('Item', 60, yPosition + 8, { width: 200 })
           .text('Qty', 270, yPosition + 8, { width: 50, align: 'right' })
           .text('Unit', 330, yPosition + 8, { width: 50 })
           .text('Unit Price', 390, yPosition + 8, { width: 70, align: 'right' })
           .text('Total', 470, yPosition + 8, { width: 65, align: 'right' });

        yPosition += 25;

            // Table rows
            doc.font('Helvetica');
            safeItems.forEach((item, index) => {
          // Check if we need a new page
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
          }

          // Alternate row background
          if (index % 2 === 0) {
            doc.rect(50, yPosition, 495, 20)
               .fillAndStroke('#fafafa', '#fafafa');
          }

          const inventoryItemName = item.inventoryItem?.name || item.itemName || 'Item';
          const quantityStr = String(item.quantity ?? 0);
          const unitStr = item.unit || '';
          const unitPriceStr = `$${(item.unitPrice ?? 0).toFixed(2)}`;
          const totalPriceStr = `$${(item.totalPrice ?? 0).toFixed(2)}`;

          doc.fontSize(9)
             .fillColor(colors.dark)
             .text(inventoryItemName, 60, yPosition + 5, { width: 200 })
             .text(quantityStr, 270, yPosition + 5, { width: 50, align: 'right' })
             .text(unitStr, 330, yPosition + 5, { width: 50 })
             .text(unitPriceStr, 390, yPosition + 5, { width: 70, align: 'right' })
             .text(totalPriceStr, 470, yPosition + 5, { width: 65, align: 'right' });

          yPosition += 20;
        });

        // Total row
        yPosition += 5;
        doc.rect(50, yPosition, 495, 30)
           .fillAndStroke(colors.primary, colors.primary);

        doc.fontSize(12)
           .fillColor(colors.white)
           .font('Helvetica-Bold')
           .text('Total Amount:', 60, yPosition + 10)
           .text(`$${totalAmount.toFixed(2)}`, 470, yPosition + 10, { width: 65, align: 'right' });

        // Notes section
        if (notes) {
          yPosition += 50;

          // Check if we need a new page
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
          }

          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(colors.dark)
             .text('Notes', 50, yPosition);

          yPosition += 20;
          doc.fontSize(10)
             .font('Helvetica')
             .fillColor(colors.gray)
             .text(notes, 50, yPosition, { width: 495 });
        }

        // Footer
        const footerY = 750;
        doc.fontSize(8)
           .fillColor(colors.gray)
           .text(
             `Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} | RestaurantOS`,
             50,
             footerY,
             { align: 'center', width: 495 }
           );

        // Finalize PDF
        doc.end();

        logger.info(`PDF generated for GRN: ${grnNumber}`);
      } catch (error) {
        logger.error('Error generating GRN PDF:', error);
        reject(error);
      }
    });
  }
}

export default new PDFGeneratorService();
