import mongoose from 'mongoose';
import { TENANT_TYPES, TENANT_PLANS } from '../../config/constants.js';

/**
 * Tenant Schema - Represents a business (hotel, Airbnb, posada)
 * Note: Tenant model doesn't include tenantId field as it IS the tenant
 */
const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tenant name is required'],
    trim: true,
    maxlength: [100, 'Tenant name cannot exceed 100 characters']
  },
  type: {
    type: String,
    enum: {
      values: Object.values(TENANT_TYPES),
      message: 'Invalid tenant type. Must be one of: {VALUES}'
    },
    required: [true, 'Tenant type is required']
  },
  plan: {
    type: String,
    enum: {
      values: Object.values(TENANT_PLANS),
      message: 'Invalid plan type. Must be one of: {VALUES}'
    },
    default: TENANT_PLANS.BASIC
  },
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    currency: {
      type: String,
      default: 'USD',
      maxlength: 3
    },
    timezone: {
      type: String,
      default: 'America/Mexico_City'
    },
    language: {
      type: String,
      default: 'es',
      maxlength: 5
    }
  },
  subscription: {
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    },
    isTrialActive: {
      type: Boolean,
      default: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
tenantSchema.index({ name: 1 });
tenantSchema.index({ type: 1 });
tenantSchema.index({ isActive: 1 });

// Virtual for getting properties count
tenantSchema.virtual('propertiesCount', {
  ref: 'Property',
  localField: '_id',
  foreignField: 'tenantId',
  count: true,
  match: { isActive: true }
});

// Virtual for getting users count
tenantSchema.virtual('usersCount', {
  ref: 'User',
  localField: '_id', 
  foreignField: 'tenantId',
  count: true,
  match: { isActive: true }
});

// Instance method to check if tenant is active and subscription valid
tenantSchema.methods.isSubscriptionActive = function() {
  if (!this.isActive) return false;
  if (this.subscription.isTrialActive) return true;
  if (this.subscription.endDate && this.subscription.endDate < new Date()) return false;
  return true;
};

// Static method to find active tenants
tenantSchema.statics.findActive = function(conditions = {}) {
  return this.find({ ...conditions, isActive: true });
};

export default mongoose.model('Tenant', tenantSchema);
