# Implementation Plan: Project Setup & Infrastructure

## Overview

This implementation plan breaks down the Project Setup & Infrastructure module into discrete, incremental coding tasks. The approach follows a bottom-up strategy: establish the backend foundation first, then build the frontend, and finally integrate the Electron desktop application. Each task builds on previous work, ensuring no orphaned code.

## Tasks

- [x] 1. Initialize project structure and dependencies
  - Create root directory structure with backend/, frontend/, and electron/ folders
  - Initialize backend Node.js project with package.json (type: "module" for ES6)
  - Initialize frontend React project with Vite
  - Initialize Electron project structure
  - Install backend dependencies: express, mongoose, bcrypt, jsonwebtoken, dotenv, cors
  - Install frontend dependencies: react, react-dom, react-router-dom, axios, tailwindcss, @radix-ui/react-*
  - Install Electron dependencies: electron, electron-builder
  - Install testing dependencies: jest, @testing-library/react, fast-check
  - Create .gitignore files for each project
  - Create .env.example files with template variables
  - _Requirements: 1.1, 1.2, 5.1, 7.1, 9.1_

- [x] 2. Implement backend core utilities
  - [x] 2.1 Create logger utility with info, error, warn, debug methods
    - Implement logger.js with configurable log levels
    - Add timestamp and formatting to log messages
    - Support LOG_LEVEL environment variable
    - _Requirements: 3.1, 3.4_
  
  - [ ]* 2.2 Write unit tests for logger utility
    - Test all four log level methods exist and work
    - Test log level filtering based on environment variable
    - Test message formatting includes timestamp
    - _Requirements: 3.1_
  
  - [x] 2.3 Create database connection utilities
    - Implement connectPlatformDB function in config/database.js
    - Implement getCompanyDB function with connection caching
    - Implement closeAllConnections for graceful shutdown
    - Add error handling and logging for connection failures
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  
  - [ ]* 2.4 Write property test for company database connections
    - **Property 2: Company Database Connection**
    - **Validates: Requirements 2.2**
  
  - [ ]* 2.5 Write unit tests for database utilities
    - Test platform database connection success
    - Test connection failure error handling
    - Test graceful shutdown closes all connections
    - _Requirements: 2.1, 2.3, 2.5_

- [ ] 3. Implement backend middleware
  - [ ] 3.1 Create error handler middleware
    - Implement errorHandler middleware in middleware/errorHandler.js
    - Create AppError custom error class
    - Format error responses with status code and message
    - Hide stack traces in production environment
    - _Requirements: 1.4, 10.1, 10.2, 10.3_
  
  - [ ]* 3.2 Write property test for error handling consistency
    - **Property 1: Error Handling Consistency**
    - **Validates: Requirements 1.4, 10.1, 10.2**
  
  - [ ]* 3.3 Write property test for error logging
    - **Property 4: Error Logging with Context**
    - **Validates: Requirements 3.2, 10.4**
  
  - [ ] 3.4 Create request logger middleware
    - Implement requestLogger middleware in middleware/requestLogger.js
    - Log method, path, status code, and response time for all requests
    - _Requirements: 3.3_
  
  - [ ]* 3.5 Write property test for request logging
    - **Property 3: Request Logging Completeness**
    - **Validates: Requirements 3.3**

- [ ] 4. Implement database models
  - [ ] 4.1 Create User model
    - Define User schema with all required fields (name, email, password, googleId, role, companyId, branchIds)
    - Implement pre-save hook for password hashing with bcrypt
    - Implement comparePassword method
    - Implement toJSON method to exclude password from responses
    - Add timestamps option to schema
    - _Requirements: 4.1, 4.2, 4.3, 4.6_
  
  - [ ]* 4.2 Write property test for password hashing
    - **Property 5: Password Hashing on Save**
    - **Validates: Requirements 4.2**
  
  - [ ]* 4.3 Write property test for password comparison
    - **Property 6: Password Comparison Round Trip**
    - **Validates: Requirements 4.3**
  
  - [ ]* 4.4 Write unit tests for User model
    - Test User model has all required fields
    - Test password is excluded from JSON responses
    - Test googleId users don't require password
    - _Requirements: 4.1_
  
  - [ ] 4.5 Create Company model
    - Define Company schema with all required fields (companyId, companyName, email, subscriptionPlan, subscriptionStatus, modules, primaryAdmin)
    - Add timestamps option to schema
    - Add indexes for companyId and email
    - _Requirements: 4.4, 4.6_
  
  - [ ] 4.6 Create PlatformConfig model
    - Define PlatformConfig schema with fields (configKey, configValue, description, category)
    - Add timestamps option to schema
    - Add index for configKey
    - _Requirements: 4.5, 4.6_
  
  - [ ]* 4.7 Write property test for model timestamps
    - **Property 7: Model Timestamps**
    - **Validates: Requirements 4.6**
  
  - [ ]* 4.8 Write unit tests for Company and PlatformConfig models
    - Test Company model has all required fields
    - Test PlatformConfig model has all required fields
    - Test enum validations work correctly
    - _Requirements: 4.4, 4.5_

