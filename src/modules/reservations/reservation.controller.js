import Reservation from './reservation.model.js';
import Room from '../rooms/room.model.js';
import Guest from '../guests/guest.model.js';
import Property from '../properties/property.model.js';
import { HTTP_STATUS, RESERVATION_STATUS } from '../../config/constants.js';

/**
 * Reservation Controller
 * Handles booking operations with multi-tenant isolation and availability validation
 */

/**
 * Get all reservations for current tenant
 * GET /api/reservations
 */
export const getAllReservations = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      propertyId, 
      roomId, 
      guestId, 
      status, 
      checkInFrom, 
      checkInTo,
      confirmationNumber 
    } = req.query;
    
    // Build query conditions
    const conditions = { tenantId: req.user.tenantId };
    
    if (propertyId) conditions.propertyId = propertyId;
    if (roomId) conditions.roomId = roomId;
    if (guestId) conditions.guestId = guestId;
    if (status) conditions.status = status;
    if (confirmationNumber) {
      conditions.confirmationNumber = { $regex: confirmationNumber, $options: 'i' };
    }
    
    if (checkInFrom || checkInTo) {
      conditions['dates.checkInDate'] = {};
      if (checkInFrom) conditions['dates.checkInDate'].$gte = new Date(checkInFrom);
      if (checkInTo) conditions['dates.checkInDate'].$lte = new Date(checkInTo);
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const [reservations, total] = await Promise.all([
      Reservation.find(conditions)
        .populate('propertyId', 'name address.city')
        .populate('roomId', 'nameOrNumber type')
        .populate('guestId', 'firstName lastName email phone')
        .populate('payments')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ 'dates.checkInDate': -1 }),
      Reservation.countDocuments(conditions)
    ]);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        reservations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch reservations'
    });
  }
};

/**
 * Get reservation by ID
 * GET /api/reservations/:reservationId
 */
export const getReservationById = async (req, res) => {
  try {
    const { reservationId } = req.params;

    const reservation = await Reservation.findOne({
      _id: reservationId,
      tenantId: req.user.tenantId
    })
    .populate('propertyId')
    .populate('roomId')
    .populate('guestId')
    .populate('payments');

    if (!reservation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { reservation }
    });

  } catch (error) {
    console.error('Get reservation error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch reservation'
    });
  }
};

/**
 * Create new reservation
 * POST /api/reservations
 */
export const createReservation = async (req, res) => {
  try {
    const reservationData = {
      ...req.body,
      tenantId: req.user.tenantId
    };

    // Validate room availability
    const room = await Room.findOne({
      _id: reservationData.roomId,
      tenantId: req.user.tenantId,
      isActive: true
    });

    if (!room) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if room is available for the date range
    const isAvailable = await room.isAvailableForDateRange(
      reservationData.dates.checkInDate,
      reservationData.dates.checkOutDate
    );

    if (!isAvailable) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'Room is not available for the selected dates'
      });
    }

    // Validate guest capacity
    const totalGuests = reservationData.guests.adults + (reservationData.guests.children || 0);
    if (totalGuests > room.totalCapacity) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Guest count exceeds room capacity'
      });
    }

    // Create reservation
    const reservation = new Reservation(reservationData);
    const savedReservation = await reservation.save();

    // Populate related data for response
    await savedReservation.populate([
      { path: 'propertyId', select: 'name' },
      { path: 'roomId', select: 'nameOrNumber type' },
      { path: 'guestId', select: 'firstName lastName email' }
    ]);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Reservation created successfully',
      data: { reservation: savedReservation }
    });

  } catch (error) {
    console.error('Create reservation error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create reservation'
    });
  }
};

/**
 * Check-in guest
 * PUT /api/reservations/:reservationId/checkin
 */
export const checkInGuest = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { notes } = req.body;

    const reservation = await Reservation.findOne({
      _id: reservationId,
      tenantId: req.user.tenantId
    });

    if (!reservation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    if (reservation.status !== RESERVATION_STATUS.CONFIRMED) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Only confirmed reservations can be checked in'
      });
    }

    // Check-in the guest
    await reservation.checkIn(req.user.id);

    // Update room status to occupied
    await Room.findByIdAndUpdate(reservation.roomId, { status: 'occupied' });

    // Update guest statistics
    const guest = await Guest.findById(reservation.guestId);
    if (guest) {
      await guest.updateStayStats(reservation.pricing.totalPrice);
    }

    // Add notes if provided
    if (notes) {
      reservation.notes = reservation.notes ? `${reservation.notes}\n\nCheck-in: ${notes}` : `Check-in: ${notes}`;
      await reservation.save();
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Guest checked in successfully',
      data: { reservation }
    });

  } catch (error) {
    console.error('Check-in error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || 'Failed to check in guest'
    });
  }
};

