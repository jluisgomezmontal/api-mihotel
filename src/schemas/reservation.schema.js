import { z } from 'zod';
import { RESERVATION_STATUS, PAYMENT_STATUS } from '../config/constants.js';

/**
 * Zod validation schemas for Reservation model
 */

export const createReservationSchema = z.object({
  propertyId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid property ID format'),
  
  roomId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid room ID format'),
  
  guestId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid guest ID format'),
  
  dates: z.object({
    checkInDate: z.coerce.date({
      errorMap: () => ({ message: 'Invalid check-in date' })
    }),
    checkOutDate: z.coerce.date({
      errorMap: () => ({ message: 'Invalid check-out date' })
    })
  }).refine(data => data.checkOutDate > data.checkInDate, {
    message: "Check-out date must be after check-in date",
    path: ["dates.checkOutDate"]
  }),
  
  guests: z.object({
    adults: z.number()
      .int('Adult count must be an integer')
      .min(1, 'At least 1 adult is required')
      .max(20, 'Cannot exceed 20 adults'),
    children: z.number()
      .int('Children count must be an integer')
      .min(0, 'Children count cannot be negative')
      .max(10, 'Cannot exceed 10 children')
      .optional()
      .default(0),
    additionalGuests: z.array(z.object({
      firstName: z.string().min(1, 'First name is required').trim(),
      lastName: z.string().min(1, 'Last name is required').trim(),
      age: z.number().int().min(0).max(120).optional(),
      identification: z.string().trim().optional()
    })).optional()
  }),
  
  pricing: z.object({
    roomRate: z.number()
      .positive('Room rate must be positive'),
    nights: z.number()
      .int('Nights must be an integer')
      .min(1, 'At least 1 night is required'),
    subtotal: z.number()
      .min(0, 'Subtotal cannot be negative'),
    taxes: z.number()
      .min(0, 'Taxes cannot be negative')
      .optional()
      .default(0),
    fees: z.object({
      cleaning: z.number().min(0, 'Cleaning fee cannot be negative').optional().default(0),
      service: z.number().min(0, 'Service fee cannot be negative').optional().default(0),
      extra: z.number().min(0, 'Extra fees cannot be negative').optional().default(0)
    }).optional(),
    totalPrice: z.number()
      .min(0, 'Total price cannot be negative'),
    currency: z.string().length(3, 'Currency must be 3 characters').optional().default('USD')
  }),
  
  source: z.enum(['direct', 'booking_com', 'airbnb', 'expedia', 'phone', 'walk_in', 'other']).optional(),
  
  status: z.enum(Object.values(RESERVATION_STATUS), {
    errorMap: () => ({ message: `Status must be one of: ${Object.values(RESERVATION_STATUS).join(', ')}` })
  }).optional(),
  
  specialRequests: z.string()
    .max(1000, 'Special requests cannot exceed 1000 characters')
    .trim()
    .optional(),
  
  notes: z.string()
    .max(2000, 'Notes cannot exceed 2000 characters')
    .trim()
    .optional()
});

export const updateReservationSchema = z.object({
  dates: z.object({
    checkInDate: z.coerce.date().optional(),
    checkOutDate: z.coerce.date().optional()
  }).optional(),
  
  guests: z.object({
    adults: z.number().int().min(1).max(20).optional(),
    children: z.number().int().min(0).max(10).optional(),
    additionalGuests: z.array(z.object({
      firstName: z.string().min(1).trim(),
      lastName: z.string().min(1).trim(),
      age: z.number().int().min(0).max(120).optional(),
      identification: z.string().trim().optional()
    })).optional()
  }).optional(),
  
  status: z.enum(Object.values(RESERVATION_STATUS), {
    errorMap: () => ({ message: `Status must be one of: ${Object.values(RESERVATION_STATUS).join(', ')}` })
  }).optional(),
  
  specialRequests: z.string().max(1000).trim().optional(),
  notes: z.string().max(2000).trim().optional()
});

export const reservationParamsSchema = z.object({
  reservationId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid reservation ID format')
});

export const reservationQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  propertyId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  roomId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  guestId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  status: z.enum(Object.values(RESERVATION_STATUS)).optional(),
  paymentStatus: z.enum(Object.values(PAYMENT_STATUS)).optional(),
  checkInFrom: z.coerce.date().optional(),
  checkInTo: z.coerce.date().optional(),
  checkOutFrom: z.coerce.date().optional(),
  checkOutTo: z.coerce.date().optional(),
  confirmationNumber: z.string().trim().optional(),
  source: z.enum(['direct', 'booking_com', 'airbnb', 'expedia', 'phone', 'walk_in', 'other']).optional()
});

export const checkInSchema = z.object({
  notes: z.string().max(500).trim().optional()
});

export const checkOutSchema = z.object({
  notes: z.string().max(500).trim().optional(),
  additionalCharges: z.array(z.object({
    description: z.string().min(1, 'Charge description is required'),
    amount: z.number().positive('Amount must be positive')
  })).optional()
});

export const cancelReservationSchema = z.object({
  reason: z.string()
    .min(1, 'Cancellation reason is required')
    .max(500, 'Reason cannot exceed 500 characters')
    .trim(),
  refundAmount: z.number()
    .min(0, 'Refund amount cannot be negative')
    .optional()
});

// Response schema
export const reservationResponseSchema = z.object({
  _id: z.string(),
  tenantId: z.string(),
  propertyId: z.string(),
  roomId: z.string(),
  guestId: z.string(),
  confirmationNumber: z.string(),
  dates: z.object({
    checkInDate: z.date(),
    checkOutDate: z.date(),
    actualCheckInDate: z.date().optional(),
    actualCheckOutDate: z.date().optional()
  }),
  guests: z.object({
    adults: z.number(),
    children: z.number(),
    additionalGuests: z.array(z.object({
      firstName: z.string(),
      lastName: z.string(),
      age: z.number().optional(),
      identification: z.string().optional()
    }))
  }),
  status: z.enum(Object.values(RESERVATION_STATUS)),
  pricing: z.object({
    roomRate: z.number(),
    nights: z.number(),
    subtotal: z.number(),
    taxes: z.number(),
    fees: z.object({
      cleaning: z.number(),
      service: z.number(),
      extra: z.number()
    }),
    totalPrice: z.number(),
    currency: z.string()
  }),
  paymentStatus: z.enum(Object.values(PAYMENT_STATUS)),
  paymentSummary: z.object({
    totalPaid: z.number(),
    remainingBalance: z.number(),
    depositRequired: z.number(),
    depositPaid: z.boolean()
  }),
  source: z.string(),
  specialRequests: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});
