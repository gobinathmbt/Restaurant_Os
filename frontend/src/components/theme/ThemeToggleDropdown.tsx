import { useState } from "react";
import { Moon, Sun, Monitor, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, ThemeMode } from "@/contexts/ThemeContext";
import { CustomColorPicker } from "./CustomColorPicker";

export function ThemeToggleDropdown() {
  const { mode, setMode, customColors, setCustomColors } = useTheme();
  const [showCustomColors, setShowCustomColors] = useState(false);

  const getThemeIcon = () => {
    if (mode === "system") return <Monitor className="h-4 w-4" />;
    if (mode === "dark") return <Moon className="h-4 w-4" />;
    return <Sun className="h-4 w-4" />;
  };

  const getModeLabel = () => {
    const labels: Record<ThemeMode, string> = {
      dark: "Dark Mode",
      light: "Light Mode",
      system: "System Default",
    };
    return labels[mode];
  };

  const handleModeChange = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative group">
            {getThemeIcon()}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-neutral-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {getModeLabel()}
            </div>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="flex items-center gap-2">
            Theme Settings
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Mode Selection */}
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
            Theme Mode
          </DropdownMenuLabel>

          <DropdownMenuCheckboxItem
            checked={mode === "dark"}
            onCheckedChange={() => handleModeChange("dark")}
            className="cursor-pointer flex items-center gap-2"
          >
            <Moon className="h-4 w-4" />
            <span>Dark Mode</span>
          </DropdownMenuCheckboxItem>

          <DropdownMenuCheckboxItem
            checked={mode === "light"}
            onCheckedChange={() => handleModeChange("light")}
            className="cursor-pointer flex items-center gap-2"
          >
            <Sun className="h-4 w-4" />
            <span>Light Mode</span>
          </DropdownMenuCheckboxItem>

          <DropdownMenuCheckboxItem
            checked={mode === "system"}
            onCheckedChange={() => handleModeChange("system")}
            className="cursor-pointer flex items-center gap-2"
          >
            <Monitor className="h-4 w-4" />
            <span>System Default</span>
          </DropdownMenuCheckboxItem>

          <DropdownMenuSeparator />

          {/* Custom Colors Option */}
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
            Customization
          </DropdownMenuLabel>

          <DropdownMenuItem
            onClick={() => setShowCustomColors(true)}
            className="cursor-pointer flex items-center gap-2"
          >
            <Palette className="h-4 w-4" />
            <span>Custom Colors</span>
            {customColors && (
              <div className="ml-auto flex gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: customColors.primary }}
                />
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: customColors.secondary }}
                />
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: customColors.tertiary }}
                />
              </div>
            )}
          </DropdownMenuItem>

          {customColors && (
            <DropdownMenuItem
              onClick={() => setCustomColors(null)}
              className="cursor-pointer text-xs text-muted-foreground"
            >
              ↻ Reset to Default
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Custom Color Picker Dialog */}
      {showCustomColors && (
        <CustomColorPicker
          isOpen={showCustomColors}
          onClose={() => setShowCustomColors(false)}
          currentColors={customColors}
          onSave={(colors) => {
            setCustomColors(colors);
            setShowCustomColors(false);
          }}
        />
      )}
    </>
  );
}
