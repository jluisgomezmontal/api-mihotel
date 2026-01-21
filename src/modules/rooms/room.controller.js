import Room from './room.model.js';
import Property from '../properties/property.model.js';
import Reservation from '../reservations/reservation.model.js';
import { HTTP_STATUS, ROOM_STATUS } from '../../config/constants.js';

/**
 * Room Controller
 * Handles CRUD operations for rooms with multi-tenant isolation
 */

/**
 * Get all rooms for current tenant
 * GET /api/rooms
 */
export const getAllRooms = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      propertyId, 
      type, 
      status, 
      search, 
      isActive 
    } = req.query;
    
    // Build query conditions
    const conditions = { tenantId: req.user.tenantId };
    
    if (propertyId) conditions.propertyId = propertyId;
    if (type) conditions.type = type;
    if (status) conditions.status = status;
    if (isActive !== undefined) conditions.isActive = isActive;
    
    if (search) {
      conditions.$or = [
        { nameOrNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const [rooms, total] = await Promise.all([
      Room.find(conditions)
        .populate('propertyId', 'name address.city')
        .populate('currentReservation')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ propertyId: 1, nameOrNumber: 1 }),
      Room.countDocuments(conditions)
    ]);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        rooms,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch rooms'
    });
  }
};

/**
 * Get room by ID
 * GET /api/rooms/:roomId
 */
export const getRoomById = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({
      _id: roomId,
      tenantId: req.user.tenantId
    })
    .populate('propertyId', 'name address checkInTime checkOutTime')
    .populate('currentReservation');

    if (!room) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Room not found'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { room }
    });

  } catch (error) {
    console.error('Get room error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch room'
    });
  }
};

/**
 * Create new room
 * POST /api/rooms
 */
export const createRoom = async (req, res) => {
  try {
    const roomData = {
      ...req.body,
      tenantId: req.user.tenantId
    };

    // Verify property exists and belongs to tenant
    const property = await Property.findOne({
      _id: roomData.propertyId,
      tenantId: req.user.tenantId,
      isActive: true
    });

    if (!property) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if room name/number already exists in this property
    const existingRoom = await Room.findOne({
      propertyId: roomData.propertyId,
      nameOrNumber: roomData.nameOrNumber,
      tenantId: req.user.tenantId,
      isActive: true
    });

    if (existingRoom) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'Room name/number already exists in this property'
      });
    }

    const room = new Room(roomData);
    const savedRoom = await room.save();

    // Populate property data for response
    await savedRoom.populate('propertyId', 'name address.city');

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Room created successfully',
      data: { room: savedRoom }
    });

  } catch (error) {
    console.error('Create room error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create room'
    });
  }
};

/**
 * Update room
 * PUT /api/rooms/:roomId
 */
export const updateRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated
    delete updates.tenantId;
    delete updates._id;

    const room = await Room.findOneAndUpdate(
      { _id: roomId, tenantId: req.user.tenantId },
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('propertyId', 'name address.city');

    if (!room) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Room not found'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Room updated successfully',
      data: { room }
    });

  } catch (error) {
    console.error('Update room error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update room'
    });
  }
};

/**
 * Delete room (soft delete)
 * DELETE /api/rooms/:roomId
 */
export const deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Check if room has active reservations
    const activeReservations = await Reservation.countDocuments({
      roomId,
      tenantId: req.user.tenantId,
      status: { $in: ['confirmed', 'checked_in'] },
      isActive: true
    });

    if (activeReservations > 0) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'Cannot delete room with active reservations'
      });
    }

    const room = await Room.findOne({
      _id: roomId,
      tenantId: req.user.tenantId
    });

    if (!room) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Room not found'
      });
    }

    await room.softDelete();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Room deleted successfully'
    });

  } catch (error) {
    console.error('Delete room error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to delete room'
    });
  }
};

/**
 * Update room status
 * PUT /api/rooms/:roomId/status
 */
export const updateRoomStatus = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status, notes } = req.body;

    const room = await Room.findOne({
      _id: roomId,
      tenantId: req.user.tenantId
    });

    if (!room) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Use the room's method to update status
    await room.updateStatus(status, notes);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Room status updated successfully',
      data: { room }
    });

  } catch (error) {
    console.error('Update room status error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update room status'
    });
  }
};

/**
 * Get rooms by property
 * GET /api/rooms/property/:propertyId
 */
export const getRoomsByProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { status, available } = req.query;

    // Verify property belongs to tenant
    const property = await Property.findOne({
      _id: propertyId,
      tenantId: req.user.tenantId
    });

    if (!property) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Property not found'
      });
    }

    const conditions = {
      propertyId,
      tenantId: req.user.tenantId,
      isActive: true
    };

    if (status) {
      conditions.status = status;
    }

    if (available === 'true') {
      conditions.status = ROOM_STATUS.AVAILABLE;
    }

    const rooms = await Room.find(conditions)
      .populate('currentReservation')
      .sort({ nameOrNumber: 1 });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        property: {
          id: property._id,
          name: property.name
        },
        rooms,
        total: rooms.length
      }
    });

  } catch (error) {
    console.error('Get rooms by property error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch property rooms'
    });
  }
};
