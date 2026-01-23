import Reservation from './reservation.model.js';
import Room from '../rooms/room.model.js';
import Guest from '../guests/guest.model.js';
import Property from '../properties/property.model.js';
import { HTTP_STATUS, RESERVATION_STATUS } from '../../config/constants.js';
import { checkRoomAvailability, validateReservationDates, validateGuestCapacity } from './reservation.service.js';

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
    const conditions = { 
      tenantId: req.user.tenantId,
      isActive: true  // Only show active reservations (exclude soft deleted)
    };
    
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
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch reservations',
      error: error.message
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
    .populate('guestId');

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
    const reservationData = req.body;
    
    console.log('🆕 Creating new reservation with data:', {
      propertyId: reservationData.propertyId,
      roomId: reservationData.roomId,
      guestId: reservationData.guestId,
      checkInDate: reservationData.dates?.checkInDate,
      checkOutDate: reservationData.dates?.checkOutDate,
      tenantId: req.user.tenantId
    });
    
    // 1. Validar fechas
    const checkInDate = new Date(reservationData.dates.checkInDate);
    const checkOutDate = new Date(reservationData.dates.checkOutDate);
    
    const dateValidation = validateReservationDates(checkInDate, checkOutDate);
    if (!dateValidation.valid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: dateValidation.message
      });
    }

    // 2. Validar que la propiedad existe y pertenece al tenant
    const property = await Property.findOne({
      _id: reservationData.propertyId,
      tenantId: req.user.tenantId,
      isActive: true
    });

    if (!property) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '🏨 Propiedad no encontrada.'
      });
    }

    // 3. Validar que la habitación existe y pertenece a la propiedad
    const room = await Room.findOne({
      _id: reservationData.roomId,
      propertyId: reservationData.propertyId,
      tenantId: req.user.tenantId,
      isActive: true
    });

    if (!room) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '🚪 Habitación no encontrada o no disponible.'
      });
    }

    // 4. Validar que el huésped existe
    const guest = await Guest.findOne({
      _id: reservationData.guestId,
      tenantId: req.user.tenantId,
      isActive: true
    });

    if (!guest) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '👤 Huésped no encontrado.'
      });
    }

    // 5. Validar capacidad de huéspedes
    const adults = reservationData.guests?.adults || 1;
    const children = reservationData.guests?.children || 0;
    
    const capacityValidation = validateGuestCapacity({ adults, children, room });
    if (!capacityValidation.valid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: capacityValidation.message
      });
    }

    // 6. Verificar disponibilidad de la habitación (solapamiento de reservas)
    console.log('🔍 Validating room availability before creating reservation...');
    const availabilityCheck = await checkRoomAvailability({
      roomId: reservationData.roomId,
      checkInDate,
      checkOutDate,
      tenantId: req.user.tenantId
    });

    if (!availabilityCheck.available) {
      const conflicting = availabilityCheck.conflictingReservation;
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: `❌ La habitación "${room.nameOrNumber}" ya está reservada en esas fechas.\n\nReserva existente:\n• Check-in: ${new Date(conflicting.dates.checkInDate).toLocaleDateString('es-MX')}\n• Check-out: ${new Date(conflicting.dates.checkOutDate).toLocaleDateString('es-MX')}\n• Confirmación: ${conflicting.confirmationNumber}\n• Estado: ${conflicting.status}`
      });
    }
    console.log('✅ Room is available, proceeding with reservation creation');

    // 7. Generar número de confirmación
    const confirmationNumber = await Reservation.generateConfirmationNumber();
    
    // 8. Determinar el estado inicial y timestamps
    const isDirectCheckIn = reservationData.status === 'checked_in';
    const reservationStatus = isDirectCheckIn ? 'checked_in' : 'pending';
    
    // 9. Crear reservación
    const reservation = new Reservation({
      ...reservationData,
      tenantId: req.user.tenantId,
      confirmationNumber,
      status: reservationStatus,
      dates: {
        checkInDate,
        checkOutDate,
        ...(isDirectCheckIn && { actualCheckInDate: new Date() })
      },
      guests: {
        adults,
        children: children || 0
      },
      timestamps: {
        bookedAt: new Date(),
        ...(isDirectCheckIn && { 
          confirmedAt: new Date(),
          checkedInAt: new Date()
        })
      }
    });
    
    const savedReservation = await reservation.save();

    // 10. Si es check-in directo, actualizar estado de habitación y estadísticas del huésped
    if (isDirectCheckIn) {
      console.log('✅ Direct check-in: updating room status to occupied');
      await Room.findByIdAndUpdate(reservation.roomId, { status: 'occupied' });
      
      // Actualizar estadísticas del huésped
      if (guest) {
        await guest.updateStayStats(reservation.pricing.totalPrice);
      }
    }

    // 11. Popular datos relacionados para la respuesta
    await savedReservation.populate([
      { path: 'propertyId', select: 'name address' },
      { path: 'roomId', select: 'nameOrNumber type pricing' },
      { path: 'guestId', select: 'firstName lastName email phone' }
    ]);

    const successMessage = isDirectCheckIn 
      ? '✅ Reserva creada exitosamente con check-in directo. El huésped ya está registrado.'
      : '✅ Reserva creada exitosamente';
    
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: successMessage,
      data: { reservation: savedReservation }
    });

  } catch (error) {
    console.error('❌ Create reservation error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(e => e.message).join('\n');
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `⚠️ Error de validación:\n${errorMessages}`
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '🔥 Error interno del servidor. Por favor intenta de nuevo.',
      error: error.message
    });
  }
};

