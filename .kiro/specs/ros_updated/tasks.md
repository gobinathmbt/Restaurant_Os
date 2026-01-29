# Implementation Plan: Restaurant Operating System (ROS)

## Overview

This implementation plan breaks down the ROS system into discrete, manageable coding tasks. The plan follows a modular approach, implementing Module 0 (Project Setup & Infrastructure) and Module 1 (Authentication & Authorization) as specified in the requirements and design documents.

The implementation strategy prioritizes:
1. Backend infrastructure and database setup
2. Authentication and authorization system
3. Frontend foundation and authentication UI
4. Integration and testing
5. Electron desktop application setup

Each task builds incrementally on previous work, with checkpoints to ensure stability before proceeding.

---

## Tasks

- [ ] 1. Set up backend project structure and core infrastructure
  - Create backend folder structure with MVC pattern
  - Initialize package.json with required dependencies (Express, Mongoose, JWT, bcrypt, etc.)
  - Create server.js with Express app initialization
  - Set up environment configuration files (.env.example, config/env.js)
  - Create database connection module with Platform DB connection
  - Implement error handling middleware
  - Create logger utility for structured logging
  - _Requirements: 0.1_

- [ ] 2. Implement Platform Database models
  - [ ] 2.1 Create PlatformAdmin model with password hashing
    - Define schema with name, email, password, role, isActive fields
    - Implement pre-save hook for bcrypt password hashing
    - Add comparePassword method for password verification
    - _Requirements: 0.1, 1.1_

  - [ ] 2.2 Write property test for password hashing
    - **Property 11: Password Hashing Round-Trip**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ] 2.3 Create Company model with subscription management
    - Define schema with company details, database info, subscription fields
    - Add indexes on companyId, email, subscription.status
    - Implement validation for subscription status transitions
    - _Requirements: 0.1, 1.1_

  - [ ] 2.4 Create User model for initial company registration
    - Define schema for company_super_admin_primary role
    - Implement password hashing and comparison methods
    - Add unique index on email
    - _Requirements: 0.1, 1.1_

  - [ ] 2.5 Create EnvironmentConfig model with encryption
    - Define schema for environment variables storage
    - Implement pre-save hook for encrypting sensitive fields (JWT_SECRET, GOOGLE_CLIENT_SECRET)
    - Add getDecryptedConfig method using AES-256-CBC decryption
    - _Requirements: 0.1, 3.1, 3.2_

  - [ ] 2.6 Write property test for environment config encryption
    - **Property 12: Environment Configuration Encryption Round-Trip**
    - **Validates: Requirements 3.1, 3.2**

  - [ ] 2.7 Create RefreshToken model
    - Define schema with userId, token, expiresAt, isRevoked fields
    - Add TTL index on expiresAt for automatic cleanup
    - _Requirements: 1.1_

- [ ] 3. Implement Company Database models
  - [ ] 3.1 Create CompanyUser schema for company databases
    - Define schema with role-based fields (company_super_admin, company_admin, employee)
    - Implement password hashing and comparison methods
    - Add compound unique index on email and companyId
    - Export as schema (not model) for per-company instantiation
    - _Requirements: 0.1, 1.1_

  - [ ] 3.2 Create CompanySettings model
    - Define schema for company-specific configurations
    - Include currency, timezone, GST, FSSAI, modules fields
    - _Requirements: 0.1_

- [ ] 4. Implement database connection management
  - [ ] 4.1 Enhance database.js with environment config loading
    - Implement loadEnvironmentConfigsFromDB function
    - Fetch EnvironmentConfig from Platform Admin Primary user
    - Decrypt sensitive configs and override process.env
    - Add fallback to .env file if DB config not found
    - _Requirements: 0.2, 3.1, 3.2_

  - [ ] 4.2 Write property test for environment config override
    - **Property 13: Environment Configuration Database Override**
    - **Validates: Requirements 0.2**

  - [ ] 4.3 Implement getCompanyDB function for dynamic connections
    - Create connection to company_<companyId> database
    - Implement connection pooling and caching
    - Return existing connection if already created
    - _Requirements: 0.3, 2.1_

  - [ ] 4.4 Write property test for company database connections
    - **Property 3: Company Database Connection Retrieval**
    - **Validates: Requirements 0.3**

