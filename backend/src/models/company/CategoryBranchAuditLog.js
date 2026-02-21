import mongoose from 'mongoose';

const categoryBranchAuditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyUser',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'auto_assign_category',
      'auto_assign_subcategory',
      'manual_assign',
      'branch_removal_blocked',
      'branch_removal_success'
    ]
  },
  entityType: {
    type: String,
    required: true,
    enum: ['item', 'supplier', 'category']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  subcategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  branchIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  }],
  reason: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
categoryBranchAuditLogSchema.index({ userId: 1 });
categoryBranchAuditLogSchema.index({ action: 1 });
categoryBranchAuditLogSchema.index({ entityType: 1 });
categoryBranchAuditLogSchema.index({ entityId: 1 });
categoryBranchAuditLogSchema.index({ categoryId: 1 });
categoryBranchAuditLogSchema.index({ subcategoryId: 1 });
categoryBranchAuditLogSchema.index({ branchIds: 1 });
categoryBranchAuditLogSchema.index({ createdAt: -1 });
categoryBranchAuditLogSchema.index({ userId: 1, createdAt: -1 });
categoryBranchAuditLogSchema.index({ categoryId: 1, branchIds: 1 });

export const getCategoryBranchAuditLogModel = (companyDB) => {
  return companyDB.model('CategoryBranchAuditLog', categoryBranchAuditLogSchema);
};

export default categoryBranchAuditLogSchema;
