# Implementation Plan: Project Setup & Infrastructure (Updated)

## Overview

This implementation plan breaks down the Project Setup & Infrastructure module into discrete, incremental coding tasks. The approach follows a bottom-up strategy: establish the backend foundation first, then build the frontend, and finally integrate the Electron desktop application. Each task builds on previous work, ensuring no orphaned code.

**Key Architecture Changes:**
- **Separate User Tables**: Platform admins (PlatformAdmin) and company users (CompanyUser) are stored in separate collections
- **Database-Driven Configuration**: Most environment configuration is stored in PlatformConfig collection, loaded at runtime
- **Configuration Priority**: PlatformConfig DB > Environment Variables > Defaults
- **Two-Database Architecture**: Platform database for company registry and subscriptions, individual databases for each company's operational data

## Tasks

- [x] 1. Initialize backend project structure and dependencies
  - Create backend/ directory with MVC folder structure
  - Initialize package.json with type: "module" for ES6 imports
  - Install core dependencies: express, mongoose, bcryptjs, jsonwebtoken, dotenv, cors
  - Install middleware dependencies: express-validator
  - Install OAuth dependencies: passport, passport-google-oauth20, google-auth-library
  - Install dev dependencies: nodemon
  - Create .gitignore with node_modules, .env, logs
  - Create .env.example with documented template variables
  - Create directory structure: src/{config,models,controllers,routes,middlewares,services,utils}
  - _Requirements: 0.1, Module 0: Backend Setup_

- [x] 2. Implement backend core utilities
  - [x] 2.1 Create logger utility (src/utils/logger.js)
    - Implement info, error, warn, debug methods
    - Add emoji indicators for different log levels
    - Support NODE_ENV for conditional debug logging
    - _Requirements: 0.1, Logging_
  
  - [x] 2.2 Create helper utilities (src/utils/helpers.js)
    - Implement generateCompanyId() function
    - Implement generateDatabaseName() function
    - Add common utility functions
    - _Requirements: 0.1, Company Registration_
  
  - [x] 2.3 Create database configuration (src/config/database.js)
    - Implement connectPlatformDB() - connects to platform database
    - Implement getCompanyDB(companyId) - creates/returns company-specific connection
    - Add connection pooling and error handling
    - Add graceful shutdown handling
    - Use logger for connection status messages
    - _Requirements: 0.1, Module 0: Database Architecture_
  
  - [x] 2.4 Create environment configuration with database fallback (src/config/env.js)
    - Implement loadPlatformConfig() - loads config from PlatformConfig collection
    - Implement getConfig(key, envKey, defaultValue) - gets config with fallback chain
    - Implement initializeConfig() - loads runtime configuration after DB connection
    - Implement configuration caching with 5-minute TTL
    - Export ENV object with all configuration values
    - _Requirements: 0.1, Module 0: Database Architecture, Platform Config_

- [x] 3. Implement backend middleware
  - [x] 3.1 Create error handler middleware (src/middlewares/errorHandler.js)
    - Implement errorHandler middleware function
    - Format error responses with status code and message
    - Hide stack traces in production (show in development)
    - Log errors using logger utility
    - _Requirements: 0.1, Error Handling_
  
  - [x] 3.2 Create validation middleware (src/middlewares/validation.js)
    - Implement validation error formatter
    - Create common validation schemas (email, password, phone, etc.)
    - Export validation helpers for use in routes
    - _Requirements: 0.1, Input Validation_

