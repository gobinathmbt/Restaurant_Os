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
  googleLogin: (googleToken: string) =>
    apiClient.post("/api/auth/google", { token: googleToken }),

  // Get current user
  getMe: () => apiClient.get("/api/auth/me"),

  // Logout
  logout: () => apiClient.post("/api/auth/logout"),
};

export default {
  auth: authServices,
};
