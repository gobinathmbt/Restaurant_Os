# Platform Routing Diagram

## Visual Flow Comparison

### Web Browser Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User Opens Browser                        │
│                  http://localhost:5173                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Platform Detection                         │
│              isElectron() → false (Web)                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Landing Page (/)                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  • Hero Section                                       │  │
│  │  • Features (8 cards)                                 │  │
│  │  • Statistics                                         │  │
│  │  • Pricing                                            │  │
│  │  • Testimonials                                       │  │
│  │  • CTA Section                                        │  │
│  │  • Footer                                             │  │
│  │                                                       │  │
│  │  [Sign In] [Get Started]                             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    User clicks button
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Auth Page (/auth)                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  60% Info Panel    │    40% Form                      │  │
│  │  ─────────────────────────────────────────────────    │  │
│  │  • Animated BG     │    • Login Form                  │  │
│  │  • Features        │    • Register Form               │  │
│  │  • Testimonial     │    • Google OAuth                │  │
│  │                    │                                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    Successful Login
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Dashboard (/dashboard)                      │
│                    [Protected Route]                         │
└─────────────────────────────────────────────────────────────┘
```

### Electron App Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  User Opens Electron App                     │
│                    ./electron-app.exe                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Platform Detection                         │
│             isElectron() → true (Electron)                   │
│           window.electron → ElectronAPI                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
                   ❌ NO Landing Page
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Auth Page (/)                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  60% Info Panel    │    40% Form                      │  │
│  │  ─────────────────────────────────────────────────    │  │
│  │  • Animated BG     │    • Login Form                  │  │
│  │  • Features        │    • Register Form               │  │
│  │  • Testimonial     │    • Google OAuth                │  │
│  │                    │                                  │  │
│  │  [Electron Mode]   │    [Desktop App]                 │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    Successful Login
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Dashboard (/dashboard)                      │
│                    [Protected Route]                         │
│                                                              │
│  + Offline Mode                                              │
│  + Local Database                                            │
│  + Printer Integration                                       │
│  + Hardware Support                                          │
└─────────────────────────────────────────────────────────────┘
```

## Route Mapping

### Web Routes

| Path | Component | Description | Protected |
|------|-----------|-------------|-----------|
| `/` | Landing | Marketing page | No |
| `/auth` | Auth | Login/Register | No |
| `/login` | → `/auth?mode=login` | Redirect | No |
| `/register` | → `/auth?mode=register` | Redirect | No |
| `/dashboard` | Dashboard | Main app | Yes |

### Electron Routes

| Path | Component | Description | Protected |
|------|-----------|-------------|-----------|
| `/` | Auth | Login/Register | No |
| `/dashboard` | Dashboard | Main app | Yes |

## Platform Detection Logic

```
┌─────────────────────────────────────────────────────────────┐
│                    Platform Detection                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
                ┌───────────────────────┐
                │  Check window.electron │
                └───────────────────────┘
                            ↓
                    ┌───────────────┐
                    │   Exists?     │
                    └───────────────┘
                    ↓           ↓
                  Yes          No
                    ↓           ↓
            ┌──────────┐   ┌──────────────────┐
            │ Electron │   │ Check User Agent │
            └──────────┘   └──────────────────┘
                                    ↓
                        ┌───────────────────────┐
                        │ Contains "electron/"? │
                        └───────────────────────┘
                            ↓           ↓
                          Yes          No
                            ↓           ↓
                    ┌──────────┐   ┌─────┐
                    │ Electron │   │ Web │
                    └──────────┘   └─────┘
```

## Component Rendering Logic

### App.tsx Logic

