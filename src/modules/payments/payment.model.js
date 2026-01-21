import mongoose from 'mongoose';
import { PAYMENT_METHODS, PAYMENT_STATUS } from '../../config/constants.js';
import { baseSchemaPlugin, softDeletePlugin } from '../../utils/baseModel.js';

/**
 * Payment Schema - Represents payment transactions for reservations
 */
const paymentSchema = new mongoose.Schema({
  reservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reservation',
    required: [true, 'Reservation ID is required'],
    index: true
  },
  transactionId: {
    type: String,
    unique: true,
    required: true,
    uppercase: true
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0.01, 'Payment amount must be greater than 0']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    default: 'USD',
    maxlength: [3, 'Currency code cannot exceed 3 characters']
  },
  method: {
    type: String,
    enum: {
      values: Object.values(PAYMENT_METHODS),
      message: 'Invalid payment method. Must be one of: {VALUES}'
    },
    required: [true, 'Payment method is required']
  },
  status: {
    type: String,
    enum: {
      values: Object.values(PAYMENT_STATUS),
      message: 'Invalid payment status. Must be one of: {VALUES}'
    },
    default: PAYMENT_STATUS.PENDING,
    index: true
  },
  details: {
    // For card payments
    cardLast4: {
      type: String,
      maxlength: 4
    },
    cardBrand: {
      type: String,
      enum: ['visa', 'mastercard', 'amex', 'discover', 'other']
    },
    // For transfer payments
    transferReference: {
      type: String,
      trim: true
    },
    bankName: {
      type: String,
      trim: true
    },
    // For cash payments
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // External payment gateway info
    gatewayTransactionId: {
      type: String,
      trim: true
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  fees: {
    processingFee: {
      type: Number,
      default: 0,
      min: [0, 'Processing fee cannot be negative']
    },
    gatewayFee: {
      type: Number,
      default: 0,
      min: [0, 'Gateway fee cannot be negative']
    }
  },
  netAmount: {
    type: Number,
    required: true
  },
  paymentDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  dueDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  refund: {
    isRefunded: {
      type: Boolean,
      default: false
    },
    refundedAmount: {
      type: Number,
      default: 0,
      min: [0, 'Refunded amount cannot be negative']
    },
    refundedAt: {
      type: Date
    },
    refundReason: {
      type: String,
      trim: true
    },
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Apply base schema plugins
paymentSchema.plugin(baseSchemaPlugin);
paymentSchema.plugin(softDeletePlugin);

// Compound indexes for multi-tenant queries and performance
paymentSchema.index({ tenantId: 1, reservationId: 1, paymentDate: -1 });
paymentSchema.index({ tenantId: 1, method: 1, status: 1 });
paymentSchema.index({ tenantId: 1, paymentDate: -1 });
paymentSchema.index({ tenantId: 1, status: 1, paymentDate: -1 });

// Pre-save middleware to calculate net amount and generate transaction ID
paymentSchema.pre('save', async function(next) {
  // Generate transaction ID if new payment
  if (this.isNew && !this.transactionId) {
    this.transactionId = await this.constructor.generateTransactionId();
  }
  
  // Calculate net amount
  this.netAmount = this.amount - this.fees.processingFee - this.fees.gatewayFee;
  
  next();
});

// Post-save middleware to update reservation payment status
paymentSchema.post('save', async function(doc) {
  if (doc.status === PAYMENT_STATUS.PAID) {
    await doc.updateReservationPaymentStatus();
  }
});

// Instance method to process refund
paymentSchema.methods.processRefund = function(amount, reason, refundedBy) {
  if (this.status !== PAYMENT_STATUS.PAID) {
    throw new Error('Cannot refund: payment is not in paid status');
  }
  
  if (amount > this.amount - this.refund.refundedAmount) {
    throw new Error('Refund amount cannot exceed available balance');
  }
  
  this.refund.isRefunded = true;
  this.refund.refundedAmount += amount;
  this.refund.refundedAt = new Date();
  this.refund.refundReason = reason;
  this.refund.refundedBy = refundedBy;
  
  // If fully refunded, update status
  if (this.refund.refundedAmount >= this.amount) {
    this.status = PAYMENT_STATUS.PENDING; // Or create a REFUNDED status
  }
  
  return this.save();
};

// Instance method to update reservation payment status
paymentSchema.methods.updateReservationPaymentStatus = async function() {
  const Reservation = mongoose.model('Reservation');
  const reservation = await Reservation.findById(this.reservationId);
  
  if (!reservation) return;
  
  // Calculate total payments for this reservation
  const Payment = mongoose.model('Payment');
  const payments = await Payment.find({
    reservationId: this.reservationId,
    status: PAYMENT_STATUS.PAID,
    isActive: true
  });
  
  const totalPaid = payments.reduce((sum, payment) => {
    return sum + payment.amount - payment.refund.refundedAmount;
  }, 0);
  
  // Update reservation payment summary
  reservation.paymentSummary.totalPaid = totalPaid;
  reservation.updatePaymentSummary();
  
  await reservation.save();
};

// Static method to generate unique transaction ID
paymentSchema.statics.generateTransactionId = async function() {
  let transactionId;
  let exists = true;
  
  while (exists) {
    const prefix = 'PAY';
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    transactionId = `${prefix}${timestamp}${random}`;
    
    exists = await this.findOne({ transactionId });
  }
  
  return transactionId;
};

// Static method to find payments by reservation
paymentSchema.statics.findByReservation = function(tenantId, reservationId) {
  return this.find({
    tenantId,
    reservationId,
    isActive: true
  }).sort({ paymentDate: -1 });
};

// Static method to get payment summary for date range
paymentSchema.statics.getPaymentSummary = function(tenantId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        tenantId: mongoose.Types.ObjectId(tenantId),
        paymentDate: { $gte: startDate, $lte: endDate },
        status: PAYMENT_STATUS.PAID,
        isActive: true
      }
    },
    {
      $group: {
        _id: {
          method: '$method',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } }
        },
        totalAmount: { $sum: '$amount' },
        totalNetAmount: { $sum: '$netAmount' },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.method',
        dailyTotals: {
          $push: {
            date: '$_id.date',
            totalAmount: '$totalAmount',
            totalNetAmount: '$totalNetAmount',
            count: '$count'
          }
        },
        totalAmount: { $sum: '$totalAmount' },
        totalNetAmount: { $sum: '$totalNetAmount' },
        totalCount: { $sum: '$count' }
      }
    }
  ]);
};

// Static method to find pending payments
paymentSchema.statics.findPending = function(tenantId) {
  return this.find({
    tenantId,
    status: PAYMENT_STATUS.PENDING,
    isActive: true
  })
    .populate('reservationId', 'confirmationNumber dates.checkInDate')
    .sort({ dueDate: 1, createdAt: 1 });
};

export default mongoose.model('Payment', paymentSchema);
