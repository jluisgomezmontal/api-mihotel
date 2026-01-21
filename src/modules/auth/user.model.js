import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { USER_ROLES } from '../../config/constants.js';
import { baseSchemaPlugin, softDeletePlugin } from '../../utils/baseModel.js';

/**
 * User Schema - Multi-tenant users with role-based access
 */
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'User name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: false, // Will be unique per tenant via compound index
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email address'
    ]
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include in queries by default
  },
  role: {
    type: String,
    enum: {
      values: Object.values(USER_ROLES),
      message: 'Invalid user role. Must be one of: {VALUES}'
    },
    default: USER_ROLES.STAFF
  },
  profile: {
    phone: {
      type: String,
      trim: true
    },
    avatar: {
      type: String, // URL to avatar image
      trim: true
    },
    timezone: {
      type: String,
      default: 'America/Mexico_City'
    }
  },
  permissions: {
    canManageProperties: {
      type: Boolean,
      default: false
    },
    canManageUsers: {
      type: Boolean,
      default: false
    },
    canManageReservations: {
      type: Boolean,
      default: true
    },
    canViewReports: {
      type: Boolean,
      default: false
    }
  },
  lastLoginAt: {
    type: Date
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.passwordHash;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Apply base schema plugins
userSchema.plugin(baseSchemaPlugin);
userSchema.plugin(softDeletePlugin);

// Compound indexes for multi-tenant uniqueness and performance
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, role: 1 });
userSchema.index({ tenantId: 1, isActive: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  
  try {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    this.passwordHash = await bcrypt.hash(this.passwordHash, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Set default permissions based on role
userSchema.pre('save', function(next) {
  if (this.isModified('role')) {
    switch (this.role) {
      case USER_ROLES.ADMIN:
        this.permissions = {
          canManageProperties: true,
          canManageUsers: true,
          canManageReservations: true,
          canViewReports: true
        };
        break;
      case USER_ROLES.STAFF:
        this.permissions = {
          canManageProperties: false,
          canManageUsers: false,
          canManageReservations: true,
          canViewReports: false
        };
        break;
      case USER_ROLES.CLEANING:
        this.permissions = {
          canManageProperties: false,
          canManageUsers: false,
          canManageReservations: false,
          canViewReports: false
        };
        break;
    }
  }
  next();
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.passwordHash) {
    throw new Error('User password hash is missing');
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Instance method to check permissions
userSchema.methods.hasPermission = function(permission) {
  return this.permissions[permission] === true;
};

// Instance method to check if user is admin
userSchema.methods.isAdmin = function() {
  return this.role === USER_ROLES.ADMIN;
};

// Static method to find by email within tenant
userSchema.statics.findByEmailInTenant = function(email, tenantId) {
  return this.findOne({ email: email.toLowerCase(), tenantId, isActive: true })
    .select('+passwordHash');
};

// Static method to find admins in tenant
userSchema.statics.findAdminsInTenant = function(tenantId) {
  return this.find({ 
    tenantId, 
    role: USER_ROLES.ADMIN, 
    isActive: true 
  });
};

export default mongoose.model('User', userSchema);
