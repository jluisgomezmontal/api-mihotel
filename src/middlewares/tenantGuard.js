import mongoose from 'mongoose';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * Multi-tenant middleware to ensure data isolation
 * Automatically injects tenantId into queries and validates tenant access
 */
export const tenantGuard = (req, res, next) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user.tenantId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Tenant authentication required'
      });
    }

    // Inject tenantId into request for easy access
    req.tenantId = req.user.tenantId;

    // Store original mongoose methods to add tenant filtering
    const originalFind = mongoose.Model.find;
    const originalFindOne = mongoose.Model.findOne;
    const originalFindOneAndUpdate = mongoose.Model.findOneAndUpdate;
    const originalDeleteOne = mongoose.Model.deleteOne;
    const originalDeleteMany = mongoose.Model.deleteMany;
    const originalCountDocuments = mongoose.Model.countDocuments;

    // Override mongoose methods to auto-inject tenantId
    mongoose.Model.find = function(conditions = {}) {
      // Don't add tenantId filter for Tenant model itself
      if (this.modelName !== 'Tenant' && !conditions.hasOwnProperty('tenantId')) {
        conditions.tenantId = req.tenantId;
      }
      return originalFind.call(this, conditions);
    };

    mongoose.Model.findOne = function(conditions = {}) {
      if (this.modelName !== 'Tenant' && !conditions.hasOwnProperty('tenantId')) {
        conditions.tenantId = req.tenantId;
      }
      return originalFindOne.call(this, conditions);
    };

    mongoose.Model.findOneAndUpdate = function(conditions = {}, update, options) {
      if (this.modelName !== 'Tenant' && !conditions.hasOwnProperty('tenantId')) {
        conditions.tenantId = req.tenantId;
      }
      return originalFindOneAndUpdate.call(this, conditions, update, options);
    };

    mongoose.Model.deleteOne = function(conditions = {}) {
      if (this.modelName !== 'Tenant' && !conditions.hasOwnProperty('tenantId')) {
        conditions.tenantId = req.tenantId;
      }
      return originalDeleteOne.call(this, conditions);
    };

    mongoose.Model.deleteMany = function(conditions = {}) {
      if (this.modelName !== 'Tenant' && !conditions.hasOwnProperty('tenantId')) {
        conditions.tenantId = req.tenantId;
      }
      return originalDeleteMany.call(this, conditions);
    };

    mongoose.Model.countDocuments = function(conditions = {}) {
      if (this.modelName !== 'Tenant' && !conditions.hasOwnProperty('tenantId')) {
        conditions.tenantId = req.tenantId;
      }
      return originalCountDocuments.call(this, conditions);
    };

    // Cleanup function to restore original methods after request
    req.cleanupTenantGuard = () => {
      mongoose.Model.find = originalFind;
      mongoose.Model.findOne = originalFindOne;
      mongoose.Model.findOneAndUpdate = originalFindOneAndUpdate;
      mongoose.Model.deleteOne = originalDeleteOne;
      mongoose.Model.deleteMany = originalDeleteMany;
      mongoose.Model.countDocuments = originalCountDocuments;
    };

    next();
  } catch (error) {
    console.error('Tenant guard error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Tenant validation failed'
    });
  }
};

/**
 * Cleanup middleware to restore original mongoose methods
 * Should be used at the end of request processing
 */
export const cleanupTenantGuard = (req, res, next) => {
  if (req.cleanupTenantGuard) {
    req.cleanupTenantGuard();
  }
  next();
};

/**
 * Validate tenant ownership of a resource
 * Used for additional security when accessing specific resources
 */
export const validateTenantOwnership = (resourceTenantId) => {
  return (req, res, next) => {
    if (!req.user || !req.user.tenantId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Convert to string for comparison if needed
    const userTenantId = req.user.tenantId.toString();
    const resourceTenant = resourceTenantId.toString();

    if (userTenantId !== resourceTenant) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Access denied: resource belongs to different tenant'
      });
    }

    next();
  };
};

/**
 * Middleware to validate tenantId in request parameters
 */
export const validateTenantParam = (req, res, next) => {
  const tenantIdParam = req.params.tenantId;
  
  if (!tenantIdParam) {
    return next(); // No tenantId in params, continue normally
  }

  if (!mongoose.Types.ObjectId.isValid(tenantIdParam)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Invalid tenant ID format'
    });
  }

  // Ensure user can only access their own tenant's data
  if (req.user && req.user.tenantId.toString() !== tenantIdParam) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: 'Access denied: cannot access other tenant data'
    });
  }

  next();
};

/**
 * Helper function to ensure document belongs to current tenant
 */
export const ensureTenantOwnership = (document, req) => {
  if (!document) {
    throw new Error('Document not found');
  }

  if (!req.user || !req.user.tenantId) {
    throw new Error('User not authenticated');
  }

  const documentTenantId = document.tenantId ? document.tenantId.toString() : null;
  const userTenantId = req.user.tenantId.toString();

  if (documentTenantId !== userTenantId) {
    throw new Error('Access denied: resource belongs to different tenant');
  }

  return true;
};

/**
 * Middleware to automatically set tenantId for new documents
 */
export const setTenantId = (req, res, next) => {
  if (!req.user || !req.user.tenantId) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Add tenantId to request body for create operations
  if (req.method === 'POST' && req.body && !req.body.tenantId) {
    req.body.tenantId = req.user.tenantId;
  }

  next();
};

/**
 * Advanced tenant isolation for aggregation pipelines
 */
export const addTenantFilterToPipeline = (pipeline, tenantId) => {
  // Add tenant filter as the first stage if not already present
  const hasMatchStage = pipeline.some(stage => stage.$match && stage.$match.tenantId);
  
  if (!hasMatchStage) {
    pipeline.unshift({
      $match: { tenantId: mongoose.Types.ObjectId(tenantId) }
    });
  }

  return pipeline;
};

export default {
  tenantGuard,
  cleanupTenantGuard,
  validateTenantOwnership,
  validateTenantParam,
  ensureTenantOwnership,
  setTenantId,
  addTenantFilterToPipeline
};
