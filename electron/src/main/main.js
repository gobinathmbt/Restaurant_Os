const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const syncService = require('./syncService');
const { connectLocalDB, closeConnection } = require('./localDB');

let mainWindow;

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Load React app
  // In development: load from Vite dev server
  // In production: load from local file
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App ready event - create window
app.whenReady().then(async () => {
  try {
    // Initialize local database connection
    await connectLocalDB();
    console.log('✅ Local database initialized');
  } catch (error) {
    console.error('❌ Failed to initialize local database:', error);
  }

  createWindow();

  // On macOS, re-create window when dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Stop sync service and close database connection
    syncService.stop();
    closeConnection().then(() => {
      app.quit();
    }).catch((error) => {
      console.error('❌ Error closing database connection:', error);
      app.quit();
    });
  }
});

// Handle app quit - cleanup
app.on('before-quit', async () => {
  syncService.stop();
  await closeConnection();
});

// IPC Handlers for sync operations

/**
 * Handle manual sync trigger from renderer
 */
ipcMain.handle('sync-data', async () => {
  try {
    console.log('📡 Manual sync triggered from renderer');
    const result = await syncService.performSync();
    
    // Emit sync complete event to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync-complete', result);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Manual sync failed:', error);
    
    // Emit sync error event to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync-error', {
        error: error.message,
        timestamp: new Date(),
      });
    }
    
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Handle authentication - set auth token and start sync service
 */
ipcMain.handle('set-auth', async (event, { token, companyId }) => {
  try {
    console.log('🔐 Setting authentication for sync service');
    
    syncService.setAuthToken(token);
    syncService.setCompanyId(companyId);
    
    // Start automatic sync service after authentication
    syncService.start();
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error setting authentication:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Handle logout - stop sync service
 */
ipcMain.handle('logout', async () => {
  try {
    console.log('👋 Logging out - stopping sync service');
    
    syncService.stop();
    syncService.setAuthToken(null);
    syncService.setCompanyId(null);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error during logout:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Get sync service status
 */
ipcMain.handle('get-sync-status', async () => {
  try {
    const status = syncService.getStatus();
    return {
      success: true,
      status,
    };
  } catch (error) {
    console.error('❌ Error getting sync status:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Get local data from a collection
 */
ipcMain.handle('get-local-data', async (event, collection) => {
  try {
    const { connectLocalDB } = require('./localDB');
    const db = await connectLocalDB();
    const coll = db.collection(collection);
    
    const data = await coll.find({}).toArray();
    
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error(`❌ Error getting local data from ${collection}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
});
