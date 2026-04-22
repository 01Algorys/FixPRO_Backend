const express = require('express');
const { body, query } = require('express-validator');
const serviceController = require('../controllers/serviceController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createServiceValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Service name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Service name must be between 2 and 100 characters'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Service description is required')
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  body('category')
    .isIn(['plumbing', 'electrical', 'hvac', 'locksmith'])
    .withMessage('Category must be one of: plumbing, electrical, hvac, locksmith'),
  
  body('basePrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Base price must be a positive number'),
  
  body('priceUnit')
    .optional()
    .isIn(['hour', 'job', 'consultation'])
    .withMessage('Price unit must be one of: hour, job, consultation'),
  
  body('duration')
    .optional()
    .isInt({ min: 15 })
    .withMessage('Duration must be at least 15 minutes')
];

const updateServiceValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Service name must be between 2 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  body('category')
    .optional()
    .isIn(['plumbing', 'electrical', 'hvac', 'locksmith'])
    .withMessage('Category must be one of: plumbing, electrical, hvac, locksmith'),
  
  body('basePrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Base price must be a positive number'),
  
  body('priceUnit')
    .optional()
    .isIn(['hour', 'job', 'consultation'])
    .withMessage('Price unit must be one of: hour, job, consultation'),
  
  body('duration')
    .optional()
    .isInt({ min: 15 })
    .withMessage('Duration must be at least 15 minutes')
];

const getServicesValidation = [
  query('category')
    .optional()
    .isIn(['plumbing', 'electrical', 'hvac', 'locksmith'])
    .withMessage('Invalid category'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Public routes
router.get('/', getServicesValidation, serviceController.getServices);
router.get('/popular', serviceController.getPopularServices);
router.get('/categories', serviceController.getCategories);
router.get('/category/:category', serviceController.getServicesByCategory);
router.get('/:id', serviceController.getService);

// Protected routes (Admin only)
router.use(protect);
router.use(authorize('admin'));

router.post('/', createServiceValidation, serviceController.createService);
router.put('/:id', updateServiceValidation, serviceController.updateService);
router.delete('/:id', serviceController.deleteService);
router.post('/initialize', serviceController.initializeServices);

module.exports = router;
