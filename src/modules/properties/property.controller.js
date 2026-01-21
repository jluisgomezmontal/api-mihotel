import Property from './property.model.js';
import Room from '../rooms/room.model.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * Property Controller
 * Handles CRUD operations for properties with multi-tenant isolation
 */

/**
 * Get all properties for current tenant
 * GET /api/properties
 */
export const getAllProperties = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, city, state, isActive } = req.query;
    
    // Build query conditions
    const conditions = { tenantId: req.user.tenantId };
    
    if (search) {
      conditions.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (city) {
      conditions['address.city'] = { $regex: city, $options: 'i' };
    }
    
    if (state) {
      conditions['address.state'] = { $regex: state, $options: 'i' };
    }
    
    if (isActive !== undefined) {
      conditions.isActive = isActive;
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const [properties, total] = await Promise.all([
      Property.find(conditions)
        .populate('roomsCount')
        .populate('availableRoomsCount')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Property.countDocuments(conditions)
    ]);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        properties,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get properties error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch properties'
    });
  }
};

/**
 * Get property by ID
 * GET /api/properties/:propertyId
 */
export const getPropertyById = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const property = await Property.findOne({
      _id: propertyId,
      tenantId: req.user.tenantId
    })
    .populate('roomsCount')
    .populate('availableRoomsCount')
    .populate('currentReservations');

    if (!property) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { property }
    });

  } catch (error) {
    console.error('Get property error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch property'
    });
  }
};

/**
 * Create new property
 * POST /api/properties
 */
export const createProperty = async (req, res) => {
  try {
    const propertyData = {
      ...req.body,
      tenantId: req.user.tenantId
    };

    const property = new Property(propertyData);
    const savedProperty = await property.save();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Property created successfully',
      data: { property: savedProperty }
    });

  } catch (error) {
    console.error('Create property error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create property'
    });
  }
};

/**
 * Update property
 * PUT /api/properties/:propertyId
 */
export const updateProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated
    delete updates.tenantId;
    delete updates._id;

    const property = await Property.findOneAndUpdate(
      { _id: propertyId, tenantId: req.user.tenantId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!property) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Property updated successfully',
      data: { property }
    });

  } catch (error) {
    console.error('Update property error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update property'
    });
  }
};

/**
 * Delete property (soft delete)
 * DELETE /api/properties/:propertyId
 */
export const deleteProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Check if property has active rooms
    const activeRoomsCount = await Room.countDocuments({
      propertyId,
      tenantId: req.user.tenantId,
      isActive: true
    });

    if (activeRoomsCount > 0) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'Cannot delete property with active rooms. Please deactivate all rooms first.'
      });
    }

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

    await property.softDelete();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Property deleted successfully'
    });

  } catch (error) {
    console.error('Delete property error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to delete property'
    });
  }
};

/**
 * Get property dashboard data
 * GET /api/properties/:propertyId/dashboard
 */
export const getPropertyDashboard = async (req, res) => {
  try {
    const { propertyId } = req.params;

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

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Get room statistics
    const roomStats = await Room.aggregate([
      { $match: { propertyId: property._id, tenantId: req.user.tenantId, isActive: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get today's reservations
    const { default: Reservation } = await import('../reservations/reservation.model.js');
    const todayReservations = await Reservation.find({
      propertyId,
      tenantId: req.user.tenantId,
      $or: [
        { 'dates.checkInDate': { $gte: startOfDay, $lte: endOfDay } },
        { 'dates.checkOutDate': { $gte: startOfDay, $lte: endOfDay } }
      ],
      isActive: true
    })
    .populate('roomId', 'nameOrNumber')
    .populate('guestId', 'firstName lastName')
    .sort({ 'dates.checkInDate': 1 });

    // Calculate occupancy rate
    const totalRooms = await Room.countDocuments({
      propertyId,
      tenantId: req.user.tenantId,
      isActive: true
    });

    const occupiedRooms = await Room.countDocuments({
      propertyId,
      tenantId: req.user.tenantId,
      status: 'occupied',
      isActive: true
    });

    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        property: {
          id: property._id,
          name: property.name
        },
        roomStats,
        todayReservations,
        occupancyRate: parseFloat(occupancyRate.toFixed(2)),
        totalRooms,
        occupiedRooms
      }
    });

  } catch (error) {
    console.error('Property dashboard error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch property dashboard data'
    });
  }
};
