import mongoose from 'mongoose';

const recipeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  finishedGood: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
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
