import express from 'express';
import {
  getAllProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  getPropertyDashboard
} from './property.controller.js';
import { authenticate, requirePermission } from '../../middlewares/auth.js';
import { tenantGuard, setTenantId } from '../../middlewares/tenantGuard.js';
import { validate } from '../../middlewares/validation.js';
import {
  createPropertySchema,
  updatePropertySchema,
  propertyParamsSchema,
  propertyQuerySchema
} from '../../schemas/property.schema.js';

const router = express.Router();

// Apply authentication and tenant guard to all routes
router.use(authenticate);
router.use(tenantGuard);

/**
 * @route   GET /api/properties
 * @desc    Get all properties for current tenant
 * @access  Private
 */
router.get('/',
  validate(propertyQuerySchema, 'query'),
  getAllProperties
);

/**
 * @route   POST /api/properties
 * @desc    Create new property
 * @access  Private (requires canManageProperties permission)
 */
router.post('/',
  requirePermission('canManageProperties'),
  validate(createPropertySchema),
  setTenantId,
  createProperty
);

/**
 * @route   GET /api/properties/:propertyId
 * @desc    Get property by ID
 * @access  Private
 */
router.get('/:propertyId',
  validate(propertyParamsSchema, 'params'),
  getPropertyById
);

/**
 * @route   PUT /api/properties/:propertyId
 * @desc    Update property
 * @access  Private (requires canManageProperties permission)
 */
router.put('/:propertyId',
  requirePermission('canManageProperties'),
  validate(propertyParamsSchema, 'params'),
  validate(updatePropertySchema),
  updateProperty
);

/**
 * @route   DELETE /api/properties/:propertyId
 * @desc    Delete property (soft delete)
 * @access  Private (requires canManageProperties permission)
 */
router.delete('/:propertyId',
  requirePermission('canManageProperties'),
  validate(propertyParamsSchema, 'params'),
  deleteProperty
);

/**
 * @route   GET /api/properties/:propertyId/dashboard
 * @desc    Get property dashboard data
 * @access  Private
 */
router.get('/:propertyId/dashboard',
  validate(propertyParamsSchema, 'params'),
  getPropertyDashboard
);

export default router;