- [ ] 5. Checkpoint - Verify database setup
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement authentication controller
  - [ ] 6.1 Create JWT token generation utilities
    - Implement generateToken function with userId payload
    - Implement generateRefreshToken function with 30-day expiry
    - Store refresh tokens in database
    - _Requirements: 1.3, 5.1, 5.2_

  - [ ] 6.2 Write property test for JWT token round-trip
    - **Property 7: JWT Token Round-Trip**
    - **Validates: Requirements 5.1, 5.2**

  - [ ] 6.3 Implement registerCompany controller function
    - Validate input data (email, password, company name, etc.)
    - Check for duplicate email
    - Generate unique companyId in format COMP_<timestamp>_<random>
    - Create user in Platform DB with company_super_admin_primary role
    - Create company record with trial subscription (30 days)
    - Create dedicated company database using getCompanyDB
    - Initialize CompanySettings in new database
    - Generate JWT tokens
    - Return user, company, and tokens
    - _Requirements: 1.1, 1.2, 2.1_

  - [ ] 6.4 Write property test for company registration
    - **Property 1: Company Registration Creates Complete Infrastructure**
    - **Validates: Requirements 1.1, 1.2, 2.1**

  - [ ] 6.5 Implement login controller function
    - Find user by email with password field
    - Verify user is active
    - Compare password using comparePassword method
    - Check company subscription status (not expired/suspended)
    - Generate JWT tokens
    - Return user data and tokens
    - _Requirements: 1.3_

  - [ ] 6.6 Write property test for valid authentication
    - **Property 4: Authentication with Valid Credentials**
    - **Validates: Requirements 1.3**

  - [ ] 6.7 Write property test for invalid authentication
    - **Property 5: Authentication Rejection for Invalid Credentials**
    - **Validates: Requirements 1.4, 1.5, 1.8**

  - [ ] 6.8 Implement googleLogin controller function
    - Verify Google token using OAuth2Client
    - Extract user profile (googleId, email, name, picture)
    - Find or create user with Google credentials
    - Update googleId and profilePicture if needed
    - Check company subscription status
    - Generate JWT tokens
    - Return user data and tokens
    - _Requirements: 1.6_

  - [ ] 6.9 Write property test for Google OAuth authentication
    - **Property 6: Google OAuth Authentication**
    - **Validates: Requirements 1.6**

  - [ ] 6.10 Implement getMe controller function
    - Fetch user by ID from req.user (set by auth middleware)
    - Fetch company details if user has companyId
    - Return user and company data
    - _Requirements: 1.7_

  - [ ] 6.11 Implement logout controller function
    - Mark refresh token as revoked in database
    - Return success response
    - _Requirements: 1.10_

  - [ ] 6.12 Write property test for refresh token revocation
    - **Property 10: Refresh Token Revocation**
    - **Validates: Requirements 1.10**

- [ ] 7. Implement authentication middleware
  - [ ] 7.1 Create authenticate middleware
    - Extract JWT token from Authorization header
    - Verify token using jwt.verify with JWT_SECRET
    - Fetch user from database
    - Check if user is active
    - Attach user info to req.user (userId, email, role, companyId, branchIds)
    - Return 401 if token invalid or user inactive
    - _Requirements: 1.7, 1.8_

  - [ ] 7.2 Write property test for JWT middleware authentication
    - **Property 8: JWT Middleware Authentication**
    - **Validates: Requirements 1.7**

  - [ ] 7.3 Create authorize middleware factory
    - Accept array of allowed roles as parameter
    - Check if req.user.role is in allowed roles
    - Return 403 if insufficient permissions
    - Call next() if authorized
    - _Requirements: 1.9_

  - [ ] 7.4 Write property test for role-based authorization
    - **Property 9: Role-Based Authorization**
    - **Validates: Requirements 1.9**

