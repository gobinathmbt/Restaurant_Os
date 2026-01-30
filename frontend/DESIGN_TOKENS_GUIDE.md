# Design Tokens Guide

## Overview
All design system values (fonts, colors, sizes, spacing) are centralized in `src/lib/design-tokens.ts`. Edit this single file to control the entire application's appearance.

## Quick Start

### Import Design Tokens
```typescript
import designTokens, { getToken } from '@/lib/design-tokens';
```

### Using Design Tokens

#### 1. Typography
```typescript
// Font sizes
const heading = {
  fontSize: designTokens.typography.fontSize['4xl'],  // 2.25rem (36px)
  fontWeight: designTokens.typography.fontWeight.bold, // 700
  lineHeight: designTokens.typography.lineHeight.tight, // 1.25
};

// Font families
const bodyFont = designTokens.typography.fontFamily.sans; // 'Inter', system-ui, sans-serif
const codeFont = designTokens.typography.fontFamily.mono; // 'JetBrains Mono', monospace
```

#### 2. Colors
```typescript
// Primary colors
const primaryButton = {
  backgroundColor: designTokens.colors.primary.main,      // #22c55e
  color: designTokens.colors.primary.foreground,          // #ffffff
};

// Semantic colors
const successMessage = {
  color: designTokens.colors.success,  // #22c55e
};

const errorMessage = {
  color: designTokens.colors.error,    // #ef4444
};

// Neutral colors
const cardBackground = designTokens.colors.neutral[900]; // #171717
```

#### 3. Spacing
```typescript
// Padding and margins
const card = {
  padding: designTokens.spacing.lg,     // 1.5rem (24px)
  marginBottom: designTokens.spacing.xl, // 2rem (32px)
};
```

#### 4. Border Radius
```typescript
const button = {
  borderRadius: designTokens.borderRadius.lg, // 0.75rem (12px)
};
```

#### 5. Shadows
```typescript
const card = {
  boxShadow: designTokens.shadows.lg,    // Predefined shadow
};

const glowEffect = {
  boxShadow: designTokens.shadows.glow,  // Green glow effect
};
```

#### 6. Component Sizes
```typescript
// Button sizes
const largeButton = {
  padding: designTokens.components.button.lg.padding,   // 1rem 2rem
  fontSize: designTokens.components.button.lg.fontSize, // 1.125rem
};

// Input sizes
const mediumInput = {
  padding: designTokens.components.input.md.padding,   // 0.75rem 1rem
  fontSize: designTokens.components.input.md.fontSize, // 1rem
};
```

## Using with Tailwind CSS

The design tokens are already integrated with Tailwind through `tailwind.config.ts` and `index.css`. You can use them directly in className:

```tsx
<div className="text-primary bg-background p-lg rounded-lg shadow-glow">
  Content
</div>
```

## Using with Inline Styles

```tsx
<div style={{
  fontSize: designTokens.typography.fontSize.xl,
  color: designTokens.colors.primary.main,
  padding: designTokens.spacing.md,
  borderRadius: designTokens.borderRadius.lg,
}}>
  Content
</div>
```

## Helper Function

Use the `getToken` helper for nested access:

```typescript
const fontSize = getToken('typography.fontSize.xl');      // '1.25rem'
const primaryColor = getToken('colors.primary.main');     // '#22c55e'
const spacing = getToken('spacing.lg');                   // '1.5rem'
```

## Common Customizations

### Change Primary Color
```typescript
// In design-tokens.ts
colors: {
  primary: {
    main: '#3b82f6',      // Change to blue
    light: '#60a5fa',
    dark: '#2563eb',
    foreground: '#ffffff',
  },
}
```

### Adjust Font Sizes Globally
```typescript
// In design-tokens.ts
typography: {
  fontSize: {
    xs: '0.7rem',      // Smaller
    sm: '0.8rem',      // Smaller
    base: '0.9rem',    // Smaller
    // ... adjust all sizes
  },
}
```

### Change Spacing Scale
```typescript
// In design-tokens.ts
spacing: {
  xs: '0.125rem',    // Tighter
  sm: '0.25rem',     // Tighter
  md: '0.5rem',      // Tighter
  // ... adjust all spacing
}
```

### Modify Component Defaults
```typescript
// In design-tokens.ts
components: {
  button: {
    md: {
      padding: '0.5rem 1rem',    // Smaller padding
      fontSize: '0.875rem',       // Smaller font
    },
  },
}
```

## Best Practices

1. **Always use design tokens** instead of hardcoded values
2. **Update tokens file** when you need to change design system values
3. **Test changes** across the application after modifying tokens
4. **Document custom tokens** if you add new ones
5. **Use semantic names** for new token categories

## File Locations

- **Design Tokens**: `frontend/src/lib/design-tokens.ts`
- **Tailwind Config**: `frontend/tailwind.config.ts`
- **Global CSS**: `frontend/src/index.css`

## Examples in Codebase

Check these files for real-world usage:
- `src/pages/Auth.tsx` - Form styling with reduced sizes
- `src/components/landing/HeroSection.tsx` - Typography and spacing
- `src/components/landing/ShowcaseSection.tsx` - Colors and gradients

## Need Help?

If you need to make global design changes:
1. Open `src/lib/design-tokens.ts`
2. Find the relevant section (typography, colors, spacing, etc.)
3. Update the values
4. Save and see changes reflected across the entire app
