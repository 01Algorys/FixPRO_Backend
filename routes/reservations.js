const express = require('express');
const { body, query } = require('express-validator');
const reservationController = require('../controllers/reservationController');
const { protect, authorize, checkOwnership } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createReservationValidation = [
  body('workerId')
    .notEmpty()
    .withMessage('Worker ID is required')
    .toInt()
    .isInt({ min: 1 })
    .withMessage('Invalid worker ID'),

  body('service')
    .notEmpty()
    .withMessage('Service ID is required')
    .toInt()
    .isInt({ min: 1 })
    .withMessage('Invalid service ID'),

  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format'),

  body('time')
    .notEmpty()
    .withMessage('Time is required')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Time must be in HH:MM format'),

  body('duration')
    .notEmpty()
    .withMessage('Duration is required')
    .toInt()
    .isInt({ min: 15, max: 480 })
    .withMessage('Duration must be between 15 and 480 minutes'),

  body('location')
    .notEmpty()
    .withMessage('Location is required')
    .isObject()
    .withMessage('Location must be an object'),

  body('location.latitude')
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),

  body('location.longitude')
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Description must be between 1 and 1000 characters'),

  body('emergency')
    .optional()
    .isBoolean()
    .withMessage('Emergency must be a boolean'),

  body('images')
    .optional()
    .isArray()
    .withMessage('Images must be an array'),

  body('images.*')
    .optional()
    .isURL()
    .withMessage('Each image must be a valid URL')
];

const updateStatusValidation = [
  body('status')
    .isIn(['accepted', 'rejected', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid status'),

  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters')
];

const cancelReservationValidation = [
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters')
];

const addNoteValidation = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Note content is required')
    .isLength({ min: 1, max: 500 })
    .withMessage('Note must be between 1 and 500 characters'),

  body('internal')
    .optional()
    .isBoolean()
    .withMessage('Internal must be a boolean')
];

const getReservationsValidation = [
  query('status')
    .optional()
    .isIn(['pending', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid status'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// All routes require authentication
router.use(protect);

// Routes
router.get('/', authorize('admin'), getReservationsValidation, reservationController.getReservations);
router.get('/:id', reservationController.getReservation);
router.get('/worker/:workerId', getReservationsValidation, reservationController.getReservationsByWorkerId);
router.post('/', authorize('user'), createReservationValidation, reservationController.createReservation);
router.put('/:id/status', updateStatusValidation, reservationController.updateReservationStatus);
router.delete('/:id', cancelReservationValidation, reservationController.cancelReservation);
router.post('/:id/notes', addNoteValidation, reservationController.addNote);

module.exports = router;
