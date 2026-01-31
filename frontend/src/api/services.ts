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

export default {
  auth: authServices,
  notifications: notificationServices,
  branches: branchServices,
  users: userServices,
  platformConfig: platformConfigServices,
};
