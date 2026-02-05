import express from 'express';
import {
  getCurrentTenant,
  updateTenantSettings,
  updateTenantInfo,
  getTenantStats
} from './tenant.controller.js';
import { authenticate } from '../../middlewares/auth.js';
import { tenantGuard } from '../../middlewares/tenantGuard.js';
import { validate } from '../../middlewares/validation.js';
import { z } from 'zod';

const router = express.Router();

// Apply authentication and tenant guard to all routes
router.use(authenticate);
router.use(tenantGuard);

// Validation schemas
const updateSettingsSchema = z.object({
  settings: z.object({
    currency: z.string().max(3).optional(),
    timezone: z.string().optional(),
    language: z.string().max(5).optional()
  })
});

const updateInfoSchema = z.object({
  name: z.string().trim().max(100).optional(),
  type: z.enum(['hotel', 'airbnb', 'posada']).optional()
});

/**
 * @route   GET /api/tenants/current
 * @desc    Get current tenant details
 * @access  Private
 */
router.get('/current', getCurrentTenant);

/**
 * @route   GET /api/tenants/stats
 * @desc    Get tenant statistics
 * @access  Private
 */
router.get('/stats', getTenantStats);

/**
 * @route   PUT /api/tenants/settings
 * @desc    Update tenant settings (admin only)
 * @access  Private (Admin)
 */
router.put('/settings',
  validate(updateSettingsSchema),
  updateTenantSettings
);

/**
 * @route   PUT /api/tenants/info
 * @desc    Update tenant information (admin only)
 * @access  Private (Admin)
 */
router.put('/info',
  validate(updateInfoSchema),
  updateTenantInfo
);

export default router;
