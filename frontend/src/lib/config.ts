/**
 * Frontend Configuration
 * Centralized configuration management for the application
 */

// API Base URL - defaults to localhost backend
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Google OAuth Client ID
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '140715848718-0scehakngdbco0cdmb8m1p7f3h20em08.apps.googleusercontent.com';

// Application Configuration
export const APP_CONFIG = {
  // Application name
  appName: 'Restaurant Operating System',
  appShortName: 'ROS',
  
  // API Configuration
  apiTimeout: 10000, // 10 seconds
  apiRetries: 3,
  
  // Session Configuration
  sessionTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  
  // Pagination
  defaultPageSize: 20,
  maxPageSize: 100,
  
  // Date/Time Configuration
  dateFormat: 'DD/MM/YYYY',
  timeFormat: 'HH:mm',
  dateTimeFormat: 'DD/MM/YYYY HH:mm',
  
  // Currency Configuration
  currency: 'INR',
  currencySymbol: '₹',
  currencyLocale: 'en-IN',
  
  // File Upload Configuration
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  allowedDocumentTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  
  // Theme Configuration
  defaultTheme: 'light',
  primaryColor: '#22c55e', // Green
  
  // Feature Flags
  features: {
    googleOAuth: true,
    offlineMode: false,
    analytics: true,
  },
};

// Environment Information
export const ENV = {
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  mode: import.meta.env.MODE,
};

// API Endpoints (can be extended as needed)
export const API_ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register-company',
    googleLogin: '/api/auth/google',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    refreshToken: '/api/auth/refresh-token',
  },
  // Add more endpoint groups as modules are implemented
};

export default {
  BASE_URL,
  GOOGLE_CLIENT_ID,
  APP_CONFIG,
  ENV,
  API_ENDPOINTS,
};
