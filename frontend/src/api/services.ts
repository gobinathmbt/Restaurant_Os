import apiClient from "./axios";

// Auth Services
export const authServices = {
  // Login with email/password
  login: (email: string, password: string) =>
    apiClient.post("/api/auth/login", { email, password }),

  // Register new company
  registerCompany: (data: any) =>
    apiClient.post("/api/auth/register-company", data),

  // Google OAuth login
  googleLogin: (accessToken: string) =>
    apiClient.post("/api/auth/google", { token: accessToken }),

  // Get current user
  getMe: () => apiClient.get("/api/auth/me"),

  // Logout
  logout: () => apiClient.post("/api/auth/logout"),
};

// Notification Services (Settings only - other operations via Socket.IO)
export const notificationServices = {
  // Get notification settings
  getSettings: () => apiClient.get("/api/notifications/settings"),

  // Update notification settings
  updateSettings: (settings: any) =>
    apiClient.put("/api/notifications/settings", settings),

  // Update specific event preference
  updateEventPreference: (event: string, data: { enabled?: boolean; channels?: any }) =>
    apiClient.patch(`/api/notifications/settings/events/${event}`, data),

  // Send test notification
  sendTestNotification: () => apiClient.post("/api/notifications/test"),
};

// Branch Services
export const branchServices = {
  // Get all branches
  getBranches: (params?: { page?: number; limit?: number; search?: string; isActive?: boolean; type?: string }) =>
    apiClient.get("/api/branches", { params }),

  // Get single branch
  getBranch: (id: string) => apiClient.get(`/api/branches/${id}`),

  // Create branch
  createBranch: (data: any) => apiClient.post("/api/branches", data),

  // Update branch
  updateBranch: (id: string, data: any) => apiClient.put(`/api/branches/${id}`, data),

  // Delete branch
  deleteBranch: (id: string) => apiClient.delete(`/api/branches/${id}`),

  // Toggle branch status
  toggleBranchStatus: (id: string) => apiClient.patch(`/api/branches/${id}/toggle-status`),
};

// Location Services
export const locationServices = {
  // Get all locations
  getLocations: (params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    type?: string; 
    isActive?: boolean; 
    capability?: string;
  }) => apiClient.get("/api/locations", { params }),

  // Get single location
  getLocation: (id: string) => apiClient.get(`/api/locations/${id}`),

  // Create location
  createLocation: (data: any) => apiClient.post("/api/locations", data),

  // Update location (with version for optimistic locking)
  updateLocation: (id: string, data: any) => apiClient.put(`/api/locations/${id}`, data),

  // Archive location (soft delete)
  archiveLocation: (id: string) => apiClient.delete(`/api/locations/${id}`),

  // Get locations by capability
  getLocationsByCapability: (capability: string) => 
    apiClient.get(`/api/locations/by-capability/${capability}`),
};

// Location Inventory Services
export const locationInventoryServices = {
  // Get inventory by location
  getInventoryByLocation: (params: {
    locationId: string;
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    lowStock?: boolean;
  }) => apiClient.get(`/api/inventory/location/${params.locationId}`, { 
    params: { 
      page: params.page,
      limit: params.limit,
      search: params.search,
      category: params.category,
      lowStock: params.lowStock,
    } 
  }),

  // Get inventory by item (across all locations)
  getInventoryByItem: (itemId: string) => 
    apiClient.get(`/api/inventory/item/${itemId}`),

  // Get batches at location
  getBatchesByLocation: (params: {
    locationId: string;
    itemId: string;
  }) => apiClient.get(`/api/inventory/location/${params.locationId}/item/${params.itemId}/batches`),

  // Get expiring batches
  getExpiringBatches: (params: {
    locationId: string;
    daysUntilExpiry: number;
  }) => apiClient.get(`/api/inventory/location/${params.locationId}/expiring`, { 
    params: { days: params.daysUntilExpiry } 
  }),

  // Get expired batches
  getExpiredBatches: (params: {
    locationId: string;
  }) => apiClient.get(`/api/inventory/location/${params.locationId}/expired`),
};

