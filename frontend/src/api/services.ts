import apiClient from "./axios";

// Auth Services
export const authServices = {
  login: (email: string, password: string) =>
    apiClient.post("/api/auth/login", { email, password }),

  registerCompany: (data: any) =>
    apiClient.post("/api/auth/register-company", data),

  getMe: () => apiClient.get("/api/auth/me"),


};


export default {
  auth: authServices,
};
