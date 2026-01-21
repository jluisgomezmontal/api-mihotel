import { z } from 'zod';
import { PAYMENT_METHODS, PAYMENT_STATUS } from '../config/constants.js';

/**
 * Zod validation schemas for Payment model
 */

export const createPaymentSchema = z.object({
  reservationId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid reservation ID format'),
  
  amount: z.number()
    .positive('Payment amount must be greater than 0'),
  
  currency: z.string()
    .length(3, 'Currency must be 3 characters')
    .optional(),
  
  method: z.enum(Object.values(PAYMENT_METHODS), {
    errorMap: () => ({ message: `Method must be one of: ${Object.values(PAYMENT_METHODS).join(', ')}` })
  }),
  
  details: z.object({
    // For card payments
    cardLast4: z.string()
      .length(4, 'Card last 4 digits must be exactly 4 characters')
      .regex(/^\d{4}$/, 'Card last 4 must contain only digits')
      .optional(),
    cardBrand: z.enum(['visa', 'mastercard', 'amex', 'discover', 'other']).optional(),
    
    // For transfer payments
    transferReference: z.string().trim().optional(),
    bankName: z.string().trim().optional(),
    
    // For cash payments  
    receivedBy: z.string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format')
      .optional(),
    
    // External payment gateway info
    gatewayTransactionId: z.string().trim().optional()
  }).optional(),
  
  fees: z.object({
    processingFee: z.number()
      .min(0, 'Processing fee cannot be negative')
      .optional(),
    gatewayFee: z.number()
      .min(0, 'Gateway fee cannot be negative')
      .optional()
  }).optional(),
  
  paymentDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  
  notes: z.string()
    .max(500, 'Notes cannot exceed 500 characters')
    .trim()
    .optional()
});

export const updatePaymentSchema = z.object({
  status: z.enum(Object.values(PAYMENT_STATUS), {
    errorMap: () => ({ message: `Status must be one of: ${Object.values(PAYMENT_STATUS).join(', ')}` })
  }).optional(),
  
  details: z.object({
    cardLast4: z.string().length(4).regex(/^\d{4}$/).optional(),
    cardBrand: z.enum(['visa', 'mastercard', 'amex', 'discover', 'other']).optional(),
    transferReference: z.string().trim().optional(),
    bankName: z.string().trim().optional(),
    gatewayTransactionId: z.string().trim().optional()
  }).optional(),
  
  paymentDate: z.coerce.date().optional(),
  notes: z.string().max(500).trim().optional()
});

export const processRefundSchema = z.object({
  amount: z.number()
    .positive('Refund amount must be greater than 0'),
  
  reason: z.string()
    .min(1, 'Refund reason is required')
    .max(500, 'Reason cannot exceed 500 characters')
    .trim()
});

export const paymentParamsSchema = z.object({
  paymentId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid payment ID format')
});

export const paymentQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  reservationId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  method: z.enum(Object.values(PAYMENT_METHODS)).optional(),
  status: z.enum(Object.values(PAYMENT_STATUS)).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional()
});

export const paymentSummaryQuerySchema = z.object({
  startDate: z.coerce.date({
    errorMap: () => ({ message: 'Invalid start date' })
  }),
  endDate: z.coerce.date({
    errorMap: () => ({ message: 'Invalid end date' })
  }),
  groupBy: z.enum(['day', 'week', 'month']).optional().default('day')
}).refine(data => data.endDate >= data.startDate, {
  message: "End date must be after or equal to start date",
  path: ["endDate"]
});

// Response schema
export const paymentResponseSchema = z.object({
  _id: z.string(),
  tenantId: z.string(),
  reservationId: z.string(),
  transactionId: z.string(),
  amount: z.number(),
  currency: z.string(),
  method: z.enum(Object.values(PAYMENT_METHODS)),
  status: z.enum(Object.values(PAYMENT_STATUS)),
  details: z.object({
    cardLast4: z.string().optional(),
    cardBrand: z.string().optional(),
    transferReference: z.string().optional(),
    bankName: z.string().optional(),
    receivedBy: z.string().optional(),
    gatewayTransactionId: z.string().optional()
  }).optional(),
  fees: z.object({
    processingFee: z.number(),
    gatewayFee: z.number()
  }),
  netAmount: z.number(),
  paymentDate: z.date(),
  dueDate: z.date().optional(),
  notes: z.string().optional(),
  refund: z.object({
    isRefunded: z.boolean(),
    refundedAmount: z.number(),
    refundedAt: z.date().optional(),
    refundReason: z.string().optional()
  }),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});
