import express from 'express';
import {
  getAllReservations,
  getReservationById,
  createReservation,
  updateReservation,
  deleteReservation,
  confirmReservation,
  checkInGuest,
  checkOutGuest,
  cancelReservation,
  checkAvailability,
  getCurrentReservations
} from './reservation.controller.js';
import { authenticate, requirePermission } from '../../middlewares/auth.js';
import { tenantGuard, setTenantId } from '../../middlewares/tenantGuard.js';
import { validate } from '../../middlewares/validation.js';
import {
  createReservationSchema,
  updateReservationSchema,
  reservationParamsSchema,
  reservationQuerySchema,
  checkInSchema,
  checkOutSchema,
  cancelReservationSchema
} from '../../schemas/reservation.schema.js';
import { checkAvailabilitySchema } from '../../schemas/room.schema.js';

const router = express.Router();

// Apply authentication and tenant guard to all routes
router.use(authenticate);
router.use(tenantGuard);

/**
 * @route   POST /api/reservations/check-availability
 * @desc    Check room availability for date range
 * @access  Private
 */
router.post('/check-availability',
  validate(checkAvailabilitySchema),
  checkAvailability
);

/**
 * @route   GET /api/reservations/current
 * @desc    Get current reservations (checked-in guests)
 * @access  Private
 */
router.get('/current',
  getCurrentReservations
);

/**
 * @route   GET /api/reservations
 * @desc    Get all reservations for current tenant
 * @access  Private (requires canManageReservations permission)
 */
router.get('/',
  requirePermission('canManageReservations'),
  validate(reservationQuerySchema, 'query'),
  getAllReservations
);

/**
 * @route   POST /api/reservations
 * @desc    Create new reservation
 * @access  Private (requires canManageReservations permission)
 */
router.post('/',
  requirePermission('canManageReservations'),
  validate(createReservationSchema),
  setTenantId,
  createReservation
);

/**
 * @route   GET /api/reservations/:reservationId
 * @desc    Get reservation by ID
 * @access  Private (requires canManageReservations permission)
 */
router.get('/:reservationId',
  requirePermission('canManageReservations'),
  validate(reservationParamsSchema, 'params'),
  getReservationById
);

/**
 * @route   PUT /api/reservations/:reservationId
 * @desc    Update reservation
 * @access  Private (requires canManageReservations permission)
 */
router.put('/:reservationId',
  requirePermission('canManageReservations'),
  validate(reservationParamsSchema, 'params'),
  validate(updateReservationSchema),
  updateReservation
);

/**
 * @route   DELETE /api/reservations/:reservationId
 * @desc    Delete reservation (soft delete)
 * @access  Private (requires canManageReservations permission)
 */
router.delete('/:reservationId',
  requirePermission('canManageReservations'),
  validate(reservationParamsSchema, 'params'),
  deleteReservation
);

/**
 * @route   PUT /api/reservations/:reservationId/confirm
 * @desc    Confirm reservation
 * @access  Private (requires canManageReservations permission)
 */
router.put('/:reservationId/confirm',
  requirePermission('canManageReservations'),
  validate(reservationParamsSchema, 'params'),
  confirmReservation
);

/**
 * @route   PUT /api/reservations/:reservationId/checkin
 * @desc    Check-in guest
 * @access  Private (requires canManageReservations permission)
 */
router.put('/:reservationId/checkin',
  requirePermission('canManageReservations'),
  validate(reservationParamsSchema, 'params'),
  validate(checkInSchema),
  checkInGuest
);

/**
 * @route   PUT /api/reservations/:reservationId/checkout
 * @desc    Check-out guest
 * @access  Private (requires canManageReservations permission)
 */
router.put('/:reservationId/checkout',
  requirePermission('canManageReservations'),
  validate(reservationParamsSchema, 'params'),
  validate(checkOutSchema),
  checkOutGuest
);

/**
 * @route   PUT /api/reservations/:reservationId/cancel
 * @desc    Cancel reservation
 * @access  Private (requires canManageReservations permission)
 */
router.put('/:reservationId/cancel',
  requirePermission('canManageReservations'),
  validate(reservationParamsSchema, 'params'),
  validate(cancelReservationSchema),
  cancelReservation
);

export default router;
