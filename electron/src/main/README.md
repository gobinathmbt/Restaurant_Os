# Electron Main Process

This directory contains the main process files for the ROS Desktop application.

## Files

### main.js
The main entry point for the Electron application. It:
- Creates the main application window (1280x720)
- Configures security settings (contextIsolation, no nodeIntegration, sandbox mode)
- Loads the React app from Vite dev server (development) or local files (production)
- Handles app lifecycle events (ready, window-all-closed, activate)

### preload.js
The preload script that safely exposes IPC methods to the renderer process. It provides:
- `syncData()` - Trigger manual data synchronization
- `getLocalData(collection)` - Get local data from a specific collection
- `onSyncComplete(callback)` - Register callback for sync completion events
- `onSyncError(callback)` - Register callback for sync error events
- Listener removal methods for cleanup

## Security Features

The implementation follows Electron security best practices:
- **Context Isolation**: Enabled to prevent renderer from accessing Node.js APIs directly
- **Node Integration**: Disabled to prevent security vulnerabilities
- **Sandbox**: Enabled for additional security layer
- **Preload Script**: Uses contextBridge to safely expose only necessary APIs

## Running the Application

Development mode (loads from Vite dev server):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Next Steps

Future tasks will implement:
- IPC handlers in main.js for sync operations
- Local database utilities
- Sync service integration
