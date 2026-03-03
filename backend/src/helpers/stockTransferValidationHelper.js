import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

/**
 * Stock Transfer Validation Helper
 * 
 * Provides validation functions for stock transfer exception handling.
 * Includes XSS protection, data validation, and severity calculation.
 */

/**
 * Exception type enum
 */
export const EXCEPTION_TYPES = {
  DAMAGE: 'damage',
  MISSING: 'missing',
  EXCESS: 'excess'
};

/**
 * Resolution action enum
 */
export const RESOLUTION_ACTIONS = {
  CONFIRM_DAMAGE: 'confirm_damage',
  RETURN_TO_SOURCE: 'return_to_source',
  ACCEPT_EXCESS: 'accept_excess',
  REJECT_EXCESS: 'reject_excess'
};

/**
 * Severity levels
 */
export const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

/**
 * Severity thresholds (in currency units)
 */
const SEVERITY_THRESHOLDS = {
  HIGH: 1000,    // > $1000
  MEDIUM: 100    // $100 - $1000
  // LOW: <= $100
};

/**
 * Validate exception data
 * 
 * @param {Object} exception - Exception object to validate
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export const validateExceptionData = (exception) => {
  const errors = [];

  // Validate exception object exists
  if (!exception || typeof exception !== 'object') {
    return {
      valid: false,
      errors: ['Exception data is required']
    };
  }

  // Validate type
  if (!exception.type) {
    errors.push('Exception type is required');
  } else if (!Object.values(EXCEPTION_TYPES).includes(exception.type)) {
    errors.push(`Invalid exception type. Must be one of: ${Object.values(EXCEPTION_TYPES).join(', ')}`);
  }

  // Validate inventoryItem
  if (!exception.inventoryItem) {
    errors.push('Inventory item is required');
  } else if (!mongoose.Types.ObjectId.isValid(exception.inventoryItem)) {
    errors.push('Invalid inventory item ID');
  }

  // Validate quantity
  if (exception.quantity === undefined || exception.quantity === null) {
    errors.push('Quantity is required');
  } else if (typeof exception.quantity !== 'number') {
    errors.push('Quantity must be a number');
  } else if (exception.quantity <= 0) {
    errors.push('Quantity must be greater than zero');
  } else if (exception.quantity < 0.000001) {
    errors.push('Quantity must be at least 0.000001');
  }

  // Validate unit
  if (!exception.unit) {
    errors.push('Unit is required');
  } else if (typeof exception.unit !== 'string') {
    errors.push('Unit must be a string');
  } else if (exception.unit.trim().length === 0) {
    errors.push('Unit cannot be empty');
  }

  // Validate severity (optional, but if provided must be valid)
  if (exception.severity && !Object.values(SEVERITY_LEVELS).includes(exception.severity)) {
    errors.push(`Invalid severity level. Must be one of: ${Object.values(SEVERITY_LEVELS).join(', ')}`);
  }

  // Validate description (optional, but if provided must be string)
  if (exception.description !== undefined && exception.description !== null) {
    if (typeof exception.description !== 'string') {
      errors.push('Description must be a string');
    } else if (exception.description.length > 1000) {
      errors.push('Description cannot exceed 1000 characters');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate resolution action for exception type
 * 
 * @param {string} exceptionType - Type of exception (damage, missing, excess)
 * @param {string} resolutionAction - Proposed resolution action
 * @returns {Object} { valid: boolean, error: string|null }
 */
export const validateResolutionAction = (exceptionType, resolutionAction) => {
  // Validate inputs
  if (!exceptionType) {
    return {
      valid: false,
      error: 'Exception type is required'
    };
  }

  if (!resolutionAction) {
    return {
      valid: false,
      error: 'Resolution action is required'
    };
  }

  // Validate exception type
  if (!Object.values(EXCEPTION_TYPES).includes(exceptionType)) {
    return {
      valid: false,
      error: `Invalid exception type: ${exceptionType}`
    };
  }

  // Validate resolution action
  if (!Object.values(RESOLUTION_ACTIONS).includes(resolutionAction)) {
    return {
      valid: false,
      error: `Invalid resolution action: ${resolutionAction}`
    };
  }

  // Check if resolution action is valid for exception type
  const validActions = {
    [EXCEPTION_TYPES.DAMAGE]: [RESOLUTION_ACTIONS.CONFIRM_DAMAGE],
    [EXCEPTION_TYPES.MISSING]: [RESOLUTION_ACTIONS.RETURN_TO_SOURCE],
    [EXCEPTION_TYPES.EXCESS]: [
      RESOLUTION_ACTIONS.ACCEPT_EXCESS,
      RESOLUTION_ACTIONS.REJECT_EXCESS
    ]
  };

  const allowedActions = validActions[exceptionType];

  if (!allowedActions.includes(resolutionAction)) {
    return {
      valid: false,
      error: `Invalid resolution action '${resolutionAction}' for exception type '${exceptionType}'. ` +
             `Valid actions: ${allowedActions.join(', ')}`
    };
  }

  return {
    valid: true,
    error: null
  };
};

/**
 * Sanitize HTML to prevent XSS attacks
 * Removes HTML tags and dangerous characters from user input
 * 
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeHtml = (input) => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove data: protocol (can be used for XSS)
  sanitized = sanitized.replace(/data:/gi, '');

  // Encode special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
};

/**
 * Calculate severity based on exception value
 * 
 * @param {number} quantity - Exception quantity
 * @param {Object} inventoryItem - Inventory item object with cost information
 * @returns {string} Severity level (low, medium, high)
 */
