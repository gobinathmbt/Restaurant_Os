// Menu-related TypeScript interfaces

export interface ModifierOption {
  name: string;
  price: number;
}

export interface Modifier {
  name: string;
  options: ModifierOption[];
}

export interface AddOn {
  name: string;
  price: number;
}

// NEW: Branch-specific modifier and add-on interfaces
export interface BranchModifierOption {
  name: string;
  price: number;
}

export interface BranchModifier {
  name: string;
  options: BranchModifierOption[];
}

export interface AddOnMenuItem {
  _id: string;
  name: string;
  basePrice: number;
  description?: string;
  images?: Array<{
    url: string;
    displayOrder: number;
  }>;
  isActive: boolean;
  hasRecipe?: boolean;
}

export interface TimeBasedPricing {
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
  price: number;
  isActive: boolean;
}

export interface AvailabilitySchedule {
  startTime: string;
  endTime: string;
  days: string[];
}

export interface BranchConfig {
  price: number;
  isAvailable: boolean;
  preparationTime: number;
  requiresKitchen: boolean;
  outOfStock: boolean;
  lowStockThreshold?: number;
  taxRateOverride?: number;
  displayOrder: number;
  channels: string[];
  timeBasedPricing: TimeBasedPricing[];
  availability: {
    schedule: AvailabilitySchedule[];
  };
  // NEW: Branch-specific modifiers and add-ons
  modifiers?: BranchModifier[];
  addOns?: string[]; // Array of MenuItem IDs
}

export interface MenuItemBranch {
  _id: string;
  branch: {
    _id: string;
    name: string;
    code: string;
  };
  menuItem: string;
  price: number;
  isAvailable: boolean;
  preparationTime: number;
  requiresKitchen: boolean;
  outOfStock: boolean;
  lowStockThreshold?: number;
  taxRateOverride?: number;
  displayOrder: number;
  channels: string[];
  timeBasedPricing: TimeBasedPricing[];
  availability: {
    schedule: AvailabilitySchedule[];
  };
  // NEW: Branch-specific modifiers and add-ons
  modifiers?: BranchModifier[];
  addOns?: AddOnMenuItem[]; // Populated add-on menu items
}

export interface MenuCategory {
  _id: string;
  name: string;
  color?: string;
}

export interface Branch {
  _id: string;
  name: string;
  code: string;
}

export interface MenuItem {
  _id: string;
  name: string;
  description?: string;
  category: string | MenuCategory;
  basePrice: number;
  images?: Array<{
    url: string;
    displayOrder: number;
  }>;
  isVeg: boolean;
  spiceLevel: string;
  modifiers: Modifier[]; // Legacy - will be removed after migration
  addOns: AddOn[]; // Legacy - will be removed after migration
  tags: string[];
  hsnCode?: string;
  isActive: boolean;
  branches?: MenuItemBranch[];
}

export interface MergedMenuItem {
  _id: string;
  name: string;
  description?: string;
  category: MenuCategory;
  basePrice: number;
  images: Array<{
    url: string;
    displayOrder: number;
  }>;
  isVeg: boolean;
  spiceLevel: string;
  modifiers: Modifier[]; // Legacy
  addOns: AddOn[]; // Legacy
  tags: string[];
  hsnCode?: string;
  branchConfig: {
    price: number;
    effectivePrice: number;
    timeBasedPricing: TimeBasedPricing[];
    isAvailable: boolean;
    availability: {
      schedule: AvailabilitySchedule[];
    };
    outOfStock: boolean;
    preparationTime: number;
    requiresKitchen: boolean;
    lowStockThreshold?: number;
    taxRateOverride?: number;
    displayOrder: number;
    channels: string[];
    // NEW: Branch-specific modifiers and add-ons
    modifiers?: BranchModifier[];
    addOns?: AddOnMenuItem[];
  };
  branches?: MenuItemBranch[];
  isActive: boolean;
}
