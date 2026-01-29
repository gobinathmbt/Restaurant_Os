# Restaurant Operating System (ROS) - Complete Module Documentation

## Document Overview

This document provides comprehensive module-by-module specifications for the Restaurant Operating System (ROS). Each module includes detailed requirements, database schemas, API specifications, frontend components, and business logic to enable systematic full-stack development.

**Document Purpose:**
- Serve as the single source of truth for ROS development
- Provide clear specifications for each module from backend to frontend
- Enable modular, independent development of features
- Maintain consistency across the entire application

---

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Language**: JavaScript (ES6+)
- **Framework**: Express.js
- **Architecture**: MVC (Model-View-Controller)
- **Database**: MongoDB
- **Authentication**: JWT with Google OAuth
- **Real-time**: Socket.IO
- **File Structure**: Standard MVC with .js files

### Frontend
- **Framework**: React with Vite
- **Styling**: Tailwind CSS
- **Components**: Radix UI
- **Theme**: Green, White, and Black
- **State Management**: Context API / Zustand
- **API Layer**: Axios with service pattern

### Desktop Application
- **Framework**: Electron
- **Local Storage**: Local MongoDB instance
- **Sync**: Bidirectional with server every 5 minutes

### Database Architecture

#### Platform Database (Separate)
- **Purpose**: Stores platform-level data and metadata
- **Contains**:
  - Platform Super Admin users (separate table)
  - Company registry and metadata
  - Subscription management
  - Platform-wide configurations
- **Database Name**: `ros_platform`
- **Access**: Only Platform Super Admins have access

#### Company Databases (Separate per Company)
- **Purpose**: Each company gets a dedicated isolated database
- **Contains**:
  - Company-specific users (Company Super Admins, Admins, Employees)
  - All operational data (branches, menu, inventory, orders, etc.)
  - Company settings and configurations
- **Database Name Pattern**: `company_<companyId>`
- **Access**: Only users belonging to that company can access
- **Creation**: Automatically created during company registration

#### User Management Architecture
1. **Platform Super Admin**:
   - Stored in Platform Database
   - Has access to all companies
   - Manages subscriptions and platform settings
   - Separate authentication flow

2. **Company Users** (Super Admin, Admin, Employee):
   - Stored in respective Company Database
   - Can only access their own company data
   - Created within company context
   - Separate authentication flow from platform admin

---

## Frontend Layout Architecture

### Layout Declaration Based on User Role

The frontend layout and navigation menu structure changes dynamically based on the logged-in user's role:

#### Platform Super Admin Layout
**Access**: Platform-level management interface

**Menu Structure**:
- Dashboard (Platform Overview)
  - Total companies registered
  - Active subscriptions
  - Revenue analytics
  - System health
- Companies Management
  - View all companies
  - Company details
  - Subscription management
  - Enable/disable companies
- Subscriptions & Billing
  - Subscription plans
  - Payment history
  - Invoice management
  - Grace period management
- Platform Settings
  - System configurations
  - Feature flags
  - Pricing management
  - Platform users
- Reports & Analytics
  - Platform-wide analytics
  - Revenue reports
  - Usage statistics
  - Growth metrics

**Layout Characteristics**:
- Dark theme with platform branding
- Full-width admin interface
- Advanced data tables and filters
- System monitoring widgets

#### Company User Layout (Super Admin, Admin, Employee)
**Access**: Company-specific operational interface

**Menu Structure**:
- Dashboard (Company Overview)
  - Today's sales
  - Active orders
  - Quick actions
  - Branch performance
- Billing & POS
  - New order
  - Order history
  - Invoice management
- Menu Management
  - Categories
  - Items
  - Modifiers
  - Pricing
- Inventory
  - Raw materials
  - Finished goods
  - Stock alerts
  - Purchase orders
- Staff Management
  - Employees
  - Attendance
  - Shifts
  - Roles & permissions
- Customers & CRM
  - Customer database
  - Loyalty programs
  - Feedback
- Reports & Analytics
  - Sales reports
  - Inventory reports
  - Staff performance
  - Financial reports
