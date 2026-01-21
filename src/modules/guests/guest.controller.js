import Guest from './guest.model.js';
import Reservation from '../reservations/reservation.model.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * Guest Controller
 * Handles CRUD operations for guests with multi-tenant isolation
 */

/**
 * Get all guests for current tenant
 * GET /api/guests
 */
export const getAllGuests = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      vipStatus, 
      blacklisted, 
      isActive 
    } = req.query;
    
    // Build query conditions
    const conditions = { tenantId: req.user.tenantId };
    
    if (vipStatus !== undefined) conditions.vipStatus = vipStatus;
    if (blacklisted !== undefined) conditions.blacklisted = blacklisted;
    if (isActive !== undefined) conditions.isActive = isActive;
    
    if (search) {
      conditions.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'phone.primary': { $regex: search, $options: 'i' } },
        { 'identification.number': { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const [guests, total] = await Promise.all([
      Guest.find(conditions)
        .populate('reservationsCount')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Guest.countDocuments(conditions)
    ]);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        guests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get guests error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch guests'
    });
  }
};

/**
 * Get guest by ID
 * GET /api/guests/:guestId
 */
export const getGuestById = async (req, res) => {
  try {
    const { guestId } = req.params;

    const guest = await Guest.findOne({
      _id: guestId,
      tenantId: req.user.tenantId
    })
    .populate('reservationsCount')
    .populate('recentReservations');

    if (!guest) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Guest not found'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { guest }
    });

  } catch (error) {
    console.error('Get guest error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch guest'
    });
  }
};

/**
 * Create new guest
 * POST /api/guests
 */
export const createGuest = async (req, res) => {
  try {
    const guestData = {
      ...req.body,
      tenantId: req.user.tenantId
    };

    // Check if guest already exists with same identification within tenant
    if (guestData.identification) {
      const existingGuest = await Guest.findByIdentification(
        req.user.tenantId,
        guestData.identification.type,
        guestData.identification.number
      );

      if (existingGuest) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Guest with this identification already exists'
        });
      }
    }

    const guest = new Guest(guestData);
    const savedGuest = await guest.save();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Guest created successfully',
      data: { guest: savedGuest }
    });

  } catch (error) {
    console.error('Create guest error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create guest'
    });
  }
};

/**
 * Update guest
 * PUT /api/guests/:guestId
 */
export const updateGuest = async (req, res) => {
  try {
    const { guestId } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated
    delete updates.tenantId;
    delete updates._id;
    delete updates.totalStays;
    delete updates.totalSpent;
    delete updates.loyaltyPoints;

    const guest = await Guest.findOneAndUpdate(
      { _id: guestId, tenantId: req.user.tenantId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!guest) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Guest not found'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Guest updated successfully',
      data: { guest }
    });

  } catch (error) {
    console.error('Update guest error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update guest'
    });
  }
};

/**
 * Delete guest (soft delete)
 * DELETE /api/guests/:guestId
 */
export const deleteGuest = async (req, res) => {
  try {
    const { guestId } = req.params;

    // Check if guest has active reservations
    const activeReservations = await Reservation.countDocuments({
      guestId,
      tenantId: req.user.tenantId,
      status: { $in: ['confirmed', 'checked_in'] },
      isActive: true
    });

    if (activeReservations > 0) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'Cannot delete guest with active reservations'
      });
    }

    const guest = await Guest.findOne({
      _id: guestId,
      tenantId: req.user.tenantId
    });

    if (!guest) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Guest not found'
      });
    }

    await guest.softDelete();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Guest deleted successfully'
    });

  } catch (error) {
    console.error('Delete guest error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to delete guest'
    });
  }
};

/**
 * Search guests
 * GET /api/guests/search
 */
export const searchGuests = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const guests = await Guest.searchGuests(req.user.tenantId, query.trim());

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        guests,
        total: guests.length,
        query: query.trim()
      }
    });

  } catch (error) {
    console.error('Search guests error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to search guests'
    });
  }
};

/**
 * Get VIP guests
 * GET /api/guests/vip
 */
export const getVIPGuests = async (req, res) => {
  try {
    const vipGuests = await Guest.findVIPGuests(req.user.tenantId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        guests: vipGuests,
        total: vipGuests.length
      }
    });

  } catch (error) {
    console.error('Get VIP guests error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch VIP guests'
    });
  }
};

/**
 * Update guest VIP status
 * PUT /api/guests/:guestId/vip
 */
export const updateVIPStatus = async (req, res) => {
  try {
    const { guestId } = req.params;
    const { vipStatus } = req.body;

    const guest = await Guest.findOneAndUpdate(
      { _id: guestId, tenantId: req.user.tenantId },
      { vipStatus },
      { new: true }
    );

    if (!guest) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Guest not found'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Guest ${vipStatus ? 'promoted to' : 'removed from'} VIP status`,
      data: { guest }
    });

  } catch (error) {
    console.error('Update VIP status error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update VIP status'
    });
  }
};

/**
 * Update guest blacklist status
 * PUT /api/guests/:guestId/blacklist
 */
export const updateBlacklistStatus = async (req, res) => {
  try {
    const { guestId } = req.params;
    const { blacklisted, reason } = req.body;

    const updateData = { blacklisted };
    if (blacklisted && reason) {
      updateData.blacklistReason = reason;
    } else if (!blacklisted) {
      updateData.blacklistReason = null;
    }

    const guest = await Guest.findOneAndUpdate(
      { _id: guestId, tenantId: req.user.tenantId },
      updateData,
      { new: true }
    );

    if (!guest) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Guest not found'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Guest ${blacklisted ? 'added to' : 'removed from'} blacklist`,
      data: { guest }
    });

  } catch (error) {
    console.error('Update blacklist status error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update blacklist status'
    });
  }
};

/**
 * Get guest reservations history
 * GET /api/guests/:guestId/reservations
 */
export const getGuestReservations = async (req, res) => {
  try {
    const { guestId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Verify guest belongs to tenant
    const guest = await Guest.findOne({
      _id: guestId,
      tenantId: req.user.tenantId
    });

    if (!guest) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Guest not found'
      });
    }

    const skip = (page - 1) * limit;
    const [reservations, total] = await Promise.all([
      Reservation.find({
        guestId,
        tenantId: req.user.tenantId,
        isActive: true
      })
      .populate('propertyId', 'name address.city')
      .populate('roomId', 'nameOrNumber type')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ 'dates.checkInDate': -1 }),
      Reservation.countDocuments({
        guestId,
        tenantId: req.user.tenantId,
        isActive: true
      })
    ]);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        guest: {
          id: guest._id,
          name: guest.fullName,
          totalStays: guest.totalStays,
          totalSpent: guest.totalSpent
        },
        reservations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get guest reservations error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch guest reservations'
    });
  }
};