- [x] 4. Implement platform database models
  - [x] 4.1 Create PlatformAdmin model (src/models/platform/PlatformAdmin.js)
    - Define schema: name, email, password, role (default: 'platform_super_admin'), permissions array, isActive, lastLogin
    - Implement pre-save hook for password hashing with bcrypt
    - Implement comparePassword() instance method
    - Implement toJSON() to exclude password from responses
    - Add timestamps: true
    - Add { select: false } to password field
    - _Requirements: Module 0: Platform Database Models, Authentication_
  
  - [x] 4.2 Create CompanyUser model (src/models/platform/CompanyUser.js)
    - Define schema: name, email, password, googleId, profilePicture, role (company roles only), companyId (required), branchIds array, isActive, lastLogin
    - Implement pre-save hook for password hashing
    - Implement comparePassword() instance method
    - Implement toJSON() to exclude password
    - Add role enum validation (no 'platform_super_admin')
    - Add required validation for companyId
    - Add timestamps: true
    - Add { select: false } to password field
    - _Requirements: Module 0: Platform Database Models, User Management_
  
  - [x] 4.3 Create Company model (src/models/platform/Company.js)
    - Define schema: companyId, companyName, email, phone, address, gstNumber, fssaiLicense
    - Add database info: databaseName, databaseConnectionString
    - Add subscription object with status, plan, dates, autoRenewal
    - Add primaryAdmin object referencing CompanyUser
    - Add modules object with boolean flags for each module
    - Add isActive field
    - Add timestamps: true
    - Add unique index on companyId and email
    - _Requirements: Module 0: Platform Database Models, Company Registration_
  
  - [x] 4.4 Create PlatformConfig model (src/models/platform/PlatformConfig.js)
    - Define schema: configKey (unique), configValue (Mixed type), description, category (enum), isSecret, isActive, lastModifiedBy
    - Add timestamps: true
    - Add unique index on configKey
    - Add comments documenting example configurations (JWT_SECRET, GOOGLE_CLIENT_ID, etc.)
    - _Requirements: Module 0: Platform Database Models, Configuration Management_
  
  - [x] 4.5 Create RefreshToken model (src/models/platform/RefreshToken.js)
    - Define schema: userId (ref to CompanyUser), token, expiresAt, isRevoked
    - Add timestamps: true
    - Add index on token for fast lookups
    - _Requirements: Module 1: Authentication, JWT Token Management_

- [x] 5. Implement authentication controller and routes
  - [x] 5.1 Create authentication controller (src/controllers/authController.js)
    - Implement registerCompany() - registers new company with primary admin (validate input, check email exists, generate companyId, create CompanyUser with role 'company_super_admin_primary', create Company entry with 30-day trial, create dedicated company database, initialize CompanySettings, generate JWT and refresh tokens, return user/company/tokens)
    - Implement login() - login with email/password (find user in CompanyUser collection, verify password, check isActive status, check company subscription status, generate tokens, update lastLogin, return user/tokens)
    - Implement googleLogin() - Google OAuth login (verify Google token, extract user info, find or return "need registration", update googleId/profilePicture, check account/subscription status, generate tokens, return user/tokens)
    - Implement getMe() - get current user info (find user by ID from JWT, get company details if user belongs to company, return user/company info)
    - Implement logout() - revoke refresh token (mark refresh token as revoked, log logout event)
    - Helper: generateToken(userId) - creates JWT
    - Helper: generateRefreshToken(userId) - creates and stores refresh token
    - _Requirements: Module 1: Authentication, Company Registration_
  
  - [x] 5.2 Create authentication middleware (src/middlewares/auth.js)
    - Implement authenticate() middleware (extract token from Authorization header, verify JWT token using ENV.JWT_SECRET, find user in CompanyUser collection, check if user exists and isActive, attach user info to req.user, handle token errors)
    - Implement authorize(...allowedRoles) middleware (check if req.user.role is in allowedRoles array, return 403 if not authorized)
    - _Requirements: Module 1: Authentication, Authorization_
  
  - [x] 5.3 Create authentication routes (src/routes/authRoutes.js)
    - Define POST /api/auth/register-company (public)
    - Define POST /api/auth/login (public)
    - Define POST /api/auth/google (public)
    - Define GET /api/auth/me (protected - requires authenticate)
    - Define POST /api/auth/logout (protected - requires authenticate)
    - Add validation middleware where needed
    - _Requirements: Module 1: Authentication Routes_

- [x] 6. Create main server file and setup
  - Create server.js as main entry point
  - Import and configure Express app
  - Load environment variables with dotenv
  - Configure middleware: cors, express.json, express.urlencoded
  - Implement startServer() async function (connect to platform database, initialize configuration from PlatformConfig, setup routes, add health check route GET /health, add error handler middleware must be last, start server on configured PORT)
  - Add graceful shutdown handling
  - Use logger for all status messages
  - _Requirements: 0.1, Module 0: Backend Setup_

