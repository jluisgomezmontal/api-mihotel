import { z } from 'zod';
import { TENANT_TYPES, TENANT_PLANS } from '../config/constants.js';

/**
 * Zod validation schemas for Tenant model
 */

export const createTenantSchema = z.object({
  name: z.string()
    .min(2, 'Tenant name must be at least 2 characters')
    .max(100, 'Tenant name cannot exceed 100 characters')
    .trim(),
  
  type: z.enum(Object.values(TENANT_TYPES), {
    errorMap: () => ({ message: `Type must be one of: ${Object.values(TENANT_TYPES).join(', ')}` })
  }),
  
  plan: z.enum(Object.values(TENANT_PLANS), {
    errorMap: () => ({ message: `Plan must be one of: ${Object.values(TENANT_PLANS).join(', ')}` })
  }).optional(),
  
  settings: z.object({
    currency: z.string()
      .length(3, 'Currency must be 3 characters')
      .optional(),
    timezone: z.string()
      .min(1, 'Timezone is required')
      .optional(),
    language: z.string()
      .max(5, 'Language code cannot exceed 5 characters')
      .optional()
  }).optional(),
  
  subscription: z.object({
    endDate: z.coerce.date().optional(),
    isTrialActive: z.boolean().optional()
  }).optional()
});

export const updateTenantSchema = createTenantSchema.partial();

export const tenantParamsSchema = z.object({
  tenantId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid tenant ID format')
});

// Response schema for API documentation
export const tenantResponseSchema = z.object({
  _id: z.string(),
  name: z.string(),
  type: z.enum(Object.values(TENANT_TYPES)),
  plan: z.enum(Object.values(TENANT_PLANS)),
  isActive: z.boolean(),
  settings: z.object({
    currency: z.string(),
    timezone: z.string(),
    language: z.string()
  }),
  subscription: z.object({
    startDate: z.date(),
    endDate: z.date().optional(),
    isTrialActive: z.boolean()
  }),
  createdAt: z.date(),
  updatedAt: z.date()
});
