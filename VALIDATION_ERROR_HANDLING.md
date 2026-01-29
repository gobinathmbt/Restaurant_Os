# Validation Error Handling

## Overview

Proper handling of backend validation errors with user-friendly toast notifications.

## Backend Validation Error Structure

### Error Response Format
```json
{
  "message": "Validation failed",
  "status": 400,
  "data": {
    "success": false,
    "message": "Validation failed",
    "errors": [
      {
        "type": "field",
        "value": "",
        "msg": "Invalid GST number format",
        "path": "gstNumber",
        "location": "body"
      }
    ]
  }
}
```

### Error Object Properties
- `type`: Type of error (usually "field")
- `value`: The invalid value submitted
- `msg`: Human-readable error message
- `path`: Field name that failed validation
- `location`: Where the field was found (body, query, params)

## Frontend Error Handling

### Registration Form Validation

```typescript
catch (err: any) {
  console.log('Registration error:', err);
  
  // Check for validation errors from backend
  if (err.status === 400 && err.data?.errors && Array.isArray(err.data.errors)) {
    // Map validation errors to readable format
    const validationErrors = err.data.errors
      .map((error: any) => `${error.path}: ${error.msg}`)
      .join('\n');
    
    toast({
      title: "Validation Error",
      description: validationErrors,
      variant: "destructive",
    });
  } else {
    // General error
    const errorMessage = err.message || err.data?.message || 'Registration failed. Please try again.';
    
    toast({
      title: "Registration Failed",
      description: errorMessage,
      variant: "destructive",
    });
  }
}
```

### Error Display Format

**Single Error:**
```
Title: Validation Error
Description: gstNumber: Invalid GST number format
```

**Multiple Errors:**
```
Title: Validation Error
Description: 
gstNumber: Invalid GST number format
phone: Phone number must be 10 digits
email: Invalid email format
```

## Backend Validation Rules

### Required Fields
- `companyName`: 2-100 characters
- `email`: Valid email format
- `password`: Minimum 6 characters
- `adminName`: 2-100 characters

### Optional Fields
- `phone`: 10 digits (if provided)
- `gstNumber`: Valid GST format (if provided)
- `fssaiLicense`: Any string (if provided)
- `address`: Any string (if provided)

### GST Number Format
Pattern: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`

Example: `22AAAAA0000A1Z5`

Format:
- 2 digits (state code)
- 5 uppercase letters (PAN)
- 4 digits
- 1 uppercase letter
- 1 digit or uppercase letter
- Letter 'Z'
- 1 digit or uppercase letter

### Phone Number Format
Pattern: `^[0-9]{10}$`

Example: `9876543210`

## Backend Validation Fix

### Issue
The `optional()` validator was still checking format even for empty strings.

### Solution
Changed from:
```javascript
body('gstNumber')
  .optional()
  .trim()
  .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
  .withMessage('Invalid GST number format'),
```

To:
```javascript
body('gstNumber')
  .optional({ checkFalsy: true })  // Skip validation if empty/null/undefined
  .trim()
  .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
  .withMessage('Invalid GST number format'),
```

The `checkFalsy: true` option skips validation for:
- Empty strings (`""`)
- `null`
- `undefined`
- `false`
- `0`
- `NaN`

## Toast Notification Examples

### Success
```typescript
toast({
  title: "Registration Successful",
  description: "Your account has been created. 30-day trial activated!",
});
```

### Validation Error (Single)
```typescript
toast({
  title: "Validation Error",
  description: "gstNumber: Invalid GST number format",
  variant: "destructive",
});
```

### Validation Error (Multiple)
```typescript
toast({
  title: "Validation Error",
  description: "gstNumber: Invalid GST number format\nphone: Phone number must be 10 digits",
  variant: "destructive",
});
```

### General Error
```typescript
toast({
  title: "Registration Failed",
  description: "Email already registered",
  variant: "destructive",
});
```

## Error Handling Flow

```
User submits form
    ↓
Frontend validation (HTML5)
    ↓
API request to backend
    ↓
Backend validation (express-validator)
    ↓
┌─────────────────┐
│ Validation Pass │
└─────────────────┘
    ↓
Success response
    ↓
Toast: "Registration Successful"
    ↓
Redirect to dashboard

┌─────────────────┐
│ Validation Fail │
└─────────────────┘
    ↓
400 error with validation errors
    ↓
Frontend catches error
    ↓
Check if err.status === 400
    ↓
Extract err.data.errors array
    ↓
Map errors to readable format
    ↓
Toast: "Validation Error" with details
    ↓
User fixes errors and resubmits
```

## Testing

### Test Cases

1. **Empty GST Number (Optional)**
   - Leave GST field empty
   - Submit form
   - ✅ Should succeed (no validation error)

2. **Invalid GST Format**
   - Enter: "123456"
   - Submit form
   - ❌ Should show: "gstNumber: Invalid GST number format"

3. **Valid GST Format**
   - Enter: "22AAAAA0000A1Z5"
   - Submit form
   - ✅ Should succeed

4. **Invalid Phone Number**
   - Enter: "123"
   - Submit form
   - ❌ Should show: "phone: Phone number must be 10 digits"

5. **Multiple Validation Errors**
   - Invalid GST + Invalid Phone
   - Submit form
   - ❌ Should show both errors in toast

6. **Duplicate Email**
   - Use existing email
   - Submit form
   - ❌ Should show: "Email already registered"

## Files Modified

1. `frontend/src/pages/Auth.tsx`
   - Updated error handling to access `err.data.errors`
   - Map errors with field names
   - Display in multi-line toast

2. `backend/src/routes/authRoutes.js`
   - Added `checkFalsy: true` to optional fields
   - Ensures empty optional fields skip validation

## Best Practices

1. **Always log errors**: `console.log('Registration error:', err)`
2. **Check error structure**: Verify `err.status` and `err.data.errors`
3. **Provide context**: Include field name in error message
4. **Use multi-line**: Separate multiple errors with `\n`
5. **Fallback messages**: Always have a default error message

## Future Enhancements

1. Highlight invalid fields in the form
2. Show inline validation errors below fields
3. Add real-time validation as user types
4. Add field-specific error icons
5. Add "Fix All" button to scroll to first error

---

**Status**: ✅ Complete and Tested
**Last Updated**: January 29, 2026