- Settings
  - Company profile
  - Branch management
  - Tax settings
  - Integrations
  - Subscription status

**Layout Characteristics**:
- Green, white, and black theme
- Sidebar navigation
- Role-based menu visibility
- Branch selector (if multi-branch)

### Application Entry Points

#### Website (Web Application)
**Landing Page**: Public marketing website
- Features showcase
- Pricing information
- Testimonials
- Contact information
- Login/Register buttons

**Flow**:
1. User visits website → Sees landing page
2. Clicks "Login" → Redirected to login page
3. After authentication → Redirected to appropriate dashboard based on role

#### Electron Desktop Application
**Landing Page**: Direct login screen (NO marketing pages)
- Immediate login form
- Company selection (if applicable)
- Offline mode indicator
- No marketing content

**Flow**:
1. User opens desktop app → Sees login screen directly
2. After authentication → Redirected to appropriate dashboard based on role
3. Offline mode → Works with local database, syncs when online

**Key Difference**:
- **Website**: Marketing landing page → Login → Dashboard
- **Electron App**: Login screen directly → Dashboard

---

## Module 0: Project Setup & Infrastructure

### 0.1 Backend Setup

#### Folder Structure
```
backend/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   ├── env.js
│   │   └── constants.js
│   ├── models/
│   │   └── [module models]
│   ├── controllers/
│   │   └── [module controllers]
│   ├── routes/
│   │   └── [module routes]
│   ├── middlewares/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── validation.js
│   ├── services/
│   │   └── [module services]
│   ├── utils/
│   │   ├── logger.js
│   │   └── helpers.js
│   └── app.js
├── .env
├── .env.example
├── package.json
└── server.js
```

#### Files to Create

**package.json**
```json
{
  "name": "ros-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "express-validator": "^7.0.1",
    "socket.io": "^4.6.0",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

**server.js**
```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectPlatformDB } from './src/config/database.js';
import { errorHandler } from './src/middlewares/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Connection
connectPlatformDB();

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'ROS Backend is running' });
});

// Routes will be imported here as modules are built
// app.use('/api/auth', authRoutes);

// Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

**src/config/database.js**
```javascript
import mongoose from 'mongoose';

// Platform Database Connection
export const connectPlatformDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.PLATFORM_DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ Platform Database Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// Dynamic Company Database Connection
export const getCompanyDB = (companyId) => {
  const dbName = `company_${companyId}`;
  const companyConnection = mongoose.createConnection(
    process.env.COMPANY_DB_BASE_URI.replace('<dbname>', dbName),
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  );
  return companyConnection;
};
```

**src/config/env.js**
```javascript
export const ENV = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  PLATFORM_DB_URI: process.env.PLATFORM_DB_URI,
  COMPANY_DB_BASE_URI: process.env.COMPANY_DB_BASE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
};
```

