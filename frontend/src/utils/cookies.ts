/**
 * Cookie Utility Functions
 * Centralized cookie management for the entire application
 */

export interface CookieOptions {
  expires?: number | Date; // Number of days or Date object
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

/**
 * Set a cookie with options
 * @param name - Cookie name
 * @param value - Cookie value (will be JSON stringified if object)
 * @param options - Cookie options
 */
export const setCookie = (
  name: string,
  value: string | number | boolean | object,
  options: CookieOptions = {}
): void => {
  try {
    // Convert value to string
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    // Encode the value
    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(stringValue)}`;

    // Handle expiration
    if (options.expires) {
      let expiresDate: Date;
      
      if (typeof options.expires === 'number') {
        // Number of days
        expiresDate = new Date();
        expiresDate.setTime(expiresDate.getTime() + options.expires * 24 * 60 * 60 * 1000);
      } else {
        // Date object
        expiresDate = options.expires;
      }
      
      cookieString += `; expires=${expiresDate.toUTCString()}`;
    }

    // Add path (default to '/')
    cookieString += `; path=${options.path || '/'}`;

    // Add domain if specified
    if (options.domain) {
      cookieString += `; domain=${options.domain}`;
    }

    // Add secure flag if specified
    if (options.secure) {
      cookieString += '; secure';
    }

    // Add sameSite if specified
    if (options.sameSite) {
      cookieString += `; samesite=${options.sameSite}`;
    }

    document.cookie = cookieString;
  } catch (error) {
    console.error('Error setting cookie:', error);
  }
};

/**
 * Get a cookie value by name
 * @param name - Cookie name
 * @param parseJSON - Whether to parse the value as JSON (default: false)
 * @returns Cookie value or null if not found
 */
export const getCookie = <T = string>(name: string, parseJSON = false): T | null => {
  try {
    const nameEQ = encodeURIComponent(name) + '=';
    const cookies = document.cookie.split(';');

    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i];
      while (cookie.charAt(0) === ' ') {
        cookie = cookie.substring(1, cookie.length);
      }
      
      if (cookie.indexOf(nameEQ) === 0) {
        const value = decodeURIComponent(cookie.substring(nameEQ.length, cookie.length));
        
        if (parseJSON) {
          try {
            return JSON.parse(value) as T;
          } catch {
            return value as T;
          }
        }
        
        return value as T;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting cookie:', error);
    return null;
  }
};

/**
 * Delete a cookie by name
 * @param name - Cookie name
 * @param options - Cookie options (path and domain should match the original cookie)
 */
export const deleteCookie = (name: string, options: Pick<CookieOptions, 'path' | 'domain'> = {}): void => {
  setCookie(name, '', {
    ...options,
    expires: -1,
  });
};

/**
 * Check if a cookie exists
 * @param name - Cookie name
 * @returns True if cookie exists, false otherwise
 */
export const hasCookie = (name: string): boolean => {
  return getCookie(name) !== null;
};

/**
 * Get all cookies as an object
 * @returns Object with all cookies
 */
export const getAllCookies = (): Record<string, string> => {
  try {
    const cookies: Record<string, string> = {};
    const cookieArray = document.cookie.split(';');

    for (const cookie of cookieArray) {
      const [name, value] = cookie.split('=').map(c => c.trim());
      if (name && value) {
        cookies[decodeURIComponent(name)] = decodeURIComponent(value);
      }
    }

    return cookies;
  } catch (error) {
    console.error('Error getting all cookies:', error);
    return {};
  }
};

/**
 * Clear all cookies
 * @param options - Cookie options (path and domain)
 */
export const clearAllCookies = (options: Pick<CookieOptions, 'path' | 'domain'> = {}): void => {
  const cookies = getAllCookies();
  Object.keys(cookies).forEach(name => {
    deleteCookie(name, options);
  });
};

// ============================================
// Predefined Cookie Keys for the Application
// ============================================

export const COOKIE_KEYS = {
  // Inventory
  INVENTORY_ACTIVE_TAB: 'inventory_active_tab',
  INVENTORY_SELECTED_BRANCH: 'inventory_selected_branch',
  INVENTORY_ITEMS_SEARCH: 'inventory_items_search',
  INVENTORY_ITEMS_TYPE_FILTER: 'inventory_items_type_filter',
  INVENTORY_ITEMS_CATEGORY_FILTER: 'inventory_items_category_filter',
  INVENTORY_ITEMS_ROWS_PER_PAGE: 'inventory_items_rows_per_page',
  
  // Categories
  CATEGORIES_SEARCH: 'categories_search',
  CATEGORIES_TYPE_FILTER: 'categories_type_filter',
  CATEGORIES_STATUS_FILTER: 'categories_status_filter',
  CATEGORIES_ROWS_PER_PAGE: 'categories_rows_per_page',
  
  // GRN
  GRN_SEARCH: 'grn_search',
  GRN_STATUS_FILTER: 'grn_status_filter',
  GRN_ROWS_PER_PAGE: 'grn_rows_per_page',
  
  // Stock Adjustments
  ADJUSTMENTS_SEARCH: 'adjustments_search',
  ADJUSTMENTS_TYPE_FILTER: 'adjustments_type_filter',
  ADJUSTMENTS_ROWS_PER_PAGE: 'adjustments_rows_per_page',
  
  // Stock Transfers
  TRANSFERS_SEARCH: 'transfers_search',
  TRANSFERS_STATUS_FILTER: 'transfers_status_filter',
  TRANSFERS_ROWS_PER_PAGE: 'transfers_rows_per_page',
  
  // User Preferences
  THEME: 'theme',
  LANGUAGE: 'language',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
  
  // Table Preferences
  TABLE_DENSITY: 'table_density',
  
  // Add more as needed
} as const;

// ============================================
// Predefined Cookie Durations (in days)
// ============================================

export const COOKIE_DURATION = {
  SHORT: 0.5, // 12 hours
  MEDIUM: 7, // 1 week
  LONG: 30, // 1 month
  VERY_LONG: 365, // 1 year
} as const;

// ============================================
// Helper Functions for Common Use Cases
// ============================================

/**
 * Save user preference with default 30-day expiration
 */
export const saveUserPreference = (key: string, value: string | number | boolean | object): void => {
  setCookie(key, value, {
    expires: COOKIE_DURATION.LONG,
    path: '/',
    sameSite: 'lax',
  });
};

/**
 * Get user preference
 */
export const getUserPreference = <T = string>(key: string, parseJSON = false): T | null => {
  return getCookie<T>(key, parseJSON);
};

/**
 * Save session data with 12-hour expiration
 */
export const saveSessionData = (key: string, value: string | number | boolean | object): void => {
  setCookie(key, value, {
    expires: COOKIE_DURATION.SHORT,
    path: '/',
    sameSite: 'lax',
  });
};

/**
 * Get session data
 */
export const getSessionData = <T = string>(key: string, parseJSON = false): T | null => {
  return getCookie<T>(key, parseJSON);
};

/**
 * Save filter state (12-hour expiration)
 */
export const saveFilterState = (key: string, value: string | number | boolean | object): void => {
  saveSessionData(key, value);
};

/**
 * Get filter state
 */
export const getFilterState = <T = string>(key: string, parseJSON = false): T | null => {
  return getSessionData<T>(key, parseJSON);
};

/**
 * Save search query (12-hour expiration)
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
 * Save dropdown selection (12-hour expiration)
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
 * Save pagination settings (30-day expiration)
 */
export const savePaginationSettings = (key: string, value: number): void => {
  saveUserPreference(key, value);
};

/**
 * Get pagination settings
 */
export const getPaginationSettings = (key: string, defaultValue: number = 10): number => {
  const value = getUserPreference(key);
  return value ? parseInt(value as string, 10) : defaultValue;
};