/**
 * Update reservation
 * PUT /api/reservations/:reservationId
 */
export const updateReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const updateData = req.body;

    // 1. Buscar la reservación existente
    const reservation = await Reservation.findOne({
      _id: reservationId,
      tenantId: req.user.tenantId
    });

    if (!reservation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '📋 Reservación no encontrada.'
      });
    }

    // 2. Validar fechas si se están actualizando
    let checkInDate = reservation.dates.checkInDate;
    let checkOutDate = reservation.dates.checkOutDate;
    
    if (updateData.dates?.checkInDate) {
      checkInDate = new Date(updateData.dates.checkInDate);
      if (isNaN(checkInDate.getTime())) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: '📅 Fecha de entrada inválida.'
        });
      }
    }
    
    if (updateData.dates?.checkOutDate) {
      checkOutDate = new Date(updateData.dates.checkOutDate);
      if (isNaN(checkOutDate.getTime())) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: '📅 Fecha de salida inválida.'
        });
      }
    }
    
    if (checkOutDate.getTime() <= checkInDate.getTime()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '📅 La fecha de salida debe ser posterior a la fecha de entrada.'
      });
    }

    // 3. Validar habitación si se está cambiando
    let room;
    const roomId = updateData.roomId || reservation.roomId;
    
    room = await Room.findOne({
      _id: roomId,
      tenantId: req.user.tenantId,
      isActive: true
    });

    if (!room) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '🚪 Habitación no encontrada o no disponible.'
      });
    }

    // 4. Validar huésped si se está cambiando
    if (updateData.guestId) {
      const guest = await Guest.findOne({
        _id: updateData.guestId,
        tenantId: req.user.tenantId,
        isActive: true
      });

      if (!guest) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: '👤 Huésped no encontrado.'
        });
      }
    }

    // 5. Validar capacidad si se están actualizando los huéspedes
    const adults = updateData.guests?.adults || reservation.guests.adults || 1;
    const children = updateData.guests?.children || reservation.guests.children || 0;
    
    const capacityValidation = validateGuestCapacity({ adults, children, room });
    if (!capacityValidation.valid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: capacityValidation.message
      });
    }

    // 6. Verificar disponibilidad si cambiaron fechas o habitación
    if (updateData.dates || updateData.roomId) {
      console.log('🔍 Validating room availability before updating reservation...');
      const availabilityCheck = await checkRoomAvailability({
        roomId: roomId,
        checkInDate,
        checkOutDate,
        tenantId: req.user.tenantId,
        excludeReservationId: reservationId
      });

      if (!availabilityCheck.available) {
        const conflicting = availabilityCheck.conflictingReservation;
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: `❌ La habitación "${room.nameOrNumber}" ya está reservada en esas fechas.\n\nReserva existente:\n• Check-in: ${new Date(conflicting.dates.checkInDate).toLocaleDateString('es-MX')}\n• Check-out: ${new Date(conflicting.dates.checkOutDate).toLocaleDateString('es-MX')}\n• Confirmación: ${conflicting.confirmationNumber}\n• Estado: ${conflicting.status}`
        });
      }
      console.log('✅ Room is available, proceeding with reservation update');
    }

    // 7. Actualizar campos
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'tenantId' && key !== 'confirmationNumber') {
        reservation[key] = updateData[key];
      }
    });
    
    // Asegurar que las fechas se actualicen correctamente
    if (updateData.dates) {
      reservation.dates.checkInDate = checkInDate;
      reservation.dates.checkOutDate = checkOutDate;
    }
    
    // Asegurar que los huéspedes se actualicen correctamente
    if (updateData.guests) {
      reservation.guests.adults = adults;
      reservation.guests.children = children;
    }

    const updatedReservation = await reservation.save();

    await updatedReservation.populate([
      { path: 'propertyId', select: 'name address' },
      { path: 'roomId', select: 'nameOrNumber type pricing' },
      { path: 'guestId', select: 'firstName lastName email phone' }
    ]);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '✅ Reservación actualizada correctamente',
      data: { reservation: updatedReservation }
    });

  } catch (error) {
    console.error('❌ Update reservation error:', error);
    
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(e => e.message).join('\n');
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `⚠️ Error de validación:\n${errorMessages}`
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '🔥 Error interno del servidor. Por favor intenta de nuevo.',
      error: error.message
    });
  }
};

/**
 * Delete reservation (soft delete)
 * DELETE /api/reservations/:reservationId
 */
export const deleteReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;

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

    // Soft delete
    reservation.isActive = false;
    await reservation.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Reservation deleted successfully'
    });

  } catch (error) {
    console.error('Delete reservation error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to delete reservation',
      error: error.message
    });
  }
};

/**
 * Confirm reservation
 * PUT /api/reservations/:reservationId/confirm
 */
export const confirmReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;

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

    if (reservation.status !== RESERVATION_STATUS.PENDING) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Only pending reservations can be confirmed'
      });
    }

    reservation.status = RESERVATION_STATUS.CONFIRMED;
    await reservation.save();

    await reservation.populate([
      { path: 'propertyId', select: 'name' },
      { path: 'roomId', select: 'nameOrNumber type' },
      { path: 'guestId', select: 'firstName lastName email' }
    ]);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Reservation confirmed successfully',
      data: { reservation }
    });

  } catch (error) {
    console.error('Confirm reservation error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to confirm reservation',
      error: error.message
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
