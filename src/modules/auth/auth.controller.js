import User from './user.model.js';
import Tenant from '../tenants/tenant.model.js';
import { generateToken } from '../../middlewares/auth.js';
import { HTTP_STATUS, USER_ROLES } from '../../config/constants.js';

/**
 * Authentication Controller
 * Handles tenant registration, user authentication and authorization
 */

/**
 * Register new tenant with admin user
 * POST /api/auth/register
 */
export const registerTenant = async (req, res) => {
  try {
    const { tenant, admin } = req.body;

    // Check if tenant with same name exists
    const existingTenant = await Tenant.findOne({ 
      name: tenant.name,
      isActive: true 
    });

    if (existingTenant) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'A tenant with this name already exists'
      });
    }

    // Create tenant
    const newTenant = new Tenant({
      name: tenant.name,
      type: tenant.type,
      plan: tenant.plan || 'basic',
      settings: tenant.settings || {}
    });

    const savedTenant = await newTenant.save();

    // Check if user with same email exists in any tenant
    const existingUser = await User.findOne({ 
      email: admin.email,
      isActive: true 
    });

    if (existingUser) {
      // Rollback tenant creation
      await Tenant.findByIdAndDelete(savedTenant._id);
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    // Create admin user
    const adminUser = new User({
      tenantId: savedTenant._id,
      name: admin.name,
      email: admin.email,
      passwordHash: admin.password,
      role: USER_ROLES.ADMIN,
      profile: admin.profile || {},
      isEmailVerified: true // Auto-verify for tenant admin
    });

    const savedUser = await adminUser.save();

    // Generate JWT token
    const token = generateToken(savedUser._id, savedTenant._id);

    // Prepare response (exclude sensitive data)
    const userResponse = savedUser.toJSON();
    delete userResponse.passwordHash;

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Tenant and admin user created successfully',
      data: {
        tenant: {
          id: savedTenant._id,
          name: savedTenant.name,
          type: savedTenant.type,
          plan: savedTenant.plan,
          settings: savedTenant.settings
        },
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * User login
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email with password hash
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isActive: true 
    })
    .populate('tenantId', 'name type isActive settings')
    .select('+passwordHash');

    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if tenant is active
    if (!user.tenantId || !user.tenantId.isActive) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Tenant account is inactive'
      });
    }

    // Check tenant subscription
    if (!user.tenantId.isSubscriptionActive()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Tenant subscription has expired'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id, user.tenantId._id);

    // Prepare response
    const userResponse = user.toJSON();
    delete userResponse.passwordHash;

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        tenant: {
          id: user.tenantId._id,
          name: user.tenantId.name,
          type: user.tenantId.type,
          settings: user.tenantId.settings
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/profile
 */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('tenantId', 'name type settings')
      .select('-passwordHash');

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: user.toJSON(),
        tenant: {
          id: user.tenantId._id,
          name: user.tenantId.name,
          type: user.tenantId.type,
          settings: user.tenantId.settings
        }
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
};

/**
 * Update user profile
 * PUT /api/auth/profile
 */
export const updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    
    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updates.passwordHash;
    delete updates.tenantId;
    delete updates.role;
    delete updates.permissions;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: user.toJSON() }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

/**
 * Change user password
 * PUT /api/auth/change-password
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password hash
    const user = await User.findById(req.user.id).select('+passwordHash');
    
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.passwordHash = newPassword;
    await user.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

/**
 * Refresh JWT token
 * POST /api/auth/refresh
 */
export const refreshToken = async (req, res) => {
  try {
    // Current user is already validated by auth middleware
    const user = await User.findById(req.user.id)
      .populate('tenantId', '_id isActive');

    if (!user || !user.isActive || !user.tenantId.isActive) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid session'
      });
    }

    // Generate new token
    const newToken = generateToken(user._id, user.tenantId._id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Token refreshed successfully',
      data: { token: newToken }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to refresh token'
    });
  }
};

/**
 * Logout user (optional - mainly for client-side token cleanup)
 * POST /api/auth/logout
 */
export const logout = async (req, res) => {
  try {
    // In a JWT system, logout is mainly handled client-side
    // We could implement a token blacklist here if needed
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Logout failed'
    });
  }
};
