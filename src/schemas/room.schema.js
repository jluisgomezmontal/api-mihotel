import { z } from 'zod';
import { ROOM_TYPES, ROOM_STATUS } from '../config/constants.js';

/**
 * Zod validation schemas for Room model
 */

export const createRoomSchema = z.object({
  propertyId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid property ID format'),
  
  nameOrNumber: z.string()
    .min(1, 'Room name or number is required')
    .max(50, 'Room name/number cannot exceed 50 characters')
    .trim(),
  
  type: z.enum(Object.values(ROOM_TYPES), {
    errorMap: () => ({ message: `Type must be one of: ${Object.values(ROOM_TYPES).join(', ')}` })
  }),
  
  capacity: z.object({
    adults: z.number()
      .int('Adult capacity must be an integer')
      .min(1, 'Adult capacity must be at least 1')
      .max(20, 'Adult capacity cannot exceed 20'),
    children: z.number()
      .int('Children capacity must be an integer')
      .min(0, 'Children capacity cannot be negative')
      .max(10, 'Children capacity cannot exceed 10')
      .optional()
  }),
  
  pricing: z.object({
    basePrice: z.number()
      .positive('Base price must be positive'),
    currency: z.string()
      .length(3, 'Currency must be 3 characters')
      .optional(),
    extraAdultPrice: z.number()
      .min(0, 'Extra adult price cannot be negative')
      .optional(),
    extraChildPrice: z.number()
      .min(0, 'Extra child price cannot be negative')
      .optional()
  }),
  
  amenities: z.array(z.string().trim()).optional(),
  
  status: z.enum(Object.values(ROOM_STATUS), {
    errorMap: () => ({ message: `Status must be one of: ${Object.values(ROOM_STATUS).join(', ')}` })
  }).optional(),
  
  description: z.string()
    .max(500, 'Description cannot exceed 500 characters')
    .trim()
    .optional(),
  
  images: z.array(z.object({
    url: z.string().url('Invalid image URL'),
    caption: z.string().trim().optional(),
    isMain: z.boolean().optional()
  })).optional(),
  
  dimensions: z.object({
    area: z.number()
      .positive('Area must be positive')
      .optional(),
    unit: z.enum(['sqm', 'sqft']).optional()
  }).optional(),
  
  bedConfiguration: z.array(z.object({
    type: z.enum(['single', 'double', 'queen', 'king', 'sofa_bed', 'bunk_bed']),
    quantity: z.number()
      .int('Bed quantity must be an integer')
      .min(1, 'Bed quantity must be at least 1')
  })).optional()
});

export const updateRoomSchema = createRoomSchema.partial();

export const roomParamsSchema = z.object({
  roomId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid room ID format')
});

export const roomQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  propertyId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid property ID format')
    .optional(),
  type: z.enum(Object.values(ROOM_TYPES)).optional(),
  status: z.enum(Object.values(ROOM_STATUS)).optional(),
  search: z.string().min(1).optional(),
  isActive: z.coerce.boolean().optional()
});

export const checkAvailabilitySchema = z.object({
  checkInDate: z.coerce.date({
    errorMap: () => ({ message: 'Invalid check-in date' })
  }),
  checkOutDate: z.coerce.date({
    errorMap: () => ({ message: 'Invalid check-out date' })
  }),
  propertyId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid property ID format')
    .optional(),
  adults: z.coerce.number().min(1).max(20).optional().default(1),
  children: z.coerce.number().min(0).max(10).optional().default(0)
}).refine(data => data.checkOutDate > data.checkInDate, {
  message: "Check-out date must be after check-in date",
  path: ["checkOutDate"]
});

// Response schema
export const roomResponseSchema = z.object({
  _id: z.string(),
  tenantId: z.string(),
  propertyId: z.string(),
  nameOrNumber: z.string(),
  type: z.enum(Object.values(ROOM_TYPES)),
  capacity: z.object({
    adults: z.number(),
    children: z.number()
  }),
  pricing: z.object({
    basePrice: z.number(),
    currency: z.string(),
    extraAdultPrice: z.number(),
    extraChildPrice: z.number()
  }),
  amenities: z.array(z.string()),
  status: z.enum(Object.values(ROOM_STATUS)),
  description: z.string().optional(),
  images: z.array(z.object({
    url: z.string(),
    caption: z.string().optional(),
    isMain: z.boolean()
  })),
  dimensions: z.object({
    area: z.number().optional(),
    unit: z.string()
  }).optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});
