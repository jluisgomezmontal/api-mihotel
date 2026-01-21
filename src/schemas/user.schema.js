import { z } from 'zod';
import { USER_ROLES } from '../config/constants.js';

/**
 * Zod validation schemas for User model
 */

export const registerUserSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .trim(),
  
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password cannot exceed 100 characters'),
  
  role: z.enum(Object.values(USER_ROLES), {
    errorMap: () => ({ message: `Role must be one of: ${Object.values(USER_ROLES).join(', ')}` })
  }).optional(),
  
  profile: z.object({
    phone: z.string().trim().optional(),
    timezone: z.string().optional()
  }).optional()
});

export const loginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  
  password: z.string()
    .min(1, 'Password is required')
});

export const updateUserSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .trim()
    .optional(),
  
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
    .optional(),
  
  role: z.enum(Object.values(USER_ROLES), {
    errorMap: () => ({ message: `Role must be one of: ${Object.values(USER_ROLES).join(', ')}` })
  }).optional(),
  
  profile: z.object({
    phone: z.string().trim().optional(),
    avatar: z.string().url('Invalid avatar URL').optional(),
    timezone: z.string().optional()
  }).optional(),
  
  permissions: z.object({
    canManageProperties: z.boolean().optional(),
    canManageUsers: z.boolean().optional(),
    canManageReservations: z.boolean().optional(),
    canViewReports: z.boolean().optional()
  }).optional(),
  
  isActive: z.boolean().optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string()
    .min(1, 'Current password is required'),
  
  newPassword: z.string()
    .min(6, 'New password must be at least 6 characters')
    .max(100, 'New password cannot exceed 100 characters'),
  
  confirmPassword: z.string()
    .min(1, 'Password confirmation is required')
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export const userParamsSchema = z.object({
  userId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format')
});

// Response schema for API documentation
export const userResponseSchema = z.object({
  _id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(Object.values(USER_ROLES)),
  profile: z.object({
    phone: z.string().optional(),
    avatar: z.string().optional(),
    timezone: z.string()
  }),
  permissions: z.object({
    canManageProperties: z.boolean(),
    canManageUsers: z.boolean(),
    canManageReservations: z.boolean(),
    canViewReports: z.boolean()
  }),
  lastLoginAt: z.date().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});

// Query schemas
export const userQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  role: z.enum(Object.values(USER_ROLES)).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().min(1).optional()
});
