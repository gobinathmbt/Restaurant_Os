import mongoose from 'mongoose';

/**
 * RecipeBranch Schema
 * Stores branch-specific configuration for recipes
 * Follows the pattern established by MenuItemBranch and InventoryItemBranch
 */
const recipeBranchSchema = new mongoose.Schema({
  recipe: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe',
    required: true,
    index: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
    index: true
  },
  
  // Ingredients (location-based inventory references)
  ingredients: [{
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    unit: {
      type: String,
      required: true,
      enum: ['kg', 'gram', 'liter', 'ml', 'piece', 'dozen', 'packet']
    },
    // Manual conversion factor (optional)
    // If set, overrides automatic unit conversion
    // Example: 1 kg tomato = 5 pieces, conversionFactor = 5
    conversionFactor: {
      type: Number,
      min: 0
    },
    // Override cost per unit (optional)
    // If set, uses this instead of calculated cost from inventory
    overrideCostPerUnit: {
      type: Number,
      min: 0
    }
  }],
  
  // Yield
  yield: {
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    unit: {
      type: String,
      required: true,
      enum: ['kg', 'gram', 'liter', 'ml', 'piece', 'dozen', 'packet', 'serving']
    }
  },
  
  // Timing
  preparationTime: {
    type: Number,
    min: 0
  },
  cookingTime: {
    type: Number,
    min: 0
  },
  
  // Cost
  costPerUnit: {
    type: Number,
    min: 0
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Branch-specific notes
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Virtual field: totalTime
recipeBranchSchema.virtual('totalTime').get(function() {
  const prepTime = this.preparationTime || 0;
  const cookTime = this.cookingTime || 0;
  return prepTime + cookTime;
});

// Ensure virtuals are included in JSON output
recipeBranchSchema.set('toJSON', { virtuals: true });
recipeBranchSchema.set('toObject', { virtuals: true });

// Method: calculateCost with unit conversion support
recipeBranchSchema.methods.calculateCost = async function() {
  // If no ingredients or no yield, cost is zero
  if (!this.ingredients || this.ingredients.length === 0 || 
      !this.yield || !this.yield.quantity || this.yield.quantity === 0) {
    this.costPerUnit = 0;
    return this.costPerUnit;
  }

  // Populate ingredient location data to access costing information and inventory item details
  await this.populate({
    path: 'ingredients.inventoryItem',
    select: 'unit'
  });

  // Import unit conversion utility
  const unitConversion = await import('../../utils/unitConversion.js');
  
  // Import InventoryItemLocation model
  const { getInventoryItemLocationModel } = await import('./InventoryItemLocation.js');
  const InventoryItemLocation = getInventoryItemLocationModel(this.constructor.db);

  let totalCost = 0;
  for (const ingredient of this.ingredients) {
    // Check if override cost is set
    if (ingredient.overrideCostPerUnit !== undefined && ingredient.overrideCostPerUnit !== null) {
      // Use override cost directly
      totalCost += ingredient.quantity * ingredient.overrideCostPerUnit;
      continue;
    }

    // Fetch InventoryItemLocation for this ingredient
    const inventoryItemLocation = await InventoryItemLocation.findOne({
      inventoryItem: ingredient.inventoryItem._id || ingredient.inventoryItem,
      locationId: ingredient.locationId
    }).populate('inventoryItem');

    // If location config exists and has costing information, calculate with unit conversion
    if (inventoryItemLocation) {
      let inventoryPrice = 0;
      
      // Determine price based on costing method
      if (inventoryItemLocation.costingMethod === 'STANDARD_COST' && inventoryItemLocation.standardCost) {
        inventoryPrice = inventoryItemLocation.standardCost;
      } else if (inventoryItemLocation.lastPurchasePrice) {
        inventoryPrice = inventoryItemLocation.lastPurchasePrice;
      }
      
      if (inventoryPrice > 0) {
        const inventoryUnit = inventoryItemLocation.inventoryItem?.unit || ingredient.unit;
        const recipeUnit = ingredient.unit;
        const recipeQuantity = ingredient.quantity;
        const manualConversionFactor = ingredient.conversionFactor;

        // Calculate cost with unit conversion
        const costCalc = unitConversion.calculateIngredientCost(
          recipeQuantity,
          recipeUnit,
          inventoryPrice,
          inventoryUnit,
          manualConversionFactor
        );

        totalCost += costCalc.totalCost;
      }
    }
  }

  // Calculate cost per unit by dividing total cost by yield quantity
  this.costPerUnit = totalCost / this.yield.quantity;
  return this.costPerUnit;
};

// Pre-save hook: Validate ingredient locations and auto-assign if needed
recipeBranchSchema.pre('save', async function(next) {
  if (this.isModified('ingredients') && this.ingredients.length > 0) {
    const { getInventoryItemLocationModel } = await import('./InventoryItemLocation.js');
    const InventoryItemLocation = getInventoryItemLocationModel(this.constructor.db);
    
    for (const ingredient of this.ingredients) {
      // Check if inventoryItemLocation exists for this item and location
      const inventoryItemLocation = await InventoryItemLocation.findOne({
        inventoryItem: ingredient.inventoryItem,
        locationId: ingredient.locationId
      });
      
      if (!inventoryItemLocation) {
        // Auto-create location configuration for this inventory item
        console.log(`Auto-assigning inventory item ${ingredient.inventoryItem} to location ${ingredient.locationId}`);
        
        const newLocationConfig = new InventoryItemLocation({
          inventoryItem: ingredient.inventoryItem,
          locationId: ingredient.locationId,
          availableQuantity: 0,
          reservedQuantity: 0,
          inTransitQuantity: 0,
          minimumStock: 0,
          costingMethod: 'FIFO',
          isActive: true
        });

        await newLocationConfig.save();
        console.log(`Created new location config for inventory item ${ingredient.inventoryItem} in location ${ingredient.locationId}`);
      }
      
      // Validate that ingredient location matches recipe branch location
      if (ingredient.locationId.toString() !== this.branch.toString()) {
        console.log(`Warning: Ingredient location ${ingredient.locationId} does not match recipe branch ${this.branch}`);
        // Note: We allow this for flexibility, but log a warning
      }
    }
  }
  next();
});

// Compound unique index: one config per recipe per branch
recipeBranchSchema.index({ recipe: 1, branch: 1 }, { unique: true });

// Additional indexes for queries
recipeBranchSchema.index({ branch: 1, isActive: 1 });
recipeBranchSchema.index({ recipe: 1, isActive: 1 });

export const getRecipeBranchModel = (companyDB) => {
  return companyDB.model('RecipeBranch', recipeBranchSchema);
};

export default recipeBranchSchema;