- [ ] 8. Create authentication routes
  - Define POST /api/auth/register-company route (public)
  - Define POST /api/auth/login route (public)
  - Define POST /api/auth/google route (public)
  - Define GET /api/auth/me route (protected with authenticate middleware)
  - Define POST /api/auth/logout route (protected with authenticate middleware)
  - Wire routes to controller functions
  - _Requirements: 1.1, 1.3, 1.6, 1.7, 1.10_

- [ ] 9. Update server.js with authentication routes
  - Import authRoutes
  - Mount routes at /api/auth
  - Ensure error handler is registered after routes
  - _Requirements: 0.1, 1.1_

- [ ] 10. Checkpoint - Verify backend authentication
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Set up frontend project structure
  - Create frontend folder with Vite + React
  - Initialize package.json with dependencies (React, React Router, Axios, Tailwind, Radix UI)
  - Configure Vite with path aliases (@/ for src/)
  - Set up Tailwind CSS with custom green/white/black theme
  - Create folder structure (api/, components/, pages/, context/, hooks/, lib/, styles/)
  - Create .env.example with VITE_API_BASE_URL and VITE_GOOGLE_CLIENT_ID
  - _Requirements: 0.2_

- [ ] 12. Implement frontend API layer
  - [ ] 12.1 Create Axios client with interceptors
    - Configure base URL from environment variable
    - Add request interceptor to attach JWT token from sessionStorage
    - Add response interceptor to handle 401 errors (clear auth and redirect)
    - Set default headers (Content-Type: application/json)
    - _Requirements: 0.2_

  - [ ] 12.2 Create authentication service functions
    - Implement login(email, password) API call
    - Implement registerCompany(data) API call
    - Implement googleLogin(googleToken) API call
    - Implement getMe() API call
    - Implement logout() API call
    - _Requirements: 1.1, 1.3, 1.6, 1.7, 1.10_

- [ ] 13. Implement authentication context
  - [ ] 13.1 Create AuthContext with state management
    - Define state: user, company, loading, isAuthenticated
    - Implement login method (call API, store tokens, update state)
    - Implement googleLogin method (call API, store tokens, update state)
    - Implement register method (call API, store tokens, update state)
    - Implement logout method (call API, clear sessionStorage, reset state)
    - Implement checkAuth method (verify token, fetch user data)
    - Call checkAuth on context initialization
    - _Requirements: 1.1, 1.3, 1.6, 1.7, 1.10, 6.1, 6.2, 6.3, 6.4_

  - [ ] 13.2 Write property test for frontend auth state management
    - **Property 15: Frontend Authentication State Management**
    - **Validates: Requirements 6.1, 6.2**

  - [ ] 13.3 Write property test for frontend auth check
    - **Property 16: Frontend Authentication Check**
    - **Validates: Requirements 6.3, 6.4**

- [ ] 14. Create landing page component
  - Design hero section with ROS branding and value proposition
  - Add features section with icons and descriptions
  - Create pricing section showing ₹3,999/month plan with 30-day trial
  - Add testimonials section
  - Implement CTA sections with "Start Free Trial" buttons
  - Create footer with links
  - Add navigation header with Login and Register buttons
  - Style with Tailwind CSS using green/white/black theme
  - _Requirements: 0.2_

- [ ] 15. Create authentication page component
  - [ ] 15.1 Implement login form
    - Create form with email and password fields
    - Add Google OAuth button
    - Implement form validation
    - Call AuthContext.login on submit
    - Display error messages
    - Add link to switch to register mode
    - _Requirements: 1.3, 1.6_

  - [ ] 15.2 Implement registration form
    - Create form with admin name, email, password, company details
    - Add fields for phone, address, GST, FSSAI (optional)
    - Add Google OAuth button
    - Implement form validation
    - Call AuthContext.register on submit
    - Display error messages
    - Add link to switch to login mode
    - _Requirements: 1.1, 1.6_

  - [ ] 15.3 Create responsive layout (70% left branding, 30% right form)
    - Left side: Green gradient background with ROS branding and features
    - Right side: White background with form
    - Mobile: Stack vertically
    - _Requirements: 0.2_

