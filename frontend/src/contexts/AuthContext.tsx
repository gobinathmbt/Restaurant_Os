import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authServices } from '@/api/services';

// Types
interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  companyId?: string;
  branchIds?: string[];
  isActive: boolean;
  profilePicture?: string;
}

interface Company {
  _id: string;
  companyId: string;
  companyName: string;
  email: string;
  phone?: string;
  subscription: {
    status: string;
    plan: string;
    trialEndDate?: Date;
    nextBillingDate?: Date;
  };
  modules: {
    billing: boolean;
    inventory: boolean;
    crm: boolean;
    integrations: boolean;
    loyalty: boolean;
    analytics: boolean;
    staffManagement: boolean;
    kds: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  company: Company | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (googleToken: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

interface RegisterData {
  companyName: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  fssaiLicense?: string;
  adminName: string;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = sessionStorage.getItem('token');
        
        if (!token) {
          setLoading(false);
          return;
        }

        // Call getMe to verify token and get user data
        const response = await authServices.getMe();
        
        if (response.data.success) {
          setUser(response.data.user);
          setCompany(response.data.company || null);
          setIsAuthenticated(true);
        } else {
          // Invalid token, clear storage
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Clear invalid tokens
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Login with email/password
  const login = async (email: string, password: string) => {
    try {
      const response = await authServices.login(email, password);
      
      if (response.data.success) {
        const { token, user: userData, company: companyData } = response.data;
        
        // Store token in sessionStorage
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(userData));
        
        // Update state
        setUser(userData);
        setCompany(companyData || null);
        setIsAuthenticated(true);
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  // Google OAuth login
  const googleLogin = async (googleToken: string) => {
    try {
      const response = await authServices.googleLogin(googleToken);
      
      if (response.data.success) {
        const { token, user: userData, company: companyData } = response.data;
        
        // Store token in sessionStorage
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(userData));
        
        // Update state
        setUser(userData);
        setCompany(companyData || null);
        setIsAuthenticated(true);
      } else {
        throw new Error(response.data.message || 'Google login failed');
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      throw new Error(error.message || 'Google login failed');
    }
  };

  // Register new company
  const register = async (data: RegisterData) => {
    try {
      const response = await authServices.registerCompany(data);
      
      if (response.data.success) {
        const { token, user: userData, company: companyData } = response.data;
        
        // Store token in sessionStorage
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(userData));
        
        // Update state
        setUser(userData);
        setCompany(companyData || null);
        setIsAuthenticated(true);
      } else {
        throw new Error(response.data.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Registration failed');
    }
  };

  // Logout
  const logout = async () => {
    try {
      // Call logout API to revoke refresh token
      await authServices.logout();
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with logout even if API call fails
    } finally {
      // Clear tokens from sessionStorage
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      
      // Clear state
      setUser(null);
      setCompany(null);
      setIsAuthenticated(false);
    }
  };

  const value: AuthContextType = {
    user,
    company,
    loading,
    isAuthenticated,
    login,
    googleLogin,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;
