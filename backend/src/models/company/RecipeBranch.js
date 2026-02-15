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
    ref: 'Branch',
    required: true,
    index: true
  },
  
  // Ingredients (branch-specific inventory references)
  ingredients: [{
    inventoryItemBranch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItemBranch',
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

// Method: calculateCost
recipeBranchSchema.methods.calculateCost = async function() {
  // If no ingredients or no yield, cost is zero
  if (!this.ingredients || this.ingredients.length === 0 || 
      !this.yield || !this.yield.quantity || this.yield.quantity === 0) {
    this.costPerUnit = 0;
    return this.costPerUnit;
  }

  // Populate ingredient branch data to access costPrice
  await this.populate('ingredients.inventoryItemBranch');

  let totalCost = 0;
  for (const ingredient of this.ingredients) {
    // If ingredient has costPrice, add to total cost
    // If costPrice is unavailable, treat as zero (Requirement 3.3)
    if (ingredient.inventoryItemBranch && ingredient.inventoryItemBranch.costPrice) {
      totalCost += ingredient.quantity * ingredient.inventoryItemBranch.costPrice;
    }
  }

  // Calculate cost per unit by dividing total cost by yield quantity
  this.costPerUnit = totalCost / this.yield.quantity;
  return this.costPerUnit;
};

// Pre-save hook: Validate ingredient branches and auto-assign if needed
recipeBranchSchema.pre('save', async function(next) {
  if (this.isModified('ingredients') && this.ingredients.length > 0) {
    const InventoryItemBranch = this.constructor.db.model('InventoryItemBranch');
    
    for (const ingredient of this.ingredients) {
      // Check if inventoryItemBranch exists
      const inventoryItemBranch = await InventoryItemBranch.findById(
        ingredient.inventoryItemBranch
      );
      
      if (!inventoryItemBranch) {
        throw new Error(`InventoryItemBranch ${ingredient.inventoryItemBranch} not found`);
      }
      
      // Check if ingredient belongs to the same branch
      if (inventoryItemBranch.branch.toString() !== this.branch.toString()) {
        // Instead of throwing error, auto-assign the inventory item to the branch
        console.log(`Auto-assigning inventory item ${inventoryItemBranch.inventoryItem} to branch ${this.branch}`);
        
        // Check if this inventory item already has a branch config for the target branch
        const existingBranchConfig = await InventoryItemBranch.findOne({
          inventoryItem: inventoryItemBranch.inventoryItem,
          branch: this.branch
        });

        if (!existingBranchConfig) {
          // Create new branch configuration for this inventory item
          const newBranchConfig = new InventoryItemBranch({
            inventoryItem: inventoryItemBranch.inventoryItem,
            branch: this.branch,
            quantity: 0, // Start with 0 quantity
            minStockLevel: inventoryItemBranch.minStockLevel || 0,
            maxStockLevel: inventoryItemBranch.maxStockLevel || 0,
            reorderPoint: inventoryItemBranch.reorderPoint || 0,
            reorderQuantity: inventoryItemBranch.reorderQuantity || 0,
            costPrice: inventoryItemBranch.costPrice || 0,
            isAvailable: true,
            isActive: true
          });

          await newBranchConfig.save();
          console.log(`Created new branch config for inventory item ${inventoryItemBranch.inventoryItem} in branch ${this.branch}`);
        }
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
