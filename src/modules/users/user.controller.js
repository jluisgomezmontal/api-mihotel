import User from '../auth/user.model.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * User Controller
 * Handles user management operations with multi-tenant isolation
 */

/**
 * Get all users for current tenant
 * GET /api/users
 */
export const getAllUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      role, 
      isActive 
    } = req.query;
    
    const conditions = { tenantId: req.user.tenantId };
    
    if (role) conditions.role = role;
    if (isActive !== undefined) conditions.isActive = isActive;
    
    if (search) {
      conditions.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profile.phone': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(conditions)
        .select('-passwordHash')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      User.countDocuments(conditions)
    ]);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
};

/**
 * Get user by ID
 * GET /api/users/:userId
 */
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({
      _id: userId,
      tenantId: req.user.tenantId
    }).select('-passwordHash');

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
};

/**
 * Create new user
 * POST /api/users
 */
export const createUser = async (req, res) => {
  try {
    const userData = {
      ...req.body,
      tenantId: req.user.tenantId
    };

    const existingUser = await User.findByEmailInTenant(
      userData.email,
      req.user.tenantId
    );

    if (existingUser) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'User with this email already exists in your organization'
      });
    }

    const user = new User({
      ...userData,
      passwordHash: userData.password
    });

    const savedUser = await user.save();
    const userResponse = savedUser.toJSON();
    delete userResponse.passwordHash;

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'User created successfully',
      data: { user: userResponse }
    });

  } catch (error) {
    console.error('Create user error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create user'
    });
  }
};

/**
 * Update user
 * PUT /api/users/:userId
 */
export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    delete updates.tenantId;
    delete updates._id;
    delete updates.passwordHash;

    if (updates.email) {
      const existingUser = await User.findOne({
        email: updates.email,
        tenantId: req.user.tenantId,
        _id: { $ne: userId }
      });

      if (existingUser) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Email already in use by another user'
        });
      }
    }

    const user = await User.findOneAndUpdate(
      { _id: userId, tenantId: req.user.tenantId },
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
      message: 'User updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update user error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update user'
    });
  }
};

/**
 * Delete user (soft delete)
 * DELETE /api/users/:userId
 */
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user.id) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const user = await User.findOne({
      _id: userId,
      tenantId: req.user.tenantId
    });

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    const adminCount = await User.countDocuments({
      tenantId: req.user.tenantId,
      role: 'admin',
      isActive: true
    });

    if (user.role === 'admin' && adminCount <= 1) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'Cannot delete the last admin user'
      });
    }

    await user.softDelete();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
};

/**
 * Update user role
 * PUT /api/users/:userId/role
 */
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (userId === req.user.id) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'Cannot change your own role'
      });
    }

    const user = await User.findOne({
      _id: userId,
      tenantId: req.user.tenantId
    });

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({
        tenantId: req.user.tenantId,
        role: 'admin',
        isActive: true
      });

      if (adminCount <= 1) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Cannot change role of the last admin user'
        });
      }
    }

    user.role = role;
    await user.save();

    const userResponse = user.toJSON();
    delete userResponse.passwordHash;

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'User role updated successfully',
      data: { user: userResponse }
    });

  } catch (error) {
    console.error('Update user role error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update user role'
    });
  }
};

/**
 * Update user permissions
 * PUT /api/users/:userId/permissions
 */
export const updateUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;

    const user = await User.findOneAndUpdate(
      { _id: userId, tenantId: req.user.tenantId },
      { $set: { permissions } },
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
      message: 'User permissions updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update user permissions'
    });
  }
};

/**
 * Activate/Deactivate user
 * PUT /api/users/:userId/status
 */
export const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (userId === req.user.id) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'Cannot change your own status'
      });
    }

    const user = await User.findOne({
      _id: userId,
      tenantId: req.user.tenantId
    });

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin' && !isActive) {
      const activeAdminCount = await User.countDocuments({
        tenantId: req.user.tenantId,
        role: 'admin',
        isActive: true
      });

      if (activeAdminCount <= 1) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Cannot deactivate the last active admin user'
        });
      }
    }

    user.isActive = isActive;
    await user.save();

    const userResponse = user.toJSON();
    delete userResponse.passwordHash;

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user: userResponse }
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update user status'
    });
  }
};

/**
 * Reset user password (admin only)
 * PUT /api/users/:userId/reset-password
 */
export const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    const user = await User.findOne({
      _id: userId,
      tenantId: req.user.tenantId
    }).select('+passwordHash');

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    user.passwordHash = newPassword;
    await user.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
};

/**
 * Get user statistics
 * GET /api/users/stats
 */
export const getUserStats = async (req, res) => {
  try {
    const [totalUsers, activeUsers, roleStats] = await Promise.all([
      User.countDocuments({ tenantId: req.user.tenantId }),
      User.countDocuments({ tenantId: req.user.tenantId, isActive: true }),
      User.aggregate([
        { $match: { tenantId: req.user.tenantId } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ])
    ]);

    const roleDistribution = roleStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        roleDistribution
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch user statistics'
    });
  }
};
