const { Prisma } = require('@prisma/client');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error(err);

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        // Unique constraint violation
        const field = err.meta?.target?.[0] || 'field';
        const message = `${field} already exists`;
        error = { message, statusCode: 400 };
        break;
      case 'P2025':
        // Record not found
        error = { message: 'Resource not found', statusCode: 404 };
        break;
      case 'P2003':
        // Foreign key constraint violation
        error = { message: 'Invalid reference to related record', statusCode: 400 };
        break;
      case 'P2014':
        // Relation violation
        error = { message: 'Invalid relation operation', statusCode: 400 };
        break;
      default:
        error = { message: `Database error: ${err.message}`, statusCode: 500 };
    }
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    const message = `Validation error: ${err.message}`;
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // Default error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
