# Google OAuth Implementation Guide

## Overview

This document explains the Google OAuth 2.0 implementation for RestaurantOS, allowing users to sign in with their Google accounts.

## Architecture

### Frontend Flow
1. User clicks "Sign in with Google" button
2. Google OAuth popup opens
3. User authenticates with Google
4. Google returns access token
5. Frontend sends access token to backend
6. Backend verifies token with Google API
7. Backend returns JWT token for app authentication

### Backend Flow
1. Receives Google access token from frontend
2. Verifies token by fetching user info from Google API
3. Checks if user exists in database
4. If user exists: logs them in
5. If user doesn't exist: returns 404 with user info for registration
6. Returns JWT token and refresh token

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure OAuth consent screen:
   - App name: RestaurantOS
   - User support email: your-email@example.com
   - Developer contact: your-email@example.com
6. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: RestaurantOS Web Client
   - Authorized JavaScript origins:
     - `http://localhost:5173` (development)
     - `https://yourdomain.com` (production)
   - Authorized redirect URIs:
     - `http://localhost:5173` (development)
     - `https://yourdomain.com` (production)
7. Copy Client ID and Client Secret

### 2. Backend Configuration

Update `backend/.env`:

```env
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

### 3. Frontend Configuration

Update `frontend/.env`:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

Or update `frontend/src/lib/config.ts` directly:

```typescript
export const GOOGLE_CLIENT_ID = 'your-client-id-here.apps.googleusercontent.com';
```

## Implementation Details

### Frontend Components

#### 1. GoogleOAuthProvider Wrapper (`frontend/src/main.tsx`)

```typescript
import { GoogleOAuthProvider } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID } from './lib/config';

<GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
  <App />
</GoogleOAuthProvider>
```

#### 2. Google Login Hook (`frontend/src/pages/Auth.tsx`)

```typescript
const handleGoogleLogin = useGoogleLogin({
  onSuccess: async (tokenResponse) => {
    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenResponse.access_token}`,
      },
    });
    
    const userInfo = await userInfoResponse.json();
    
    // Send to backend for verification
    const response = await authServices.googleLogin(tokenResponse.access_token);
    
    // Store tokens and redirect
    sessionStorage.setItem('token', response.data.data.token);
    sessionStorage.setItem('user', JSON.stringify(response.data.data.user));
    navigate('/dashboard');
  },
  onError: () => {
    setError('Google login failed');
  },
});
```

### Backend Implementation

#### 1. Google Login Controller (`backend/src/controllers/authController.js`)

```javascript
export const googleLogin = async (req, res, next) => {
  try {
    const { token: accessToken } = req.body;

    // Verify access token by fetching user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userInfo = await userInfoResponse.json();
    const { sub: googleId, email, name, picture } = userInfo;

    // Find or create user
    let user = await CompanyUser.findOne({ $or: [{ email }, { googleId }] });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found. Please register your company first.',
      });
    }

    // Generate JWT tokens
    const token = generateToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    res.json({
      success: true,
      data: { user, token, refreshToken },
    });
  } catch (error) {
    next(error);
  }
};
```

#### 2. Route Configuration (`backend/src/routes/authRoutes.js`)

```javascript
router.post('/google', [
  body('token').notEmpty().withMessage('Google token is required'),
  validate,
], googleLogin);
```

## API Endpoints

### POST /api/auth/google

Authenticate user with Google OAuth access token.

**Request Body:**
```json
{
  "token": "google-access-token-here"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Google login successful",
  "data": {
    "user": {
      "id": "user-id",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "company_super_admin_primary",
      "companyId": "COMP001",
      "profilePicture": "https://..."
    },
    "token": "jwt-token",
    "refreshToken": "refresh-token"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "No account found. Please register your company first.",
  "data": {
    "googleId": "google-user-id",
    "email": "john@example.com",
    "name": "John Doe",
    "picture": "https://..."
  }
}
```

## User Flow

### First-Time User (Registration Required)

1. User clicks "Sign in with Google"
2. Google authentication completes
3. Backend returns 404 (user not found)
4. Frontend switches to registration form
5. Pre-fills name and email from Google
6. User completes company information
7. User submits registration
8. Account created and user logged in

### Existing User (Direct Login)

1. User clicks "Sign in with Google"
2. Google authentication completes
3. Backend verifies user exists
4. Backend returns JWT tokens
5. User redirected to dashboard

## Security Considerations

1. **Token Verification**: Access tokens are verified by fetching user info from Google's API
2. **HTTPS Only**: Production must use HTTPS for OAuth
3. **Token Storage**: JWT tokens stored in sessionStorage (cleared on browser close)
4. **Refresh Tokens**: Stored in database with expiration tracking
5. **Account Linking**: Google ID linked to existing email accounts
6. **Subscription Check**: Verifies company subscription status before login

## Testing

### Development Testing

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Navigate to `http://localhost:5173/auth?mode=login`
4. Click "Sign in with Google"
5. Authenticate with Google account
6. Verify successful login or registration prompt

### Production Testing

1. Update OAuth credentials with production URLs
2. Deploy backend and frontend
3. Test with real Google accounts
4. Verify HTTPS connections
5. Test error scenarios (cancelled login, network errors)

## Troubleshooting

### "Invalid Google token" Error

- Check that GOOGLE_CLIENT_ID matches in frontend and backend
- Verify OAuth consent screen is published
- Ensure authorized origins are correctly configured

### "No account found" Error

- This is expected for new users
- User should complete registration form
- After registration, Google login will work

### CORS Errors

- Add frontend URL to backend CORS configuration
- Verify authorized origins in Google Cloud Console

### Token Expiration

- Access tokens expire after 1 hour
- Implement refresh token flow for long sessions
- Re-authenticate with Google if needed

## Dependencies

### Frontend
- `@react-oauth/google`: ^0.12.1
- `framer-motion`: ^11.0.0

### Backend
- `google-auth-library`: ^9.0.0
- `jsonwebtoken`: ^9.0.2

## Environment Variables

### Backend (.env)
```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
JWT_SECRET=your-jwt-secret
JWT_EXPIRE=7d
```

### Frontend (.env)
```env
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_API_BASE_URL=http://localhost:5000
```

## Current Configuration

The application is currently configured with:
- **Client ID**: `140715848718-0scehakngdbco0cdmb8m1p7f3h20em08.apps.googleusercontent.com`
- **Authorized Origins**: `http://localhost:5173`
- **Backend URL**: `http://localhost:5000`

⚠️ **Important**: Update these credentials before deploying to production!

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [@react-oauth/google Documentation](https://www.npmjs.com/package/@react-oauth/google)
- [Google Cloud Console](https://console.cloud.google.com/)
