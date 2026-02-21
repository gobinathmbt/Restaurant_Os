import mongoose from 'mongoose';

/**
 * Location Schema
 * Unified model for all location types: branches, warehouses, central kitchens, cloud kitchens
 * Replaces the branch-specific approach with a flexible location-based architecture
 */
const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  type: {
    type: String,
    required: true,
    enum: ['branch', 'warehouse', 'central_kitchen', 'cloud_kitchen']
  },
  
  // Configurable capabilities
  capabilities: {
    canProcureDirectly: {
      type: Boolean,
      default: false
    },
    canDispatchStock: {
      type: Boolean,
      default: false
    },
    canReceiveStock: {
      type: Boolean,
      default: false
    },
    isProductionUnit: {
      type: Boolean,
      default: false
    },
    allowsCustomerOrders: {
      type: Boolean,
      default: false
    }
  },
  
  // Optional preferred warehouse for procurement
  preferredWarehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  
  // Branch-specific fields (when type === 'branch')
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },
  contact: {
    phone: String,
    email: String,
    manager: String
  },
  gstNumber: {
    type: String,
    trim: true
  },
  fssaiLicense: {
    type: String,
    trim: true
  },
  operatingHours: {
    type: Map,
    of: {
      open: String,
      close: String
    }
  },
  settings: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Timezone support for global operations
  // IMPORTANT: Changing timezone does not retroactively change historical timestamps
  // All timestamps are stored in UTC. Timezone is only used for:
  // 1. Calculating expiry dates (start/end of day in location timezone)
  // 2. Converting timestamps for display to users
  // Historical data remains in UTC and is not modified when timezone changes
  timezone: {
    type: String,
    default: 'UTC'
  },
  
  // Negative inventory policy
  negativeInventoryPolicy: {
    type: String,
    enum: ['allow_never', 'allow_temporarily', 'allow_always'],
    default: 'allow_never'
  },
  
  // Soft delete fields
  isActive: {
    type: Boolean,
    default: true
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for performance
locationSchema.index({ code: 1 }, { unique: true });
locationSchema.index({ type: 1 });
locationSchema.index({ isActive: 1 });
locationSchema.index({ isArchived: 1 });
locationSchema.index({ 'capabilities.canProcureDirectly': 1 });
locationSchema.index({ 'capabilities.canDispatchStock': 1 });
locationSchema.index({ 'capabilities.canReceiveStock': 1 });

export const getLocationModel = (companyDB) => {
  return companyDB.model('Location', locationSchema);
};

export default locationSchema;
