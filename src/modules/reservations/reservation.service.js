import mongoose from 'mongoose';
import Reservation from './reservation.model.js';
import Room from '../rooms/room.model.js';

/**
 * Reservation Service
 * Business logic for reservation operations
 */

/**
 * Check if a room is available for the given date range
 * @param {Object} params - Validation parameters
 * @param {String} params.roomId - Room ID to check
 * @param {Date} params.checkInDate - Check-in date
 * @param {Date} params.checkOutDate - Check-out date
 * @param {String} params.tenantId - Tenant ID for multi-tenant isolation
 * @param {String} params.excludeReservationId - Optional reservation ID to exclude (for updates)
 * @returns {Object} { available: boolean, conflictingReservation: Object|null }
 */
export const checkRoomAvailability = async ({
  roomId,
  checkInDate,
  checkOutDate,
  tenantId,
  excludeReservationId = null
}) => {
  try {
    // Normalize dates to start of day to avoid timezone issues
    const normalizeDate = (date) => {
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      return normalized;
    };

    const newCheckIn = normalizeDate(checkInDate);
    const newCheckOut = normalizeDate(checkOutDate);

    console.log('🔍 Checking room availability:', {
      roomId,
      checkInDate: newCheckIn.toISOString(),
      checkOutDate: newCheckOut.toISOString(),
      tenantId,
      excludeReservationId
    });

    // Build query to find overlapping reservations
    // Convert IDs to ObjectId to ensure proper matching
    const query = {
      roomId: mongoose.Types.ObjectId.isValid(roomId) ? new mongoose.Types.ObjectId(roomId) : roomId,
      tenantId: mongoose.Types.ObjectId.isValid(tenantId) ? new mongoose.Types.ObjectId(tenantId) : tenantId,
      isActive: true,
      status: { $in: ['pending', 'confirmed', 'checked_in'] }
    };
    
    console.log('🔍 Query being used:', JSON.stringify(query, null, 2));

    // Exclude current reservation if updating
    if (excludeReservationId) {
      query._id = { $ne: excludeReservationId };
    }

    // Find all active reservations for this room
    const existingReservations = await Reservation.find(query)
      .select('dates confirmationNumber status')
      .lean();

    console.log(`📋 Found ${existingReservations.length} existing reservations for room ${roomId}`);
    
    if (existingReservations.length > 0) {
      console.log('📋 Existing reservations details:', existingReservations.map(r => ({
        confirmation: r.confirmationNumber,
        checkIn: new Date(r.dates.checkInDate).toISOString(),
        checkOut: new Date(r.dates.checkOutDate).toISOString(),
        status: r.status
      })));
    }

    // Check for date overlap
    // Two reservations overlap if:
    // (StartA < EndB) AND (EndA > StartB)
    const conflictingReservation = existingReservations.find(reservation => {
      const existingCheckIn = normalizeDate(reservation.dates.checkInDate);
      const existingCheckOut = normalizeDate(reservation.dates.checkOutDate);
      
      const hasOverlap = (
        newCheckIn < existingCheckOut && 
        newCheckOut > existingCheckIn
      );

      console.log(`🔍 Comparing with reservation ${reservation.confirmationNumber}:`, {
        newReservation: {
          checkIn: newCheckIn.toISOString(),
          checkOut: newCheckOut.toISOString()
        },
        existingReservation: {
          checkIn: existingCheckIn.toISOString(),
          checkOut: existingCheckOut.toISOString()
        },
        hasOverlap
      });

      if (hasOverlap) {
        console.log('❌ Overlap detected with reservation:', reservation.confirmationNumber);
      }

      return hasOverlap;
    });

    if (conflictingReservation) {
      return {
        available: false,
        conflictingReservation
      };
    }

    console.log('✅ Room is available for the requested dates');
    return {
      available: true,
      conflictingReservation: null
    };

  } catch (error) {
    console.error('❌ Error checking room availability:', error);
    throw error;
  }
};

/**
 * Validate reservation dates
 * @param {Date} checkInDate - Check-in date
 * @param {Date} checkOutDate - Check-out date
 * @returns {Object} { valid: boolean, message: string|null }
 */
export const validateReservationDates = (checkInDate, checkOutDate) => {
  // Check if dates are valid
  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    return {
      valid: false,
      message: '📅 Fechas inválidas. Por favor verifica las fechas de entrada y salida.'
    };
  }

  // Check if check-out is after check-in
  if (checkOutDate.getTime() <= checkInDate.getTime()) {
    return {
      valid: false,
      message: '📅 La fecha de salida debe ser posterior a la fecha de entrada.'
    };
  }

  // Check if check-in is not in the past (optional, can be disabled for flexibility)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (checkInDate < today) {
    return {
      valid: false,
      message: '📅 La fecha de entrada no puede ser en el pasado.'
    };
  }

  return {
    valid: true,
    message: null
  };
};

/**
 * Validate guest capacity for a room
 * @param {Object} params - Validation parameters
 * @param {Number} params.adults - Number of adults
 * @param {Number} params.children - Number of children
 * @param {Object} params.room - Room object with capacity
 * @returns {Object} { valid: boolean, message: string|null }
 */
export const validateGuestCapacity = ({ adults, children, room }) => {
  const totalGuests = adults + children;
  const roomCapacity = (room.capacity?.adults || 0) + (room.capacity?.children || 0);

  if (totalGuests < 1) {
    return {
      valid: false,
      message: '👥 Debe haber al menos 1 huésped.'
    };
  }

  if (totalGuests > roomCapacity) {
    return {
      valid: false,
      message: `👥 La habitación "${room.nameOrNumber}" tiene capacidad máxima de ${roomCapacity} persona(s).\nHuéspedes solicitados: ${totalGuests} (${adults} adulto(s), ${children} niño(s)).`
    };
  }

  return {
    valid: true,
    message: null
  };
};

/**
 * Get available rooms for a property in a date range
 * @param {Object} params - Query parameters
 * @param {String} params.propertyId - Property ID
 * @param {Date} params.checkInDate - Check-in date
 * @param {Date} params.checkOutDate - Check-out date
 * @param {String} params.tenantId - Tenant ID
 * @returns {Array} Array of available room IDs
 */
export const getAvailableRooms = async ({
  propertyId,
  checkInDate,
  checkOutDate,
  tenantId
}) => {
  try {
    // Get all rooms for the property
    const allRooms = await Room.find({
      propertyId,
      tenantId,
      isActive: true
    }).select('_id nameOrNumber').lean();

    // Get all overlapping reservations
    const overlappingReservations = await Reservation.find({
      propertyId,
      tenantId,
      isActive: true,
      status: { $in: ['pending', 'confirmed', 'checked-in'] },
      'dates.checkInDate': { $lt: checkOutDate },
      'dates.checkOutDate': { $gt: checkInDate }
    }).select('roomId').lean();

    // Get IDs of occupied rooms
    const occupiedRoomIds = overlappingReservations.map(r => r.roomId.toString());

    // Filter available rooms
    const availableRooms = allRooms.filter(room => 
      !occupiedRoomIds.includes(room._id.toString())
    );

    return availableRooms;

  } catch (error) {
    console.error('❌ Error getting available rooms:', error);
    throw error;
  }
};

export default {
  checkRoomAvailability,
  validateReservationDates,
  validateGuestCapacity,
  getAvailableRooms
};
