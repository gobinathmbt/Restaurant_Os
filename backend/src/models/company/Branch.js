import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  contact: {
    phone: String,
    email: String,
    alternatePhone: String
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
    monday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    tuesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    wednesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    thursday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    friday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    saturday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    sunday: { open: String, close: String, isOpen: { type: Boolean, default: true } }
  },
  settings: {
    currency: { type: String, default: 'INR' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    taxSettings: {
      cgst: Number,
      sgst: Number,
      igst: Number,
      serviceCharge: Number
    },
    billPrefix: String,
    kotPrefix: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyUser'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyUser'
  }
}, {
  timestamps: true
});

// Indexes
branchSchema.index({ code: 1 });
branchSchema.index({ isActive: 1 });
branchSchema.index({ createdAt: -1 });

export const getBranchModel = (companyDB) => {
  return companyDB.model('Branch', branchSchema);
};

export default branchSchema;
