import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  type: {
    type: String,
    enum: ['raw_material', 'finished_good', 'both'],
    default: 'both'
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
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
  timestamps: true
});

// Indexes for faster queries
categorySchema.index({ name: 1, branchId: 1 });
categorySchema.index({ branchId: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ displayOrder: 1 });
categorySchema.index({ type: 1 });

// Virtual for subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent'
});

// Ensure virtuals are included in JSON output
categorySchema.set('toJSON', { virtuals: true });
categorySchema.set('toObject', { virtuals: true });

// Method to get full category path
categorySchema.methods.getPath = async function() {
  const path = [this.name];
  let current = this;
  
  while (current.parent) {
    current = await this.model('Category').findById(current.parent);
    if (current) {
      path.unshift(current.name);
    }
  }
  
  return path.join(' > ');
};

// Static method to get category tree
categorySchema.statics.getTree = async function(branchId, parentId = null) {
  const categories = await this.find({ 
    branchId, 
    parent: parentId, 
    isActive: true 
  }).sort({ displayOrder: 1, name: 1 });
  
  const tree = [];
  for (const category of categories) {
    const subcategories = await this.getTree(branchId, category._id);
    tree.push({
      ...category.toObject(),
      subcategories
    });
  }
  
  return tree;
};

export const getCategoryModel = (companyDB) => {
  return companyDB.model('Category', categorySchema);
};

export default categorySchema;
