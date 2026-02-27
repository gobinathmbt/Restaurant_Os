import { ENV } from '../../config/env.js';

/**
 * Generate HTML email template for stock request approval
 */
export function generateRequestApprovalEmailTemplate(request, recipientName, transfer, backorders) {
  const {
    requestNumber,
    destinationLocation,
    sourceLocation,
    items,
    approvedBy,
    approvedDate
  } = request;

  const formattedApprovalDate = new Date(approvedDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const hasBackorders = backorders && backorders.length > 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stock Request Approved</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 40px 30px; text-align: center;">
      <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; font-size: 28px;">🍽️</div>
        <div style="font-size: 28px; font-weight: 700; color: #ffffff;">RestaurantOS</div>
      </div>
      <h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">Request Approved ✅</h1>
      <p style="font-size: 16px; color: #10b981; font-weight: 500;">Inventory Management</p>
    </div>

    <div style="padding: 40px 30px;">
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">Hello ${recipientName || 'Admin'},</p>
      
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 25px; border-radius: 12px; margin: 30px 0; text-align: center; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);">
        <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
        <div style="font-size: 24px; font-weight: 700; margin-bottom: 10px;">Request Approved!</div>
        <div style="font-size: 14px; opacity: 0.9;">
          Your stock request has been approved${hasBackorders ? ' with some items backordered' : ''}.
        </div>
      </div>

      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <div style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 15px;">📦 Request Details</div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Request Number:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${requestNumber}</div>
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
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Approved By:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${approvedBy?.name || 'N/A'}</div>
        </div>
        <div style="display: flex; padding: 8px 0;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Approved Date:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${formattedApprovalDate}</div>
        </div>
        ${transfer ? `
        <div style="display: flex; padding: 8px 0; border-top: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Transfer Number:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${transfer.transferNumber}</div>
        </div>
        ` : ''}
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead style="background: #f9fafb;">
          <tr>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Item</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Requested</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Approved</th>
            ${hasBackorders ? '<th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Backordered</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => `
          <tr${index === items.length - 1 ? '' : ' style="border-bottom: 1px solid #f3f4f6;"'}>
            <td style="padding: 12px; font-size: 13px; color: #111827;">${item?.inventoryItem?.name || 'Unknown Item'}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827; text-align: right;">${item?.requestedQuantity || 0}</td>
            <td style="padding: 12px; font-size: 13px; color: #10b981; text-align: right; font-weight: 600;">${item?.approvedQuantity || 0}</td>
            ${hasBackorders ? `<td style="padding: 12px; font-size: 13px; color: #f59e0b; text-align: right; font-weight: 600;">${item?.backorderedQuantity || 0}</td>` : ''}
          </tr>
          `).join('')}
        </tbody>
      </table>

      ${hasBackorders ? `
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <div style="font-size: 13px; color: #92400e; line-height: 1.6;">
          ⚠️ <strong>Backorders Created:</strong> ${backorders.length} item(s) have been backordered due to insufficient inventory. You will be notified when they are fulfilled.
        </div>
      </div>
      ` : ''}

      <div style="text-align: center;">
        <a href="${ENV.FRONTEND_URL}/inventory/stock-requests/${request._id}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">View Request Details →</a>
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
 * Generate HTML email template for stock request rejection
 */
export function generateRequestRejectionEmailTemplate(request, recipientName) {
  const {
    requestNumber,
    destinationLocation,
    sourceLocation,
    items,
    rejectedBy,
    rejectedDate,
    rejectionReason
  } = request;

  const formattedRejectionDate = new Date(rejectedDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0;">
  <title>Stock Request Rejected</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 40px 30px; text-align: center;">
      <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; font-size: 28px;">🍽️</div>
        <div style="font-size: 28px; font-weight: 700; color: #ffffff;">RestaurantOS</div>
      </div>
      <h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">Request Rejected ❌</h1>
      <p style="font-size: 16px; color: #ef4444; font-weight: 500;">Inventory Management</p>
    </div>

    <div style="padding: 40px 30px;">
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">Hello ${recipientName || 'Admin'},</p>
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">
        Unfortunately, your stock request has been rejected. Please review the reason below and create a new request if needed.
      </p>

      <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <div style="font-size: 14px; font-weight: 600; color: #991b1b; margin-bottom: 10px;">Rejection Reason:</div>
        <div style="font-size: 14px; color: #7f1d1d; line-height: 1.6;">${rejectionReason || 'No reason provided'}</div>
      </div>

      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <div style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 15px;">📦 Request Details</div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Request Number:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${requestNumber}</div>
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
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Rejected By:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${rejectedBy?.name || 'N/A'}</div>
        </div>
        <div style="display: flex; padding: 8px 0;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Rejected Date:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${formattedRejectionDate}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead style="background: #f9fafb;">
          <tr>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Item</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Requested Qty</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Unit</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => `
          <tr${index === items.length - 1 ? '' : ' style="border-bottom: 1px solid #f3f4f6;"'}>
            <td style="padding: 12px; font-size: 13px; color: #111827;">${item?.inventoryItem?.name || 'Unknown Item'}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827; text-align: right;">${item?.requestedQuantity || 0}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827;">${item?.unit || 'N/A'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="text-align: center;">
        <a href="${ENV.FRONTEND_URL}/inventory/stock-requests/${request._id}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">View Request Details →</a>
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
 * Generate HTML email template for stock request cancellation
 */
export function generateRequestCancellationEmailTemplate(request, recipientName) {
  const {
    requestNumber,
    destinationLocation,
    sourceLocation,
    items,
    cancelledBy,
    cancelledDate,
    cancellationReason
  } = request;

  const formattedCancellationDate = new Date(cancelledDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stock Request Cancelled</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 40px 30px; text-align: center;">
      <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; font-size: 28px;">🍽️</div>
        <div style="font-size: 28px; font-weight: 700; color: #ffffff;">RestaurantOS</div>
      </div>
      <h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">Request Cancelled 🚫</h1>
      <p style="font-size: 16px; color: #f59e0b; font-weight: 500;">Inventory Management</p>
    </div>

    <div style="padding: 40px 30px;">
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">Hello ${recipientName || 'Admin'},</p>
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">
        A stock request has been cancelled by the requester. Please review the details below.
      </p>

      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <div style="font-size: 14px; font-weight: 600; color: #92400e; margin-bottom: 10px;">Cancellation Reason:</div>
        <div style="font-size: 14px; color: #78350f; line-height: 1.6;">${cancellationReason || 'No reason provided'}</div>
      </div>

      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <div style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 15px;">📦 Request Details</div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Request Number:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${requestNumber}</div>
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
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Cancelled By:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${cancelledBy?.name || 'N/A'}</div>
        </div>
        <div style="display: flex; padding: 8px 0;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Cancelled Date:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${formattedCancellationDate}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead style="background: #f9fafb;">
          <tr>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Item</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Requested Qty</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Unit</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => `
          <tr${index === items.length - 1 ? '' : ' style="border-bottom: 1px solid #f3f4f6;"'}>
            <td style="padding: 12px; font-size: 13px; color: #111827;">${item?.inventoryItem?.name || 'Unknown Item'}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827; text-align: right;">${item?.requestedQuantity || 0}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827;">${item?.unit || 'N/A'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="text-align: center;">
        <a href="${ENV.FRONTEND_URL}/inventory/stock-requests/${request._id}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">View Request Details →</a>
      </div>

      <p style="font-size: 15px; color: #111827; margin-top: 30px; font-weight: 600;">
        Best regards,<br>
        The RestaurantOS Team
      </p>
    </div>

    <div style="background: #111827; color: #9ca3af; padding: 30px; text-align: center; font-size: 13px;">
      <p style="margin-bottom: 10px;">© ${new Date().getFullYear()} RestaurantOS. All rights reserved.</p>
      <div style="margin: 15px 0;">
        <a href="${ENV.FRONTEND_URL}" style="color: #10b981; text-decoration: none; margin: 0 10px;">Website</a>
        <a href="${ENV.FRONTEND_URL}/docs" style="color: #10b981; text-decoration: none; margin: 0 10px;">Documentation</a>
        <a href="${ENV.FRONTEND_URL}/support" style="color: #10b981; text-decoration: none; margin: 0 10px;">Support</a>
      </div>
      <p style="margin-top: 15px; font-size: 12px;">
        This is an automated notification from RestaurantOS.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}
