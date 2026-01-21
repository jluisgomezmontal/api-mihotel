import { HTTP_STATUS } from '../config/constants.js';

/**
 * Global error handling middleware
 * Catches and formats all application errors
 */

/**
 * Error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    user: req.user?.id || 'anonymous'
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Invalid ID format';
    error = {
      message,
      statusCode: HTTP_STATUS.BAD_REQUEST
    };
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate value for field: ${field}`;
    error = {
      message,
      statusCode: HTTP_STATUS.CONFLICT
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    error = {
      message: 'Validation Error',
      errors: messages,
      statusCode: HTTP_STATUS.BAD_REQUEST
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Invalid token',
      statusCode: HTTP_STATUS.UNAUTHORIZED
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token expired',
      statusCode: HTTP_STATUS.UNAUTHORIZED
    };
  }

  // MongoDB connection errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    error = {
      message: 'Database operation failed',
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
    };
  }

  // Rate limiting errors
  if (err.status === 429) {
    error = {
      message: 'Too many requests, please try again later',
      statusCode: HTTP_STATUS.TOO_MANY_REQUESTS || 429
    };
  }

  res.status(error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: error.message || 'Internal Server Error',
    errors: error.errors || undefined,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      originalError: err
    })
  });
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message
  });
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch promise rejections
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Request timeout handler
 */
export const timeoutHandler = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(HTTP_STATUS.REQUEST_TIMEOUT || 408).json({
          success: false,
          message: 'Request timeout'
        });
      }
    }, timeout);

    res.on('finish', () => {
      clearTimeout(timer);
    });

    res.on('close', () => {
      clearTimeout(timer);
    });

    next();
  };
};
