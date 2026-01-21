import express from 'express';
import {
  getAllGuests,
  getGuestById,
  createGuest,
  updateGuest,
  deleteGuest,
  searchGuests,
  getVIPGuests,
  updateVIPStatus,
  updateBlacklistStatus,
  getGuestReservations
} from './guest.controller.js';
import { authenticate, requirePermission } from '../../middlewares/auth.js';
import { tenantGuard, setTenantId } from '../../middlewares/tenantGuard.js';
import { validate } from '../../middlewares/validation.js';
import {
  createGuestSchema,
  updateGuestSchema,
  guestParamsSchema,
  guestQuerySchema,
  guestSearchSchema
} from '../../schemas/guest.schema.js';
import { z } from 'zod';

const router = express.Router();

// Apply authentication and tenant guard to all routes
router.use(authenticate);
router.use(tenantGuard);

// VIP status update schema
const vipStatusSchema = z.object({
  vipStatus: z.boolean()
});

// Blacklist status update schema
const blacklistStatusSchema = z.object({
  blacklisted: z.boolean(),
  reason: z.string().min(1).max(500).trim().optional()
});

/**
 * @route   GET /api/guests/search
 * @desc    Search guests by name, email, phone, or ID
 * @access  Private
 */
router.get('/search',
  validate(guestSearchSchema, 'query'),
  searchGuests
);

/**
 * @route   GET /api/guests/vip
 * @desc    Get VIP guests
 * @access  Private
 */
router.get('/vip',
  getVIPGuests
);

/**
 * @route   GET /api/guests
 * @desc    Get all guests for current tenant
 * @access  Private
 */
router.get('/',
  validate(guestQuerySchema, 'query'),
  getAllGuests
);

/**
 * @route   POST /api/guests
 * @desc    Create new guest
 * @access  Private
 */
router.post('/',
  validate(createGuestSchema),
  setTenantId,
  createGuest
);

/**
 * @route   GET /api/guests/:guestId
 * @desc    Get guest by ID
 * @access  Private
 */
router.get('/:guestId',
  validate(guestParamsSchema, 'params'),
  getGuestById
);

/**
 * @route   PUT /api/guests/:guestId
 * @desc    Update guest
 * @access  Private
 */
router.put('/:guestId',
  validate(guestParamsSchema, 'params'),
  validate(updateGuestSchema),
  updateGuest
);

/**
 * @route   DELETE /api/guests/:guestId
 * @desc    Delete guest (soft delete)
 * @access  Private
 */
router.delete('/:guestId',
  validate(guestParamsSchema, 'params'),
  deleteGuest
);

/**
 * @route   PUT /api/guests/:guestId/vip
 * @desc    Update guest VIP status
 * @access  Private (requires canManageReservations permission)
 */
router.put('/:guestId/vip',
  requirePermission('canManageReservations'),
  validate(guestParamsSchema, 'params'),
  validate(vipStatusSchema),
  updateVIPStatus
);

/**
 * @route   PUT /api/guests/:guestId/blacklist
 * @desc    Update guest blacklist status
 * @access  Private (requires canManageReservations permission)
 */
router.put('/:guestId/blacklist',
  requirePermission('canManageReservations'),
  validate(guestParamsSchema, 'params'),
  validate(blacklistStatusSchema),
  updateBlacklistStatus
);

/**
 * @route   GET /api/guests/:guestId/reservations
 * @desc    Get guest reservations history
 * @access  Private
 */
router.get('/:guestId/reservations',
  validate(guestParamsSchema, 'params'),
  getGuestReservations
);

export default router;
