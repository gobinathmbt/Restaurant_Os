# 🚀 Quick Start Guide - RestaurantOS Design System

## 🎨 How to Customize Your App in 5 Minutes

### 1️⃣ Change Primary Color (Green → Your Color)

**File**: `frontend/src/lib/design-tokens.ts`

```typescript
// Line 35-40
colors: {
  primary: {
    main: '#22c55e',      // ← Change this to your color (e.g., '#3b82f6' for blue)
    light: '#4ade80',     // ← Lighter shade
    dark: '#16a34a',      // ← Darker shade
    foreground: '#ffffff', // ← Text color on primary background
  },
}
```

**Result**: Entire app (buttons, links, highlights) changes to your color!

---

### 2️⃣ Adjust Font Sizes Globally

**File**: `frontend/src/lib/design-tokens.ts`

```typescript
// Line 18-28
fontSize: {
  xs: '0.75rem',      // ← Make smaller: '0.7rem'
  sm: '0.875rem',     // ← Make smaller: '0.8rem'
  base: '1rem',       // ← Make smaller: '0.9rem'
  lg: '1.125rem',     // ← Make smaller: '1rem'
  xl: '1.25rem',      // ← Make smaller: '1.125rem'
  '2xl': '1.5rem',    // ← Adjust as needed
  '3xl': '1.875rem',
  '4xl': '2.25rem',
  '5xl': '3rem',
  '6xl': '3.75rem',
  '7xl': '4.5rem',
}
```

**Result**: All text across the app scales proportionally!

---

### 3️⃣ Change Spacing (Tighter or Looser)

**File**: `frontend/src/lib/design-tokens.ts`

```typescript
// Line 82-90
spacing: {
  xs: '0.25rem',    // ← Tighter: '0.125rem'
  sm: '0.5rem',     // ← Tighter: '0.25rem'
  md: '1rem',       // ← Tighter: '0.75rem'
  lg: '1.5rem',     // ← Tighter: '1rem'
  xl: '2rem',       // ← Tighter: '1.5rem'
  '2xl': '3rem',
  '3xl': '4rem',
  '4xl': '6rem',
  '5xl': '8rem',
}
```

**Result**: All padding and margins adjust throughout the app!

---

### 4️⃣ Modify Button Sizes

**File**: `frontend/src/lib/design-tokens.ts`

```typescript
// Line 130-145
button: {
  sm: {
    padding: '0.5rem 1rem',    // ← Smaller: '0.375rem 0.75rem'
    fontSize: '0.875rem',       // ← Smaller: '0.8rem'
  },
  md: {
    padding: '0.75rem 1.5rem',  // ← Smaller: '0.5rem 1rem'
    fontSize: '1rem',           // ← Smaller: '0.875rem'
  },
  lg: {
    padding: '1rem 2rem',       // ← Smaller: '0.75rem 1.5rem'
    fontSize: '1.125rem',       // ← Smaller: '1rem'
  },
}
```

**Result**: All buttons resize consistently!

---

### 5️⃣ Replace Landing Page Images

**File**: `frontend/src/components/landing/HeroSection.tsx`

```typescript
// Line 13-28
const slides = [
  {
    title: "Smart Restaurant POS",
    subtitle: "Lightning-fast billing & kitchen management",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
    // ↑ Replace with your own image URL or local path: "/images/pos-system.jpg"
    icon: Receipt,
  },
  // ... more slides
];
```

**File**: `frontend/src/components/landing/ShowcaseSection.tsx`

```typescript
// Line 11-70
const showcases = [
  {
    title: "Lightning-Fast POS Billing",
    description: "...",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80",
    // ↑ Replace with your own image
    icon: Receipt,
    features: [...],
    gradient: "from-green-500 to-emerald-500"
  },
  // ... more showcases
];
```

---

## 🎯 Common Customizations

### Make Everything Smaller
```typescript
// In design-tokens.ts
typography: {
  fontSize: {
    base: '0.875rem',  // Smaller base font
    // ... reduce all sizes by 10-20%
  }
},
spacing: {
  md: '0.75rem',  // Tighter spacing
  // ... reduce all spacing by 25%
}
```

### Change to Blue Theme
```typescript
// In design-tokens.ts
colors: {
  primary: {
    main: '#3b82f6',      // Blue
    light: '#60a5fa',
    dark: '#2563eb',
    foreground: '#ffffff',
  },
}
```

### Make Buttons Rounder
```typescript
// In design-tokens.ts
borderRadius: {
  lg: '1rem',     // More rounded (default: 0.75rem)
  xl: '1.5rem',   // More rounded (default: 1rem)
}
```

---

## 📝 Quick Reference

### File Locations
- **Design Tokens**: `frontend/src/lib/design-tokens.ts`
- **Landing Page**: `frontend/src/pages/Landing.tsx`
- **Hero Section**: `frontend/src/components/landing/HeroSection.tsx`
- **Showcase Section**: `frontend/src/components/landing/ShowcaseSection.tsx`
- **Auth Page**: `frontend/src/pages/Auth.tsx`

### Key Sections in design-tokens.ts
- **Line 18-28**: Font sizes
- **Line 30-40**: Font weights
- **Line 35-75**: Colors
- **Line 82-90**: Spacing
- **Line 95-102**: Border radius
- **Line 107-114**: Shadows
- **Line 130-160**: Component sizes

---

## 🔄 After Making Changes

1. **Save the file** (`Ctrl+S` or `Cmd+S`)
2. **Changes apply automatically** (hot reload)
3. **Check the browser** to see updates
4. **No restart needed** in development mode

---

## 🎨 Color Picker Tools

Use these to find your perfect color:
- [Coolors.co](https://coolors.co/) - Color palette generator
- [Adobe Color](https://color.adobe.com/) - Color wheel
- [Material Design Colors](https://materialui.co/colors) - Pre-made palettes

---

## 💡 Pro Tips

1. **Test on Mobile**: Always check responsive design after changes
2. **Use Consistent Scale**: Keep ratios consistent (e.g., 1.25x, 1.5x, 2x)
3. **Accessibility**: Ensure text has enough contrast with backgrounds
4. **Save Backups**: Keep a copy of original values before major changes
5. **Gradual Changes**: Make small adjustments and test frequently

---

## 🆘 Need Help?

- **Full Documentation**: See `DESIGN_TOKENS_GUIDE.md`
- **All Changes**: See `CHANGES_SUMMARY.md`
- **Implementation Details**: See `IMPLEMENTATION_COMPLETE.md`

---

## ✅ Checklist for Customization

- [ ] Changed primary color to match brand
- [ ] Adjusted font sizes for readability
- [ ] Modified spacing for desired density
- [ ] Replaced placeholder images with real ones
- [ ] Updated SEO meta tags in `index.html`
- [ ] Tested on mobile devices
- [ ] Checked all pages (Landing, Auth)
- [ ] Verified build succeeds (`npm run build`)

---

**Remember**: Edit `design-tokens.ts` once, changes apply everywhere! 🎉