- [x] 7. Create initial seed script (Optional)
  - Create backend/scripts/seed-platform-config.js
  - Implement script to populate PlatformConfig collection with initial values
  - Add default configs for: JWT_SECRET, JWT_EXPIRE, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
  - Make script idempotent (check if config exists before inserting)
  - Add script to package.json: "seed:config"
  - _Requirements: Platform Configuration Management_

- [x] 8. Checkpoint - Backend foundation complete
  - Verify server.js runs without errors
  - Verify platform database connection works
  - Verify all models are properly exported
  - Verify configuration loading works
  - Test health check endpoint manually: `curl http://localhost:5000/health`
  - Review code structure and organization
  - Ask the user if questions arise

- [x] 9. Initialize frontend project structure and dependencies
  - Create frontend/ directory
  - Initialize React project with Vite: `npm create vite@latest frontend -- --template react`
  - Install core dependencies: react, react-dom, react-router-dom
  - Install API dependencies: axios
  - Install UI dependencies: @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-select, @radix-ui/react-tabs, @radix-ui/react-toast
  - Install styling: tailwindcss, autoprefixer, postcss
  - Install icons: lucide-react
  - Install state management: zustand
  - Create .gitignore with node_modules, dist, .env
  - Create .env.example with VITE_API_BASE_URL, VITE_GOOGLE_CLIENT_ID
  - _Requirements: 0.2, Module 0: Frontend Setup_