// Inventory Ledger Services (with cursor-based pagination)
export const inventoryLedgerServices = {
  // Get ledger entries for item at location (CURSOR-BASED PAGINATION)
  getLedgerEntries: (params: {
    locationId: string;
    itemId: string;
    dateRange?: { startDate: string; endDate: string };
    movementType?: string;
    cursor?: string; // Cursor-based pagination instead of page number
    limit?: number;
  }) => apiClient.get(`/api/inventory/ledger/location/${params.locationId}/item/${params.itemId}`, { 
    params: { 
      startDate: params.dateRange?.startDate,
      endDate: params.dateRange?.endDate,
      movementType: params.movementType,
      cursor: params.cursor,
      limit: params.limit,
    } 
  }),

  // Get all inventory movements (for reporting) - CURSOR-BASED
  getInventoryMovements: (params: {
    locationId?: string;
    dateRange?: { startDate: string; endDate: string };
    movementType?: string;
    cursor?: string; // Cursor-based pagination
    limit?: number;
  }) => apiClient.get('/api/inventory/ledger/movements', { 
    params: {
      locationId: params.locationId,
      startDate: params.dateRange?.startDate,
      endDate: params.dateRange?.endDate,
      movementType: params.movementType,
      cursor: params.cursor,
      limit: params.limit,
    }
  }),
};

// Report Services
export const reportServices = {
  // Get inventory valuation report
  getInventoryValuation: (params: {
    locationId?: string;
    asOfDate?: string;
  }) => apiClient.get('/api/reports/inventory-valuation', { params }),

  // Get stock movement report
  getStockMovementReport: (params: {
    dateRange: { startDate: string; endDate: string };
    sourceLocation?: string;
    destinationLocation?: string;
  }) => apiClient.get('/api/reports/transfer-summary', { 
    params: {
      startDate: params.dateRange.startDate,
      endDate: params.dateRange.endDate,
      sourceLocation: params.sourceLocation,
      destinationLocation: params.destinationLocation,
    }
  }),

  // Get expiry forecast report
  getExpiryForecast: (params: {
    locationId?: string;
    daysAhead?: number;
  }) => apiClient.get('/api/reports/expiry-forecast', { params }),

  // Background job methods for large reports
  initiateReport: (reportType: string, params: any) =>
    apiClient.post('/api/reports/initiate', { reportType, params }),

  getReportStatus: (jobId: string) =>
    apiClient.get(`/api/reports/status/${jobId}`),

  downloadReport: (jobId: string) =>
    apiClient.get(`/api/reports/download/${jobId}`, { responseType: 'blob' }),
};

// Inventory Period Services
export const inventoryPeriodServices = {
  // Get active inventory period for a location
  getActivePeriod: (locationId: string) =>
    apiClient.get(`/api/inventory/periods/active`, { params: { locationId } }),

  // Get all inventory periods for a location
  getPeriods: (locationId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`/api/inventory/periods`, { params: { locationId, ...params } }),

  // Get single inventory period
  getPeriod: (id: string) =>
    apiClient.get(`/api/inventory/periods/${id}`),

  // Create inventory period
  createPeriod: (data: {
    locationId: string;
    name: string;
    startDate: string;
    endDate: string;
    isLocked?: boolean;
  }) => apiClient.post('/api/inventory/periods', data),

  // Update inventory period
  updatePeriod: (id: string, data: any) =>
    apiClient.put(`/api/inventory/periods/${id}`, data),

  // Lock inventory period
  lockPeriod: (id: string) =>
    apiClient.put(`/api/inventory/periods/${id}/lock`),

  // Unlock inventory period
  unlockPeriod: (id: string) =>
    apiClient.put(`/api/inventory/periods/${id}/unlock`),
};

// User Services
export const userServices = {
  // Get all users
  getUsers: (params?: { page?: number; limit?: number; search?: string; role?: string; isActive?: boolean; branchId?: string }) =>
    apiClient.get("/api/users", { params }),

  // Get single user
  getUser: (id: string) => apiClient.get(`/api/users/${id}`),

  // Create user
  createUser: (data: any) => apiClient.post("/api/users", data),

  // Update user
  updateUser: (id: string, data: any) => apiClient.put(`/api/users/${id}`, data),

  // Delete user
  deleteUser: (id: string) => apiClient.delete(`/api/users/${id}`),

  // Toggle user status
  toggleUserStatus: (id: string) => apiClient.patch(`/api/users/${id}/toggle-status`),
};

// Platform Config Services
export const platformConfigServices = {
  // Get all platform configurations
  getConfigs: (params?: { page?: number; limit?: number; search?: string; category?: string; isActive?: boolean }) =>
    apiClient.get("/api/platform-config", { params }),

  // Get single configuration
  getConfig: (id: string) => apiClient.get(`/api/platform-config/${id}`),

  // Update configuration
  updateConfig: (id: string, data: { configValue?: any; description?: string; isActive?: boolean }) =>
    apiClient.put(`/api/platform-config/${id}`, data),

  // Toggle configuration status
  toggleConfigStatus: (id: string) => apiClient.patch(`/api/platform-config/${id}/toggle`),

  // Get configuration statistics
  getStats: () => apiClient.get("/api/platform-config/stats"),
};

