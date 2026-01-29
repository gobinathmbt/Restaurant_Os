// Electron API type definitions
interface ElectronAPI {
  platform: string;
  isElectron: boolean;
  send: (channel: string, data?: any) => void;
  receive: (channel: string, callback: (...args: any[]) => void) => void;
  removeListener: (channel: string, callback: (...args: any[]) => void) => void;
  invoke: (channel: string, data?: any) => Promise<any>;
  
  sync: {
    manual: () => Promise<{ success: boolean; data?: any; error?: string }>;
    getStatus: () => Promise<{ success: boolean; data?: any; error?: string }>;
    checkOnline: () => Promise<{ success: boolean; data?: { isOnline: boolean }; error?: string }>;
    startAuto: () => Promise<{ success: boolean; message?: string; error?: string }>;
    stopAuto: () => Promise<{ success: boolean; message?: string; error?: string }>;
  };
  
  printer: {
    print: (data: any) => Promise<{ success: boolean; error?: string }>;
    printReceipt: (billData: any) => Promise<{ success: boolean; error?: string }>;
    printKOT: (kotData: any) => Promise<{ success: boolean; error?: string }>;
    getAvailablePrinters: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
    openCashDrawer: () => Promise<{ success: boolean; message?: string; error?: string }>;
  };
  
  hardware: {
    scanBarcode: () => Promise<{ success: boolean; data?: { barcode: string }; error?: string }>;
    readWeight: () => Promise<{ success: boolean; data?: { weight: number; unit: string }; error?: string }>;
    displayCustomerPole: (text: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  };
  
  storage: {
    get: (key: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    set: (key: string, value: any) => Promise<{ success: boolean; error?: string }>;
    delete: (key: string) => Promise<{ success: boolean; error?: string }>;
    clear: () => Promise<{ success: boolean; error?: string }>;
  };
  
  app: {
    getVersion: () => Promise<{ success: boolean; data?: { version: string }; error?: string }>;
    quit: () => Promise<{ success: boolean; error?: string }>;
    minimize: () => Promise<{ success: boolean; error?: string }>;
    maximize: () => Promise<{ success: boolean; data?: { isMaximized: boolean }; error?: string }>;
    close: () => Promise<{ success: boolean; error?: string }>;
  };
}

interface Window {
  electron?: ElectronAPI;
}

