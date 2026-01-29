# Error Handling Fix - Google OAuth

## Issue

The Google OAuth error response had a nested structure that wasn't being properly accessed:

```json
{
  "message": "No account found. Please register your company first.",
  "status": 404,
  "data": {
    "success": false,
    "message": "No account found. Please register your company first.",
    "data": {
      "googleId": "111851488732434607337",
      "email": "gobinath@qrsolutions.in",
      "name": "Gobinath Selvamanikandan",
      "picture": "https://lh3.googleusercontent.com/..."
    }
  }
}
```

## Root Cause

The axios interceptor in `frontend/src/api/axios.ts` formats errors as:

```typescript
const formattedError = {
  message: error.response?.data?.message || error.message || 'An error occurred',
  status: error.response?.status,
  data: error.response?.data,  // This contains the full backend response
};
```

So the user data from Google is nested at `loginError.data.data` (not `loginError.response.data.data`).

## Solution

Updated the error handling in `handleGoogleLogin` to properly access the nested data:

### Before
```typescript
if (loginError.response?.status === 404) {
  setMode('register');
  setRegisterData({
    ...registerData,
    adminName: userInfo.name || '',
    email: userInfo.email || '',
  });
}
```

### After
```typescript
if (loginError.status === 404) {
  // Access the nested data from error response
  const errorData = loginError.data?.data;
  
  setMode('register');
  setRegisterData({
    ...registerData,
    adminName: errorData?.name || userInfo.name || '',
    email: errorData?.email || userInfo.email || '',
  });
}
```

## Benefits

1. **Proper Data Access**: Now correctly accesses user data from the error response
2. **Fallback Support**: Falls back to Google userInfo if error data is not available
3. **Better UX**: Pre-fills registration form with data from both sources

## Error Response Structure

### Axios Interceptor Format
```typescript
{
  message: string,      // Top-level error message
  status: number,       // HTTP status code
  data: {              // Full backend response
    success: boolean,
    message: string,
    data: {            // Actual data (user info for 404)
      googleId: string,
      email: string,
      name: string,
      picture: string
    }
  }
}
```

### Access Pattern
```typescript
loginError.status           // 404
loginError.message          // "No account found..."
loginError.data.data.email  // "gobinath@qrsolutions.in"
loginError.data.data.name   // "Gobinath Selvamanikandan"
```

## Testing

### Test Case: New Google User

1. Click "Sign in with Google"
2. Authenticate with Google account (not registered)
3. Backend returns 404 with user data
4. Frontend:
   - Detects 404 status
   - Extracts user data from `loginError.data.data`
   - Switches to registration mode
   - Pre-fills name and email
   - Shows toast: "Account Not Found - Please complete registration"

### Expected Behavior

✅ Registration form appears
✅ Name field pre-filled with Google name
✅ Email field pre-filled with Google email
✅ Toast notification shows
✅ User can complete registration

## Files Modified

1. `frontend/src/pages/Auth.tsx`
   - Fixed error status check: `loginError.status` instead of `loginError.response?.status`
   - Added proper data extraction: `loginError.data?.data`
   - Added fallback to `userInfo` if error data is missing

## Related Files

- `frontend/src/api/axios.ts` - Axios interceptor that formats errors
- `backend/src/controllers/authController.js` - Backend that returns 404 with user data

## Additional Notes

- The axios interceptor consistently formats all errors
- Always use `error.status` and `error.data` (not `error.response`)
- Backend 404 response includes user data for registration pre-fill
- This pattern applies to all API error handling in the app

---

**Status**: ✅ Fixed and Tested
**Last Updated**: January 29, 2026
