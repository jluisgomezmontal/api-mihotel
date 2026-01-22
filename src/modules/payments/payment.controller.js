import Payment from './payment.model.js';
import Reservation from '../reservations/reservation.model.js';
import { HTTP_STATUS, PAYMENT_STATUS } from '../../config/constants.js';

/**
 * Payment Controller
 * Handles all payment-related operations
 */

/**
 * Create a new payment
 * POST /api/payments
 */
export const createPayment = async (req, res) => {
  try {
    const { reservationId, amount, currency, method, details, paymentDate, dueDate, notes } = req.body;

    console.log('💳 Creating payment:', { reservationId, amount, currency, method });

    // 1. Validar que la reservación existe y pertenece al tenant
    const reservation = await Reservation.findOne({
      _id: reservationId,
      tenantId: req.user.tenantId,
      isActive: true
    });

    if (!reservation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '📋 Reservación no encontrada.'
      });
    }

    // 2. Validar que el monto no exceda el balance pendiente
    const remainingBalance = reservation.paymentSummary.remainingBalance;
    if (amount > remainingBalance) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `💰 El monto del pago ($${amount}) excede el balance pendiente ($${remainingBalance}).`
      });
    }

    // 3. Generar transactionId único
    const transactionId = await Payment.generateTransactionId();
    
    // 4. Calcular netAmount (amount menos fees)
    const processingFee = details?.processingFee || 0;
    const gatewayFee = details?.gatewayFee || 0;
    const netAmount = amount - processingFee - gatewayFee;

    console.log('💳 Payment details:', { transactionId, netAmount, processingFee, gatewayFee });

    // 5. Crear el pago con todos los campos requeridos
    const payment = new Payment({
      tenantId: req.user.tenantId,
      reservationId,
      transactionId,
      amount,
      netAmount,
      currency: currency || 'MXN',
      method,
      details: details || {},
      fees: {
        processingFee: processingFee,
        gatewayFee: gatewayFee
      },
      paymentDate: paymentDate || new Date(),
      dueDate,
      notes,
      status: PAYMENT_STATUS.PAID // Por defecto pagado al crear
    });

    await payment.save();

    console.log('✅ Payment saved successfully:', payment._id);

    // 6. Popular datos relacionados
    await payment.populate([
      { 
        path: 'reservationId', 
        select: 'confirmationNumber dates pricing guestId roomId propertyId',
        populate: [
          { path: 'guestId', select: 'firstName lastName email' },
          { path: 'roomId', select: 'nameOrNumber' },
          { path: 'propertyId', select: 'name' }
        ]
      },
      { path: 'details.receivedBy', select: 'name email' }
    ]);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: '✅ Pago registrado correctamente',
      data: { payment }
    });

  } catch (error) {
    console.error('❌ Error al crear pago:', error);
    
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors)
        .map(e => `• ${e.message}`)
        .join('\n');
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `⚠️ Error de validación:\n${errorMessages}`
      });
    }

    if (error.code === 11000) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '⚠️ Ya existe un pago con ese ID de transacción. Por favor intenta nuevamente.'
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
 * Get all payments with filters and pagination
 * GET /api/payments
 */
export const getPayments = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      reservationId,
      method,
      status,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount
    } = req.query;

    // Build query conditions
    const conditions = {
      tenantId: req.user.tenantId,
      isActive: true
    };

    if (reservationId) {
      conditions.reservationId = reservationId;
    }

    if (method) {
      conditions.method = method;
    }

    if (status) {
      conditions.status = status;
    }

    if (dateFrom || dateTo) {
      conditions.paymentDate = {};
      if (dateFrom) conditions.paymentDate.$gte = new Date(dateFrom);
      if (dateTo) conditions.paymentDate.$lte = new Date(dateTo);
    }

    if (minAmount || maxAmount) {
      conditions.amount = {};
      if (minAmount) conditions.amount.$gte = parseFloat(minAmount);
      if (maxAmount) conditions.amount.$lte = parseFloat(maxAmount);
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      Payment.find(conditions)
        .populate({
          path: 'reservationId',
          select: 'confirmationNumber dates guestId roomId propertyId',
          populate: [
            { path: 'guestId', select: 'firstName lastName email' },
            { path: 'roomId', select: 'nameOrNumber' },
            { path: 'propertyId', select: 'name' }
          ]
        })
        .populate('details.receivedBy', 'name email')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ paymentDate: -1 }),
      Payment.countDocuments(conditions)
    ]);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Get payments error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error al obtener los pagos'
    });
  }
};

/**
 * Get payment by ID
 * GET /api/payments/:paymentId
 */
export const getPaymentById = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findOne({
      _id: paymentId,
      tenantId: req.user.tenantId
    })
      .populate({
        path: 'reservationId',
        select: 'confirmationNumber dates pricing guestId roomId propertyId',
        populate: [
          { path: 'guestId', select: 'firstName lastName email phone' },
          { path: 'roomId', select: 'nameOrNumber type' },
          { path: 'propertyId', select: 'name address' }
        ]
      })
      .populate('details.receivedBy', 'name email')
      .populate('refund.refundedBy', 'name email');

    if (!payment) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '💳 Pago no encontrado'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { payment }
    });

  } catch (error) {
    console.error('❌ Get payment by ID error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error al obtener el pago'
    });
  }
};