// Inventory Services
export const inventoryServices = {
  // Create inventory item with location configurations
  createInventoryItemWithBranches: (data: { inventoryItemData: any; branchConfigs: any[] }) =>
    apiClient.post("/api/inventory/items", data),

  // Get inventory items with filters
  getInventoryItems: (params?: { page?: number; limit?: number; search?: string; type?: string; category?: string; subcategory?: string; branchId?: string }) =>
    apiClient.get("/api/inventory/items", { params }),

  // Get inventory item by ID (with all branch configurations)
  getInventoryItemById: (id: string) =>
    apiClient.get(`/api/inventory/items/${id}`),

  // Update inventory item (global properties)
  updateInventoryItem: (id: string, data: any) =>
    apiClient.put(`/api/inventory/items/${id}`, data),

  // Delete inventory item
  deleteInventoryItem: (id: string) =>
    apiClient.delete(`/api/inventory/items/${id}`),

  getLowStockItems: (branchId: string) =>
    apiClient.get("/api/inventory/items/low-stock", { params: { branchId } }),

  getExpiringItems: (branchId: string, daysAhead?: number) =>
    apiClient.get("/api/inventory/items/expiring", { params: { branchId, daysAhead } }),

  getInventoryCategories: (branchId: string) =>
    apiClient.get("/api/inventory/items/categories", { params: { branchId } }),

  // GRN (Goods Receipt Notes) - ONLY for supplier procurement
  // For internal warehouse transfers, use Stock Transfer
  getGRNs: (locationId: string, params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    supplier?: string; 
    status?: string; 
    startDate?: string; 
    endDate?: string;
  }) => {
    // If locationId is 'all', use the all endpoint
    if (locationId === 'all') {
      return apiClient.get('/api/inventory/grn/all', { params });
    }
    return apiClient.get(`/api/inventory/grn/location/${locationId}`, { params });
  },

  getGRN: (id: string) =>
    apiClient.get(`/api/inventory/grn/${id}`),

  createGRN: (data: {
    locationId: string;
    supplierId: string;
    purchaseOrder?: string;
    receivedDate: string;
    items: Array<{
      inventoryItem: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      batchNumber?: string;
      expiryDate?: string;
      manufacturingDate?: string;
      notes?: string;
    }>;
    invoiceNumber?: string;
    invoiceDate?: string;
    paymentTerms?: string;
    notes?: string;
  }) => {
    return apiClient.post("/api/inventory/grn", data);
  },

  verifyGRN: (id: string) =>
    apiClient.put(`/api/inventory/grn/${id}/verify`),

  cancelGRN: (id: string) =>
    apiClient.put(`/api/inventory/grn/${id}/cancel`),

  resendGRNInAppNotifications: (branchId: string, grnId: string) =>
    apiClient.post(`/api/inventory/grn/${branchId}/${grnId}/resend-inapp-notifications`),

  resendGRNEmailNotifications: (branchId: string, grnId: string, includeSupplier: boolean = false) =>
    apiClient.post(`/api/inventory/grn/${branchId}/${grnId}/resend-email-notifications`, { includeSupplier }),

  // Get suppliers for a specific branch
  getSuppliersForBranch: (branchId: string) =>
    apiClient.get("/api/suppliers", { params: { branchId, isActive: true } }),

  // Get inventory items for a specific branch
  getInventoryItemsForBranch: (branchId: string) =>
    apiClient.get(`/api/inventory/branches/${branchId}/items`, { params: { isActive: true } }),

  // Get stock levels for specific items in a branch
  getStockLevelsForBranch: (branchId: string, itemIds: string[]) =>
    apiClient.post(`/api/inventory/branches/${branchId}/stock-levels`, { itemIds }),

  // Stock Adjustments - Updated to support locationId and adjustment types
  getPendingStockAdjustmentsCount: () =>
    apiClient.get("/api/inventory/adjustments/pending/count"),

  getStockAdjustments: (params?: { 
    locationId?: string;
    branchId?: string; // Keep for backward compatibility
    page?: number; 
    limit?: number; 
    search?: string; 
    startDate?: string; 
    endDate?: string; 
    type?: string; 
    reason?: string;
  }) => {
    // Use locationId if provided, otherwise fall back to branchId
    const queryParams = { ...params };
    if (params?.locationId) {
      queryParams.branchId = params.locationId;
      delete queryParams.locationId;
    }
    return apiClient.get("/api/inventory/adjustments", { params: queryParams });
  },

  createStockAdjustment: (data: {
    locationId?: string;
    branchId?: string; // Keep for backward compatibility
    adjustmentType?: string; // NEW: adjustment type
    items: Array<{
      inventoryItem: string;
      currentQuantity: number;
      adjustedQuantity: number;
      quantityDelta: number;
      reason: string;
      notes?: string;
    }>;
    notes?: string;
  }) => {
    // Use locationId if provided, otherwise fall back to branchId
    const requestData = { ...data };
    if (data.locationId) {
      requestData.branchId = data.locationId;
      delete requestData.locationId;
    }
    return apiClient.post("/api/inventory/adjustments", requestData);
  },

  getStockAdjustmentDetails: (locationId: string, adjustmentId: string) =>
    apiClient.get(`/api/inventory/adjustments/${locationId}/${adjustmentId}`),

  resendStockAdjustmentInAppNotifications: (locationId: string, adjustmentId: string) =>
    apiClient.post(`/api/inventory/adjustments/${locationId}/${adjustmentId}/resend-inapp-notifications`),

  resendStockAdjustmentEmailNotifications: (locationId: string, adjustmentId: string) =>
    apiClient.post(`/api/inventory/adjustments/${locationId}/${adjustmentId}/resend-email-notifications`),

  approveStockAdjustment: (branchId: string, adjustmentId: string) =>
    apiClient.put(`/api/inventory/adjustments/${adjustmentId}/approve`),

  rejectStockAdjustment: (branchId: string, adjustmentId: string, data: { rejectionReason: string }) =>
    apiClient.put(`/api/inventory/adjustments/${adjustmentId}/reject`, data),



  createStockTransfer: (data: {
    destinationLocation?: string;
    sourceLocation?: string;
    transferType?: 'push' | 'request'; // NEW
    items: Array<{
      inventoryItem: string;
      sentQuantity: number;
      unit: string;
      notes?: string;
    }>;
    notes?: string;
  }) => {
    // Use location parameters if provided, otherwise fall back to branch parameters
    const requestData = { ...data };
    if (data.destinationLocation) {
      requestData.destinationLocation = data.destinationLocation;
      delete requestData.destinationLocation;
    }
    if (data.sourceLocation) {
      requestData.sourceLocation = data.sourceLocation;
      delete requestData.sourceLocation;
    }
    return apiClient.post("/api/inventory/transfers", requestData);
  },

  getStockTransfers: (branchId: string, params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    status?: string;
  }) => {
    const queryParams = { ...params, branchId };
    return apiClient.get("/api/inventory/transfers", { params: queryParams });
  },

  getStockTransferById: (id: string) =>
    apiClient.get(`/api/inventory/transfers/${id}`),

  approveStockTransfer: (id: string) =>
    apiClient.put(`/api/inventory/transfers/${id}/approve`),

  rejectStockTransfer: (id: string, reason: string) =>
    apiClient.put(`/api/inventory/transfers/${id}/reject`, { reason }),

  cancelStockTransfer: (id: string, reason: string) =>
    apiClient.put(`/api/inventory/transfers/${id}/cancel`, { cancellationReason: reason }),

  completeStockTransfer: (id: string, receivedQuantities?: Record<string, number>) =>
    apiClient.put(`/api/inventory/transfers/${id}/complete`, { receivedQuantities }),

  returnStockTransfer: (id: string, reason: string) =>
    apiClient.put(`/api/inventory/transfers/${id}/return`, { returnReason: reason }),

  // NEW: Backorder management
  fulfillBackorder: (transferId: string, backorderId: string) =>
    apiClient.put(`/api/inventory/transfers/${transferId}/backorders/${backorderId}/fulfill`),

  cancelBackorder: (transferId: string, backorderId: string, reason: string) =>
    apiClient.put(`/api/inventory/transfers/${transferId}/backorders/${backorderId}/cancel`, { reason }),

  // Stock Request API endpoints (new request-approval workflow)
  getStockRequests: (branchId: string, params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    status?: string;
    priority?: string;
    dateFrom?: string;
    dateTo?: string;
    executionStatus?: string; // NEW: Filter by execution status
  }) => {
    const queryParams = { ...params, branchId };
    return apiClient.get("/api/v2/stock-requests", { params: queryParams });
  },

  getStockRequestById: (id: string) =>
    apiClient.get(`/api/v2/stock-requests/${id}`),

  createStockRequest: (data: {
    destinationLocation: string;
    sourceLocation: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    items: Array<{
      inventoryItem: string;
      requestedQuantity: number;
      unit: string;
      notes?: string;
    }>;
    notes?: string;
  }) => apiClient.post("/api/v2/stock-requests", data),

  approveStockRequest: (id: string, data: {
    items: Array<{
      inventoryItem: string;
      approvedQuantity: number;
    }>;
    notes?: string;
  }) => apiClient.post(`/api/v2/stock-requests/${id}/approve`, data),

  rejectStockRequest: (id: string, data: { rejectionReason: string }) =>
    apiClient.post(`/api/v2/stock-requests/${id}/reject`, data),

  cancelStockRequest: (id: string, data: { cancellationReason: string }) =>
    apiClient.post(`/api/v2/stock-requests/${id}/cancel`, data),

  // Role-specific stock request endpoints
  getMyRequests: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    priority?: string;
    requestDateStart?: string;
    requestDateEnd?: string;
    sortBy?: string;
    sortOrder?: string;
  }) => apiClient.get("/api/v2/stock-requests/my-requests", { params }),

  getRequestsToMe: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    priority?: string;
    requestDateStart?: string;
    requestDateEnd?: string;
    sortBy?: string;
    sortOrder?: string;
  }) => apiClient.get("/api/v2/stock-requests/requests-to-me", { params }),

  // Backorder endpoints
  getBackorders: (params?: { 
    page?: number; 
    limit?: number; 
    status?: string;
    destinationLocation?: string;
  }) => apiClient.get("/api/v2/backorders", { params }),

  fulfillBackorderV2: (backorderId: string, data: {
    fulfilledQuantity: number;
    notes?: string;
  }) => apiClient.post(`/api/v2/backorders/${backorderId}/fulfill`, data),

  cancelBackorderV2: (backorderId: string, data: { cancellationReason: string }) =>
    apiClient.post(`/api/v2/backorders/${backorderId}/cancel`, data),

  // Completed stock requests and transfers
  getCompletedRequests: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    destinationLocation?: string;
    sourceLocation?: string;
    startDate?: string;
    endDate?: string;
  }) => apiClient.get("/api/v2/stock-requests/completed", { params }),

  getCompletedTransfers: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    destinationLocation?: string;
    sourceLocation?: string;
    startDate?: string;
    endDate?: string;
    hasExceptions?: boolean;
  }) => apiClient.get("/api/v2/stock-transfers/completed", { params }),

  // Ship transfer (mark as in_transit)
  shipTransfer: (transferId: string) =>
    apiClient.post(`/api/inventory/transfers/${transferId}/ship`),

  // V2 Stock Transfer Execution Stage Management
  updateTransferStage: (transferId: string, data: {
    stage: string;
    notes?: string;
  }) => apiClient.patch(`/api/transfers/v2/${transferId}/stage`, data),

  acceptStock: (transferId: string, data: {
    exceptions?: Array<{
      inventoryItem: string;
      exceptionType: 'damaged' | 'missing' | 'excess';
      quantity: number;
      notes?: string;
    }>;
    notes?: string;
  }) => apiClient.post(`/api/transfers/v2/${transferId}/accept`, data),

  getTransferById: (transferId: string) =>
    apiClient.get(`/api/transfers/v2/${transferId}`),
};

