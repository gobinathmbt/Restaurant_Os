/**
 * Error Response Utilities
 * Provides standardized error and success response formatting for:
 * - Category-branch consistency operations (Requirements: 6.1-6.6)
 * - Stock request approval system (Requirements: 17.3-17.8, 20.5-20.6)
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Format validation error response (HTTP 409 - Conflict)
 * Used when category-branch consistency validation fails
 * 
 * @param {Object} params - Error parameters
 * @param {string} params.categoryId - Category ID
 * @param {string} params.categoryName - Category name
 * @param {string} params.branchId - Branch ID
 * @param {string} params.branchName - Branch name
 * @param {Object} params.dependencies - Dependency information
 * @param {Object} params.dependencies.items - Items using this category/subcategory
 * @param {number} params.dependencies.items.count - Count of dependent items
 * @param {Array} params.dependencies.items.examples - Array of example items (up to 10)
 * @param {Object} params.dependencies.suppliers - Suppliers using this category/subcategory
 * @param {number} params.dependencies.suppliers.count - Count of dependent suppliers
 * @param {Array} params.dependencies.suppliers.examples - Array of example suppliers (up to 10)
 * @param {boolean} [params.isSubcategory=false] - Whether this is a subcategory
 * @returns {Object} Formatted error response
 */
export const formatValidationError = ({
  categoryId,
  categoryName,
  branchId,
  branchName,
  dependencies,
  isSubcategory = false
}) => {
  const entityType = isSubcategory ? 'Subcategory' : 'Category';
  
  return {
    success: false,
    error: {
      code: 'CATEGORY_BRANCH_MISMATCH',
      message: `Cannot remove Branch '${branchName}' from ${entityType} '${categoryName}'`,
      details: {
        categoryId,
        categoryName,
        branchId,
        branchName,
        isSubcategory,
        dependencies: {
          items: {
            count: dependencies.items?.count || 0,
            examples: (dependencies.items?.examples || []).slice(0, 10)
          },
          suppliers: {
            count: dependencies.suppliers?.count || 0,
            examples: (dependencies.suppliers?.examples || []).slice(0, 10)
          }
        }
      }
    }
  };
};

/**
 * Format success response with auto-assignment details (HTTP 200 - OK)
 * Used when items/suppliers are created/updated with automatic category assignments
 * 
 * @param {Object} params - Success parameters
 * @param {Object} params.data - The created/updated entity (item or supplier)
 * @param {Array} params.autoAssignments - Array of auto-assignment information
 * @param {Array} params.autoAssignments.categories - Categories that were auto-assigned
 * @param {Array} params.autoAssignments.subcategories - Subcategories that were auto-assigned
 * @param {string} params.entityType - Type of entity ('item' or 'supplier')
 * @param {string} params.operation - Operation performed ('created' or 'updated')
 * @returns {Object} Formatted success response
 */
export const formatSuccessWithAssignments = ({
  data,
  autoAssignments,
  entityType = 'item',
  operation = 'created'
}) => {
  const categories = autoAssignments?.categories || [];
  const subcategories = autoAssignments?.subcategories || [];
  
  // Calculate total branches affected
  const totalBranches = new Set([
    ...categories.flatMap(cat => cat.branchIds || []),
    ...subcategories.flatMap(sub => sub.branchIds || [])
  ]).size;
  
  // Build message
  let message = `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} ${operation} successfully.`;
  
  if (categories.length > 0 || subcategories.length > 0) {
    const parts = [];
    if (categories.length > 0) {
      parts.push(`${categories.length} ${categories.length === 1 ? 'category' : 'categories'}`);
    }
    if (subcategories.length > 0) {
      parts.push(`${subcategories.length} ${subcategories.length === 1 ? 'subcategory' : 'subcategories'}`);
    }
    message += ` Automatically assigned ${parts.join(' and ')} to ${totalBranches} ${totalBranches === 1 ? 'branch' : 'branches'}.`;
  }
  
  return {
    success: true,
    data: {
      [entityType]: data,
      autoAssignments: {
        categories: categories.map(cat => ({
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          branchIds: cat.branchIds || [],
          branchNames: cat.branchNames || []
        })),
        subcategories: subcategories.map(sub => ({
          subcategoryId: sub.subcategoryId,
          subcategoryName: sub.subcategoryName,
          branchIds: sub.branchIds || [],
          branchNames: sub.branchNames || []
        }))
      }
    },
    message
  };
};