- [x] 10. Configure frontend build tools and styling
  - [x] 10.1 Configure Vite (vite.config.js)
    - Add React plugin
    - Configure path aliases: '@' -> './src'
    - Set dev server port to 5173
    - Configure proxy for /api requests to backend (http://localhost:5000)
    - _Requirements: 0.2, Development Configuration_
  
  - [x] 10.2 Configure Tailwind CSS (tailwind.config.js, postcss.config.js)
    - Configure content paths: "./index.html", "./src/**/*.{js,jsx}"
    - Extend theme with custom green color palette (primary shades 50-900)
    - Add neutral-950 for near-black
    - Create postcss.config.js with tailwindcss and autoprefixer
    - Create src/styles/globals.css (add Tailwind directives, add CSS custom properties for colors, add utility classes: .theme-green, .theme-black, .theme-white)
    - _Requirements: 0.2, Design System_

- [x] 11. Create frontend configuration and utilities
  - [x] 11.1 Create configuration utilities (src/lib/config.js)
    - Export BASE_URL from VITE_API_BASE_URL env variable (default: http://localhost:5000)
    - Export GOOGLE_CLIENT_ID from VITE_GOOGLE_CLIENT_ID
    - Add other frontend configuration constants
    - _Requirements: 0.2, Configuration Management_
  
  - [x] 11.2 Create helper utilities (src/lib/utils.js)
    - Add cn() function for className merging (using clsx)
    - Add formatDate() helper
    - Add formatCurrency() helper
    - Add other common utility functions
    - _Requirements: 0.2, Utilities_

- [x] 12. Implement frontend API layer
  - [x] 12.1 Create Axios API client (src/api/axios.js)
    - Create Axios instance with BASE_URL and timeout
    - Add request interceptor to inject JWT token from sessionStorage
    - Add response interceptor for 401 errors (redirect to login, clear tokens)
    - Add response interceptor for error formatting
    - Export configured apiClient
    - _Requirements: 0.2, Module 1: API Layer_
  
  - [x] 12.2 Create auth service (src/api/services.js)
    - Export authServices object with methods: login(email, password) POST /api/auth/login, registerCompany(data) POST /api/auth/register-company, googleLogin(googleToken) POST /api/auth/google, getMe() GET /api/auth/me, logout() POST /api/auth/logout
    - All methods use apiClient from axios.js
    - _Requirements: 0.2, Module 1: API Services_

- [ ] 13. Create frontend auth context and app structure
  - [ ] 13.1 Create auth context (src/context/AuthContext.jsx)
    - Create AuthContext with createContext
    - Create AuthProvider component
    - Implement state: user, company, loading, isAuthenticated
    - Implement useEffect to check auth on mount (call authServices.getMe)
    - Implement login(email, password) method
    - Implement googleLogin(googleToken) method
    - Implement register(data) method
    - Implement logout() method
    - Store/clear tokens in sessionStorage
    - Export useAuth() custom hook
    - _Requirements: Module 1: State Management, Authentication_
  
  - [ ] 13.2 Create main app structure (src/main.jsx, src/App.jsx)
    - Create src/main.jsx as entry point (import React, ReactDOM, App, globals.css, render App wrapped in React.StrictMode)
    - Create src/App.jsx (wrap app with AuthProvider, set up BrowserRouter with Routes, define placeholder routes: /, /login, /register)
    - _Requirements: 0.2, Module 1: App Structure_

- [ ] 14. Checkpoint - Frontend foundation complete
  - Verify Vite dev server starts on port 5173
  - Verify Tailwind CSS is working (check styles)
  - Verify API client is configured
  - Verify Auth context is accessible
  - Test routing navigation
  - Ask the user if questions arise

- [ ] 15. Create frontend authentication UI pages
  - [ ] 15.1 Create landing page component (src/pages/Landing.jsx)
    - Implement header with logo, navigation (Features, Pricing, About, Contact), Login/Register buttons
    - Implement hero section with CTA buttons (Start Free Trial, Watch Demo)
    - Implement features section with grid of feature cards (use lucide-react icons)
    - Implement pricing section showing ₹3,999/month plan with benefits list
    - Implement testimonials section with customer quotes
    - Implement CTA section encouraging signup
    - Implement footer with links and company info
    - Use Tailwind CSS with green/white/black theme
    - Make responsive (mobile, tablet, desktop)
    - _Requirements: Module 1: Landing Page, UI/UX_
  
  - [ ] 15.2 Create authentication page component (src/pages/Auth.jsx)
    - Implement two-column layout: 70% left (green info section), 30% right (form section)
    - Left section: Company branding, benefits list, testimonials
    - Right section: Login/Register form switcher
    - Implement login form (email input with icon, password input with icon, Google OAuth button, submit button with loading state, link to switch to register mode)
    - Implement register form (admin name/email/password inputs, company name/phone/address inputs, GST number/FSSAI license inputs optional, Google OAuth button, submit button with loading state, link to switch to login mode)
    - Display error messages
    - Use useAuth hook for login/register/googleLogin
    - Redirect to /dashboard on success
    - Make responsive
    - _Requirements: Module 1: Authentication UI, Forms_
  
  - [ ] 15.3 Update app routes (src/App.jsx)
    - Import Landing and Auth pages
    - Define route: / -> Landing
    - Define route: /login -> Auth
    - Define route: /register -> Auth (with ?mode=register query param)
    - Add placeholder route: /dashboard -> "Dashboard Coming Soon"
    - _Requirements: Module 1: Routing_

- [ ] 16. Create protected route component (Optional)
  - Create src/components/ProtectedRoute.jsx
  - Check if user is authenticated using useAuth()
  - Show loading spinner while checking auth
  - Redirect to /login if not authenticated
  - Render children if authenticated
  - Wrap dashboard and other protected routes with ProtectedRoute
  - _Requirements: Module 1: Authorization_

- [ ] 17. Checkpoint - Authentication UI complete
  - Verify landing page displays correctly
  - Verify auth page switches between login/register modes
  - Verify form validation works
  - Test registration flow (creates company + user)
  - Test login flow (returns JWT token)
  - Test Google OAuth button (placeholder for now)
  - Verify auth state persists across page reloads
  - Verify logout clears tokens
  - Ask the user if questions arise

- [ ] 18. Initialize Electron project structure
  - Create electron-app/ directory
  - Initialize package.json with electron main entry point
  - Install dependencies: electron, electron-store
  - Install MongoDB driver: mongodb
  - Install dev dependencies: electron-builder
  - Create folder structure: src/main/, src/renderer/, src/shared/
  - Create .gitignore with node_modules, dist, build
  - _Requirements: 0.3, Module 0: Electron Setup_

- [ ] 19. Create Electron main process and preload script
  - [ ] 19.1 Create Electron main process (src/main/main.js)
    - Import electron modules: app, BrowserWindow, ipcMain
    - Implement createWindow() function (set window dimensions: 1280x720, configure webPreferences: preload script/contextIsolation: true/nodeIntegration: false/sandbox: true, load React app URL: dev http://localhost:5173/prod file path)
    - Register app.whenReady(), app.on('window-all-closed'), app.on('activate') handlers
    - _Requirements: 0.3, Module 0: Electron Main Process_
  
  - [ ] 19.2 Create preload script (src/main/preload.js)
    - Import contextBridge, ipcRenderer from electron
    - Expose electronAPI to window object
    - Add IPC methods: syncData(), getLocalData(collection), onSyncComplete(callback), onSyncError(callback)
    - _Requirements: 0.3, Module 0: Electron Preload Script_

- [ ] 20. Implement Electron local database and sync service
  - [ ] 20.1 Create local database utility (src/main/localDB.js)
    - Import mongodb
    - Implement connectLocalDB() - connects to local MongoDB instance
    - Implement getPendingChanges(collection) - retrieves unsynced changes
    - Implement markAsSynced(collection, ids) - marks records as synced
    - Implement getLastSyncTime() - retrieves last sync timestamp
    - Implement setLastSyncTime(timestamp) - updates last sync timestamp
    - Implement upsert(collection, data) - inserts or updates local records
    - Implement findById(collection, id) - retrieves record by ID
    - _Requirements: 0.3, Module 0: Electron Local Database_
  
  - [ ] 20.2 Create sync service (src/main/syncService.js)
    - Import localDB utilities and axios for API calls
    - Implement SyncService class with start(), stop(), performSync() methods
    - Implement start() - begins sync interval timer (every 5 minutes)
    - Implement stop() - clears sync interval timer
    - Implement performSync() - orchestrates upload and download
    - Implement uploadLocalChanges() - sends pending changes to server API
    - Implement downloadServerChanges() - fetches and applies server changes since last sync
    - Implement conflict resolution (server wins strategy)
    - Add comprehensive logging for sync operations
    - _Requirements: 0.3, Module 0: Electron Sync Service_
  
  - [ ] 20.3 Integrate sync service with main process
    - Initialize SyncService in main.js after window creation
    - Add IPC handler for 'sync-data' to trigger manual sync
    - Emit 'sync-complete' event to renderer on successful sync
    - Emit 'sync-error' event to renderer on sync failure
    - Start automatic sync service after user authentication
    - _Requirements: 0.3, Module 0: Electron Sync Integration_

- [ ] 21. Create environment configuration for all platforms
  - [ ] 21.1 Document backend environment variables
    - Update backend/.env.example with all required variables (PLATFORM_DB_URI, COMPANY_DB_BASE_URI, PORT, NODE_ENV, JWT_SECRET, JWT_EXPIRE, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
    - Add comments explaining each variable and PlatformConfig priority
    - Add validation for required environment variables in server.js
    - _Requirements: 0.1, Environment Configuration_
  
  - [ ] 21.2 Document frontend environment variables
    - Update frontend/.env.example with VITE_API_BASE_URL, VITE_GOOGLE_CLIENT_ID
    - Document environment-specific configurations
    - _Requirements: 0.2, Environment Configuration_
  
  - [ ] 21.3 Document Electron environment variables
    - Create electron-app/.env.example with LOCAL_DB_URI, API_BASE_URL
    - Document sync configuration and local storage paths
    - _Requirements: 0.3, Environment Configuration_

- [ ] 22. Create documentation and setup guides
  - [ ] 22.1 Create backend README
    - Document project structure and architecture
    - Add setup instructions (npm install, environment variables, database setup)
    - Add run instructions (npm run dev, npm start)
    - Document API endpoints
    - Add troubleshooting section
    - _Requirements: 0.1, Documentation_
  
  - [ ] 22.2 Create frontend README
    - Document project structure and component organization
    - Add setup instructions (npm install, environment variables)
    - Add run instructions (npm run dev, npm run build, npm run preview)
    - Document routing and state management
    - Add troubleshooting section
    - _Requirements: 0.2, Documentation_
  
  - [ ] 22.3 Create Electron README
    - Document project structure and IPC communication
    - Add setup instructions (npm install, local MongoDB setup)
    - Add run instructions (npm start, npm run build)
    - Document sync service and local storage
    - Add build and distribution instructions
    - Add troubleshooting section
    - _Requirements: 0.3, Documentation_
  
  - [ ] 22.4 Create root README
    - Provide project overview and architecture diagram
    - Document technology stack
    - Add getting started guide for all three platforms
    - Document database architecture (platform DB + company DBs)
    - Add contribution guidelines
    - _Requirements: All, Overview_

- [ ] 23. Create package.json scripts for development workflow
  - Add backend scripts: "start": "node server.js", "dev": "nodemon server.js", "seed:config": "node scripts/seed-platform-config.js"
  - Add frontend scripts: "dev": "vite", "build": "vite build", "preview": "vite preview"
  - Add Electron scripts: "start": "electron .", "build": "electron-builder", "dev": "electron . --dev"
  - Add root scripts to run all projects: "dev:backend": "cd backend && npm run dev", "dev:frontend": "cd frontend && npm run dev", "dev:electron": "cd electron-app && npm run dev", "dev:all": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\""
  - Install concurrently in root for parallel execution
  - _Requirements: All, Development Workflow_

- [ ] 24. Final integration testing and verification
  - [ ] 24.1 Test backend integration
    - Start backend server and verify health check endpoint responds
    - Test platform database connection
    - Test configuration loading from PlatformConfig collection
    - Test company registration flow end-to-end
    - Test login flow with email/password
    - Test JWT token generation and validation
    - Test company database creation
    - _Requirements: 0.1, Module 1: Backend_
  
  - [ ] 24.2 Test frontend integration
    - Start Vite dev server and verify it runs on port 5173
    - Test landing page displays correctly across devices
    - Test navigation between pages
    - Test registration form validation
    - Test registration flow creates user and redirects
    - Test login form validation
    - Test login flow authenticates and redirects
    - Test auth state persistence across page reloads
    - Test logout clears tokens and redirects
    - _Requirements: 0.2, Module 1: Frontend_
  
  - [ ] 24.3 Test Electron integration
    - Build and launch Electron app
    - Verify app window opens with correct dimensions
    - Test React app loads inside Electron window
    - Test local MongoDB connection
    - Test sync service starts automatically
    - Test manual sync trigger via IPC
    - Test data syncs between local and server
    - Test conflict resolution (server wins)
    - Test offline mode and sync when online
    - _Requirements: 0.3, Module 0: Electron_
  
  - [ ] 24.4 Test end-to-end workflow
    - Register new company via web interface
    - Verify company database created
    - Login to web app and verify dashboard access
    - Login to Electron app with same credentials
    - Create data in Electron app (offline)
    - Trigger sync and verify data appears on server
    - Create data on web app
    - Verify data syncs to Electron app
    - Test subscription trial period display
    - _Requirements: All, End-to-End_

- [ ] 25. Final checkpoint - Complete system verification
  - Run all manual tests and verify they pass
  - Start all three applications and verify they work together
  - Test health check endpoint: `curl http://localhost:5000/health`
  - Test database connections (platform and company)
  - Test Electron sync service
  - Review all code for consistency and best practices
  - Verify all documentation is complete and accurate
  - Ask the user if questions arise or if ready for next module

## Notes

- Each task builds incrementally on previous work
- Checkpoints ensure validation at key milestones before proceeding
- All code uses ES6 module syntax (import/export)
- Security best practices followed: context isolation, password hashing, JWT tokens, no hardcoded secrets
- Configuration priority: PlatformConfig DB > Environment Variables > Defaults
- Separate PlatformAdmin and CompanyUser collections for security and clarity
- Each company gets dedicated database created during registration
- All timestamps managed automatically by Mongoose