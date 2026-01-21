import jwt from 'jsonwebtoken';
import User from '../modules/auth/user.model.js';
import Tenant from '../modules/tenants/tenant.model.js';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * Authentication middleware using JWT
 * Validates token and injects user info into req.user
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Access token is required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user with tenant information
    const user = await User.findById(decoded.userId)
      .populate('tenantId', 'name type isActive settings')
      .select('+passwordHash'); // Include password hash for security checks if needed

    if (!user || !user.isActive) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Check if tenant is active
    if (!user.tenantId || !user.tenantId.isActive) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Tenant account is inactive'
      });
    }

    // Check tenant subscription status
    if (!user.tenantId.isSubscriptionActive()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Tenant subscription has expired'
      });
    }

    // Update last login time
    user.lastLoginAt = new Date();
    await user.save();

    // Inject user info into request object
    req.user = {
      id: user._id,
      tenantId: user.tenantId._id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
      tenant: {
        id: user.tenantId._id,
        name: user.tenantId.name,
        type: user.tenantId.type,
        settings: user.tenantId.settings
      }
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid token format'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Token has expired'
      });
    }

    console.error('Authentication error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Optional authentication middleware
 * Similar to authenticate but doesn't require auth - useful for public endpoints
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    // If token exists, validate it
    await authenticate(req, res, next);
  } catch (error) {
    // For optional auth, continue without user if token is invalid
    req.user = null;
    next();
  }
};

/**
 * Role-based authorization middleware
 * Checks if user has required role
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 * Checks if user has required permission
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!req.user.permissions[permission]) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: `Access denied. Missing permission: ${permission}`
      });
    }

    next();
  };
};

/**
 * Generate JWT token for user
 */
export const generateToken = (userId, tenantId) => {
  const payload = {
    userId,
    tenantId,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
    issuer: 'mihotel-api'
  });
};

/**
 * Refresh token validation (optional - for refresh token implementation)
 */
export const validateRefreshToken = (refreshToken) => {
  try {
    return jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};
