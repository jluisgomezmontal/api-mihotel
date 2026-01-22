import express from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { 
  createPayment,
  getPayments,
  getPaymentById,
  getPaymentsByReservation,
  updatePayment,
  processRefund,
  deletePayment,
  getPaymentSummary,
  getPendingPayments
} from './payment.controller.js';

const router = express.Router();

/**
 * Payment Routes
 * All routes require authentication and tenant isolation
 */

// Apply authentication middleware to all routes
router.use(authenticate);

// Payment CRUD operations
router.post('/', createPayment);
router.get('/', getPayments);
router.get('/pending', getPendingPayments);
router.get('/summary', getPaymentSummary);
router.get('/reservation/:reservationId', getPaymentsByReservation);
router.get('/:paymentId', getPaymentById);
router.put('/:paymentId', updatePayment);
router.delete('/:paymentId', deletePayment);

// Refund operations
router.post('/:paymentId/refund', processRefund);

export default router;