// Inventory Item Location Services
export const inventoryItemLocationServices = {
  // Get inventory items for a specific location (merged with global data)
  getInventoryItemsForLocation: (locationId: string, params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    type?: string; 
    category?: string; 
    subcategory?: string; 
    isActive?: boolean 
  }) =>
    apiClient.get(`/api/inventory/locations/${locationId}/items`, { params }),

  // Get a specific inventory item location configuration by item ID
  getInventoryItemLocationById: (locationId: string, itemId: string) =>
    apiClient.get(`/api/inventory/locations/${locationId}/items/${itemId}`),

  // Create location configuration for an inventory item
  createLocationConfig: (itemId: string, locationId: string, config: any) =>
    apiClient.post(`/api/inventory/locations/${locationId}/items/${itemId}/config`, config),

  // Update location configuration for an inventory item
  updateLocationConfig: (itemId: string, locationId: string, config: any) =>
    apiClient.put(`/api/inventory/locations/${locationId}/items/${itemId}/config`, config),

  // Delete location configuration (remove item from location)
  deleteLocationConfig: (itemId: string, locationId: string) =>
    apiClient.delete(`/api/inventory/locations/${locationId}/items/${itemId}/config`),

  // Bulk update location configurations for an inventory item
  bulkUpdateLocationConfigs: (itemId: string, locationConfigs: Array<{ 
    locationId: string; 
    [key: string]: any 
  }>) =>
    apiClient.post(`/api/inventory/items/${itemId}/locations/bulk`, { locationConfigs }),
};

