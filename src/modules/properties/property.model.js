import mongoose from 'mongoose';
import { baseSchemaPlugin, softDeletePlugin } from '../../utils/baseModel.js';

/**
 * Property Schema - Represents a hotel, Airbnb property, or posada
 */
const propertySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Property name is required'],
    trim: true,
    maxlength: [200, 'Property name cannot exceed 200 characters']
  },
  type: {
    type: String,
    required: [true, 'Property type is required'],
    enum: ['hotel', 'airbnb', 'posada'],
    default: 'hotel'
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    postalCode: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      default: 'Mexico'
    },
    coordinates: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
      }
    }
  },
  contact: {
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email address'
      ]
    },
    website: {
      type: String,
      trim: true
    }
  },
  timezone: {
    type: String,
    required: [true, 'Timezone is required'],
    default: 'America/Mexico_City'
  },
  checkInTime: {
    type: String,
    required: [true, 'Check-in time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Check-in time must be in HH:mm format'],
    default: '15:00'
  },
  checkOutTime: {
    type: String,
    required: [true, 'Check-out time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Check-out time must be in HH:mm format'],
    default: '11:00'
  },
  amenities: [{
    type: String,
    trim: true
  }],
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
  settings: {
    allowOnlineBooking: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false
    },
    cancellationPolicy: {
      type: String,
      enum: ['flexible', 'moderate', 'strict'],
      default: 'moderate'
    },
    advanceBookingDays: {
      type: Number,
      min: [0, 'Advance booking days cannot be negative'],
      max: [365, 'Advance booking days cannot exceed 365'],
      default: 365
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Apply base schema plugins
propertySchema.plugin(baseSchemaPlugin);
propertySchema.plugin(softDeletePlugin);

// Indexes for performance and multi-tenant queries
propertySchema.index({ tenantId: 1, name: 1 });
propertySchema.index({ tenantId: 1, isActive: 1 });
propertySchema.index({ 'address.city': 1, 'address.state': 1 });

// Virtual for total rooms count
propertySchema.virtual('roomsCount', {
  ref: 'Room',
  localField: '_id',
  foreignField: 'propertyId',
  count: true,
  match: { isActive: true }
});

// Virtual for available rooms count
propertySchema.virtual('availableRoomsCount', {
  ref: 'Room',
  localField: '_id',
  foreignField: 'propertyId',
  count: true,
  match: { isActive: true, status: 'available' }
});

// Virtual for current reservations
propertySchema.virtual('currentReservations', {
  ref: 'Reservation',
  localField: '_id',
  foreignField: 'propertyId',
  match: { 
    isActive: true,
    status: { $in: ['confirmed', 'checked_in'] },
    checkOutDate: { $gte: new Date() }
  }
});

// Instance method to get full address as string
propertySchema.methods.getFullAddress = function() {
  const { street, city, state, postalCode, country } = this.address;
  return [street, city, state, postalCode, country].filter(Boolean).join(', ');
};

// Instance method to check if property allows booking for date range
propertySchema.methods.canBookForDateRange = function(checkIn, checkOut) {
  if (!this.settings.allowOnlineBooking) return false;
  
  const today = new Date();
  const maxBookingDate = new Date();
  maxBookingDate.setDate(today.getDate() + this.settings.advanceBookingDays);
  
  return checkIn >= today && checkIn <= maxBookingDate && checkOut > checkIn;
};

// Static method to find properties by location
propertySchema.statics.findByLocation = function(tenantId, city, state) {
  return this.find({
    tenantId,
    'address.city': new RegExp(city, 'i'),
    'address.state': new RegExp(state, 'i'),
    isActive: true
  });
};

export default mongoose.model('Property', propertySchema);
