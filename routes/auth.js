const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { protect, authorize, requireWorkerOrAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { normalizePhone } = require('../utils/phone');

const router = express.Router();

// Shared phone validity rule — accepts international formats, validated via
// libphonenumber-js (default region Tunisia) rather than a loose character regex.
const validPhoneRule = body('phone')
  .optional({ checkFalsy: true })
  .custom((value) => {
    if (!normalizePhone(value)) {
      throw new Error('Please provide a valid phone number');
    }
    return true;
  });

// Shared password strength rule — used in both register and change-password
const strongPasswordRule = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters long')
  .matches(/[A-Z]/)
  .withMessage('Password must contain at least one uppercase letter')
  .matches(/[a-z]/)
  .withMessage('Password must contain at least one lowercase letter')
  .matches(/\d/)
  .withMessage('Password must contain at least one number')
  .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/)
  .withMessage('Password must contain at least one special character');

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

  strongPasswordRule,

  body('role')
    .optional()
    .isIn(['USER', 'WORKER'])
    .withMessage('Role must be either USER or WORKER'),

  validPhoneRule,

  body('services')
    .optional()
    .isArray()
    .withMessage('Services must be an array of service IDs'),

  body('services.*')
    .optional()
    .isInt()
    .withMessage('Each service ID must be an integer')
];

const loginValidation = [
  // Accept email or phone — at least one must be present
  body('email')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('phone')
    .optional({ checkFalsy: true }),

  body().custom((value) => {
    if (!value.email && !value.phone) {
      throw new Error('Email or phone number is required');
    }
    return true;
  }),

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
  
  validPhoneRule,

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
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('New password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('New password must contain at least one lowercase letter')
    .matches(/\d/)
    .withMessage('New password must contain at least one number')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/)
    .withMessage('New password must contain at least one special character')
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
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/)
    .withMessage('Password must contain at least one special character')
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
router.post('/upload-avatar', upload.single('avatar'), authController.uploadAvatar);

module.exports = router;
