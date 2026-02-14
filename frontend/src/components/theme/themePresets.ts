/**
 * Theme Presets Configuration
 * Provides predefined color schemes available for both dark and light modes
 */

export interface ThemePreset {
  name: string;
  dark: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  light: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    name: "Emerald Glow",
    dark: {
      primary: "#22c55e",
      secondary: "#0a0a0a",
      tertiary: "#ffffff",
    },
    light: {
      primary: "#16a34a",
      secondary: "#f5f5f5",
      tertiary: "#1f2937",
    },
  },
  {
    name: "Ocean Blue",
    dark: {
      primary: "#38bdf8",
      secondary: "#020617",
      tertiary: "#e2e8f0",
    },
    light: {
      primary: "#0369a1",
      secondary: "#f0f9ff",
      tertiary: "#020617",
    },
  },
  {
    name: "Royal Purple",
    dark: {
      primary: "#a855f7",
      secondary: "#12091f",
      tertiary: "#f3e8ff",
    },
    light: {
      primary: "#7c3aed",
      secondary: "#faf5ff",
      tertiary: "#4c1d95",
    },
  },
  {
    name: "Sunset Orange",
    dark: {
      primary: "#f97316",
      secondary: "#1e293b",
      tertiary: "#fff7ed",
    },
    light: {
      primary: "#ea580c",
      secondary: "#fef3c7",
      tertiary: "#7c2d12",
    },
  },
  {
    name: "Mint Fresh",
    dark: {
      primary: "#10b981",
      secondary: "#1f2937",
      tertiary: "#d1fae5",
    },
    light: {
      primary: "#059669",
      secondary: "#f0fdf4",
      tertiary: "#064e3b",
    },
  },
  {
    name: "Crisp Sky",
    dark: {
      primary: "#0ea5e9",
      secondary: "#0f172a",
      tertiary: "#f0f9ff",
    },
    light: {
      primary: "#0284c7",
      secondary: "#f8fafc",
      tertiary: "#062e4f",
    },
  },
  {
    name: "Graphite Pro",
    dark: {
      primary: "#6366f1",
      secondary: "#1f2937",
      tertiary: "#e0e7ff",
    },
    light: {
      primary: "#4f46e5",
      secondary: "#f8f8ff",
      tertiary: "#1e1b4b",
    },
  },
  {
    name: "Rose Blush",
    dark: {
      primary: "#fb7185",
      secondary: "#1f2937",
      tertiary: "#ffe4e6",
    },
    light: {
      primary: "#e11d48",
      secondary: "#fff5f7",
      tertiary: "#831843",
    },
  },
  {
    name: "Emerald Noir",
    dark: {
      primary: "#34d399",
      secondary: "#052e2b",
      tertiary: "#ecfdf5",
    },
    light: {
      primary: "#047857",
      secondary: "#f0fdf4",
      tertiary: "#134e4a",
    },
  },
  {
    name: "Amber Glow",
    dark: {
      primary: "#facc15",
      secondary: "#1e293b",
      tertiary: "#fef3c7",
    },
    light: {
      primary: "#ca8a04",
      secondary: "#fffacd",
      tertiary: "#713f12",
    },
  },
];

/**
 * Helper function to get a preset by name
 */
export function getThemePresetByName(name: string): ThemePreset | undefined {
  return THEME_PRESETS.find((preset) => preset.name === name);
}

/**
 * Helper function to get all preset names
 */
export function getThemePresetNames(): string[] {
  return THEME_PRESETS.map((preset) => preset.name);
}
