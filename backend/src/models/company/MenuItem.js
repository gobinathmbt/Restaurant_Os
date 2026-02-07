import mongoose from 'mongoose';

const modifierOptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const modifierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  options: {
    type: [modifierOptionSchema],
    default: []
  }
}, { _id: false });

const addOnSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Menu item name is required'],
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuCategory',
    required: true
  },
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  images: {
    type: [imageSchema],
    default: []
  },
  isVeg: {
    type: Boolean,
    default: true
  },
  spiceLevel: {
    type: String,
    enum: ['none', 'mild', 'medium', 'hot', 'extra_hot'],
    default: 'none'
  },
  modifiers: {
    type: [modifierSchema],
    default: []
  },
  addOns: {
    type: [addOnSchema],
    default: []
  },
  tags: {
    type: [String],
    trim: true,
    default: []
  },
  hsnCode: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for performance
menuItemSchema.index({ name: 1 });
menuItemSchema.index({ category: 1 });
menuItemSchema.index({ isActive: 1 });
menuItemSchema.index({ tags: 1 });

export const getMenuItemModel = (companyDB) => {
  return companyDB.model('MenuItem', menuItemSchema);
};
