const express = require('express');
const { body, query } = require('express-validator');
const reviewController = require('../controllers/reviewController');
const { protect, authorize, requireWorkerOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createReviewValidation = [
  body('reservationId')
    .notEmpty()
    .withMessage('Reservation ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid reservation ID'),
  
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Comment cannot exceed 1000 characters'),
  
  body('aspects.professionalism')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Professionalism rating must be between 1 and 5'),
  
  body('aspects.quality')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Quality rating must be between 1 and 5'),
  
  body('aspects.timeliness')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Timeliness rating must be between 1 and 5'),
  
  body('aspects.communication')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Communication rating must be between 1 and 5'),
  
  body('aspects.value')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Value rating must be between 1 and 5'),
  
  body('wouldHireAgain')
    .isBoolean()
    .withMessage('Would hire again must be a boolean'),
  
  body('images')
    .optional()
    .isArray()
    .withMessage('Images must be an array'),
  
  body('images.*')
    .optional()
    .isURL()
    .withMessage('Each image must be a valid URL')
];

const updateReviewValidation = [
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Comment cannot exceed 1000 characters'),
  
  body('aspects.professionalism')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Professionalism rating must be between 1 and 5'),
  
  body('aspects.quality')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Quality rating must be between 1 and 5'),
  
  body('aspects.timeliness')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Timeliness rating must be between 1 and 5'),
  
  body('aspects.communication')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Communication rating must be between 1 and 5'),
  
  body('aspects.value')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Value rating must be between 1 and 5'),
  
  body('wouldHireAgain')
    .optional()
    .isBoolean()
    .withMessage('Would hire again must be a boolean'),
  
  body('images')
    .optional()
    .isArray()
    .withMessage('Images must be an array'),
  
  body('images.*')
    .optional()
    .isURL()
    .withMessage('Each image must be a valid URL')
];

const reportReviewValidation = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Report reason is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters')
];

const respondReviewValidation = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Response content is required')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Response must be between 10 and 1000 characters')
];

const getReviewsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5')
];

// Public routes
router.get('/worker/:workerId', getReviewsValidation, reviewController.getWorkerReviews);
router.get('/stats/:workerId', reviewController.getWorkerStats);

// Protected routes
router.use(protect);

router.get('/user/my-reviews', getReviewsValidation, reviewController.getUserReviews);
router.post('/', authorize('user'), createReviewValidation, reviewController.createReview);
router.patch('/:id', updateReviewValidation, reviewController.updateReview);
router.delete('/:id', reviewController.deleteReview);
router.post('/:id/helpful', reviewController.markHelpful);
router.post('/:id/report', reportReviewValidation, reviewController.reportReview);
router.post('/:id/respond', requireWorkerOrAdmin, respondReviewValidation, reviewController.respondToReview);

module.exports = router;
