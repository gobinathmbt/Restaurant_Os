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

export default {
  auth: authServices,
  notifications: notificationServices,
};
