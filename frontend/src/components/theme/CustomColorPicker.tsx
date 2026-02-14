import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme, CustomColors, ModedColors } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

interface CustomColorPickerProps {
  isOpen: boolean;
  onClose: () => void;
  currentColors: ModedColors | null;
  onSave: (colors: ModedColors) => void;
}

interface ColorInputState {
  primary: string;
  secondary: string;
  tertiary: string;
}

// Comprehensive preset themes with both dark and light mode colors
const PRESET_THEMES = [
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

export function CustomColorPicker({
  isOpen,
  onClose,
  currentColors,
  onSave,
}: CustomColorPickerProps) {
  const { currentTheme } = useTheme();
  const [colorsDark, setColorsDark] = useState<ColorInputState>(
    currentColors?.dark || {
      primary: "#22c55e",
      secondary: "#0a0a0a",
      tertiary: "#ffffff",
    }
  );

  const [colorsLight, setColorsLight] = useState<ColorInputState>(
    currentColors?.light || {
      primary: "#16a34a",
      secondary: "#f5f5f5",
      tertiary: "#1f2937",
    }
  );

  const [activeTab, setActiveTab] = useState<"dark" | "light">(currentTheme);

  useEffect(() => {
    if (currentColors) {
      setColorsDark(currentColors.dark);
      setColorsLight(currentColors.light);
    }
  }, [currentColors]);

  const currentColors_display = activeTab === "dark" ? colorsDark : colorsLight;

  const handleColorChange = (
    key: keyof ColorInputState,
    value: string,
    theme: "dark" | "light" = activeTab
  ) => {
    if (theme === "dark") {
      setColorsDark((prev) => ({
        ...prev,
        [key]: value,
      }));
    } else {
      setColorsLight((prev) => ({
        ...prev,
        [key]: value,
      }));
    }
  };

  const handlePresetSelect = (preset: typeof PRESET_THEMES[0]) => {
    setColorsDark(preset.dark);
    setColorsLight(preset.light);
  };

  const handleSave = () => {
    onSave({
      dark: colorsDark,
      light: colorsLight,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-border">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border flex items-center justify-between p-6">
          <h2 className="text-lg font-semibold">Customize Theme Colors</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Tab Selection */}
          <div className="flex gap-2 border-b border-border">
            <button
              onClick={() => setActiveTab("dark")}
              className={cn(
                "px-4 py-2 font-medium text-sm transition-colors border-b-2 -mb-[2px]",
                activeTab === "dark"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Dark Mode
            </button>
            <button
              onClick={() => setActiveTab("light")}
              className={cn(
                "px-4 py-2 font-medium text-sm transition-colors border-b-2 -mb-[2px]",
                activeTab === "light"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Light Mode
            </button>
          </div>

          {/* Color Inputs */}
          <div className="space-y-4">
            {/* Primary Color */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Primary Color (Action/Accent)
              </label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={currentColors_display.primary}
                  onChange={(e) => handleColorChange("primary", e.target.value)}
                  className="w-16 h-10 rounded cursor-pointer border border-border"
                />
                <input
                  type="text"
                  value={currentColors_display.primary}
                  onChange={(e) => handleColorChange("primary", e.target.value)}
                  placeholder="#000000"
                  className="flex-1 px-3 py-2 rounded border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Secondary Color */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Secondary Color (Background)
              </label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={currentColors_display.secondary}
                  onChange={(e) => handleColorChange("secondary", e.target.value)}
                  className="w-16 h-10 rounded cursor-pointer border border-border"
                />
                <input
                  type="text"
                  value={currentColors_display.secondary}
                  onChange={(e) => handleColorChange("secondary", e.target.value)}
                  placeholder="#000000"
                  className="flex-1 px-3 py-2 rounded border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Tertiary Color */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Tertiary Color (Text/Foreground)
              </label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={currentColors_display.tertiary}
                  onChange={(e) => handleColorChange("tertiary", e.target.value)}
                  className="w-16 h-10 rounded cursor-pointer border border-border"
                />
                <input
                  type="text"
                  value={currentColors_display.tertiary}
                  onChange={(e) => handleColorChange("tertiary", e.target.value)}
                  placeholder="#000000"
                  className="flex-1 px-3 py-2 rounded border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Color Preview */}
            <div className="mt-4 p-4 rounded border border-border bg-muted/30">
              <p className="text-xs font-medium mb-3 text-muted-foreground">
                Preview - {activeTab === "dark" ? "Dark Mode" : "Light Mode"}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <div
                    className="h-16 rounded border border-border"
                    style={{ backgroundColor: currentColors_display.primary }}
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Primary
                  </p>
                </div>
                <div className="space-y-2">
                  <div
                    className="h-16 rounded border border-border"
                    style={{ backgroundColor: currentColors_display.secondary }}
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Secondary
                  </p>
                </div>
                <div className="space-y-2">
                  <div
                    className="h-16 rounded border border-border"
                    style={{ backgroundColor: currentColors_display.tertiary }}
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Tertiary
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Preset Themes */}
          <div>
            <p className="text-sm font-medium mb-3">Quick Presets</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {PRESET_THEMES.map((preset) => {
                const presetColors =
                  activeTab === "dark" ? preset.dark : preset.light;
                const isSelected =
                  JSON.stringify(currentColors_display) === JSON.stringify(presetColors);
                return (
                  <button
                    key={preset.name}
                    onClick={() => handlePresetSelect(preset)}
                    className={cn(
                      "p-3 rounded border text-xs font-medium transition-all hover:border-primary",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <div className="flex gap-1.5 mb-2">
                      <div
                        className="w-3 h-3 rounded-full border border-foreground/20"
                        style={{ backgroundColor: presetColors.primary }}
                      />
                      <div
                        className="w-3 h-3 rounded-full border border-foreground/20"
                        style={{ backgroundColor: presetColors.secondary }}
                      />
                      <div
                        className="w-3 h-3 rounded-full border border-foreground/20"
                        style={{ backgroundColor: presetColors.tertiary }}
                      />
                    </div>
                    <span className="block text-center">{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 sticky bottom-0 bg-card border-t border-border pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Apply Theme
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
