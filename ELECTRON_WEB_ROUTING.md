# Electron vs Web Routing

## Overview

The application now intelligently detects whether it's running in Electron or a web browser and adjusts the routing accordingly.

## Platform Detection

### Detection Methods

1. **Window.electron API Check**
   ```typescript
   if (typeof window !== 'undefined' && window.electron) {
     return true;
   }
   ```

2. **User Agent Check**
   ```typescript
   const userAgent = navigator.userAgent.toLowerCase();
   return userAgent.indexOf(' electron/') > -1;
   ```

### Platform Utility Functions

Located in `frontend/src/utils/platform.ts`:

```typescript
// Check if running in Electron
isElectron(): boolean

// Check if running in web browser
isWeb(): boolean

// Get platform type
getPlatform(): 'electron' | 'web'

// Get Electron API if available
getElectronAPI(): ElectronAPI | null

// Check if Electron API is available
hasElectronAPI(): boolean

// Get platform-specific configuration
getPlatformConfig(): PlatformConfig

// Log platform info for debugging
logPlatformInfo(): void
```

## Routing Behavior

### Web Browser (isWeb = true)

**Routes:**
```
/ → Landing Page (marketing page)
/auth → Auth Page (login/register)
/login → Redirect to /auth?mode=login
/register → Redirect to /auth?mode=register
/dashboard → Dashboard (protected)
```

**User Flow:**
1. User visits website
2. Sees landing page with features, pricing, testimonials
3. Clicks "Sign In" or "Get Started"
4. Redirected to Auth page
5. After login → Dashboard

### Electron App (isElectron = true)

**Routes:**
```
/ → Auth Page (login/register directly)
/dashboard → Dashboard (protected)
```

**User Flow:**
1. User opens Electron app
2. Sees Auth page immediately (no landing page)
3. Logs in or registers
4. After login → Dashboard

## Implementation

### App.tsx

```typescript
import { isElectron } from "@/utils/platform";

const App = () => {
  const isElectronApp = isElectron();

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page - Only for Web */}
        {!isElectronApp && <Route path="/" element={<Landing />} />}
        
        {/* Auth Page - Default for Electron, accessible for Web */}
        {isElectronApp ? (
          <Route path="/" element={<Auth />} />
        ) : (
          <Route path="/auth" element={<Auth />} />
        )}
        
        {/* Auth redirects for Web only */}
        {!isElectronApp && (
          <>
            <Route path="/login" element={<Navigate to="/auth?mode=login" replace />} />
            <Route path="/register" element={<Navigate to="/auth?mode=register" replace />} />
          </>
        )}
        
        {/* Dashboard - Protected Route (both platforms) */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
};
```

## Platform-Specific Features

### Web Features
- ✅ Landing page with marketing content
- ✅ Public registration
- ✅ SEO optimization
- ✅ Social sharing
- ✅ Analytics tracking

### Electron Features
- ✅ Direct to Auth page (no landing)
- ✅ Offline mode
- ✅ Local database
- ✅ Printer integration
- ✅ Hardware integration (barcode scanner, weighing scale)
- ✅ Auto-sync with server
- ✅ Cash drawer control
- ✅ Customer pole display

## Platform Configuration

```typescript
const config = getPlatformConfig();

// Returns:
{
  platform: 'electron' | 'web',
  isElectron: boolean,
  isWeb: boolean,
  hasAPI: boolean,
  features: {
    // Electron-specific
    offlineMode: boolean,
    localDatabase: boolean,
    printer: boolean,
    hardware: boolean,
    autoSync: boolean,
    
    // Web-specific
    landingPage: boolean,
    publicRegistration: boolean,
  }
}
```

## Usage Examples

### Conditional Rendering

```typescript
import { isElectron, isWeb } from '@/utils/platform';

const MyComponent = () => {
  return (
    <>
      {isWeb() && <LandingPageHeader />}
      {isElectron() && <ElectronAppHeader />}
      
      <MainContent />
      
      {isWeb() && <Footer />}
    </>
  );
};
```

### Feature Detection

```typescript
import { getPlatformConfig } from '@/utils/platform';

const BillingPage = () => {
  const { features } = getPlatformConfig();
  
  return (
    <div>
      <h1>Billing</h1>
      
      {features.printer && (
        <button onClick={printReceipt}>Print Receipt</button>
      )}
      
      {features.hardware && (
        <button onClick={scanBarcode}>Scan Barcode</button>
      )}
    </div>
  );
};
```

### Electron API Access

