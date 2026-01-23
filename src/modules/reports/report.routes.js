import express from 'express';
import {
  getRevenueReport,
  getOccupancyReport,
  getGuestReport,
  getReservationReport,
  getDashboardSummary
} from './report.controller.js';
import { authenticate } from '../../middlewares/auth.js';
import { tenantGuard } from '../../middlewares/tenantGuard.js';

const router = express.Router();

// All routes require authentication and tenant isolation
router.use(authenticate);
router.use(tenantGuard);

/**
 * @route   GET /api/reports/revenue
 * @desc    Get revenue report with time series data
 * @access  Private
 * @query   startDate, endDate, propertyId, period (daily|weekly|monthly)
 */
router.get('/revenue', getRevenueReport);

/**
 * @route   GET /api/reports/occupancy
 * @desc    Get occupancy report with daily breakdown
 * @access  Private
 * @query   startDate, endDate, propertyId
 */
router.get('/occupancy', getOccupancyReport);

/**
 * @route   GET /api/reports/guests
 * @desc    Get guest statistics and demographics
 * @access  Private
 * @query   startDate, endDate
 */
router.get('/guests', getGuestReport);

/**
 * @route   GET /api/reports/reservations
 * @desc    Get reservation statistics and breakdown
 * @access  Private
 * @query   startDate, endDate, propertyId
 */
router.get('/reservations', getReservationReport);

/**
 * @route   GET /api/reports/dashboard
 * @desc    Get dashboard summary with key metrics
 * @access  Private
 */
router.get('/dashboard', getDashboardSummary);

export default router;
