/**
 * Utility functions to detect platform and environment
 */

/**
 * Check if the app is running inside Electron
 */
export const isElectron = (): boolean => {
  // Check if running in Electron via window.electron API
  if (typeof window !== 'undefined' && window.electron) {
    return true;
  }
  
  // Alternative check via user agent
  if (typeof navigator !== 'undefined') {
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.indexOf(' electron/') > -1;
  }
  
  return false;
};

/**
 * Check if the app is running in a web browser
 */
export const isWeb = (): boolean => {
  return !isElectron();
};

/**
 * Get the platform type
 */
export const getPlatform = (): 'electron' | 'web' => {
  return isElectron() ? 'electron' : 'web';
};

/**
 * Get Electron API if available
 */
export const getElectronAPI = (): ElectronAPI | null => {
  if (typeof window !== 'undefined' && window.electron) {
    return window.electron;
  }
  return null;
};

/**
 * Check if Electron API is available
 */
export const hasElectronAPI = (): boolean => {
  return getElectronAPI() !== null;
};

/**
 * Get platform-specific configuration
 */
export const getPlatformConfig = () => {
  const platform = getPlatform();
  
  return {
    platform,
    isElectron: platform === 'electron',
    isWeb: platform === 'web',
    hasAPI: hasElectronAPI(),
    features: {
      // Electron-specific features
      offlineMode: platform === 'electron',
      localDatabase: platform === 'electron',
      printer: platform === 'electron',
      hardware: platform === 'electron',
      autoSync: platform === 'electron',
      
      // Web-specific features
      landingPage: platform === 'web',
      publicRegistration: platform === 'web',
    },
  };
};

/**
 * Log platform information (for debugging)
 */
export const logPlatformInfo = () => {
  const config = getPlatformConfig();
  console.log('Platform Info:', {
    platform: config.platform,
    isElectron: config.isElectron,
    isWeb: config.isWeb,
    hasAPI: config.hasAPI,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
    windowElectron: typeof window !== 'undefined' ? !!window.electron : false,
  });
};