- [ ] 5. Set up Express server
  - [ ] 5.1 Create main server file
    - Implement server.js with Express app initialization
    - Configure middleware (cors, json, urlencoded)
    - Add request logger middleware
    - Add health check endpoint at /health
    - Add error handler middleware (must be last)
    - Implement server startup with database connection
    - Use configurable PORT from environment (default 5000)
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 9.2_
  
  - [ ]* 5.2 Write unit tests for server setup
    - Test server runs on default port 5000
    - Test server runs on custom port from environment
    - Test health check endpoint returns correct response
    - Test environment variables are loaded
    - _Requirements: 1.1, 1.2, 1.5_
  
  - [ ]* 5.3 Write property test for configuration defaults
    - **Property 12: Configuration Defaults**
    - **Validates: Requirements 9.2**

- [ ] 6. Checkpoint - Backend foundation complete
  - Ensure all backend tests pass
  - Verify server starts successfully and connects to database
  - Test health check endpoint manually
  - Ask the user if questions arise

- [ ] 7. Set up frontend project structure
  - [ ] 7.1 Configure Vite and Tailwind CSS
    - Create vite.config.js with React plugin and path aliases
    - Configure proxy for /api requests to backend
    - Create tailwind.config.js with custom green theme colors
    - Set up PostCSS configuration
    - Create main CSS file with Tailwind directives
    - _Requirements: 5.1, 5.2_
  
  - [ ] 7.2 Create basic React app structure
    - Set up main.jsx entry point
    - Create App.jsx with React Router
    - Create basic folder structure (components/, services/, utils/, contexts/, hooks/)
    - _Requirements: 5.4, 5.5_
  
  - [ ]* 7.3 Write unit tests for frontend setup
    - Test Vite dev server runs on port 5173
    - Test Radix UI components can be imported
    - Test React Router is configured
    - _Requirements: 5.1, 5.3, 5.4_

- [ ] 8. Implement frontend API layer
  - [ ] 8.1 Create Axios client with interceptors
    - Implement services/api.js with Axios instance
    - Configure base URL and timeout
    - Add request interceptor to inject JWT token from localStorage
    - Add response interceptor to handle 401 errors and redirect to login
    - Add response interceptor to format error messages
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  
  - [ ]* 8.2 Write property test for JWT token injection
    - **Property 8: JWT Token Injection**
    - **Validates: Requirements 6.2**
  
  - [ ]* 8.3 Write property test for API error formatting
    - **Property 9: API Error Formatting**
    - **Validates: Requirements 6.5**
  
  - [ ]* 8.4 Write unit tests for Axios configuration
    - Test base URL is configured correctly
    - Test 401 response triggers redirect to login
    - Test request interceptor adds Authorization header when token exists
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ] 8.5 Create auth service layer
    - Implement services/authService.js with login, register, getCurrentUser, logout methods
    - Use Axios client for all API calls
    - _Requirements: 6.4_
  
  - [ ]* 8.6 Write unit tests for auth service
    - Test login method calls correct endpoint
    - Test register method calls correct endpoint
    - Test logout clears token from localStorage
    - _Requirements: 6.4_

- [ ] 9. Checkpoint - Frontend foundation complete
  - Ensure all frontend tests pass
  - Verify Vite dev server starts successfully
  - Test API client configuration manually
  - Ask the user if questions arise

