import apiClient from './axios';

export interface PlatformConfig {
  _id: string;
  configKey: string;
  configValue: any;
  description?: string;
  category: 'auth' | 'payment' | 'email' | 'storage' | 'api' | 'system' | 'sms' | 'notification';
  isSecret: boolean;
  isActive: boolean;
  isEditable: boolean;
  lastModifiedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PlatformConfigStats {
  total: number;
  active: number;
  inactive: number;
  byCategory: Record<string, number>;
}

export interface GetConfigsParams {
  category?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface GetConfigsResponse {
  configs: PlatformConfig[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Get all platform configurations
 */
export const getAllConfigs = async (params?: GetConfigsParams): Promise<GetConfigsResponse> => {
  const response = await apiClient.get('/platform-config', { params });
  return response.data.data;
};

/**
 * Get single configuration by ID
 */
export const getConfigById = async (id: string): Promise<PlatformConfig> => {
  const response = await apiClient.get(`/platform-config/${id}`);
  return response.data.data;
};

/**
 * Update platform configuration
 */
export const updateConfig = async (
  id: string,
  data: {
    configValue?: any;
    description?: string;
    isActive?: boolean;
  }
): Promise<PlatformConfig> => {
  const response = await apiClient.put(`/platform-config/${id}`, data);
  return response.data.data;
};

/**
 * Toggle configuration active status
 */
export const toggleConfigStatus = async (id: string): Promise<PlatformConfig> => {
  const response = await apiClient.patch(`/platform-config/${id}/toggle`);
  return response.data.data;
};

/**
 * Get configuration statistics
 */
export const getConfigStats = async (): Promise<PlatformConfigStats> => {
  const response = await apiClient.get('/platform-config/stats');
  return response.data.data;
};
