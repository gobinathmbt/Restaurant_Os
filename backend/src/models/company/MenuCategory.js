import mongoose from 'mongoose';

const menuCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  branchIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  }],
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  color: {
    type: String,
    default: '#6366f1'
  },
  icon: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  versionKey: '__v' // Explicitly enable versioning
});

// Indexes
menuCategorySchema.index({ name: 1 });
menuCategorySchema.index({ branchIds: 1 });
menuCategorySchema.index({ displayOrder: 1 });
menuCategorySchema.index({ isActive: 1 });
// Additional index for category-branch queries
menuCategorySchema.index({ _id: 1, branchIds: 1 });

export const getMenuCategoryModel = (companyDB) => {
  return companyDB.model('MenuCategory', menuCategorySchema);
};
