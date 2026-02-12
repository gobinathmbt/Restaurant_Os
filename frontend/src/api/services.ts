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
  getBranches: (params?: { page?: number; limit?: number; search?: string; isActive?: boolean }) =>
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
  // Create inventory item with branch assignments
  createInventoryItemWithBranches: (data: { inventoryItemData: any; branchConfigs: any[] }) =>
    apiClient.post("/api/inventory/items/with-branches", data),

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

  // GRN (Goods Receipt Notes)
  getGRNs: (branchId: string, params?: { page?: number; limit?: number; search?: string; supplier?: string; status?: string; startDate?: string; endDate?: string }) =>
    apiClient.get("/api/inventory/grn", { params: { branchId, ...params } }),

  getGRN: (id: string) =>
    apiClient.get(`/api/inventory/grn/${id}`),

  createGRN: (branchId: string, data: any) =>
    apiClient.post("/api/inventory/grn", { ...data, branchId }),

  // Stock Adjustments
  getStockAdjustments: (branchId: string, params?: { page?: number; limit?: number; search?: string; startDate?: string; endDate?: string; type?: string; reason?: string }) =>
    apiClient.get("/api/inventory/adjustments", { params: { branchId, ...params } }),

  createStockAdjustment: (branchId: string, data: any) =>
    apiClient.post("/api/inventory/adjustments", { ...data, branchId }),

  // Stock Transfers
  getStockTransfers: (branchId: string, params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    apiClient.get("/api/inventory/transfers", { params: { branchId, ...params } }),

  createStockTransfer: (data: any) =>
    apiClient.post("/api/inventory/transfers", data),

  approveStockTransfer: (id: string) =>
    apiClient.put(`/api/inventory/transfers/${id}/approve`),

  rejectStockTransfer: (id: string, reason: string) =>
    apiClient.put(`/api/inventory/transfers/${id}/reject`, { reason }),
};

// Inventory Item Branch Services
export const inventoryItemBranchServices = {
  // Get inventory items for a specific branch (merged with global data)
  getInventoryItemsForBranch: (branchId: string, params?: { page?: number; limit?: number; search?: string; type?: string; category?: string; subcategory?: string; isActive?: boolean }) =>
    apiClient.get(`/api/inventory/branches/${branchId}/items`, { params }),

  // Create branch configuration
  createBranchConfig: (inventoryItemId: string, branchId: string, config: any) =>
    apiClient.post(`/api/inventory/items/${inventoryItemId}/branches/${branchId}`, config),

  // Get branch configuration
  getBranchConfig: (inventoryItemId: string, branchId: string) =>
    apiClient.get(`/api/inventory/items/${inventoryItemId}/branches/${branchId}`),

  // Update branch configuration
  updateBranchConfig: (inventoryItemId: string, branchId: string, config: any) =>
    apiClient.put(`/api/inventory/items/${inventoryItemId}/branches/${branchId}`, config),

  // Delete branch configuration (remove item from branch)
  deleteBranchConfig: (inventoryItemId: string, branchId: string) =>
    apiClient.delete(`/api/inventory/items/${inventoryItemId}/branches/${branchId}`),

  // Bulk update branch configurations
  updateInventoryItemBranches: (inventoryItemId: string, branchConfigs: any[]) =>
    apiClient.put(`/api/inventory/items/${inventoryItemId}/branches`, { branchConfigs }),

  // Bulk assign inventory item to multiple branches
  bulkAssignToBranches: (inventoryItemId: string, branchConfigs: Array<{ branchId: string; [key: string]: any }>) =>
    apiClient.post(`/api/inventory/items/${inventoryItemId}/branches/bulk`, { branchConfigs }),
};

// Recipe Services
export const recipeServices = {
  // Get all recipes
  getRecipes: (params?: { page?: number; limit?: number; search?: string; finishedGood?: string }) =>
    apiClient.get("/api/recipes", { params }),

  // Get single recipe
  getRecipe: (id: string) =>
    apiClient.get(`/api/recipes/${id}`),

  // Create recipe
  createRecipe: (data: any) =>
    apiClient.post("/api/recipes", data),

  // Update recipe
  updateRecipe: (id: string, data: any) =>
    apiClient.put(`/api/recipes/${id}`, data),

  // Delete recipe
  deleteRecipe: (id: string) =>
    apiClient.delete(`/api/recipes/${id}`),
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

  // Delete menu item
  deleteMenuItem: (id: string) =>
    apiClient.delete(`/api/menu/items/${id}`),

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
    apiClient.put(`/api/menu-item-branches/${menuItemBranchId}/modifiers`, { modifiers }),

  deleteModifier: (menuItemBranchId: string, modifierIndex: number) =>
    apiClient.delete(`/api/menu-item-branches/${menuItemBranchId}/modifiers/${modifierIndex}`),

  // NEW: Add-on management for branch-specific menu items
  addAddOns: (menuItemBranchId: string, addOnIds: string[]) =>
    apiClient.post(`/api/menu-item-branches/${menuItemBranchId}/add-ons`, { addOnIds }),

  removeAddOn: (menuItemBranchId: string, addOnId: string) =>
    apiClient.delete(`/api/menu-item-branches/${menuItemBranchId}/add-ons/${addOnId}`),

  getAvailableAddOns: (menuItemBranchId: string, params?: { branchId: string; search?: string }) =>
    apiClient.get(`/api/menu-item-branches/${menuItemBranchId}/available-add-ons`, { params }),
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
  users: userServices,
  platformConfig: platformConfigServices,
  inventory: inventoryServices,
  recipes: recipeServices,
  suppliers: supplierServices,
  categories: categoryServices,
  menuItems: menuItemServices,
  menuItemBranches: menuItemBranchServices,
  menuCategories: menuCategoryServices,
  imageUpload: imageUploadServices,
};
