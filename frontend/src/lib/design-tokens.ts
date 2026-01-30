/**
 * DESIGN TOKENS - Central Configuration
 * Edit these values to control the entire application's design system
 */

export const designTokens = {
  // ============================================
  // TYPOGRAPHY
  // ============================================
  typography: {
    // Font Families
    fontFamily: {
      sans: "'Inter', system-ui, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },

    // Font Sizes (in rem)
    fontSize: {
      xs: '0.75rem',      // 12px
      sm: '0.875rem',     // 14px
      base: '1rem',       // 16px
      lg: '1.125rem',     // 18px
      xl: '1.25rem',      // 20px
      '2xl': '1.5rem',    // 24px
      '3xl': '1.875rem',  // 30px
      '4xl': '2.25rem',   // 36px
      '5xl': '3rem',      // 48px
      '6xl': '3.75rem',   // 60px
      '7xl': '4.5rem',    // 72px
    },

    // Font Weights
    fontWeight: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },

    // Line Heights
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },

  // ============================================
  // COLORS
  // ============================================
  colors: {
    // Primary Brand Colors
    primary: {
      main: '#22c55e',      // Green
      light: '#4ade80',
      dark: '#16a34a',
      foreground: '#ffffff',
    },

    // Secondary Colors
    secondary: {
      main: '#0a0a0a',      // Black
      light: '#1a1a1a',
      dark: '#000000',
      foreground: '#ffffff',
    },

    // Accent Colors
    accent: {
      emerald: '#10b981',
      mint: '#6ee7b7',
      forest: '#064e3b',
    },

    // Semantic Colors
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',

    // Neutral Colors
    neutral: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
      950: '#0a0a0a',
    },

    // Background Colors
    background: {
      primary: '#0a0a0a',
      secondary: '#121212',
      tertiary: '#1a1a1a',
      light: '#ffffff',
    },

    // Text Colors
    text: {
      primary: '#ffffff',
      secondary: '#a3a3a3',
      tertiary: '#737373',
      inverse: '#0a0a0a',
    },
  },

  // ============================================
  // SPACING (in rem)
  // ============================================
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
    '4xl': '6rem',    // 96px
    '5xl': '8rem',    // 128px
  },

  // ============================================
  // BORDER RADIUS
  // ============================================
  borderRadius: {
    none: '0',
    sm: '0.25rem',    // 4px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    xl: '1rem',       // 16px
    '2xl': '1.5rem',  // 24px
    full: '9999px',
  },

  // ============================================
  // SHADOWS
  // ============================================
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.6)',
    glow: '0 0 20px rgba(34, 197, 94, 0.3)',
    glowLg: '0 0 40px rgba(34, 197, 94, 0.4)',
  },

  // ============================================
  // TRANSITIONS
  // ============================================
  transitions: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // ============================================
  // BREAKPOINTS
  // ============================================
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  // ============================================
  // Z-INDEX
  // ============================================
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },

  // ============================================
  // COMPONENT SPECIFIC
  // ============================================
  components: {
    // Button Sizes
    button: {
      sm: {
        padding: '0.5rem 1rem',
        fontSize: '0.875rem',
      },
      md: {
        padding: '0.75rem 1.5rem',
        fontSize: '1rem',
      },
      lg: {
        padding: '1rem 2rem',
        fontSize: '1.125rem',
      },
    },

    // Input Sizes
    input: {
      sm: {
        padding: '0.5rem 0.75rem',
        fontSize: '0.875rem',
      },
      md: {
        padding: '0.75rem 1rem',
        fontSize: '1rem',
      },
      lg: {
        padding: '1rem 1.25rem',
        fontSize: '1.125rem',
      },
    },

    // Card
    card: {
      padding: '1.5rem',
      borderRadius: '0.75rem',
      borderWidth: '1px',
    },
  },
};

// Helper function to get design token values
export const getToken = (path: string): any => {
  const keys = path.split('.');
  let value: any = designTokens;
  
  for (const key of keys) {
    value = value?.[key];
    if (value === undefined) return undefined;
  }
  
  return value;
};

// Export for easy access
export default designTokens;