/**
 * Check-out guest
 * PUT /api/reservations/:reservationId/checkout
 */
export const checkOutGuest = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { notes, additionalCharges } = req.body;

    const reservation = await Reservation.findOne({
      _id: reservationId,
      tenantId: req.user.tenantId
    });

    if (!reservation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    if (reservation.status !== RESERVATION_STATUS.CHECKED_IN) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Only checked-in reservations can be checked out'
      });
    }

    // Add additional charges if provided
    if (additionalCharges && additionalCharges.length > 0) {
      const totalAdditionalCharges = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
      reservation.pricing.fees.extra += totalAdditionalCharges;
      reservation.pricing.totalPrice += totalAdditionalCharges;
      reservation.updatePaymentSummary();
    }

    // Check-out the guest
    await reservation.checkOut(req.user.id);

    // Update room status to cleaning
    await Room.findByIdAndUpdate(reservation.roomId, { status: 'cleaning' });

    // Add notes if provided
    if (notes) {
      reservation.notes = reservation.notes ? `${reservation.notes}\n\nCheck-out: ${notes}` : `Check-out: ${notes}`;
      await reservation.save();
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Guest checked out successfully',
      data: { reservation }
    });

  } catch (error) {
    console.error('Check-out error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || 'Failed to check out guest'
    });
  }
};

/**
 * Cancel reservation
 * PUT /api/reservations/:reservationId/cancel
 */
export const cancelReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { reason, refundAmount } = req.body;

    const reservation = await Reservation.findOne({
      _id: reservationId,
      tenantId: req.user.tenantId
    });

    if (!reservation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Cancel the reservation
    await reservation.cancel(req.user.id, reason, refundAmount || 0);

    // If room was occupied or reserved, make it available
    if ([RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.CHECKED_IN].includes(reservation.status)) {
      await Room.findByIdAndUpdate(reservation.roomId, { status: 'available' });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Reservation cancelled successfully',
      data: { reservation }
    });

  } catch (error) {
    console.error('Cancel reservation error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || 'Failed to cancel reservation'
    });
  }
};

/**
 * Check room availability
 * POST /api/reservations/check-availability
 */
export const checkAvailability = async (req, res) => {
  try {
    const { checkInDate, checkOutDate, propertyId, adults, children } = req.body;

    let query = { tenantId: req.user.tenantId, status: 'available', isActive: true };
    
    if (propertyId) {
      query.propertyId = propertyId;
    }

    // Find rooms that meet capacity requirements
    const totalGuests = adults + (children || 0);
    const availableRooms = await Room.findAvailableInProperty(
      req.user.tenantId,
      propertyId,
      new Date(checkInDate),
      new Date(checkOutDate)
    );

    // Filter by capacity and calculate pricing
    const suitableRooms = availableRooms
      .filter(room => room.totalCapacity >= totalGuests)
      .map(room => {
        const nights = Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24));
        const pricing = room.calculatePrice(nights, adults, children);
        
        return {
          ...room.toJSON(),
          availability: {
            available: true,
            nights,
            pricing: {
              basePrice: room.pricing.basePrice,
              totalPrice: pricing,
              currency: room.pricing.currency
            }
          }
        };
      });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        checkInDate,
        checkOutDate,
        totalGuests,
        availableRooms: suitableRooms,
        count: suitableRooms.length
      }
    });

  } catch (error) {
    console.error('Check availability error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to check availability'
    });
  }
};

/**
 * Get current reservations (checked-in guests)
 * GET /api/reservations/current
 */
export const getCurrentReservations = async (req, res) => {
  try {
    const currentReservations = await Reservation.findCurrent(req.user.tenantId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        reservations: currentReservations,
        count: currentReservations.length
      }
    });

  } catch (error) {
    console.error('Get current reservations error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch current reservations'
    });
  }
};
