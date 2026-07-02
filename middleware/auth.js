const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

// Middleware to protect routes
const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from token
      const user = await prisma.user.findUnique({
        where: { id: decoded.id }
      });
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. User not found.'
        });
      }

      // Prevent workers whose accounts are pending or rejected from using the API
      if (user.role === 'WORKER') {
        if (user.accountStatus === 'PENDING_APPROVAL') {
          return res.status(403).json({
            success: false,
            message: "Votre compte est en cours de validation par nos administrateurs. Veuillez patienter jusqu'à l'approbation de votre compte.",
            code: 'ACCOUNT_PENDING_APPROVAL'
          });
        }
        if (user.accountStatus === 'REJECTED') {
          return res.status(403).json({
            success: false,
            message: "Votre demande de compte a été refusée. Veuillez contacter notre support.",
            code: 'ACCOUNT_REJECTED'
          });
        }
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Middleware to authorize roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.map(r => r.toLowerCase()).includes(req.user.role.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route.`
      });
    }
    next();
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
          where: { id: decoded.id }
        });
        req.user = user;
      } catch (error) {
        // Token is invalid, but we don't fail the request
        req.user = null;
      }
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check if user owns the resource
const checkOwnership = (resourceField = 'userId') => {
  return (req, res, next) => {
    // Allow admin and worker to access any resource if they're the owner
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user is the owner of the resource
    const resourceUserId = req.params.userId || req.body[resourceField] || req.query[resourceField];
    
    if (req.user.id.toString() !== resourceUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own resources.'
      });
    }

    next();
  };
};

// Middleware to check if user is worker or admin
const requireWorkerOrAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (role !== 'worker' && role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Worker or admin role required.'
    });
  }
  next();
};

module.exports = {
  protect,
  authorize,
  optionalAuth,
  checkOwnership,
  requireWorkerOrAdmin
};