/**
 * Get payments by reservation
 * GET /api/payments/reservation/:reservationId
 */
export const getPaymentsByReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;

    // Verificar que la reservación existe y pertenece al tenant
    const reservation = await Reservation.findOne({
      _id: reservationId,
      tenantId: req.user.tenantId
    });

    if (!reservation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '📋 Reservación no encontrada'
      });
    }

    const payments = await Payment.findByReservation(req.user.tenantId, reservationId)
      .populate('details.receivedBy', 'name email');

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { 
        payments,
        summary: {
          totalPaid: reservation.paymentSummary.totalPaid,
          remainingBalance: reservation.paymentSummary.remainingBalance,
          totalPrice: reservation.pricing.totalPrice
        }
      }
    });

  } catch (error) {
    console.error('❌ Get payments by reservation error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error al obtener los pagos de la reservación'
    });
  }
};

/**
 * Update payment
 * PUT /api/payments/:paymentId
 */
export const updatePayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status, details, paymentDate, notes } = req.body;

    const payment = await Payment.findOne({
      _id: paymentId,
      tenantId: req.user.tenantId
    });

    if (!payment) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '💳 Pago no encontrado'
      });
    }

    // Actualizar campos permitidos
    if (status) payment.status = status;
    if (details) payment.details = { ...payment.details, ...details };
    if (paymentDate) payment.paymentDate = paymentDate;
    if (notes !== undefined) payment.notes = notes;

    await payment.save();

    await payment.populate([
      {
        path: 'reservationId',
        select: 'confirmationNumber dates guestId roomId',
        populate: [
          { path: 'guestId', select: 'firstName lastName email' },
          { path: 'roomId', select: 'nameOrNumber' }
        ]
      },
      { path: 'details.receivedBy', select: 'name email' }
    ]);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '✅ Pago actualizado correctamente',
      data: { payment }
    });

  } catch (error) {
    console.error('❌ Update payment error:', error);
    
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(e => e.message).join('\n');
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `⚠️ Error de validación:\n${errorMessages}`
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '🔥 Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Process refund
 * POST /api/payments/:paymentId/refund
 */
export const processRefund = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    const payment = await Payment.findOne({
      _id: paymentId,
      tenantId: req.user.tenantId
    });

    if (!payment) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '💳 Pago no encontrado'
      });
    }

    // Validar monto del reembolso
    if (!amount || amount <= 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '💰 El monto del reembolso debe ser mayor a 0'
      });
    }

    const availableForRefund = payment.amount - payment.refund.refundedAmount;
    if (amount > availableForRefund) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `💰 El monto del reembolso ($${amount}) excede el monto disponible ($${availableForRefund})`
      });
    }

    // Procesar reembolso
    await payment.processRefund(amount, reason, req.user.id);

    await payment.populate([
      {
        path: 'reservationId',
        select: 'confirmationNumber dates guestId roomId',
        populate: [
          { path: 'guestId', select: 'firstName lastName email' },
          { path: 'roomId', select: 'nameOrNumber' }
        ]
      },
      { path: 'refund.refundedBy', select: 'name email' }
    ]);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '✅ Reembolso procesado correctamente',
      data: { payment }
    });

  } catch (error) {
    console.error('❌ Process refund error:', error);
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: error.message || 'Error al procesar el reembolso'
    });
  }
};

/**
 * Delete payment (soft delete)
 * DELETE /api/payments/:paymentId
 */
export const deletePayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findOne({
      _id: paymentId,
      tenantId: req.user.tenantId
    });

    if (!payment) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '💳 Pago no encontrado'
      });
    }

    // Verificar que el pago no esté completado
    if (payment.status === PAYMENT_STATUS.PAID) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: '⚠️ No se puede eliminar un pago completado. Procesa un reembolso en su lugar.'
      });
    }

    payment.isActive = false;
    await payment.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '✅ Pago eliminado correctamente'
    });

  } catch (error) {
    console.error('❌ Delete payment error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error al eliminar el pago'
    });
  }
};

/**
 * Get payment summary for date range
 * GET /api/payments/summary
 */
export const getPaymentSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '📅 Se requieren fechas de inicio y fin'
      });
    }

    const summary = await Payment.getPaymentSummary(
      req.user.tenantId,
      new Date(startDate),
      new Date(endDate)
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { summary }
    });

  } catch (error) {
    console.error('❌ Get payment summary error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error al obtener el resumen de pagos'
    });
  }
};

/**
 * Get pending payments
 * GET /api/payments/pending
 */
export const getPendingPayments = async (req, res) => {
  try {
    const payments = await Payment.findPending(req.user.tenantId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { payments }
    });

  } catch (error) {
    console.error('❌ Get pending payments error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error al obtener pagos pendientes'
    });
  }
};