// Recipe Services
export const recipeServices = {
  // Get all recipes with optional branch filter
  getRecipes: (params?: { page?: number; limit?: number; search?: string; finishedGood?: string; branchId?: string }) =>
    apiClient.get("/api/recipes", { params }),

  // Get single recipe (with branch configurations)
  getRecipe: (id: string, params?: { populateBranches?: boolean; branch?: string }) =>
    apiClient.get(`/api/recipes/${id}`, { params }),

  // Create recipe (global data only)
  createRecipe: (data: any) =>
    apiClient.post("/api/recipes", data),

  // Update recipe (global data only)
  updateRecipe: (id: string, data: any) =>
    apiClient.put(`/api/recipes/${id}`, data),

  // Delete recipe (soft delete - sets isActive = false)
  deleteRecipe: (id: string) =>
    apiClient.delete(`/api/recipes/${id}`),

  // Permanently delete recipe (hard delete with all branch configs)
  permanentlyDeleteRecipe: (id: string) =>
    apiClient.delete(`/api/recipes/${id}/permanent`),

  // Toggle recipe active status
  toggleRecipeStatus: (id: string) =>
    apiClient.patch(`/api/recipes/${id}/toggle-status`),

  // Create recipe with branch configurations in one request
  createRecipeWithBranches: (data: { recipeData: any; branchConfigs: any[] }) =>
    apiClient.post("/api/recipes/with-branches", data),
};

