import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserRole,
  updateUserPermissions,
  updateUserStatus,
  resetUserPassword,
  getUserStats
} from './user.controller.js';
import { authenticate, requirePermission } from '../../middlewares/auth.js';
import { tenantGuard } from '../../middlewares/tenantGuard.js';
import { validate } from '../../middlewares/validation.js';
import {
  registerUserSchema,
  updateUserSchema,
  userParamsSchema,
  userQuerySchema
} from '../../schemas/user.schema.js';
import { z } from 'zod';

const router = express.Router();

router.use(authenticate);
router.use(tenantGuard);

const roleUpdateSchema = z.object({
  role: z.enum(['admin', 'staff', 'cleaning'])
});

const permissionsUpdateSchema = z.object({
  permissions: z.object({
    canManageProperties: z.boolean().optional(),
    canManageUsers: z.boolean().optional(),
    canManageReservations: z.boolean().optional(),
    canViewReports: z.boolean().optional()
  })
});

const statusUpdateSchema = z.object({
  isActive: z.boolean()
});

const resetPasswordSchema = z.object({
  newPassword: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password cannot exceed 100 characters')
});

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics for current tenant
 * @access  Private (requires canManageUsers permission)
 */
router.get('/stats',
  requirePermission('canManageUsers'),
  getUserStats
);

/**
 * @route   GET /api/users
 * @desc    Get all users for current tenant
 * @access  Private (requires canManageUsers permission)
 */
router.get('/',
  requirePermission('canManageUsers'),
  validate(userQuerySchema, 'query'),
  getAllUsers
);

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Private (requires canManageUsers permission)
 */
router.post('/',
  requirePermission('canManageUsers'),
  validate(registerUserSchema),
  createUser
);

/**
 * @route   GET /api/users/:userId
 * @desc    Get user by ID
 * @access  Private (requires canManageUsers permission)
 */
router.get('/:userId',
  requirePermission('canManageUsers'),
  validate(userParamsSchema, 'params'),
  getUserById
);

/**
 * @route   PUT /api/users/:userId
 * @desc    Update user
 * @access  Private (requires canManageUsers permission)
 */
router.put('/:userId',
  requirePermission('canManageUsers'),
  validate(userParamsSchema, 'params'),
  validate(updateUserSchema),
  updateUser
);

/**
 * @route   DELETE /api/users/:userId
 * @desc    Delete user (soft delete)
 * @access  Private (requires canManageUsers permission)
 */
router.delete('/:userId',
  requirePermission('canManageUsers'),
  validate(userParamsSchema, 'params'),
  deleteUser
);

/**
 * @route   PUT /api/users/:userId/role
 * @desc    Update user role
 * @access  Private (requires canManageUsers permission)
 */
router.put('/:userId/role',
  requirePermission('canManageUsers'),
  validate(userParamsSchema, 'params'),
  validate(roleUpdateSchema),
  updateUserRole
);

/**
 * @route   PUT /api/users/:userId/permissions
 * @desc    Update user permissions
 * @access  Private (requires canManageUsers permission)
 */
router.put('/:userId/permissions',
  requirePermission('canManageUsers'),
  validate(userParamsSchema, 'params'),
  validate(permissionsUpdateSchema),
  updateUserPermissions
);

/**
 * @route   PUT /api/users/:userId/status
 * @desc    Activate/Deactivate user
 * @access  Private (requires canManageUsers permission)
 */
router.put('/:userId/status',
  requirePermission('canManageUsers'),
  validate(userParamsSchema, 'params'),
  validate(statusUpdateSchema),
  updateUserStatus
);

/**
 * @route   PUT /api/users/:userId/reset-password
 * @desc    Reset user password (admin only)
 * @access  Private (requires canManageUsers permission)
 */
router.put('/:userId/reset-password',
  requirePermission('canManageUsers'),
  validate(userParamsSchema, 'params'),
  validate(resetPasswordSchema),
  resetUserPassword
);

export default router;
