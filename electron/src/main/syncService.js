const axios = require('axios');
const {
  getPendingChanges,
  markAsSynced,
  getLastSyncTime,
  setLastSyncTime,
  upsert,
} = require('./localDB');

// API base URL
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// Collections to sync
const SYNC_COLLECTIONS = [
  'orders',
  'customers',
  'inventory',
  'menu_items',
  'staff',
  'attendance',
  'expenses',
];

/**
 * SyncService class for managing data synchronization
 * between local MongoDB and server
 */
class SyncService {
  constructor() {
    this.syncInterval = null;
    this.isSyncing = false;
    this.syncIntervalMs = 5 * 60 * 1000; // 5 minutes
    this.authToken = null;
    this.companyId = null;
  }

  /**
   * Set authentication token for API calls
   * @param {string} token - JWT token
   */
  setAuthToken(token) {
    this.authToken = token;
    console.log('✅ Auth token set for sync service');
  }

  /**
   * Set company ID for sync operations
   * @param {string} companyId - Company identifier
   */
  setCompanyId(companyId) {
    this.companyId = companyId;
    console.log(`✅ Company ID set for sync service: ${companyId}`);
  }

  /**
   * Start automatic sync service
   * Runs sync every 5 minutes
   */
  start() {
    if (this.syncInterval) {
      console.log('⚠️  Sync service already running');
      return;
    }

    if (!this.authToken || !this.companyId) {
      console.error('❌ Cannot start sync service: Auth token or company ID not set');
      return;
    }

    console.log('🚀 Starting sync service...');
    
    // Perform initial sync
    this.performSync();

    // Set up interval for periodic sync
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, this.syncIntervalMs);

