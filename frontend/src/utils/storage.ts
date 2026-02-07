/**
 * Storage Utility Functions
 * Centralized storage management for the entire application
 * Uses sessionStorage to maintain state per browser tab independently
 */

export interface StorageOptions {
  expires?: number; // Expiration time in milliseconds (optional)
}

/**
 * Set a value in sessionStorage with optional expiration
 * @param key - Storage key
 * @param value - Value to store (will be JSON stringified if object)
 * @param options - Storage options
 */
export const setStorage = (
  key: string,
  value: string | number | boolean | object,
  options: StorageOptions = {}
): void => {
  try {
    const data = {
      value: value,
      timestamp: Date.now(),
      expires: options.expires || null,
    };
    
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error setting storage:', error);
  }
};

/**
 * Get a value from sessionStorage
 * @param key - Storage key
 * @returns Storage value or null if not found or expired
 */
export const getStorage = <T = any>(key: string): T | null => {
  try {
    const item = sessionStorage.getItem(key);
    
    if (!item) {
      return null;
    }

    const data = JSON.parse(item);
    
    // Check if expired
    if (data.expires && Date.now() - data.timestamp > data.expires) {
      sessionStorage.removeItem(key);
      return null;
    }
    
    return data.value as T;
  } catch (error) {
    console.error('Error getting storage:', error);
    return null;
  }
};

/**
 * Delete a value from sessionStorage
 * @param key - Storage key
 */
export const deleteStorage = (key: string): void => {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    console.error('Error deleting storage:', error);
  }
};

/**
 * Check if a key exists in sessionStorage
 * @param key - Storage key
 * @returns True if key exists and not expired, false otherwise
 */
export const hasStorage = (key: string): boolean => {
  return getStorage(key) !== null;
};

/**
 * Get all storage keys
 * @returns Array of all storage keys
 */
export const getAllStorageKeys = (): string[] => {
  try {
    return Object.keys(sessionStorage);
  } catch (error) {
    console.error('Error getting all storage keys:', error);
    return [];
  }
};

/**
 * Clear all sessionStorage
 */