// Recipe Branch Services
export const recipeBranchServices = {
  // Create branch configuration for recipe
  createRecipeBranch: (recipeId: string, branchId: string, config: any) =>
    apiClient.post(`/api/recipes/${recipeId}/branches/${branchId}`, config),

  // Get all branch configurations for a recipe
  getRecipeBranches: (recipeId: string, params?: { branchId?: string; isActive?: boolean }) =>
    apiClient.get(`/api/recipes/${recipeId}/branches`, { params }),

  // Get specific branch configuration
  getRecipeBranch: (recipeId: string, branchId: string) =>
    apiClient.get(`/api/recipes/${recipeId}/branches/${branchId}`),

  // Update branch configuration
  updateRecipeBranch: (recipeId: string, branchId: string, config: any) =>
    apiClient.put(`/api/recipes/${recipeId}/branches/${branchId}`, config),

  // Delete branch configuration
  deleteRecipeBranch: (recipeId: string, branchId: string) =>
    apiClient.delete(`/api/recipes/${recipeId}/branches/${branchId}`),

  // Bulk create/update branch configurations
  bulkUpdateRecipeBranches: (recipeId: string, branchConfigs: any[]) =>
    apiClient.post(`/api/recipes/${recipeId}/branches/bulk`, { branchConfigs }),

  // Copy recipe branch configuration to other branches with ingredient mapping
  copyRecipeBranchConfig: (recipeId: string, sourceBranchId: string, targetBranchIds: string[]) =>
    apiClient.post(`/api/recipes/${recipeId}/branches/${sourceBranchId}/copy`, { targetBranchIds }),
};

// Unit Conversion Services
export const unitConversionServices = {
  // Calculate smart conversions for recipe ingredients
  calculateSmartConversions: (data: { ingredients: any[]; locationId: string }) =>
    apiClient.post("/api/recipes/unit-conversion/calculate", data),

  // Get conversion suggestion for specific ingredient
  getConversionSuggestion: (data: { inventoryItemId: string; locationId: string; targetUnit: string }) =>
    apiClient.post("/api/recipes/unit-conversion/suggest", data),
};

// Supplier Services
export const supplierServices = {
  // Get all suppliers
  getSuppliers: (params?: { page?: number; limit?: number; search?: string; category?: string; subcategory?: string; isActive?: string | boolean; branchId?: string }) =>
    apiClient.get("/api/suppliers", { params }),

  // Get single supplier
  getSupplier: (id: string) =>
    apiClient.get(`/api/suppliers/${id}`),

  // Create supplier
  createSupplier: (data: any) =>
    apiClient.post("/api/suppliers", data),

  // Update supplier
  updateSupplier: (id: string, data: any) =>
    apiClient.put(`/api/suppliers/${id}`, data),

  // Delete supplier (soft delete)
  deleteSupplier: (id: string) =>
    apiClient.delete(`/api/suppliers/${id}`),

  // Permanently delete supplier
  permanentDeleteSupplier: (id: string) =>
    apiClient.delete(`/api/suppliers/${id}/permanent`),

  // Toggle supplier status
  toggleSupplierStatus: (id: string) =>
    apiClient.patch(`/api/suppliers/${id}/toggle-status`),
};