**.env.example**
```
# Server
PORT=5000
NODE_ENV=development

# Platform Database (stores company registry, subscriptions, platform settings)
PLATFORM_DB_URI=mongodb://localhost:27017/ros_platform

# Company Database Base URI (each company gets: company_<companyId>)
COMPANY_DB_BASE_URI=mongodb://localhost:27017/<dbname>

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_EXPIRE=7d

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

**src/middlewares/errorHandler.js**
```javascript
export const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
```

**src/utils/logger.js**
```javascript
export const logger = {
  info: (message, data = {}) => {
    console.log(`ℹ️  [INFO] ${message}`, data);
  },
  error: (message, error = {}) => {
    console.error(`❌ [ERROR] ${message}`, error);
  },
  warn: (message, data = {}) => {
    console.warn(`⚠️  [WARN] ${message}`, data);
  },
  debug: (message, data = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🐛 [DEBUG] ${message}`, data);
    }
  },
};
```

#### Platform Database Models

**src/models/platform/PlatformAdmin.js** (Platform DB - Separate table for Platform Super Admins)
```javascript
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const platformAdminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  role: {
    type: String,
    default: 'platform_super_admin',
    immutable: true,
  },
  profilePicture: String,
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: Date,
}, {
  timestamps: true,
});

// Hash password before saving
platformAdminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
platformAdminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('PlatformAdmin', platformAdminSchema);
```

**src/models/platform/Company.js** (Platform DB)
```javascript
import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
    unique: true,
  },
  companyName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: String,
  address: String,
  gstNumber: String,
  fssaiLicense: String,
  
  // Database Information
  databaseName: {
    type: String,
    required: true,
  },
  databaseConnectionString: String,
  
  // Subscription Details
  subscription: {
    status: {
      type: String,
      enum: ['trial', 'active', 'grace_period', 'suspended', 'expired'],
      default: 'trial',
    },
    plan: {
      type: String,
      default: 'monthly', // ₹3,999/month
    },
    trialStartDate: Date,
    trialEndDate: Date,
    trialUsed: {
      type: Boolean,
      default: false,
    },
    subscriptionStartDate: Date,
    nextBillingDate: Date,
    autoRenewal: {
      type: Boolean,
      default: false,
    },
  },
  
  // Primary Admin (Company Super Admin)
  primaryAdmin: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    name: String,
    email: String,
  },
  
  // Modules Enabled
  modules: {
    billing: { type: Boolean, default: true },
    inventory: { type: Boolean, default: true },
    crm: { type: Boolean, default: false },
    integrations: { type: Boolean, default: false },
    loyalty: { type: Boolean, default: false },
    analytics: { type: Boolean, default: true },
    staffManagement: { type: Boolean, default: true },
    kds: { type: Boolean, default: false },
  },
  
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

export default mongoose.model('Company', companySchema);
```

**src/models/platform/User.js** (Platform DB - Only for initial company registration)
```javascript
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// This model is used ONLY during company registration to create the primary admin
// After registration, all company users are stored in their respective company databases
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    select: false,
  },
  
  // Google OAuth
  googleId: String,
  profilePicture: String,
  
  // Role
  role: {
    type: String,
    enum: ['company_super_admin_primary'],
    required: true,
  },
  
  // Company Reference
  companyId: {
    type: String,
    ref: 'Company',
    required: true,
  },
  
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
```

**src/models/company/CompanyUser.js** (Company DB - All company users stored here)
```javascript
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// This model is used in each company's database to store all company users
const companyUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
  },
  password: {
    type: String,
    select: false,
  },
  
  // Google OAuth
  googleId: String,
  profilePicture: String,
  
  // Role within company
  role: {
    type: String,
    enum: ['company_super_admin_primary', 'company_super_admin_secondary', 'company_admin', 'employee'],
    required: true,
  },
  
  // Company Reference
  companyId: {
    type: String,
    required: true,
  },
  
  // Branch Access (for company_admin and employee)
  branchIds: [{
    type: String,
  }],
  
  // Employee specific fields
  employeeCode: String,
  department: String,
  designation: String,
  joiningDate: Date,
  
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Create compound index for email uniqueness within company
companyUserSchema.index({ email: 1, companyId: 1 }, { unique: true });

// Hash password before saving
companyUserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
companyUserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default companyUserSchema; // Export schema, not model (will be created per company DB)
```

**src/models/platform/PlatformConfig.js** (Platform DB)
```javascript
import mongoose from 'mongoose';

const platformConfigSchema = new mongoose.Schema({
  configKey: {
    type: String,
    required: true,
    unique: true,
  },
  configValue: mongoose.Schema.Types.Mixed,
  description: String,
  category: {
    type: String,
    enum: ['subscription', 'pricing', 'features', 'system'],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

export default mongoose.model('PlatformConfig', platformConfigSchema);
```

---

### 0.2 Frontend Setup

#### Folder Structure
```
frontend/
├── public/
├── src/
│   ├── api/
│   │   ├── axios.js
│   │   └── services.js
│   ├── components/
│   │   ├── common/
│   │   ├── layout/
│   │   └── [module components]
│   ├── pages/
│   │   └── [module pages]
│   ├── context/
│   ├── hooks/
│   ├── lib/
│   │   ├── config.js
│   │   └── utils.js
│   ├── styles/
│   │   └── globals.css
│   ├── App.jsx
│   └── main.jsx
├── .env
├── .env.example
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

#### Files to Create

**package.json**
```json
{
  "name": "ros-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.2",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "lucide-react": "^0.294.0",
    "zustand": "^4.4.7"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.3.6",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
```

**vite.config.js**
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
});
```

**tailwind.config.js**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e', // Main green
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        neutral: {
          950: '#0a0a0a', // Near black
        }
      },
    },
  },
  plugins: [],
}
```

**src/styles/globals.css**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary-green: #22c55e;
  --primary-black: #0a0a0a;
  --primary-white: #ffffff;
}

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background-color: var(--primary-white);
  color: var(--primary-black);
}

.theme-green {
  background-color: var(--primary-green);
  color: var(--primary-white);
}

.theme-black {
  background-color: var(--primary-black);
  color: var(--primary-white);
}

.theme-white {
  background-color: var(--primary-white);
  color: var(--primary-black);
}
```