export const clearAllStorage = (): void => {
  try {
    sessionStorage.clear();
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
};

/**
 * Clear storage items by prefix
 * @param prefix - Key prefix to match
 */
export const clearStorageByPrefix = (prefix: string): void => {
  try {
    const keys = getAllStorageKeys();
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing storage by prefix:', error);
  }
};

// ============================================
// Predefined Storage Keys for the Application
// ============================================

export const STORAGE_KEYS = {
  // Inventory - Global
  INVENTORY_ACTIVE_TAB: 'inventory_active_tab',
  INVENTORY_SELECTED_BRANCH: 'inventory_selected_branch',
  
  // Menu - Global
  MENU_ACTIVE_TAB: 'menu_active_tab',
  MENU_SELECTED_BRANCH: 'menu_selected_branch',
  
  // Inventory Items Tab
  INVENTORY_ITEMS_SEARCH: 'inventory_items_search',
  INVENTORY_ITEMS_TYPE_FILTER: 'inventory_items_type_filter',
  INVENTORY_ITEMS_CATEGORY_FILTER: 'inventory_items_category_filter',
  INVENTORY_ITEMS_LOW_STOCK_FILTER: 'inventory_items_low_stock_filter',
  INVENTORY_ITEMS_ROWS_PER_PAGE: 'inventory_items_rows_per_page',
  INVENTORY_ITEMS_PAGE: 'inventory_items_page',
  
  // Categories Tab
  CATEGORIES_SEARCH: 'categories_search',
  CATEGORIES_TYPE_FILTER: 'categories_type_filter',
  CATEGORIES_STATUS_FILTER: 'categories_status_filter',
  CATEGORIES_ROWS_PER_PAGE: 'categories_rows_per_page',
  CATEGORIES_PAGE: 'categories_page',
  CATEGORIES_PAGINATION_ENABLED: 'categories_pagination_enabled',
  
  // GRN Tab
  GRN_SEARCH: 'grn_search',
  GRN_STATUS_FILTER: 'grn_status_filter',
  GRN_SUPPLIER_FILTER: 'grn_supplier_filter',
  GRN_ROWS_PER_PAGE: 'grn_rows_per_page',
  GRN_PAGE: 'grn_page',
  
  // Stock Adjustments Tab
  ADJUSTMENTS_SEARCH: 'adjustments_search',
  ADJUSTMENTS_TYPE_FILTER: 'adjustments_type_filter',
  ADJUSTMENTS_REASON_FILTER: 'adjustments_reason_filter',
  ADJUSTMENTS_ROWS_PER_PAGE: 'adjustments_rows_per_page',
  ADJUSTMENTS_PAGE: 'adjustments_page',
  
  // Stock Transfers Tab
  TRANSFERS_SEARCH: 'transfers_search',
  TRANSFERS_STATUS_FILTER: 'transfers_status_filter',
  TRANSFERS_FROM_BRANCH_FILTER: 'transfers_from_branch_filter',
  TRANSFERS_TO_BRANCH_FILTER: 'transfers_to_branch_filter',
  TRANSFERS_ROWS_PER_PAGE: 'transfers_rows_per_page',
  TRANSFERS_PAGE: 'transfers_page',
  
  // Suppliers Tab
  SUPPLIERS_SEARCH: 'suppliers_search',
  SUPPLIERS_CATEGORY_FILTER: 'suppliers_category_filter',
  SUPPLIERS_BRANCH_FILTER: 'suppliers_branch_filter',
  SUPPLIERS_ROWS_PER_PAGE: 'suppliers_rows_per_page',
  SUPPLIERS_PAGE: 'suppliers_page',
  SUPPLIERS_PAGINATION_ENABLED: 'suppliers_pagination_enabled',
  
  // User Preferences (Use localStorage for these - shared across tabs)
  THEME: 'pref_theme',
  LANGUAGE: 'pref_language',
  SIDEBAR_COLLAPSED: 'pref_sidebar_collapsed',
  TABLE_DENSITY: 'pref_table_density',
  
  // Add more as needed
} as const;

// Keep COOKIE_KEYS for backward compatibility
export const COOKIE_KEYS = STORAGE_KEYS;

// ============================================
// Predefined Storage Durations (in milliseconds)
// ============================================

export const STORAGE_DURATION = {
  SHORT: 12 * 60 * 60 * 1000, // 12 hours
  MEDIUM: 7 * 24 * 60 * 60 * 1000, // 1 week
  LONG: 30 * 24 * 60 * 60 * 1000, // 1 month
  VERY_LONG: 365 * 24 * 60 * 60 * 1000, // 1 year
} as const;

// ============================================
// Helper Functions for Common Use Cases
// ============================================

/**
 * Save session data (per browser tab)
 */
export const saveSessionData = (key: string, value: string | number | boolean | object): void => {
  setStorage(key, value, {
    expires: STORAGE_DURATION.SHORT,
  });
};

/**
 * Get session data
 */
export const getSessionData = <T = any>(key: string): T | null => {
  return getStorage<T>(key);
};

/**
 * Save filter state (per browser tab)
 */
export const saveFilterState = (key: string, value: string | number | boolean | object): void => {
  saveSessionData(key, value);
};

/**
 * Get filter state
 */
export const getFilterState = <T = any>(key: string): T | null => {
  return getSessionData<T>(key);
};

/**
 * Save search query (per browser tab)
 */
export const saveSearchQuery = (key: string, query: string): void => {
  saveSessionData(key, query);
};

/**
 * Get search query
 */
export const getSearchQuery = (key: string): string | null => {
  return getSessionData(key);
};

/**
 * Save dropdown selection (per browser tab)
 */
export const saveDropdownSelection = (key: string, value: string): void => {
  saveSessionData(key, value);
};

/**
 * Get dropdown selection
 */
export const getDropdownSelection = (key: string): string | null => {
  return getSessionData(key);
};

/**
 * Save pagination settings (per browser tab)
 */
export const savePaginationSettings = (key: string, value: number): void => {
  saveSessionData(key, value);
};

/**
 * Get pagination settings
 */
export const getPaginationSettings = (key: string, defaultValue: number = 10): number => {
  const value = getSessionData<number>(key);
  return value !== null ? value : defaultValue;
};

// ============================================
// User Preferences (Shared across tabs using localStorage)
// ============================================

/**
 * Save user preference (shared across all browser tabs)
 */
export const saveUserPreference = (key: string, value: string | number | boolean | object): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving user preference:', error);
  }
};

/**
 * Get user preference (shared across all browser tabs)
 */
export const getUserPreference = <T = any>(key: string): T | null => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('Error getting user preference:', error);
    return null;
  }
};

/**
 * Delete user preference
 */
export const deleteUserPreference = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error deleting user preference:', error);
  }
};
