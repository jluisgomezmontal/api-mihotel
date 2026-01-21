import { z } from 'zod';

/**
 * Zod validation schemas for Property model
 */

export const createPropertySchema = z.object({
  name: z.string()
    .min(2, 'Property name must be at least 2 characters')
    .max(200, 'Property name cannot exceed 200 characters')
    .trim(),
  
  description: z.string()
    .max(1000, 'Description cannot exceed 1000 characters')
    .trim()
    .optional(),
  
  address: z.object({
    street: z.string()
      .min(1, 'Street address is required')
      .trim(),
    city: z.string()
      .min(1, 'City is required')
      .trim(),
    state: z.string()
      .min(1, 'State is required')
      .trim(),
    postalCode: z.string().trim().optional(),
    country: z.string()
      .min(1, 'Country is required')
      .trim(),
    coordinates: z.object({
      latitude: z.number()
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90')
        .optional(),
      longitude: z.number()
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180')
        .optional()
    }).optional()
  }),
  
  contact: z.object({
    phone: z.string().trim().optional(),
    email: z.string().email('Invalid email format').toLowerCase().optional(),
    website: z.string().url('Invalid website URL').optional()
  }).optional(),
  
  timezone: z.string()
    .min(1, 'Timezone is required'),
  
  checkInTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Check-in time must be in HH:mm format'),
  
  checkOutTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Check-out time must be in HH:mm format'),
  
  amenities: z.array(z.string().trim()).optional(),
  
  images: z.array(z.object({
    url: z.string().url('Invalid image URL'),
    caption: z.string().trim().optional(),
    isMain: z.boolean().optional()
  })).optional(),
  
  settings: z.object({
    allowOnlineBooking: z.boolean().optional(),
    requireApproval: z.boolean().optional(),
    cancellationPolicy: z.enum(['flexible', 'moderate', 'strict']).optional(),
    advanceBookingDays: z.number()
      .min(0, 'Advance booking days cannot be negative')
      .max(365, 'Advance booking days cannot exceed 365')
      .optional()
  }).optional()
});

export const updatePropertySchema = createPropertySchema.partial();

export const propertyParamsSchema = z.object({
  propertyId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid property ID format')
});

export const propertyQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  isActive: z.coerce.boolean().optional()
});

// Response schema for API documentation
export const propertyResponseSchema = z.object({
  _id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string().optional(),
    country: z.string(),
    coordinates: z.object({
      latitude: z.number().optional(),
      longitude: z.number().optional()
    }).optional()
  }),
  contact: z.object({
    phone: z.string().optional(),
    email: z.string().optional(),
    website: z.string().optional()
  }).optional(),
  timezone: z.string(),
  checkInTime: z.string(),
  checkOutTime: z.string(),
  amenities: z.array(z.string()),
  images: z.array(z.object({
    url: z.string(),
    caption: z.string().optional(),
    isMain: z.boolean()
  })),
  settings: z.object({
    allowOnlineBooking: z.boolean(),
    requireApproval: z.boolean(),
    cancellationPolicy: z.string(),
    advanceBookingDays: z.number()
  }),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});
