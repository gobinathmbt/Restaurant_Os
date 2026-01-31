# Backend Scripts

This folder contains utility scripts for managing the RestaurantOS platform.

## Available Scripts

### 1. Create Platform Admin
**File:** `create-platform-admin.js`

Creates a new platform administrator account.

**Usage:**
```bash
node scripts/create-platform-admin.js
```

**Configuration:**
Edit the `adminData` object in the script before running:

```javascript
const adminData = {
  name: 'Platform Admin',
  email: 'admin@restaurantos.com',
  password: 'Admin@123', // Change this!
  platformAdminPrimary: true, // true for primary admin
  permissions: [
    'manage_companies',
    'manage_subscriptions',
    'manage_platform_config',
    'view_analytics',
    'manage_admins',
  ],
};
```

**Primary vs Secondary Admins:**
- **Primary Admin** (`platformAdminPrimary: true`):
  - Full access to all platform features
  - Can add/remove other platform admins
  - Permissions array is ignored (has all permissions)

- **Secondary Admin** (`platformAdminPrimary: false`):
  - Access based on permissions array
  - Cannot add other platform admins
  - Limited to assigned permissions

**Available Permissions:**
- `manage_companies` - Create, update, delete companies
- `manage_subscriptions` - Manage company subscriptions
- `manage_platform_config` - Configure platform settings
- `view_analytics` - View platform analytics
- `manage_admins` - Add/remove platform admins (requires primary admin)

### 2. Seed Platform Config
**File:** `seed-platform-config.js`

Seeds initial platform configuration data.

**Usage:**
```bash
node scripts/seed-platform-config.js
```

### 3. Seed Platform Configurations
**File:** `seed-platform-configs.js`

Populates the PlatformConfig collection with initial configuration values for authentication, payment, email, storage (AWS S3), SMS, and notifications.

**Usage:**
```bash
node scripts/seed-platform-configs.js
```

**Configuration Categories:**
- **Authentication** - JWT secrets, Google OAuth credentials
- **Payment** - Razorpay, Cashfree API keys
- **Email** - SMTP server settings
- **Storage** - AWS S3 bucket configuration (bucket name, region, access keys, URL)
- **SMS** - SMS provider settings
- **Notification** - WhatsApp, Push notification keys

**Features:**
- Automatically reads from environment variables
- Skips existing configurations (safe to run multiple times)
- Marks sensitive values as secret (masked in UI)
- Provides summary of configurations by category

**Example Output:**
```
✅ Created configuration: JWT_SECRET
✅ Created configuration: AWS_S3_BUCKET
✅ Created configuration: AWS_S3_REGION
✅ Created configuration: AWS_ACCESS_KEY_ID
...
Configuration Summary:
  auth: 5 total, 5 active
  payment: 4 total, 2 active
  email: 6 total, 6 active
  storage: 5 total, 5 active
  sms: 3 total, 0 active
  notification: 3 total, 0 active
```

### 4. Verify Database Indexes
**File:** `verify-indexes.js`

Verifies that all database indexes are created correctly.

**Usage:**
```bash
node scripts/verify-indexes.js
```

**What it checks:**
- Company: 9 indexes
- CompanyUser: 11 indexes
- PlatformAdmin: 8 indexes
- PlatformConfig: 7 indexes
- RefreshToken: 8 indexes (including TTL)

**Output:**
```
=================================
Database Index Verification
=================================

📊 Company Model:
   Expected: 9 indexes
   Found: 9 indexes
   Status: ✅ PASS

👥 CompanyUser Model:
   Expected: 11 indexes
   Found: 11 indexes
   Status: ✅ PASS

... (and so on)

✅ All indexes verified successfully!
```

## Creating New Scripts

When creating new scripts:

1. Use ES6 modules (import/export)
2. Connect to database using `ENV.MONGODB_URI`
3. Use the logger utility for consistent logging
4. Always handle errors and exit gracefully
5. Add documentation in this README

**Template:**
```javascript
import mongoose from 'mongoose';
import { ENV } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';

async function myScript() {
  try {
    await mongoose.connect(ENV.MONGODB_URI);
    logger.info('Connected to database');

    // Your script logic here

    logger.info('Script completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Script error:', error);
    process.exit(1);
  }
}

myScript();
```

## Running Scripts

### Prerequisites
- Node.js installed
- MongoDB running
- Environment variables configured in `.env`

### Steps
1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Ensure dependencies are installed:
   ```bash
   npm install
   ```

3. Run the script:
   ```bash
   node scripts/script-name.js
   ```

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit credentials** - Always change default passwords
2. **Use strong passwords** - Minimum 8 characters with mixed case, numbers, and symbols
3. **Limit permissions** - Only grant necessary permissions to secondary admins
4. **Audit regularly** - Review admin accounts and permissions periodically
5. **Rotate passwords** - Change passwords regularly, especially for primary admins

## Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED
```
**Solution:** Ensure MongoDB is running and `MONGODB_URI` in `.env` is correct.

### Module Not Found Error
```
Error: Cannot find module
```
**Solution:** Run `npm install` in the backend directory.

### Permission Denied
```
Error: EACCES: permission denied
```
**Solution:** Check file permissions or run with appropriate privileges.

## Future Scripts

Planned scripts for future implementation:
- `migrate-data.js` - Data migration utility
- `backup-database.js` - Database backup script
- `cleanup-old-data.js` - Clean up old records
- `generate-reports.js` - Generate platform reports
- `reset-trial.js` - Reset trial period for testing