// Category Services
export const categoryServices = {
  // Get all categories
  getCategories: (params?: { page?: number; limit?: number; search?: string; branchId?: string; type?: string; isActive?: string; parentId?: string }) =>
    apiClient.get("/api/categories", { params }),

  // Get single category
  getCategory: (id: string) =>
    apiClient.get(`/api/categories/${id}`),

  // Create category
  createCategory: (data: any) =>
    apiClient.post("/api/categories", data),

  // Update category
  updateCategory: (id: string, data: any) =>
    apiClient.put(`/api/categories/${id}`, data),

  // Delete category (soft delete - deactivate)
  deleteCategory: (id: string) =>
    apiClient.delete(`/api/categories/${id}`),

  // Permanently delete category (hard delete)
  permanentlyDeleteCategory: (id: string) =>
    apiClient.delete(`/api/categories/${id}/permanent`),

  // Toggle category status
  toggleCategoryStatus: (id: string) =>
    apiClient.patch(`/api/categories/${id}/toggle-status`),

  // Get category tree
  getCategoryTree: (branchId?: string, branchIds?: string[]) => {
    const params: any = {};
    if (branchId) {
      // Single branch (backward compatibility)
      return apiClient.get(`/api/categories/tree/${branchId}`);
    } else if (branchIds && branchIds.length > 0) {
      // Multiple branches
      params.branchIds = branchIds;
      return apiClient.get("/api/categories/tree", { params });
    } else {
      // All accessible branches
      return apiClient.get("/api/categories/tree");
    }
  },

  // Get subcategories of a parent category
  getSubcategories: (parentId: string) =>
    apiClient.get(`/api/categories`, { params: { parentId, limit: 1000 } }),

  // Reorder categories
  reorderCategories: (updates: Array<{ categoryId: string; displayOrder: number }>) =>
    apiClient.patch("/api/categories/reorder", { updates }),
};


// Menu Item Services
export const menuItemServices = {
  // Create menu item with branch assignments
  createMenuItemWithBranches: (data: { menuItemData: any; branchConfigs: any[] }) =>
    apiClient.post("/api/menu/items/with-branches", data),

  // Create menu item
  createMenuItem: (data: any) =>
    apiClient.post("/api/menu/items", data),

  // Get menu items with filters
  getMenuItems: (params?: { page?: number; limit?: number; search?: string; categoryId?: string; isActive?: boolean }) =>
    apiClient.get("/api/menu/items", { params }),

  // Get menu item by ID
  getMenuItemById: (id: string) =>
    apiClient.get(`/api/menu/items/${id}`),

  // Update menu item
  updateMenuItem: (id: string, data: any) =>
    apiClient.put(`/api/menu/items/${id}`, data),

  // Delete menu item (soft delete - sets isActive to false)
  deleteMenuItem: (id: string) =>
    apiClient.delete(`/api/menu/items/${id}`),

  // Permanently delete menu item (hard delete with all branch configs)
  permanentlyDeleteMenuItem: (id: string) =>
    apiClient.delete(`/api/menu/items/${id}/permanent`),

  // Toggle menu item active status
  toggleMenuItemStatus: (id: string) =>
    apiClient.patch(`/api/menu/items/${id}/toggle-status`),

  // Add image to menu item
  addImage: (id: string, imageUrl: string) =>
    apiClient.post(`/api/menu/items/${id}/images`, { imageUrl }),

  // Remove image from menu item
  removeImage: (id: string, imageUrl: string) =>
    apiClient.delete(`/api/menu/items/${id}/images`, { data: { imageUrl } }),

  // Reorder images
  reorderImages: (id: string, imageOrder: Array<{ url: string; displayOrder: number }>) =>
    apiClient.put(`/api/menu/items/${id}/images/reorder`, { imageOrder }),
};