/**
 * Format transaction error response (HTTP 500 - Internal Server Error)
 * Used when database transactions fail during category-branch operations
 * 
 * @param {Object} params - Error parameters
 * @param {string} params.operation - The operation that was being performed
 * @param {string} params.failedAt - The specific step where the failure occurred
 * @param {string} params.reason - The reason for the failure
 * @param {Error} [params.error] - Optional error object for additional details
 * @returns {Object} Formatted error response
 */
export const formatTransactionError = ({
  operation,
  failedAt,
  reason,
  error
}) => {
  return {
    success: false,
    error: {
      code: 'TRANSACTION_FAILED',
      message: `Failed to ${operation}`,
      details: {
        operation,
        failedAt,
        reason,
        ...(error && { errorMessage: error.message })
      }
    }
  };
};

// ============================================================================
// Stock Request Approval System Error Responses
// Requirements: 17.3-17.8, 20.5-20.6
// ============================================================================

/**
 * Format validation error response (HTTP 400 - Bad Request)
 * Used when input validation fails
 * 
 * @param {Object} params - Error parameters
 * @param {string} params.message - Error message
 * @param {Array<Object>} [params.errors] - Array of validation errors
 * @param {string} [params.requestId] - Request ID for tracing
 * @returns {Object} Formatted error response
 */
export const formatValidationErrorV2 = ({ message, errors = [], requestId = null }) => {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message,
      errors,
      requestId: requestId || uuidv4(),
      timestamp: new Date().toISOString()
    }
  };
};

/**
 * Format forbidden error response (HTTP 403 - Forbidden)
 * Used when user lacks permission to perform an action
 * 
 * @param {Object} params - Error parameters
 * @param {string} params.message - Error message
 * @param {string} [params.resource] - Resource being accessed
 * @param {string} [params.action] - Action being attempted
 * @param {string} [params.requestId] - Request ID for tracing
 * @returns {Object} Formatted error response
 */
export const formatForbiddenError = ({ message, resource = null, action = null, requestId = null }) => {
  return {
    success: false,
    error: {
      code: 'FORBIDDEN',
      message,
      ...(resource && { resource }),
      ...(action && { action }),
      requestId: requestId || uuidv4(),
      timestamp: new Date().toISOString()
    }
  };
};

/**
 * Format not found error response (HTTP 404 - Not Found)
 * Used when a requested resource does not exist
 * 
 * @param {Object} params - Error parameters
 * @param {string} params.message - Error message
 * @param {string} [params.resource] - Resource type
 * @param {string} [params.resourceId] - Resource ID
 * @param {string} [params.requestId] - Request ID for tracing
 * @returns {Object} Formatted error response
 */
export const formatNotFoundError = ({ message, resource = null, resourceId = null, requestId = null }) => {
  return {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message,
      ...(resource && { resource }),
      ...(resourceId && { resourceId }),
      requestId: requestId || uuidv4(),
      timestamp: new Date().toISOString()
    }
  };
};

/**
 * Format conflict error response (HTTP 409 - Conflict)
 * Used when optimistic locking fails or resource state conflicts
 * 
 * @param {Object} params - Error parameters
 * @param {string} params.message - Error message
 * @param {number} [params.currentVersion] - Current version of the resource
 * @param {number} [params.providedVersion] - Version provided in the request
 * @param {string} [params.requestId] - Request ID for tracing
 * @returns {Object} Formatted error response
 */
export const formatConflictError = ({ message, currentVersion = null, providedVersion = null, requestId = null }) => {
  return {
    success: false,
    error: {
      code: 'CONFLICT',
      message,
      ...(currentVersion !== null && { currentVersion }),
      ...(providedVersion !== null && { providedVersion }),
      requestId: requestId || uuidv4(),
      timestamp: new Date().toISOString()
    }
  };
};

