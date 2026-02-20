import mongoose from 'mongoose';

/**
 * InventoryPeriod Schema
 * Manages inventory period locking for financial compliance
 * Prevents backdated transactions after month-end closing
 */
const inventoryPeriodSchema = new mongoose.Schema({
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  
  // Period definition
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },
  
  // Status
  status: {
    type: String,
    required: true,
    enum: ['open', 'locked'],
    default: 'open'
  },
  
  // Lock/unlock audit trail
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  lockedDate: {
    type: Date
  },
  unlockedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  unlockedDate: {
    type: Date
  },
  
  // Notes
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for performance
inventoryPeriodSchema.index({ locationId: 1, periodStart: 1, periodEnd: 1 });
inventoryPeriodSchema.index({ status: 1 });
inventoryPeriodSchema.index({ locationId: 1, status: 1 });

export const getInventoryPeriodModel = (companyDB) => {
  return companyDB.model('InventoryPeriod', inventoryPeriodSchema);
};

export default inventoryPeriodSchema;