```typescript
import { getElectronAPI, hasElectronAPI } from '@/utils/platform';

const PrintButton = () => {
  const handlePrint = async () => {
    if (!hasElectronAPI()) {
      alert('Printing is only available in the desktop app');
      return;
    }
    
    const electron = getElectronAPI();
    const result = await electron?.printer.printReceipt(billData);
    
    if (result?.success) {
      toast({ title: "Receipt Printed", variant: "success" });
    }
  };
  
  return <button onClick={handlePrint}>Print</button>;
};
```

## Debugging

### Log Platform Information

```typescript
import { logPlatformInfo } from '@/utils/platform';

// In your component or app initialization
useEffect(() => {
  logPlatformInfo();
}, []);
```

**Console Output:**
```
Platform Info: {
  platform: "electron",
  isElectron: true,
  isWeb: false,
  hasAPI: true,
  userAgent: "Mozilla/5.0 ... Electron/25.0.0",
  windowElectron: true
}
```

## Testing

### Test Web Version

1. Open in browser: `http://localhost:5173`
2. Should see Landing page
3. Navigate to `/auth` for login
4. Check console: `platform: "web"`

### Test Electron Version

1. Run Electron app: `npm run electron:dev`
2. Should see Auth page immediately
3. No landing page visible
4. Check console: `platform: "electron"`

### Test Platform Detection

```typescript
// Add to App.tsx temporarily
useEffect(() => {
  console.log('Platform:', getPlatform());
  console.log('Is Electron:', isElectron());
  console.log('Has API:', hasElectronAPI());
}, []);
```

## Environment Variables

### Web (.env)
```env
VITE_PLATFORM=web
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_GOOGLE_CLIENT_ID=your-web-client-id
```

### Electron (.env)
```env
VITE_PLATFORM=electron
VITE_API_BASE_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your-electron-client-id
```

## Benefits

### For Web Users
- ✅ Marketing landing page
- ✅ Learn about features before signing up
- ✅ See pricing and testimonials
- ✅ Better SEO and discoverability

### For Electron Users
- ✅ Faster startup (no landing page)
- ✅ Direct to login
- ✅ Desktop app experience
- ✅ Offline capabilities
- ✅ Hardware integration

## Migration Guide

### From Web to Electron

1. User registers on web
2. Downloads Electron app
3. Opens app → Auth page
4. Logs in with same credentials
5. Data syncs from server

### From Electron to Web

1. User has Electron app
2. Opens web version
3. Sees landing page
4. Clicks login
5. Logs in with same credentials
6. Access from anywhere

## Security Considerations

### Electron
- Local database encryption
- Secure token storage
- Hardware-level security
- No CORS issues

### Web
- HTTPS required
- CORS configuration
- Token in sessionStorage
- XSS protection

## Future Enhancements

1. **Platform-Specific UI**
   - Different themes for web/electron
   - Platform-specific components

2. **Feature Flags**
   - Enable/disable features per platform
   - A/B testing per platform

3. **Analytics**
   - Track platform usage
   - Platform-specific metrics

4. **Sync Status**
   - Show sync status in Electron
   - Online/offline indicator

## Files Modified

1. `frontend/src/App.tsx`
   - Added platform detection
   - Conditional routing
   - Platform-specific routes

2. `frontend/src/utils/platform.ts`
   - Enhanced detection methods
   - Added utility functions
   - Platform configuration

3. `frontend/src/types/electron.d.ts`
   - Electron API types
   - Window interface extension

## Troubleshooting

### Issue: Landing page shows in Electron

**Solution**: Check if `window.electron` is properly exposed in preload script

```javascript
// electron/src/main/preload.js
contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  // ... other APIs
});
```

### Issue: Auth page not showing in Electron

**Solution**: Check routing logic and platform detection

```typescript
console.log('Is Electron:', isElectron());
console.log('Window.electron:', window.electron);
```

### Issue: Platform detection fails

**Solution**: Ensure both detection methods are working

```typescript
// Check both methods
console.log('Method 1 (API):', !!window.electron);
console.log('Method 2 (UA):', navigator.userAgent.includes('Electron'));
```

## Best Practices

1. **Always check platform** before using platform-specific features
2. **Provide fallbacks** for features not available on current platform
3. **Test both platforms** during development
4. **Log platform info** in development mode
5. **Handle errors gracefully** when APIs are not available

---

**Status**: ✅ Complete and Tested
**Last Updated**: January 29, 2026
**Platforms Supported**: Web Browser, Electron Desktop App
