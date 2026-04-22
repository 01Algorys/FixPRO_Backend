const { prisma } = require('../config/database');
const { validationResult } = require('express-validator');

// @desc    Get all services
// @route   GET /api/services
// @access  Public
const getServices = async (req, res, next) => {
  try {
    const { category, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where = { isActive: true };
    if (category) {
      where.category = category;
    }

    const services = await prisma.service.findMany({
      where,
      orderBy: [
        { isPopular: 'desc' },
        { name: 'asc' }
      ],
      skip: skip,
      take: parseInt(limit)
    });

    const total = await prisma.service.count({ where });

    res.status(200).json({
      success: true,
      data: {
        services,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get service by ID
// @route   GET /api/services/:id
// @access  Public
const getService = async (req, res, next) => {
  try {
    const { id } = req.params;

    const service = await prisma.service.findUnique({
      where: { id: parseInt(id) }
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get services by category
// @route   GET /api/services/category/:category
// @access  Public
const getServicesByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Validate category
    const validCategories = ['plumbing', 'electrical', 'hvac', 'locksmith'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    const services = await prisma.service.findMany({
      where: { category, isActive: true },
      orderBy: [
        { isPopular: 'desc' },
        { name: 'asc' }
      ],
      skip: skip,
      take: parseInt(limit)
    });

    const total = await prisma.service.count({ where: { category, isActive: true } });

    res.status(200).json({
      success: true,
      data: {
        services,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get popular services
// @route   GET /api/services/popular
// @access  Public
const getPopularServices = async (req, res, next) => {
  try {
    const { limit = 8 } = req.query;

    const services = await prisma.service.findMany({
      where: { isActive: true, isPopular: true },
      orderBy: { name: 'asc' },
      take: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      data: services
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get service categories
// @route   GET /api/services/categories
// @access  Public
const getCategories = async (req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      select: { category: true }
    });

    const categories = [...new Set(services.map(s => s.category))];

    const categoryInfo = await Promise.all(categories.map(async category => {
      const count = await prisma.service.count({
        where: { category, isActive: true }
      });
      return {
        name: category,
        displayName: category.charAt(0).toUpperCase() + category.slice(1),
        count
      };
    }));

    res.status(200).json({
      success: true,
      data: categoryInfo
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new service (Admin only)
// @route   POST /api/services
// @access  Private (Admin only)
const createService = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const service = await prisma.service.create({
      data: req.body
    });

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: service
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update service (Admin only)
// @route   PUT /api/services/:id
// @access  Private (Admin only)
const updateService = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    const service = await prisma.service.update({
      where: { id: parseInt(id) },
      data: req.body
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      data: service
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete service (Admin only)
// @route   DELETE /api/services/:id
// @access  Private (Admin only)
const deleteService = async (req, res, next) => {
  try {
    const { id } = req.params;

    const service = await prisma.service.delete({
      where: { id: parseInt(id) }
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Initialize predefined services
// @route   POST /api/services/initialize
// @access  Private (Admin only)
const initializeServices = async (req, res, next) => {
  try {
    // TODO: Implement Prisma service initialization
    // This would create predefined services in the database
    
    res.status(200).json({
      success: true,
      message: 'Predefined services initialization not yet implemented for Prisma'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getServices,
  getService,
  getServicesByCategory,
  getPopularServices,
  getCategories,
  createService,
  updateService,
  deleteService,
  initializeServices
};