**.env.example**
```
VITE_API_BASE_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

**src/lib/config.js**
```javascript
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
```

**src/api/axios.js**
```javascript
import axios from 'axios';
import { BASE_URL } from '@/lib/config';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || BASE_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

**src/api/services.js**
```javascript
import apiClient from './axios';

export const authServices = {
  // Login with email/password
  login: (email, password) =>
    apiClient.post('/api/auth/login', { email, password }),

  // Register new company
  registerCompany: (data) =>
    apiClient.post('/api/auth/register-company', data),

  // Google OAuth
  googleLogin: (googleToken) =>
    apiClient.post('/api/auth/google', { token: googleToken }),

  // Get current user
  getMe: () =>
    apiClient.get('/api/auth/me'),

  // Logout
  logout: () =>
    apiClient.post('/api/auth/logout'),
};
```

**src/main.jsx**
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**src/App.jsx**
```javascript
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<div>Landing Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/register" element={<div>Register Page</div>} />
      </Routes>
    </Router>
  );
}

export default App;
```

---

### 0.3 Electron Setup

#### Folder Structure
```
electron-app/
├── src/
│   ├── main/
│   │   ├── main.js
│   │   ├── preload.js
│   │   └── localDB.js
│   ├── renderer/
│   │   └── [React app from frontend]
│   └── shared/
│       └── constants.js
├── package.json
└── electron-builder.json
```

**package.json**
```json
{
  "name": "ros-desktop",
  "version": "1.0.0",
  "main": "src/main/main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder"
  },
  "dependencies": {
    "electron": "^28.0.0",
    "electron-store": "^8.1.0",
    "mongodb": "^6.3.0"
  },
  "devDependencies": {
    "electron-builder": "^24.9.1"
  }
}
```

**src/main/main.js**
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load React app (in dev: http://localhost:5173, in prod: local file)
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

**src/main/preload.js**
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // IPC methods will be added here
  syncData: () => ipcRenderer.invoke('sync-data'),
  getLocalData: (collection) => ipcRenderer.invoke('get-local-data', collection),
});
```

---

## Module 1: Authentication & Authorization

### Overview
This module handles user authentication (login/register), Google OAuth integration, JWT token management, and role-based access control.

### Backend Implementation

#### 1.1 Models

**src/models/platform/User.js** (Already created in setup)

**src/models/platform/RefreshToken.js**
```javascript
import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  isRevoked: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

export default mongoose.model('RefreshToken', refreshTokenSchema);
```

#### 1.2 Controllers

**src/controllers/authController.js**
```javascript
import User from '../models/platform/User.js';
import Company from '../models/platform/Company.js';
import RefreshToken from '../models/platform/RefreshToken.js';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { OAuth2Client } from 'google-auth-library';
import { getCompanyDB } from '../config/database.js';
import mongoose from 'mongoose';

const googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRE,
  });
};