export const calculateSeverity = (quantity, inventoryItem) => {
  // Default to medium if we can't calculate
  if (!quantity || !inventoryItem) {
    logger.warn('calculateSeverity: Missing required parameters', {
      hasQuantity: !!quantity,
      hasInventoryItem: !!inventoryItem
    });
    return SEVERITY_LEVELS.MEDIUM;
  }

  // Validate quantity
  if (typeof quantity !== 'number' || quantity <= 0) {
    logger.warn('calculateSeverity: Invalid quantity', { quantity });
    return SEVERITY_LEVELS.MEDIUM;
  }

  // Get unit cost from inventory item
  // Try multiple possible cost fields
  let unitCost = 0;

  if (inventoryItem.averageUnitCost !== undefined && inventoryItem.averageUnitCost !== null) {
    unitCost = inventoryItem.averageUnitCost;
  } else if (inventoryItem.unitCost !== undefined && inventoryItem.unitCost !== null) {
    unitCost = inventoryItem.unitCost;
  } else if (inventoryItem.cost !== undefined && inventoryItem.cost !== null) {
    unitCost = inventoryItem.cost;
  }

  // If no cost available, default to medium
  if (unitCost <= 0) {
    logger.debug('calculateSeverity: No cost information available, defaulting to medium', {
      inventoryItemId: inventoryItem._id
    });
    return SEVERITY_LEVELS.MEDIUM;
  }

  // Calculate total value
  const totalValue = quantity * unitCost;

  // Determine severity based on thresholds
  let severity;
  if (totalValue > SEVERITY_THRESHOLDS.HIGH) {
    severity = SEVERITY_LEVELS.HIGH;
  } else if (totalValue >= SEVERITY_THRESHOLDS.MEDIUM) {
    severity = SEVERITY_LEVELS.MEDIUM;
  } else {
    severity = SEVERITY_LEVELS.LOW;
  }

  logger.debug('calculateSeverity: Calculated severity', {
    quantity,
    unitCost,
    totalValue,
    severity
  });

  return severity;
};

/**
 * Validate financial integrity of exceptions
 * Ensures that sum(damage + missing) <= sentQuantity for each item
 * 
 * @param {Array} exceptions - Array of exception objects
 * @param {Array} transferItems - Array of transfer item objects
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export const validateFinancialIntegrity = (exceptions, transferItems) => {
  const errors = [];

  if (!exceptions || !Array.isArray(exceptions)) {
    return { valid: true, errors: [] }; // No exceptions to validate
  }

  if (!transferItems || !Array.isArray(transferItems)) {
    return {
      valid: false,
      errors: ['Transfer items are required for financial integrity validation']
    };
  }

  // Group exceptions by inventory item
  const exceptionsByItem = {};

  for (const exception of exceptions) {
    const itemId = exception.inventoryItem.toString();
    
    if (!exceptionsByItem[itemId]) {
      exceptionsByItem[itemId] = {
        damage: 0,
        missing: 0,
        excess: 0
      };
    }

    // Sum quantities by type
    if (exception.type === EXCEPTION_TYPES.DAMAGE) {
      exceptionsByItem[itemId].damage += exception.quantity;
    } else if (exception.type === EXCEPTION_TYPES.MISSING) {
      exceptionsByItem[itemId].missing += exception.quantity;
    } else if (exception.type === EXCEPTION_TYPES.EXCESS) {
      exceptionsByItem[itemId].excess += exception.quantity;
    }
  }

  // Validate against sent quantities
  for (const [itemId, totals] of Object.entries(exceptionsByItem)) {
    // Find corresponding transfer item
    const transferItem = transferItems.find(
      item => item.inventoryItem.toString() === itemId
    );

    if (!transferItem) {
      errors.push(`Exception reported for item ${itemId} not found in transfer`);
      continue;
    }

    const sentQuantity = transferItem.sentQuantity || 0;

    // Check: damage + missing <= sentQuantity
    const totalReductions = totals.damage + totals.missing;
    
    if (totalReductions > sentQuantity) {
      errors.push(
        `Financial integrity violation for item ${itemId}: ` +
        `damage (${totals.damage}) + missing (${totals.missing}) = ${totalReductions} ` +
        `exceeds sent quantity (${sentQuantity})`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Sanitize exception data before saving
 * Applies HTML sanitization to text fields
 * 
 * @param {Object} exception - Exception object to sanitize
 * @returns {Object} Sanitized exception object
 */
export const sanitizeExceptionData = (exception) => {
  if (!exception || typeof exception !== 'object') {
    return exception;
  }

  const sanitized = { ...exception };

  // Sanitize description
  if (sanitized.description) {
    sanitized.description = sanitizeHtml(sanitized.description);
  }

  // Sanitize resolution notes
  if (sanitized.resolutionNotes) {
    sanitized.resolutionNotes = sanitizeHtml(sanitized.resolutionNotes);
  }

  return sanitized;
};

/**
 * Get validation error message for display
 * 
 * @param {Array<string>} errors - Array of error messages
 * @returns {string} Formatted error message
 */
export const formatValidationErrors = (errors) => {
  if (!errors || errors.length === 0) {
    return '';
  }

  if (errors.length === 1) {
    return errors[0];
  }

  return `Multiple validation errors:\n${errors.map((err, idx) => `${idx + 1}. ${err}`).join('\n')}`;
};
