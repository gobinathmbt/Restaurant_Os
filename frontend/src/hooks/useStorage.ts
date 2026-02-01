import { useState, useCallback } from 'react';
import { setStorage, getStorage, deleteStorage, StorageOptions } from '@/utils/storage';

/**
 * React hook for managing sessionStorage with state synchronization (per browser tab)
 * @param key - Storage key
 * @param defaultValue - Default value if storage doesn't exist
 * @param options - Storage options
 * @returns [value, setValue, deleteValue]
 */
export function useStorage<T = string>(
  key: string,
  defaultValue: T,
  options?: StorageOptions
): [T, (value: T) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    const storedValue = getStorage<T>(key);
    return storedValue !== null ? storedValue : defaultValue;
  });

  const updateStorage = useCallback(
    (newValue: T) => {
      setValue(newValue);
      setStorage(key, newValue as string | number | boolean | object, options);
    },
    [key, options]
  );

  const removeStorage = useCallback(() => {
    setValue(defaultValue);
    deleteStorage(key);
  }, [key, defaultValue]);

  return [value, updateStorage, removeStorage];
}

/**
 * React hook for managing session storage (per browser tab, 12-hour expiration)
 * @param key - Storage key
 * @param defaultValue - Default value if storage doesn't exist
 * @returns [value, setValue, deleteValue]
 */
export function useSessionStorage<T = string>(
  key: string,
  defaultValue: T
): [T, (value: T) => void, () => void] {
  return useStorage(key, defaultValue, {
    expires: 12 * 60 * 60 * 1000, // 12 hours
  });
}

/**
 * React hook for managing filter state with storage (per browser tab)
 * @param key - Storage key
 * @param defaultValue - Default value if storage doesn't exist
 * @returns [value, setValue, resetValue]
 */
export function useFilterStorage(
  key: string,
  defaultValue: string = ''
): [string, (value: string) => void, () => void] {
  const [value, setValue, deleteValue] = useSessionStorage(key, defaultValue);

  const resetValue = useCallback(() => {
    setValue(defaultValue);
  }, [defaultValue, setValue]);

  return [value, setValue, resetValue];
}

/**
 * React hook for managing search query with storage (per browser tab)
 * @param key - Storage key
 * @returns [searchQuery, setSearchQuery, clearSearch]
 */
export function useSearchStorage(
  key: string
): [string, (value: string) => void, () => void] {
  return useFilterStorage(key, '');
}

/**
 * React hook for managing dropdown selection with storage (per browser tab)
 * @param key - Storage key
 * @param defaultValue - Default value if storage doesn't exist
 * @returns [selection, setSelection, resetSelection]
 */
export function useDropdownStorage(
  key: string,
  defaultValue: string = ''
): [string, (value: string) => void, () => void] {
  return useSessionStorage(key, defaultValue);
}

/**
 * React hook for managing pagination settings with storage (per browser tab)
 * @param key - Storage key
 * @param defaultValue - Default rows per page
 * @returns [rowsPerPage, setRowsPerPage]
 */
export function usePaginationStorage(
  key: string,
  defaultValue: number = 10
): [number, (value: number) => void] {
  const [value, setValue] = useSessionStorage(key, defaultValue);

  const setRowsPerPage = useCallback(
    (newValue: number) => {
      setValue(newValue);
    },
    [setValue]
  );

  return [value, setRowsPerPage];
}

/**
 * React hook for managing tab state with storage (per browser tab)
 * @param key - Storage key
 * @param defaultTab - Default tab value
 * @returns [activeTab, setActiveTab]
 */
export function useTabStorage(
  key: string,
  defaultTab: string = 'items'
): [string, (value: string) => void] {
  const [activeTab, setActiveTab] = useSessionStorage(key, defaultTab);
  return [activeTab, setActiveTab];
}

/**
 * React hook for managing boolean values with storage (per browser tab)
 * @param key - Storage key
 * @param defaultValue - Default boolean value
 * @returns [value, setValue, toggle]
 */
export function useBooleanStorage(
  key: string,
  defaultValue: boolean = false
): [boolean, (value: boolean) => void, () => void] {
  const [value, setValue] = useSessionStorage(key, defaultValue);

  const toggle = useCallback(() => {
    setValue(!value);
  }, [value, setValue]);

  return [value, setValue, toggle];
}

/**
 * React hook for managing object/array data with storage (per browser tab)
 * @param key - Storage key
 * @param defaultValue - Default object/array value
 * @returns [value, setValue, deleteValue]
 */
export function useObjectStorage<T extends object>(
  key: string,
  defaultValue: T,
  options?: StorageOptions
): [T, (value: T) => void, () => void] {
  return useStorage<T>(key, defaultValue, options);
}

/**
 * React hook for managing page number with storage (per browser tab)
 * @param key - Storage key
 * @param defaultValue - Default page number
 * @returns [page, setPage, resetPage]
 */
export function usePageStorage(
  key: string,
  defaultValue: number = 1
): [number, (value: number) => void, () => void] {
  const [page, setPage, deletePage] = useSessionStorage(key, defaultValue);

  const resetPage = useCallback(() => {
    setPage(1);
  }, [setPage]);

  return [page, setPage, resetPage];
}
