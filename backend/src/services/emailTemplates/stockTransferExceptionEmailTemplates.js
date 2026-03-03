import { ENV } from '../../config/env.js';

/**
 * Generate HTML email template for exception notification to super admins
 */
export function generateExceptionNotificationEmailTemplate(transfer, exceptionSummary, recipientName) {
  const severityBadge = {
    high: '<span style="background: #ef4444; color: white; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">HIGH SEVERITY</span>',
    medium: '<span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">MEDIUM SEVERITY</span>',
    low: '<span style="background: #3b82f6; color: white; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">LOW SEVERITY</span>'
  }[exceptionSummary.highestSeverity];

  const exceptionTypeBadges = Object.entries(exceptionSummary.byType)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => {
      const colors = {
        damage: '#ef4444',
        missing: '#f59e0b',
        excess: '#3b82f6'
      };
      return `<span style="background: ${colors[type]}; color: white; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-right: 8px;">${type.toUpperCase()}: ${count}</span>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stock Transfer Exceptions</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 40px 30px; text-align: center;">
      <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; font-size: 28px;">🍽️</div>
        <div style="font-size: 28px; font-weight: 700; color: #ffffff;">RestaurantOS</div>
      </div>
      <h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">Transfer Exceptions Reported ⚠️</h1>
      <p style="font-size: 16px; color: #ef4444; font-weight: 500;">Requires Super Admin Resolution</p>
    </div>

    <div style="padding: 40px 30px;">
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">Hello ${recipientName || 'Super Admin'},</p>
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">
        Exceptions have been reported for a stock transfer and require your immediate attention for resolution.
      </p>

      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <div style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 15px;">📦 Transfer Details</div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Transfer Number:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${transfer.transferNumber}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">From:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${transfer.sourceLocation?.name || 'Unknown'}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">To:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${transfer.destinationLocation?.name || 'Unknown'}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Total Exceptions:</div>
          <div style="font-size: 13px; color: #ef4444; font-weight: 600;">${exceptionSummary.total}</div>
        </div>
        <div style="display: flex; padding: 8px 0;">
          <div style="font-size: 13px; color: #6b7280; width: 140px;">Severity:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${severityBadge}</div>
        </div>
      </div>

      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <div style="font-size: 14px; color: #92400e; line-height: 1.6; margin-bottom: 10px;">
          <strong>Exception Types:</strong>
        </div>
        <div style="margin-top: 10px;">
          ${exceptionTypeBadges}
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead style="background: #f9fafb;">
          <tr>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Type</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Item</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Quantity</th>
            <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Severity</th>
          </tr>
        </thead>
        <tbody>
          ${transfer.exceptions.map((exception, index) => {
            const typeBadge = {
              damage: '<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">DAMAGE</span>',
              missing: '<span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">MISSING</span>',
              excess: '<span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">EXCESS</span>'
            }[exception.type] || exception.type;

            const severityIndicator = {
              high: '<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">HIGH</span>',
              medium: '<span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">MEDIUM</span>',
              low: '<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">LOW</span>'
            }[exception.severity || 'medium'];

            return `
          <tr${index === transfer.exceptions.length - 1 ? '' : ' style="border-bottom: 1px solid #f3f4f6;"'}>
            <td style="padding: 12px; font-size: 13px; color: #111827;">${typeBadge}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827;">${exception.inventoryItem?.name || 'Unknown Item'}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827; text-align: right; font-weight: 600;">${exception.quantity} ${exception.unit}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827; text-align: center;">${severityIndicator}</td>
          </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <div style="font-size: 13px; color: #991b1b; line-height: 1.6;">
          ⚠️ <strong>Action Required:</strong> Please review and resolve each exception to allow the transfer to be completed.
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${ENV.FRONTEND_URL}/inventory/stock-transfers/${transfer._id}/exceptions" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">Resolve Exceptions →</a>
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
 * Generate HTML email template for exceptions resolved notification to destination admin
 */
export function generateExceptionsResolvedEmailTemplate(transfer, resolutionSummary, recipientName) {
  const resolutionBadges = Object.entries(resolutionSummary.byAction)
    .filter(([_, count]) => count > 0)
    .map(([action, count]) => {
      const labels = {
        confirm_damage: 'Damage Confirmed',
        return_to_source: 'Returned to Source',
        accept_excess: 'Excess Accepted',
        reject_excess: 'Excess Rejected'
      };
      return `<span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-right: 8px;">${labels[action]}: ${count}</span>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exceptions Resolved</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 40px 30px; text-align: center;">
      <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; font-size: 28px;">🍽️</div>
        <div style="font-size: 28px; font-weight: 700; color: #ffffff;">RestaurantOS</div>
      </div>
      <h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">Exceptions Resolved ✅</h1>
      <p style="font-size: 16px; color: #10b981; font-weight: 500;">Ready to Complete Transfer</p>
    </div>

    <div style="padding: 40px 30px;">
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">Hello ${recipientName || 'Admin'},</p>
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">
        Good news! All exceptions for your stock transfer have been resolved by the super admin team. You can now proceed to complete the transfer.
      </p>

      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <div style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 15px;">📦 Transfer Details</div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">Transfer Number:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${transfer.transferNumber}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">From:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${transfer.sourceLocation?.name || 'Unknown'}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">To:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${transfer.destinationLocation?.name || 'Unknown'}</div>
        </div>
        <div style="display: flex; padding: 8px 0;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">Exceptions Resolved:</div>
          <div style="font-size: 13px; color: #10b981; font-weight: 600;">${resolutionSummary.total}</div>
        </div>
      </div>

      <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <div style="font-size: 14px; color: #065f46; line-height: 1.6; margin-bottom: 10px;">
          <strong>Resolution Summary:</strong>
        </div>
        <div style="margin-top: 10px;">
          ${resolutionBadges}
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead style="background: #f9fafb;">
          <tr>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Type</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Item</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Resolution</th>
          </tr>
        </thead>
        <tbody>
          ${transfer.exceptions.map((exception, index) => {
            const resolutionLabels = {
              confirm_damage: 'Damage Confirmed',
              return_to_source: 'Returned to Source',
              accept_excess: 'Excess Accepted',
              reject_excess: 'Excess Rejected'
            };

            return `
          <tr${index === transfer.exceptions.length - 1 ? '' : ' style="border-bottom: 1px solid #f3f4f6;"'}>
            <td style="padding: 12px; font-size: 13px; color: #111827; text-transform: capitalize;">${exception.type}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827;">${exception.inventoryItem?.name || 'Unknown Item'} (${exception.quantity} ${exception.unit})</td>
            <td style="padding: 12px; font-size: 13px; color: #059669; font-weight: 600;">${resolutionLabels[exception.resolutionAction] || exception.resolutionAction}</td>
          </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <div style="font-size: 13px; color: #065f46; line-height: 1.6;">
          ✅ <strong>Next Step:</strong> Please complete the transfer to apply the inventory adjustments based on the exception resolutions.
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${ENV.FRONTEND_URL}/inventory/stock-transfers/${transfer._id}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">Complete Transfer →</a>
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
 * Generate HTML email template for escalation notification to senior management
 */
export function generateEscalationEmailTemplate(transfer, escalationReason, unresolvedCount, recipientName) {
  const unresolvedExceptions = transfer.exceptions.filter(ex => !ex.resolved);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESCALATED: Transfer Exceptions</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 40px 30px; text-align: center;">
      <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; font-size: 28px;">🍽️</div>
        <div style="font-size: 28px; font-weight: 700; color: #ffffff;">RestaurantOS</div>
      </div>
      <h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">ESCALATED: Transfer Exceptions 🚨</h1>
      <p style="font-size: 16px; color: #ef4444; font-weight: 500;">Critical - Immediate Action Required</p>
    </div>

    <div style="padding: 40px 30px;">
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">Hello ${recipientName || 'Senior Management'},</p>
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">
        <strong style="color: #dc2626;">CRITICAL ALERT:</strong> A stock transfer with unresolved exceptions has been escalated and requires immediate senior management attention.
      </p>

      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <div style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 15px;">📦 Transfer Details</div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">Transfer Number:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${transfer.transferNumber}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">From:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${transfer.sourceLocation?.name || 'Unknown'}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">To:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${transfer.destinationLocation?.name || 'Unknown'}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">Unresolved Exceptions:</div>
          <div style="font-size: 13px; color: #ef4444; font-weight: 600;">${unresolvedCount}</div>
        </div>
        <div style="display: flex; padding: 8px 0;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">Escalation Reason:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${escalationReason}</div>
        </div>
      </div>

      <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <div style="font-size: 14px; color: #991b1b; line-height: 1.6;">
          🚨 <strong>Critical Issue:</strong> This transfer has been escalated due to unresolved exceptions. Immediate resolution is required to prevent inventory discrepancies and operational delays.
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead style="background: #fee2e2;">
          <tr>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #991b1b; text-transform: uppercase; border-bottom: 2px solid #fecaca;">Type</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #991b1b; text-transform: uppercase; border-bottom: 2px solid #fecaca;">Item</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #991b1b; text-transform: uppercase; border-bottom: 2px solid #fecaca;">Quantity</th>
            <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: #991b1b; text-transform: uppercase; border-bottom: 2px solid #fecaca;">Severity</th>
          </tr>
        </thead>
        <tbody>
          ${unresolvedExceptions.map((exception, index) => {
            const typeBadge = {
              damage: '<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">DAMAGE</span>',
              missing: '<span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">MISSING</span>',
              excess: '<span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">EXCESS</span>'
            }[exception.type] || exception.type;

            const severityIndicator = {
              high: '<span style="background: #dc2626; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">HIGH</span>',
              medium: '<span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">MEDIUM</span>',
              low: '<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">LOW</span>'
            }[exception.severity || 'medium'];

            return `
          <tr${index === unresolvedExceptions.length - 1 ? '' : ' style="border-bottom: 1px solid #f3f4f6;"'}>
            <td style="padding: 12px; font-size: 13px; color: #111827;">${typeBadge}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827;">${exception.inventoryItem?.name || 'Unknown Item'}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827; text-align: right; font-weight: 600;">${exception.quantity} ${exception.unit}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827; text-align: center;">${severityIndicator}</td>
          </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <div style="font-size: 13px; color: #991b1b; line-height: 1.6;">
          ⚠️ <strong>Required Action:</strong> Please review and resolve these exceptions immediately, or use the force completion option if necessary with proper justification.
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${ENV.FRONTEND_URL}/inventory/stock-transfers/${transfer._id}/exceptions" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">Resolve Immediately →</a>
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
 * Generate HTML email template for force completion notification to senior management
 */
export function generateForceCompletionEmailTemplate(transfer, completedByUser, recipientName) {
  const formattedDate = new Date(transfer.forceCompletedAt || new Date()).toLocaleDateString('en-US', {
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
  <title>Transfer Force Completed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 40px 30px; text-align: center;">
      <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; font-size: 28px;">🍽️</div>
        <div style="font-size: 28px; font-weight: 700; color: #ffffff;">RestaurantOS</div>
      </div>
      <h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">Transfer Force Completed ⚠️</h1>
      <p style="font-size: 16px; color: #f59e0b; font-weight: 500;">Audit Trail Notification</p>
    </div>

    <div style="padding: 40px 30px;">
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">Hello ${recipientName || 'Senior Management'},</p>
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">
        This is an audit trail notification. A stock transfer has been force completed by a super administrator, bypassing the normal exception resolution workflow.
      </p>

      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <div style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 15px;">📦 Transfer Details</div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">Transfer Number:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${transfer.transferNumber}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">From:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${transfer.sourceLocation?.name || 'Unknown'}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">To:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${transfer.destinationLocation?.name || 'Unknown'}</div>
        </div>
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">Force Completed By:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${completedByUser.name}</div>
        </div>
        <div style="display: flex; padding: 8px 0;">
          <div style="font-size: 13px; color: #6b7280; width: 160px;">Completed At:</div>
          <div style="font-size: 13px; color: #111827; font-weight: 500;">${formattedDate}</div>
        </div>
      </div>

      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <div style="font-size: 14px; color: #92400e; line-height: 1.6; margin-bottom: 10px;">
          <strong>Override Reason:</strong>
        </div>
        <div style="font-size: 14px; color: #92400e; line-height: 1.6;">
          ${transfer.forceCompletionReason || 'No reason provided'}
        </div>
      </div>

      ${transfer.exceptions && transfer.exceptions.length > 0 ? `
      <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <div style="font-size: 13px; color: #991b1b; line-height: 1.6;">
          ⚠️ <strong>Note:</strong> This transfer had ${transfer.exceptions.length} exception(s) that were bypassed by the force completion.
        </div>
      </div>
      ` : ''}

      <div style="background: #f3f4f6; border-left: 4px solid #6b7280; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <div style="font-size: 13px; color: #374151; line-height: 1.6;">
          📋 <strong>Audit Trail:</strong> This action has been logged in the system audit trail for compliance and review purposes. All inventory adjustments have been recorded in the inventory ledger.
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
