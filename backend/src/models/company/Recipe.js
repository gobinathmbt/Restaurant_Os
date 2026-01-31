import mongoose from 'mongoose';

const recipeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  finishedGood: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  ingredients: [{
    rawMaterial: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    unit: {
      type: String,
      required: true
    }
  }],
  yield: {
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    unit: {
      type: String,
      required: true
    }
  },
  preparationSteps: [{
    stepNumber: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    }
  }],
  preparationTime: {
    type: Number,
    min: 0
  },
  cookingTime: {
    type: Number,
    min: 0
  },
  costPerUnit: {
    type: Number,
    min: 0
  },
  version: {
    type: Number,
    required: true,
    default: 1,
    min: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Method to calculate cost per unit
recipeSchema.methods.calculateCost = async function() {
  if (!this.ingredients || this.ingredients.length === 0 || !this.yield || !this.yield.quantity) {
    this.costPerUnit = 0;
    return this.costPerUnit;
  }

  // Get the model to populate ingredients
  const Recipe = this.constructor;
  await this.populate('ingredients.rawMaterial');

  let totalCost = 0;
  for (const ingredient of this.ingredients) {
    if (ingredient.rawMaterial && ingredient.rawMaterial.costPrice) {
      totalCost += ingredient.quantity * ingredient.rawMaterial.costPrice;
    }
  }

  this.costPerUnit = totalCost / this.yield.quantity;
  return this.costPerUnit;
};

// Virtual field: totalTime
recipeSchema.virtual('totalTime').get(function() {
  const prepTime = this.preparationTime || 0;
  const cookTime = this.cookingTime || 0;
  return prepTime + cookTime;
});

// Ensure virtuals are included in JSON output
recipeSchema.set('toJSON', { virtuals: true });
recipeSchema.set('toObject', { virtuals: true });

// Indexes
recipeSchema.index({ finishedGood: 1 });
recipeSchema.index({ name: 1 });
recipeSchema.index({ isActive: 1 });
recipeSchema.index({ finishedGood: 1, isActive: 1 });

export const getRecipeModel = (companyDB) => {
  return companyDB.model('Recipe', recipeSchema);
};

export default recipeSchema;
