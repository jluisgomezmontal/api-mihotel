import mongoose from 'mongoose';
import { baseSchemaPlugin, softDeletePlugin } from '../../utils/baseModel.js';

/**
 * Guest Schema - Represents hotel/property guests
 */
const guestSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
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
  phone: {
    primary: {
      type: String,
      required: [true, 'Primary phone number is required'],
      trim: true
    },
    secondary: {
      type: String,
      trim: true
    }
  },
  identification: {
    type: {
      type: String,
      enum: ['passport', 'national_id', 'driver_license', 'other'],
      required: [true, 'Identification type is required']
    },
    number: {
      type: String,
      required: [true, 'Identification number is required'],
      trim: true
    },
    expiryDate: {
      type: Date
    },
    issuingCountry: {
      type: String,
      trim: true
    }
  },
  address: {
    street: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    postalCode: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true,
      default: 'Mexico'
    }
  },
  dateOfBirth: {
    type: Date
  },
  nationality: {
    type: String,
    trim: true
  },
  emergencyContact: {
    name: {
      type: String,
      trim: true
    },
    relationship: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    }
  },
  preferences: {
    roomType: {
      type: String,
      enum: ['room', 'suite', 'apartment']
    },
    smokingRoom: {
      type: Boolean,
      default: false
    },
    floor: {
      type: String,
      enum: ['ground', 'high', 'any'],
      default: 'any'
    },
    bedType: {
      type: String,
      enum: ['single', 'double', 'queen', 'king', 'twin'],
      default: 'double'
    },
    dietaryRestrictions: [{
      type: String,
      trim: true
    }],
    accessibility: [{
      type: String,
      trim: true
    }]
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  vipStatus: {
    type: Boolean,
    default: false
  },
  blacklisted: {
    type: Boolean,
    default: false
  },
  blacklistReason: {
    type: String,
    trim: true
  },
  totalStays: {
    type: Number,
    default: 0,
    min: [0, 'Total stays cannot be negative']
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: [0, 'Total spent cannot be negative']
  },
  loyaltyPoints: {
    type: Number,
    default: 0,
    min: [0, 'Loyalty points cannot be negative']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Apply base schema plugins
guestSchema.plugin(baseSchemaPlugin);
guestSchema.plugin(softDeletePlugin);

// Indexes for performance and multi-tenant queries
guestSchema.index({ tenantId: 1, email: 1 });
guestSchema.index({ tenantId: 1, 'phone.primary': 1 });
guestSchema.index({ tenantId: 1, 'identification.number': 1 });
guestSchema.index({ tenantId: 1, firstName: 1, lastName: 1 });
guestSchema.index({ tenantId: 1, vipStatus: 1 });
guestSchema.index({ tenantId: 1, blacklisted: 1 });

// Virtual for full name
guestSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age (if date of birth is provided)
guestSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Virtual for reservations count
guestSchema.virtual('reservationsCount', {
  ref: 'Reservation',
  localField: '_id',
  foreignField: 'guestId',
  count: true,
  match: { isActive: true }
});

// Virtual for recent reservations
guestSchema.virtual('recentReservations', {
  ref: 'Reservation',
  localField: '_id',
  foreignField: 'guestId',
  options: { 
    sort: { checkInDate: -1 }, 
    limit: 5 
  },
  match: { isActive: true }
});

// Pre-save middleware to update guest stats
guestSchema.pre('save', function(next) {
  // Ensure full name is properly formatted
  if (this.firstName) {
    this.firstName = this.firstName.charAt(0).toUpperCase() + this.firstName.slice(1).toLowerCase();
  }
  if (this.lastName) {
    this.lastName = this.lastName.charAt(0).toUpperCase() + this.lastName.slice(1).toLowerCase();
  }
  
  next();
});

// Instance method to check if guest is eligible for stay
guestSchema.methods.isEligibleForStay = function() {
  return !this.blacklisted && this.isActive;
};

// Instance method to add loyalty points
guestSchema.methods.addLoyaltyPoints = function(points) {
  this.loyaltyPoints += points;
  return this.save();
};

// Instance method to update stay statistics
guestSchema.methods.updateStayStats = function(amount) {
  this.totalStays += 1;
  this.totalSpent += amount;
  
  // Auto-promote to VIP if criteria met
  if (this.totalStays >= 10 || this.totalSpent >= 10000) {
    this.vipStatus = true;
  }
  
  return this.save();
};

// Instance method to get full address as string
guestSchema.methods.getFullAddress = function() {
  if (!this.address.street) return null;
  const { street, city, state, postalCode, country } = this.address;
  return [street, city, state, postalCode, country].filter(Boolean).join(', ');
};

// Static method to find guest by identification
guestSchema.statics.findByIdentification = function(tenantId, idType, idNumber) {
  return this.findOne({
    tenantId,
    'identification.type': idType,
    'identification.number': idNumber,
    isActive: true
  });
};

// Static method to find VIP guests
guestSchema.statics.findVIPGuests = function(tenantId) {
  return this.find({
    tenantId,
    vipStatus: true,
    blacklisted: false,
    isActive: true
  }).sort({ totalSpent: -1 });
};

// Static method to search guests
guestSchema.statics.searchGuests = function(tenantId, searchTerm) {
  const regex = new RegExp(searchTerm, 'i');
  return this.find({
    tenantId,
    isActive: true,
    $or: [
      { firstName: regex },
      { lastName: regex },
      { email: regex },
      { 'phone.primary': regex },
      { 'identification.number': regex }
    ]
  }).limit(50);
};

export default mongoose.model('Guest', guestSchema);