    console.log(`✅ Sync service started (interval: ${this.syncIntervalMs / 1000}s)`);
  }

  /**
   * Stop automatic sync service
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('✅ Sync service stopped');
    }
  }

  /**
   * Perform complete sync operation
   * Uploads local changes and downloads server changes
   * @returns {Promise<Object>} Sync result
   */
  async performSync() {
    if (this.isSyncing) {
      console.log('⚠️  Sync already in progress, skipping...');
      return { success: false, message: 'Sync already in progress' };
    }

    if (!this.authToken || !this.companyId) {
      console.error('❌ Cannot sync: Auth token or company ID not set');
      return { success: false, message: 'Auth token or company ID not set' };
    }

    this.isSyncing = true;
    const syncStartTime = new Date();

    console.log('🔄 Starting sync operation...');

    try {
      // Step 1: Upload local changes to server
      const uploadResult = await this.uploadLocalChanges();
      console.log(`📤 Upload complete: ${uploadResult.totalUploaded} records uploaded`);

      // Step 2: Download server changes to local
      const downloadResult = await this.downloadServerChanges();
      console.log(`📥 Download complete: ${downloadResult.totalDownloaded} records downloaded`);

      // Step 3: Update last sync time
      await setLastSyncTime(syncStartTime);

      const result = {
        success: true,
        timestamp: syncStartTime,
        uploaded: uploadResult.totalUploaded,
        downloaded: downloadResult.totalDownloaded,
        collections: uploadResult.collections,
      };

      console.log('✅ Sync completed successfully', result);
      return result;

    } catch (error) {
      console.error('❌ Sync failed:', error.message);
      return {
        success: false,
        error: error.message,
        timestamp: syncStartTime,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Upload local changes to server
   * @returns {Promise<Object>} Upload result
   */
  async uploadLocalChanges() {
    const uploadResults = {
      totalUploaded: 0,
      collections: {},
    };

    for (const collection of SYNC_COLLECTIONS) {
      try {
        // Get pending changes for this collection
        const pendingDocs = await getPendingChanges(collection);

        if (pendingDocs.length === 0) {
          console.log(`ℹ️  No pending changes in ${collection}`);
          uploadResults.collections[collection] = 0;
          continue;
        }

        console.log(`📤 Uploading ${pendingDocs.length} records from ${collection}...`);

        // Send to server
        const response = await axios.post(
          `${API_BASE_URL}/api/sync/upload/${collection}`,
          {
            companyId: this.companyId,
            data: pendingDocs,
          },
          {
            headers: {
              Authorization: `Bearer ${this.authToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 second timeout
          }
        );

        if (response.data.success) {
          // Mark records as synced
          const ids = pendingDocs.map(doc => doc._id);
          await markAsSynced(collection, ids);

          uploadResults.totalUploaded += pendingDocs.length;
          uploadResults.collections[collection] = pendingDocs.length;

          console.log(`✅ Uploaded ${pendingDocs.length} records from ${collection}`);
        } else {
          console.error(`❌ Server rejected upload for ${collection}:`, response.data.message);
        }

      } catch (error) {
        console.error(`❌ Error uploading ${collection}:`, error.message);
        // Continue with other collections even if one fails
        uploadResults.collections[collection] = { error: error.message };
      }
    }

    return uploadResults;
  }

  /**
   * Download server changes to local storage
   * @returns {Promise<Object>} Download result
   */
  async downloadServerChanges() {
    const downloadResults = {
      totalDownloaded: 0,
      collections: {},
    };

    try {
      // Get last sync time
      const lastSyncTime = await getLastSyncTime();
      const since = lastSyncTime ? lastSyncTime.toISOString() : null;

      console.log(`📥 Downloading changes since: ${since || 'beginning'}`);

      // Request changes from server
      const response = await axios.get(
        `${API_BASE_URL}/api/sync/download`,
        {
          params: {
            companyId: this.companyId,
            since: since,
            collections: SYNC_COLLECTIONS.join(','),
          },
          headers: {
            Authorization: `Bearer ${this.authToken}`,
          },
          timeout: 30000, // 30 second timeout
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Download failed');
      }

      const serverData = response.data.data;

      // Process each collection
      for (const collection of SYNC_COLLECTIONS) {
        const collectionData = serverData[collection] || [];

        if (collectionData.length === 0) {
          console.log(`ℹ️  No new data for ${collection}`);
          downloadResults.collections[collection] = 0;
          continue;
        }

        console.log(`📥 Downloading ${collectionData.length} records for ${collection}...`);

        // Apply conflict resolution (server wins strategy)
        const resolvedData = await this.resolveConflicts(collection, collectionData);

        // Upsert to local database
        await upsert(collection, resolvedData);

        downloadResults.totalDownloaded += resolvedData.length;
        downloadResults.collections[collection] = resolvedData.length;

        console.log(`✅ Downloaded ${resolvedData.length} records for ${collection}`);
      }

    } catch (error) {
      console.error('❌ Error downloading server changes:', error.message);
      throw error;
    }

    return downloadResults;
  }

  /**
   * Resolve conflicts between local and server data
   * Strategy: Server wins (server data overwrites local data)
   * @param {string} collection - Collection name
   * @param {Array} serverData - Data from server
   * @returns {Promise<Array>} Resolved data
   */
  async resolveConflicts(collection, serverData) {
    const resolvedData = [];

    for (const serverDoc of serverData) {
      // Server wins strategy: always use server data
      // Mark as synced since it came from server
      const resolvedDoc = {
        ...serverDoc,
        _synced: true,
        _syncedAt: new Date(),
        _lastModified: new Date(serverDoc.updatedAt || serverDoc.createdAt || Date.now()),
      };

      resolvedData.push(resolvedDoc);
    }

    // Log conflicts if any local changes would be overwritten
    const localPending = await getPendingChanges(collection);
    const conflictIds = localPending
      .filter(localDoc => serverData.some(serverDoc => serverDoc._id === localDoc._id))
      .map(doc => doc._id);

    if (conflictIds.length > 0) {
      console.log(`⚠️  Conflict resolution: ${conflictIds.length} local changes overwritten by server in ${collection}`);
      console.log(`   Conflicted IDs: ${conflictIds.join(', ')}`);
    }

    return resolvedData;
  }

  /**
   * Get sync status
   * @returns {Object} Current sync status
   */
  getStatus() {
    return {
      isRunning: this.syncInterval !== null,
      isSyncing: this.isSyncing,
      hasAuth: !!this.authToken,
      hasCompanyId: !!this.companyId,
      intervalMs: this.syncIntervalMs,
    };
  }
}

// Export singleton instance
module.exports = new SyncService();
