import express from 'express';
import {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  updateRoomStatus,
  getRoomsByProperty
} from './room.controller.js';
import { authenticate, requirePermission } from '../../middlewares/auth.js';
import { tenantGuard, setTenantId } from '../../middlewares/tenantGuard.js';
import { validate } from '../../middlewares/validation.js';
import {
  createRoomSchema,
  updateRoomSchema,
  roomParamsSchema,
  roomQuerySchema
} from '../../schemas/room.schema.js';
import { z } from 'zod';
import { ROOM_STATUS } from '../../config/constants.js';

const router = express.Router();

// Apply authentication and tenant guard to all routes
router.use(authenticate);
router.use(tenantGuard);

// Room status update schema
const roomStatusSchema = z.object({
  status: z.enum(Object.values(ROOM_STATUS)),
  notes: z.string().max(500).trim().optional()
});

// Property params schema
const propertyParamsSchema = z.object({
  propertyId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid property ID format')
});

/**
 * @route   GET /api/rooms
 * @desc    Get all rooms for current tenant
 * @access  Private
 */
router.get('/',
  validate(roomQuerySchema, 'query'),
  getAllRooms
);

/**
 * @route   POST /api/rooms
 * @desc    Create new room
 * @access  Private (requires canManageProperties permission)
 */
router.post('/',
  requirePermission('canManageProperties'),
  validate(createRoomSchema),
  setTenantId,
  createRoom
);

/**
 * @route   GET /api/rooms/property/:propertyId
 * @desc    Get rooms by property
 * @access  Private
 */
router.get('/property/:propertyId',
  validate(propertyParamsSchema, 'params'),
  getRoomsByProperty
);

/**
 * @route   GET /api/rooms/:roomId
 * @desc    Get room by ID
 * @access  Private
 */
router.get('/:roomId',
  validate(roomParamsSchema, 'params'),
  getRoomById
);

/**
 * @route   PUT /api/rooms/:roomId
 * @desc    Update room
 * @access  Private (requires canManageProperties permission)
 */
router.put('/:roomId',
  requirePermission('canManageProperties'),
  validate(roomParamsSchema, 'params'),
  validate(updateRoomSchema),
  updateRoom
);

/**
 * @route   PUT /api/rooms/:roomId/status
 * @desc    Update room status
 * @access  Private
 */
router.put('/:roomId/status',
  validate(roomParamsSchema, 'params'),
  validate(roomStatusSchema),
  updateRoomStatus
);

/**
 * @route   DELETE /api/rooms/:roomId
 * @desc    Delete room (soft delete)
 * @access  Private (requires canManageProperties permission)
 */
router.delete('/:roomId',
  requirePermission('canManageProperties'),
  validate(roomParamsSchema, 'params'),
  deleteRoom
);

export default router;
