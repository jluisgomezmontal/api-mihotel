/**
 * Application constants and enums
 * Centralized configuration for business logic constants
 */

export const USER_ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff', 
  CLEANING: 'cleaning'
};

export const TENANT_TYPES = {
  HOTEL: 'hotel',
  AIRBNB: 'airbnb',
  POSADA: 'posada'
};

export const ROOM_TYPES = {
  ROOM: 'room',
  SUITE: 'suite',
  APARTMENT: 'apartment'
};

export const ROOM_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance',
  CLEANING: 'cleaning'
};

export const RESERVATION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  CANCELLED: 'cancelled'
};

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PARTIAL: 'partial',
  PAID: 'paid'
};

export const PAYMENT_METHODS = {
  CASH: 'cash',
  TRANSFER: 'transfer',
  CARD: 'card'
};

export const TENANT_PLANS = {
  BASIC: 'basic',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise'
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500
};
