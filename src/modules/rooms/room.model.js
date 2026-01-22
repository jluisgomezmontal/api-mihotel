import mongoose from 'mongoose';
import { ROOM_TYPES, ROOM_STATUS } from '../../config/constants.js';
import { baseSchemaPlugin, softDeletePlugin } from '../../utils/baseModel.js';

/**
 * Room Schema - Represents individual rooms, suites, or apartments
 */
const roomSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: [true, 'Property ID is required'],
    index: true
  },
  nameOrNumber: {
    type: String,
    required: [true, 'Room name or number is required'],
    trim: true,
    maxlength: [50, 'Room name/number cannot exceed 50 characters']
  },
  type: {
    type: String,
    enum: {
      values: Object.values(ROOM_TYPES),
      message: 'Invalid room type. Must be one of: {VALUES}'
    },
    required: [true, 'Room type is required']
  },
  capacity: {
    adults: {
      type: Number,
      required: [true, 'Adult capacity is required'],
      min: [1, 'Adult capacity must be at least 1'],
      max: [20, 'Adult capacity cannot exceed 20']
    },
    children: {
      type: Number,
      default: 0,
      min: [0, 'Children capacity cannot be negative'],
      max: [10, 'Children capacity cannot exceed 10']
    }
  },
  pricing: {
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: [0, 'Base price cannot be negative']
    },
    currency: {
      type: String,
      default: 'USD',
      maxlength: [3, 'Currency code cannot exceed 3 characters']
    },
    extraAdultPrice: {
      type: Number,
      default: 0,
      min: [0, 'Extra adult price cannot be negative']
    },
    extraChildPrice: {
      type: Number,
      default: 0,
      min: [0, 'Extra child price cannot be negative']
    }
  },
  amenities: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: {
      values: Object.values(ROOM_STATUS),
      message: 'Invalid room status. Must be one of: {VALUES}'
    },
    default: ROOM_STATUS.AVAILABLE
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    caption: {
      type: String,
      trim: true
    },
    isMain: {
      type: Boolean,
      default: false
    }
  }],
  dimensions: {
    area: {
      type: Number,
      min: [0, 'Area cannot be negative']
    },
    unit: {
      type: String,
      enum: ['sqm', 'sqft'],
      default: 'sqm'
    }
  },
  bedConfiguration: [{
    type: {
      type: String,
      enum: ['single', 'double', 'queen', 'king', 'sofa_bed', 'bunk_bed'],
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Bed quantity must be at least 1']
    }
  }],
  maintenance: {
    lastCleanedAt: {
      type: Date
    },
    lastMaintenanceAt: {
      type: Date
    },
    nextMaintenanceDate: {
      type: Date
    },
    notes: {
      type: String,
      trim: true
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Apply base schema plugins
roomSchema.plugin(baseSchemaPlugin);
roomSchema.plugin(softDeletePlugin);

// Compound indexes for multi-tenant uniqueness and performance
roomSchema.index({ tenantId: 1, propertyId: 1, nameOrNumber: 1 }, { unique: true });
roomSchema.index({ tenantId: 1, propertyId: 1, status: 1 });
roomSchema.index({ tenantId: 1, status: 1 });
roomSchema.index({ tenantId: 1, type: 1 });

// Virtual for current reservation
roomSchema.virtual('currentReservation', {
  ref: 'Reservation',
  localField: '_id',
  foreignField: 'roomId',
  justOne: true,
  match: { 
    isActive: true,
    status: { $in: ['confirmed', 'checked_in'] },
    checkOutDate: { $gte: new Date() }
  }
});

// Virtual for total capacity
roomSchema.virtual('totalCapacity').get(function() {
  return this.capacity.adults + this.capacity.children;
});

// Instance method to check if room is available for date range
roomSchema.methods.isAvailableForDateRange = async function(checkInDate, checkOutDate, excludeReservationId = null) {
  if (this.status !== ROOM_STATUS.AVAILABLE) {
    return false;
  }

  const Reservation = mongoose.model('Reservation');
  
  // Normalize dates to start of day
  const newCheckIn = new Date(checkInDate);
  newCheckIn.setHours(0, 0, 0, 0);
  const newCheckOut = new Date(checkOutDate);
  newCheckOut.setHours(0, 0, 0, 0);
  
  // Build query
  const query = {
    tenantId: this.tenantId,
    roomId: this._id,
    isActive: true,
    status: { $in: ['pending', 'confirmed', 'checked_in'] }, // Include pending reservations
  };
  
  // Exclude specific reservation (for updates)
  if (excludeReservationId) {
    query._id = { $ne: excludeReservationId };
  }
  
  // Find all reservations for this room
  const existingReservations = await Reservation.find(query);
  
  // Check for conflicts with proper date logic
  for (const res of existingReservations) {
    const resCheckIn = new Date(res.dates.checkInDate);
    resCheckIn.setHours(0, 0, 0, 0);
    const resCheckOut = new Date(res.dates.checkOutDate);
    resCheckOut.setHours(0, 0, 0, 0);
    
    // Conflict logic: room is occupied [checkIn, checkOut)
    // No conflict if new check-in >= existing check-out OR new check-out <= existing check-in
    if (newCheckIn.getTime() >= resCheckOut.getTime()) continue; // New reservation starts after existing ends
    if (newCheckOut.getTime() <= resCheckIn.getTime()) continue; // New reservation ends before existing starts
    
    // If we reach here, there's a conflict
    return false;
  }

  return true;
};

// Instance method to calculate price for stay
roomSchema.methods.calculatePrice = function(nights, adults = 1, children = 0) {
  let totalPrice = this.pricing.basePrice * nights;
  
  // Add extra adult charges
  if (adults > this.capacity.adults) {
    const extraAdults = adults - this.capacity.adults;
    totalPrice += extraAdults * this.pricing.extraAdultPrice * nights;
  }
  
  // Add extra child charges
  if (children > this.capacity.children) {
    const extraChildren = children - this.capacity.children;
    totalPrice += extraChildren * this.pricing.extraChildPrice * nights;
  }
  
  return totalPrice;
};

// Instance method to update status
roomSchema.methods.updateStatus = function(newStatus, notes = '') {
  this.status = newStatus;
  
  if (newStatus === ROOM_STATUS.CLEANING) {
    this.maintenance.lastCleanedAt = new Date();
  } else if (newStatus === ROOM_STATUS.MAINTENANCE) {
    this.maintenance.lastMaintenanceAt = new Date();
    if (notes) {
      this.maintenance.notes = notes;
    }
  }
  
  return this.save();
};

// Static method to find available rooms in property
roomSchema.statics.findAvailableInProperty = function(tenantId, propertyId, checkInDate, checkOutDate) {
  return this.aggregate([
    {
      $match: {
        tenantId: mongoose.Types.ObjectId(tenantId),
        propertyId: mongoose.Types.ObjectId(propertyId),
        status: ROOM_STATUS.AVAILABLE,
        isActive: true
      }
    },
    {
      $lookup: {
        from: 'reservations',
        let: { roomId: '$_id', tenantId: '$tenantId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$roomId', '$$roomId'] },
                  { $eq: ['$tenantId', '$$tenantId'] },
                  { $eq: ['$isActive', true] },
                  { $in: ['$status', ['confirmed', 'checked_in']] },
                  {
                    $or: [
                      {
                        $and: [
                          { $lte: ['$checkInDate', checkInDate] },
                          { $gt: ['$checkOutDate', checkInDate] }
                        ]
                      },
                      {
                        $and: [
                          { $lt: ['$checkInDate', checkOutDate] },
                          { $gte: ['$checkOutDate', checkOutDate] }
                        ]
                      },
                      {
                        $and: [
                          { $gte: ['$checkInDate', checkInDate] },
                          { $lte: ['$checkOutDate', checkOutDate] }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          }
        ],
        as: 'conflictingReservations'
      }
    },
    {
      $match: {
        conflictingReservations: { $size: 0 }
      }
    },
    {
      $project: {
        conflictingReservations: 0
      }
    }
  ]);
};

export default mongoose.model('Room', roomSchema);
