const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// All admin routes require a valid JWT + ADMIN role
router.use(protect);
router.use(authorize('ADMIN'));

// Dashboard overview
router.get('/stats', adminController.getDashboardStats);

// User management
router.get('/users/stats', adminController.getUserStats);
router.get('/users',       adminController.getUsers);
router.get('/users/:id',   adminController.getUserById);
router.patch('/users/:id/approve', adminController.approveUser);
router.patch('/users/:id/reject',  adminController.rejectUser);
router.patch('/users/:id/status',  adminController.updateUserStatus);
router.patch('/users/:id/services', adminController.updateWorkerServices);

// Reservations
router.get('/reservations', adminController.getReservations);

// Reviews
router.get('/reviews', adminController.getReviews);

// Notifications
router.get('/notifications', adminController.getNotifications);

// Services / Categories
router.get('/services', adminController.getServices);

module.exports = router;
