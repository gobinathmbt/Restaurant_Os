const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script - Exposes safe IPC methods to the renderer process
 * This script runs in a privileged context with access to Node.js APIs
 * but uses contextBridge to safely expose only specific APIs to the renderer
 */

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Trigger manual data synchronization
   * @returns {Promise<Object>} Sync result with status and details
   */
  syncData: () => {
    return ipcRenderer.invoke('sync-data');
  },

  /**
   * Get local data from a specific collection
   * @param {string} collection - The collection name to query
   * @returns {Promise<Array>} Array of documents from the collection
   */
  getLocalData: (collection) => {
    return ipcRenderer.invoke('get-local-data', collection);
  },

  /**
   * Register callback for sync completion events
   * @param {Function} callback - Function to call when sync completes
   */
  onSyncComplete: (callback) => {
    ipcRenderer.on('sync-complete', (_event, data) => {
      callback(data);
    });
  },

  /**
   * Register callback for sync error events
   * @param {Function} callback - Function to call when sync fails
   */
  onSyncError: (callback) => {
    ipcRenderer.on('sync-error', (_event, error) => {
      callback(error);
    });
  },

  /**
   * Remove sync complete listener
   * @param {Function} callback - The callback to remove
   */
  removeSyncCompleteListener: (callback) => {
    ipcRenderer.removeListener('sync-complete', callback);
  },

  /**
   * Remove sync error listener
   * @param {Function} callback - The callback to remove
   */
  removeSyncErrorListener: (callback) => {
    ipcRenderer.removeListener('sync-error', callback);
  },
});