/**
 * Format insufficient inventory error response (HTTP 422 - Unprocessable Entity)
 * Used when there is not enough inventory to fulfill a request
 * 
 * @param {Object} params - Error parameters
 * @param {string} params.message - Error message
 * @param {string} params.inventoryItem - Inventory item ID or name
 * @param {number} params.requested - Requested quantity
 * @param {number} params.available - Available quantity
 * @param {string} [params.location] - Location ID
 * @param {string} [params.requestId] - Request ID for tracing
 * @returns {Object} Formatted error response
 */
export const formatInsufficientInventoryError = ({ 
  message, 
  inventoryItem, 
  requested, 
  available, 
  location = null,
  requestId = null 
}) => {
  return {
    success: false,
    error: {
      code: 'INSUFFICIENT_INVENTORY',
      message,
      details: {
        inventoryItem,
        requested,
        available,
        shortfall: requested - available,
        ...(location && { location })
      },
      requestId: requestId || uuidv4(),
      timestamp: new Date().toISOString()
    }
  };
};

/**
 * Format internal server error response (HTTP 500 - Internal Server Error)
 * Used when an unexpected error occurs
 * 
 * @param {Object} params - Error parameters
 * @param {string} params.message - Error message
 * @param {Error} [params.error] - Original error object
 * @param {string} [params.requestId] - Request ID for tracing
 * @returns {Object} Formatted error response
 */
export const formatInternalServerError = ({ message, error = null, requestId = null }) => {
  return {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message,
      ...(error && process.env.NODE_ENV !== 'production' && { 
        stack: error.stack,
        details: error.message 
      }),
      requestId: requestId || uuidv4(),
      timestamp: new Date().toISOString()
    }
  };
};

/**
 * Create a custom error class for stock request system errors
 */
class StockRequestError extends Error {
  constructor(message, statusCode, code, details = {}) {
    super(message);
    this.name = 'StockRequestError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.requestId = uuidv4();
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...this.details,
        requestId: this.requestId,
        timestamp: this.timestamp
      }
    };
  }
}

/**
 * Validation Error (HTTP 400)
 */
class ValidationError extends StockRequestError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR', { errors });
  }
}

/**
 * Forbidden Error (HTTP 403)
 */
class ForbiddenError extends StockRequestError {
  constructor(message, resource = null, action = null) {
    super(message, 403, 'FORBIDDEN', { 
      ...(resource && { resource }),
      ...(action && { action })
    });
  }
}

/**
 * Not Found Error (HTTP 404)
 */
class NotFoundError extends StockRequestError {
  constructor(message, resource = null, resourceId = null) {
    super(message, 404, 'NOT_FOUND', { 
      ...(resource && { resource }),
      ...(resourceId && { resourceId })
    });
  }
}

/**
 * Conflict Error (HTTP 409)
 */
class ConflictError extends StockRequestError {
  constructor(message, currentVersion = null, providedVersion = null) {
    super(message, 409, 'CONFLICT', { 
      ...(currentVersion !== null && { currentVersion }),
      ...(providedVersion !== null && { providedVersion })
    });
  }
}

/**
 * Insufficient Inventory Error (HTTP 422)
 */
class InsufficientInventoryError extends StockRequestError {
  constructor(message, inventoryItem, requested, available, location = null) {
    super(message, 422, 'INSUFFICIENT_INVENTORY', {
      details: {
        inventoryItem,
        requested,
        available,
        shortfall: requested - available,
        ...(location && { location })
      }
    });
  }
}

/**
 * Internal Server Error (HTTP 500)
 */
class InternalServerError extends StockRequestError {
  constructor(message, error = null) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', {
      ...(error && process.env.NODE_ENV !== 'production' && { 
        stack: error.stack,
        details: error.message 
      })
    });
  }
}

// Export error classes
export {
  StockRequestError,
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InsufficientInventoryError,
  InternalServerError
};
