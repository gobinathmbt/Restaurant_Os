import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeMode = "dark" | "light" | "system";

export interface CustomColors {
  primary: string;
  secondary: string;
  tertiary: string;
}

export interface ModedColors {
  dark: CustomColors;
  light: CustomColors;
}

export interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  customColors: ModedColors | null;
  setCustomColors: (colors: ModedColors | null) => void;
  currentTheme: "dark" | "light"; // The actual applied theme
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const DEFAULT_COLORS: ModedColors = {
  dark: {
    primary: "#22c55e", // Green
    secondary: "#0a0a0a", // Black
    tertiary: "#ffffff", // White
  },
  light: {
    primary: "#16a34a", // Darker green for light mode
    secondary: "#f5f5f5", // Light background
    tertiary: "#1f2937", // Dark foreground
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

  const [customColors, setCustomColorsState] = useState<ModedColors | null>(() => {
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

    // Get colors based on current theme
    const colors = customColors 
      ? customColors[newTheme]
      : DEFAULT_COLORS[newTheme];

    // Convert hex to HSL and apply CSS variables
    const primaryHsl = hexToHsl(colors.primary);
    const secondaryHsl = hexToHsl(colors.secondary);
    const tertiaryHsl = hexToHsl(colors.tertiary);

    root.style.setProperty("--color-primary", primaryHsl);
    root.style.setProperty("--color-secondary", secondaryHsl);
    root.style.setProperty("--color-tertiary", tertiaryHsl);

    // Update CSS custom properties based on theme
    // Use custom colors if provided, otherwise use defaults
    if (customColors) {
      // When custom colors are set, derive all theme colors from them
      root.style.setProperty("--background", secondaryHsl);
      root.style.setProperty("--foreground", tertiaryHsl);
      root.style.setProperty("--primary", primaryHsl);
      
      // Adjust lighter/darker variants
      if (newTheme === "dark") {
        // For dark mode, cards are slightly lighter than background
        root.style.setProperty("--card", `${secondaryHsl.split(' ')[0]} ${secondaryHsl.split(' ')[1]} ${Math.min(parseInt(secondaryHsl.split(' ')[2]) + 3, 15)}%`);
        root.style.setProperty("--card-foreground", tertiaryHsl);
        root.style.setProperty("--muted", `${secondaryHsl.split(' ')[0]} ${secondaryHsl.split(' ')[1]} 25%`);
        root.style.setProperty("--muted-foreground", tertiaryHsl);
        root.style.setProperty("--border", `${secondaryHsl.split(' ')[0]} ${secondaryHsl.split(' ')[1]} 20%`);
        root.style.setProperty("--input", `${secondaryHsl.split(' ')[0]} ${secondaryHsl.split(' ')[1]} 20%`);
      } else {
        // For light mode, cards are slightly different shade
        root.style.setProperty("--card", `${secondaryHsl.split(' ')[0]} ${secondaryHsl.split(' ')[1]} ${Math.min(parseInt(secondaryHsl.split(' ')[2]) + 2, 100)}%`);
        root.style.setProperty("--card-foreground", tertiaryHsl);
        root.style.setProperty("--muted", `${secondaryHsl.split(' ')[0]} ${secondaryHsl.split(' ')[1]} ${Math.max(parseInt(secondaryHsl.split(' ')[2]) - 5, 90)}%`);
        root.style.setProperty("--muted-foreground", tertiaryHsl);
        root.style.setProperty("--border", `${secondaryHsl.split(' ')[0]} ${secondaryHsl.split(' ')[1]} ${Math.max(parseInt(secondaryHsl.split(' ')[2]) - 15, 80)}%`);
        root.style.setProperty("--input", `${secondaryHsl.split(' ')[0]} ${secondaryHsl.split(' ')[1]} ${Math.max(parseInt(secondaryHsl.split(' ')[2]) - 15, 80)}%`);
      }
    } else {
      // Use default colors when no custom colors
      if (newTheme === "dark") {
        root.style.setProperty("--background", "0 0% 4%");
        root.style.setProperty("--foreground", "0 0% 98%");
        root.style.setProperty("--card", "0 0% 7%");
        root.style.setProperty("--card-foreground", "0 0% 98%");
        root.style.setProperty("--muted", "0 0% 15%");
        root.style.setProperty("--muted-foreground", "0 0% 60%");
        root.style.setProperty("--border", "0 0% 14%");
        root.style.setProperty("--input", "0 0% 14%");
      } else {
        root.style.setProperty("--background", "0 0% 98%");
        root.style.setProperty("--foreground", "0 0% 8%");
        root.style.setProperty("--card", "0 0% 100%");
        root.style.setProperty("--card-foreground", "0 0% 8%");
        root.style.setProperty("--muted", "0 0% 92%");
        root.style.setProperty("--muted-foreground", "0 0% 40%");
        root.style.setProperty("--border", "0 0% 88%");
        root.style.setProperty("--input", "0 0% 88%");
      }
      root.style.setProperty("--primary", primaryHsl);
    }
  }, [mode, customColors]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    setCookie("theme-mode", newMode);
  };

  const setCustomColors = (colors: ModedColors | null) => {
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
