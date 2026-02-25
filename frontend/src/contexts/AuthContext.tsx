import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authServices } from '@/api/services';
import { socketService } from '@/services/socket';

// Types
interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  userType?: 'company' | 'platform';
  companyId?: string;
  companyName?: string;
  branchIds?: string[]; // Legacy field - will be migrated to locationIds
  warehouseIds?: string[]; // Warehouse access for users
  locationIds?: string[]; // New field for location-based access control
  platformAdminPrimary?: boolean;
  permissions?: string[];
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
        const userStr = sessionStorage.getItem('user');
        
        if (!token) {
          setLoading(false);
          setIsAuthenticated(false);
          return;
        }

        // If we have user data in sessionStorage, set it immediately
        if (userStr) {
          try {
            const userData = JSON.parse(userStr);
            setUser(userData);
            setIsAuthenticated(true);
          } catch (e) {
            console.error('Failed to parse user data:', e);
          }
        }

        // Call getMe to verify token and get fresh user data
        const response = await authServices.getMe();
        
        if (response.data.success) {
          const userData = response.data.data.user;
          setUser(userData);
          setCompany(response.data.data.company || null);
          setIsAuthenticated(true);
          
          // Update sessionStorage with fresh data
          sessionStorage.setItem('user', JSON.stringify(userData));
          
          // Connect socket based on user type
          if (userData.userType === 'platform') {
            socketService.connectPlatformAdmin(token);
          } else if (userData.userType === 'company') {
            socketService.connectCompany(token);
          }
        } else {
          // Invalid token, clear storage
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          setUser(null);
          setCompany(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Clear invalid tokens
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        setUser(null);
        setCompany(null);
        setIsAuthenticated(false);
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
        const { token, user: userData } = response.data.data;
        
        // Store token in sessionStorage
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(userData));
        
        // Update state immediately
        setUser(userData);
        setIsAuthenticated(true);
        
        // Connect socket based on user type
        if (userData.userType === 'platform') {
          socketService.connectPlatformAdmin(token);
        } else if (userData.userType === 'company') {
          socketService.connectCompany(token);
        }
        
        // Fetch company data if user has companyId (don't await, let it load in background)
        if (userData.userType === 'company' && userData.companyId) {
          authServices.getMe()
            .then(meResponse => {
              if (meResponse.data.success && meResponse.data.data.company) {
                setCompany(meResponse.data.data.company);
              }
            })
            .catch(err => {
              console.error('Failed to fetch company data:', err);
            });
        }
      } else {
        const error = new Error(response.data.message || 'Login failed');
        (error as any).response = { data: response.data };
        throw error;
      }
    } catch (error: any) {
      console.error('Login error in AuthContext:', error);
      // Re-throw the error with proper structure
      const formattedError = {
        message: error.message || 'Login failed',
        response: error.response,
        data: error.data,
        status: error.status
      };
      throw formattedError;
    }
  };

  // Google OAuth login
  const googleLogin = async (googleToken: string) => {
    try {
      const response = await authServices.googleLogin(googleToken);
      
      if (response.data.success) {
        const { token, user: userData } = response.data.data;
        
        // Store token in sessionStorage
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(userData));
        
        // Update state immediately
        setUser(userData);
        setIsAuthenticated(true);
        
        // Fetch company data if user has companyId (don't await)
        if (userData.userType === 'company' && userData.companyId) {
          authServices.getMe()
            .then(meResponse => {
              if (meResponse.data.success && meResponse.data.data.company) {
                setCompany(meResponse.data.data.company);
              }
            })
            .catch(err => {
              console.error('Failed to fetch company data:', err);
            });
        }
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
        const { token, user: userData, company: companyData } = response.data.data;
        
        // Store token in sessionStorage
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(userData));
        
        // Update state immediately
        setUser(userData);
        setCompany(companyData || null);
        setIsAuthenticated(true);
      } else {
        const error = new Error(response.data.message || 'Registration failed');
        (error as any).response = { data: response.data };
        throw error;
      }
    } catch (error: any) {
      console.error('Registration error in AuthContext:', error);
      // Re-throw the error with proper structure
      const formattedError = {
        message: error.message || 'Registration failed',
        response: error.response,
        data: error.data,
        status: error.status
      };
      throw formattedError;
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
      // Disconnect sockets
      socketService.disconnectAll();
      
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
