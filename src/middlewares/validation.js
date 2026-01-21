import { HTTP_STATUS } from '../config/constants.js';

/**
 * Zod validation middleware factory
 * Creates middleware to validate request data against Zod schemas
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      let dataToValidate;
      
      switch (source) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'headers':
          dataToValidate = req.headers;
          break;
        default:
          dataToValidate = req.body;
      }

      // Validate data against schema
      const result = schema.safeParse(dataToValidate);
      
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors
        });
      }

      // Replace original data with validated and transformed data
      switch (source) {
        case 'body':
          req.body = result.data;
          break;
        case 'params':
          req.params = result.data;
          break;
        case 'query':
          req.query = result.data;
          break;
        case 'headers':
          req.headers = result.data;
          break;
      }

      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Validation processing failed'
      });
    }
  };
};

/**
 * Validate multiple sources at once
 */
export const validateMultiple = (validators) => {
  return async (req, res, next) => {
    try {
      for (const { schema, source } of validators) {
        const validationResult = await new Promise((resolve) => {
          validate(schema, source)(req, res, resolve);
        });

        // If validation failed, response was already sent
        if (res.headersSent) {
          return;
        }
      }
      next();
    } catch (error) {
      console.error('Multiple validation error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Validation processing failed'
      });
    }
  };
};

/**
 * Optional validation - validates if data exists but doesn't require it
 */
export const validateOptional = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      let dataToValidate;
      
      switch (source) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'headers':
          dataToValidate = req.headers;
          break;
        default:
          dataToValidate = req.body;
      }

      // Skip validation if no data
      if (!dataToValidate || Object.keys(dataToValidate).length === 0) {
        return next();
      }

      // Validate data against schema
      const result = schema.safeParse(dataToValidate);
      
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors
        });
      }

      // Replace original data with validated data
      switch (source) {
        case 'body':
          req.body = result.data;
          break;
        case 'params':
          req.params = result.data;
          break;
        case 'query':
          req.query = result.data;
          break;
        case 'headers':
          req.headers = result.data;
          break;
      }

      next();
    } catch (error) {
      console.error('Optional validation middleware error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Validation processing failed'
      });
    }
  };
};
