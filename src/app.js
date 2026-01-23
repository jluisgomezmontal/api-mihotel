import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';

// Import middleware
import { 
  rateLimiter, 
  authRateLimiter, 
  corsOptions, 
  helmetConfig,
  sanitizeInput,
  requestLogger,
  securityHeaders,
  healthCheck,
  apiInfo
} from './middlewares/security.js';
import { errorHandler, notFoundHandler, timeoutHandler } from './middlewares/errorHandler.js';
import { cleanupTenantGuard } from './middlewares/tenantGuard.js';

// Import routes
import authRoutes from './modules/auth/auth.routes.js';
import propertyRoutes from './modules/properties/property.routes.js';
import roomRoutes from './modules/rooms/room.routes.js';
import guestRoutes from './modules/guests/guest.routes.js';
import reservationRoutes from './modules/reservations/reservation.routes.js';
import userRoutes from './modules/users/user.routes.js';
import paymentRoutes from './modules/payments/payment.routes.js';
import reportRoutes from './modules/reports/report.routes.js';

// Load environment variables
dotenv.config();

/**
 * Express Application Setup
 * Configures middleware, routes, and error handling for the MiHotel SaaS API
 */
const app = express();

// =================================
// SECURITY MIDDLEWARE
// =================================

// Request timeout
app.use(timeoutHandler(30000)); // 30 seconds

// Security headers
app.use(helmet(helmetConfig));

// CORS configuration
app.use(cors(corsOptions));

// Request logging (in development)
if (process.env.NODE_ENV === 'development') {
  app.use(requestLogger);
}

// Custom security headers
app.use(securityHeaders);

// Rate limiting
app.use('/api/auth', authRateLimiter); // Strict rate limiting for auth
app.use('/api', rateLimiter); // General rate limiting

// =================================
// PARSING MIDDLEWARE
// =================================

// Body parsing
app.use(express.json({ 
  limit: '10mb',
  strict: true 
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Input sanitization
app.use(sanitizeInput);

// =================================
// HEALTH & INFO ENDPOINTS
// =================================

app.get('/health', healthCheck);
app.get('/api', apiInfo);

// =================================
// API ROUTES
// =================================

// Authentication routes
app.use('/api/auth', authRoutes);

// Protected API routes (require authentication)
app.use('/api/properties', propertyRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);

// =================================
// API DOCUMENTATION (Future)
// =================================

// app.use('/api/docs', swaggerRoutes); // TODO: Add Swagger documentation

// =================================
// ROOT ENDPOINT
// =================================

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to MiHotel SaaS API',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/health',
    info: '/api'
  });
});

// =================================
// CLEANUP MIDDLEWARE
// =================================

// Cleanup tenant guard (restore mongoose methods)
app.use(cleanupTenantGuard);

// =================================
// ERROR HANDLING
// =================================

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// =================================
// GRACEFUL SHUTDOWN
// =================================

process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

export default app;