- [ ] 16. Create layout components
  - [ ] 16.1 Create PlatformAdminLayout component
    - Dark theme with platform branding
    - Sidebar navigation with platform-specific menu items
    - Header with user profile and logout
    - Main content area
    - _Requirements: 0.2_

  - [ ] 16.2 Create CompanyUserLayout component
    - Green/white/black theme
    - Sidebar navigation with company-specific menu items
    - Branch selector (if multi-branch)
    - Header with user profile and logout
    - Main content area
    - _Requirements: 0.2_

  - [ ] 16.3 Implement layout selection logic
    - Check user.role in AuthContext
    - Render PlatformAdminLayout if platform_super_admin
    - Render CompanyUserLayout for all company roles
    - _Requirements: 7.1, 7.2_

- [ ] 17. Create protected route component
  - [ ] 17.1 Implement ProtectedRoute wrapper
    - Check isAuthenticated from AuthContext
    - Redirect to /login if not authenticated
    - Check user.role against allowedRoles prop
    - Show 403 error if insufficient permissions
    - Render children if authorized
    - _Requirements: 8.1, 8.2_

  - [ ] 17.2 Write property test for protected route authentication
    - **Property 14: Protected Route Authentication Check**
    - **Validates: Requirements 8.1, 8.2**

- [ ] 18. Set up React Router with routes
  - Wrap app with AuthProvider
  - Define route for / (Landing page)
  - Define route for /login (Auth page in login mode)
  - Define route for /register (Auth page in register mode)
  - Define route for /dashboard (Protected, renders appropriate layout)
  - Implement route guards using ProtectedRoute
  - _Requirements: 0.2, 8.1, 8.2_

- [ ] 19. Checkpoint - Verify frontend authentication
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Set up Electron desktop application
  - [ ] 20.1 Create Electron project structure
    - Initialize package.json with Electron dependencies
    - Create src/main/main.js with BrowserWindow setup
    - Create src/main/preload.js with context bridge
    - Configure Electron to load React app (dev: localhost:5173, prod: local file)
    - _Requirements: 0.3_

  - [ ] 20.2 Implement local MongoDB setup
    - Create src/main/localDB.js for local database connection
    - Configure local MongoDB instance for offline storage
    - Implement data sync logic (every 5 minutes)
    - Add IPC handlers for sync operations
    - _Requirements: 0.3_

  - [ ] 20.3 Configure Electron builder
    - Create electron-builder.json configuration
    - Set up build scripts for Windows, macOS, Linux
    - Configure app icons and metadata
    - _Requirements: 0.3_

- [ ] 21. Implement data isolation tests
  - [ ] 21.1 Write property test for company database isolation
    - **Property 2: Company Database Isolation**
    - **Validates: Requirements 2.2, 2.3**

- [ ] 22. Write integration tests for authentication flow
  - [ ] 22.1 Test complete registration flow
    - Register company → Verify user created → Verify company created → Verify database created → Verify trial activated
    - _Requirements: 1.1, 1.2, 2.1_

  - [ ] 22.2 Test complete login flow
    - Login with valid credentials → Verify tokens returned → Verify user data returned
    - _Requirements: 1.3_

  - [ ] 22.3 Test authentication error scenarios
    - Login with invalid email → Verify 401
    - Login with wrong password → Verify 401
    - Login with expired subscription → Verify 403
    - Access protected route without token → Verify 401
    - Access protected route with invalid role → Verify 403
    - _Requirements: 1.4, 1.5, 1.8, 1.9, 8.1, 8.2_

- [ ] 23. Final checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- All authentication flows include proper error handling
- Database isolation is enforced at the architecture level
- Frontend uses sessionStorage for token management (can be upgraded to httpOnly cookies later)
- Electron app provides offline-first experience with automatic sync