// Menu Item Branch Services
export const menuItemBranchServices = {
  // Create branch configuration for menu item
  createBranchConfig: (menuItemId: string, branchId: string, data: any) =>
    apiClient.post(`/api/menu/items/${menuItemId}/branches/${branchId}`, data),

  // Get branch configuration for menu item
  getBranchConfig: (menuItemId: string, branchId: string) =>
    apiClient.get(`/api/menu/items/${menuItemId}/branches/${branchId}`),

  // Update branch configuration
  updateBranchConfig: (menuItemId: string, branchId: string, data: any) =>
    apiClient.put(`/api/menu/items/${menuItemId}/branches/${branchId}`, data),

  // Delete branch configuration (remove item from branch)
  deleteBranchConfig: (menuItemId: string, branchId: string) =>
    apiClient.delete(`/api/menu/items/${menuItemId}/branches/${branchId}`),

  // Update menu item branch configurations
  updateMenuItemBranches: (menuItemId: string, branchConfigs: any[]) =>
    apiClient.put(`/api/menu/items/${menuItemId}/branches`, { branchConfigs }),

  // Get menu items for a specific branch (merged with global data)
  getMenuItemsForBranch: (branchId: string, params?: { page?: number; limit?: number; search?: string; categoryId?: string; isActive?: boolean }) =>
    apiClient.get(`/api/menu/branches/${branchId}/items`, { params }),

  // Bulk assign menu item to multiple branches
  bulkAssignToBranches: (menuItemId: string, branchConfigs: Array<{ branchId: string; price: number; [key: string]: any }>) =>
    apiClient.post(`/api/menu/items/${menuItemId}/branches/bulk`, { branchConfigs }),

  // NEW: Modifier management for branch-specific menu items
  updateModifiers: (menuItemBranchId: string, modifiers: any[]) =>
    apiClient.put(`/api/menu/menu-item-branches/${menuItemBranchId}/modifiers`, { modifiers }),

  deleteModifier: (menuItemBranchId: string, modifierIndex: number) =>
    apiClient.delete(`/api/menu/menu-item-branches/${menuItemBranchId}/modifiers/${modifierIndex}`),

  // NEW: Add-on management for branch-specific menu items
  addAddOns: (menuItemBranchId: string, addOnIds: string[]) =>
    apiClient.post(`/api/menu/menu-item-branches/${menuItemBranchId}/add-ons`, { addOnIds }),

  removeAddOn: (menuItemBranchId: string, addOnId: string) =>
    apiClient.delete(`/api/menu/menu-item-branches/${menuItemBranchId}/add-ons/${addOnId}`),

  getAvailableAddOns: (menuItemBranchId: string, params?: { branchId: string; search?: string }) =>
    apiClient.get(`/api/menu/menu-item-branches/${menuItemBranchId}/available-add-ons`, { params }),
};

// Menu Category Services
export const menuCategoryServices = {
  // Create menu category
  createMenuCategory: (data: any) =>
    apiClient.post("/api/menu/categories", data),

  // Get menu categories with filters
  getMenuCategories: (params?: { page?: number; limit?: number; search?: string; isActive?: boolean }) =>
    apiClient.get("/api/menu/categories", { params }),

  // Get menu category by ID
  getMenuCategoryById: (id: string) =>
    apiClient.get(`/api/menu/categories/${id}`),

  // Update menu category
  updateMenuCategory: (id: string, data: any) =>
    apiClient.put(`/api/menu/categories/${id}`, data),

  // Delete menu category
  deleteMenuCategory: (id: string) =>
    apiClient.delete(`/api/menu/categories/${id}`),

  // Validate branch removal from category
  validateBranchRemoval: (categoryId: string, branchId: string) =>
    apiClient.put(`/api/menu/categories/${categoryId}/validate-branch-removal`, { branchId }),
};

// Image Upload Services
export const imageUploadServices = {
  // Upload image to S3
  uploadImage: (formData: FormData) =>
    apiClient.post("/api/menu/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export default {
  auth: authServices,
  notifications: notificationServices,
  branches: branchServices,
  locations: locationServices,
  users: userServices,
  platformConfig: platformConfigServices,
  inventory: inventoryServices,
  inventoryItemLocations: inventoryItemLocationServices,
  locationInventory: locationInventoryServices,
  inventoryLedger: inventoryLedgerServices,
  reports: reportServices,
  inventoryPeriods: inventoryPeriodServices,
  recipes: recipeServices,
  recipeBranches: recipeBranchServices,
  unitConversion: unitConversionServices,
  suppliers: supplierServices,
  categories: categoryServices,
  menuItems: menuItemServices,
  menuItemBranches: menuItemBranchServices,
  menuCategories: menuCategoryServices,
  imageUpload: imageUploadServices,
};
