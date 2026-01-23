import Reservation from '../reservations/reservation.model.js';
import Payment from '../payments/payment.model.js';
import Room from '../rooms/room.model.js';
import Guest from '../guests/guest.model.js';
import Property from '../properties/property.model.js';
import { HTTP_STATUS, RESERVATION_STATUS, PAYMENT_STATUS } from '../../config/constants.js';

/**
 * Report Controller
 * Provides analytics and reporting endpoints
 */

/**
 * Get revenue report
 * GET /api/reports/revenue
 */
export const getRevenueReport = async (req, res) => {
  try {
    const { startDate, endDate, propertyId, period = 'daily' } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    
    // Build match conditions
    const matchConditions = {
      tenantId: req.user.tenantId,
      status: PAYMENT_STATUS.PAID,
      isActive: true,
      paymentDate: { $gte: start, $lte: end }
    };
    
    if (propertyId) {
      // Get reservations for this property
      const reservations = await Reservation.find({ 
        propertyId, 
        tenantId: req.user.tenantId 
      }).select('_id');
      
      matchConditions.reservationId = { $in: reservations.map(r => r._id) };
    }
    
    // Determine grouping based on period
    let groupBy;
    switch (period) {
      case 'daily':
        groupBy = {
          year: { $year: '$paymentDate' },
          month: { $month: '$paymentDate' },
          day: { $dayOfMonth: '$paymentDate' }
        };
        break;
      case 'weekly':
        groupBy = {
          year: { $year: '$paymentDate' },
          week: { $week: '$paymentDate' }
        };
        break;
      case 'monthly':
        groupBy = {
          year: { $year: '$paymentDate' },
          month: { $month: '$paymentDate' }
        };
        break;
      default:
        groupBy = {
          year: { $year: '$paymentDate' },
          month: { $month: '$paymentDate' },
          day: { $dayOfMonth: '$paymentDate' }
        };
    }
    
    const revenueData = await Payment.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: groupBy,
          totalRevenue: { $sum: '$amount' },
          totalPayments: { $sum: 1 },
          avgPayment: { $avg: '$amount' },
          methods: {
            $push: {
              method: '$method',
              amount: '$amount'
            }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    // Calculate totals
    const totals = await Payment.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalPayments: { $sum: 1 },
          avgPayment: { $avg: '$amount' }
        }
      }
    ]);
    
    // Group by payment method
    const methodBreakdown = await Payment.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: '$method',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        period,
        startDate: start,
        endDate: end,
        revenueData,
        totals: totals[0] || { totalRevenue: 0, totalPayments: 0, avgPayment: 0 },
        methodBreakdown
      }
    });
    
  } catch (error) {
    console.error('Revenue report error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to generate revenue report'
    });
  }
};

/**
 * Get occupancy report
 * GET /api/reports/occupancy
 */
export const getOccupancyReport = async (req, res) => {
  try {
    const { startDate, endDate, propertyId } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    
    const matchConditions = {
      tenantId: req.user.tenantId,
      isActive: true
    };
    
    if (propertyId) {
      matchConditions.propertyId = propertyId;
    }
    
    // Get all rooms
    const totalRooms = await Room.countDocuments(matchConditions);
    
    // Get reservations in date range
    const reservations = await Reservation.find({
      tenantId: req.user.tenantId,
      isActive: true,
      $or: [
        {
          'dates.checkInDate': { $gte: start, $lte: end }
        },
        {
          'dates.checkOutDate': { $gte: start, $lte: end }
        },
        {
          $and: [
            { 'dates.checkInDate': { $lte: start } },
            { 'dates.checkOutDate': { $gte: end } }
          ]
        }
      ],
      ...(propertyId && { propertyId })
    }).populate('roomId', 'nameOrNumber');
    
    // Calculate occupancy by day
    const occupancyByDay = [];
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      const occupiedRooms = reservations.filter(r => {
        const checkIn = new Date(r.dates.checkInDate);
        const checkOut = new Date(r.dates.checkOutDate);
        return checkIn <= dayEnd && checkOut >= dayStart;
      }).length;
      
      const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
      
      occupancyByDay.push({
        date: new Date(currentDate),
        occupiedRooms,
        totalRooms,
        occupancyRate: parseFloat(occupancyRate.toFixed(2))
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Calculate average occupancy
    const avgOccupancy = occupancyByDay.reduce((sum, day) => sum + day.occupancyRate, 0) / occupancyByDay.length;
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        startDate: start,
        endDate: end,
        totalRooms,
        occupancyByDay,
        avgOccupancy: parseFloat(avgOccupancy.toFixed(2))
      }
    });
    
  } catch (error) {
    console.error('Occupancy report error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to generate occupancy report'
    });
  }
};

/**
 * Get guest statistics report
 * GET /api/reports/guests
 */
