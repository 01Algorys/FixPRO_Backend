const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Rate limiting
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message || 'Too many requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Different rate limits for different endpoints (increased for development)
const authLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  1000, // increased to 1000 attempts for development
  'Too many login attempts, please try again after 15 minutes'
);

const generalLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  10000, // increased to 10000 requests for development
  'Too many requests, please try again later'
);

const uploadLimiter = createRateLimit(
  60 * 60 * 1000, // 1 hour
  1000, // increased to 1000 uploads for development
  'Too many upload attempts, please try again later'
);

// Input sanitization
const sanitizeInput = (req, res, next) => {
  // Generic input sanitization function
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        
        if (typeof value === 'string') {
          // Remove potentially harmful characters
          sanitized[key] = value
            .replace(/\$/g, '')
            .replace(/;/g, '')
            .replace(/--/g, '')
            .replace(/\//g, '')
            .replace(/\\/g, '');
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
    }
    return sanitized;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitize(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitize(req.query);
  }

  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
};

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

// Request size limiter
const requestSizeLimiter = (req, res, next) => {
  const contentLength = req.get('content-length');
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength && parseInt(contentLength) > maxSize) {
    return res.status(413).json({
      success: false,
      message: 'Request entity too large'
    });
  }

  next();
};

// IP whitelist for admin routes
const adminIPWhitelist = (req, res, next) => {
  const allowedIPs = process.env.ADMIN_IPS ? process.env.ADMIN_IPS.split(',') : [];
  
  if (allowedIPs.length === 0) {
    return next(); // No IP restriction if not configured
  }

  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  
  if (allowedIPs.includes(clientIP)) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied: IP not whitelisted'
    });
  }
};

module.exports = {
  securityHeaders,
  authLimiter,
  generalLimiter,
  uploadLimiter,
  sanitizeInput,
  corsOptions,
  requestSizeLimiter,
  adminIPWhitelist
};