```typescript
const isElectronApp = isElectron();

// Landing Page
{!isElectronApp && <Route path="/" element={<Landing />} />}
// ✅ Web: Shows Landing at /
// ❌ Electron: Not rendered

// Auth Page
{isElectronApp ? (
  <Route path="/" element={<Auth />} />
) : (
  <Route path="/auth" element={<Auth />} />
)}
// ✅ Web: Shows Auth at /auth
// ✅ Electron: Shows Auth at /

// Auth Redirects
{!isElectronApp && (
  <>
    <Route path="/login" element={<Navigate to="/auth?mode=login" />} />
    <Route path="/register" element={<Navigate to="/auth?mode=register" />} />
  </>
)}
// ✅ Web: Redirects work
// ❌ Electron: Not rendered (not needed)
```

## Feature Availability Matrix

| Feature | Web | Electron |
|---------|-----|----------|
| Landing Page | ✅ | ❌ |
| Auth Page | ✅ | ✅ |
| Dashboard | ✅ | ✅ |
| Google OAuth | ✅ | ✅ |
| Offline Mode | ❌ | ✅ |
| Local Database | ❌ | ✅ |
| Printer | ❌ | ✅ |
| Barcode Scanner | ❌ | ✅ |
| Weighing Scale | ❌ | ✅ |
| Cash Drawer | ❌ | ✅ |
| Customer Display | ❌ | ✅ |
| Auto Sync | ❌ | ✅ |
| SEO | ✅ | ❌ |
| Public Registration | ✅ | ✅ |
| Social Sharing | ✅ | ❌ |

## User Journey Comparison

### Web User Journey

```
1. Visit website
   ↓
2. See landing page
   ↓
3. Learn about features
   ↓
4. View pricing
   ↓
5. Read testimonials
   ↓
6. Click "Get Started"
   ↓
7. Register account
   ↓
8. Login
   ↓
9. Access dashboard
```

### Electron User Journey

```
1. Open desktop app
   ↓
2. See login screen
   ↓
3. Login or register
   ↓
4. Access dashboard
   ↓
5. Use offline features
   ↓
6. Print receipts
   ↓
7. Scan barcodes
   ↓
8. Auto-sync with server
```

## Code Examples

### Platform-Specific Rendering

```typescript
import { isElectron, isWeb } from '@/utils/platform';

const Header = () => {
  return (
    <header>
      {isWeb() && <LandingPageNav />}
      {isElectron() && <DesktopAppNav />}
    </header>
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
      {features.printer && <PrintButton />}
      {features.hardware && <ScanButton />}
      {features.offlineMode && <OfflineIndicator />}
    </div>
  );
};
```

### API Access

```typescript
import { getElectronAPI, hasElectronAPI } from '@/utils/platform';

const PrintReceipt = () => {
  const handlePrint = async () => {
    if (!hasElectronAPI()) {
      alert('Desktop app required');
      return;
    }
    
    const api = getElectronAPI();
    await api?.printer.printReceipt(data);
  };
  
  return <button onClick={handlePrint}>Print</button>;
};
```

## Testing Scenarios

### Scenario 1: Web Browser

```
1. Open http://localhost:5173
2. Verify landing page shows
3. Click "Sign In"
4. Verify redirects to /auth
5. Login
6. Verify redirects to /dashboard
```

### Scenario 2: Electron App

```
1. Run npm run electron:dev
2. Verify auth page shows immediately
3. Verify no landing page
4. Login
5. Verify redirects to /dashboard
6. Verify offline features available
```

### Scenario 3: Platform Detection

```
1. Open browser console
2. Run: isElectron()
3. Verify returns false
4. Open Electron console
5. Run: isElectron()
6. Verify returns true
```

## Performance Comparison

| Metric | Web | Electron |
|--------|-----|----------|
| Initial Load | ~2s | ~1s |
| Landing Page | Yes | No |
| Bundle Size | Smaller | Larger |
| Offline Support | No | Yes |
| Hardware Access | No | Yes |
| Update Method | Instant | Download |

---

**Visual Guide**: This document provides a visual representation of the routing differences between Web and Electron platforms.

**Last Updated**: January 29, 2026