export const getGuestReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    
    // Total guests
    const totalGuests = await Guest.countDocuments({
      tenantId: req.user.tenantId,
      isActive: true
    });
    
    // New guests in period
    const newGuests = await Guest.countDocuments({
      tenantId: req.user.tenantId,
      isActive: true,
      createdAt: { $gte: start, $lte: end }
    });
    
    // VIP guests
    const vipGuests = await Guest.countDocuments({
      tenantId: req.user.tenantId,
      isActive: true,
      vipStatus: true
    });
    
    // Top guests by spending
    const topGuests = await Guest.find({
      tenantId: req.user.tenantId,
      isActive: true
    })
      .sort({ totalSpent: -1 })
      .limit(10)
      .select('firstName lastName email totalStays totalSpent vipStatus');
    
    // Nationality distribution
    const nationalityStats = await Guest.aggregate([
      { $match: { tenantId: req.user.tenantId, isActive: true } },
      { $group: { _id: '$nationality', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Guest activity (reservations by guest)
    const guestActivity = await Reservation.aggregate([
      {
        $match: {
          tenantId: req.user.tenantId,
          isActive: true,
          'dates.checkInDate': { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$guestId',
          reservations: { $sum: 1 },
          totalSpent: { $sum: '$pricing.totalPrice' }
        }
      },
      { $sort: { reservations: -1 } },
      { $limit: 10 }
    ]);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        startDate: start,
        endDate: end,
        totalGuests,
        newGuests,
        vipGuests,
        topGuests,
        nationalityStats,
        guestActivity
      }
    });
    
  } catch (error) {
    console.error('Guest report error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to generate guest report'
    });
  }
};

/**
 * Get reservation statistics
 * GET /api/reports/reservations
 */
export const getReservationReport = async (req, res) => {
  try {
    const { startDate, endDate, propertyId } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    
    const matchConditions = {
      tenantId: req.user.tenantId,
      isActive: true,
      'dates.checkInDate': { $gte: start, $lte: end }
    };
    
    if (propertyId) {
      matchConditions.propertyId = propertyId;
    }
    
    // Status breakdown
    const statusBreakdown = await Reservation.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.totalPrice' }
        }
      }
    ]);
    
    // Source breakdown
    const sourceBreakdown = await Reservation.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Average stay duration
    const avgStayData = await Reservation.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: null,
          avgNights: { $avg: '$pricing.nights' },
          totalReservations: { $sum: 1 }
        }
      }
    ]);
    
    // Reservations by property
    const byProperty = await Reservation.aggregate([
      { $match: { ...matchConditions, propertyId: { $exists: true } } },
      {
        $lookup: {
          from: 'properties',
          localField: 'propertyId',
          foreignField: '_id',
          as: 'property'
        }
      },
      { $unwind: '$property' },
      {
        $group: {
          _id: '$propertyId',
          propertyName: { $first: '$property.name' },
          count: { $sum: 1 },
          revenue: { $sum: '$pricing.totalPrice' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        startDate: start,
        endDate: end,
        statusBreakdown,
        sourceBreakdown,
        avgStay: avgStayData[0] || { avgNights: 0, totalReservations: 0 },
        byProperty
      }
    });
    
  } catch (error) {
    console.error('Reservation report error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to generate reservation report'
    });
  }
};

/**
 * Get dashboard summary
 * GET /api/reports/dashboard
 */
export const getDashboardSummary = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
    
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Today's check-ins/check-outs
    const todayCheckIns = await Reservation.countDocuments({
      tenantId: req.user.tenantId,
      isActive: true,
      'dates.checkInDate': { $gte: today, $lte: endOfToday }
    });
    
    const todayCheckOuts = await Reservation.countDocuments({
      tenantId: req.user.tenantId,
      isActive: true,
      'dates.checkOutDate': { $gte: today, $lte: endOfToday }
    });
    
    // Current occupancy
    const totalRooms = await Room.countDocuments({
      tenantId: req.user.tenantId,
      isActive: true
    });
    
    const occupiedRooms = await Room.countDocuments({
      tenantId: req.user.tenantId,
      isActive: true,
      status: 'occupied'
    });
    
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
    
    // Monthly revenue
    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          tenantId: req.user.tenantId,
          status: PAYMENT_STATUS.PAID,
          isActive: true,
          paymentDate: { $gte: firstDayOfMonth, $lte: endOfToday }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    // Pending reservations
    const pendingReservations = await Reservation.countDocuments({
      tenantId: req.user.tenantId,
      isActive: true,
      status: RESERVATION_STATUS.PENDING
    });
    
    // Active guests (checked in)
    const activeGuests = await Reservation.countDocuments({
      tenantId: req.user.tenantId,
      isActive: true,
      status: RESERVATION_STATUS.CHECKED_IN
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        todayCheckIns,
        todayCheckOuts,
        totalRooms,
        occupiedRooms,
        availableRooms: totalRooms - occupiedRooms,
        occupancyRate: parseFloat(occupancyRate.toFixed(2)),
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        pendingReservations,
        activeGuests
      }
    });
    
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to generate dashboard summary'
    });
  }
};
