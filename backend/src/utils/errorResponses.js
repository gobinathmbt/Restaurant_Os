/**
 * Error Response Utilities
 * Provides standardized error and success response formatting for category-branch consistency operations
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

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