- [ ] 10. Set up Electron application structure
  - [ ] 10.1 Create Electron main process
    - Implement electron/main.js with BrowserWindow creation
    - Configure webPreferences with security settings (contextIsolation: true, nodeIntegration: false, sandbox: true)
    - Load React app in development (localhost:5173) and production (dist/index.html)
    - Add basic IPC handler for app version
    - _Requirements: 7.1, 7.2, 7.4_
  
  - [ ] 10.2 Create preload script
    - Implement electron/preload.js with contextBridge
    - Expose electronAPI with getAppVersion method
    - Expose sync-related IPC methods (syncData, onSyncComplete, onSyncError)
    - _Requirements: 7.3, 7.5_
  
  - [ ]* 10.3 Write unit tests for Electron setup
    - Test main window launches successfully
    - Test context isolation is enabled
    - Test Node.js integration is disabled in renderer
    - Test exposed APIs are accessible via window.electronAPI
    - _Requirements: 7.1, 7.2, 7.4, 7.5_
  
  - [ ]* 10.4 Write integration test for IPC communication
    - Test IPC messages can be sent from renderer to main
    - Test IPC responses are received in renderer
    - _Requirements: 7.3_

- [ ] 11. Implement Electron sync service
  - [ ] 11.1 Create local database connection utility
    - Implement electron/services/localDB.js for local MongoDB connection
    - Add methods: getPendingChanges, markAsSynced, getLastSyncTime, setLastSyncTime, upsert, findById
    - _Requirements: 8.1_
  
  - [ ] 11.2 Create sync service
    - Implement electron/services/syncService.js with SyncService class
    - Implement start/stop methods with 5-minute interval timer
    - Implement performSync method that calls upload and download
    - Implement uploadLocalChanges to send pending changes to server
    - Implement downloadServerChanges to fetch and apply server changes
    - Implement conflict resolution (server wins)
    - Add comprehensive logging
    - _Requirements: 8.2, 8.3, 8.4, 8.5_
  
  - [ ]* 11.3 Write property test for sync upload
    - **Property 10: Sync Upload Completeness**
    - **Validates: Requirements 8.3**
  
  - [ ]* 11.4 Write property test for sync download
    - **Property 11: Sync Download Application**
    - **Validates: Requirements 8.4**
  
  - [ ]* 11.5 Write unit tests for sync service
    - Test sync service runs every 5 minutes
    - Test local MongoDB connection is established
    - Test conflict resolution uses server data
    - _Requirements: 8.1, 8.2, 8.5_
  
  - [ ] 11.6 Integrate sync service with main process
    - Initialize sync service in main.js
    - Add IPC handlers for manual sync trigger
    - Emit sync events to renderer process
    - _Requirements: 8.2_

- [ ] 12. Create environment configuration files
  - [ ] 12.1 Create backend environment configuration
    - Create backend/.env.example with all required variables
    - Document each variable with comments
    - Add validation for required environment variables in server.js
    - _Requirements: 9.1, 9.3_
  
  - [ ] 12.2 Create frontend environment configuration
    - Create frontend/.env.example with VITE_API_BASE_URL
    - Document environment-specific configurations
    - _Requirements: 9.1_
  
  - [ ]* 12.3 Write unit test for environment validation
    - Test server fails to start when required env vars are missing
    - Test appropriate error message is shown
    - _Requirements: 9.3_

- [ ] 13. Final integration and documentation
  - [ ] 13.1 Create README files
    - Create backend/README.md with setup and run instructions
    - Create frontend/README.md with setup and run instructions
    - Create electron/README.md with build and distribution instructions
    - Create root README.md with project overview and architecture
    - _Requirements: All_
  
  - [ ] 13.2 Create package.json scripts
    - Add backend scripts: start, dev, test, test:watch
    - Add frontend scripts: dev, build, preview, test
    - Add Electron scripts: start, build, package
    - Add root scripts to run all projects concurrently
    - _Requirements: All_
  
  - [ ] 13.3 Verify all components work together
    - Test backend server starts and connects to database
    - Test frontend connects to backend API
    - Test Electron app launches and loads frontend
    - Test sync service runs in Electron app
    - _Requirements: All_

- [ ] 14. Final checkpoint - Complete system verification
  - Run all tests (backend, frontend, Electron) and ensure they pass
  - Start all three applications and verify they work together
  - Test health check endpoint
  - Test database connections (platform and company)
  - Test Electron sync service
  - Ask the user if questions arise or if ready for next module

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The implementation follows a bottom-up approach: backend → frontend → Electron
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples, edge cases, and integration points
- All code uses ES6 module syntax (import/export)
- Security best practices are followed throughout (context isolation, no hardcoded secrets, password hashing)
