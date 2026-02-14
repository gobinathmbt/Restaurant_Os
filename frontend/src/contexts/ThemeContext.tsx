import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeMode = "dark" | "light" | "system";

export interface CustomColors {
  primary: string;
  secondary: string;
  tertiary: string;
}

export interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  customColors: CustomColors | null;
  setCustomColors: (colors: CustomColors | null) => void;
  currentTheme: "dark" | "light"; // The actual applied theme
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const DEFAULT_COLORS = {
  dark: {
    primary: "#22c55e", // Green
    secondary: "#0a0a0a", // Black
    tertiary: "#ffffff", // White
  },
  light: {
    primary: "#22c55e", // Green
    secondary: "#ffffff", // White
    tertiary: "#0a0a0a", // Black
  },
};

function getCookie(name: string, defaultValue: string = ""): string {
  const cookies = document.cookie.split(";");
  const cookie = cookies.find((c) => c.trim().startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split("=")[1]) : defaultValue;
}

function setCookie(name: string, value: string, days: number = 365): void {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${encodeURIComponent(value)}; ${expires}; path=/`;
}

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "160 84% 39%";

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function getSystemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = getCookie("theme-mode") as ThemeMode;
    return stored || "system";
  });

  const [customColors, setCustomColorsState] = useState<CustomColors | null>(() => {
    const stored = getCookie("theme-custom-colors");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [currentTheme, setCurrentTheme] = useState<"dark" | "light">("dark");

  // Subscribe to system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (mode === "system") {
        setCurrentTheme(getSystemTheme());
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mode]);

  // Update current theme when mode or custom colors change
  useEffect(() => {
    const newTheme =
      mode === "system" ? getSystemTheme() : mode;
    setCurrentTheme(newTheme);

    // Apply theme to document
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(newTheme);

    // Apply colors
    const colors = customColors || DEFAULT_COLORS[newTheme];

    // Convert hex to HSL and apply CSS variables
    const primaryHsl = customColors 
      ? hexToHsl(customColors.primary)
      : hexToHsl(DEFAULT_COLORS[newTheme].primary);
    
    const secondaryHsl = customColors
      ? hexToHsl(customColors.secondary)
      : hexToHsl(DEFAULT_COLORS[newTheme].secondary);
    
    const tertiaryHsl = customColors
      ? hexToHsl(customColors.tertiary)
      : hexToHsl(DEFAULT_COLORS[newTheme].tertiary);

    root.style.setProperty("--color-primary", primaryHsl);
    root.style.setProperty("--color-secondary", secondaryHsl);
    root.style.setProperty("--color-tertiary", tertiaryHsl);

    // Update CSS custom properties for the theme
    if (newTheme === "dark") {
      if (!customColors) {
        root.style.setProperty("--background", "0 0% 4%");
        root.style.setProperty("--foreground", "0 0% 98%");
      } else {
        root.style.setProperty("--background", hexToHsl(customColors.secondary));
        root.style.setProperty("--foreground", hexToHsl(customColors.tertiary));
      }
    } else {
      if (!customColors) {
        root.style.setProperty("--background", "0 0% 98%");
        root.style.setProperty("--foreground", "0 0% 8%");
      } else {
        root.style.setProperty("--background", hexToHsl(customColors.secondary));
        root.style.setProperty("--foreground", hexToHsl(customColors.tertiary));
      }
    }

    root.style.setProperty("--primary", primaryHsl);
  }, [mode, customColors]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    setCookie("theme-mode", newMode);
  };

  const setCustomColors = (colors: CustomColors | null) => {
    setCustomColorsState(colors);
    if (colors) {
      setCookie("theme-custom-colors", JSON.stringify(colors));
    } else {
      setCookie("theme-custom-colors", "");
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        setMode,
        customColors,
        setCustomColors,
        currentTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
