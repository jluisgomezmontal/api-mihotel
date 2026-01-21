import { z } from 'zod';

/**
 * Zod validation schemas for Guest model
 */

export const createGuestSchema = z.object({
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name cannot exceed 50 characters')
    .trim(),
  
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name cannot exceed 50 characters')
    .trim(),
  
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .optional(),
  
  phone: z.object({
    primary: z.string()
      .min(1, 'Primary phone number is required')
      .trim(),
    secondary: z.string().trim().optional()
  }),
  
  identification: z.object({
    type: z.enum(['passport', 'national_id', 'driver_license', 'other']),
    number: z.string()
      .min(1, 'Identification number is required')
      .trim(),
    expiryDate: z.coerce.date().optional(),
    issuingCountry: z.string().trim().optional()
  }),
  
  address: z.object({
    street: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
    country: z.string().trim().optional()
  }).optional(),
  
  dateOfBirth: z.coerce.date().optional(),
  nationality: z.string().trim().optional(),
  
  emergencyContact: z.object({
    name: z.string().trim().optional(),
    relationship: z.string().trim().optional(),
    phone: z.string().trim().optional()
  }).optional(),
  
  preferences: z.object({
    roomType: z.enum(['room', 'suite', 'apartment']).optional(),
    smokingRoom: z.boolean().optional(),
    floor: z.enum(['ground', 'high', 'any']).optional(),
    bedType: z.enum(['single', 'double', 'queen', 'king', 'twin']).optional(),
    dietaryRestrictions: z.array(z.string().trim()).optional(),
    accessibility: z.array(z.string().trim()).optional()
  }).optional(),
  
  notes: z.string()
    .max(1000, 'Notes cannot exceed 1000 characters')
    .trim()
    .optional(),
  
  vipStatus: z.boolean().optional(),
  blacklisted: z.boolean().optional(),
  blacklistReason: z.string().trim().optional()
});

export const updateGuestSchema = createGuestSchema.partial();

export const guestParamsSchema = z.object({
  guestId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid guest ID format')
});

export const guestQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  search: z.string().min(1).optional(),
  vipStatus: z.coerce.boolean().optional(),
  blacklisted: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional()
});

export const guestSearchSchema = z.object({
  query: z.string()
    .min(1, 'Search query is required')
    .trim()
});

// Response schema
export const guestResponseSchema = z.object({
  _id: z.string(),
  tenantId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  email: z.string().optional(),
  phone: z.object({
    primary: z.string(),
    secondary: z.string().optional()
  }),
  identification: z.object({
    type: z.string(),
    number: z.string(),
    expiryDate: z.date().optional(),
    issuingCountry: z.string().optional()
  }),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional()
  }).optional(),
  dateOfBirth: z.date().optional(),
  age: z.number().optional(),
  nationality: z.string().optional(),
  preferences: z.object({
    roomType: z.string().optional(),
    smokingRoom: z.boolean(),
    floor: z.string(),
    bedType: z.string(),
    dietaryRestrictions: z.array(z.string()),
    accessibility: z.array(z.string())
  }),
  notes: z.string().optional(),
  vipStatus: z.boolean(),
  blacklisted: z.boolean(),
  totalStays: z.number(),
  totalSpent: z.number(),
  loyaltyPoints: z.number(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});
