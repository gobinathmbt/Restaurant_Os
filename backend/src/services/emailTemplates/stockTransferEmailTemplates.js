import { ENV } from '../../config/env.js';

/**
 * Generate HTML email template for transfer shipped
 */
export function generateTransferShippedEmailTemplate(transfer, recipientName) {
  const {
    transferNumber,
    destinationLocation,
    sourceLocation,
    items,
    shippedBy,
    shippedDate,
    expectedDeliveryDate
  } = transfer;

  const formattedShippedDate = new Date(shippedDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const formattedExpectedDate = expectedDeliveryDate ? new Date(expectedDeliveryDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'N/A';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transfer Shipped</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 40px 30px; text-align: center;">
      <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; font-size: 28px;">🍽️</div>
        <div style="font-size: 28px; font-weight: 700; color: #ffffff;">RestaurantOS</div>
      </div>
      <h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">Transfer Shipped 🚚</h1>
      <p style="font-size: 16px; color: #10b981; font-weight: 500;">Inventory Management</p>
    </div>

    <div style="padding: 40px 30px;">
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">Hello ${recipientName || 'Admin'},</p>
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">
        A stock transfer has been shipped and is on its way to your location. Please prepare to receive the items.
      </p>

      <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; padding: 25px; border-radius: 12px; margin: 30px 0; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);">
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
          <span style="font-size: 14px; opacity: 0.9;">Transfer Number:</span>
          <span style="font-size: 14px; font-weight: 600;">${transferNumber}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
          <span style="font-size: 14px; opacity: 0.9;">From Location:</span>
          <span style="font-size: 14px; font-weight: 600;">${destinationLocation?.name || 'N/A'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
          <span style="font-size: 14px; opacity: 0.9;">To Location:</span>
          <span style="font-size: 14px; font-weight: 600;">${sourceLocation?.name || 'N/A'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
          <span style="font-size: 14px; opacity: 0.9;">Shipped By:</span>
          <span style="font-size: 14px; font-weight: 600;">${shippedBy?.name || 'N/A'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
          <span style="font-size: 14px; opacity: 0.9;">Shipped Date:</span>
          <span style="font-size: 14px; font-weight: 600;">${formattedShippedDate}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0;">
          <span style="font-size: 14px; opacity: 0.9;">Expected Arrival:</span>
          <span style="font-size: 14px; font-weight: 600;">${formattedExpectedDate}</span>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead style="background: #f9fafb;">
          <tr>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Item</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Quantity</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Unit</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => `
          <tr${index === items.length - 1 ? '' : ' style="border-bottom: 1px solid #f3f4f6;"'}>
            <td style="padding: 12px; font-size: 13px; color: #111827;">${item?.inventoryItem?.name || 'Unknown Item'}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827; text-align: right; font-weight: 600;">${item?.sentQuantity || item?.requestedQuantity || 0}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827;">${item?.unit || 'N/A'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <div style="font-size: 13px; color: #1e40af; line-height: 1.6;">
          📦 <strong>Action Required:</strong> Please prepare to receive this transfer and verify the quantities upon arrival.
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${ENV.FRONTEND_URL}/inventory/stock-transfers/${transfer._id}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">View Transfer Details →</a>
      </div>

      <p style="font-size: 15px; color: #111827; margin-top: 30px; font-weight: 600;">
        Best regards,<br>
        The RestaurantOS Team
      </p>
    </div>

    <div style="background: #111827; color: #9ca3af; padding: 30px; text-align: center; font-size: 13px;">
      <p>© ${new Date().getFullYear()} RestaurantOS. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate HTML email template for transfer completed
 */
export function generateTransferCompletedEmailTemplate(transfer, recipientName) {
  const {
    transferNumber,
    destinationLocation,
    sourceLocation,
    items,
    receivedBy,
    receivedDate
  } = transfer;

  const formattedReceivedDate = new Date(receivedDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const hasDiscrepancies = items.some(item => item.discrepancyQuantity && item.discrepancyQuantity !== 0);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transfer Completed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 40px 30px; text-align: center;">
      <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; font-size: 28px;">🍽️</div>
        <div style="font-size: 28px; font-weight: 700; color: #ffffff;">RestaurantOS</div>
      </div>
      <h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">Transfer Completed ✅</h1>
      <p style="font-size: 16px; color: #10b981; font-weight: 500;">Inventory Management</p>
    </div>

    <div style="padding: 40px 30px;">
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">Hello ${recipientName || 'Admin'},</p>
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">
        A stock transfer has been received and completed${hasDiscrepancies ? ' with some discrepancies' : ''}.
      </p>

      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 25px; border-radius: 12px; margin: 30px 0; text-align: center; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);">
        <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
        <div style="font-size: 24px; font-weight: 700; margin-bottom: 10px;">Transfer Completed!</div>
        <div style="font-size: 14px; opacity: 0.9;">
          The transfer has been received and inventory has been updated.
        </div>
      </div>

      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <div style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 15px;">📦 Transfer Details</div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Transfer Number:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${transferNumber}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">From Location:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${destinationLocation?.name || 'N/A'}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">To Location:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${sourceLocation?.name || 'N/A'}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Received By:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${receivedBy?.name || 'N/A'}</div>
        </div>
        <div style="display: flex; padding: 8px 0;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Received Date:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${formattedReceivedDate}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead style="background: #f9fafb;">
          <tr>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Item</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Sent</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Received</th>
            ${hasDiscrepancies ? '<th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Discrepancy</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => {
            const sentQty = item?.sentQuantity || item?.requestedQuantity || 0;
            const receivedQty = item?.receivedQuantity || sentQty;
            const discrepancy = item?.discrepancyQuantity || 0;
            const hasItemDiscrepancy = discrepancy !== 0;
            
            return `
          <tr${index === items.length - 1 ? '' : ' style="border-bottom: 1px solid #f3f4f6;"'}>
            <td style="padding: 12px; font-size: 13px; color: #111827;">${item?.inventoryItem?.name || 'Unknown Item'}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827; text-align: right;">${sentQty}</td>
            <td style="padding: 12px; font-size: 13px; color: ${hasItemDiscrepancy ? '#f59e0b' : '#10b981'}; text-align: right; font-weight: 600;">${receivedQty}</td>
            ${hasDiscrepancies ? `<td style="padding: 12px; font-size: 13px; color: ${hasItemDiscrepancy ? '#ef4444' : '#6b7280'}; text-align: right; font-weight: ${hasItemDiscrepancy ? '600' : 'normal'};">${discrepancy}</td>` : ''}
          </tr>
          `;
          }).join('')}
        </tbody>
      </table>

      ${hasDiscrepancies ? `
      <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <div style="font-size: 13px; color: #991b1b; line-height: 1.6;">
          ⚠️ <strong>Discrepancies Detected:</strong> Some items were received in different quantities than sent. Please review the transfer details.
        </div>
      </div>
      ` : ''}

      <div style="text-align: center;">
        <a href="${ENV.FRONTEND_URL}/inventory/stock-transfers/${transfer._id}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">View Transfer Details →</a>
      </div>

      <p style="font-size: 15px; color: #111827; margin-top: 30px; font-weight: 600;">
        Best regards,<br>
        The RestaurantOS Team
      </p>
    </div>

    <div style="background: #111827; color: #9ca3af; padding: 30px; text-align: center; font-size: 13px;">
      <p>© ${new Date().getFullYear()} RestaurantOS. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate HTML email template for backorder creation
 */
export function generateBackorderCreationEmailTemplate(backorder, recipientName) {
  const {
    originalRequestId,
    destinationLocation,
    sourceLocation,
    inventoryItem,
    backorderedQuantity,
    unit,
    createdAt
  } = backorder;

  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Estimate fulfillment date (14 days from creation)
  const estimatedFulfillmentDate = new Date(createdAt);
  estimatedFulfillmentDate.setDate(estimatedFulfillmentDate.getDate() + 14);
  const formattedEstimatedDate = estimatedFulfillmentDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Backorder Created</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 40px 30px; text-align: center;">
      <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; font-size: 28px;">🍽️</div>
        <div style="font-size: 28px; font-weight: 700; color: #ffffff;">RestaurantOS</div>
      </div>
      <h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">Backorder Created 📋</h1>
      <p style="font-size: 16px; color: #f59e0b; font-weight: 500;">Inventory Management</p>
    </div>

    <div style="padding: 40px 30px;">
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">Hello ${recipientName || 'Admin'},</p>
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">
        A backorder has been created for items that could not be fulfilled from your stock request due to insufficient inventory.
      </p>

      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <div style="font-size: 14px; font-weight: 600; color: #92400e; margin-bottom: 10px;">Backorder Information:</div>
        <div style="font-size: 14px; color: #78350f; line-height: 1.6;">
          The requested items were not available in sufficient quantity. You will be notified when the backorder is fulfilled.
        </div>
      </div>

      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <div style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 15px;">📦 Backorder Details</div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">Original Request:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${originalRequestId?.requestNumber || 'N/A'}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">From Location:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${destinationLocation?.name || 'N/A'}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">To Location:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${sourceLocation?.name || 'N/A'}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">Item:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${inventoryItem?.name || 'N/A'}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">Backordered Quantity:</div>
          <div style="font-size: 13px; color: #f59e0b; font-weight: 600;">${backorderedQuantity} ${unit}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">Created Date:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${formattedDate}</div>
        </div>
        <div style="display: flex; padding: 8px 0;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">Estimated Fulfillment:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${formattedEstimatedDate}</div>
        </div>
      </div>

      <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <div style="font-size: 13px; color: #1e40af; line-height: 1.6;">
          ℹ️ <strong>What's Next:</strong> The warehouse team will work to fulfill this backorder. You will receive a notification when the items are ready to be shipped.
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${ENV.FRONTEND_URL}/inventory/backorders" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">View Backorders →</a>
      </div>

      <p style="font-size: 15px; color: #111827; margin-top: 30px; font-weight: 600;">
        Best regards,<br>
        The RestaurantOS Team
      </p>
    </div>

    <div style="background: #111827; color: #9ca3af; padding: 30px; text-align: center; font-size: 13px;">
      <p>© ${new Date().getFullYear()} RestaurantOS. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}
