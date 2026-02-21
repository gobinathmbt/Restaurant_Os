import mongoose from 'mongoose';

const timeBasedPricingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  startTime: {
    type: String, // HH:mm format
    required: true
  },
  endTime: {
    type: String, // HH:mm format
    required: true
  },
  days: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }],
  price: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const availabilityScheduleSchema = new mongoose.Schema({
  startTime: String,
  endTime: String,
  days: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }]
}, { _id: false });

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
    default: [],
    validate: {
      validator: function(options) {
        return options.length > 0;
      },
      message: 'Modifier must have at least one option'
    }
  }
}, { _id: false });

const menuItemBranchSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
    index: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
    index: true
  },
  
  // PRICING
  price: {
    type: Number,
    required: true,
    min: 0
  },
  timeBasedPricing: {
    type: [timeBasedPricingSchema],
    default: []
  },
  
  // AVAILABILITY
  isAvailable: {
    type: Boolean,
    default: true
  },
  availability: {
    schedule: {
      type: [availabilityScheduleSchema],
      default: []
    }
  },
  
  // OPERATIONS
  preparationTime: {
    type: Number, // minutes
    default: 15,
    min: 0
  },
  requiresKitchen: {
    type: Boolean,
    default: true
  },
  
  // INVENTORY
  outOfStock: {
    type: Boolean,
    default: false
  },
  lowStockThreshold: {
    type: Number,
    min: 0
  },
  
  // TAX & DISPLAY
  taxRateOverride: {
    type: Number,
    min: 0,
    max: 100
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  
  // SALES CHANNELS
  channels: {
    type: [String],
    enum: ['dine_in', 'takeaway', 'online'],
    default: ['dine_in', 'takeaway', 'online']
  },
  
  // MODIFIERS AND ADD-ONS
  modifiers: {
    type: [modifierSchema],
    default: []
  },
  addOns: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem'
  }],
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for unique constraint and fast lookups
menuItemBranchSchema.index({ menuItem: 1, branch: 1 }, { unique: true });
menuItemBranchSchema.index({ branch: 1, isActive: 1 });
menuItemBranchSchema.index({ menuItem: 1, isActive: 1 });

// Pre-save hook to prevent self-referencing add-ons
menuItemBranchSchema.pre('save', async function(next) {
  if (this.isModified('addOns') && this.addOns.length > 0) {
    // Check for self-reference
    const hasSelfReference = this.addOns.some(
      addOnId => addOnId.toString() === this.menuItem.toString()
    );
    
    if (hasSelfReference) {
      throw new Error('Menu item cannot reference itself as an add-on');
    }
  }
  next();
});

// Method to get effective price (considering time-based pricing)
menuItemBranchSchema.methods.getEffectivePrice = function() {
  if (!this.timeBasedPricing || this.timeBasedPricing.length === 0) {
    return this.price;
  }

  const now = new Date();
  const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const activePrice = this.timeBasedPricing.find(pricing => {
    if (!pricing.isActive) return false;
    if (!pricing.days.includes(currentDay)) return false;
    return currentTime >= pricing.startTime && currentTime <= pricing.endTime;
  });

  return activePrice ? activePrice.price : this.price;
};

// Method to check if item is available now
menuItemBranchSchema.methods.isAvailableNow = function() {
  if (!this.isAvailable || this.outOfStock) {
    return false;
  }

  if (!this.availability.schedule || this.availability.schedule.length === 0) {
    return true;
  }

  const now = new Date();
  const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return this.availability.schedule.some(schedule => {
    if (!schedule.days.includes(currentDay)) {
      return false;
    }
    return currentTime >= schedule.startTime && currentTime <= schedule.endTime;
  });
};

// Method to populate add-ons with MenuItem details
menuItemBranchSchema.methods.populateAddOns = async function() {
  await this.populate({
    path: 'addOns',
    select: 'name basePrice description images isActive'
  });
  return this;
};

export const getMenuItemBranchModel = (companyDB) => {
  return companyDB.model('MenuItemBranch', menuItemBranchSchema);
};
