import mongoose from 'mongoose';

/**
 * InventoryReservation Schema
 * Tracks inventory reservations with expiry management
 * Prevents inventory lockup from abandoned orders
 */
const inventoryReservationSchema = new mongoose.Schema({
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
  
  // Reservation details
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Expiry management
  reservationExpiresAt: {
    type: Date
  },
  
  // Status
  status: {
    type: String,
    required: true,
    enum: ['active', 'expired', 'consumed', 'released'],
    default: 'active'
  },
  
  // Reference to source document (order, production, etc.)
  referenceType: {
    type: String,
    required: true,
    enum: ['ORDER', 'PRODUCTION', 'TRANSFER', 'OTHER']
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  
  // Audit trail
  reservedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  reservedDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  releasedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  releasedDate: {
    type: Date
  },
  consumedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  consumedDate: {
    type: Date
  },
  
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for performance
inventoryReservationSchema.index({ locationId: 1, inventoryItem: 1, status: 1 });
inventoryReservationSchema.index({ locationId: 1, status: 1, reservationExpiresAt: 1 });
inventoryReservationSchema.index({ status: 1, reservationExpiresAt: 1 });
inventoryReservationSchema.index({ referenceType: 1, referenceId: 1 });
inventoryReservationSchema.index({ reservedBy: 1, reservedDate: -1 });

export const getInventoryReservationModel = (companyDB) => {
  return companyDB.model('InventoryReservation', inventoryReservationSchema);
};

export default inventoryReservationSchema;
