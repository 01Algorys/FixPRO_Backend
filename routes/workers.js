const express = require('express');
const { body, query } = require('express-validator');
const workerController = require('../controllers/workerController');
const { protect, requireWorkerOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const updateProfileValidation = [
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  
  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array'),
  
  body('skills.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each skill must be between 1 and 50 characters'),
  
  body('experience')
    .optional()
    .isNumeric()
    .withMessage('Experience must be a number')
    .isInt({ min: 0, max: 50 })
    .withMessage('Experience must be between 0 and 50 years'),
  
  body('hourlyRate')
    .optional()
    .isNumeric()
    .withMessage('Hourly rate must be a number')
    .isFloat({ min: 0, max: 1000 })
    .withMessage('Hourly rate must be between 0 and 1000'),
  
  body('serviceArea.cities')
    .optional()
    .isArray()
    .withMessage('Service area cities must be an array'),
  
  body('serviceArea.radius')
    .optional()
    .isNumeric()
    .withMessage('Service radius must be a number')
    .isFloat({ min: 1, max: 100 })
    .withMessage('Service radius must be between 1 and 100 km')
];

const updateStatusValidation = [
  body('status')
    .isIn(['accepted', 'rejected', 'in_progress', 'completed'])
    .withMessage('Invalid status'),
  
  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters')
];

const searchValidation = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),
  
  query('category')
    .optional()
    .isIn(['plumbing', 'electrical', 'hvac', 'locksmith'])
    .withMessage('Invalid category'),
  
  query('city')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('City name must be at least 2 characters'),
  
  query('minRating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Minimum rating must be between 0 and 5'),
  
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be a positive number'),
  
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
router.get('/', searchValidation, workerController.getWorkers);
router.get('/search', searchValidation, workerController.searchWorkers);
router.get('/by-id/:id', workerController.getWorkerById);
router.get('/:id/reviews', workerController.getWorkerReviewsPublic);
router.get('/:id/dashboard', workerController.getWorkerDashboardPublic);

// Protected routes
router.use(protect);

// Worker-only routes
router.use(requireWorkerOrAdmin);

router.get('/profile', workerController.getWorkerProfile);
router.put('/profile', updateProfileValidation, workerController.updateWorkerProfile);
router.get('/reservations', workerController.getWorkerReservations);
router.put('/reservations/:id/status', updateStatusValidation, workerController.updateReservationStatus);
// router.get('/reviews', workerController.getWorkerReviews); // Replaced by public route
// router.get('/dashboard', workerController.getWorkerDashboard); // Replaced by public route
router.get('/:id', workerController.getWorker);

module.exports = router;
