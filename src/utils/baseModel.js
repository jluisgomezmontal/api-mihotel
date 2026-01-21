import mongoose from 'mongoose';

/**
 * Base schema plugin for multi-tenant architecture
 * Adds common fields and methods to all models
 */
export const baseSchemaPlugin = function(schema, options) {
  // Add common fields to all schemas
  schema.add({
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  });

  // Auto-update updatedAt on save
  schema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
  });

  // Auto-update updatedAt on findOneAndUpdate
  schema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
    this.set({ updatedAt: new Date() });
    next();
  });

  // Add tenant filtering to all queries by default
  schema.pre(['find', 'findOne', 'findOneAndUpdate', 'deleteOne', 'deleteMany'], function(next) {
    // Only add tenantId filter if not already specified and tenantId exists in context
    if (this.getQuery && !this.getQuery().tenantId && this.tenantId) {
      this.where({ tenantId: this.tenantId });
    }
    next();
  });

  // Instance method to check tenant ownership
  schema.methods.belongsToTenant = function(tenantId) {
    return this.tenantId.toString() === tenantId.toString();
  };

  // Static method to find by tenant
  schema.statics.findByTenant = function(tenantId, conditions = {}) {
    return this.find({ ...conditions, tenantId, isActive: true });
  };

  // Static method to count by tenant
  schema.statics.countByTenant = function(tenantId, conditions = {}) {
    return this.countDocuments({ ...conditions, tenantId, isActive: true });
  };
};

/**
 * Soft delete plugin
 * Adds soft delete functionality to schemas
 */
export const softDeletePlugin = function(schema, options) {
  schema.add({
    deletedAt: {
      type: Date,
      default: null
    }
  });

  // Override default queries to exclude soft deleted documents
  schema.pre(['find', 'findOne', 'findOneAndUpdate', 'count', 'countDocuments'], function() {
    if (!this.getQuery().deletedAt) {
      this.where({ deletedAt: null });
    }
  });

  // Soft delete method
  schema.methods.softDelete = function() {
    this.deletedAt = new Date();
    this.isActive = false;
    return this.save();
  };

  // Restore method
  schema.methods.restore = function() {
    this.deletedAt = null;
    this.isActive = true;
    return this.save();
  };
};
