import Tenant from './tenant.model.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * Get current tenant details
 * GET /api/tenants/current
 */
export const getCurrentTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);

    if (!tenant) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { tenant }
    });

  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to retrieve tenant information'
    });
  }
};

/**
 * Update tenant settings
 * PUT /api/tenants/settings
 */
export const updateTenantSettings = async (req, res) => {
  try {
    const { settings } = req.body;

    // Only admins can update tenant settings
    if (req.user.role !== 'admin') {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Only administrators can update tenant settings'
      });
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.user.tenantId,
      { $set: { settings } },
      { new: true, runValidators: true }
    );

    if (!tenant) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Tenant settings updated successfully',
      data: { tenant }
    });

  } catch (error) {
    console.error('Update tenant settings error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update tenant settings'
    });
  }
};

/**
 * Update tenant information (name, type)
 * PUT /api/tenants/info
 */
export const updateTenantInfo = async (req, res) => {
  try {
    const { name, type } = req.body;

    // Only admins can update tenant info
    if (req.user.role !== 'admin') {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Only administrators can update tenant information'
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (type) updateData.type = type;

    const tenant = await Tenant.findByIdAndUpdate(
      req.user.tenantId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!tenant) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Tenant information updated successfully',
      data: { tenant }
    });

  } catch (error) {
    console.error('Update tenant info error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update tenant information'
    });
  }
};

/**
 * Get tenant statistics
 * GET /api/tenants/stats
 */
export const getTenantStats = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId)
      .populate('propertiesCount')
      .populate('usersCount');

    if (!tenant) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const stats = {
      name: tenant.name,
      type: tenant.type,
      plan: tenant.plan,
      propertiesCount: tenant.propertiesCount || 0,
      usersCount: tenant.usersCount || 0,
      isTrialActive: tenant.subscription.isTrialActive,
      subscriptionStartDate: tenant.subscription.startDate,
      subscriptionEndDate: tenant.subscription.endDate,
      createdAt: tenant.createdAt
    };

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    console.error('Get tenant stats error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to retrieve tenant statistics'
    });
  }
};
