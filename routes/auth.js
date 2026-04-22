const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { protect, authorize, requireWorkerOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter and one number'),
  
  body('role')
    .optional()
    .isIn(['USER', 'WORKER'])
    .withMessage('Role must be either USER or WORKER'),
  
  body('phone')
    .optional()
    .matches(/^[+]?[\d\s-()]+$/)
    .withMessage('Please provide a valid phone number')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('phone')
    .optional()
    .matches(/^[+]?[\d\s-()]+$/)
    .withMessage('Please provide a valid phone number'),
  
  body('location.address')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Address cannot be empty'),
  
  body('location.city')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('City cannot be empty'),
  
  body('location.state')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('State cannot be empty'),
  
  body('location.zipCode')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Zip code cannot be empty')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
];

const resetPasswordValidation = [
  body('resetToken')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

const verifyEmailValidation = [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required')
];

// Public routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.post('/forgot-password', forgotPasswordValidation, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, authController.resetPassword);
router.post('/verify-email', verifyEmailValidation, authController.verifyEmail);

// Protected routes
router.use(protect); // All routes below this require authentication

router.get('/profile', authController.getProfile);
router.put('/profile', updateProfileValidation, authController.updateProfile);
router.put('/worker-profile', requireWorkerOrAdmin, updateProfileValidation, authController.updateWorkerProfile);
router.put('/change-password', changePasswordValidation, authController.changePassword);
router.post('/logout', authController.logout);

module.exports = router;
