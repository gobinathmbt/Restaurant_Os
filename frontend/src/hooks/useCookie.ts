import { useState, useEffect, useCallback } from 'react';
import { setCookie, getCookie, deleteCookie, CookieOptions } from '@/utils/cookies';

/**
 * React hook for managing cookies with state synchronization
 * @param key - Cookie name
 * @param defaultValue - Default value if cookie doesn't exist
 * @param options - Cookie options
 * @returns [value, setValue, deleteCookie]
 */
export function useCookie<T = string>(
  key: string,
  defaultValue: T,
  options?: CookieOptions
): [T, (value: T) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    const cookieValue = getCookie(key, typeof defaultValue === 'object');
    return cookieValue !== null ? (cookieValue as T) : defaultValue;
  });

  const updateCookie = useCallback(
    (newValue: T) => {
      setValue(newValue);
      setCookie(key, newValue as string | number | boolean | object, options);
    },
    [key, options]
  );

  const removeCookie = useCallback(() => {
    setValue(defaultValue);
    deleteCookie(key, { path: options?.path, domain: options?.domain });
  }, [key, defaultValue, options]);

  return [value, updateCookie, removeCookie];
}

/**
 * React hook for managing session cookies (12-hour expiration)
 * @param key - Cookie name
 * @param defaultValue - Default value if cookie doesn't exist
 * @returns [value, setValue, deleteCookie]
 */
export function useSessionCookie<T = string>(
  key: string,
  defaultValue: T
): [T, (value: T) => void, () => void] {
  return useCookie(key, defaultValue, {
    expires: 0.5, // 12 hours
    path: '/',
    sameSite: 'lax',
  });
}

/**
 * React hook for managing user preference cookies (30-day expiration)
 * @param key - Cookie name
 * @param defaultValue - Default value if cookie doesn't exist
 * @returns [value, setValue, deleteCookie]
 */
export function usePreferenceCookie<T = string>(
  key: string,
  defaultValue: T
): [T, (value: T) => void, () => void] {
  return useCookie(key, defaultValue, {
    expires: 30, // 30 days
    path: '/',
    sameSite: 'lax',
  });
}

/**
 * React hook for managing filter state with cookies
 * @param key - Cookie name
 * @param defaultValue - Default value if cookie doesn't exist
 * @returns [value, setValue, resetValue]
 */
export function useFilterCookie(
  key: string,
  defaultValue: string = ''
): [string, (value: string) => void, () => void] {
  const [value, setValue, deleteCookie] = useSessionCookie(key, defaultValue);

  const resetValue = useCallback(() => {
    setValue(defaultValue);
  }, [defaultValue, setValue]);

  return [value, setValue, resetValue];
}

/**
 * React hook for managing search query with cookies
 * @param key - Cookie name
 * @returns [searchQuery, setSearchQuery, clearSearch]
 */
export function useSearchCookie(
  key: string
): [string, (value: string) => void, () => void] {
  return useFilterCookie(key, '');
}

/**
 * React hook for managing dropdown selection with cookies
 * @param key - Cookie name
 * @param defaultValue - Default value if cookie doesn't exist
 * @returns [selection, setSelection, resetSelection]
 */
export function useDropdownCookie(
  key: string,
  defaultValue: string = ''
): [string, (value: string) => void, () => void] {
  return useSessionCookie(key, defaultValue);
}

/**
 * React hook for managing pagination settings with cookies
 * @param key - Cookie name
 * @param defaultValue - Default rows per page
 * @returns [rowsPerPage, setRowsPerPage]
 */
export function usePaginationCookie(
  key: string,
  defaultValue: number = 10
): [number, (value: number) => void] {
  const [value, setValue] = usePreferenceCookie(key, String(defaultValue));

  const setRowsPerPage = useCallback(
    (newValue: number) => {
      setValue(String(newValue));
    },
    [setValue]
  );

  return [parseInt(value, 10), setRowsPerPage];
}

/**
 * React hook for managing tab state with cookies
 * @param key - Cookie name
 * @param defaultTab - Default tab value
 * @returns [activeTab, setActiveTab]
 */
export function useTabCookie(
  key: string,
  defaultTab: string = 'items'
): [string, (value: string) => void] {
  const [activeTab, setActiveTab] = useSessionCookie(key, defaultTab);
  return [activeTab, setActiveTab];
}

/**
 * React hook for managing boolean preferences with cookies
 * @param key - Cookie name
 * @param defaultValue - Default boolean value
 * @returns [value, setValue, toggle]
 */
export function useBooleanCookie(
  key: string,
  defaultValue: boolean = false
): [boolean, (value: boolean) => void, () => void] {
  const [value, setValue] = usePreferenceCookie(key, String(defaultValue));

  const setBooleanValue = useCallback(
    (newValue: boolean) => {
      setValue(String(newValue));
    },
    [setValue]
  );

  const toggle = useCallback(() => {
    setBooleanValue(value !== 'true');
  }, [value, setBooleanValue]);

  return [value === 'true', setBooleanValue, toggle];
}

/**
 * React hook for managing object/array data with cookies
 * @param key - Cookie name
 * @param defaultValue - Default object/array value
 * @returns [value, setValue, deleteCookie]
 */
export function useObjectCookie<T extends object>(
  key: string,
  defaultValue: T,
  options?: CookieOptions
): [T, (value: T) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    const cookieValue = getCookie<T>(key, true);
    return cookieValue !== null ? cookieValue : defaultValue;
  });

  const updateCookie = useCallback(
    (newValue: T) => {
      setValue(newValue);
      setCookie(key, newValue, options);
    },
    [key, options]
  );

  const removeCookie = useCallback(() => {
    setValue(defaultValue);
    deleteCookie(key, { path: options?.path, domain: options?.domain });
  }, [key, defaultValue, options]);

  return [value, updateCookie, removeCookie];
}