// Generate Refresh Token
const generateRefreshToken = async (userId) => {
  const token = jwt.sign({ userId }, ENV.JWT_SECRET, { expiresIn: '30d' });
  
  await RefreshToken.create({
    userId,
    token,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  
  return token;
};

// Register Company (New Company Super Admin Primary)
export const registerCompany = async (req, res, next) => {
  try {
    const {
      companyName,
      email,
      password,
      phone,
      address,
      gstNumber,
      fssaiLicense,
      adminName,
    } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Generate unique company ID
    const companyId = `COMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const databaseName = `company_${companyId}`;

    // Create user (Company Super Admin Primary)
    const user = await User.create({
      name: adminName,
      email,
      password,
      role: 'company_super_admin_primary',
      companyId,
    });

    // Create company entry
    const company = await Company.create({
      companyId,
      companyName,
      email,
      phone,
      address,
      gstNumber,
      fssaiLicense,
      databaseName,
      primaryAdmin: {
        userId: user._id,
        name: adminName,
        email,
      },
      subscription: {
        status: 'trial',
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        trialUsed: true,
      },
    });

    // Create dedicated company database and initialize collections
    const companyDB = getCompanyDB(companyId);
    
    // Create initial company settings in the new database
    const CompanySettings = companyDB.model('CompanySettings', new mongoose.Schema({
      companyId: String,
      companyName: String,
      currency: { type: String, default: 'INR' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      gstNumber: String,
      fssaiLicense: String,
      modules: Object,
      createdAt: { type: Date, default: Date.now },
    }));

    await CompanySettings.create({
      companyId,
      companyName,
      gstNumber,
      fssaiLicense,
      modules: company.modules,
    });

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    logger.info('Company registered successfully', { companyId, email });

    res.status(201).json({
      success: true,
      message: 'Company registered successfully. 30-day trial activated.',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
        },
        company: {
          id: company._id,
          companyId: company.companyId,
          companyName: company.companyName,
          subscription: company.subscription,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('Register company error', error);
    next(error);
  }
};

// Login with Email/Password
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user with password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
      });
    }

    // Verify password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check company subscription status (if not platform admin)
    if (user.role !== 'platform_super_admin' && user.companyId) {
      const company = await Company.findOne({ companyId: user.companyId });
      
      if (!company || !company.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Company account is inactive',
        });
      }

      if (company.subscription.status === 'suspended' || company.subscription.status === 'expired') {
        return res.status(403).json({
          success: false,
          message: 'Company subscription has expired. Please renew to continue.',
        });
      }
    }

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    logger.info('User logged in', { userId: user._id, email });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          branchIds: user.branchIds,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('Login error', error);
    next(error);
  }
};

// Google OAuth Login
export const googleLogin = async (req, res, next) => {
  try {
    const { token: googleToken } = req.body;

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: googleToken,
      audience: ENV.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Find or create user
    let user = await User.findOne({ $or: [{ email }, { googleId }] });

    if (!user) {
      // New user - need to register company first
      return res.status(404).json({
        success: false,
        message: 'No account found. Please register your company first.',
        data: {
          googleId,
          email,
          name,
          picture,
        },
      });
    }

    // Update Google ID if not set
    if (!user.googleId) {
      user.googleId = googleId;
      user.profilePicture = picture;
      await user.save();
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated',
      });
    }

    // Check company subscription
    if (user.role !== 'platform_super_admin' && user.companyId) {
      const company = await Company.findOne({ companyId: user.companyId });
      
      if (!company || !company.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Company account is inactive',
        });
      }

      if (company.subscription.status === 'suspended' || company.subscription.status === 'expired') {
        return res.status(403).json({
          success: false,
          message: 'Company subscription has expired',
        });
      }
    }

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    logger.info('Google login successful', { userId: user._id, email });

    res.json({
      success: true,
      message: 'Google login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          profilePicture: user.profilePicture,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('Google login error', error);
    next(error);
  }
};

// Get Current User (Me)
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get company details if user belongs to a company
    let company = null;
    if (user.companyId) {
      company = await Company.findOne({ companyId: user.companyId });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          branchIds: user.branchIds,
          profilePicture: user.profilePicture,
        },
        company: company ? {
          companyId: company.companyId,
          companyName: company.companyName,
          subscription: company.subscription,
          modules: company.modules,
        } : null,
      },
    });
  } catch (error) {
    logger.error('Get me error', error);
    next(error);
  }
};

// Logout
export const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await RefreshToken.updateOne(
        { token: refreshToken },
        { isRevoked: true }
      );
    }

    logger.info('User logged out', { userId: req.user.userId });

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error('Logout error', error);
    next(error);
  }
};
```

#### 1.3 Middlewares

**src/middlewares/auth.js**
```javascript
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import User from '../models/platform/User.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET);
    
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      branchIds: user.branchIds,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }
    next();
  };
};
```

#### 1.4 Routes

**src/routes/authRoutes.js**
```javascript
import express from 'express';
import {
  registerCompany,
  login,
  googleLogin,
  getMe,
  logout,
} from '../controllers/authController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Public routes
router.post('/register-company', registerCompany);
router.post('/login', login);
router.post('/google', googleLogin);

// Protected routes
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
```

#### 1.5 Update server.js
```javascript
// Add after database connection
import authRoutes from './src/routes/authRoutes.js';

// Routes
app.use('/api/auth', authRoutes);
```

---

### Frontend Implementation

#### 1.6 Context & State Management

**src/context/AuthContext.jsx**
```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authServices } from '@/api/services';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await authServices.getMe();
      setUser(response.data.data.user);
      setCompany(response.data.data.company);
      setIsAuthenticated(true);
    } catch (error) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await authServices.login(email, password);
    const { user, company, token, refreshToken } = response.data.data;
    
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('refreshToken', refreshToken);
    
    setUser(user);
    setCompany(company);
    setIsAuthenticated(true);
    
    return response.data;
  };

  const googleLogin = async (googleToken) => {
    const response = await authServices.googleLogin(googleToken);
    const { user, company, token, refreshToken } = response.data.data;
    
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('refreshToken', refreshToken);
    
    setUser(user);
    setCompany(company);
    setIsAuthenticated(true);
    
    return response.data;
  };

  const register = async (data) => {
    const response = await authServices.registerCompany(data);
    const { user, company, token, refreshToken } = response.data.data;
    
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('refreshToken', refreshToken);
    
    setUser(user);
    setCompany(company);
    setIsAuthenticated(true);
    
    return response.data;
  };

  const logout = async () => {
    const refreshToken = sessionStorage.getItem('refreshToken');
    
    try {
      await authServices.logout({ refreshToken });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    
    setUser(null);
    setCompany(null);
    setIsAuthenticated(false);
  };

  const value = {
    user,
    company,
    loading,
    isAuthenticated,
    login,
    googleLogin,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

#### 1.7 Landing Page

**src/pages/Landing.jsx**
```javascript
import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ShoppingCart, 
  Package, 
  Users, 
  TrendingUp, 
  Smartphone, 
  Shield,
  Clock,
  Heart,
  DollarSign,
  Zap
} from 'lucide-react';

const Landing = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-neutral-950">ROS</span>
            </div>
            
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-700 hover:text-primary-500 transition">Features</a>
              <a href="#pricing" className="text-gray-700 hover:text-primary-500 transition">Pricing</a>
              <a href="#about" className="text-gray-700 hover:text-primary-500 transition">About</a>
              <a href="#contact" className="text-gray-700 hover:text-primary-500 transition">Contact</a>
            </nav>

            <div className="flex items-center space-x-4">
              <Link 
                to="/login" 
                className="px-4 py-2 text-primary-500 hover:text-primary-600 transition font-medium"
              >
                Login
              </Link>
              <Link 
                to="/register" 
                className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition font-medium"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-neutral-950 mb-6">
            Complete Restaurant Management
            <span className="block text-primary-500">Made Simple</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Streamline your restaurant operations with our all-in-one platform. 
            From billing to inventory, we've got you covered.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Link 
              to="/register" 
              className="px-8 py-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition font-medium text-lg"
            >
              Start 30-Day Free Trial
            </Link>
            <a 
              href="#demo" 
              className="px-8 py-4 border-2 border-primary-500 text-primary-500 rounded-lg hover:bg-primary-50 transition font-medium text-lg"
            >
              Watch Demo
            </a>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            No credit card required • Cancel anytime • Then ₹3,999/month
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-neutral-950 mb-4">
              Everything You Need to Run Your Restaurant
            </h2>
            <p className="text-xl text-gray-600">
              Powerful features designed for modern restaurants
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-neutral-950 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-neutral-950 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600">
              Start with a free trial, then pay as you grow
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="bg-white border-2 border-primary-500 rounded-2xl p-8 shadow-lg">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-neutral-950 mb-2">Monthly Plan</h3>
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-bold text-primary-500">₹3,999</span>
                  <span className="text-gray-600 ml-2">/month</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">+ 18% GST (₹4,718.82 total)</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center">
                  <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-700">30-day free trial</span>
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-700">Unlimited transactions</span>
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-700">Multi-branch support</span>
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-700">All modules included</span>
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-700">24/7 customer support</span>
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-700">Regular updates</span>
                </div>
              </div>

              <Link 
                to="/register" 
                className="block w-full py-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition font-medium text-center text-lg"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-neutral-950 mb-4">
              Loved by Restaurant Owners
            </h2>
            <p className="text-xl text-gray-600">
              See what our customers have to say
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 mb-4">{testimonial.text}</p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary-100 rounded-full mr-3"></div>
                  <div>
                    <p className="font-semibold text-neutral-950">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.restaurant}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-500">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Restaurant?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join hundreds of restaurants already using ROS to streamline their operations
          </p>
          <Link 
            to="/register" 
            className="inline-block px-8 py-4 bg-white text-primary-500 rounded-lg hover:bg-gray-100 transition font-medium text-lg"
          >
            Start Your Free Trial Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-950 text-white py-12">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">ROS</span>
              </div>
              <p className="text-gray-400">
                The complete restaurant operating system for modern businesses.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
                <li><a href="#demo" className="hover:text-white transition">Demo</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#about" className="hover:text-white transition">About</a></li>
                <li><a href="#contact" className="hover:text-white transition">Contact</a></li>
                <li><a href="#" className="hover:text-white transition">Careers</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>&copy; 2026 Restaurant Operating System. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const features = [
  {
    icon: <ShoppingCart className="w-6 h-6 text-primary-500" />,
    title: "Smart Billing",
    description: "Fast, efficient POS system with offline support and multi-payment options"
  },
  {
    icon: <Package className="w-6 h-6 text-primary-500" />,
    title: "Inventory Management",
    description: "Track raw materials, finished goods, and get low-stock alerts automatically"
  },
  {
    icon: <Users className="w-6 h-6 text-primary-500" />,
    title: "Staff Management",
    description: "Attendance tracking, shift scheduling, and performance monitoring"
  },
  {
    icon: <TrendingUp className="w-6 h-6 text-primary-500" />,
    title: "Analytics & Reports",
    description: "Comprehensive insights on sales, inventory, and business performance"
  },
  {
    icon: <Smartphone className="w-6 h-6 text-primary-500" />,
    title: "Kitchen Display",
    description: "Real-time order management with KOT and KDS for efficient kitchen operations"
  },
  {
    icon: <Shield className="w-6 h-6 text-primary-500" />,
    title: "GST Compliance",
    description: "Automated tax calculations and GST-compliant invoicing"
  },
  {
    icon: <Clock className="w-6 h-6 text-primary-500" />,
    title: "Offline First",
    description: "Work without internet, sync automatically when online"
  },
  {
    icon: <Heart className="w-6 h-6 text-primary-500" />,
    title: "CRM & Loyalty",
    description: "Build customer relationships with loyalty programs and targeted campaigns"
  },
  {
    icon: <Zap className="w-6 h-6 text-primary-500" />,
    title: "Third-party Integration",
    description: "Seamless integration with Swiggy, Zomato, and payment gateways"
  },
];

const testimonials = [
  {
    text: "ROS has completely transformed how we manage our restaurant. The offline mode is a lifesaver!",
    name: "Rajesh Kumar",
    restaurant: "Spice Garden, Mumbai"
  },
  {
    text: "The inventory management alone is worth the subscription. We've reduced waste by 30%.",
    name: "Priya Sharma",
    restaurant: "Cafe Delight, Bangalore"
  },
  {
    text: "Easy to use, powerful features, and excellent support. Highly recommended!",
    name: "Amit Patel",
    restaurant: "Royal Dine, Delhi"
  },
];

export default Landing;
```

#### 1.8 Authentication Component

**src/pages/Auth.jsx**
```javascript
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Mail, Lock, User, Phone, Building, MapPin, FileText } from 'lucide-react';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, googleLogin, register } = useAuth();
  const navigate = useNavigate();

  // Login form state
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  });

  // Register form state
  const [registerData, setRegisterData] = useState({
    adminName: '',
    email: '',
    password: '',
    companyName: '',
    phone: '',
    address: '',
    gstNumber: '',
    fssaiLicense: '',
  });

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(loginData.email, loginData.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(registerData);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // This would integrate with Google OAuth
    // For now, showing placeholder
    setError('Google OAuth integration pending');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - 70% */}
      <div className="hidden lg:flex lg:w-[70%] bg-gradient-to-br from-primary-500 to-primary-700 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center space-x-2 mb-12">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
              <Building className="w-7 h-7 text-primary-500" />
            </div>
            <span className="text-3xl font-bold text-white">ROS</span>
          </div>

          <div className="max-w-xl">
            <h1 className="text-5xl font-bold text-white mb-6">
              {mode === 'login' ? 'Welcome Back!' : 'Start Your Journey'}
            </h1>
            <p className="text-xl text-white/90 mb-8">
              {mode === 'login' 
                ? 'Sign in to access your restaurant management dashboard' 
                : 'Register your restaurant and get 30 days free trial'}
            </p>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Offline-First Design</h3>
                  <p className="text-white/80">Work without internet, sync when online</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">All-in-One Platform</h3>
                  <p className="text-white/80">Billing, inventory, staff, analytics - everything included</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Multi-Branch Support</h3>
                  <p className="text-white/80">Manage multiple locations from one dashboard</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-white/60 text-sm">
          <p>&copy; 2026 Restaurant Operating System. All rights reserved.</p>
        </div>
      </div>

      {/* Right Side - 30% */}
      <div className="w-full lg:w-[30%] bg-white p-8 flex flex-col justify-center">
        <div className="max-w-md mx-auto w-full">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center space-x-2 mb-8">
            <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
              <Building className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-neutral-950">ROS</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-neutral-950 mb-2">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </h2>
            <p className="text-gray-600">
              {mode === 'login' 
                ? 'Enter your credentials to access your account' 
                : 'Start your 30-day free trial today'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition flex items-center justify-center space-x-2 mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>{mode === 'login' ? 'Sign in' : 'Sign up'} with Google</span>
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with email</span>
            </div>
          </div>

          {/* Login Form */}
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegisterSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={registerData.adminName}
                    onChange={(e) => setRegisterData({ ...registerData, adminName: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="you@restaurant.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Restaurant Name
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={registerData.companyName}
                    onChange={(e) => setRegisterData({ ...registerData, companyName: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="Your Restaurant"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={registerData.phone}
                    onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="+91 9876543210"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <textarea
                    value={registerData.address}
                    onChange={(e) => setRegisterData({ ...registerData, address: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                    placeholder="Restaurant address"
                    rows="2"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    GST Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={registerData.gstNumber}
                    onChange={(e) => setRegisterData({ ...registerData, gstNumber: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="GST Number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    FSSAI License (Optional)
                  </label>
                  <input
                    type="text"
                    value={registerData.fssaiLicense}
                    onChange={(e) => setRegisterData({ ...registerData, fssaiLicense: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="FSSAI License"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
              className="text-primary-500 hover:text-primary-600 font-medium"
            >
              {mode === 'login' 
                ? "Don't have an account? Sign up" 
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
```

#### 1.9 Update App.jsx
```javascript
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import Landing from '@/pages/Landing';
import Auth from '@/pages/Auth';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
```

---



