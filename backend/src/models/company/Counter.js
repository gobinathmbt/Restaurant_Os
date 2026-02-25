import mongoose from 'mongoose';

/**
 * Counter Schema
 * Atomic counter for generating sequential numbers (transfer numbers, etc.)
 * Prevents race conditions in concurrent number generation
 */
const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  sequence: {
    type: Number,
    required: true,
    default: 0
  }
}, {
  timestamps: true
});

export const getCounterModel = (companyDB) => {
  return companyDB.model('Counter', counterSchema);
};

export default counterSchema;
