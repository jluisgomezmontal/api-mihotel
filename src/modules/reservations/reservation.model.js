import mongoose from 'mongoose';
import { RESERVATION_STATUS, PAYMENT_STATUS } from '../../config/constants.js';
import { baseSchemaPlugin, softDeletePlugin } from '../../utils/baseModel.js';

/**
 * Reservation Schema - Represents booking reservations
 */
const reservationSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: [true, 'Property ID is required'],
    index: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: [true, 'Room ID is required'],
    index: true
  },
  guestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guest',
    required: [true, 'Guest ID is required'],
    index: true
  },
  confirmationNumber: {
    type: String,
    unique: true,
    required: true,
    uppercase: true
  },
  dates: {
    checkInDate: {
      type: Date,
      required: [true, 'Check-in date is required'],
      index: true
    },
    checkOutDate: {
      type: Date,
      required: [true, 'Check-out date is required'],
      index: true
    },
    actualCheckInDate: {
      type: Date
    },
    actualCheckOutDate: {
      type: Date
    }
  },
  guests: {
    adults: {
      type: Number,
      required: [true, 'Number of adults is required'],
      min: [1, 'At least 1 adult is required'],
      max: [20, 'Cannot exceed 20 adults']
    },
    children: {
      type: Number,
      default: 0,
      min: [0, 'Children count cannot be negative'],
      max: [10, 'Cannot exceed 10 children']
    },
    additionalGuests: [{
      firstName: {
        type: String,
        required: true,
        trim: true
      },
      lastName: {
        type: String,
        required: true,
        trim: true
      },
      age: {
        type: Number,
        min: 0,
        max: 120
      },
      identification: {
        type: String,
        trim: true
      }
    }]
  },
  status: {
    type: String,
    enum: {
      values: Object.values(RESERVATION_STATUS),
      message: 'Invalid reservation status. Must be one of: {VALUES}'
    },
    default: RESERVATION_STATUS.PENDING,
    index: true
  },
  pricing: {
    roomRate: {
      type: Number,
      required: [true, 'Room rate is required'],
      min: [0, 'Room rate cannot be negative']
    },
    nights: {
      type: Number,
      required: [true, 'Number of nights is required'],
      min: [1, 'Must have at least 1 night']
    },
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal cannot be negative']
    },
    taxes: {
      type: Number,
      default: 0,
      min: [0, 'Taxes cannot be negative']
    },
    fees: {
      cleaning: {
        type: Number,
        default: 0,
        min: [0, 'Cleaning fee cannot be negative']
      },
      service: {
        type: Number,
        default: 0,
        min: [0, 'Service fee cannot be negative']
      },
      extra: {
        type: Number,
        default: 0,
        min: [0, 'Extra fees cannot be negative']
      }
    },
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: [0, 'Total price cannot be negative']
    },
    currency: {
      type: String,
      default: 'USD',
      maxlength: [3, 'Currency code cannot exceed 3 characters']
    }
  },
  paymentStatus: {
    type: String,
    enum: {
      values: Object.values(PAYMENT_STATUS),
      message: 'Invalid payment status. Must be one of: {VALUES}'
    },
    default: PAYMENT_STATUS.PENDING,
    index: true
  },
  paymentSummary: {
    totalPaid: {
      type: Number,
      default: 0,
      min: [0, 'Total paid cannot be negative']
    },
    remainingBalance: {
      type: Number,
      default: 0,
      min: [0, 'Remaining balance cannot be negative']
    },
    depositRequired: {
      type: Number,
      default: 0,
      min: [0, 'Deposit cannot be negative']
    },
    depositPaid: {
      type: Boolean,
      default: false
    }
  },
  source: {
    type: String,
    enum: ['direct', 'booking_com', 'airbnb', 'expedia', 'phone', 'walk_in', 'other'],
    default: 'direct'
  },
  specialRequests: {
    type: String,
    trim: true,
    maxlength: [1000, 'Special requests cannot exceed 1000 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },
  cancellation: {
    cancelledAt: {
      type: Date
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      trim: true
    },
    refundAmount: {
      type: Number,
      min: [0, 'Refund amount cannot be negative']
    }
  },
  timestamps: {
    bookedAt: {
      type: Date,
      default: Date.now
    },
    confirmedAt: {
      type: Date
    },
    checkedInAt: {
      type: Date
    },
    checkedOutAt: {
      type: Date
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Apply base schema plugins
reservationSchema.plugin(baseSchemaPlugin);
reservationSchema.plugin(softDeletePlugin);

// Compound indexes for multi-tenant queries and performance
reservationSchema.index({ tenantId: 1, confirmationNumber: 1 }, { unique: true });
reservationSchema.index({ tenantId: 1, propertyId: 1, 'dates.checkInDate': 1 });
reservationSchema.index({ tenantId: 1, roomId: 1, 'dates.checkInDate': 1, 'dates.checkOutDate': 1 });
reservationSchema.index({ tenantId: 1, guestId: 1, 'dates.checkInDate': -1 });
reservationSchema.index({ tenantId: 1, status: 1, 'dates.checkInDate': 1 });
reservationSchema.index({ tenantId: 1, paymentStatus: 1 });

// Virtual for total guests count
reservationSchema.virtual('totalGuests').get(function() {
  return this.guests.adults + this.guests.children;
});

// Virtual for stay duration in nights
reservationSchema.virtual('nights').get(function() {
  const checkIn = new Date(this.dates.checkInDate);
  const checkOut = new Date(this.dates.checkOutDate);
  const timeDiff = checkOut.getTime() - checkIn.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
});

// Virtual for is current (guest is currently staying)
reservationSchema.virtual('isCurrent').get(function() {
  const today = new Date();
  return this.status === RESERVATION_STATUS.CHECKED_IN &&
         this.dates.checkInDate <= today &&
         this.dates.checkOutDate > today;
});

// Virtual for payments
reservationSchema.virtual('payments', {
  ref: 'Payment',
  localField: '_id',
  foreignField: 'reservationId',
  match: { isActive: true }
});

// Pre-save middleware to generate confirmation number
reservationSchema.pre('save', async function(next) {
  if (this.isNew && !this.confirmationNumber) {
    this.confirmationNumber = await this.constructor.generateConfirmationNumber();
  }
  
  // Initialize paymentSummary if new
  if (this.isNew && !this.paymentSummary) {
    this.paymentSummary = {
      totalPaid: 0,
      remainingBalance: 0,
      depositRequired: 0,
      depositPaid: false
    };
  }
  
  // Calculate pricing if not set
  if (this.isModified('dates') || this.isModified('guests')) {
    await this.calculatePricing();
  }
  
  // Update payment summary
  this.updatePaymentSummary();
  
  next();
});

// Pre-save middleware to validate dates
reservationSchema.pre('save', function(next) {
  if (this.dates.checkInDate >= this.dates.checkOutDate) {
    return next(new Error('La fecha de check-out debe ser posterior a la fecha de check-in'));
  }
  
  // Only validate check-in date for new reservations or when dates are being modified
  // Skip validation for status changes (like checkout) on existing reservations
  if (this.isNew || this.isModified('dates.checkInDate')) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(this.dates.checkInDate);
    checkInDate.setHours(0, 0, 0, 0);
    
    if (checkInDate < today) {
      return next(new Error('La fecha de check-in no puede ser anterior a hoy'));
    }
  }
  
  next();
});

// Instance method to calculate pricing
reservationSchema.methods.calculatePricing = async function() {
  if (!this.roomId) return;
  
  const Room = mongoose.model('Room');
  const room = await Room.findById(this.roomId);
  
  if (!room) throw new Error('Room not found');
  
  this.pricing.nights = this.nights;
  this.pricing.roomRate = room.pricing.basePrice;
  
  // Calculate room cost (price already includes IVA)
  let roomCost = room.calculatePrice(this.pricing.nights, this.guests.adults, this.guests.children);
  
  // No additional taxes - room price already includes IVA
  this.pricing.taxes = 0;
  
  this.pricing.subtotal = roomCost;
  this.pricing.totalPrice = roomCost + 
                           this.pricing.fees.cleaning + 
                           this.pricing.fees.service + 
                           this.pricing.fees.extra;
  
  // Update payment summary
  this.paymentSummary.remainingBalance = this.pricing.totalPrice - this.paymentSummary.totalPaid;
};

// Instance method to update payment summary
reservationSchema.methods.updatePaymentSummary = function() {
  this.paymentSummary.remainingBalance = this.pricing.totalPrice - this.paymentSummary.totalPaid;
  
  // Update payment status based on amounts
  if (this.paymentSummary.totalPaid <= 0) {
    this.paymentStatus = PAYMENT_STATUS.PENDING;
  } else if (this.paymentSummary.remainingBalance <= 0) {
    this.paymentStatus = PAYMENT_STATUS.PAID;
  } else {
    this.paymentStatus = PAYMENT_STATUS.PARTIAL;
  }
};

// Instance method to check in guest
reservationSchema.methods.checkIn = function(userId) {
  if (this.status !== RESERVATION_STATUS.CONFIRMED) {
    throw new Error('Cannot check in: reservation is not confirmed');
  }
  
  this.status = RESERVATION_STATUS.CHECKED_IN;
  this.dates.actualCheckInDate = new Date();
  this.timestamps.checkedInAt = new Date();
  
  return this.save();
};

// Instance method to check out guest
reservationSchema.methods.checkOut = function(userId) {
  if (this.status !== RESERVATION_STATUS.CHECKED_IN) {
    throw new Error('Cannot check out: guest is not checked in');
  }
  
  this.status = RESERVATION_STATUS.CHECKED_OUT;
  this.dates.actualCheckOutDate = new Date();
  this.timestamps.checkedOutAt = new Date();
  
  return this.save();
};

// Instance method to cancel reservation
reservationSchema.methods.cancel = function(userId, reason, refundAmount = 0) {
  if ([RESERVATION_STATUS.CHECKED_OUT, RESERVATION_STATUS.CANCELLED].includes(this.status)) {
    throw new Error('Cannot cancel: reservation is already completed or cancelled');
  }
  
  this.status = RESERVATION_STATUS.CANCELLED;
  this.cancellation = {
    cancelledAt: new Date(),
    cancelledBy: userId,
    reason,
    refundAmount
  };
  
  return this.save();
};

// Static method to generate unique confirmation number
reservationSchema.statics.generateConfirmationNumber = async function() {
  let confirmationNumber;
  let exists = true;
  
  while (exists) {
    const prefix = 'MH';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    confirmationNumber = `${prefix}${random}${timestamp}`;
    
    exists = await this.findOne({ confirmationNumber });
  }
  
  return confirmationNumber;
};

// Static method to find reservations for date range
reservationSchema.statics.findForDateRange = function(tenantId, startDate, endDate, status = null) {
  const query = {
    tenantId,
    isActive: true,
    $or: [
      {
        'dates.checkInDate': { $gte: startDate, $lte: endDate }
      },
      {
        'dates.checkOutDate': { $gte: startDate, $lte: endDate }
      },
      {
        'dates.checkInDate': { $lte: startDate },
        'dates.checkOutDate': { $gte: endDate }
      }
    ]
  };
  
  if (status) {
    query.status = status;
  }
  
  return this.find(query)
    .populate('roomId', 'nameOrNumber type')
    .populate('propertyId', 'name')
    .populate('guestId', 'firstName lastName email phone')
    .sort({ 'dates.checkInDate': 1 });
};

// Static method to find current reservations
reservationSchema.statics.findCurrent = function(tenantId) {
  const today = new Date();
  return this.find({
    tenantId,
    status: RESERVATION_STATUS.CHECKED_IN,
    'dates.checkInDate': { $lte: today },
    'dates.checkOutDate': { $gt: today },
    isActive: true
  })
    .populate('roomId', 'nameOrNumber type')
    .populate('propertyId', 'name')
    .populate('guestId', 'firstName lastName email phone');
};

export default mongoose.model('Reservation', reservationSchema);
