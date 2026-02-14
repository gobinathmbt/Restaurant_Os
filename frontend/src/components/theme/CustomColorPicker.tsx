import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomColors } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

interface CustomColorPickerProps {
  isOpen: boolean;
  onClose: () => void;
  currentColors: CustomColors | null;
  onSave: (colors: CustomColors) => void;
}

interface ColorInputState {
  primary: string;
  secondary: string;
  tertiary: string;
}

const PRESET_THEMES = [
  {
    name: "Carbon Green (Default)",
    colors: {
      primary: "#22c55e",   // success / action
      secondary: "#0b1220", // dark surface
      tertiary: "#e5e7eb",  // text
    },
  },
  {
    name: "Midnight Blue",
    colors: {
      primary: "#38bdf8",
      secondary: "#020617",
      tertiary: "#e2e8f0",
    },
  },
  {
    name: "Royal Purple",
    colors: {
      primary: "#a855f7",
      secondary: "#12091f",
      tertiary: "#f3e8ff",
    },
  },
  {
    name: "Amber Night",
    colors: {
      primary: "#f59e0b",
      secondary: "#111827",
      tertiary: "#fef3c7",
    },
  },
  {
    name: "Clean Mint",
    colors: {
      primary: "#10b981",
      secondary: "#ffffff",
      tertiary: "#0f172a",
    },
  },
  {
    name: "Soft Sky",
    colors: {
      primary: "#0ea5e9",
      secondary: "#f8fafc",
      tertiary: "#020617",
    },
  },
  {
    name: "Graphite Pro",
    colors: {
      primary: "#6366f1",
      secondary: "#1f2933",
      tertiary: "#e5e7eb",
    },
  },
  {
    name: "Rose Dark",
    colors: {
      primary: "#fb7185",
      secondary: "#1f2937",
      tertiary: "#ffe4e6",
    },
  },
  {
    name: "Emerald Noir",
    colors: {
      primary: "#34d399",
      secondary: "#052e2b",
      tertiary: "#ecfdf5",
    },
  },
  {
    name: "Slate Orange",
    colors: {
      primary: "#f97316",
      secondary: "#1e293b",
      tertiary: "#fff7ed",
    },
  },
];


export function CustomColorPicker({
  isOpen,
  onClose,
  currentColors,
  onSave,
}: CustomColorPickerProps) {
  const [colors, setColors] = useState<ColorInputState>(
    currentColors || {
      primary: "#22c55e",
      secondary: "#0a0a0a",
      tertiary: "#ffffff",
    }
  );

  useEffect(() => {
    if (currentColors) {
      setColors(currentColors);
    }
  }, [currentColors]);

  const handleColorChange = (
    key: keyof ColorInputState,
    value: string
  ) => {
    setColors((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handlePresetSelect = (presetColors: CustomColors) => {
    setColors(presetColors);
  };

  const handleSave = () => {
    onSave(colors);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full mx-4 p-6 border border-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Customize Theme Colors</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Color Inputs */}
        <div className="space-y-4 mb-6">
          {/* Primary Color */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Primary Color
            </label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={colors.primary}
                onChange={(e) => handleColorChange("primary", e.target.value)}
                className="w-16 h-10 rounded cursor-pointer border border-border"
              />
              <input
                type="text"
                value={colors.primary}
                onChange={(e) => handleColorChange("primary", e.target.value)}
                placeholder="#000000"
                className="flex-1 px-3 py-2 rounded border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Secondary Color */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Secondary Color
            </label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={colors.secondary}
                onChange={(e) => handleColorChange("secondary", e.target.value)}
                className="w-16 h-10 rounded cursor-pointer border border-border"
              />
              <input
                type="text"
                value={colors.secondary}
                onChange={(e) => handleColorChange("secondary", e.target.value)}
                placeholder="#000000"
                className="flex-1 px-3 py-2 rounded border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Tertiary Color */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Tertiary Color
            </label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={colors.tertiary}
                onChange={(e) => handleColorChange("tertiary", e.target.value)}
                className="w-16 h-10 rounded cursor-pointer border border-border"
              />
              <input
                type="text"
                value={colors.tertiary}
                onChange={(e) => handleColorChange("tertiary", e.target.value)}
                placeholder="#000000"
                className="flex-1 px-3 py-2 rounded border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Color Preview */}
          <div className="mt-4 p-3 rounded border border-border bg-muted/30">
            <p className="text-xs font-medium mb-2 text-muted-foreground">
              Preview
            </p>
            <div className="flex gap-2">
              <div
                className="flex-1 h-8 rounded border border-border"
                style={{ backgroundColor: colors.primary }}
                title="Primary"
              />
              <div
                className="flex-1 h-8 rounded border border-border"
                style={{ backgroundColor: colors.secondary }}
                title="Secondary"
              />
              <div
                className="flex-1 h-8 rounded border border-border"
                style={{ backgroundColor: colors.tertiary }}
                title="Tertiary"
              />
            </div>
          </div>
        </div>

        {/* Preset Themes */}
        <div className="mb-6">
          <p className="text-sm font-medium mb-3">Quick Presets</p>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {PRESET_THEMES.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePresetSelect(preset.colors)}
                className={cn(
                  "p-2 rounded border text-xs font-medium transition-all hover:border-primary-500",
                  JSON.stringify(colors) === JSON.stringify(preset.colors)
                    ? "border-primary-500 bg-primary-500/10"
                    : "border-border hover:bg-muted"
                )}
              >
                <div className="flex gap-1.5 mb-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: preset.colors.primary }}
                  />
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: preset.colors.secondary }}
                  />
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: preset.colors.tertiary }}
                  />
                </div>
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1 bg-primary-500 hover:bg-primary-600">
            Apply Theme
          </Button>
        </div>
      </div>
    </div>
  );
}
