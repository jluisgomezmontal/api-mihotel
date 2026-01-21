import express from 'express';
import { z } from 'zod';
import {
  registerTenant,
  login,
  getProfile,
  updateProfile,
  changePassword,
  refreshToken,
  logout
} from './auth.controller.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validation.js';
import { 
  registerUserSchema,
  loginSchema,
  updateUserSchema,
  changePasswordSchema
} from '../../schemas/user.schema.js';
import { createTenantSchema } from '../../schemas/tenant.schema.js';

const router = express.Router();

/**
 * Tenant registration schema (combines tenant and admin user)
 */
const registerTenantSchema = z.object({
  tenant: createTenantSchema,
  admin: registerUserSchema.omit({ role: true }) // Admin role is auto-assigned
});

/**
 * @route   POST /api/auth/register
 * @desc    Register new tenant with admin user
 * @access  Public
 */
router.post('/register', 
  validate(registerTenantSchema),
  registerTenant
);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get token
 * @access  Public
 */
router.post('/login',
  validate(loginSchema),
  login
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile',
  authenticate,
  getProfile
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile',
  authenticate,
  validate(updateUserSchema),
  updateProfile
);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password',
  authenticate,
  validate(changePasswordSchema),
  changePassword
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh',
  authenticate,
  refreshToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token cleanup)
 * @access  Private
 */
router.post('/logout',
  authenticate,
  logout
);

export default router;
