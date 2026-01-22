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
  
  phone: z.string()
    .min(1, 'Phone number is required')
    .trim(),
  
  dateOfBirth: z.coerce.date().optional(),
  nationality: z.string().trim().optional(),
  
  emergencyContact: z.object({
    name: z.string().trim().optional(),
    relationship: z.enum(['spouse', 'parent', 'sibling', 'child', 'friend', 'other']).optional(),
    phone: z.string().trim().optional()
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
  phone: z.string(),
  dateOfBirth: z.date().optional(),
  age: z.number().optional(),
  nationality: z.string().optional(),
  emergencyContact: z.object({
    name: z.string().optional(),
    relationship: z.string().optional(),
    phone: z.string().optional()
  }).optional(),
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
